#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  ACCESS_MODES,
  EXECUTION_RUNTIMES,
  PERSISTENT_EXECUTION_STRATEGIES,
  RUNTIME_PERMISSION_MODELS,
  CAPABILITY_KEYS,
  booleanArg,
  capabilityKeyToArgumentName,
  defaultCapabilityValue,
  describeError,
  detectCodexCliCapabilities,
  installBrokenPipeGuards,
  isFilled,
  isPlainObject,
  normalizeProjectRoot,
  normalizeSlashes,
  nowIso,
  parseArgs,
  pathExists,
  printJson,
  readJson,
  requiredArg,
  resolveSkillStateRoot,
  withLock,
  writeJsonAtomic,
  fail
} from "../../governed-feature-runtime.mjs";

const SKILL_NAME = "benchmark-suite";

const REQUIRED_SETUP_FIELDS = [
  "preferred_execution_access_mode",
  "fallback_execution_access_mode",
  "runtime_permission_model",
  "execution_access_notes",
  "preferred_execution_runtime",
  "persistent_execution_strategy"
];

installBrokenPipeGuards();

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
});

async function main() {
  const args = parseArgs(process.argv.slice(2), ["project-permission-rule"]);
  const command = args.positionals[0];

  if (!command) fail("Missing command. Use 'write-setup'.");
  if (command !== "write-setup") fail("Unknown command '" + command + "'. Use 'write-setup'.");

  const projectRoot = normalizeProjectRoot(requiredArg(args, "project-root"));
  const skillStateRoot = resolveSkillStateRoot(projectRoot, SKILL_NAME);
  const setupPath = join(skillStateRoot, "setup.json");
  const locksRoot = join(skillStateRoot, "locks");

  const existing = await loadExistingSetup(setupPath, projectRoot);
  const capabilityDetection = detectCapabilities(args, existing.detected_runtime_capabilities ?? {});
  const derived = deriveSetup({
    projectRoot,
    args,
    existing,
    capabilities: capabilityDetection.capabilities
  });

  const validation = validateSetupObject(derived, projectRoot);

  await withLock(locksRoot, "setup", async () => {
    await writeJsonAtomic(setupPath, derived);
  });

  printJson({
    command: "write-setup",
    setup_path: normalizeSlashes(setupPath),
    created: !existing.exists,
    setup_complete: validation.complete,
    validation_errors: validation.errors,
    validation_warnings: validation.warnings,
    capability_detection: capabilityDetection.metadata,
    setup: derived
  });
}

async function loadExistingSetup(setupPath, projectRoot) {
  if (!(await pathExists(setupPath))) {
    return {
      exists: false,
      project_root: projectRoot,
      detected_runtime_capabilities: {},
      validation_errors: [],
      validation_warnings: []
    };
  }
  try {
    const parsed = await readJson(setupPath);
    const validation = validateSetupObject(parsed, projectRoot);
    return {
      exists: true,
      ...parsed,
      validation_errors: validation.errors,
      validation_warnings: validation.warnings
    };
  } catch (error) {
    return {
      exists: true,
      project_root: projectRoot,
      detected_runtime_capabilities: {},
      validation_errors: ["Existing setup.json could not be parsed: " + describeError(error)],
      validation_warnings: []
    };
  }
}

function detectCapabilities(args, fallbackCapabilities) {
  const cliDetection = detectCodexCliCapabilities();
  const capabilities = {};

  for (const key of CAPABILITY_KEYS) {
    const argumentName = capabilityKeyToArgumentName(key);
    const fallbackValue = typeof fallbackCapabilities[key] === "boolean"
      ? fallbackCapabilities[key]
      : defaultCapabilityValue(key, cliDetection);
    capabilities[key] = booleanArg(args, argumentName, fallbackValue);
  }

  return {
    capabilities,
    metadata: { codex_cli_probe: cliDetection.metadata }
  };
}

function deriveSetup(input) {
  const inferred = inferPreferredModes(input.capabilities);

  return {
    project_root: normalizeSlashes(input.projectRoot),
    preferred_execution_access_mode: pick(
      input.args.values["preferred-execution-access-mode"],
      input.existing.preferred_execution_access_mode,
      inferred.preferred_execution_access_mode
    ),
    fallback_execution_access_mode: pick(
      input.args.values["fallback-execution-access-mode"],
      input.existing.fallback_execution_access_mode,
      inferred.fallback_execution_access_mode
    ),
    runtime_permission_model: pick(
      input.args.values["runtime-permission-model"],
      input.existing.runtime_permission_model,
      inferred.runtime_permission_model
    ),
    execution_access_notes: pick(
      input.args.values["execution-access-notes"],
      input.existing.execution_access_notes,
      inferred.execution_access_notes
    ),
    preferred_execution_runtime: pick(
      input.args.values["preferred-execution-runtime"],
      input.existing.preferred_execution_runtime,
      inferred.preferred_execution_runtime
    ),
    preferred_control_plane_runtime: pick(
      input.args.values["preferred-control-plane-runtime"],
      input.existing.preferred_control_plane_runtime,
      inferred.preferred_control_plane_runtime
    ),
    persistent_execution_strategy: pick(
      input.args.values["persistent-execution-strategy"],
      input.existing.persistent_execution_strategy,
      inferred.persistent_execution_strategy
    ),
    requires_project_specific_permission_rules: false,
    project_specific_permission_rules: [],
    detected_runtime_capabilities: input.capabilities,
    setup_schema_version: 1,
    created_at: input.existing.created_at ?? nowIso(),
    updated_at: nowIso()
  };
}

