#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const REQUIRED_SETUP_FIELDS = [
  "preferred_execution_access_mode",
  "preferred_auditor_access_mode",
  "preferred_reviewer_access_mode",
  "preferred_implementor_access_mode",
  "fallback_execution_access_mode",
  "runtime_permission_model",
  "execution_access_notes",
  "preferred_execution_runtime",
  "persistent_execution_strategy"
];

const ACCESS_MODES = new Set([
  "native_full_access",
  "native_elevated_permissions",
  "codex_cli_full_auto_bypass",
  "inherits_current_runtime_access",
  "interactive_fallback"
]);

const RUNTIME_PERMISSION_MODELS = new Set([
  "native_explicit_full_access",
  "codex_cli_explicit_full_auto",
  "native_inherited_access_only",
  "interactive_or_limited"
]);

const EXECUTION_RUNTIMES = new Set([
  "native_agent_tools",
  "codex_cli_exec",
  "artifact_continuity_only"
]);

const PERSISTENT_EXECUTION_STRATEGIES = new Set([
  "per_feature_agent_registry",
  "per_feature_cli_sessions",
  "artifact_continuity_only"
]);

const CAPABILITY_KEYS = [
  "native_agent_spawning_available",
  "native_agent_access_configurable",
  "native_agent_inherits_runtime_access",
  "native_agent_resume_available",
  "native_agent_send_input_available",
  "native_agent_wait_available",
  "native_parallel_wait_available",
  "codex_cli_available",
  "codex_cli_full_auto_supported",
  "codex_cli_bypass_supported"
];



installBrokenPipeGuards();

