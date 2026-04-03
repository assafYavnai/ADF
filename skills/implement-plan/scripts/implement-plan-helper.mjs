#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  ACCESS_MODES,
  EXECUTION_RUNTIMES,
  FEATURE_STATUSES,
  IMPLEMENT_PLAN_ACTIVE_RUN_STATUSES,
  IMPLEMENT_PLAN_EVENTS,
  PERSISTENT_EXECUTION_STRATEGIES,
  RUNTIME_PERMISSION_MODELS,
  buildFeatureRegistryKey,
  booleanArg,
  describeError,
  detectCurrentBranch,
  diffSeconds,
  emptyToNull,
  extractBulletishLines,
  formatDuration,
  installBrokenPipeGuards,
  isFilled,
  isPlainObject,
  normalizeFeatureSlug,
  normalizeProjectRoot,
  normalizeSlashes,
  nowIso,
  parseArgs,
  parsePositiveInteger,
  pathExists,
  printJson,
  readJson,
  readTextIfExists,
  requiredArg,
  resolveFeatureRoot,
  resolveSkillStateRoot,
  safeInteger,
  safeReaddir,
  shouldRecreateExecution,
  validateHeadingContract,
  withLock,
  writeJsonAtomic,
  writeTextAtomic,
  fail
} from "../../governed-feature-runtime.mjs";

const KNOWN_FEATURE_FILES = new Set([
  "README.md",
  "context.md",
  "implement-plan-state.json",
  "implement-plan-contract.md",
  "implement-plan-pushback.md",
  "implement-plan-brief.md",
  "completion-summary.md"
]);

const CONTRACT_HEADINGS = [
  "1. Implementation Objective",
  "2. Slice Scope",
  "3. Required Deliverables",
  "4. Allowed Edits",
  "5. Forbidden Edits",
  "6. Acceptance Gates",
  "7. Observability / Audit",
  "8. Dependencies / Constraints",
  "9. Non-Goals",
  "10. Source Authorities"
];

const PUSHBACK_HEADINGS = [
  "1. Integrity Verdict",
  "2. Missing / Weak / Unsafe Inputs",
  "3. Required Contract Repairs",
  "4. Next Safe Move"
];

const BRIEF_HEADINGS = [
  "1. Implementation Objective",
  "2. Exact Slice Scope",
  "3. Inputs / Authorities Read",
  "4. Required Deliverables",
  "5. Forbidden Edits",
  "6. Integrity-Verified Assumptions Only",
  "7. Explicit Non-Goals",
  "8. Proof / Verification Expectations",
  "9. Required Artifact Updates",
  "10. Closeout Rules"
];

const COMPLETION_HEADINGS = [
  "1. Objective Completed",
  "2. Deliverables Produced",
  "3. Files Changed And Why",
  "4. Verification Evidence",
  "5. Feature Artifacts Updated",
  "6. Commit And Push Result",
  "7. Remaining Non-Goals / Debt"
];

const REQUIRED_SETUP_FIELDS = [
  "preferred_execution_access_mode",
  "preferred_implementor_access_mode",
  "fallback_execution_access_mode",
  "runtime_permission_model",
  "execution_access_notes",
  "preferred_execution_runtime",
  "persistent_execution_strategy"
];

const REVIEW_CYCLE_ARTIFACTS = [
  "audit-findings.md",
  "review-findings.md",
  "fix-plan.md",
  "fix-report.md"
];

const STATUS_MESSAGES = {
  active: "Feature is active and may run.",
  blocked: "Feature is blocked and cannot run until the blocker is resolved.",
  completed: "Feature is completed and no longer active. Reopen or clone it to continue.",
  closed: "Feature is closed and no longer active. Reopen or clone it to continue."
};

installBrokenPipeGuards();

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
});

async function main() {
  const args = parseArgs(process.argv.slice(2), ["capability"]);
  const command = args.positionals[0] ?? "help";

  if (command === "help") {
    printJson(await renderHelp(args));
    return;
  }

  if (command === "get-settings") {
    printJson(await getSettings(args));
    return;
  }

  if (command === "list-features") {
    printJson(await listFeatures(args));
    return;
  }

  if (command === "prepare") {
    const postReviewHandoff = resolvePostReviewHandoffArgs(args);
    printJson(await prepareFeature({
      projectRoot: normalizeProjectRoot(requiredArg(args, "project-root")),
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug")),
      taskSummary: requiredArg(args, "task-summary"),
      scopeHint: emptyToNull(args.values["scope-hint"]),
      nonGoals: emptyToNull(args.values["non-goals"]),
      implementorModel: emptyToNull(args.values["implementor-model"]),
      implementorReasoningEffort: emptyToNull(args.values["implementor-reasoning-effort"]),
      featureStatusOverride: parseOptionalFeatureStatus(args.values["feature-status-override"], "feature-status-override"),
      ...postReviewHandoff
    }));
    return;
  }

  if (command === "update-state") {
    printJson(await updateState({
      projectRoot: normalizeProjectRoot(requiredArg(args, "project-root")),
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug")),
      implementorExecutionId: args.values["implementor-execution-id"],
      implementorExecutionAccessMode: args.values["implementor-execution-access-mode"],
      implementorExecutionRuntime: args.values["implementor-execution-runtime"],
      implementorModel: args.values["implementor-model"],
      implementorReasoningEffort: args.values["implementor-reasoning-effort"],
      resolvedRuntimePermissionModel: args.values["resolved-runtime-permission-model"],
      featureStatus: args.values["feature-status"],
      currentBranch: args.values["current-branch"],
      lastCompletedStep: args.values["last-completed-step"],
      lastCommitSha: args.values["last-commit-sha"],
      activeRunStatus: args.values["active-run-status"],
      lastError: args.values["last-error"],
      capabilityPairs: args.multi.capability ?? []
    }));
    return;
  }

  if (command === "record-event") {
    printJson(await recordEvent({
      projectRoot: normalizeProjectRoot(requiredArg(args, "project-root")),
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug")),
      event: requiredArg(args, "event"),
      timestamp: emptyToNull(args.values.timestamp),
      note: emptyToNull(args.values.note),
      lastCommitSha: emptyToNull(args.values["last-commit-sha"]),
      currentBranch: emptyToNull(args.values["current-branch"])
    }));
    return;
  }

  if (command === "mark-complete") {
    printJson(await markComplete({
      projectRoot: normalizeProjectRoot(requiredArg(args, "project-root")),
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug")),
      completionNote: emptyToNull(args.values["completion-note"]),
      lastCommitSha: emptyToNull(args.values["last-commit-sha"])
    }));
    return;
  }

  if (command === "completion-summary") {
    printJson(await buildCompletionSummary({
      projectRoot: normalizeProjectRoot(requiredArg(args, "project-root")),
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug"))
    }));
    return;
  }

  fail("Unknown command '" + command + "'. Use 'help', 'get-settings', 'list-features', 'prepare', 'update-state', 'record-event', 'mark-complete', or 'completion-summary'.");
}

async function renderHelp(args) {
  const projectRoot = normalizeProjectRoot(args.values["project-root"] ?? process.cwd());
  const settings = await getSettingsCore(projectRoot);
  const features = await loadFeaturesIndex(projectRoot);

  return {
    command: "help",
    project_root: projectRoot,
    purpose: "Govern bounded feature implementation slices by validating setup, checking plan integrity, producing pushback or a strong implementor brief, then closing out with truthful state and git artifacts.",
    actions: ["help", "get-settings", "list-features", "prepare", "run", "mark-complete"],
    required_inputs_for_run: ["project_root", "phase_number", "feature_slug", "task_summary"],
    optional_inputs: [
      "scope_hint",
      "non_goals",
      "implementor_model",
      "implementor_reasoning_effort",
      "feature_status_override",
      "post_send_to_review",
      "review_until_complete",
      "review_max_cycles",
      "post_send_for_review (compatibility alias)"
    ],
    transparent_setup_behavior: "The main skill validates setup internally and auto-refreshes it when missing or invalid before worker use.",
    current_settings_summary: settings.summary,
    active_open_features_summary: summarizeFeatureSections(features.index),
    mark_complete_usage: "Use action=mark-complete with project_root, phase_number, and feature_slug after completion-summary.md exists and push evidence is recorded.",
    closed_feature_note: "Completed or closed features cannot run again until they are reopened or cloned into a new feature stream.",
    post_send_to_review_note: "When post_send_to_review=true, implement-plan should hand the feature stream to review-cycle after implementation closeout. post_send_for_review remains a compatibility alias.",
    review_cycle_handoff_note: "When review_until_complete=true, implement-plan should pass until_complete=true to review-cycle. If review_max_cycles is omitted in that mode, review-cycle keeps its default cap of 5."
  };
}

