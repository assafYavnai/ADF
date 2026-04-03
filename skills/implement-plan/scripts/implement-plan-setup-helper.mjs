#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import {
  ACCESS_MODES,
  CAPABILITY_KEYS,
  EXECUTION_RUNTIMES,
  PERSISTENT_EXECUTION_STRATEGIES,
  RUNTIME_PERMISSION_MODELS,
  booleanArg,
  capabilityKeyToArgumentName,
  defaultCapabilityValue,
  describeError,
  detectCodexCliCapabilities,
  installBrokenPipeGuards,
  isFilled,
  isPlainObject,
  normalizeProjectRoot,
  nowIso,
  parseArgs,
  pathExists,
  printJson,
  readJson,
  requiredArg,
  resolveSkillStateRoot,
  validateOptionalEnum,
  withLock,
  writeJsonAtomic,
  fail
} from "../../governed-feature-runtime.mjs";
import { join } from "node:path";

const REQUIRED_SETUP_FIELDS = [
  "preferred_execution_access_mode",
  "preferred_implementor_access_mode",
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
  if (!command) {
    fail("Missing command. Use 'write-setup'.");
  }
  if (command !== "write-setup") {
    fail("Unknown command '" + command + "'. Use 'write-setup'.");
  }

  const projectRoot = normalizeProjectRoot(requiredArg(args, "project-root"));
  const setupRoot = resolveSkillStateRoot(projectRoot, "implement-plan");
  const setupPath = join(setupRoot, "setup.json");
  const locksRoot = join(setupRoot, "locks");

  const existing = await loadExistingSetup(setupPath, projectRoot);
  const capabilityDetection = detectCapabilities(args, existing.detected_runtime_capabilities ?? {});
  const derived = deriveSetup({
    args,
    projectRoot,
    existing,
    capabilities: capabilityDetection.capabilities
  });
  const validation = validateSetupObject(derived, projectRoot);

  if (validation.errors.length > 0) {
    fail("Cannot write setup.json because the derived setup is invalid:\n- " + validation.errors.join("\n- "));
  }

  await withLock(locksRoot, "setup", async () => {
    await writeJsonAtomic(setupPath, derived);
  });

  printJson({
    setup_path: setupPath.replace(/\\/g, "/"),
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
      validation_errors: ["Existing setup.json could not be parsed and will be replaced: " + describeError(error)],
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
    metadata: {
      codex_cli_probe: cliDetection.metadata
    }
  };
}

function deriveSetup(input) {
  const inferred = inferPreferredModes(input.capabilities);
  const projectSpecificPermissionRules = normalizeStringArray(
    input.args.multi["project-permission-rule"] ?? input.existing.project_specific_permission_rules ?? []
  );
  const requiresProjectSpecificPermissionRules = projectSpecificPermissionRules.length > 0
    ? true
    : booleanArg(
        input.args,
        "requires-project-specific-permission-rules",
        input.existing.requires_project_specific_permission_rules ?? false
      );

  return {
    project_root: input.projectRoot,
    preferred_execution_access_mode: pick(
      input.args.values["preferred-execution-access-mode"],
      input.existing.preferred_execution_access_mode,
      inferred.preferred_execution_access_mode
    ),
    preferred_implementor_access_mode: pick(
      input.args.values["preferred-implementor-access-mode"],
      input.existing.preferred_implementor_access_mode,
      inferred.preferred_implementor_access_mode
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
    preferred_implementor_model: pick(
      input.args.values["preferred-implementor-model"],
      input.existing.preferred_implementor_model,
      "gpt-5.4"
    ),
    preferred_implementor_reasoning_effort: pick(
      input.args.values["preferred-implementor-reasoning-effort"],
      input.existing.preferred_implementor_reasoning_effort,
      "xhigh"
    ),
    requires_project_specific_permission_rules: requiresProjectSpecificPermissionRules,
    project_specific_permission_rules: projectSpecificPermissionRules,
    detected_runtime_capabilities: input.capabilities,
    setup_schema_version: 1,
    created_at: input.existing.created_at ?? nowIso(),
    updated_at: nowIso()
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

  validateEnum(setup.preferred_execution_access_mode, ACCESS_MODES, "preferred_execution_access_mode", errors);
  validateEnum(setup.preferred_implementor_access_mode, ACCESS_MODES, "preferred_implementor_access_mode", errors);
  validateEnum(setup.fallback_execution_access_mode, ACCESS_MODES, "fallback_execution_access_mode", errors);
  validateEnum(setup.runtime_permission_model, RUNTIME_PERMISSION_MODELS, "runtime_permission_model", errors);
  validateEnum(setup.preferred_execution_runtime, EXECUTION_RUNTIMES, "preferred_execution_runtime", errors);
  if (isFilled(setup.preferred_control_plane_runtime)) {
    validateEnum(setup.preferred_control_plane_runtime, EXECUTION_RUNTIMES, "preferred_control_plane_runtime", errors);
  }
  validateEnum(setup.persistent_execution_strategy, PERSISTENT_EXECUTION_STRATEGIES, "persistent_execution_strategy", errors);

  if (isFilled(setup.project_root) && normalizeProjectRoot(setup.project_root) !== projectRoot) {
    errors.push("project_root must match the target project root '" + projectRoot + "'.");
  }

  if (setup.preferred_execution_access_mode === "codex_cli_full_auto_bypass" && setup.preferred_execution_runtime !== "codex_cli_exec") {
    errors.push("preferred_execution_runtime must be 'codex_cli_exec' when preferred_execution_access_mode is 'codex_cli_full_auto_bypass'.");
  }

  if (!isPlainObject(setup.detected_runtime_capabilities)) {
    errors.push("detected_runtime_capabilities must be an object.");
  }

  if (!Array.isArray(setup.project_specific_permission_rules)) {
    errors.push("project_specific_permission_rules must be an array.");
  }

  if (
    Array.isArray(setup.project_specific_permission_rules)
    && setup.project_specific_permission_rules.length > 0
    && setup.requires_project_specific_permission_rules !== true
  ) {
    warnings.push("requires_project_specific_permission_rules should be true when project_specific_permission_rules is non-empty.");
  }

  return {
    complete: errors.length === 0,
    errors,
    warnings
  };
}

function validateEnum(value, allowed, fieldName, errors) {
  if (!isFilled(value)) {
    return;
  }
  if (!allowed.has(value)) {
    errors.push("Field '" + fieldName + "' must be one of: " + Array.from(allowed).join(", ") + ".");
  }
}

function pick(...values) {
  for (const value of values) {
    if (isFilled(value)) {
      return value;
    }
  }
  return null;
}

function normalizeStringArray(values) {
  const next = [];
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (trimmed && !next.includes(trimmed)) {
      next.push(trimmed);
    }
  }
  return next;
}