function installBrokenPipeGuards() {
  process.stdout.on("error", (error) => {
    if (error && error.code === "EPIPE") {
      process.exit(0);
    }
    throw error;
  });

  process.stderr.on("error", (error) => {
    if (error && error.code === "EPIPE") {
      process.exit(1);
    }
    throw error;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0];
  if (!command) {
    fail("Missing command. Use 'write-setup'.");
  }
  if (command !== "write-setup") {
    fail("Unknown command '" + command + "'. Use 'write-setup'.");
  }

  const projectRoot = normalizeSlashes(resolve(requiredArg(args, "project-root")));
  const existing = await loadExistingSetup(projectRoot);

  const capabilityDetection = detectCapabilities(args, existing.detected_runtime_capabilities ?? {});
  const derived = deriveSetup({
    args,
    projectRoot,
    existing,
    capabilityDetection
  });
  const validation = validateSetupObject(derived.setup, projectRoot);

  if (validation.errors.length > 0) {
    fail("Cannot write setup.json because the derived setup is invalid:\n- " + validation.errors.join("\n- "));
  }

  await writeJson(derived.path, derived.setup);
  printJson({
    setup_path: normalizeSlashes(derived.path),
    created: !existing.exists,
    setup_complete: validation.complete,
    validation_errors: validation.errors,
    validation_warnings: validation.warnings,
    capability_detection: capabilityDetection.metadata,
    setup: derived.setup
  });
}

async function loadExistingSetup(projectRoot) {
  const path = resolve(projectRoot, ".codex", "review-cycle", "setup.json");
  if (!(await pathExists(path))) {
    return {
      exists: false,
      path,
      detected_runtime_capabilities: {},
      validation_errors: [],
      validation_warnings: []
    };
  }

  try {
    const parsed = await readJson(path);
    const validation = validateSetupObject(parsed, projectRoot);
    return {
      exists: true,
      path,
      ...parsed,
      validation_errors: validation.errors,
      validation_warnings: validation.warnings
    };
  } catch (error) {
    return {
      exists: true,
      path,
      detected_runtime_capabilities: {},
      validation_errors: [
        "Existing setup.json could not be parsed and will be replaced: " + describeError(error)
      ],
      validation_warnings: []
    };
  }
}

function detectCapabilities(args, fallbackCapabilities) {
  const cliDetection = detectCodexCliCapabilities();

  const capabilities = {};
  for (const key of CAPABILITY_KEYS) {
    const cliArgumentName = capabilityKeyToArgumentName(key);
    const fallbackValue = booleanFallback(fallbackCapabilities[key], defaultCapabilityValue(key, cliDetection));
    capabilities[key] = booleanArg(args, cliArgumentName, fallbackValue);
  }

  return {
    capabilities,
    metadata: {
      codex_cli_probe: cliDetection.metadata
    }
  };
}

function deriveSetup(input) {
  const capabilities = input.capabilityDetection.capabilities;
  const inferred = inferPreferredModes(capabilities);

  const preferredExecutionAccessMode = coalesceNonEmpty(
    input.args.values["preferred-execution-access-mode"],
    input.existing.preferred_execution_access_mode,
    inferred.preferred_execution_access_mode
  );

  const preferredAuditorAccessMode = coalesceNonEmpty(
    input.args.values["preferred-auditor-access-mode"],
    input.existing.preferred_auditor_access_mode,
    preferredExecutionAccessMode
  );

  const preferredReviewerAccessMode = coalesceNonEmpty(
    input.args.values["preferred-reviewer-access-mode"],
    input.existing.preferred_reviewer_access_mode,
    preferredExecutionAccessMode
  );

  const preferredImplementorAccessMode = coalesceNonEmpty(
    input.args.values["preferred-implementor-access-mode"],
    input.existing.preferred_implementor_access_mode,
    preferredExecutionAccessMode
  );

  const fallbackExecutionAccessMode = coalesceNonEmpty(
    input.args.values["fallback-execution-access-mode"],
    input.existing.fallback_execution_access_mode,
    inferred.fallback_execution_access_mode
  );

  const preferredExecutionRuntime = coalesceNonEmpty(
    input.args.values["preferred-execution-runtime"],
    input.existing.preferred_execution_runtime,
    inferred.preferred_execution_runtime
  );

  const preferredControlPlaneRuntime = coalesceNonEmpty(
    input.args.values["preferred-control-plane-runtime"],
    input.existing.preferred_control_plane_runtime,
    inferred.preferred_control_plane_runtime
  );

  const persistentExecutionStrategy = coalesceNonEmpty(
    input.args.values["persistent-execution-strategy"],
    input.existing.persistent_execution_strategy,
    inferred.persistent_execution_strategy
  );

  const runtimePermissionModel = coalesceNonEmpty(
    input.args.values["runtime-permission-model"],
    input.existing.runtime_permission_model,
    inferred.runtime_permission_model
  );

  const executionAccessNotes = coalesceNonEmpty(
    input.args.values["execution-access-notes"],
    input.existing.execution_access_notes,
    inferred.execution_access_notes
  );

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

  const setup = {
    project_root: input.projectRoot,
    preferred_execution_access_mode: preferredExecutionAccessMode,
    preferred_auditor_access_mode: preferredAuditorAccessMode,
    preferred_reviewer_access_mode: preferredReviewerAccessMode,
    preferred_implementor_access_mode: preferredImplementorAccessMode,
    fallback_execution_access_mode: fallbackExecutionAccessMode,
    runtime_permission_model: runtimePermissionModel,
    execution_access_notes: executionAccessNotes,
    preferred_execution_runtime: preferredExecutionRuntime,
    preferred_control_plane_runtime: preferredControlPlaneRuntime,
    persistent_execution_strategy: persistentExecutionStrategy,
    requires_project_specific_permission_rules: requiresProjectSpecificPermissionRules,
    project_specific_permission_rules: projectSpecificPermissionRules,
    detected_runtime_capabilities: capabilities,
    setup_schema_version: 2,
    created_at: input.existing.created_at ?? nowIso(),
    updated_at: nowIso()
  };

  return {
    path: input.existing.path,
    setup
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
      fallback_execution_access_mode: capabilities.native_agent_inherits_runtime_access
        ? "inherits_current_runtime_access"
        : "interactive_fallback",
      preferred_execution_runtime: "native_agent_tools",
      preferred_control_plane_runtime: "native_agent_tools",
      persistent_execution_strategy: "per_feature_agent_registry",
      execution_access_notes: "The runtime exposes explicit native access controls for spawned executions and supports persistent native agent orchestration."
    };
  }

  if (capabilities.codex_cli_available && capabilities.codex_cli_full_auto_supported && capabilities.codex_cli_bypass_supported) {
    return {
      runtime_permission_model: "codex_cli_explicit_full_auto",
      preferred_execution_access_mode: "codex_cli_full_auto_bypass",
      fallback_execution_access_mode: capabilities.native_agent_inherits_runtime_access
        ? "inherits_current_runtime_access"
        : "interactive_fallback",
      preferred_execution_runtime: "codex_cli_exec",
      preferred_control_plane_runtime: nativePersistentControlPlane ? "native_agent_tools" : "codex_cli_exec",
      persistent_execution_strategy: nativePersistentControlPlane
        ? "per_feature_agent_registry"
        : "per_feature_cli_sessions",
      execution_access_notes: nativePersistentControlPlane
        ? "Codex CLI full-auto plus bypass is the strongest explicit non-interactive execution mode available. Native agent tools may still be used as the control plane to orchestrate those CLI-backed workers."
        : "Codex CLI full-auto plus bypass is the strongest explicit non-interactive execution mode available."
    };
  }

  if (nativePersistentControlPlane && capabilities.native_agent_inherits_runtime_access) {
    return {
      runtime_permission_model: "native_inherited_access_only",
      preferred_execution_access_mode: "inherits_current_runtime_access",
      fallback_execution_access_mode: "interactive_fallback",
      preferred_execution_runtime: "native_agent_tools",
      preferred_control_plane_runtime: "native_agent_tools",
      persistent_execution_strategy: "per_feature_agent_registry",
      execution_access_notes: "Persistent native agents are available, but the runtime does not expose stronger explicit access controls for spawned executions."
    };
  }

  if (capabilities.native_agent_spawning_available && capabilities.native_agent_inherits_runtime_access) {
    return {
      runtime_permission_model: "native_inherited_access_only",
      preferred_execution_access_mode: "inherits_current_runtime_access",
      fallback_execution_access_mode: "interactive_fallback",
      preferred_execution_runtime: "native_agent_tools",
      preferred_control_plane_runtime: "native_agent_tools",
      persistent_execution_strategy: "artifact_continuity_only",
      execution_access_notes: "Native spawning is available, but persistent agent reuse or stronger explicit access controls are not fully exposed."
    };
  }

  return {
    runtime_permission_model: "interactive_or_limited",
    preferred_execution_access_mode: "interactive_fallback",
    fallback_execution_access_mode: "interactive_fallback",
    preferred_execution_runtime: "artifact_continuity_only",
    preferred_control_plane_runtime: "artifact_continuity_only",
    persistent_execution_strategy: "artifact_continuity_only",
    execution_access_notes: "No stronger autonomous execution mode could be truthfully detected. Use the strongest available fallback and record the limitation explicitly."
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

  validateEnumField(setup, "preferred_execution_access_mode", ACCESS_MODES, errors);
  validateEnumField(setup, "preferred_auditor_access_mode", ACCESS_MODES, errors);
  validateEnumField(setup, "preferred_reviewer_access_mode", ACCESS_MODES, errors);
  validateEnumField(setup, "preferred_implementor_access_mode", ACCESS_MODES, errors);
  validateEnumField(setup, "fallback_execution_access_mode", ACCESS_MODES, errors);
  validateEnumField(setup, "runtime_permission_model", RUNTIME_PERMISSION_MODELS, errors);
  validateEnumField(setup, "preferred_execution_runtime", EXECUTION_RUNTIMES, errors);
  if (isFilled(setup.preferred_control_plane_runtime)) {
    validateEnumField(setup, "preferred_control_plane_runtime", EXECUTION_RUNTIMES, errors);
  }
  validateEnumField(setup, "persistent_execution_strategy", PERSISTENT_EXECUTION_STRATEGIES, errors);

  if (isFilled(setup.project_root) && normalizeSlashes(resolve(setup.project_root)) !== projectRoot) {
    errors.push("project_root must match the target project root '" + projectRoot + "'.");
  }

  if (setup.preferred_execution_access_mode === "codex_cli_full_auto_bypass" && setup.preferred_execution_runtime !== "codex_cli_exec") {
    errors.push("preferred_execution_runtime must be 'codex_cli_exec' when preferred_execution_access_mode is 'codex_cli_full_auto_bypass'.");
  }

  if (
    setup.preferred_execution_access_mode === "codex_cli_full_auto_bypass"
    && setup.preferred_control_plane_runtime === "native_agent_tools"
    && !booleanFallback(setup.detected_runtime_capabilities?.native_agent_spawning_available, false)
  ) {
    warnings.push("preferred_control_plane_runtime is 'native_agent_tools' but native agent spawning was not detected.");
  }

  if (!isPlainObject(setup.detected_runtime_capabilities)) {
    errors.push("detected_runtime_capabilities must be an object.");
  } else {
    for (const key of CAPABILITY_KEYS) {
      const value = setup.detected_runtime_capabilities[key];
      if (value !== undefined && typeof value !== "boolean") {
        errors.push("detected_runtime_capabilities." + key + " must be boolean when present.");
      }
    }
  }

  if (!Array.isArray(setup.project_specific_permission_rules)) {
    errors.push("project_specific_permission_rules must be an array.");
  }

  if (
    Array.isArray(setup.project_specific_permission_rules)
    && setup.project_specific_permission_rules.length > 0
    && setup.requires_project_specific_permission_rules !== true
  ) {
    warnings.push("requires_project_specific_permission_rules was normalized logically by the rules list but is not true.");
  }

  return {
    complete: errors.length === 0,
    errors,
    warnings
  };
}

function validateEnumField(setup, fieldName, allowedValues, errors) {
  if (!isFilled(setup[fieldName])) {
    return;
  }
  if (!allowedValues.has(setup[fieldName])) {
    errors.push(
      "Field '" + fieldName + "' must be one of: " + Array.from(allowedValues).join(", ") + "."
    );
  }
}

function detectCodexCliCapabilities() {
  const metadata = {
    cli_probe_attempted: true,
    cli_probe_succeeded: false,
    help_output_inspected: false,
    inferred_from_help: false,
    raw_signal_summary: []
  };

  try {
    const result = spawnSync("codex", ["--help"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000
    });

    const combinedOutput = ((result.stdout ?? "") + "\n" + (result.stderr ?? "")).toLowerCase();
    metadata.cli_probe_succeeded = result.status === 0;
    metadata.help_output_inspected = combinedOutput.trim().length > 0;

    const cliAvailable = result.status === 0;
    const fullAutoSupported = containsAny(combinedOutput, [
      "dangerously-skip-permissions",
      "approval never",
      "approval-never",
      "full-auto",
      "full auto",
      "--ask-for-approval",
      "--approval-mode"
    ]);
    const bypassSupported = containsAny(combinedOutput, [
      "dangerously-skip-permissions",
      "bypass",
      "approval never",
      "approval-never"
    ]);

    metadata.inferred_from_help = fullAutoSupported || bypassSupported;
    if (cliAvailable) metadata.raw_signal_summary.push("codex --help exited successfully");
    if (fullAutoSupported) metadata.raw_signal_summary.push("help output suggests non-interactive approval control");
    if (bypassSupported) metadata.raw_signal_summary.push("help output suggests permission bypass support");

    return {
      metadata,
      cli_available: cliAvailable,
      cli_full_auto_supported: fullAutoSupported,
      cli_bypass_supported: bypassSupported
    };
  } catch (error) {
    metadata.raw_signal_summary.push("codex probe failed: " + describeError(error));
    return {
      metadata,
      cli_available: false,
      cli_full_auto_supported: false,
      cli_bypass_supported: false
    };
  }
}

function containsAny(text, fragments) {
  return fragments.some((fragment) => text.includes(fragment));
}

function defaultCapabilityValue(key, cliDetection) {
  switch (key) {
    case "codex_cli_available":
      return cliDetection.cli_available;
    case "codex_cli_full_auto_supported":
      return cliDetection.cli_full_auto_supported;
    case "codex_cli_bypass_supported":
      return cliDetection.cli_bypass_supported;
    default:
      return false;
  }
}

function capabilityKeyToArgumentName(key) {
  return key.replace(/_/g, "-");
}

function isSetupComplete(setup, projectRoot = null) {
  return validateSetupObject(
    setup,
    projectRoot ?? normalizeSlashes(resolve(setup.project_root ?? "."))
  ).complete;
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
  if (!isFilled(value)) {
    fail("Missing required argument --" + key + ".");
  }
  return value;
}

function booleanArg(args, key, fallback) {
  const value = args.values[key];
  if (value === undefined) {
    return fallback;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  fail("Argument --" + key + " must be true or false.");
}

function booleanFallback(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function coalesceNonEmpty(...values) {
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

function normalizeSlashes(value) {
  return String(value).replace(/\\/g, "/");
}

function nowIso() {
  return new Date().toISOString();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFilled(value) {
  return !(value === undefined || value === null || String(value).trim() === "");
}

function describeError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
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