async function getSettings(args) {
  const projectRoot = normalizeProjectRoot(args.values["project-root"] ?? process.cwd());
  return getSettingsCore(projectRoot);
}

async function getSettingsCore(projectRoot) {
  const setup = await loadSetup(projectRoot);
  const skillStateRoot = resolveSkillStateRoot(projectRoot, "implement-plan");
  const summary = {
    setup_status: setup.complete ? "ready" : setup.exists ? "invalid" : "missing",
    preferred_execution_access_mode: setup.data.preferred_execution_access_mode ?? null,
    preferred_implementor_access_mode: setup.data.preferred_implementor_access_mode ?? null,
    preferred_execution_runtime: setup.data.preferred_execution_runtime ?? null,
    preferred_control_plane_runtime: setup.data.preferred_control_plane_runtime ?? null,
    preferred_implementor_model: setup.data.preferred_implementor_model ?? "gpt-5.4",
    preferred_implementor_reasoning_effort: setup.data.preferred_implementor_reasoning_effort ?? "xhigh",
    fallback_execution_access_mode: setup.data.fallback_execution_access_mode ?? null,
    runtime_permission_model: setup.data.runtime_permission_model ?? null,
    persistent_execution_strategy: setup.data.persistent_execution_strategy ?? null,
    execution_access_notes: setup.data.execution_access_notes ?? null,
    detected_runtime_capabilities: setup.data.detected_runtime_capabilities ?? {}
  };

  return {
    command: "get-settings",
    project_root: projectRoot,
    skill_state_root: normalizeSlashes(skillStateRoot),
    setup_path: normalizeSlashes(setup.path),
    setup_exists: setup.exists,
    setup_complete: setup.complete,
    validation_errors: setup.validation_errors,
    validation_warnings: setup.validation_warnings,
    summary,
    setup
  };
}

async function listFeatures(args) {
  const projectRoot = normalizeProjectRoot(args.values["project-root"] ?? process.cwd());
  const features = await loadFeaturesIndex(projectRoot);
  return {
    command: "list-features",
    project_root: projectRoot,
    features_index_path: normalizeSlashes(features.path),
    index_exists: features.exists,
    validation_errors: features.validation_errors,
    validation_warnings: features.validation_warnings,
    sections: summarizeFeatureSections(features.index),
    raw_index: features.index
  };
}

async function prepareFeature(input) {
  const paths = buildPaths(input.projectRoot, input.phaseNumber, input.featureSlug);
  const setup = await loadSetup(input.projectRoot);
  const registry = await loadAgentRegistry(input.projectRoot);
  const featuresIndex = await loadFeaturesIndex(input.projectRoot);

  const featureLockResult = await withLock(paths.featureLocksRoot, input.featureSlug, async () => {
    await mkdir(paths.featureRoot, { recursive: true });
    await mkdir(paths.implementationRunDir, { recursive: true });

    const readmeCreated = await ensureFeatureReadme(paths, input);
    const currentBranch = detectCurrentBranch(input.projectRoot);
    const existingState = await loadOrInitializeState({
      paths,
      input,
      registryEntry: registry.index.features[paths.registryKey] ?? null,
      indexEntry: featuresIndex.index.features[paths.registryKey] ?? null,
      currentBranch
    });
    const inputPack = await buildInputPack(paths, input);
    const contextCreated = await ensureFeatureContext(paths, input, inputPack, existingState.state.current_branch ?? currentBranch ?? null);
    const refreshedInputPack = contextCreated ? await buildInputPack(paths, input) : inputPack;

    let nextState = { ...existingState.state };
    let changed = existingState.changed;

    if (input.featureStatusOverride && nextState.feature_status !== input.featureStatusOverride) {
      nextState.feature_status = input.featureStatusOverride;
      changed = true;
    }

    if (!nextState.current_branch && currentBranch) {
      nextState.current_branch = currentBranch;
      changed = true;
    }

    if (setup.complete) {
      if (nextState.resolved_runtime_permission_model !== setup.data.runtime_permission_model) {
        nextState.resolved_runtime_permission_model = setup.data.runtime_permission_model ?? null;
        changed = true;
      }
      const setupCapabilities = setup.data.detected_runtime_capabilities ?? {};
      if (JSON.stringify(nextState.resolved_runtime_capabilities ?? {}) !== JSON.stringify(setupCapabilities)) {
        nextState.resolved_runtime_capabilities = setupCapabilities;
        changed = true;
      }
      if (!nextState.implementor_model) {
        nextState.implementor_model = input.implementorModel ?? setup.data.preferred_implementor_model ?? "gpt-5.4";
        changed = true;
      }
      if (!nextState.implementor_reasoning_effort) {
        nextState.implementor_reasoning_effort = input.implementorReasoningEffort ?? setup.data.preferred_implementor_reasoning_effort ?? "xhigh";
        changed = true;
      }
      if (!nextState.implementor_execution_runtime && setup.data.preferred_execution_runtime) {
        nextState.implementor_execution_runtime = setup.data.preferred_execution_runtime;
        changed = true;
      }
    }

    const requiredAccessMode = setup.data.preferred_implementor_access_mode
      ?? setup.data.preferred_execution_access_mode
      ?? setup.data.fallback_execution_access_mode
      ?? null;
    const recreateDueToWeakerAccess = shouldRecreateExecution(
      nextState.implementor_execution_id,
      nextState.implementor_execution_access_mode,
      requiredAccessMode
    );

    const integrity = evaluateIntegrity({
      setup,
      state: nextState,
      input,
      inputPack: refreshedInputPack
    });

    let finalInputPack = refreshedInputPack;
    if (integrity.blocking_issues.length > 0) {
      await writePushbackArtifact(paths.pushbackPath, integrity);
      finalInputPack = await buildInputPack(paths, input);
      nextState.active_run_status = nextState.feature_status === "blocked" ? "blocked" : "integrity_failed";
      nextState.last_completed_step = "integrity_precheck_failed";
      nextState.run_timestamps = {
        ...(nextState.run_timestamps ?? {}),
        context_collected_at: nextState.run_timestamps?.context_collected_at ?? nowIso(),
        integrity_failed_at: nowIso()
      };
      changed = true;
    } else {
      nextState.active_run_status = "context_ready";
      nextState.last_completed_step = "context_collected";
      nextState.run_timestamps = {
        ...(nextState.run_timestamps ?? {}),
        context_collected_at: nextState.run_timestamps?.context_collected_at ?? nowIso()
      };
      changed = true;
    }

    nextState.artifacts = {
      ...(nextState.artifacts ?? {}),
      readme_path: normalizeSlashes(paths.readmePath),
      context_path: normalizeSlashes(paths.contextPath),
      state_path: normalizeSlashes(paths.statePath),
      contract_path: normalizeSlashes(paths.contractPath),
      pushback_path: normalizeSlashes(paths.pushbackPath),
      brief_path: normalizeSlashes(paths.briefPath),
      completion_summary_path: normalizeSlashes(paths.completionSummaryPath),
      implementation_run_dir: normalizeSlashes(paths.implementationRunDir)
    };

    if (changed) {
      nextState.updated_at = nowIso();
      await writeJsonAtomic(paths.statePath, nextState);
    }

    return {
      readmeCreated,
      contextCreated,
      state: nextState,
      stateCreated: existingState.created,
      stateRepairs: existingState.repairs,
      integrity,
      inputPack: finalInputPack,
      recreateDueToWeakerAccess,
      requiredAccessMode
    };
  });

  const state = featureLockResult.state;
  await syncAgentRegistry(paths, state);
  await syncFeaturesIndex(paths, state);

  const settingsSummary = await getSettingsCore(input.projectRoot);
  const openFeatures = await loadFeaturesIndex(input.projectRoot);
  const executionAction = decideExecutionAction(
    state.implementor_execution_id,
    featureLockResult.recreateDueToWeakerAccess,
    featureLockResult.integrity.blocking_issues.length === 0 && setup.complete
  );
  const featureRunnable = state.feature_status === "active";
  const nextAction = determineNextAction({
    setupComplete: setup.complete,
    featureStatus: state.feature_status,
    integrity: featureLockResult.integrity,
    executionAction
  });

  return {
    command: "prepare",
    project_root: input.projectRoot,
    phase_number: input.phaseNumber,
    feature_slug: input.featureSlug,
    feature_root: normalizeSlashes(paths.featureRoot),
    skill_state_root: normalizeSlashes(paths.skillStateRoot),
    setup_path: normalizeSlashes(paths.setupPath),
    registry_path: normalizeSlashes(paths.registryPath),
    features_index_path: normalizeSlashes(paths.featuresIndexPath),
    templates_root: normalizeSlashes(paths.templatesRoot),
    references_root: normalizeSlashes(paths.referencesRoot),
    state_path: normalizeSlashes(paths.statePath),
    readme_created: featureLockResult.readmeCreated,
    context_created: featureLockResult.contextCreated,
    state_created: featureLockResult.stateCreated,
    state_repairs: featureLockResult.stateRepairs,
    setup_exists: setup.exists,
    setup_complete: setup.complete,
    setup_validation_errors: setup.validation_errors,
    setup_validation_warnings: setup.validation_warnings,
    setup_requires_refresh: !setup.complete,
    feature_status: state.feature_status,
    feature_status_message: STATUS_MESSAGES[state.feature_status] ?? null,
    run_allowed: featureRunnable && featureLockResult.integrity.blocking_issues.length === 0,
    current_branch: state.current_branch ?? null,
    active_run_status: state.active_run_status ?? null,
    last_completed_step: state.last_completed_step ?? null,
    implementor_lane: {
      execution_id: state.implementor_execution_id ?? null,
      execution_access_mode: state.implementor_execution_access_mode ?? null,
      execution_runtime: state.implementor_execution_runtime ?? null,
      model: state.implementor_model ?? settingsSummary.summary.preferred_implementor_model,
      reasoning_effort: state.implementor_reasoning_effort ?? settingsSummary.summary.preferred_implementor_reasoning_effort,
      required_access_mode: featureLockResult.requiredAccessMode,
      recreate_due_to_weaker_access: featureLockResult.recreateDueToWeakerAccess,
      execution_action: executionAction
    },
    post_review_handoff: {
      enabled: input.postSendToReview,
      compatibility_alias_used: input.postSendToReviewAliasUsed,
      review_until_complete: input.postSendToReview ? input.reviewUntilComplete : false,
      review_max_cycles: input.postSendToReview ? input.reviewMaxCycles : null,
      effective_review_cycle_flags: input.postSendToReview ? {
        until_complete: input.reviewUntilComplete,
        max_cycles: input.reviewUntilComplete ? (input.reviewMaxCycles ?? 5) : null
      } : null
    },
    context_input_pack: featureLockResult.inputPack,
    integrity_precheck: featureLockResult.integrity,
    detected_status_summary: {
      detected_project_root: input.projectRoot,
      detected_feature_root: normalizeSlashes(paths.featureRoot),
      feature_status: state.feature_status,
      active_run_status: state.active_run_status,
      setup_status: setup.complete ? "ready" : setup.exists ? "invalid" : "missing",
      implementor_execution_id: state.implementor_execution_id ?? null,
      implementor_access_mode: featureLockResult.requiredAccessMode,
      implementor_runtime: setup.data.preferred_execution_runtime ?? null,
      recreate_due_to_weaker_access: featureLockResult.recreateDueToWeakerAccess,
      post_review_handoff_enabled: input.postSendToReview,
      review_until_complete: input.postSendToReview ? input.reviewUntilComplete : false,
      effective_review_max_cycles: input.postSendToReview && input.reviewUntilComplete ? (input.reviewMaxCycles ?? 5) : null,
      next_action: nextAction
    },
    current_settings_summary: settingsSummary.summary,
    open_features_summary: summarizeFeatureSections(openFeatures.index)
  };
}

