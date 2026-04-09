#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACCESS_MODES,
  CAPABILITY_KEYS,
  EXECUTION_RUNTIMES,
  PERSISTENT_EXECUTION_STRATEGIES,
  RUNTIME_PERMISSION_MODELS,
  booleanArg,
  capabilityKeyToArgumentName,
  defaultCapabilityValue,
  detectCodexCliCapabilities,
  fail,
  installBrokenPipeGuards,
  isFilled,
  isPlainObject,
  normalizeProjectRoot,
  normalizeSlashes,
  nowIso,
  parseArgs,
  printJson,
  readJsonIfExists,
  requiredArg,
  validateOptionalEnum,
  withLock,
  writeJsonAtomic
} from "../../governed-feature-runtime.mjs";

const DEFAULT_MODELS = {
  implementor_model: "gpt-5.3-codex-spark",
  implementor_effort: "high",
  auditor_model: "gpt-5.4",
  auditor_effort: "high",
  reviewer_model: "gpt-5.4",
  reviewer_effort: "high",
  max_review_cycles: 5
};

const REQUIRED_SETUP_FIELDS = [
  "preferred_execution_access_mode",
  "preferred_implementor_access_mode",
  "fallback_execution_access_mode",
  "runtime_permission_model",
  "execution_access_notes",
  "preferred_execution_runtime",
  "persistent_execution_strategy",
  "setup_schema_version",
  "project_root",
  "workflow_shell",
  "execution_shell"
];

const EMPTY_ARGS = { positionals: [], values: {}, multi: {} };

installBrokenPipeGuards();

function parseJsonOutput(result) {
  const raw = String(result?.stdout ?? "").trim();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function runAdfRuntimePreflight(projectRoot) {
  const adfEntrypoint = join(projectRoot, "adf.cmd");
  const powershellCommand = "& '" + adfEntrypoint.replace(/'/g, "''") + "' --runtime-preflight --json";
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", powershellCommand], {
    encoding: "utf8",
    timeout: 20000,
    windowsHide: true
  });
  const report = parseJsonOutput(result);
  return isPlainObject(report)
    ? { report, source: "adf.cmd" }
    : null;
}

function runHelperRuntimePreflight(projectRoot) {
  const preflightScript = join(projectRoot, "tools", "agent-runtime-preflight.mjs");
  const result = spawnSync("node", [preflightScript, "--repo-root", projectRoot, "--json"], {
    encoding: "utf8",
    timeout: 20000,
    windowsHide: true
  });
  const report = parseJsonOutput(result);
  return isPlainObject(report)
    ? { report, source: "direct-helper-invocation" }
    : null;
}

function detectRuntimePreflight(projectRoot) {
  try {
    const viaAdf = runAdfRuntimePreflight(projectRoot);
    if (viaAdf) {
      return viaAdf;
    }
  } catch {}

  try {
    const viaHelper = runHelperRuntimePreflight(projectRoot);
    if (viaHelper) {
      return viaHelper;
    }
  } catch {}

  return {
    report: null,
    source: null
  };
}

function deriveCliDefaults(cliDetection, runtimePreflight) {
  const codexTool = runtimePreflight?.report?.llm_tools?.codex;
  const autonomousInvoke = String(codexTool?.autonomous_invoke ?? "").toLowerCase();
  const preflightAvailable = codexTool?.available === true;
  const preflightFullAuto = autonomousInvoke.includes("full-auto")
    || autonomousInvoke.includes("approval")
    || autonomousInvoke.includes("dangerously-auto-approve");
  const preflightBypass = autonomousInvoke.includes("dangerously-auto-approve")
    || autonomousInvoke.includes("dangerously-skip-permissions")
    || autonomousInvoke.includes("bypass");

  return {
    metadata: cliDetection.metadata,
    cli_available: preflightAvailable || cliDetection.cli_available,
    cli_full_auto_supported: preflightAvailable
      ? preflightFullAuto || cliDetection.cli_full_auto_supported
      : cliDetection.cli_full_auto_supported,
    cli_bypass_supported: preflightAvailable
      ? preflightBypass || cliDetection.cli_bypass_supported
      : cliDetection.cli_bypass_supported
  };
}