function inferPreferredModes(capabilities) {
  const nativeControlPlane = capabilities.native_agent_spawning_available
    && capabilities.native_agent_resume_available
    && capabilities.native_agent_send_input_available
    && capabilities.native_agent_wait_available;

  if (capabilities.native_agent_access_configurable && nativeControlPlane) {
    return {
      runtime_permission_model: "native_explicit_full_access",
      preferred_execution_access_mode: "native_full_access",
      fallback_execution_access_mode: "inherits_current_runtime_access",
      preferred_execution_runtime: "native_agent_tools",
      preferred_control_plane_runtime: "native_agent_tools",
      persistent_execution_strategy: "per_feature_agent_registry",
      execution_access_notes: "Native agent tools provide full-access benchmark execution."
    };
  }
  if (capabilities.codex_cli_available && capabilities.codex_cli_full_auto_supported) {
    const bypassAvailable = capabilities.codex_cli_bypass_supported;
    return {
      runtime_permission_model: "codex_cli_explicit_full_auto",
      preferred_execution_access_mode: bypassAvailable ? "codex_cli_full_auto_bypass" : "inherits_current_runtime_access",
      fallback_execution_access_mode: "inherits_current_runtime_access",
      preferred_execution_runtime: "codex_cli_exec",
      preferred_control_plane_runtime: nativeControlPlane ? "native_agent_tools" : "codex_cli_exec",
      persistent_execution_strategy: nativeControlPlane ? "per_feature_agent_registry" : "per_feature_cli_sessions",
      execution_access_notes: bypassAvailable
        ? "CLI full-auto plus bypass is the strongest truthful benchmark worker mode."
        : "CLI full-auto without bypass for benchmark workers."
    };
  }
  if (nativeControlPlane && capabilities.native_agent_inherits_runtime_access) {
    return {
      runtime_permission_model: "native_inherited_access_only",
      preferred_execution_access_mode: "inherits_current_runtime_access",
      fallback_execution_access_mode: "inherits_current_runtime_access",
      preferred_execution_runtime: "native_agent_tools",
      preferred_control_plane_runtime: "native_agent_tools",
      persistent_execution_strategy: "per_feature_agent_registry",
      execution_access_notes: "Native agent tools with inherited access for benchmark workers."
    };
  }
  return {
    runtime_permission_model: "interactive_or_limited",
    preferred_execution_access_mode: "interactive_fallback",
    fallback_execution_access_mode: "interactive_fallback",
    preferred_execution_runtime: "artifact_continuity_only",
    preferred_control_plane_runtime: "artifact_continuity_only",
    persistent_execution_strategy: "artifact_continuity_only",
    execution_access_notes: "No autonomous execution capability detected for benchmark workers."
  };
}

function validateSetupObject(setup, projectRoot) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(setup)) {
    return { complete: false, errors: ["setup.json must contain a JSON object."], warnings };
  }
  for (const field of REQUIRED_SETUP_FIELDS) {
    if (!isFilled(setup[field])) {
      errors.push("Missing required field '" + field + "'.");
    }
  }
  validateEnum(setup.preferred_execution_access_mode, ACCESS_MODES, "preferred_execution_access_mode", errors);
  validateEnum(setup.fallback_execution_access_mode, ACCESS_MODES, "fallback_execution_access_mode", errors);
  validateEnum(setup.runtime_permission_model, RUNTIME_PERMISSION_MODELS, "runtime_permission_model", errors);
  validateEnum(setup.preferred_execution_runtime, EXECUTION_RUNTIMES, "preferred_execution_runtime", errors);
  if (isFilled(setup.preferred_control_plane_runtime)) {
    validateEnum(setup.preferred_control_plane_runtime, EXECUTION_RUNTIMES, "preferred_control_plane_runtime", errors);
  }
  validateEnum(setup.persistent_execution_strategy, PERSISTENT_EXECUTION_STRATEGIES, "persistent_execution_strategy", errors);

  if (setup.preferred_execution_access_mode === "codex_cli_full_auto_bypass"
    && setup.preferred_execution_runtime !== "codex_cli_exec") {
    errors.push("preferred_execution_runtime must be 'codex_cli_exec' when access mode is 'codex_cli_full_auto_bypass'.");
  }
  if (!isPlainObject(setup.detected_runtime_capabilities) && setup.detected_runtime_capabilities !== undefined) {
    errors.push("detected_runtime_capabilities must be an object.");
  }
  if (!Array.isArray(setup.project_specific_permission_rules) && setup.project_specific_permission_rules !== undefined) {
    errors.push("project_specific_permission_rules must be an array.");
  }

  return {
    complete: errors.length === 0,
    errors,
    warnings
  };
}

function validateEnum(value, allowedValues, fieldName, errors) {
  if (!isFilled(value)) return;
  if (!allowedValues.has(value)) {
    errors.push("Field '" + fieldName + "' must be one of: " + Array.from(allowedValues).join(", ") + ".");
  }
}

function pick(...values) {
  for (const value of values) {
    if (isFilled(value)) return value;
  }
  return null;
}