async function updateState(input) {
  const paths = buildPaths(input.projectRoot, input.phaseNumber, input.featureSlug);

  const featureResult = await withLock(paths.featureLocksRoot, input.featureSlug, async () => {
    const currentBranch = detectCurrentBranch(input.projectRoot);
    const existing = await loadOrInitializeState({ paths, input, registryEntry: null, indexEntry: null, currentBranch });
    const next = { ...existing.state };

    if (input.implementorExecutionId !== undefined) next.implementor_execution_id = emptyToNull(input.implementorExecutionId);
    if (input.implementorExecutionAccessMode !== undefined) {
      next.implementor_execution_access_mode = parseOptionalAccessMode(input.implementorExecutionAccessMode, "implementor-execution-access-mode");
    }
    if (input.implementorExecutionRuntime !== undefined) {
      next.implementor_execution_runtime = parseOptionalRuntime(input.implementorExecutionRuntime, "implementor-execution-runtime");
    }
    if (input.implementorModel !== undefined) next.implementor_model = emptyToNull(input.implementorModel);
    if (input.implementorReasoningEffort !== undefined) next.implementor_reasoning_effort = emptyToNull(input.implementorReasoningEffort);
    if (input.resolvedRuntimePermissionModel !== undefined) {
      next.resolved_runtime_permission_model = parseOptionalPermissionModel(input.resolvedRuntimePermissionModel, "resolved-runtime-permission-model");
    }
    if (input.featureStatus !== undefined) next.feature_status = parseOptionalFeatureStatus(input.featureStatus, "feature-status") ?? next.feature_status;
    if (input.currentBranch !== undefined) next.current_branch = emptyToNull(input.currentBranch);
    if (input.lastCompletedStep !== undefined) next.last_completed_step = emptyToNull(input.lastCompletedStep);
    if (input.lastCommitSha !== undefined) next.last_commit_sha = emptyToNull(input.lastCommitSha);
    if (input.activeRunStatus !== undefined) next.active_run_status = parseOptionalActiveRunStatus(input.activeRunStatus, "active-run-status") ?? next.active_run_status;
    if (input.lastError !== undefined) next.last_error = emptyToNull(input.lastError);
    if (input.capabilityPairs.length > 0) {
      next.resolved_runtime_capabilities = {
        ...(next.resolved_runtime_capabilities ?? {}),
        ...parseCapabilityPairs(input.capabilityPairs)
      };
    }

    next.updated_at = nowIso();
    await writeJsonAtomic(paths.statePath, next);
    return next;
  });

  await syncAgentRegistry(paths, featureResult);
  await syncFeaturesIndex(paths, featureResult);

  return {
    command: "update-state",
    project_root: input.projectRoot,
    state_path: normalizeSlashes(paths.statePath),
    state: featureResult
  };
}

async function recordEvent(input) {
  if (!IMPLEMENT_PLAN_EVENTS.has(input.event)) {
    fail("Unsupported event '" + input.event + "'.");
  }

  const paths = buildPaths(input.projectRoot, input.phaseNumber, input.featureSlug);
  const timestamp = input.timestamp ?? nowIso();

  const state = await withLock(paths.featureLocksRoot, input.featureSlug, async () => {
    const currentBranch = detectCurrentBranch(input.projectRoot);
    const existing = await loadOrInitializeState({ paths, input, registryEntry: null, indexEntry: null, currentBranch });
    const next = { ...existing.state };
    next.run_timestamps = { ...(next.run_timestamps ?? {}) };
    next.event_log = Array.isArray(next.event_log) ? [...next.event_log] : [];
    next.event_log.push({ event: input.event, timestamp, note: input.note ?? null });
    next.event_log = next.event_log.slice(-100);

    applyEventTransition(next, input.event, timestamp);
    if (input.lastCommitSha) {
      next.last_commit_sha = input.lastCommitSha;
    }
    if (input.currentBranch) {
      next.current_branch = input.currentBranch;
    }
    next.updated_at = nowIso();
    await writeJsonAtomic(paths.statePath, next);
    return next;
  });

  await syncAgentRegistry(paths, state);
  await syncFeaturesIndex(paths, state);

  return {
    command: "record-event",
    project_root: input.projectRoot,
    feature_root: normalizeSlashes(paths.featureRoot),
    event: input.event,
    timestamp,
    state
  };
}

async function markComplete(input) {
  const paths = buildPaths(input.projectRoot, input.phaseNumber, input.featureSlug);
  const completionText = await readTextIfExists(paths.completionSummaryPath);
  const completionValidation = completionText
    ? validateHeadingContract(completionText, COMPLETION_HEADINGS)
    : { valid: false, error: "completion-summary.md is missing." };

  const state = await withLock(paths.featureLocksRoot, input.featureSlug, async () => {
    const currentBranch = detectCurrentBranch(input.projectRoot);
    const existing = await loadOrInitializeState({ paths, input, registryEntry: null, indexEntry: null, currentBranch });
    const next = { ...existing.state };

    if (next.feature_status === "completed") {
      return next;
    }

    const commitSha = input.lastCommitSha ?? next.last_commit_sha ?? null;
    if (!commitSha) {
      fail("Refusing to mark complete without last_commit_sha evidence.");
    }
    if (!completionValidation.valid) {
      fail("Refusing to mark complete because completion-summary.md is missing or invalid: " + completionValidation.error);
    }

    next.feature_status = "completed";
    next.active_run_status = "completed";
    next.last_completed_step = "marked_complete";
    next.last_commit_sha = commitSha;
    next.run_timestamps = {
      ...(next.run_timestamps ?? {}),
      closeout_finished_at: next.run_timestamps?.closeout_finished_at ?? nowIso()
    };
    next.last_error = input.completionNote ?? next.last_error ?? null;
    next.updated_at = nowIso();

    await writeJsonAtomic(paths.statePath, next);
    return next;
  });

  await syncFeaturesIndex(paths, state);
  await syncAgentRegistry(paths, state);

  return {
    command: "mark-complete",
    project_root: input.projectRoot,
    feature_root: normalizeSlashes(paths.featureRoot),
    completion_summary_path: normalizeSlashes(paths.completionSummaryPath),
    last_commit_sha: state.last_commit_sha,
    feature_status: state.feature_status,
    active_run_status: state.active_run_status
  };
}

