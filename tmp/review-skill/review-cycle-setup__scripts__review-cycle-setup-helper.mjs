#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0];
  if (!command) fail("Missing command. Use 'write-setup'.");
  if (command !== "write-setup") fail("Unknown command '" + command + "'. Use 'write-setup'.");

  const projectRoot = normalizeSlashes(resolve(requiredArg(args, "project-root")));
  const existing = await loadExistingSetup(projectRoot);
  const capabilities = detectCapabilities(args, existing.detected_runtime_capabilities ?? {});
  const derived = deriveSetup(args, capabilities, existing);
  await writeJson(derived.path, derived.setup);
  printJson({
    setup_path: derived.path,
    created: !existing.exists,
    setup_complete: isSetupComplete(derived.setup),
    setup: derived.setup,
  });
}

async function loadExistingSetup(projectRoot) {
  const path = resolve(projectRoot, ".codex", "review-cycle", "setup.json");
  if (!(await pathExists(path))) return { exists: false, path, detected_runtime_capabilities: {} };
  return { exists: true, path, ...(await readJson(path)) };
}

function detectCapabilities(args, fallback) {
  const detectedCliAvailable = detectCodexCliAvailable();
  return {
    native_agent_spawning_available: booleanArg(args, "native-agent-spawning-available", fallback.native_agent_spawning_available ?? false),
    native_agent_access_configurable: booleanArg(args, "native-agent-access-configurable", fallback.native_agent_access_configurable ?? false),
    native_agent_inherits_runtime_access: booleanArg(args, "native-agent-inherits-runtime-access", fallback.native_agent_inherits_runtime_access ?? false),
    native_agent_resume_available: booleanArg(args, "native-agent-resume-available", fallback.native_agent_resume_available ?? false),
    native_agent_send_input_available: booleanArg(args, "native-agent-send-input-available", fallback.native_agent_send_input_available ?? false),
    native_agent_wait_available: booleanArg(args, "native-agent-wait-available", fallback.native_agent_wait_available ?? false),
    native_parallel_wait_available: booleanArg(args, "native-parallel-wait-available", fallback.native_parallel_wait_available ?? false),
    codex_cli_available: booleanArg(args, "codex-cli-available", fallback.codex_cli_available ?? detectedCliAvailable),
    codex_cli_full_auto_supported: booleanArg(args, "codex-cli-full-auto-supported", fallback.codex_cli_full_auto_supported ?? detectedCliAvailable),
    codex_cli_bypass_supported: booleanArg(args, "codex-cli-bypass-supported", fallback.codex_cli_bypass_supported ?? detectedCliAvailable),
  };
}

function deriveSetup(args, capabilities, existing) {
  const inferred = inferPreferredModes(capabilities);
  const timestamps = {
    created_at: existing.created_at ?? nowIso(),
    updated_at: nowIso(),
  };

  const fallbackExecutionAccessMode = args.values["fallback-execution-access-mode"]
    ?? existing.fallback_execution_access_mode
    ?? (capabilities.native_agent_inherits_runtime_access ? "inherits_current_runtime_access" : "interactive_fallback");

  return {
    path: existing.path,
    setup: {
      project_root: normalizeSlashes(resolve(requiredArg(args, "project-root"))),
      preferred_execution_access_mode: args.values["preferred-execution-access-mode"] ?? existing.preferred_execution_access_mode ?? inferred.preferred_execution_access_mode,
      preferred_auditor_access_mode: args.values["preferred-auditor-access-mode"] ?? existing.preferred_auditor_access_mode ?? args.values["preferred-execution-access-mode"] ?? existing.preferred_execution_access_mode ?? inferred.preferred_execution_access_mode,
      preferred_reviewer_access_mode: args.values["preferred-reviewer-access-mode"] ?? existing.preferred_reviewer_access_mode ?? args.values["preferred-execution-access-mode"] ?? existing.preferred_execution_access_mode ?? inferred.preferred_execution_access_mode,
      preferred_implementor_access_mode: args.values["preferred-implementor-access-mode"] ?? existing.preferred_implementor_access_mode ?? args.values["preferred-execution-access-mode"] ?? existing.preferred_execution_access_mode ?? inferred.preferred_execution_access_mode,
      fallback_execution_access_mode: fallbackExecutionAccessMode,
      runtime_permission_model: args.values["runtime-permission-model"] ?? existing.runtime_permission_model ?? inferred.runtime_permission_model,
      execution_access_notes: args.values["execution-access-notes"] ?? existing.execution_access_notes ?? inferred.execution_access_notes,
      preferred_execution_runtime: args.values["preferred-execution-runtime"] ?? existing.preferred_execution_runtime ?? inferred.preferred_execution_runtime,
      persistent_execution_strategy: args.values["persistent-execution-strategy"] ?? existing.persistent_execution_strategy ?? inferred.persistent_execution_strategy,
      requires_project_specific_permission_rules: booleanArg(args, "requires-project-specific-permission-rules", existing.requires_project_specific_permission_rules ?? false),
      project_specific_permission_rules: (args.multi["project-permission-rule"] ?? existing.project_specific_permission_rules ?? []).filter(Boolean),
      detected_runtime_capabilities: capabilities,
      ...timestamps,
    },
  };
}

