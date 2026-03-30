import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { ToolBuilderRequest, type ToolBuilderResult } from "./schemas/contract.js";

interface AttachedRoleInfo {
  directory: string;
  status: string | null;
}

/**
 * llm-tool-builder - governed tool for creating and updating LLM-powered tools.
 *
 * In normal mode it always routes role creation through agent-role-builder.
 * Bootstrap mode may skip the role-build step, but only when the request sets
 * skip_build_agent_role=true explicitly.
 */
export async function buildTool(requestPath: string, outputDir?: string): Promise<ToolBuilderResult> {
  const rawRequest = JSON.parse(stripUtf8Bom(await readFile(requestPath, "utf-8")));
  const request = ToolBuilderRequest.parse(rawRequest);

  const runDir = outputDir ?? join("tools/llm-tool-builder/runs", request.job_id);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "normalized-request.json"), JSON.stringify(request, null, 2), "utf-8");

  const toolRoot = request.tool_root;
  const toolContractPath = join(toolRoot, "tool-contract.json");
  const baselineContract = request.baseline_contract_path
    ? JSON.parse(stripUtf8Bom(await readFile(request.baseline_contract_path, "utf-8")))
    : null;

  let roleInfo: AttachedRoleInfo = {
    directory: request.import_existing_role ? resolve(request.import_existing_role) : join(toolRoot, "role"),
    status: null,
  };

  if (!request.skip_build_agent_role) {
    if (!request.agent_role_request_path && !request.import_existing_role) {
      return writeResult(runDir, {
        schema_version: "2.1",
        tool_name: request.tool_name,
        tool_slug: request.tool_slug,
        operation: request.operation,
        status: "blocked",
        status_reason: "Role build is mandatory unless skip_build_agent_role=true or an existing role is imported.",
        output_dir: runDir,
        tool_contract_path: null,
        role_directory: null,
        role_build_status: null,
      });
    }

    if (request.agent_role_request_path) {
      const { buildRole } = await import(resolveAgentRoleBuilderModule());
      const roleResult = await buildRole(request.agent_role_request_path);
      roleInfo = {
        directory: roleResult.canonical_role_directory ?? join(toolRoot, "role"),
        status: roleResult.status,
      };

      if (roleResult.status !== "frozen") {
        return writeResult(runDir, {
          schema_version: "2.1",
          tool_name: request.tool_name,
          tool_slug: request.tool_slug,
          operation: request.operation,
          status: "blocked",
          status_reason: `agent-role-builder did not freeze the tool role: ${roleResult.status_reason}`,
          output_dir: runDir,
          tool_contract_path: null,
          role_directory: roleResult.canonical_role_directory,
          role_build_status: roleResult.status,
        });
      }
    }
  }

  if (request.import_existing_role) {
    const sourceRoleDir = resolve(request.import_existing_role);
    const targetRoleDir = resolve(join(toolRoot, "role"));
    if (sourceRoleDir !== targetRoleDir) {
      await mkdir(dirname(targetRoleDir), { recursive: true });
      await cp(sourceRoleDir, targetRoleDir, { recursive: true, force: true });
    }
    roleInfo = {
      directory: targetRoleDir,
      status: roleInfo.status ?? "imported",
    };
  }

  await mkdir(toolRoot, { recursive: true });

  const toolContract = {
    schema_version: "2.1",
    tool_name: request.tool_name,
    tool_slug: request.tool_slug,
    operation: request.operation,
    goal: request.goal,
    business_context: request.business_context,
    owner: request.owner,
    entry_point: request.entry_point,
    baseline_contract_path: request.baseline_contract_path ?? null,
    imported_role_directory: request.import_existing_role ?? null,
    role_directory: roleInfo.directory,
    skip_build_agent_role: request.skip_build_agent_role,
    required_outputs: request.required_outputs,
    notes: request.notes,
    generated_at_utc: new Date().toISOString(),
    previous_contract: baselineContract,
  };

  await writeFile(toolContractPath, JSON.stringify(toolContract, null, 2), "utf-8");

  return writeResult(runDir, {
    schema_version: "2.1",
    tool_name: request.tool_name,
    tool_slug: request.tool_slug,
    operation: request.operation,
    status: "success",
    status_reason: request.skip_build_agent_role
      ? "Tool contract written in bootstrap mode."
      : "Tool contract written and governed role attached.",
    output_dir: runDir,
    tool_contract_path: toolContractPath,
    role_directory: roleInfo.directory,
    role_build_status: roleInfo.status,
  });
}

async function writeResult(runDir: string, result: ToolBuilderResult): Promise<ToolBuilderResult> {
  await writeFile(join(runDir, "result.json"), JSON.stringify(result, null, 2), "utf-8");
  return result;
}

function resolveAgentRoleBuilderModule(): string {
  return new URL("../../agent-role-builder/src/index.js", import.meta.url).href;
}

function stripUtf8Bom(raw: string): string {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

if (process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js")) {
  const requestPath = process.argv[2];
  const outputDir = process.argv[3];

  if (!requestPath) {
    console.error("Usage: llm-tool-builder <request.json> [output-dir]");
    process.exit(1);
  }

  buildTool(requestPath, outputDir)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === "success" ? 0 : 1);
    })
    .catch((err) => {
      console.error("Fatal:", err);
      process.exit(2);
    });
}