async function buildCompletionSummary(input) {
  const paths = buildPaths(input.projectRoot, input.phaseNumber, input.featureSlug);
  const state = await loadStateIfExists(paths.statePath);
  if (!state) {
    fail("implement-plan-state.json does not exist for this feature stream.");
  }

  const completionText = await readTextIfExists(paths.completionSummaryPath);
  const validation = completionText
    ? validateHeadingContract(completionText, COMPLETION_HEADINGS)
    : { valid: false, error: "completion-summary.md is missing." };

  const runTimestamps = state.run_timestamps ?? {};
  const totalSeconds = diffSeconds(runTimestamps.context_collected_at ?? state.created_at, runTimestamps.closeout_finished_at ?? state.updated_at);
  const implementationSeconds = diffSeconds(runTimestamps.implementor_started_at, runTimestamps.implementor_finished_at);
  const verificationSeconds = diffSeconds(runTimestamps.implementor_finished_at, runTimestamps.verification_finished_at);
  const closeoutSeconds = diffSeconds(runTimestamps.verification_finished_at, runTimestamps.closeout_finished_at);
  const verificationSection = completionText
    ? extractHeadingSection(completionText, "4. Verification Evidence")
    : "";

  return {
    command: "completion-summary",
    project_root: input.projectRoot,
    feature_root: normalizeSlashes(paths.featureRoot),
    state_path: normalizeSlashes(paths.statePath),
    completion_summary_path: normalizeSlashes(paths.completionSummaryPath),
    completion_summary_exists: Boolean(completionText),
    completion_summary_valid: validation.valid,
    completion_summary_error: validation.error,
    feature_status: state.feature_status,
    active_run_status: state.active_run_status,
    last_commit_sha: state.last_commit_sha ?? null,
    current_branch: state.current_branch ?? null,
    timing: {
      total_seconds: totalSeconds,
      total_duration: formatDuration(totalSeconds),
      implementation_seconds: implementationSeconds,
      implementation_duration: formatDuration(implementationSeconds),
      verification_seconds: verificationSeconds,
      verification_duration: formatDuration(verificationSeconds),
      closeout_seconds: closeoutSeconds,
      closeout_duration: formatDuration(closeoutSeconds)
    },
    highlights: completionText
      ? {
          objective_completed: extractBulletishLines(completionText, "1. Objective Completed", 5),
          deliverables_produced: extractBulletishLines(completionText, "2. Deliverables Produced", 8),
          verification_evidence: extractBulletishLines(completionText, "4. Verification Evidence", 8),
          machine_verification: extractLabeledValue(verificationSection, "Machine Verification"),
          human_verification_requirement: extractLabeledValue(verificationSection, "Human Verification Requirement"),
          human_verification_status: extractLabeledValue(verificationSection, "Human Verification Status"),
          review_cycle_status: extractLabeledValue(verificationSection, "Review-Cycle Status"),
          remaining_debt: extractBulletishLines(completionText, "7. Remaining Non-Goals / Debt", 8)
        }
      : {
          objective_completed: [],
          deliverables_produced: [],
          verification_evidence: [],
          machine_verification: null,
          human_verification_requirement: null,
          human_verification_status: null,
          review_cycle_status: null,
          remaining_debt: []
        }
  };
}

function buildPaths(projectRoot, phaseNumber, featureSlug) {
  const featureRoot = resolveFeatureRoot(projectRoot, phaseNumber, featureSlug);
  const skillStateRoot = resolveSkillStateRoot(projectRoot, "implement-plan");
  return {
    projectRoot,
    phaseNumber,
    featureSlug,
    featureRoot,
    phaseRoot: join(projectRoot, "docs", "phase" + phaseNumber),
    docsRoot: join(projectRoot, "docs"),
    skillStateRoot,
    setupPath: join(skillStateRoot, "setup.json"),
    registryPath: join(skillStateRoot, "agent-registry.json"),
    featuresIndexPath: join(skillStateRoot, "features-index.json"),
    locksRoot: join(skillStateRoot, "locks"),
    featureLocksRoot: join(skillStateRoot, "locks", "features"),
    projectLocksRoot: join(skillStateRoot, "locks", "project"),
    registryKey: buildFeatureRegistryKey(phaseNumber, featureSlug),
    readmePath: join(featureRoot, "README.md"),
    contextPath: join(featureRoot, "context.md"),
    statePath: join(featureRoot, "implement-plan-state.json"),
    contractPath: join(featureRoot, "implement-plan-contract.md"),
    pushbackPath: join(featureRoot, "implement-plan-pushback.md"),
    briefPath: join(featureRoot, "implement-plan-brief.md"),
    completionSummaryPath: join(featureRoot, "completion-summary.md"),
    implementationRunDir: join(featureRoot, "implementation-run"),
    templatesRoot: "C:/ADF/skills/implement-plan",
    referencesRoot: "C:/ADF/skills/implement-plan/references"
  };
}

async function loadSetup(projectRoot) {
  const path = join(resolveSkillStateRoot(projectRoot, "implement-plan"), "setup.json");
  if (!(await pathExists(path))) {
    return {
      exists: false,
      complete: false,
      path,
      data: {},
      validation_errors: ["setup.json is missing."],
      validation_warnings: []
    };
  }

  try {
    const data = await readJson(path);
    const validation = validateSetupObject(data, projectRoot);
    return {
      exists: true,
      complete: validation.complete,
      path,
      data,
      validation_errors: validation.errors,
      validation_warnings: validation.warnings
    };
  } catch (error) {
    return {
      exists: true,
      complete: false,
      path,
      data: {},
      validation_errors: ["setup.json could not be parsed: " + describeError(error)],
      validation_warnings: []
    };
  }
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
  validateEnum(setup.preferred_implementor_access_mode, ACCESS_MODES, "preferred_implementor_access_mode", errors);
  validateEnum(setup.fallback_execution_access_mode, ACCESS_MODES, "fallback_execution_access_mode", errors);
  validateEnum(setup.runtime_permission_model, RUNTIME_PERMISSION_MODELS, "runtime_permission_model", errors);
  validateEnum(setup.preferred_execution_runtime, EXECUTION_RUNTIMES, "preferred_execution_runtime", errors);
  if (isFilled(setup.preferred_control_plane_runtime)) {
    validateEnum(setup.preferred_control_plane_runtime, EXECUTION_RUNTIMES, "preferred_control_plane_runtime", errors);
  }
  validateEnum(setup.persistent_execution_strategy, PERSISTENT_EXECUTION_STRATEGIES, "persistent_execution_strategy", errors);

  if (isFilled(setup.project_root) && normalizeProjectRoot(setup.project_root) !== projectRoot) {
    errors.push("project_root must match the requested project root.");
  }
  if (setup.preferred_execution_access_mode === "codex_cli_full_auto_bypass" && setup.preferred_execution_runtime !== "codex_cli_exec") {
    errors.push("preferred_execution_runtime must be 'codex_cli_exec' when preferred_execution_access_mode is 'codex_cli_full_auto_bypass'.");
  }
  if (!isPlainObject(setup.detected_runtime_capabilities)) {
    errors.push("detected_runtime_capabilities must be an object.");
  }
  if (!Array.isArray(setup.project_specific_permission_rules ?? [])) {
    errors.push("project_specific_permission_rules must be an array.");
  }

  return {
    complete: errors.length === 0,
    errors,
    warnings
  };
}

async function loadAgentRegistry(projectRoot) {
  const path = join(resolveSkillStateRoot(projectRoot, "implement-plan"), "agent-registry.json");
  const empty = { version: 1, features: {} };
  if (!(await pathExists(path))) {
    return { exists: false, path, index: empty, validation_errors: [], validation_warnings: [] };
  }

  try {
    const parsed = await readJson(path);
    if (!isPlainObject(parsed) || !isPlainObject(parsed.features)) {
      return {
        exists: true,
        path,
        index: empty,
        validation_errors: ["agent-registry.json is malformed and will be treated as empty."],
        validation_warnings: []
      };
    }
    return { exists: true, path, index: parsed, validation_errors: [], validation_warnings: [] };
  } catch (error) {
    return {
      exists: true,
      path,
      index: empty,
      validation_errors: ["agent-registry.json could not be parsed: " + describeError(error)],
      validation_warnings: []
    };
  }
}