function detectCapabilities(args, fallbackCapabilities, runtimePreflight) {
  const cliDetection = detectCodexCliCapabilities();
  const cliDefaults = deriveCliDefaults(cliDetection, runtimePreflight);
  const capabilities = {};
  const codexDefaultsAuthoritative = runtimePreflight?.report?.llm_tools?.codex?.available !== undefined;

  for (const key of CAPABILITY_KEYS) {
    const argumentName = capabilityKeyToArgumentName(key);
    const isCodexCapability = key === "codex_cli_available"
      || key === "codex_cli_full_auto_supported"
      || key === "codex_cli_bypass_supported";
    const fallbackValue = isCodexCapability && codexDefaultsAuthoritative
      ? defaultCapabilityValue(key, cliDefaults)
      : (
          typeof fallbackCapabilities[key] === "boolean"
            ? fallbackCapabilities[key]
            : defaultCapabilityValue(key, cliDefaults)
        );
    capabilities[key] = booleanArg(args, argumentName, fallbackValue);
  }

  return {
    capabilities,
    metadata: {
      codex_cli_probe: cliDetection.metadata,
      runtime_preflight_source: runtimePreflight?.source ?? null
    }
  };
}

function inferPreferredModes(capabilities) {
  const nativePersistentControlPlane = capabilities.native_agent_spawning_available
    && capabilities.native_agent_resume_available
    && capabilities.native_agent_send_input_available
    && capabilities.native_agent_wait_available;

  if (capabilities.native_agent_access_configurable && nativePersistentControlPlane) {
    return {
      runtime_permission_model: "native_explicit_full_access",
      preferred_execution_access_mode: "native_full_access",
      preferred_implementor_access_mode: "native_full_access",
      fallback_execution_access_mode: capabilities.native_agent_inherits_runtime_access
        ? "inherits_current_runtime_access"
        : "interactive_fallback",
      preferred_execution_runtime: "native_agent_tools",
      preferred_control_plane_runtime: "native_agent_tools",
      persistent_execution_strategy: "per_feature_agent_registry",
      execution_access_notes: "The runtime exposes explicit native access controls for spawned executions and supports persistent native orchestration."
    };
  }

  if (capabilities.codex_cli_available && capabilities.codex_cli_full_auto_supported && capabilities.codex_cli_bypass_supported) {
    return {
      runtime_permission_model: "codex_cli_explicit_full_auto",
      preferred_execution_access_mode: "codex_cli_full_auto_bypass",
      preferred_implementor_access_mode: "codex_cli_full_auto_bypass",
      fallback_execution_access_mode: capabilities.native_agent_inherits_runtime_access
        ? "inherits_current_runtime_access"
        : "interactive_fallback",
      preferred_execution_runtime: "codex_cli_exec",
      preferred_control_plane_runtime: nativePersistentControlPlane ? "native_agent_tools" : "codex_cli_exec",
      persistent_execution_strategy: nativePersistentControlPlane
        ? "per_feature_agent_registry"
        : "per_feature_cli_sessions",
      execution_access_notes: nativePersistentControlPlane
        ? "Codex CLI full-auto plus bypass is the strongest explicit worker mode available. Native tools remain the control plane only."
        : "Codex CLI full-auto plus bypass is the strongest explicit worker mode available in this runtime."
    };
  }

  if (nativePersistentControlPlane && capabilities.native_agent_inherits_runtime_access) {
    return {
      runtime_permission_model: "native_inherited_access_only",
      preferred_execution_access_mode: "inherits_current_runtime_access",
      preferred_implementor_access_mode: "inherits_current_runtime_access",
      fallback_execution_access_mode: "interactive_fallback",
      preferred_execution_runtime: "native_agent_tools",
      preferred_control_plane_runtime: "native_agent_tools",
      persistent_execution_strategy: "per_feature_agent_registry",
      execution_access_notes: "Persistent native workers are available, but the runtime does not expose stronger explicit access controls for spawned executions."
    };
  }

  return {
    runtime_permission_model: "interactive_or_limited",
    preferred_execution_access_mode: "interactive_fallback",
    preferred_implementor_access_mode: "interactive_fallback",
    fallback_execution_access_mode: "interactive_fallback",
    preferred_execution_runtime: "artifact_continuity_only",
    preferred_control_plane_runtime: "artifact_continuity_only",
    persistent_execution_strategy: "artifact_continuity_only",
    execution_access_notes: "No stronger autonomous worker mode could be truthfully detected. Use the strongest available fallback and record the limitation explicitly."
  };
}