function inferPreferredModes(capabilities) {
  const nativePersistent = capabilities.native_agent_spawning_available
    && capabilities.native_agent_resume_available
    && capabilities.native_agent_send_input_available
    && capabilities.native_agent_wait_available;

  if (capabilities.native_agent_access_configurable && nativePersistent) {
    return {
      runtime_permission_model: "native_explicit_full_access",
      preferred_execution_access_mode: "native_full_access",
      preferred_execution_runtime: "native_agent_tools",
      persistent_execution_strategy: "per_feature_agent_registry",
      execution_access_notes: "The current runtime exposes explicit full-access controls and persistent native agent orchestration for spawned executions.",
    };
  }

  if (capabilities.codex_cli_available && capabilities.codex_cli_full_auto_supported && capabilities.codex_cli_bypass_supported) {
    return {
      runtime_permission_model: "codex_cli_explicit_full_auto",
      preferred_execution_access_mode: "codex_cli_full_auto_bypass",
      preferred_execution_runtime: nativePersistent ? "native_agent_tools" : "codex_cli_exec",
      persistent_execution_strategy: nativePersistent ? "per_feature_agent_registry" : "per_feature_cli_sessions",
      execution_access_notes: nativePersistent
        ? "Native agents can be reused, but Codex CLI full-auto plus bypass is the strongest explicit non-interactive access mode available here."
        : "Codex CLI full-auto plus bypass is the strongest explicit non-interactive mode available here.",
    };
  }

  if (nativePersistent && capabilities.native_agent_inherits_runtime_access) {
    return {
      runtime_permission_model: "native_inherited_access_only",
      preferred_execution_access_mode: "inherits_current_runtime_access",
      preferred_execution_runtime: "native_agent_tools",
      persistent_execution_strategy: "per_feature_agent_registry",
      execution_access_notes: "Native spawned executions can be resumed and coordinated, but the surface does not expose stronger explicit access controls.",
    };
  }

  if (capabilities.native_agent_spawning_available && capabilities.native_agent_inherits_runtime_access) {
    return {
      runtime_permission_model: "native_inherited_access_only",
      preferred_execution_access_mode: "inherits_current_runtime_access",
      preferred_execution_runtime: "native_agent_tools",
      persistent_execution_strategy: "artifact_continuity_only",
      execution_access_notes: "Native spawning is available, but persistent agent reuse or stronger explicit access controls are not fully exposed.",
    };
  }

  return {
    runtime_permission_model: "interactive_or_limited",
    preferred_execution_access_mode: "interactive_fallback",
    preferred_execution_runtime: "artifact_continuity_only",
    persistent_execution_strategy: "artifact_continuity_only",
    execution_access_notes: "No stronger autonomous execution-access mode was detected. Use the strongest available fallback and record the limitation.",
  };
}

function isSetupComplete(setup) {
  return [
    setup.preferred_execution_access_mode,
    setup.preferred_auditor_access_mode,
    setup.preferred_reviewer_access_mode,
    setup.preferred_implementor_access_mode,
    setup.fallback_execution_access_mode,
    setup.runtime_permission_model,
    setup.execution_access_notes,
    setup.preferred_execution_runtime,
    setup.persistent_execution_strategy,
  ].every((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function detectCodexCliAvailable() {
  try {
    const result = spawnSync("codex", ["--help"], { encoding: "utf8" });
    return result.status === 0;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const values = {};
  const multi = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      values[key] = "true";
      continue;
    }
    if (key === "project-permission-rule") {
      multi[key] ??= [];
      multi[key].push(next);
    } else {
      values[key] = next;
    }
    index += 1;
  }
  return { positionals, values, multi };
}

function requiredArg(args, key) {
  const value = args.values[key];
  if (!value) fail("Missing required argument --" + key + ".");
  return value;
}

function booleanArg(args, key, fallback) {
  const value = args.values[key];
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  fail("Argument --" + key + " must be true or false.");
}

function normalizeSlashes(value) {
  return value.replace(/\\/g, "/");
}

function nowIso() {
  return new Date().toISOString();
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

function fail(message) {
  process.stderr.write(message + "\n");
  process.exit(1);
}

main().catch((error) => {
  process.stderr.write((error instanceof Error ? error.stack ?? error.message : String(error)) + "\n");
  process.exit(1);
});