async function loadFeaturesIndex(projectRoot) {
  const path = join(resolveSkillStateRoot(projectRoot, "implement-plan"), "features-index.json");
  const empty = { version: 1, updated_at: null, features: {} };
  if (!(await pathExists(path))) {
    return { exists: false, path, index: empty, validation_errors: [], validation_warnings: [] };
  }

  try {
    const parsed = await readJson(path);
    if (!isPlainObject(parsed) || !isPlainObject(parsed.features)) {
      return {
        exists: true,
        path,
        index: empty,
        validation_errors: ["features-index.json is malformed and will be treated as empty."],
        validation_warnings: []
      };
    }
    return { exists: true, path, index: parsed, validation_errors: [], validation_warnings: [] };
  } catch (error) {
    return {
      exists: true,
      path,
      index: empty,
      validation_errors: ["features-index.json could not be parsed: " + describeError(error)],
      validation_warnings: []
    };
  }
}

async function loadOrInitializeState({ paths, input, registryEntry, indexEntry, currentBranch }) {
  const repairs = [];
  let state;
  let created = false;

  if (await pathExists(paths.statePath)) {
    try {
      state = await readJson(paths.statePath);
    } catch (error) {
      repairs.push("State could not be parsed and was rebuilt: " + describeError(error));
    }
  }

  if (!isPlainObject(state)) {
    state = buildInitialState(paths, input, registryEntry, indexEntry, currentBranch);
    created = true;
  }

  if (!FEATURE_STATUSES.has(state.feature_status)) {
    state.feature_status = indexEntry?.feature_status ?? "active";
    repairs.push("feature_status was invalid and reset.");
  }
  if (!IMPLEMENT_PLAN_ACTIVE_RUN_STATUSES.has(state.active_run_status)) {
    state.active_run_status = state.feature_status === "blocked" ? "blocked" : "idle";
    repairs.push("active_run_status was invalid and reset.");
  }

  state.phase_number = input.phaseNumber;
  state.feature_slug = input.featureSlug;
  state.project_root = input.projectRoot;
  state.feature_registry_key = paths.registryKey;
  state.current_branch = state.current_branch ?? currentBranch ?? null;
  state.created_at = state.created_at ?? nowIso();
  state.updated_at = nowIso();
  state.run_timestamps = isPlainObject(state.run_timestamps) ? state.run_timestamps : {};
  state.event_log = Array.isArray(state.event_log) ? state.event_log : [];
  state.resolved_runtime_capabilities = isPlainObject(state.resolved_runtime_capabilities) ? state.resolved_runtime_capabilities : {};

  if (!isFilled(state.implementor_execution_id) && registryEntry?.implementor_execution_id) {
    state.implementor_execution_id = registryEntry.implementor_execution_id;
    repairs.push("implementor_execution_id was restored from the agent registry.");
  }
  if (!isFilled(state.implementor_execution_access_mode) && registryEntry?.implementor_execution_access_mode) {
    state.implementor_execution_access_mode = registryEntry.implementor_execution_access_mode;
    repairs.push("implementor_execution_access_mode was restored from the agent registry.");
  }
  if (!isFilled(state.implementor_execution_runtime) && registryEntry?.implementor_execution_runtime) {
    state.implementor_execution_runtime = registryEntry.implementor_execution_runtime;
    repairs.push("implementor_execution_runtime was restored from the agent registry.");
  }
  if (!isFilled(state.implementor_model) && registryEntry?.implementor_model) {
    state.implementor_model = registryEntry.implementor_model;
  }
  if (!isFilled(state.implementor_reasoning_effort) && registryEntry?.implementor_reasoning_effort) {
    state.implementor_reasoning_effort = registryEntry.implementor_reasoning_effort;
  }
  if (!isFilled(state.resolved_runtime_permission_model) && registryEntry?.resolved_runtime_permission_model) {
    state.resolved_runtime_permission_model = registryEntry.resolved_runtime_permission_model;
  }

  return { state, created, changed: created || repairs.length > 0, repairs };
}

function buildInitialState(paths, input, registryEntry, indexEntry, currentBranch) {
  return {
    phase_number: input.phaseNumber,
    feature_slug: input.featureSlug,
    project_root: input.projectRoot,
    feature_registry_key: paths.registryKey,
    feature_status: input.featureStatusOverride ?? indexEntry?.feature_status ?? "active",
    implementor_execution_id: registryEntry?.implementor_execution_id ?? null,
    implementor_execution_access_mode: registryEntry?.implementor_execution_access_mode ?? null,
    implementor_execution_runtime: registryEntry?.implementor_execution_runtime ?? null,
    implementor_model: input.implementorModel ?? registryEntry?.implementor_model ?? null,
    implementor_reasoning_effort: input.implementorReasoningEffort ?? registryEntry?.implementor_reasoning_effort ?? null,
    resolved_runtime_permission_model: registryEntry?.resolved_runtime_permission_model ?? null,
    resolved_runtime_capabilities: {},
    current_branch: currentBranch ?? null,
    last_completed_step: null,
    last_commit_sha: null,
    active_run_status: input.featureStatusOverride === "blocked" ? "blocked" : "idle",
    created_at: nowIso(),
    updated_at: nowIso(),
    run_timestamps: {},
    event_log: [],
    artifacts: {},
    last_error: null
  };
}

async function ensureFeatureReadme(paths, input) {
  if (await pathExists(paths.readmePath)) {
    return false;
  }

  const content = [
    "# " + input.featureSlug,
    "",
    "## Implementation Objective",
    "",
    input.taskSummary,
    "",
    "## Requested Scope",
    "",
    input.scopeHint ?? "- Scope not yet expanded beyond the task summary.",
    "",
    "## Non-Goals",
    "",
    input.nonGoals ?? "- None recorded yet.",
    "",
    "## Artifact Map",
    "",
    "- context.md",
    "- implement-plan-state.json",
    "- implement-plan-contract.md",
    "- implement-plan-pushback.md",
    "- implement-plan-brief.md",
    "- implementation-run/",
    "- completion-summary.md",
    "",
    "## Lifecycle",
    "",
    "- active",
    "- blocked",
    "- completed",
    "- closed",
    ""
  ].join("\n");

  await writeTextAtomic(paths.readmePath, content);
  return true;
}

async function ensureFeatureContext(paths, input, inputPack, currentBranch) {
  if (await pathExists(paths.contextPath)) {
    return false;
  }

  const lines = [
    "# Feature Context",
    "",
    "## Feature",
    "",
    "- phase_number: " + input.phaseNumber,
    "- feature_slug: " + input.featureSlug,
    "- project_root: " + normalizeSlashes(input.projectRoot),
    "- feature_root: " + normalizeSlashes(paths.featureRoot),
    "- current_branch: " + (currentBranch ?? "Unknown"),
    "",
    "## Task Summary",
    "",
    input.taskSummary,
    "",
    "## Scope Hint",
    "",
    input.scopeHint ?? "None.",
    "",
    "## Non-Goals",
    "",
    input.nonGoals ?? "None.",
    "",
    "## Discovered Authorities",
    ""
  ];

  for (const item of inputPack.authorities) {
    lines.push("- [" + item.kind + "] " + item.path);
  }

  lines.push("", "## Notes", "", "- This context file was created automatically during implement-plan prepare.", "");
  await writeTextAtomic(paths.contextPath, lines.join("\n"));
  return true;
}