function pick(...values) {
  for (const value of values) {
    if (isFilled(value)) {
      return value;
    }
  }
  return null;
}

function deriveSetup(input) {
  const inferred = inferPreferredModes(input.capabilities);
  const preflightReport = input.runtimePreflight?.report;
  const llmTools = isPlainObject(preflightReport?.llm_tools)
    ? preflightReport.llm_tools
    : (input.existing?.llm_tools ?? {});

  return {
    setup_schema_version: 1,
    project_root: input.projectRoot,
    preferred_execution_access_mode: pick(
      input.args.values["preferred-execution-access-mode"],
      inferred.preferred_execution_access_mode
      ,
      input.existing?.preferred_execution_access_mode
    ),
    preferred_implementor_access_mode: pick(
      input.args.values["preferred-implementor-access-mode"],
      inferred.preferred_implementor_access_mode,
      input.existing?.preferred_implementor_access_mode
    ),
    fallback_execution_access_mode: pick(
      input.args.values["fallback-execution-access-mode"],
      inferred.fallback_execution_access_mode,
      input.existing?.fallback_execution_access_mode
    ),
    runtime_permission_model: pick(
      input.args.values["runtime-permission-model"],
      inferred.runtime_permission_model,
      input.existing?.runtime_permission_model
    ),
    execution_access_notes: pick(
      input.args.values["execution-access-notes"],
      inferred.execution_access_notes,
      input.existing?.execution_access_notes
    ),
    preferred_execution_runtime: pick(
      input.args.values["preferred-execution-runtime"],
      inferred.preferred_execution_runtime,
      input.existing?.preferred_execution_runtime
    ),
    preferred_control_plane_runtime: pick(
      input.args.values["preferred-control-plane-runtime"],
      inferred.preferred_control_plane_runtime,
      input.existing?.preferred_control_plane_runtime
    ),
    persistent_execution_strategy: pick(
      input.args.values["persistent-execution-strategy"],
      inferred.persistent_execution_strategy,
      input.existing?.persistent_execution_strategy
    ),
    host_os: preflightReport?.host_os ?? input.existing?.host_os ?? null,
    workflow_shell: preflightReport?.workflow_shell ?? input.existing?.workflow_shell ?? null,
    execution_shell: preflightReport?.execution_shell ?? input.existing?.execution_shell ?? null,
    control_plane: isPlainObject(preflightReport?.control_plane)
      ? preflightReport.control_plane
      : (input.existing?.control_plane ?? null),
    shell_contract: isPlainObject(preflightReport?.shell_contract)
      ? preflightReport.shell_contract
      : (input.existing?.shell_contract ?? null),
    recommended_commands: isPlainObject(preflightReport?.recommended_commands)
      ? preflightReport.recommended_commands
      : (input.existing?.recommended_commands ?? {}),
    runtime_preflight_source: input.runtimePreflight?.source ?? input.existing?.runtime_preflight_source ?? null,
    runtime_preflight_overall_status: preflightReport?.overall_status ?? input.existing?.runtime_preflight_overall_status ?? null,
    runtime_preflight_checked_at: nowIso(),
    capability_detection: input.capabilityMetadata ?? input.existing?.capability_detection ?? {},
    detected_runtime_capabilities: input.capabilities,
    llm_tools: llmTools,
    defaults: {
      ...(input.existing?.defaults ?? {}),
      ...DEFAULT_MODELS
    },
    created_at: input.existing?.created_at ?? nowIso(),
    updated_at: nowIso()
  };
}

