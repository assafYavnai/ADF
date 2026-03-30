import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { ComplianceEntry } from "../learning-engine/compliance-map.js";
import { FixItem } from "../learning-engine/fix-items-map.js";
import type { RepairInvokeResult, RepairRequest, RepairResult } from "./types.js";

export async function runComponentRepair(
  request: RepairRequest,
  invoker: (prompt: string, sourcePath: string) => Promise<RepairInvokeResult>
): Promise<RepairResult> {
  await mkdir(request.bundleDir, { recursive: true });
  const artifactFile = join(request.bundleDir, basename(request.artifactPathHint) || `${request.component}-artifact.txt`);
  const rulebookFile = join(request.bundleDir, "rulebook.json");
  const findingsFile = join(request.bundleDir, "findings.json");
  const selfCheckFile = join(request.bundleDir, "self-check.json");
  const reviewPromptFile = join(request.bundleDir, basename(request.reviewPromptPath));
  const reviewContractFile = join(request.bundleDir, basename(request.reviewContractPath));
  const authorityDir = join(request.bundleDir, "authority");
  await mkdir(authorityDir, { recursive: true });

  await writeFile(artifactFile, request.artifactText, "utf-8");
  await writeFile(rulebookFile, JSON.stringify({ rules: request.rulebook, new_rule_ids: request.newRuleIds ?? [] }, null, 2), "utf-8");
  await writeFile(findingsFile, JSON.stringify({ findings: request.findings, unresolved: request.unresolved, leader_rationale: request.leaderRationale }, null, 2), "utf-8");
  await writeFile(selfCheckFile, JSON.stringify({ issues: request.selfCheckIssues ?? [] }, null, 2), "utf-8");
  await copyRequiredFile(request.reviewPromptPath, reviewPromptFile, "review prompt");
  await copyRequiredFile(request.reviewContractPath, reviewContractFile, "review contract");

  const authorityCopies = await Promise.all(
    request.sourceAuthorityPaths.map((sourcePath) =>
      copyRequiredFile(sourcePath, join(authorityDir, sourcePath), `source authority (${sourcePath})`).then(() =>
        join(authorityDir, sourcePath)
      )
    )
  );
  const manifestPath = join(request.bundleDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({
    component: request.component,
    mode: request.mode,
    artifact: artifactFile.replace(/\\/g, "/"),
    rulebook: rulebookFile.replace(/\\/g, "/"),
    findings: findingsFile.replace(/\\/g, "/"),
    self_check: selfCheckFile.replace(/\\/g, "/"),
    review_prompt: reviewPromptFile.replace(/\\/g, "/"),
    review_contract: reviewContractFile.replace(/\\/g, "/"),
    source_authorities: authorityCopies.map((filePath) => filePath.replace(/\\/g, "/")),
  }, null, 2), "utf-8");

  const prompt = `You are the shared ADF component repair engine for ${request.component}.\n\nREAD ONLY THE FILES DECLARED IN THIS MANIFEST:\n${manifestPath.replace(/\\/g, "/")}\n\nYOUR JOB:\n1. Walk every rule in the rulebook against the artifact.\n2. Fix all direct review findings and self-check gaps.\n3. Produce full updated artifact and machine-readable evidence.\n\nRESPONSE FORMAT:\n<${request.artifactTag}>\n${request.requiredArtifactInstructions}\n</${request.artifactTag}>\n\n<compliance_map>\n[{"rule_id":"RULE-001","status":"compliant"|"non_compliant"|"not_applicable","evidence_location":"<section>","evidence_summary":"..."}]\n</compliance_map>\n\n${request.mode === "revision" ? `<fix_items_map>\n[{"finding_id":"preferred-if-known","finding_group_id":"group-1","severity":"blocking"|"major"|"minor"|"suggestion","action":"accepted"|"rejected","summary":"...","evidence_location":"<section>","rejection_reason":"only if rejected"}]\n</fix_items_map>` : ""}`;

  const invokeResult = await invoker(prompt, `shared/component-repair-engine/${request.component}`);
  const rawResponsePath = join(request.bundleDir, "response.raw.txt");
  await writeFile(rawResponsePath, invokeResult.response, "utf-8");

  const artifactMatch = invokeResult.response.match(new RegExp(`<${request.artifactTag}>([\\s\\S]*?)</${request.artifactTag}>`));
  const complianceMatch = invokeResult.response.match(/<compliance_map>([\s\S]*?)<\/compliance_map>/);
  const fixItemsMatch = invokeResult.response.match(/<fix_items_map>([\s\S]*?)<\/fix_items_map>/);
  if (!artifactMatch || !complianceMatch) {
    throw new Error(`Repair engine response missing required sections in ${rawResponsePath}`);
  }

  const artifact = stripCodeFences(artifactMatch[1]).trim();
  const complianceMap = ComplianceEntry.array().parse(JSON.parse(complianceMatch[1].trim()));
  const fixItemsMap = fixItemsMatch ? FixItem.array().parse(JSON.parse(fixItemsMatch[1].trim())) : [];

  await writeFile(join(request.bundleDir, "response.parsed.json"), JSON.stringify({
    artifact_length: artifact.length,
    compliance_entries: complianceMap.length,
    fix_item_entries: fixItemsMap.length,
  }, null, 2), "utf-8");

  return {
    artifact,
    complianceMap,
    fixItemsMap,
    diffSummary: {
      changed: artifact !== request.artifactText,
      prior_length: request.artifactText.length,
      new_length: artifact.length,
      summary: artifact !== request.artifactText
        ? `${request.mode} updated the artifact and regenerated evidence.`
        : `${request.mode} kept the artifact text unchanged but regenerated evidence.`,
    },
    audit: {
      bundleDir: request.bundleDir,
      manifestPath,
      rawResponsePath,
      wasFallback: invokeResult.provenance?.was_fallback ?? false,
      invocationId: invokeResult.provenance?.invocation_id,
      provider: invokeResult.provenance?.provider,
      model: invokeResult.provenance?.model,
    },
  };
}

async function copyRequiredFile(source: string, destination: string, label: string): Promise<void> {
  try {
    await mkdir(dirname(destination), { recursive: true });
    const content = await readFile(source, "utf-8");
    await writeFile(destination, content, "utf-8");
  } catch (error) {
    throw new Error(`Failed to copy required ${label} from ${source}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:markdown|md|json)?\s*/i, "").replace(/\s*```$/, "");
}