async function buildInputPack(paths, input) {
  const authorities = [];
  const addAuthority = (kind, filePath) => {
    if (!filePath) return;
    const normalized = normalizeSlashes(filePath);
    if (!authorities.find((entry) => entry.path === normalized)) {
      authorities.push({ kind, path: normalized });
    }
  };

  const files = {
    readme: await readArtifact(paths.readmePath),
    context: await readArtifact(paths.contextPath),
    contract: await readArtifact(paths.contractPath),
    pushback: await readArtifact(paths.pushbackPath),
    brief: await readArtifact(paths.briefPath),
    completion_summary: await readArtifact(paths.completionSummaryPath)
  };

  if (files.readme.exists) addAuthority("feature-readme", paths.readmePath);
  if (files.context.exists) addAuthority("feature-context", paths.contextPath);
  if (files.contract.exists) addAuthority("implement-plan-contract", paths.contractPath);

  const reviewCycles = await collectReviewCycleArtifacts(paths.featureRoot);
  for (const cycle of reviewCycles) {
    for (const artifact of cycle.artifacts) {
      addAuthority("review-cycle-artifact", artifact.path);
    }
  }

  const featureDocs = await collectMarkdownFiles(paths.featureRoot, {
    maxDepth: 3,
    excludeDirNames: new Set(["implementation-run"]),
    excludePaths: new Set([paths.readmePath, paths.contextPath, paths.contractPath, paths.pushbackPath, paths.briefPath, paths.completionSummaryPath]),
    excludePrefixes: [normalizeSlashes(join(paths.featureRoot, "cycle-"))]
  });
  for (const doc of featureDocs) {
    addAuthority("feature-doc", doc.path);
  }

  const phaseDocs = await collectMarkdownFiles(paths.phaseRoot, {
    maxDepth: 2,
    excludePrefixes: [normalizeSlashes(paths.featureRoot)]
  });
  for (const doc of phaseDocs.slice(0, 25)) {
    if (doc.path !== normalizeSlashes(paths.readmePath) && doc.path !== normalizeSlashes(paths.contextPath)) {
      addAuthority("phase-doc", doc.path);
    }
  }

  const projectDocs = await collectMarkdownFiles(paths.docsRoot, {
    maxDepth: 2,
    excludePrefixes: [normalizeSlashes(paths.featureRoot)],
    includeFilter: (item) => /architecture|design|spec|runbook|context|settings|preference/i.test(item.name)
  });
  for (const doc of projectDocs.slice(0, 25)) {
    addAuthority("project-doc", doc.path);
  }

  const contractValidation = files.contract.exists
    ? validateHeadingContract(files.contract.text, CONTRACT_HEADINGS)
    : { valid: false, error: "implement-plan-contract.md is missing." };
  const briefValidation = files.brief.exists
    ? validateHeadingContract(files.brief.text, BRIEF_HEADINGS)
    : { valid: false, error: "implement-plan-brief.md is missing." };
  const pushbackValidation = files.pushback.exists
    ? validateHeadingContract(files.pushback.text, PUSHBACK_HEADINGS)
    : { valid: false, error: "implement-plan-pushback.md is missing." };
  const completionValidation = files.completion_summary.exists
    ? validateHeadingContract(files.completion_summary.text, COMPLETION_HEADINGS)
    : { valid: false, error: "completion-summary.md is missing." };

  return {
    feature_artifacts: {
      readme: summarizeArtifact(paths.readmePath, files.readme),
      context: summarizeArtifact(paths.contextPath, files.context),
      contract: summarizeArtifact(paths.contractPath, files.contract, contractValidation),
      pushback: summarizeArtifact(paths.pushbackPath, files.pushback, pushbackValidation),
      brief: summarizeArtifact(paths.briefPath, files.brief, briefValidation),
      completion_summary: summarizeArtifact(paths.completionSummaryPath, files.completion_summary, completionValidation)
    },
    review_cycle_artifacts: reviewCycles,
    discovered_feature_docs: featureDocs,
    discovered_phase_docs: phaseDocs.slice(0, 25),
    discovered_project_docs: projectDocs.slice(0, 25),
    authorities
  };
}

function evaluateIntegrity({ setup, state, input, inputPack }) {
  const blockingIssues = [];
  const warnings = [];
  const contractArtifact = inputPack.feature_artifacts.contract;
  const equivalentSources = [
    inputPack.feature_artifacts.readme.exists,
    inputPack.feature_artifacts.context.exists,
    inputPack.review_cycle_artifacts.length > 0 || inputPack.discovered_feature_docs.length > 0 || inputPack.discovered_project_docs.length > 0
  ];
  const validEquivalentSource = equivalentSources[0] && equivalentSources[1] && equivalentSources[2];
  const contractSource = contractArtifact.valid
    ? { type: "normalized_contract", paths: [contractArtifact.path] }
    : validEquivalentSource
      ? {
          type: "equivalent_sources",
          paths: [
            inputPack.feature_artifacts.readme.path,
            inputPack.feature_artifacts.context.path,
            ...(inputPack.review_cycle_artifacts[0]?.artifacts.map((artifact) => artifact.path) ?? []),
            ...(inputPack.discovered_feature_docs.slice(0, 2).map((item) => item.path) ?? [])
          ].filter(Boolean)
        }
      : { type: "missing", paths: [] };

  if (!setup.complete) {
    blockingIssues.push(issue("setup-incomplete", "Setup is missing or invalid.", [setup.path], "Refresh setup before worker execution."));
  }
  if (state.feature_status === "blocked") {
    blockingIssues.push(issue("feature-blocked", "Feature status is blocked.", [state.feature_registry_key], "Resolve the blocker or reopen as active before implementation."));
  }
  if (["completed", "closed"].includes(state.feature_status)) {
    blockingIssues.push(issue("feature-not-open", STATUS_MESSAGES[state.feature_status], [state.feature_registry_key], "Reopen or clone the feature stream before running implement-plan."));
  }
  if (contractSource.type === "missing") {
    blockingIssues.push(issue("missing-contract-authority", "No valid implementation contract or equivalent authority set was found.", [], "Provide a normalized contract or enough authoritative source docs to derive one safely."));
  }

  const combinedText = [
    input.taskSummary,
    input.scopeHint ?? "",
    input.nonGoals ?? "",
    inputPack.feature_artifacts.readme.text ?? "",
    inputPack.feature_artifacts.context.text ?? "",
    inputPack.feature_artifacts.contract.text ?? "",
    ...inputPack.review_cycle_artifacts.flatMap((cycle) => cycle.artifacts.map((artifact) => artifact.text ?? ""))
  ].join("\n\n").toLowerCase();
  const verificationSourceText = String(contractArtifact.valid ? (contractArtifact.text ?? combinedText) : combinedText);
  const verificationPlanState = evaluateVerificationPlanState(verificationSourceText);

  const requiredSignals = [
    { key: "deliverables", patterns: [/deliverable/, /output/, /produce/] },
    { key: "allowed_edits", patterns: [/allowed edits/, /in-scope/, /scope/] },
    { key: "forbidden_edits", patterns: [/forbidden edits/, /out-of-scope/, /do not/] },
    { key: "acceptance_gates", patterns: [/acceptance/, /verify/, /verification/, /proof/, /test/] },
    { key: "constraints", patterns: [/non-goal/, /constraint/, /dependenc/] }
  ];

  for (const signal of requiredSignals) {
    const matched = signal.patterns.some((pattern) => pattern.test(combinedText));
    if (!matched) {
      blockingIssues.push(issue(
        "missing-" + signal.key,
        "The implementation slice does not make " + signal.key.replace(/_/g, " ") + " explicit enough.",
        contractSource.paths,
        "Clarify " + signal.key.replace(/_/g, " ") + " in the contract or authorities before implementation."
      ));
    }
  }

  if (!/slice|scope|bounded|minimum/.test(combinedText)) {
    blockingIssues.push(issue("slice-not-bounded", "The target slice is not explicitly bounded.", contractSource.paths, "Define the exact product slice and keep it out of speculative refactoring territory."));
  }

  if (!verificationPlanState.machine_plan_present) {
    blockingIssues.push(issue(
      "missing-machine-verification-plan",
      "The implementation slice does not include a Machine Verification Plan.",
      contractSource.paths,
      "Add a Machine Verification Plan that names the exact tests, smoke checks, or runtime evidence required before the slice can advance."
    ));
  }

  if (!verificationPlanState.human_plan_present) {
    blockingIssues.push(issue(
      "missing-human-verification-plan",
      "The implementation slice does not include a Human Verification Plan.",
      contractSource.paths,
      "Add a Human Verification Plan that explicitly states Required: true or Required: false."
    ));
  } else if (verificationPlanState.human_required === null) {
    blockingIssues.push(issue(
      "missing-human-verification-required-flag",
      "The Human Verification Plan does not state Required: true or Required: false.",
      contractSource.paths,
      "Add Required: true or Required: false to the Human Verification Plan."
    ));
  } else if (verificationPlanState.human_required === true) {
    if (!input.postSendToReview) {
      blockingIssues.push(issue(
        "missing-review-cycle-gate-for-human-verification",
        "Human verification is required, but post-review handoff is disabled.",
        contractSource.paths,
        "Enable post_send_to_review so the slice must pass review-cycle before entering human testing."
      ));
    }

    const missingHumanDetails = [];
    if (!verificationPlanState.testing_phase_language_present) missingHumanDetails.push("explicit testing-phase language");
    if (!verificationPlanState.executive_summary_present) missingHumanDetails.push("executive summary of implemented behavior");
    if (!verificationPlanState.test_steps_present) missingHumanDetails.push("exact test steps");
    if (!verificationPlanState.expected_results_present) missingHumanDetails.push("expected results");
    if (!verificationPlanState.evidence_guidance_present) missingHumanDetails.push("evidence or observations to report back");
    if (!verificationPlanState.response_contract_present) missingHumanDetails.push("APPROVED / REJECTED response contract");

    if (missingHumanDetails.length > 0) {
      blockingIssues.push(issue(
        "incomplete-human-verification-plan",
        "The Human Verification Plan is required but incomplete.",
        contractSource.paths,
        "Expand the Human Verification Plan to include " + missingHumanDetails.join(", ") + "."
      ));
    }
  }

  if (contractSource.type === "equivalent_sources") {
    warnings.push("No valid normalized implement-plan-contract.md was found. The main skill should materialize one before worker execution.");
  }

  const readyForChecker = contractSource.type !== "missing" && !["completed", "closed"].includes(state.feature_status);
  const readyForWorker = blockingIssues.length === 0;
  const nextSafeMove = blockingIssues.length > 0
    ? "write pushback and stop"
    : contractSource.type === "normalized_contract"
      ? "proceed to implementor brief"
      : "materialize normalized contract and proceed to implementor brief";

  return {
    ready_for_integrity_checker: readyForChecker,
    ready_for_worker: readyForWorker,
    contract_source: contractSource,
    normalized_contract_required: contractSource.type !== "normalized_contract",
    blocking_issues: blockingIssues,
    warnings,
    next_safe_move: nextSafeMove
  };
}