function validateSetupObject(setup, projectRoot) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(setup)) {
    return {
      complete: false,
      errors: ["setup.json must contain a JSON object at the top level."],
      warnings
    };
  }

  for (const field of REQUIRED_SETUP_FIELDS) {
    if (!isFilled(setup[field])) {
      errors.push("Missing required field '" + field + "'.");
    }
  }

  validateOptionalEnum(setup.preferred_execution_access_mode, ACCESS_MODES, "preferred_execution_access_mode");
  validateOptionalEnum(setup.preferred_implementor_access_mode, ACCESS_MODES, "preferred_implementor_access_mode");
  validateOptionalEnum(setup.fallback_execution_access_mode, ACCESS_MODES, "fallback_execution_access_mode");
  validateOptionalEnum(setup.runtime_permission_model, RUNTIME_PERMISSION_MODELS, "runtime_permission_model");
  validateOptionalEnum(setup.preferred_execution_runtime, EXECUTION_RUNTIMES, "preferred_execution_runtime");
  validateOptionalEnum(setup.preferred_control_plane_runtime, EXECUTION_RUNTIMES, "preferred_control_plane_runtime");
  validateOptionalEnum(setup.persistent_execution_strategy, PERSISTENT_EXECUTION_STRATEGIES, "persistent_execution_strategy");

  if (normalizeProjectRoot(setup.project_root) !== projectRoot) {
    errors.push("project_root must match the target project root '" + projectRoot + "'.");
  }

  if (setup.preferred_execution_access_mode === "codex_cli_full_auto_bypass" && setup.preferred_execution_runtime !== "codex_cli_exec") {
    errors.push("preferred_execution_runtime must be 'codex_cli_exec' when preferred_execution_access_mode is 'codex_cli_full_auto_bypass'.");
  }

  if (!isPlainObject(setup.control_plane)) {
    errors.push("control_plane must be an object.");
  }
  if (!isPlainObject(setup.shell_contract)) {
    errors.push("shell_contract must be an object.");
  }
  if (!isPlainObject(setup.llm_tools)) {
    errors.push("llm_tools must be an object.");
  }
  if (!isPlainObject(setup.detected_runtime_capabilities)) {
    errors.push("detected_runtime_capabilities must be an object.");
  }

  if (!isFilled(setup.runtime_preflight_source)) {
    warnings.push("runtime_preflight_source was not recorded.");
  }

  return {
    complete: errors.length === 0,
    errors,
    warnings
  };
}

async function loadExistingSetup(setupPath, projectRoot) {
  const existing = await readJsonIfExists(setupPath, null);
  if (isPlainObject(existing)) {
    return existing;
  }
  return {
    project_root: projectRoot,
    defaults: DEFAULT_MODELS,
    detected_runtime_capabilities: {},
    llm_tools: {},
    setup_schema_version: 1
  };
}

async function writeSetup({ projectRoot, args }) {
  const setupPath = join(projectRoot, ".codex", "develop", "setup.json");
  const locksRoot = join(projectRoot, ".codex", "develop", "locks");
  const existing = await loadExistingSetup(setupPath, projectRoot);
  const runtimePreflight = detectRuntimePreflight(projectRoot);
  const capabilityDetection = detectCapabilities(args, existing.detected_runtime_capabilities ?? {}, runtimePreflight);
  const setup = deriveSetup({
    args,
    projectRoot,
    existing,
    runtimePreflight,
    capabilities: capabilityDetection.capabilities,
    capabilityMetadata: capabilityDetection.metadata
  });
  const validation = validateSetupObject(setup, projectRoot);

  if (!validation.complete) {
    fail("Cannot write setup.json because the derived setup is invalid:\n- " + validation.errors.join("\n- "));
  }

  await withLock(locksRoot, "setup", async () => {
    await writeJsonAtomic(setupPath, setup);
  });

  return {
    setupPath,
    setup,
    validation,
    capability_detection: capabilityDetection.metadata
  };
}

export async function ensureSetup({ projectRoot }) {
  const normalizedRoot = normalizeProjectRoot(projectRoot);
  return writeSetup({
    projectRoot: normalizedRoot,
    args: EMPTY_ARGS
  });
}

export function buildSetupOutput({ setupPath, setup, command = "write-setup", validation = {}, capability_detection = {} }) {
  return {
    command,
    setup_path: setupPath.replace(/\\/g, "/"),
    setup_complete: validation.complete ?? true,
    validation_errors: validation.errors ?? [],
    validation_warnings: validation.warnings ?? [],
    capability_detection,
    setup
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0] ?? "write-setup";
  if (command !== "write-setup") {
    fail("Unknown command '" + command + "'. Use 'write-setup'.");
  }

  const projectRoot = normalizeProjectRoot(requiredArg(args, "project-root"));
  const result = await writeSetup({ projectRoot, args });
  printJson(buildSetupOutput({
    command,
    ...result
  }));
}

const isDirectExecution = process.argv[1]
  && normalizeSlashes(process.argv[1]) === normalizeSlashes(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  main().catch((error) => fail(error instanceof Error ? error.stack ?? error.message : String(error)));
}