function evaluateVerificationPlanState(text) {
  const normalized = String(text ?? "").toLowerCase();
  const machinePlanPresent = /machine verification plan/.test(normalized);
  const humanPlanPresent = /human verification plan/.test(normalized);
  const humanWindow = extractAnchorWindow(normalized, "human verification plan", 2400);
  const requiredMatch = /required:\s*(true|false)/.exec(humanWindow);
  const humanRequired = requiredMatch ? requiredMatch[1] === "true" : null;

  return {
    machine_plan_present: machinePlanPresent,
    human_plan_present: humanPlanPresent,
    human_required: humanRequired,
    testing_phase_language_present: /testing phase|ready for (your )?testing/.test(humanWindow),
    executive_summary_present: /executive summary|implemented behavior|implemented:/.test(humanWindow),
    test_steps_present: /test steps|testing sequence|please test the following|1\./.test(humanWindow),
    expected_results_present: /expected result/.test(humanWindow),
    evidence_guidance_present: /evidence|report back|observation/.test(humanWindow),
    response_contract_present: /approved/.test(humanWindow) && /rejected/.test(humanWindow)
  };
}

function extractAnchorWindow(text, anchor, maxLength) {
  const source = String(text ?? "");
  const start = source.lastIndexOf(anchor);
  if (start < 0) return source;
  return source.slice(start, start + maxLength);
}

async function writePushbackArtifact(pushbackPath, integrity) {
  const lines = [
    "1. Integrity Verdict",
    "",
    "PUSHBACK",
    "",
    "2. Missing / Weak / Unsafe Inputs",
    ""
  ];

  if (integrity.blocking_issues.length === 0) {
    lines.push("- None.");
  } else {
    for (const blocker of integrity.blocking_issues) {
      lines.push("- issue class: " + blocker.issue_class);
      lines.push("  why it blocks or weakens implementation: " + blocker.why);
      lines.push("  exact artifact or contract gap: " + (blocker.evidence.length > 0 ? blocker.evidence.join(", ") : "None recorded."));
      lines.push("  what authority or clarification would close it: " + blocker.required_repair);
      lines.push("");
    }
  }

  lines.push("3. Required Contract Repairs", "");
  if (integrity.blocking_issues.length === 0) {
    lines.push("- None.");
  } else {
    for (const blocker of integrity.blocking_issues) {
      lines.push("- " + blocker.required_repair);
    }
  }

  lines.push("", "4. Next Safe Move", "", integrity.next_safe_move, "");
  await writeTextAtomic(pushbackPath, lines.join("\n"));
}

async function syncAgentRegistry(paths, state) {
  const registryPath = paths.registryPath;
  const empty = { version: 1, features: {} };
  await withLock(paths.projectLocksRoot, "agent-registry", async () => {
    const current = (await pathExists(registryPath)) ? await readJson(registryPath).catch(() => empty) : empty;
    const next = isPlainObject(current) && isPlainObject(current.features) ? current : empty;
    next.version = 1;
    next.features = isPlainObject(next.features) ? next.features : {};

    const existing = next.features[paths.registryKey] ?? {};
    if (isFilled(state.implementor_execution_id) || isFilled(existing.implementor_execution_id)) {
      next.features[paths.registryKey] = {
        phase_number: paths.phaseNumber,
        feature_slug: paths.featureSlug,
        feature_root: normalizeSlashes(paths.featureRoot),
        implementor_execution_id: state.implementor_execution_id ?? existing.implementor_execution_id ?? null,
        implementor_execution_access_mode: state.implementor_execution_access_mode ?? existing.implementor_execution_access_mode ?? null,
        implementor_execution_runtime: state.implementor_execution_runtime ?? existing.implementor_execution_runtime ?? null,
        implementor_model: state.implementor_model ?? existing.implementor_model ?? null,
        implementor_reasoning_effort: state.implementor_reasoning_effort ?? existing.implementor_reasoning_effort ?? null,
        resolved_runtime_permission_model: state.resolved_runtime_permission_model ?? existing.resolved_runtime_permission_model ?? null,
        updated_at: nowIso()
      };
      await writeJsonAtomic(registryPath, next);
    }
  });
}

async function syncFeaturesIndex(paths, state) {
  const indexPath = paths.featuresIndexPath;
  const empty = { version: 1, updated_at: null, features: {} };
  await withLock(paths.projectLocksRoot, "features-index", async () => {
    const current = (await pathExists(indexPath)) ? await readJson(indexPath).catch(() => empty) : empty;
    const next = isPlainObject(current) && isPlainObject(current.features) ? current : empty;
    next.version = 1;
    next.features = isPlainObject(next.features) ? next.features : {};
    next.features[paths.registryKey] = {
      phase_number: paths.phaseNumber,
      feature_slug: paths.featureSlug,
      feature_root: normalizeSlashes(paths.featureRoot),
      feature_status: state.feature_status,
      active_run_status: state.active_run_status,
      last_completed_step: state.last_completed_step ?? null,
      last_commit_sha: state.last_commit_sha ?? null,
      updated_at: nowIso()
    };
    next.updated_at = nowIso();
    await writeJsonAtomic(indexPath, next);
  });
}

function extractHeadingSection(text, heading) {
  const lines = String(text ?? "").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return "";
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\d+\.\s+/.test(lines[index].trim())) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n").trim();
}

function extractLabeledValue(text, label) {
  if (!text) return null;
  const expression = new RegExp("^" + escapeRegex(label) + "\\s*:\\s*(.+)$", "im");
  const match = expression.exec(text);
  return match ? match[1].trim() : null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function summarizeFeatureSections(index) {
  const features = Object.entries(index.features ?? {}).map(([key, value]) => ({ key, ...value }));
  const sort = (left, right) => String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? ""));
  const compact = (items) => items.sort(sort).map((item) => ({
    feature_registry_key: item.key,
    phase_number: item.phase_number,
    feature_slug: item.feature_slug,
    feature_status: item.feature_status,
    active_run_status: item.active_run_status,
    last_completed_step: item.last_completed_step ?? null,
    last_commit_sha: item.last_commit_sha ?? null,
    updated_at: item.updated_at ?? null
  }));

  return {
    active: compact(features.filter((item) => item.feature_status === "active")),
    blocked: compact(features.filter((item) => item.feature_status === "blocked")),
    completed: compact(features.filter((item) => item.feature_status === "completed")),
    closed: compact(features.filter((item) => item.feature_status === "closed")),
    open_count: features.filter((item) => item.feature_status === "active" || item.feature_status === "blocked").length
  };
}

function decideExecutionAction(executionId, recreateDueToWeakerAccess, readyToSpawn) {
  if (recreateDueToWeakerAccess) return "recreate";
  if (isFilled(executionId)) return "resume";
  return readyToSpawn ? "spawn" : "defer";
}

function determineNextAction(input) {
  if (!input.setupComplete) return "refresh_setup_internally";
  if (["completed", "closed"].includes(input.featureStatus)) return "fail_feature_not_open";
  if (input.featureStatus === "blocked") return "write_pushback_for_blocked_feature";
  if (input.integrity.blocking_issues.length > 0) return "surface_pushback_and_stop";
  if (input.executionAction === "recreate") return "recreate_implementor_with_stronger_access_then_resume";
  if (input.executionAction === "resume") return "resume_implementor_with_brief";
  return "spawn_implementor_with_brief";
}

function applyEventTransition(state, event, timestamp) {
  const transitions = {
    "context-collected": { activeRunStatus: "context_ready", lastCompletedStep: "context_collected", timestampKey: "context_collected_at" },
    "integrity-passed": { activeRunStatus: "brief_ready", lastCompletedStep: "integrity_passed", timestampKey: "integrity_passed_at" },
    "integrity-failed": { activeRunStatus: state.feature_status === "blocked" ? "blocked" : "integrity_failed", lastCompletedStep: "integrity_failed", timestampKey: "integrity_failed_at" },
    "brief-written": { activeRunStatus: "brief_ready", lastCompletedStep: "brief_written", timestampKey: "brief_written_at" },
    "implementor-started": { activeRunStatus: "implementation_running", lastCompletedStep: "implementor_started", timestampKey: "implementor_started_at" },
    "implementor-finished": { activeRunStatus: "verification_pending", lastCompletedStep: "implementor_finished", timestampKey: "implementor_finished_at" },
    "verification-finished": { activeRunStatus: "closeout_pending", lastCompletedStep: "verification_finished", timestampKey: "verification_finished_at" },
    "completion-summary-written": { activeRunStatus: "closeout_pending", lastCompletedStep: "completion_summary_written", timestampKey: "completion_summary_written_at" },
    "closeout-finished": { activeRunStatus: "completed", lastCompletedStep: "closeout_finished", timestampKey: "closeout_finished_at" },
    "feature-blocked": { activeRunStatus: "blocked", lastCompletedStep: "feature_blocked", timestampKey: "feature_blocked_at", featureStatus: "blocked" },
    "feature-reopened": { activeRunStatus: "idle", lastCompletedStep: "feature_reopened", timestampKey: "feature_reopened_at", featureStatus: "active" }
  };
  const transition = transitions[event];
  if (!transition) return;

  if (transition.featureStatus) {
    state.feature_status = transition.featureStatus;
  }
  state.active_run_status = transition.activeRunStatus;
  state.last_completed_step = transition.lastCompletedStep;
  state.run_timestamps[transition.timestampKey] = timestamp;
}

async function collectReviewCycleArtifacts(featureRoot) {
  const cycles = [];
  const entries = await safeReaddir(featureRoot);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = /^cycle-(\d+)$/.exec(entry.name);
    if (!match) continue;
    const cycleDir = join(featureRoot, entry.name);
    const artifacts = [];
    for (const artifactName of REVIEW_CYCLE_ARTIFACTS) {
      const artifactPath = join(cycleDir, artifactName);
      const artifact = await readArtifact(artifactPath);
      if (artifact.exists) {
        artifacts.push({
          name: artifactName,
          path: normalizeSlashes(artifactPath),
          text: artifact.text
        });
      }
    }
    cycles.push({
      cycle_name: entry.name,
      cycle_number: Number(match[1]),
      dir: normalizeSlashes(cycleDir),
      artifacts
    });
  }
  cycles.sort((left, right) => right.cycle_number - left.cycle_number);
  return cycles;
}

async function collectMarkdownFiles(rootPath, options = {}) {
  const results = [];
  if (!(await pathExists(rootPath))) {
    return results;
  }

  const excludeDirNames = options.excludeDirNames ?? new Set();
  const excludePaths = options.excludePaths ?? new Set();
  const excludePrefixes = options.excludePrefixes ?? [];
  const includeFilter = options.includeFilter ?? (() => true);
  const maxDepth = options.maxDepth ?? 3;

  async function visit(currentPath, depth) {
    if (depth > maxDepth) return;
    const entries = await safeReaddir(currentPath);
    for (const entry of entries) {
      const childPath = join(currentPath, entry.name);
      const normalized = normalizeSlashes(childPath);
      if (excludePaths.has(childPath) || excludePaths.has(normalized)) {
        continue;
      }
      if (excludePrefixes.some((prefix) => normalized.startsWith(prefix))) {
        continue;
      }
      if (entry.isDirectory()) {
        if (excludeDirNames.has(entry.name)) {
          continue;
        }
        await visit(childPath, depth + 1);
        continue;
      }
      if (!/\.(md|markdown)$/i.test(entry.name)) {
        continue;
      }
      if (!includeFilter(entry)) {
        continue;
      }
      results.push({
        name: entry.name,
        path: normalized,
        relative_path: normalizeSlashes(relative(rootPath, childPath))
      });
    }
  }

  await visit(rootPath, 0);
  return results;
}

async function readArtifact(filePath) {
  const exists = await pathExists(filePath);
  if (!exists) {
    return { exists: false, text: "" };
  }
  return {
    exists: true,
    text: await readTextIfExists(filePath)
  };
}

function summarizeArtifact(filePath, artifact, validation = { valid: artifact.exists, error: artifact.exists ? null : "missing" }) {
  return {
    path: normalizeSlashes(filePath),
    exists: artifact.exists,
    valid: validation.valid,
    validation_error: validation.error,
    text: artifact.text
  };
}

async function loadStateIfExists(statePath) {
  if (!(await pathExists(statePath))) {
    return null;
  }
  return readJson(statePath);
}

function issue(issueClass, why, evidence, requiredRepair) {
  return {
    issue_class: issueClass,
    why,
    evidence: evidence.filter(Boolean),
    required_repair: requiredRepair
  };
}

function validateEnum(value, allowed, fieldName, errors) {
  if (!isFilled(value)) return;
  if (!allowed.has(value)) {
    errors.push("Field '" + fieldName + "' must be one of: " + Array.from(allowed).join(", ") + ".");
  }
}

function parseOptionalFeatureStatus(value, label) {
  if (!isFilled(value)) return null;
  if (!FEATURE_STATUSES.has(value)) {
    fail("Invalid value for --" + label + ". Allowed values: " + Array.from(FEATURE_STATUSES).join(", ") + ".");
  }
  return value;
}

function resolvePostReviewHandoffArgs(args) {
  const primaryEnabled = parseOptionalBooleanInput(args.values["post-send-to-review"], "post-send-to-review");
  const aliasEnabled = parseOptionalBooleanInput(args.values["post-send-for-review"], "post-send-for-review");

  if (primaryEnabled !== null && aliasEnabled !== null && primaryEnabled !== aliasEnabled) {
    fail("Conflicting values were provided for --post-send-to-review and --post-send-for-review.");
  }

  const postSendToReview = primaryEnabled ?? aliasEnabled ?? false;
  const postSendToReviewAliasUsed = primaryEnabled === null && aliasEnabled !== null;
  const reviewUntilComplete = booleanArg({ values: args.values }, "review-until-complete", false);
  const reviewMaxCycles = isFilled(args.values["review-max-cycles"])
    ? parsePositiveInteger(args.values["review-max-cycles"], "review-max-cycles")
    : null;

  if (!postSendToReview) {
    if (reviewUntilComplete) {
      fail("--review-until-complete requires --post-send-to-review=true.");
    }
    if (reviewMaxCycles !== null) {
      fail("--review-max-cycles requires --post-send-to-review=true.");
    }
  }

  if (!reviewUntilComplete && reviewMaxCycles !== null) {
    fail("--review-max-cycles requires --review-until-complete=true.");
  }

  return {
    postSendToReview,
    postSendToReviewAliasUsed,
    reviewUntilComplete,
    reviewMaxCycles
  };
}

function parseOptionalBooleanInput(value, label) {
  if (value === undefined) {
    return null;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  fail("Argument --" + label + " must be true or false.");
}

function parseOptionalAccessMode(value, label) {
  if (!isFilled(value)) return null;
  if (!ACCESS_MODES.has(value)) {
    fail("Invalid value for --" + label + ". Allowed values: " + Array.from(ACCESS_MODES).join(", ") + ".");
  }
  return value;
}

function parseOptionalRuntime(value, label) {
  if (!isFilled(value)) return null;
  if (!EXECUTION_RUNTIMES.has(value)) {
    fail("Invalid value for --" + label + ". Allowed values: " + Array.from(EXECUTION_RUNTIMES).join(", ") + ".");
  }
  return value;
}

function parseOptionalPermissionModel(value, label) {
  if (!isFilled(value)) return null;
  if (!RUNTIME_PERMISSION_MODELS.has(value)) {
    fail("Invalid value for --" + label + ". Allowed values: " + Array.from(RUNTIME_PERMISSION_MODELS).join(", ") + ".");
  }
  return value;
}

function parseOptionalActiveRunStatus(value, label) {
  if (!isFilled(value)) return null;
  if (!IMPLEMENT_PLAN_ACTIVE_RUN_STATUSES.has(value)) {
    fail("Invalid value for --" + label + ". Allowed values: " + Array.from(IMPLEMENT_PLAN_ACTIVE_RUN_STATUSES).join(", ") + ".");
  }
  return value;
}

function parseCapabilityPairs(pairs) {
  const result = {};
  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    if (separator <= 0) {
      fail("Capability '" + pair + "' must use key=value form.");
    }
    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    result[key] = value === "true" ? true : value === "false" ? false : value === "null" ? null : /^-?\d+$/.test(value) ? Number(value) : value;
  }
  return result;
}
