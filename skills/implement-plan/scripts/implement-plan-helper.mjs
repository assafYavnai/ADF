#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACCESS_MODES,
  EXECUTION_RUNTIMES,
  FEATURE_STATUSES,
  IMPLEMENT_PLAN_RUN_MODES,
  IMPLEMENT_PLAN_ACTIVE_RUN_STATUSES,
  IMPLEMENT_PLAN_EVENTS,
  PERSISTENT_EXECUTION_STRATEGIES,
  RUNTIME_PERMISSION_MODELS,
  appendJsonEvent,
  buildFeatureRegistryKey,
  booleanArg,
  createOpaqueId,
  detectDefaultBaseBranch,
  describeError,
  detectCurrentBranch,
  diffSeconds,
  emptyToNull,
  extractBulletishLines,
  formatDuration,
  gitRefExists,
  gitRun,
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
  readJsonDirectory,
  readTextIfExists,
  requiredArg,
  resolveFeatureRoot,
  resolveSkillStateRoot,
  sanitizePathSegment,
  safeInteger,
  safeReaddir,
  shouldRecreateExecution,
  validateHeadingContract,
  withLock,
  writeJsonAtomic,
  writeTextAtomic,
  fail
} from "../../governed-feature-runtime.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const skillRoot = dirname(dirname(scriptPath));

const KNOWN_FEATURE_FILES = new Set([
  "README.md",
  "context.md",
  "implement-plan-state.json",
  "implement-plan-contract.md",
  "implement-plan-execution-contract.v1.json",
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

const KPI_APPLICABILITY_ALLOWED_VALUES = [
  "required",
  "not required",
  "temporary exception approved"
];

const COMPATIBILITY_GATE_CONTENT_LABELS = [
  "Vision Compatibility",
  "Phase 1 Compatibility",
  "Master-Plan Compatibility",
  "Current Gap-Closure Compatibility",
  "Compatibility Evidence"
];

const COMPATIBILITY_DECISION_ALLOWED_VALUES = [
  "compatible",
  "defer-later-company",
  "blocked-needs-user-decision"
];

const KPI_PLACEHOLDER_VALUE_PATTERNS = [
  /^none\.?$/i,
  /^n\/a\.?$/i,
  /^not applicable\.?$/i,
  /^not specified\.?$/i,
  /^tbd\.?$/i,
  /^todo\.?$/i,
  /^unknown\.?$/i,
  /^same as above\.?$/i
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

const MERGE_STATUSES = new Set([
  "not_ready",
  "ready_to_queue",
  "queued",
  "in_progress",
  "merged",
  "blocked",
  "not_required"
]);

const WORKTREE_STATUSES = new Set([
  "missing",
  "ready",
  "mismatch",
  "error"
]);

const LOCAL_TARGET_SYNC_STATUSES = new Set([
  "not_started",
  "fetched_only",
  "fast_forwarded",
  "skipped_dirty_checkout",
  "skipped_branch_not_checked_out",
  "failed"
]);

const EXECUTION_CONTRACT_SCHEMA_VERSION = 1;
const RUN_PROJECTION_SCHEMA_VERSION = 1;
const IMPLEMENT_PLAN_STATE_SCHEMA_VERSION = 2;
const EXECUTION_WORKER_ROLES = new Set(["implementor"]);
const NORMAL_ROUTE_STEP_ORDER = [
  "implementation",
  "machine_verification",
  "review_cycle",
  "human_testing",
  "merge_queue"
];
const EXECUTION_STEP_NAMES = new Set(NORMAL_ROUTE_STEP_ORDER);
const WORKER_SELECTION_FIELDS = [
  "provider",
  "runtime",
  "access_mode",
  "model",
  "reasoning_effort"
];
const STEP_OUTCOME_STATUSES = new Set([
  "not_started",
  "ready",
  "in_progress",
  "completed",
  "blocked",
  "skipped",
  "invalidated"
]);
const ATTEMPT_STATUSES = new Set([
  "ready_for_implementation",
  "implementation_running",
  "verification_pending",
  "review_pending",
  "human_testing_pending",
  "merge_ready",
  "merge_queued",
  "merge_in_progress",
  "closeout_pending",
  "blocked",
  "completed",
  "supervisor_deferred",
  "superseded"
]);
const RUN_LIFECYCLE_STATUSES = new Set([
  "idle",
  "active",
  "blocked",
  "completed",
  "supervisor_deferred"
]);
const EXECUTION_EVENT_TYPES = new Set([
  "run-initialized",
  "attempt-started",
  "attempt-reset",
  "contract-materialized",
  "worker-bound",
  "state-patched",
  "step-transition",
  "governance-call-recorded",
  "verification-recorded",
  "blocker-recorded",
  "terminal-status-recorded"
]);

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
      runMode: parseRunMode(args.values["run-mode"] ?? "normal"),
      scopeHint: emptyToNull(args.values["scope-hint"]),
      nonGoals: emptyToNull(args.values["non-goals"]),
      workerProvider: parseOptionalSafeToken(args.values["worker-provider"], "worker-provider"),
      workerRuntime: parseOptionalRuntime(args.values["worker-runtime"], "worker-runtime"),
      workerAccessMode: parseOptionalAccessMode(args.values["worker-access-mode"], "worker-access-mode"),
      workerModel: emptyToNull(args.values["worker-model"]),
      workerReasoningEffort: emptyToNull(args.values["worker-reasoning-effort"]),
      benchmarkRunId: parseOptionalSafeToken(args.values["benchmark-run-id"], "benchmark-run-id"),
      benchmarkSuiteId: parseOptionalSafeToken(args.values["benchmark-suite-id"], "benchmark-suite-id"),
      benchmarkLaneId: parseOptionalSafeToken(args.values["benchmark-lane-id"], "benchmark-lane-id"),
      benchmarkLaneLabel: emptyToNull(args.values["benchmark-lane-label"]),
      implementorModel: emptyToNull(args.values["implementor-model"]),
      implementorReasoningEffort: normalizeReasoningEffortValue(args.values["implementor-reasoning-effort"]),
      featureStatusOverride: parseOptionalFeatureStatus(args.values["feature-status-override"], "feature-status-override"),
      ...postReviewHandoff
    }));
    return;
  }

  if (command === "update-state") {
    printJson(await updateState({
      projectRoot: normalizeProjectRoot(requiredArg(args, "project-root")),
      canonicalProjectRoot: normalizeOptionalProjectRoot(args.values["canonical-project-root"]),
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug")),
      implementorExecutionId: args.values["implementor-execution-id"],
      implementorExecutionAccessMode: args.values["implementor-execution-access-mode"],
      implementorExecutionRuntime: args.values["implementor-execution-runtime"],
      implementorProvider: args.values["implementor-provider"],
      implementorModel: args.values["implementor-model"],
      implementorReasoningEffort: normalizeReasoningEffortValue(args.values["implementor-reasoning-effort"]),
      resolvedRuntimePermissionModel: args.values["resolved-runtime-permission-model"],
      runMode: args.values["run-mode"],
      runId: args.values["run-id"],
      attemptId: args.values["attempt-id"],
      featureStatus: args.values["feature-status"],
      currentBranch: args.values["current-branch"],
      baseBranch: args.values["base-branch"],
      featureBranch: args.values["feature-branch"],
      worktreePath: args.values["worktree-path"],
      worktreeStatus: args.values["worktree-status"],
      mergeRequired: args.values["merge-required"],
      mergeStatus: args.values["merge-status"],
      approvedCommitSha: args.values["approved-commit-sha"],
      mergeCommitSha: args.values["merge-commit-sha"],
      mergeQueueRequestId: args.values["merge-queue-request-id"],
      localTargetSyncStatus: args.values["local-target-sync-status"],
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
      canonicalProjectRoot: normalizeOptionalProjectRoot(args.values["canonical-project-root"]),
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug")),
      event: requiredArg(args, "event"),
      timestamp: emptyToNull(args.values.timestamp),
      note: emptyToNull(args.values.note),
      lastCommitSha: emptyToNull(args.values["last-commit-sha"]),
      currentBranch: emptyToNull(args.values["current-branch"]),
      runMode: emptyToNull(args.values["run-mode"]),
      runId: emptyToNull(args.values["run-id"]),
      attemptId: emptyToNull(args.values["attempt-id"]),
      role: emptyToNull(args.values.role),
      step: emptyToNull(args.values.step),
      stepStatus: emptyToNull(args.values["step-status"]),
      payloadFile: emptyToNull(args.values["payload-file"])
    }));
    return;
  }

  if (command === "reset-attempt") {
    printJson(await resetAttempt({
      projectRoot: normalizeProjectRoot(requiredArg(args, "project-root")),
      canonicalProjectRoot: normalizeOptionalProjectRoot(args.values["canonical-project-root"]),
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug")),
      runMode: parseRunMode(args.values["run-mode"] ?? "normal"),
      runId: emptyToNull(args.values["run-id"]),
      note: emptyToNull(args.values.note),
      clearExecutionIdentity: booleanArg(args, "clear-execution-identity", false)
    }));
    return;
  }

  if (command === "mark-complete") {
    printJson(await markComplete({
      projectRoot: normalizeProjectRoot(requiredArg(args, "project-root")),
      canonicalProjectRoot: normalizeOptionalProjectRoot(args.values["canonical-project-root"]),
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

  if (command === "normalize-completion-summary") {
    printJson(await normalizeCompletionSummary({
      projectRoot: normalizeProjectRoot(requiredArg(args, "project-root")),
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug"))
    }));
    return;
  }

  if (command === "validate-closeout-readiness") {
    printJson(await validateCloseoutReadiness({
      projectRoot: normalizeProjectRoot(requiredArg(args, "project-root")),
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug"))
    }));
    return;
  }

  fail("Unknown command '" + command + "'. Use 'help', 'get-settings', 'list-features', 'prepare', 'update-state', 'record-event', 'reset-attempt', 'mark-complete', 'completion-summary', 'normalize-completion-summary', or 'validate-closeout-readiness'.");
}

async function renderHelp(args) {
  const projectRoot = normalizeProjectRoot(args.values["project-root"] ?? process.cwd());
  const settings = await getSettingsCore(projectRoot);
  const features = await loadFeaturesIndex(projectRoot);

  return {
    command: "help",
    project_root: projectRoot,
    purpose: "Govern bounded feature implementation slices by validating setup, checking plan integrity, preparing isolated worktrees, producing pushback or a strong implementor brief, and handing approved commits to merge closeout truthfully.",
    actions: ["help", "get-settings", "list-features", "prepare", "run", "mark-complete"],
    internal_helper_commands: ["update-state", "record-event", "reset-attempt", "completion-summary", "normalize-completion-summary", "validate-closeout-readiness"],
    required_inputs_for_run: ["project_root", "phase_number", "feature_slug", "task_summary"],
    optional_inputs: [
      "run_mode (normal|benchmarking; default normal)",
      "scope_hint",
      "non_goals",
      "worker_provider",
      "worker_runtime",
      "worker_access_mode",
      "worker_model",
      "worker_reasoning_effort",
      "implementor_model",
      "implementor_reasoning_effort",
      "feature_status_override",
      "post_send_to_review",
      "review_until_complete",
      "review_max_cycles",
      "post_send_for_review (compatibility alias)",
      "benchmark_run_id / benchmark_suite_id / benchmark_lane_id / benchmark_lane_label (benchmarking substrate only)"
    ],
    transparent_setup_behavior: "The main skill validates setup internally and auto-refreshes it when missing or invalid before worker use.",
    current_settings_summary: settings.summary,
    active_open_features_summary: summarizeFeatureSections(features.index),
    mark_complete_usage: "Use action=mark-complete with project_root, phase_number, and feature_slug after completion-summary.md exists and push evidence is recorded.",
    closed_feature_note: "Completed or closed features cannot run again until they are reopened or cloned into a new feature stream.",
    post_send_to_review_note: "When post_send_to_review=true, implement-plan should hand the feature stream to review-cycle after implementation closeout. post_send_for_review remains a compatibility alias.",
    review_cycle_handoff_note: "When review_until_complete=true, implement-plan should pass until_complete=true to review-cycle. If review_max_cycles is omitted in that mode, review-cycle keeps its default cap of 5.",
    merge_queue_note: "Approved feature-branch commits are merge-ready, not complete. Completion happens only after merge-queue lands the approved commit and records target-branch sync truthfully.",
    reset_note: "reset-attempt is an internal helper surface that restarts a run from implementation as a new attempt while preserving prior attempt history."
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
    preferred_implementor_reasoning_effort: sanitizeWorkerReasoningEffort(
      setup.data.preferred_implementor_reasoning_effort ?? defaultReasoningEffortForRuntime(setup.data.preferred_execution_runtime ?? null),
      null,
      setup.data.preferred_execution_runtime ?? null
    ),
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
    // --- Worktree-first: create or reuse the worktree BEFORE any feature-local writes ---
    const currentBranch = detectCurrentBranch(input.projectRoot);
    const earlyBaseBranch = detectDefaultBaseBranch(input.projectRoot);
    const earlyFeatureBranch = buildFeatureBranchName(input.phaseNumber, input.featureSlug);
    const earlyWorktreePath = normalizeSlashes(resolveFeatureWorktreePath(paths));

    let worktree = null;
    let artifactPaths = paths;       // feature-local write target (worktree when available)
    let artifactRootKind = "project"; // observability: "worktree" or "project"

    if (input.runMode === "normal") {
      worktree = ensureFeatureWorktree(paths, earlyBaseBranch, earlyFeatureBranch, earlyWorktreePath);
      if (worktree.worktree_status !== "ready") {
        // Worktree creation failed — stop truthfully, do NOT fall back to main checkout.
        const failIntegrity = { blocking_issues: [], next_safe_move: "Resolve the worktree error and retry." };
        failIntegrity.blocking_issues.push(issue(
          "worktree-not-ready",
          "The feature worktree could not be prepared for isolated implementation.",
          [worktree.worktree_path],
          worktree.message
        ));
        await mkdir(paths.featureRoot, { recursive: true });
        await writePushbackArtifact(paths.pushbackPath, failIntegrity);
        const failState = buildInitialState(
          paths, input,
          registry.index.features[paths.registryKey] ?? null,
          featuresIndex.index.features[paths.registryKey] ?? null,
          currentBranch
        );
        failState.base_branch = earlyBaseBranch;
        failState.feature_branch = earlyFeatureBranch;
        failState.worktree_path = worktree.worktree_path;
        failState.worktree_status = worktree.worktree_status;
        failState.active_run_status = failState.feature_status === "blocked" ? "blocked" : "integrity_failed";
        failState.last_completed_step = "integrity_precheck_failed";
        failState.last_error = worktree.message;
        failState.run_timestamps = { integrity_failed_at: nowIso() };
        failState.updated_at = nowIso();
        await writeJsonAtomic(paths.statePath, failState);
        return {
          readmeCreated: false,
          contextCreated: false,
          state: failState,
          stateCreated: true,
          stateRepairs: [],
          integrity: failIntegrity,
          inputPack: { authorities: [], feature_artifacts: { readme: { exists: false }, context: { exists: false }, contract: { exists: false }, pushback: { exists: false }, brief: { exists: false }, completion_summary: { exists: false } } },
          recreateDueToWeakerAccess: false,
          requiredAccessMode: null,
          workerSelection: { resolved: {} },
          executionContract: { contract_revision: 0, artifacts: {} },
          executionRun: { run_id: null, run_mode: input.runMode, lifecycle_status: "blocked", kpi_projection: null, benchmark_context: null },
          executionAttempt: { attempt_id: null, status: "blocked", resume_checkpoint: null },
          verificationPlanState: { has_verification_plan: false },
          artifactRootKind: "project",
          worktreeResult: worktree
        };
      }
      artifactPaths = buildPaths(worktree.worktree_path, input.phaseNumber, input.featureSlug);
      artifactRootKind = "worktree";
    }

    // --- Feature-local artifact writes now target the worktree (or project root for benchmarking) ---
    await mkdir(artifactPaths.featureRoot, { recursive: true });
    await mkdir(artifactPaths.implementationRunDir, { recursive: true });

    const readmeCreated = await ensureFeatureReadme(artifactPaths, input);

    // State loading: try worktree path first, fall back to main checkout for legacy reads
    let stateLoadPaths = artifactPaths;
    if (artifactRootKind === "worktree" && !(await pathExists(artifactPaths.statePath)) && (await pathExists(paths.statePath))) {
      stateLoadPaths = paths; // legacy: state still on main checkout
    }
    const existingState = await loadOrInitializeState({
      paths: stateLoadPaths,
      input,
      registryEntry: registry.index.features[paths.registryKey] ?? null,
      indexEntry: featuresIndex.index.features[paths.registryKey] ?? null,
      currentBranch
    });
    const inputPack = await buildInputPack(artifactPaths, input);
    const contextCreated = await ensureFeatureContext(artifactPaths, input, inputPack, existingState.state.current_branch ?? currentBranch ?? null);
    const refreshedInputPack = contextCreated ? await buildInputPack(artifactPaths, input) : inputPack;

    let nextState = { ...existingState.state };
    let changed = existingState.changed;

    // When artifacts live in a worktree, record the worktree root as project_root
    // so that buildArtifactPaths resolves correctly everywhere downstream.
    if (artifactRootKind === "worktree" && worktree?.worktree_path) {
      const worktreeProjectRoot = normalizeProjectRoot(worktree.worktree_path);
      if (nextState.project_root !== worktreeProjectRoot) {
        nextState.project_root = worktreeProjectRoot;
        changed = true;
      }
    }

    if (input.featureStatusOverride && nextState.feature_status !== input.featureStatusOverride) {
      nextState.feature_status = input.featureStatusOverride;
      changed = true;
    }

    if (!nextState.current_branch && currentBranch) {
      nextState.current_branch = currentBranch;
      changed = true;
    }
    if (!nextState.base_branch) {
      nextState.base_branch = detectDefaultBaseBranch(input.projectRoot);
      changed = true;
    }
    if (!nextState.feature_branch) {
      nextState.feature_branch = buildFeatureBranchName(input.phaseNumber, input.featureSlug);
      changed = true;
    }
    if (!nextState.worktree_path) {
      nextState.worktree_path = normalizeSlashes(resolveFeatureWorktreePath(paths));
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
    }

    const workerSelection = resolveWorkerSelection({ setup, state: nextState, input });
    if (input.runMode === "normal") {
      if (nextState.implementor_provider !== workerSelection.resolved.provider) {
        nextState.implementor_provider = workerSelection.resolved.provider ?? null;
        changed = true;
      }
      if (nextState.implementor_execution_runtime !== workerSelection.resolved.runtime) {
        nextState.implementor_execution_runtime = workerSelection.resolved.runtime ?? null;
        changed = true;
      }
      if (workerSelection.resolved.access_mode && nextState.implementor_execution_access_mode !== workerSelection.resolved.access_mode) {
        nextState.implementor_execution_access_mode = workerSelection.resolved.access_mode;
        changed = true;
      }
      if (nextState.implementor_model !== workerSelection.resolved.model) {
        nextState.implementor_model = workerSelection.resolved.model ?? null;
        changed = true;
      }
      if (nextState.implementor_reasoning_effort !== workerSelection.resolved.reasoning_effort) {
        nextState.implementor_reasoning_effort = workerSelection.resolved.reasoning_effort ?? null;
        changed = true;
      }
    }

    const executionContext = ensureExecutionRunContext({
      state: nextState,
      paths: artifactPaths,
      input,
      workerSelection
    });
    const verificationSourceText = [
      refreshedInputPack.feature_artifacts.contract.text,
      refreshedInputPack.feature_artifacts.readme.text,
      refreshedInputPack.feature_artifacts.context.text
    ].filter(Boolean).join("\n\n");
    const verificationPlanState = evaluateVerificationPlanState(verificationSourceText);

    const requiredAccessMode = workerSelection.resolved.access_mode
      ?? setup.data.preferred_implementor_access_mode
      ?? setup.data.preferred_execution_access_mode
      ?? setup.data.fallback_execution_access_mode
      ?? null;
    const recreateDueToWeakerAccess = shouldRecreateExecution(
      input.runMode === "normal"
        ? nextState.implementor_execution_id
        : executionContext.attempt.worker_bindings?.[executionContext.worker_key]?.execution_id ?? null,
      input.runMode === "normal"
        ? nextState.implementor_execution_access_mode
        : executionContext.attempt.worker_bindings?.[executionContext.worker_key]?.access_mode ?? null,
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
      await writePushbackArtifact(artifactPaths.pushbackPath, integrity);
      finalInputPack = await buildInputPack(artifactPaths, input);
      if (input.runMode === "normal") {
        nextState.active_run_status = nextState.feature_status === "blocked" ? "blocked" : "integrity_failed";
        nextState.last_completed_step = "integrity_precheck_failed";
        nextState.run_timestamps = {
          ...(nextState.run_timestamps ?? {}),
          context_collected_at: nextState.run_timestamps?.context_collected_at ?? nowIso(),
          integrity_failed_at: nowIso()
        };
      }
      syncBenchmarkingProjection({
        run: executionContext.run,
        attempt: executionContext.attempt,
        integrity
      });
      changed = true;
    } else if (input.runMode === "normal") {
      // Worktree was already created before artifact writes (worktree-first).
      // Apply worktree state from the early creation result.
      nextState.worktree_path = worktree.worktree_path;
      nextState.worktree_status = worktree.worktree_status;
      nextState.merge_required = true;
      nextState.merge_status = nextState.merge_status === "merged" ? "merged" : "not_ready";
      nextState.local_target_sync_status = nextState.local_target_sync_status ?? "not_started";
      nextState.current_branch = nextState.feature_branch;
      nextState.last_error = null;
      nextState.active_run_status = "context_ready";
      nextState.last_completed_step = "context_collected";
      nextState.run_timestamps = {
        ...(nextState.run_timestamps ?? {}),
        context_collected_at: nextState.run_timestamps?.context_collected_at ?? nowIso(),
        worktree_prepared_at: nextState.run_timestamps?.worktree_prepared_at ?? nowIso()
      };
      changed = true;
      syncNormalRunProjectionFromState({
        state: nextState,
        run: executionContext.run,
        attempt: executionContext.attempt,
        workerKey: executionContext.worker_key,
        workerSelection
      });
    } else {
      nextState.last_error = null;
      syncBenchmarkingProjection({
        run: executionContext.run,
        attempt: executionContext.attempt,
        integrity
      });
      changed = true;
    }

    executionContext.run.kpi_projection = buildRunKpiProjection(executionContext.run);
    const priorContractRevision = executionContext.run.contract_revision;
    const executionContract = await writeExecutionContract({
      paths: artifactPaths,
      run: executionContext.run,
      contract: buildExecutionContract({
        paths: artifactPaths,
        state: nextState,
        input,
        setup,
        integrity,
        workerSelection,
        run: executionContext.run,
        attempt: executionContext.attempt,
        workerKey: executionContext.worker_key,
        verificationPlanState
      })
    });
    let runProjectionPath = await writeRunProjection({
      paths: artifactPaths,
      run: executionContext.run,
      state: nextState
    });

    if (executionContext.created_run) {
      await appendExecutionAuditEvent({
        paths: artifactPaths,
        state: nextState,
        run: executionContext.run,
        attempt: executionContext.attempt,
        eventType: "run-initialized",
        payload: {
          note: "Created a new " + input.runMode + " execution run.",
          execution_contract_path: executionContract.artifacts.execution_contract_path
        }
      });
      await appendExecutionAuditEvent({
        paths: artifactPaths,
        state: nextState,
        run: executionContext.run,
        attempt: executionContext.attempt,
        eventType: "attempt-started",
        payload: {
          note: "Created the first attempt for this execution run."
        }
      });
      await appendExecutionAuditEvent({
        paths: artifactPaths,
        state: nextState,
        run: executionContext.run,
        attempt: executionContext.attempt,
        eventType: "worker-bound",
        payload: {
          worker_id: executionContext.worker_key,
          worker_binding: executionContext.attempt.worker_bindings?.[executionContext.worker_key] ?? null
        }
      });
    }
    if (executionContext.created_run || executionContract.contract_revision !== priorContractRevision) {
      await appendExecutionAuditEvent({
        paths: artifactPaths,
        state: nextState,
        run: executionContext.run,
        attempt: executionContext.attempt,
        eventType: "contract-materialized",
        payload: {
          contract_revision: executionContract.contract_revision,
          execution_contract_path: executionContract.artifacts.execution_contract_path
        }
      });
    }
    runProjectionPath = await writeRunProjection({
      paths: artifactPaths,
      run: executionContext.run,
      state: nextState
    });

    nextState.artifacts = {
      ...(nextState.artifacts ?? {}),
      readme_path: normalizeSlashes(artifactPaths.readmePath),
      context_path: normalizeSlashes(artifactPaths.contextPath),
      state_path: normalizeSlashes(artifactPaths.statePath),
      contract_path: normalizeSlashes(artifactPaths.contractPath),
      execution_contract_path: executionContract.artifacts.execution_contract_path,
      execution_run_contract_path: executionContract.artifacts.run_contract_path,
      execution_run_projection_path: runProjectionPath,
      pushback_path: normalizeSlashes(artifactPaths.pushbackPath),
      brief_path: normalizeSlashes(artifactPaths.briefPath),
      completion_summary_path: normalizeSlashes(artifactPaths.completionSummaryPath),
      implementation_run_dir: normalizeSlashes(artifactPaths.implementationRunDir),
      worktree_path: nextState.worktree_path ?? normalizeSlashes(resolveFeatureWorktreePath(paths))
    };

    if (changed) {
      nextState.updated_at = nowIso();
      await writeJsonAtomic(artifactPaths.statePath, nextState);
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
      requiredAccessMode,
      workerSelection,
      executionContract,
      executionRun: executionContext.run,
      executionAttempt: executionContext.attempt,
      verificationPlanState,
      artifactRootKind,
      worktreeResult: worktree
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
    featureLockResult.integrity.blocking_issues.length === 0 && setup.complete && input.runMode === "normal"
  );
  const featureRunnable = state.feature_status === "active";
  const nextAction = determineNextAction({
    setupComplete: setup.complete,
    featureStatus: state.feature_status,
    integrity: featureLockResult.integrity,
    executionAction,
    runMode: input.runMode
  });

  // Resolve the artifact root used for this prepare (worktree or project)
  const resultArtifactRootKind = featureLockResult.artifactRootKind ?? "project";
  const resultWorktreeResult = featureLockResult.worktreeResult ?? null;
  const resultArtifactPaths = resultArtifactRootKind === "worktree" && resultWorktreeResult?.worktree_path
    ? buildPaths(resultWorktreeResult.worktree_path, input.phaseNumber, input.featureSlug)
    : paths;

  return {
    command: "prepare",
    project_root: input.projectRoot,
    phase_number: input.phaseNumber,
    feature_slug: input.featureSlug,
    feature_root: normalizeSlashes(resultArtifactPaths.featureRoot),
    artifact_root: normalizeSlashes(resultArtifactPaths.featureRoot),
    artifact_root_kind: resultArtifactRootKind,
    worktree_path: resultWorktreeResult?.worktree_path ?? state.worktree_path ?? null,
    skill_state_root: normalizeSlashes(paths.skillStateRoot),
    worktrees_root: normalizeSlashes(paths.worktreesRoot),
    setup_path: normalizeSlashes(paths.setupPath),
    registry_path: normalizeSlashes(paths.registryPath),
    features_index_path: normalizeSlashes(paths.featuresIndexPath),
    templates_root: normalizeSlashes(paths.templatesRoot),
    references_root: normalizeSlashes(paths.referencesRoot),
    state_path: normalizeSlashes(resultArtifactPaths.statePath),
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
    run_mode: input.runMode,
    run_allowed: featureRunnable && featureLockResult.integrity.blocking_issues.length === 0 && input.runMode === "normal",
    benchmark_contract_ready: input.runMode === "benchmarking" && featureLockResult.integrity.blocking_issues.length === 0,
    current_branch: state.current_branch ?? null,
    active_run_status: state.active_run_status ?? null,
    last_completed_step: state.last_completed_step ?? null,
    worktree: {
      base_branch: state.base_branch ?? null,
      feature_branch: state.feature_branch ?? null,
      worktree_path: state.worktree_path ?? null,
      worktree_status: state.worktree_status ?? null
    },
    merge_lifecycle: {
      merge_required: state.merge_required ?? false,
      merge_status: state.merge_status ?? null,
      approved_commit_sha: state.approved_commit_sha ?? null,
      merge_commit_sha: state.merge_commit_sha ?? null,
      merge_queue_request_id: state.merge_queue_request_id ?? null,
      local_target_sync_status: state.local_target_sync_status ?? null
    },
    implementor_lane: {
      execution_id: state.implementor_execution_id ?? null,
      execution_access_mode: featureLockResult.workerSelection.resolved.access_mode ?? state.implementor_execution_access_mode ?? null,
      execution_runtime: featureLockResult.workerSelection.resolved.runtime ?? state.implementor_execution_runtime ?? null,
      provider: featureLockResult.workerSelection.resolved.provider ?? state.implementor_provider ?? null,
      model: featureLockResult.workerSelection.resolved.model ?? state.implementor_model ?? settingsSummary.summary.preferred_implementor_model,
      reasoning_effort: sanitizeWorkerReasoningEffort(
        featureLockResult.workerSelection.resolved.reasoning_effort
          ?? state.implementor_reasoning_effort
          ?? settingsSummary.summary.preferred_implementor_reasoning_effort,
        featureLockResult.workerSelection.resolved.provider ?? state.implementor_provider ?? null,
        featureLockResult.workerSelection.resolved.runtime ?? state.implementor_execution_runtime ?? null
      ),
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
    execution_contract: featureLockResult.executionContract,
    execution_projection: {
      run_id: featureLockResult.executionRun.run_id,
      attempt_id: featureLockResult.executionAttempt.attempt_id,
      run_mode: featureLockResult.executionRun.run_mode,
      lifecycle_status: featureLockResult.executionRun.lifecycle_status,
      execution_contract_path: featureLockResult.executionContract.artifacts.execution_contract_path,
      run_contract_path: featureLockResult.executionContract.artifacts.run_contract_path,
      run_projection_path: featureLockResult.executionContract.artifacts.run_projection_path,
      benchmark_context: featureLockResult.executionRun.benchmark_context,
      current_attempt_status: featureLockResult.executionAttempt.status,
      resume_checkpoint: featureLockResult.executionAttempt.resume_checkpoint,
      verification_plan_state: featureLockResult.verificationPlanState,
      kpi: featureLockResult.executionRun.kpi_projection
    },
    context_input_pack: featureLockResult.inputPack,
    integrity_precheck: featureLockResult.integrity,
    detected_status_summary: {
      detected_project_root: input.projectRoot,
      detected_feature_root: normalizeSlashes(resultArtifactPaths.featureRoot),
      artifact_root_kind: resultArtifactRootKind,
      feature_status: state.feature_status,
      active_run_status: state.active_run_status,
      base_branch: state.base_branch ?? null,
      feature_branch: state.feature_branch ?? null,
      worktree_path: state.worktree_path ?? null,
      worktree_status: state.worktree_status ?? null,
      merge_status: state.merge_status ?? null,
      setup_status: setup.complete ? "ready" : setup.exists ? "invalid" : "missing",
      execution_run_id: featureLockResult.executionRun.run_id,
      execution_attempt_id: featureLockResult.executionAttempt.attempt_id,
      execution_run_mode: featureLockResult.executionRun.run_mode,
      implementor_execution_id: state.implementor_execution_id ?? null,
      implementor_access_mode: featureLockResult.requiredAccessMode,
      implementor_runtime: featureLockResult.workerSelection.resolved.runtime ?? setup.data.preferred_execution_runtime ?? null,
      recreate_due_to_weaker_access: featureLockResult.recreateDueToWeakerAccess,
      post_review_handoff_enabled: input.postSendToReview,
      review_until_complete: input.postSendToReview ? input.reviewUntilComplete : false,
      effective_review_max_cycles: input.postSendToReview && input.reviewUntilComplete ? (input.reviewMaxCycles ?? 5) : null,
      next_action: nextAction
    },
    available_workers: featureLockResult.workerSelection.available_workers ?? [],
    current_settings_summary: settingsSummary.summary,
    open_features_summary: summarizeFeatureSections(openFeatures.index)
  };
}

async function updateState(input) {
  const paths = buildPaths(input.projectRoot, input.phaseNumber, input.featureSlug);

  // Resolve worktree-aware artifact paths for state read/write
  const updateWorktreePath = normalizeSlashes(resolveFeatureWorktreePath(paths));
  const updateWorktreeExists = detectCurrentBranch(updateWorktreePath) !== null;
  const updateArtifactPaths = updateWorktreeExists
    ? buildPaths(updateWorktreePath, input.phaseNumber, input.featureSlug)
    : paths;

  const featureResult = await withLock(paths.featureLocksRoot, input.featureSlug, async () => {
    const currentBranch = detectCurrentBranch(input.projectRoot);

    // State loading: try worktree path first, fall back to main checkout for legacy
    let stateLoadPaths = updateArtifactPaths;
    if (updateWorktreeExists && !(await pathExists(updateArtifactPaths.statePath)) && (await pathExists(paths.statePath))) {
      stateLoadPaths = paths;
    }
    const existing = await loadOrInitializeState({ paths: stateLoadPaths, input, registryEntry: null, indexEntry: null, currentBranch });
    const next = { ...existing.state };
    const changedFields = [];

    if (input.implementorExecutionId !== undefined) {
      next.implementor_execution_id = emptyToNull(input.implementorExecutionId);
      changedFields.push("implementor_execution_id");
    }
    if (input.implementorExecutionAccessMode !== undefined) {
      next.implementor_execution_access_mode = parseOptionalAccessMode(input.implementorExecutionAccessMode, "implementor-execution-access-mode");
      changedFields.push("implementor_execution_access_mode");
    }
    if (input.implementorExecutionRuntime !== undefined) {
      next.implementor_execution_runtime = parseOptionalRuntime(input.implementorExecutionRuntime, "implementor-execution-runtime");
      changedFields.push("implementor_execution_runtime");
    }
    if (input.implementorProvider !== undefined) {
      next.implementor_provider = parseOptionalSafeToken(input.implementorProvider, "implementor-provider");
      changedFields.push("implementor_provider");
    }
    if (input.implementorModel !== undefined) {
      next.implementor_model = emptyToNull(input.implementorModel);
      changedFields.push("implementor_model");
    }
    if (input.implementorReasoningEffort !== undefined) {
      next.implementor_reasoning_effort = sanitizeWorkerReasoningEffort(
        input.implementorReasoningEffort,
        next.implementor_provider,
        next.implementor_execution_runtime
      );
      changedFields.push("implementor_reasoning_effort");
    }
    if (input.resolvedRuntimePermissionModel !== undefined) {
      next.resolved_runtime_permission_model = parseOptionalPermissionModel(input.resolvedRuntimePermissionModel, "resolved-runtime-permission-model");
      changedFields.push("resolved_runtime_permission_model");
    }
    if (input.featureStatus !== undefined) {
      next.feature_status = parseOptionalFeatureStatus(input.featureStatus, "feature-status") ?? next.feature_status;
      changedFields.push("feature_status");
    }
    if (input.currentBranch !== undefined) {
      next.current_branch = emptyToNull(input.currentBranch);
      changedFields.push("current_branch");
    }
    if (input.baseBranch !== undefined) {
      next.base_branch = emptyToNull(input.baseBranch);
      changedFields.push("base_branch");
    }
    if (input.featureBranch !== undefined) {
      next.feature_branch = emptyToNull(input.featureBranch);
      changedFields.push("feature_branch");
    }
    if (input.worktreePath !== undefined) {
      next.worktree_path = emptyToNull(input.worktreePath);
      changedFields.push("worktree_path");
    }
    if (input.worktreeStatus !== undefined) {
      next.worktree_status = parseOptionalWorktreeStatus(input.worktreeStatus, "worktree-status") ?? next.worktree_status;
      changedFields.push("worktree_status");
    }
    if (input.mergeRequired !== undefined) {
      next.merge_required = parseOptionalBooleanInput(input.mergeRequired, "merge-required") ?? next.merge_required;
      changedFields.push("merge_required");
    }
    if (input.mergeStatus !== undefined) {
      next.merge_status = parseOptionalMergeStatus(input.mergeStatus, "merge-status") ?? next.merge_status;
      changedFields.push("merge_status");
    }
    if (input.approvedCommitSha !== undefined) {
      next.approved_commit_sha = emptyToNull(input.approvedCommitSha);
      changedFields.push("approved_commit_sha");
    }
    if (input.mergeCommitSha !== undefined) {
      next.merge_commit_sha = emptyToNull(input.mergeCommitSha);
      changedFields.push("merge_commit_sha");
    }
    if (input.mergeQueueRequestId !== undefined) {
      next.merge_queue_request_id = emptyToNull(input.mergeQueueRequestId);
      changedFields.push("merge_queue_request_id");
    }
    if (input.localTargetSyncStatus !== undefined) {
      next.local_target_sync_status = parseOptionalLocalTargetSyncStatus(input.localTargetSyncStatus, "local-target-sync-status") ?? next.local_target_sync_status;
      changedFields.push("local_target_sync_status");
    }
    if (input.lastCompletedStep !== undefined) {
      next.last_completed_step = emptyToNull(input.lastCompletedStep);
      changedFields.push("last_completed_step");
    }
    if (input.lastCommitSha !== undefined) {
      next.last_commit_sha = emptyToNull(input.lastCommitSha);
      changedFields.push("last_commit_sha");
    }
    if (input.activeRunStatus !== undefined) {
      next.active_run_status = parseOptionalActiveRunStatus(input.activeRunStatus, "active-run-status") ?? next.active_run_status;
      changedFields.push("active_run_status");
    }
    if (input.lastError !== undefined) {
      next.last_error = emptyToNull(input.lastError);
      changedFields.push("last_error");
    }
    if (input.capabilityPairs.length > 0) {
      next.resolved_runtime_capabilities = {
        ...(next.resolved_runtime_capabilities ?? {}),
        ...parseCapabilityPairs(input.capabilityPairs)
      };
      changedFields.push("resolved_runtime_capabilities");
    }

    const targetRun = resolveRunForMutation(next, input.runMode ?? "normal", input.runId ?? null);
    let targetAttempt = null;
    if (targetRun) {
      next.current_run_id = targetRun.run_id;
      targetAttempt = resolveAttemptForMutation(targetRun, input.attemptId ?? null);
      if (targetAttempt) {
        next.current_attempt_id = targetAttempt.attempt_id;
        const workerKey = targetRun.worker_keys?.[0] ?? buildWorkerKey("implementor", targetRun.benchmark_context?.lane_id ?? null);
        targetRun.worker_keys = [workerKey];
        targetAttempt.worker_bindings = isPlainObject(targetAttempt.worker_bindings) ? targetAttempt.worker_bindings : {};
        targetAttempt.worker_bindings[workerKey] = {
          ...(targetAttempt.worker_bindings?.[workerKey] ?? buildWorkerBinding(workerKey, {
            resolved: {
              provider: next.implementor_provider ?? null,
              runtime: next.implementor_execution_runtime ?? null,
              access_mode: next.implementor_execution_access_mode ?? null,
              model: next.implementor_model ?? null,
              reasoning_effort: next.implementor_reasoning_effort ?? null
            },
            overrides: { provider: null, runtime: null, access_mode: null, model: null, reasoning_effort: null },
            resolved_sources: {
              provider: "persisted_continuity",
              runtime: "persisted_continuity",
              access_mode: "persisted_continuity",
              model: "persisted_continuity",
              reasoning_effort: "persisted_continuity"
            }
          })),
          provider: next.implementor_provider ?? null,
          runtime: next.implementor_execution_runtime ?? null,
          access_mode: next.implementor_execution_access_mode ?? null,
          model: next.implementor_model ?? null,
          reasoning_effort: next.implementor_reasoning_effort ?? null,
          execution_id: next.implementor_execution_id ?? null
        };
        if (targetRun.run_mode === "normal") {
          syncNormalRunProjectionFromState({
            state: next,
            run: targetRun,
            attempt: targetAttempt,
            workerKey,
            workerSelection: {
              resolved: {
                provider: next.implementor_provider ?? null,
                runtime: next.implementor_execution_runtime ?? null,
                access_mode: next.implementor_execution_access_mode ?? null,
                model: next.implementor_model ?? null,
                reasoning_effort: next.implementor_reasoning_effort ?? null
              }
            }
          });
        }
        targetRun.kpi_projection = buildRunKpiProjection(targetRun);
      }
    }

    next.updated_at = nowIso();
    const targetRunForEvent = targetRun ?? resolveRunForMutation(next, "normal", null);
    const targetAttemptForEvent = resolveAttemptForMutation(targetRunForEvent, input.attemptId ?? null);
    if (targetRunForEvent && targetAttemptForEvent && changedFields.length > 0) {
      await appendExecutionAuditEvent({
        paths: updateArtifactPaths,
        state: next,
        run: targetRunForEvent,
        attempt: targetAttemptForEvent,
        eventType: "state-patched",
        payload: {
          changed_fields: changedFields
        }
      });
    }
    if (targetRun?.run_mode === "normal" && targetAttempt) {
      await syncLiveNormalExecutionArtifacts({
        paths: updateArtifactPaths,
        state: next,
        run: targetRun,
        attempt: targetAttempt,
        workerKey: targetRun.worker_keys?.[0] ?? buildWorkerKey("implementor", targetRun.benchmark_context?.lane_id ?? null)
      });
    } else if (targetRun) {
      await writeRunProjection({
        paths: updateArtifactPaths,
        run: targetRun,
        state: next
      });
    }
    await writeJsonAtomic(updateArtifactPaths.statePath, next);
    return next;
  });

  await syncAgentRegistry(paths, featureResult);
  await syncFeaturesIndex(paths, featureResult);

  return {
    command: "update-state",
    project_root: input.projectRoot,
    state_path: normalizeSlashes(updateArtifactPaths.statePath),
    state: featureResult
  };
}

async function recordEvent(input) {
  if (!IMPLEMENT_PLAN_EVENTS.has(input.event) && !EXECUTION_EVENT_TYPES.has(input.event)) {
    fail("Unsupported event '" + input.event + "'.");
  }

  const paths = buildPaths(input.projectRoot, input.phaseNumber, input.featureSlug);
  const timestamp = input.timestamp ?? nowIso();
  const payload = await loadEventPayload(input.payloadFile);

  // Resolve worktree-aware artifact paths
  const eventWorktreePath = normalizeSlashes(resolveFeatureWorktreePath(paths));
  const eventWorktreeExists = detectCurrentBranch(eventWorktreePath) !== null;
  const eventArtifactPaths = eventWorktreeExists
    ? buildPaths(eventWorktreePath, input.phaseNumber, input.featureSlug)
    : paths;

  const state = await withLock(paths.featureLocksRoot, input.featureSlug, async () => {
    const currentBranch = detectCurrentBranch(input.projectRoot);

    let stateLoadPaths = eventArtifactPaths;
    if (eventWorktreeExists && !(await pathExists(eventArtifactPaths.statePath)) && (await pathExists(paths.statePath))) {
      stateLoadPaths = paths;
    }
    const existing = await loadOrInitializeState({ paths: stateLoadPaths, input, registryEntry: null, indexEntry: null, currentBranch });
    const next = { ...existing.state };
    next.run_timestamps = { ...(next.run_timestamps ?? {}) };

    const run = resolveRunForMutation(next, input.runMode ?? "normal", input.runId ?? null);
    const attempt = resolveAttemptForMutation(run, input.attemptId ?? null);
    if (EXECUTION_EVENT_TYPES.has(input.event)) {
      if (!run || !attempt) {
        fail("Structured execution events require an active run and attempt. Prepare the feature first or pass --run-id/--attempt-id.");
      }
      applyStructuredExecutionEvent({
        state: next,
        run,
        attempt,
        eventType: input.event,
        payload: {
          ...payload,
          role: input.role ?? payload.role ?? null,
          step: input.step ?? payload.step ?? null,
          status: input.stepStatus ?? payload.status ?? null,
          note: input.note ?? payload.note ?? null
        },
        occurredAt: timestamp
      });
      if (run.run_mode === "normal") {
        syncLegacyNormalStateFromRun({ state: next, run });
      }
      await appendExecutionAuditEvent({
        paths: eventArtifactPaths,
        state: next,
        run,
        attempt,
        eventType: input.event,
        payload: {
          ...payload,
          role: input.role ?? payload.role ?? null,
          step: input.step ?? payload.step ?? null,
          status: input.stepStatus ?? payload.status ?? null,
          note: input.note ?? payload.note ?? null
        },
        occurredAt: timestamp
      });
    } else {
      next.event_log = Array.isArray(next.event_log) ? [...next.event_log] : [];
      next.event_log.push({ event: input.event, timestamp, note: input.note ?? null });
      next.event_log = next.event_log.slice(-100);
      applyEventTransition(next, input.event, timestamp);
      if (run && attempt && run.run_mode === "normal") {
        syncNormalRunProjectionFromState({
          state: next,
          run,
          attempt,
          workerKey: run.worker_keys?.[0] ?? buildWorkerKey("implementor", run.benchmark_context?.lane_id ?? null),
          workerSelection: {
            resolved: {
              provider: next.implementor_provider ?? null,
              runtime: next.implementor_execution_runtime ?? null,
              access_mode: next.implementor_execution_access_mode ?? null,
              model: next.implementor_model ?? null,
              reasoning_effort: next.implementor_reasoning_effort ?? null
            }
          }
        });
        run.kpi_projection = buildRunKpiProjection(run);
        await appendExecutionAuditEvent({
          paths: eventArtifactPaths,
          state: next,
          run,
          attempt,
          eventType: "step-transition",
          payload: {
            step: legacyLastCompletedStepToResumeStep(next.last_completed_step, next.active_run_status, next.merge_status),
            status: next.active_run_status === "implementation_running" ? "in_progress" : next.active_run_status === "completed" ? "completed" : "ready",
            note: input.note ?? ("Legacy event mirrored into the execution projection: " + input.event + ".")
          },
          occurredAt: timestamp
        });
      }
    }

    if (input.lastCommitSha) {
      next.last_commit_sha = input.lastCommitSha;
    }
    if (input.currentBranch) {
      next.current_branch = input.currentBranch;
    }
    next.updated_at = nowIso();
    if (run?.run_mode === "normal" && attempt) {
      await syncLiveNormalExecutionArtifacts({
        paths: eventArtifactPaths,
        state: next,
        run,
        attempt,
        workerKey: run.worker_keys?.[0] ?? buildWorkerKey("implementor", run.benchmark_context?.lane_id ?? null)
      });
    } else if (run) {
      await writeRunProjection({
        paths: eventArtifactPaths,
        run,
        state: next
      });
    }
    await writeJsonAtomic(eventArtifactPaths.statePath, next);
    return next;
  });

  await syncAgentRegistry(paths, state);
  await syncFeaturesIndex(paths, state);

  return {
    command: "record-event",
    project_root: input.projectRoot,
    feature_root: normalizeSlashes(eventArtifactPaths.featureRoot),
    event: input.event,
    timestamp,
    state
  };
}

async function resetAttempt(input) {
  const paths = buildPaths(input.projectRoot, input.phaseNumber, input.featureSlug);
  const timestamp = nowIso();

  // Resolve worktree-aware artifact paths
  const resetWorktreePath = normalizeSlashes(resolveFeatureWorktreePath(paths));
  const resetWorktreeExists = detectCurrentBranch(resetWorktreePath) !== null;
  const resetArtifactPaths = resetWorktreeExists
    ? buildPaths(resetWorktreePath, input.phaseNumber, input.featureSlug)
    : paths;

  const result = await withLock(paths.featureLocksRoot, input.featureSlug, async () => {
    const currentBranch = detectCurrentBranch(input.projectRoot);
    let stateLoadPaths = resetArtifactPaths;
    if (resetWorktreeExists && !(await pathExists(resetArtifactPaths.statePath)) && (await pathExists(paths.statePath))) {
      stateLoadPaths = paths;
    }
    const existing = await loadOrInitializeState({ paths: stateLoadPaths, input, registryEntry: null, indexEntry: null, currentBranch });
    const next = { ...existing.state };
    const run = resolveRunForMutation(next, input.runMode, input.runId);
    if (!run) {
      fail("No active execution run was found to reset for mode '" + input.runMode + "'.");
    }
    const currentAttempt = resolveAttemptForMutation(run, null);
    if (!currentAttempt) {
      fail("The active execution run does not contain a current attempt to reset.");
    }

    const nextAttemptNumber = Math.max(safeInteger(run.attempt_counter, 1), safeInteger(currentAttempt.attempt_number, 1)) + 1;
    const nextAttemptId = buildAttemptId(nextAttemptNumber);
    const nextAttempt = buildEmptyAttemptSummary(nextAttemptId, nextAttemptNumber);
    nextAttempt.reset_reason = input.note ?? "Administrative reset from the implementation boundary.";
    nextAttempt.started_at = timestamp;
    nextAttempt.updated_at = timestamp;
    nextAttempt.resume_checkpoint = {
      step: "implementation",
      status: "ready",
      reason: "Reset created a new attempt from the implementation boundary.",
      updated_at: timestamp
    };

    const workerKey = run.worker_keys?.[0] ?? buildWorkerKey("implementor", run.benchmark_context?.lane_id ?? null);
    const previousBinding = currentAttempt.worker_bindings?.[workerKey] ?? null;
    nextAttempt.worker_bindings[workerKey] = {
      ...(previousBinding ?? {}),
      execution_id: input.clearExecutionIdentity ? null : (previousBinding?.execution_id ?? next.implementor_execution_id ?? null),
      bound_at: timestamp
    };

    currentAttempt.status = "superseded";
    currentAttempt.terminal_status = "reset";
    currentAttempt.reset_at = timestamp;
    currentAttempt.superseded_by_attempt_id = nextAttemptId;
    currentAttempt.updated_at = timestamp;

    run.attempt_counter = nextAttemptNumber;
    run.current_attempt_id = nextAttemptId;
    run.attempts[nextAttemptId] = nextAttempt;
    run.lifecycle_status = run.run_mode === "benchmarking" ? "supervisor_deferred" : "active";
    run.terminal_status = null;
    run.updated_at = timestamp;
    run.kpi_projection = buildRunKpiProjection(run);

    next.current_run_id = run.run_id;
    next.current_attempt_id = nextAttemptId;

    if (input.clearExecutionIdentity) {
      next.implementor_execution_id = null;
    }

    if (run.run_mode === "normal") {
      next.approved_commit_sha = null;
      next.merge_commit_sha = null;
      next.merge_queue_request_id = null;
      next.merge_status = "not_ready";
      next.local_target_sync_status = "not_started";
      next.active_run_status = "brief_ready";
      next.last_completed_step = "attempt_reset";
      next.last_error = input.note ?? "Attempt reset requested.";
      next.run_timestamps = {
        context_collected_at: next.run_timestamps?.context_collected_at ?? null,
        worktree_prepared_at: next.run_timestamps?.worktree_prepared_at ?? null
      };
    }

    const artifactPaths = buildArtifactPaths(resetArtifactPaths, next);
    for (const contractPath of [resetArtifactPaths.executionContractPath, resolveRunContractPath(resetArtifactPaths, run.run_id)]) {
      if (!(await pathExists(contractPath))) {
        continue;
      }
      try {
        const contract = await readJson(contractPath);
        const updatedContract = {
          ...contract,
          contract_revision: Math.max(safeInteger(contract.contract_revision, 1), 1) + 1,
          prepared_at: timestamp,
          run_identity: {
            ...(contract.run_identity ?? {}),
            attempt_id: nextAttemptId,
            attempt_number: nextAttemptNumber
          },
          artifacts: {
            ...(contract.artifacts ?? {}),
            execution_contract_path: normalizeSlashes(artifactPaths.executionContractPath),
            run_contract_path: normalizeSlashes(resolveRunContractPath(artifactPaths, run.run_id)),
            run_projection_path: normalizeSlashes(resolveRunProjectionPath(artifactPaths, run.run_id)),
            event_root: normalizeSlashes(resolveAttemptEventsRoot(artifactPaths, run.run_id, nextAttemptId))
          },
          resume_policy: {
            ...(contract.resume_policy ?? {}),
            last_truthful_checkpoint: nextAttempt.resume_checkpoint
          },
          reset_policy: {
            ...(contract.reset_policy ?? {}),
            next_attempt_number: nextAttemptNumber + 1
          }
        };
        await writeJsonAtomic(contractPath, updatedContract);
      } catch {
        // Keep reset durable even if the prior contract file is malformed.
      }
    }

    await appendExecutionAuditEvent({
      paths: resetArtifactPaths,
      state: next,
      run,
      attempt: nextAttempt,
      eventType: "attempt-reset",
      payload: {
        previous_attempt_id: currentAttempt.attempt_id,
        next_attempt_id: nextAttemptId,
        note: input.note ?? "Reset created a new attempt from implementation."
      },
      occurredAt: timestamp
    });

    await writeRunProjection({
      paths: resetArtifactPaths,
      run,
      state: next
    });
    next.updated_at = timestamp;
    await writeJsonAtomic(resetArtifactPaths.statePath, next);
    return {
      state: next,
      run,
      attempt: nextAttempt
    };
  });

  await syncAgentRegistry(paths, result.state);
  await syncFeaturesIndex(paths, result.state);

  return {
    command: "reset-attempt",
    project_root: input.projectRoot,
    feature_root: normalizeSlashes(resetArtifactPaths.featureRoot),
    state_path: normalizeSlashes(resetArtifactPaths.statePath),
    run_id: result.run.run_id,
    attempt_id: result.attempt.attempt_id,
    run_mode: result.run.run_mode,
    state: result.state
  };
}

async function markComplete(input) {
  const paths = buildPaths(input.projectRoot, input.phaseNumber, input.featureSlug);

  // Resolve worktree-aware artifact paths
  const completeWorktreePath = normalizeSlashes(resolveFeatureWorktreePath(paths));
  const completeWorktreeExists = detectCurrentBranch(completeWorktreePath) !== null;
  const completeArtifactPaths = completeWorktreeExists
    ? buildPaths(completeWorktreePath, input.phaseNumber, input.featureSlug)
    : paths;

  const completionText = await readTextIfExists(completeArtifactPaths.completionSummaryPath);
  const completionValidation = completionText
    ? validateHeadingContract(completionText, COMPLETION_HEADINGS)
    : { valid: false, error: "completion-summary.md is missing." };

  const state = await withLock(paths.featureLocksRoot, input.featureSlug, async () => {
    const currentBranch = detectCurrentBranch(input.projectRoot);
    let stateLoadPaths = completeArtifactPaths;
    if (completeWorktreeExists && !(await pathExists(completeArtifactPaths.statePath)) && (await pathExists(paths.statePath))) {
      stateLoadPaths = paths;
    }
    const existing = await loadOrInitializeState({ paths: stateLoadPaths, input, registryEntry: null, indexEntry: null, currentBranch });
    const next = { ...existing.state };
    const timestamp = nowIso();
    const alreadyCompleted = next.feature_status === "completed" && next.active_run_status === "completed";

    const commitSha = input.lastCommitSha ?? next.last_commit_sha ?? null;
    if (!commitSha) {
      fail("Refusing to mark complete without last_commit_sha evidence.");
    }
    if (!completionValidation.valid) {
      fail("Refusing to mark complete because completion-summary.md is missing or invalid: " + completionValidation.error);
    }
    if (next.merge_required === true && next.merge_status !== "merged") {
      fail("Refusing to mark complete because merge_status is '" + (next.merge_status ?? "unknown") + "' instead of 'merged'.");
    }
    if (!hasRecordedLocalTargetSyncStatus(next.local_target_sync_status)) {
      fail("Refusing to mark complete because local_target_sync_status is '" + (next.local_target_sync_status ?? "unknown") + "'. A recorded local target sync outcome is required before completion.");
    }

    next.feature_status = "completed";
    next.active_run_status = "completed";
    next.last_completed_step = "marked_complete";
    next.last_commit_sha = commitSha;
    next.run_timestamps = {
      ...(next.run_timestamps ?? {}),
      merge_finished_at: next.run_timestamps?.merge_finished_at ?? timestamp,
      closeout_finished_at: next.run_timestamps?.closeout_finished_at ?? timestamp
    };
    next.last_error = null;
    next.updated_at = timestamp;

    const run = resolveRunForMutation(next, "normal", null);
    const attempt = resolveAttemptForMutation(run, null);
    if (run && attempt) {
      syncNormalRunProjectionFromState({
        state: next,
        run,
        attempt,
        workerKey: run.worker_keys?.[0] ?? buildWorkerKey("implementor", run.benchmark_context?.lane_id ?? null),
        workerSelection: {
          resolved: {
            provider: next.implementor_provider ?? null,
            runtime: next.implementor_execution_runtime ?? null,
            access_mode: next.implementor_execution_access_mode ?? null,
            model: next.implementor_model ?? null,
            reasoning_effort: next.implementor_reasoning_effort ?? null
          }
        }
      });
      if (!alreadyCompleted) {
        applyStructuredExecutionEvent({
          state: next,
          run,
          attempt,
          eventType: "terminal-status-recorded",
          payload: {
            terminal_status: "completed",
            step: "merge_queue",
            note: input.completionNote ?? "Feature completion was recorded after truthful merge success."
          },
          occurredAt: timestamp
        });
        await appendExecutionAuditEvent({
          paths: completeArtifactPaths,
          state: next,
          run,
          attempt,
          eventType: "terminal-status-recorded",
          payload: {
            terminal_status: "completed",
            step: "merge_queue",
            note: input.completionNote ?? "Feature completion was recorded after truthful merge success."
          },
          occurredAt: timestamp
        });
      }
      await syncLiveNormalExecutionArtifacts({
        paths: completeArtifactPaths,
        state: next,
        run,
        attempt,
        workerKey: run.worker_keys?.[0] ?? buildWorkerKey("implementor", run.benchmark_context?.lane_id ?? null)
      });
    }

    await writeTextAtomic(
      completeArtifactPaths.completionSummaryPath,
      await finalizeCompletionSummary({
        paths: completeArtifactPaths,
        state: next,
        existingText: completionText,
        mergeCommitSha: next.merge_commit_sha ?? commitSha,
        completionNote: input.completionNote ?? null
      })
    );

    await writeJsonAtomic(completeArtifactPaths.statePath, next);
    return next;
  });

  await syncFeaturesIndex(paths, state);
  await syncAgentRegistry(paths, state);

  return {
    command: "mark-complete",
    project_root: input.projectRoot,
    feature_root: normalizeSlashes(completeArtifactPaths.featureRoot),
    completion_summary_path: normalizeSlashes(completeArtifactPaths.completionSummaryPath),
    last_commit_sha: state.last_commit_sha,
    feature_status: state.feature_status,
    active_run_status: state.active_run_status,
    current_run_id: state.current_run_id ?? null,
    current_attempt_id: state.current_attempt_id ?? null
  };
}

async function finalizeCompletionSummary({ paths, state, existingText, mergeCommitSha, completionNote }) {
  const sections = extractCompletionSections(existingText);
  const reviewState = await loadJsonIfExists(join(paths.featureRoot, "review-cycle-state.json"));
  const objectiveSection = normalizeSection(
    buildFinalObjectiveSection({
      existingSection: sections["1. Objective Completed"],
      reviewState,
      mergeCommitSha
    })
  );
  const deliverablesSection = normalizeSection(
    buildFinalDeliverablesSection({
      existingSection: sections["2. Deliverables Produced"]
    })
  );
  const verificationSection = normalizeSection(
    buildFinalVerificationSection({
      existingSection: sections["4. Verification Evidence"],
      state,
      reviewState,
      mergeCommitSha
    })
  );
  const artifactsSection = normalizeSection(
    buildFinalArtifactsSection({
      existingSection: sections["5. Feature Artifacts Updated"],
      paths
    })
  );
  const commitSection = normalizeSection(
    buildFinalCommitSection({
      state,
      mergeCommitSha,
      completionNote
    })
  );
  const debtSection = normalizeSection(
    buildFinalDebtSection({
      existingSection: sections["7. Remaining Non-Goals / Debt"],
      state
    })
  );

  const resolvedSections = {
    "1. Objective Completed": objectiveSection,
    "2. Deliverables Produced": deliverablesSection,
    "3. Files Changed And Why": normalizeSection(sections["3. Files Changed And Why"] || "- See the committed feature diff for the final changed-file set."),
    "4. Verification Evidence": verificationSection,
    "5. Feature Artifacts Updated": artifactsSection,
    "6. Commit And Push Result": commitSection,
    "7. Remaining Non-Goals / Debt": debtSection
  };

  return COMPLETION_HEADINGS
    .map((heading) => heading + "\n\n" + resolvedSections[heading])
    .join("\n\n");
}

function buildFinalObjectiveSection({ existingSection, reviewState, mergeCommitSha }) {
  const preservedLines = filterSectionLines(existingSection, [
    /implementor lane/i,
    /without .*review-cycle.*merge-queue/i,
    /review-cycle.*not run/i,
    /merge-queue.*not run/i
  ]);
  const lines = uniqueLines([
    ...preservedLines,
    "- Repo-owned completion truth now matches the approved review and merged feature lifecycle.",
    "- Final closeout reflects " + buildReviewCycleStatusSummary(reviewState) + " and merge commit " + (mergeCommitSha ?? "unknown") + "."
  ]);
  return lines.join("\n");
}

function buildFinalDeliverablesSection({ existingSection }) {
  const preservedLines = filterSectionLines(existingSection, [
    /governed implementor-lane closeout/i,
    /without running review-cycle or merge-queue/i
  ]);
  const lines = uniqueLines([
    ...preservedLines,
    "- Reconciled the repo-owned completion artifacts to canonical main-root paths and merged closeout truth."
  ]);
  return lines.join("\n");
}

async function buildCompletionSummary(input) {
  const paths = buildPaths(input.projectRoot, input.phaseNumber, input.featureSlug);
  const state = await loadStateIfExists(paths.statePath);
  if (!state) {
    fail("implement-plan-state.json does not exist for this feature stream.");
  }

  const executionTracking = normalizeExecutionRunsState({ state, paths });
  state.execution_runs = executionTracking.execution_runs;
  const activeNormalRun = findActiveExecutionRun(state, "normal");
  const activeAttempt = activeNormalRun?.attempts?.[activeNormalRun.current_attempt_id] ?? null;

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
    worktree: {
      base_branch: state.base_branch ?? null,
      feature_branch: state.feature_branch ?? null,
      worktree_path: state.worktree_path ?? null,
      worktree_status: state.worktree_status ?? null
    },
    merge_lifecycle: {
      merge_required: state.merge_required ?? false,
      merge_status: state.merge_status ?? null,
      approved_commit_sha: state.approved_commit_sha ?? null,
      merge_commit_sha: state.merge_commit_sha ?? null,
      merge_queue_request_id: state.merge_queue_request_id ?? null,
      local_target_sync_status: state.local_target_sync_status ?? null
    },
    execution: activeNormalRun ? {
      run_id: activeNormalRun.run_id,
      attempt_id: activeAttempt?.attempt_id ?? null,
      lifecycle_status: activeNormalRun.lifecycle_status,
      terminal_status: activeNormalRun.terminal_status ?? null,
      execution_contract_path: state.artifacts?.execution_contract_path ?? normalizeSlashes(paths.executionContractPath),
      run_contract_path: activeNormalRun.contract_path ?? normalizeSlashes(resolveRunContractPath(paths, activeNormalRun.run_id)),
      run_projection_path: activeNormalRun.projection_path ?? normalizeSlashes(resolveRunProjectionPath(paths, activeNormalRun.run_id)),
      resume_checkpoint: activeAttempt?.resume_checkpoint ?? null,
      kpi: activeNormalRun.kpi_projection ?? buildRunKpiProjection(activeNormalRun)
    } : null,
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
          merge_status: extractLabeledValue(verificationSection, "Merge Status"),
          local_target_sync_status: extractLabeledValue(verificationSection, "Local Target Sync Status"),
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
          merge_status: null,
          local_target_sync_status: null,
          remaining_debt: []
        }
  };
}

async function normalizeCompletionSummary(input) {
  const paths = buildPaths(input.projectRoot, input.phaseNumber, input.featureSlug);

  const worktreePath = normalizeSlashes(resolveFeatureWorktreePath(paths));
  const worktreeExists = detectCurrentBranch(worktreePath) !== null;
  const artifactPaths = worktreeExists
    ? buildPaths(worktreePath, input.phaseNumber, input.featureSlug)
    : paths;

  const existingText = await readTextIfExists(artifactPaths.completionSummaryPath);
  if (!existingText) {
    fail("Cannot normalize completion-summary.md because the file does not exist at " + artifactPaths.completionSummaryPath);
  }

  const preValidation = validateHeadingContract(existingText, COMPLETION_HEADINGS);
  if (preValidation.valid) {
    return {
      command: "normalize-completion-summary",
      project_root: input.projectRoot,
      feature_root: normalizeSlashes(artifactPaths.featureRoot),
      completion_summary_path: normalizeSlashes(artifactPaths.completionSummaryPath),
      already_valid: true,
      normalized: false,
      validation: preValidation
    };
  }

  let stateLoadPaths = artifactPaths;
  if (worktreeExists && !(await pathExists(artifactPaths.statePath)) && (await pathExists(paths.statePath))) {
    stateLoadPaths = paths;
  }
  const state = await loadStateIfExists(stateLoadPaths.statePath);
  if (!state) {
    fail("Cannot normalize completion-summary.md because implement-plan-state.json does not exist.");
  }

  const normalizedText = await finalizeCompletionSummary({
    paths: artifactPaths,
    state,
    existingText,
    mergeCommitSha: state.merge_commit_sha ?? state.last_commit_sha ?? null,
    completionNote: null
  });

  await writeTextAtomic(artifactPaths.completionSummaryPath, normalizedText);

  const postValidation = validateHeadingContract(normalizedText, COMPLETION_HEADINGS);

  return {
    command: "normalize-completion-summary",
    project_root: input.projectRoot,
    feature_root: normalizeSlashes(artifactPaths.featureRoot),
    completion_summary_path: normalizeSlashes(artifactPaths.completionSummaryPath),
    already_valid: false,
    normalized: true,
    validation: postValidation
  };
}

async function validateCloseoutReadiness(input) {
  const paths = buildPaths(input.projectRoot, input.phaseNumber, input.featureSlug);

  const worktreePath = normalizeSlashes(resolveFeatureWorktreePath(paths));
  const worktreeExists = detectCurrentBranch(worktreePath) !== null;
  const artifactPaths = worktreeExists
    ? buildPaths(worktreePath, input.phaseNumber, input.featureSlug)
    : paths;

  const completionText = await readTextIfExists(artifactPaths.completionSummaryPath);
  const completionValidation = completionText
    ? validateHeadingContract(completionText, COMPLETION_HEADINGS)
    : { valid: false, error: "completion-summary.md is missing." };

  let stateLoadPaths = artifactPaths;
  if (worktreeExists && !(await pathExists(artifactPaths.statePath)) && (await pathExists(paths.statePath))) {
    stateLoadPaths = paths;
  }
  const state = await loadStateIfExists(stateLoadPaths.statePath);

  const blockers = [];

  if (!completionValidation.valid) {
    blockers.push("completion-summary.md is missing or invalid: " + completionValidation.error);
  }

  if (!state) {
    blockers.push("implement-plan-state.json does not exist for this feature stream.");
  } else {
    if (state.feature_status === "completed") {
      blockers.push("Feature is already marked completed.");
    }
    const commitSha = state.last_commit_sha ?? null;
    if (!commitSha) {
      blockers.push("No last_commit_sha evidence in feature state.");
    }
  }

  const ready = blockers.length === 0;

  return {
    command: "validate-closeout-readiness",
    project_root: input.projectRoot,
    feature_root: normalizeSlashes(artifactPaths.featureRoot),
    completion_summary_path: normalizeSlashes(artifactPaths.completionSummaryPath),
    closeout_ready: ready,
    blockers: blockers.length > 0 ? blockers : null,
    completion_summary_valid: completionValidation.valid,
    completion_summary_error: completionValidation.error
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
    worktreesRoot: join(skillStateRoot, "worktrees"),
    registryKey: buildFeatureRegistryKey(phaseNumber, featureSlug),
    readmePath: join(featureRoot, "README.md"),
    contextPath: join(featureRoot, "context.md"),
    statePath: join(featureRoot, "implement-plan-state.json"),
    contractPath: join(featureRoot, "implement-plan-contract.md"),
    executionContractPath: join(featureRoot, "implement-plan-execution-contract.v1.json"),
    pushbackPath: join(featureRoot, "implement-plan-pushback.md"),
    briefPath: join(featureRoot, "implement-plan-brief.md"),
    completionSummaryPath: join(featureRoot, "completion-summary.md"),
    implementationRunDir: join(featureRoot, "implementation-run"),
    templatesRoot: normalizeSlashes(skillRoot),
    referencesRoot: normalizeSlashes(join(skillRoot, "references"))
  };
}

function normalizeOptionalProjectRoot(value) {
  const normalized = emptyToNull(value);
  return normalized ? normalizeProjectRoot(normalized) : null;
}

function resolveArtifactProjectRoot(paths, state, explicitProjectRoot = null) {
  const candidate = explicitProjectRoot
    ?? state?.project_root
    ?? paths.projectRoot;
  return normalizeProjectRoot(candidate);
}

function buildArtifactPaths(paths, state, explicitProjectRoot = null) {
  const artifactProjectRoot = resolveArtifactProjectRoot(paths, state, explicitProjectRoot);
  if (artifactProjectRoot === paths.projectRoot) {
    return paths;
  }
  return buildPaths(artifactProjectRoot, paths.phaseNumber, paths.featureSlug);
}

function buildFeatureBranchName(phaseNumber, featureSlug) {
  return "implement-plan/phase" + phaseNumber + "/" + featureSlug.replace(/\//g, "-");
}

function resolveFeatureWorktreePath(paths) {
  return join(
    paths.worktreesRoot,
    "phase" + paths.phaseNumber,
    ...paths.featureSlug.split("/").map((segment) => sanitizePathSegment(segment))
  );
}

function resolveBaseRef(projectRoot, baseBranch) {
  if (gitRefExists(projectRoot, "refs/remotes/origin/" + baseBranch)) {
    return "origin/" + baseBranch;
  }
  return baseBranch;
}

function ensureFeatureWorktree(paths, baseBranch, featureBranch, requestedPath) {
  const worktreePath = requestedPath ?? resolveFeatureWorktreePath(paths);
  const existingBranch = detectCurrentBranch(worktreePath);

  if (existingBranch && existingBranch === featureBranch) {
    return {
      worktree_path: normalizeSlashes(worktreePath),
      feature_branch: featureBranch,
      base_branch: baseBranch,
      worktree_status: "ready",
      created: false,
      reused: true,
      message: "Reused the existing feature worktree."
    };
  }

  if (existingBranch && existingBranch !== featureBranch) {
    return {
      worktree_path: normalizeSlashes(worktreePath),
      feature_branch: featureBranch,
      base_branch: baseBranch,
      worktree_status: "mismatch",
      created: false,
      reused: false,
      message: "The configured worktree path is already attached to branch '" + existingBranch + "'."
    };
  }

  const baseRef = resolveBaseRef(paths.projectRoot, baseBranch);
  const args = gitRefExists(paths.projectRoot, "refs/heads/" + featureBranch)
    ? ["worktree", "add", worktreePath, featureBranch]
    : ["worktree", "add", "-b", featureBranch, worktreePath, baseRef];
  const result = gitRun(paths.projectRoot, args, { timeoutMs: 30000 });

  if (result.status !== 0) {
    return {
      worktree_path: normalizeSlashes(worktreePath),
      feature_branch: featureBranch,
      base_branch: baseBranch,
      worktree_status: "error",
      created: false,
      reused: false,
      message: result.stderr || result.stdout || "git worktree add failed."
    };
  }

  return {
    worktree_path: normalizeSlashes(worktreePath),
    feature_branch: featureBranch,
    base_branch: baseBranch,
    worktree_status: "ready",
    created: true,
    reused: false,
    message: "Created a dedicated feature worktree."
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
  if (setup.preferred_execution_access_mode === "claude_code_skip_permissions" && setup.preferred_execution_runtime !== "claude_code_exec") {
    errors.push("preferred_execution_runtime must be 'claude_code_exec' when preferred_execution_access_mode is 'claude_code_skip_permissions'.");
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
  const artifactProjectRoot = resolveArtifactProjectRoot(paths, null, input.canonicalProjectRoot ?? input.projectRoot);

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
  state.project_root = artifactProjectRoot;
  state.feature_registry_key = paths.registryKey;
  state.current_branch = state.current_branch ?? currentBranch ?? null;
  state.base_branch = state.base_branch ?? detectDefaultBaseBranch(input.projectRoot);
  state.feature_branch = state.feature_branch ?? buildFeatureBranchName(input.phaseNumber, input.featureSlug);
  state.worktree_path = state.worktree_path ?? normalizeSlashes(resolveFeatureWorktreePath(paths));
  if (!WORKTREE_STATUSES.has(state.worktree_status)) {
    state.worktree_status = "missing";
    repairs.push("worktree_status was invalid and reset.");
  }
  state.merge_required = typeof state.merge_required === "boolean" ? state.merge_required : false;
  if (!MERGE_STATUSES.has(state.merge_status)) {
    state.merge_status = state.merge_required ? "not_ready" : "not_required";
    repairs.push("merge_status was invalid and reset.");
  }
  if (!LOCAL_TARGET_SYNC_STATUSES.has(state.local_target_sync_status)) {
    state.local_target_sync_status = "not_started";
    repairs.push("local_target_sync_status was invalid and reset.");
  }
  state.created_at = state.created_at ?? nowIso();
  state.updated_at = nowIso();
  state.run_timestamps = isPlainObject(state.run_timestamps) ? state.run_timestamps : {};
  state.event_log = Array.isArray(state.event_log) ? state.event_log : [];
  state.resolved_runtime_capabilities = isPlainObject(state.resolved_runtime_capabilities) ? state.resolved_runtime_capabilities : {};
  state.state_schema_version = safeInteger(state.state_schema_version, IMPLEMENT_PLAN_STATE_SCHEMA_VERSION);
  state.implementor_provider = emptyToNull(state.implementor_provider);
  const normalizedStateReasoning = sanitizeWorkerReasoningEffort(
    state.implementor_reasoning_effort,
    state.implementor_provider,
    state.implementor_execution_runtime
  );
  if (normalizedStateReasoning !== emptyToNull(state.implementor_reasoning_effort)) {
    state.implementor_reasoning_effort = normalizedStateReasoning;
    repairs.push("implementor_reasoning_effort was normalized for the current worker provider/runtime.");
  }

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
  const normalizedRegistryReasoning = sanitizeWorkerReasoningEffort(
    registryEntry?.implementor_reasoning_effort ?? null,
    registryEntry?.implementor_provider ?? state.implementor_provider ?? null,
    registryEntry?.implementor_execution_runtime ?? state.implementor_execution_runtime ?? null
  );
  if (!isFilled(state.implementor_reasoning_effort) && normalizedRegistryReasoning) {
    state.implementor_reasoning_effort = normalizedRegistryReasoning;
  }
  if (!isFilled(state.implementor_provider) && registryEntry?.implementor_provider) {
    state.implementor_provider = registryEntry.implementor_provider;
  }
  if (!isFilled(state.resolved_runtime_permission_model) && registryEntry?.resolved_runtime_permission_model) {
    state.resolved_runtime_permission_model = registryEntry.resolved_runtime_permission_model;
  }

  const executionTracking = normalizeExecutionRunsState({ state, paths });
  state.execution_runs = executionTracking.execution_runs;
  state.current_run_id = emptyToNull(state.current_run_id);
  state.current_attempt_id = emptyToNull(state.current_attempt_id);
  if (executionTracking.repairs.length > 0) {
    repairs.push(...executionTracking.repairs);
  }

  const artifactRecovery = await recoverExecutionRunsFromArtifacts({ state, paths });
  if (artifactRecovery.repairs.length > 0) {
    repairs.push(...artifactRecovery.repairs);
    const recoveredTracking = normalizeExecutionRunsState({ state, paths });
    state.execution_runs = recoveredTracking.execution_runs;
    if (recoveredTracking.repairs.length > 0) {
      repairs.push(...recoveredTracking.repairs);
    }
  }

  const activeNormalRun = findActiveExecutionRun(state, "normal");
  if (activeNormalRun) {
    syncLegacyNormalStateFromRun({
      state,
      run: activeNormalRun,
      preserveFeatureStatus: !created && isFilled(state.feature_status)
    });
  }

  return { state, created, changed: created || repairs.length > 0, repairs };
}

function buildInitialState(paths, input, registryEntry, indexEntry, currentBranch) {
  const artifactProjectRoot = resolveArtifactProjectRoot(paths, null, input.canonicalProjectRoot ?? input.projectRoot);
  return {
    state_schema_version: IMPLEMENT_PLAN_STATE_SCHEMA_VERSION,
    phase_number: input.phaseNumber,
    feature_slug: input.featureSlug,
    project_root: artifactProjectRoot,
    feature_registry_key: paths.registryKey,
    feature_status: input.featureStatusOverride ?? indexEntry?.feature_status ?? "active",
    implementor_execution_id: registryEntry?.implementor_execution_id ?? null,
    implementor_execution_access_mode: registryEntry?.implementor_execution_access_mode ?? null,
    implementor_execution_runtime: registryEntry?.implementor_execution_runtime ?? null,
    implementor_provider: registryEntry?.implementor_provider ?? null,
    implementor_model: input.implementorModel ?? registryEntry?.implementor_model ?? null,
    implementor_reasoning_effort: normalizeReasoningEffortValue(
      input.implementorReasoningEffort ?? registryEntry?.implementor_reasoning_effort ?? null
    ),
    resolved_runtime_permission_model: registryEntry?.resolved_runtime_permission_model ?? null,
    resolved_runtime_capabilities: {},
    current_branch: currentBranch ?? null,
    base_branch: detectDefaultBaseBranch(input.projectRoot),
    feature_branch: buildFeatureBranchName(input.phaseNumber, input.featureSlug),
    worktree_path: normalizeSlashes(resolveFeatureWorktreePath(paths)),
    worktree_status: "missing",
    merge_required: false,
    merge_status: "not_required",
    approved_commit_sha: null,
    merge_commit_sha: null,
    merge_queue_request_id: null,
    local_target_sync_status: "not_started",
    last_completed_step: null,
    last_commit_sha: null,
    active_run_status: input.featureStatusOverride === "blocked" ? "blocked" : "idle",
    created_at: nowIso(),
    updated_at: nowIso(),
    run_timestamps: {},
    event_log: [],
    artifacts: {},
    last_error: null,
    current_run_id: null,
    current_attempt_id: null,
    execution_runs: {
      active_by_mode: {
        normal: null,
        benchmarking: null
      },
      runs: {}
    }
  };
}

function defaultExecutionRunsState() {
  return {
    active_by_mode: {
      normal: null,
      benchmarking: null
    },
    runs: {}
  };
}

function emptyBenchmarkContext() {
  return {
    benchmark_run_id: null,
    benchmark_suite_id: null,
    lane_id: null,
    lane_label: null
  };
}

function buildWorkerKey(role, laneId = null) {
  const safeRole = sanitizePathSegment(role);
  if (!laneId) {
    return safeRole + "/default";
  }
  return safeRole + "/" + sanitizePathSegment(laneId);
}

function initialStepStatusMap() {
  return {
    implementation: defaultStepStatus(),
    machine_verification: defaultStepStatus(),
    review_cycle: defaultStepStatus(),
    human_testing: defaultStepStatus(),
    merge_queue: defaultStepStatus()
  };
}

function defaultStepStatus() {
  return {
    status: "not_started",
    started_at: null,
    completed_at: null,
    duration_seconds: null,
    note: null
  };
}

function buildAttemptId(attemptNumber) {
  return "attempt-" + String(attemptNumber).padStart(3, "0");
}

function resolveRunRootPath(paths, runId) {
  return join(paths.implementationRunDir, sanitizePathSegment(runId));
}

function resolveRunContractPath(paths, runId) {
  return join(resolveRunRootPath(paths, runId), "execution-contract.v1.json");
}

function resolveRunProjectionPath(paths, runId) {
  return join(resolveRunRootPath(paths, runId), "run-projection.v1.json");
}

function resolveRunEventsRoot(paths, runId) {
  return join(resolveRunRootPath(paths, runId), "events");
}

function resolveAttemptEventsRoot(paths, runId, attemptId) {
  return join(resolveRunEventsRoot(paths, runId), sanitizePathSegment(attemptId));
}

function normalizeExecutionRunsState({ state, paths }) {
  const repairs = [];
  const artifactPaths = buildArtifactPaths(paths, state);
  const normalized = isPlainObject(state.execution_runs) ? { ...state.execution_runs } : defaultExecutionRunsState();
  normalized.active_by_mode = isPlainObject(normalized.active_by_mode)
    ? {
        normal: emptyToNull(normalized.active_by_mode.normal),
        benchmarking: emptyToNull(normalized.active_by_mode.benchmarking)
      }
    : defaultExecutionRunsState().active_by_mode;
  normalized.runs = isPlainObject(normalized.runs) ? { ...normalized.runs } : {};

  if (!isPlainObject(state.execution_runs)) {
    repairs.push("execution_runs tracking was missing and was initialized.");
  }

  if (Object.keys(normalized.runs).length === 0 && hasLegacyExecutionSignal(state)) {
    const migrated = buildLegacyExecutionRunSummary({ state, paths });
    normalized.runs[migrated.run_id] = migrated;
    normalized.active_by_mode.normal = migrated.run_id;
    state.current_run_id = migrated.run_id;
    state.current_attempt_id = migrated.current_attempt_id;
    repairs.push("execution_runs tracking was migrated from the legacy single-state projection.");
  }

  for (const [runId, run] of Object.entries(normalized.runs)) {
    if (!isPlainObject(run)) {
      delete normalized.runs[runId];
      repairs.push("Removed malformed execution run summary '" + runId + "'.");
      continue;
    }
    run.run_id = emptyToNull(run.run_id) ?? runId;
    run.run_mode = IMPLEMENT_PLAN_RUN_MODES.has(run.run_mode) ? run.run_mode : "normal";
    run.lifecycle_status = RUN_LIFECYCLE_STATUSES.has(run.lifecycle_status) ? run.lifecycle_status : "active";
    run.terminal_status = emptyToNull(run.terminal_status);
    run.contract_schema_version = safeInteger(run.contract_schema_version, EXECUTION_CONTRACT_SCHEMA_VERSION);
    run.contract_revision = Math.max(safeInteger(run.contract_revision, 1), 1);
    run.contract_path = normalizeSlashes(resolveRunContractPath(artifactPaths, run.run_id));
    run.feature_contract_path = normalizeSlashes(artifactPaths.executionContractPath);
    run.projection_path = normalizeSlashes(resolveRunProjectionPath(artifactPaths, run.run_id));
    run.run_root = normalizeSlashes(resolveRunRootPath(artifactPaths, run.run_id));
    run.benchmark_context = isPlainObject(run.benchmark_context)
      ? {
          benchmark_run_id: emptyToNull(run.benchmark_context.benchmark_run_id),
          benchmark_suite_id: emptyToNull(run.benchmark_context.benchmark_suite_id),
          lane_id: emptyToNull(run.benchmark_context.lane_id),
          lane_label: emptyToNull(run.benchmark_context.lane_label)
        }
      : emptyBenchmarkContext();
    run.worker_keys = Array.isArray(run.worker_keys) ? run.worker_keys.filter((value) => isFilled(value)) : [];
    run.attempt_counter = Math.max(safeInteger(run.attempt_counter, 1), 1);
    run.current_attempt_id = emptyToNull(run.current_attempt_id) ?? buildAttemptId(run.attempt_counter);
    run.attempts = normalizeAttemptSummaries(run.attempts, run.current_attempt_id);
    if (!run.attempts[run.current_attempt_id]) {
      run.attempts[run.current_attempt_id] = buildEmptyAttemptSummary(run.current_attempt_id, run.attempt_counter);
      repairs.push("Execution run '" + run.run_id + "' was missing its current attempt summary and it was rebuilt.");
    }
    run.created_at = emptyToNull(run.created_at) ?? nowIso();
    run.updated_at = emptyToNull(run.updated_at) ?? run.created_at;
    run.last_event_at = emptyToNull(run.last_event_at);
    run.kpi_projection = isPlainObject(run.kpi_projection) ? run.kpi_projection : buildRunKpiProjection(run);
  }

  for (const mode of Object.keys(defaultExecutionRunsState().active_by_mode)) {
    const activeRunId = normalized.active_by_mode[mode];
    if (activeRunId && !normalized.runs[activeRunId]) {
      normalized.active_by_mode[mode] = null;
      repairs.push("Cleared stale active run pointer for mode '" + mode + "'.");
    }
    if (!normalized.active_by_mode[mode]) {
      const candidate = selectPreferredRunForMode(normalized.runs, mode);
      if (candidate) {
        normalized.active_by_mode[mode] = candidate.run_id;
        repairs.push("Recovered missing active run pointer for mode '" + mode + "'.");
      }
    }
  }

  return {
    execution_runs: normalized,
    repairs
  };
}

async function recoverExecutionRunsFromArtifacts({ state, paths }) {
  const repairs = [];
  const files = await readJsonDirectory(paths.implementationRunDir, { recursive: true, failOnParseError: false });
  const projections = files
    .filter((file) => file.error === null && file.path.endsWith("/run-projection.v1.json"))
    .map((file) => file.data)
    .filter((data) => isPlainObject(data) && isPlainObject(data.run));

  if (projections.length === 0) {
    return { repairs };
  }

  state.execution_runs = isPlainObject(state.execution_runs) ? state.execution_runs : defaultExecutionRunsState();
  state.execution_runs.runs = isPlainObject(state.execution_runs.runs) ? state.execution_runs.runs : {};
  state.execution_runs.active_by_mode = isPlainObject(state.execution_runs.active_by_mode)
    ? state.execution_runs.active_by_mode
    : defaultExecutionRunsState().active_by_mode;

  let recoveredAny = false;
  for (const projection of projections) {
    const run = projection.run;
    const runId = emptyToNull(run.run_id);
    if (!runId) {
      continue;
    }
    if (!isPlainObject(state.execution_runs.runs[runId])) {
      state.execution_runs.runs[runId] = run;
      recoveredAny = true;
      repairs.push("Recovered execution run '" + runId + "' from its run projection.");
    }
  }

  for (const mode of Object.keys(defaultExecutionRunsState().active_by_mode)) {
    if (isFilled(state.execution_runs.active_by_mode[mode])) {
      continue;
    }
    const candidate = selectPreferredRunForMode(state.execution_runs.runs, mode);
    if (candidate) {
      state.execution_runs.active_by_mode[mode] = candidate.run_id;
      recoveredAny = true;
      repairs.push("Recovered the active '" + mode + "' run pointer from run projections.");
    }
  }

  if (!isFilled(state.current_run_id)) {
    state.current_run_id = state.execution_runs.active_by_mode.normal
      ?? state.execution_runs.active_by_mode.benchmarking
      ?? null;
  }
  if (!isFilled(state.current_attempt_id) && isFilled(state.current_run_id)) {
    state.current_attempt_id = state.execution_runs.runs?.[state.current_run_id]?.current_attempt_id ?? null;
  }

  return {
    repairs: recoveredAny ? repairs : []
  };
}

function selectPreferredRunForMode(runs, mode) {
  const candidates = Object.values(runs ?? {})
    .filter((run) => isPlainObject(run) && run.run_mode === mode)
    .sort((left, right) => {
      const leftRank = left.lifecycle_status === "active" ? 0 : left.lifecycle_status === "blocked" ? 1 : left.lifecycle_status === "supervisor_deferred" ? 2 : 3;
      const rightRank = right.lifecycle_status === "active" ? 0 : right.lifecycle_status === "blocked" ? 1 : right.lifecycle_status === "supervisor_deferred" ? 2 : 3;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? ""));
    });
  return candidates[0] ?? null;
}

function normalizeAttemptSummaries(value, fallbackAttemptId) {
  const attempts = isPlainObject(value) ? { ...value } : {};
  for (const [attemptId, attempt] of Object.entries(attempts)) {
    if (!isPlainObject(attempt)) {
      delete attempts[attemptId];
      continue;
    }
    attempt.attempt_id = emptyToNull(attempt.attempt_id) ?? attemptId;
    attempt.attempt_number = Math.max(safeInteger(attempt.attempt_number, 1), 1);
    attempt.status = ATTEMPT_STATUSES.has(attempt.status) ? attempt.status : "ready_for_implementation";
    attempt.terminal_status = emptyToNull(attempt.terminal_status);
    attempt.started_at = emptyToNull(attempt.started_at);
    attempt.updated_at = emptyToNull(attempt.updated_at) ?? attempt.started_at ?? nowIso();
    attempt.reset_at = emptyToNull(attempt.reset_at);
    attempt.reset_reason = emptyToNull(attempt.reset_reason);
    attempt.superseded_by_attempt_id = emptyToNull(attempt.superseded_by_attempt_id);
    attempt.resume_checkpoint = isPlainObject(attempt.resume_checkpoint)
      ? {
          step: emptyToNull(attempt.resume_checkpoint.step),
          status: emptyToNull(attempt.resume_checkpoint.status),
          reason: emptyToNull(attempt.resume_checkpoint.reason),
          updated_at: emptyToNull(attempt.resume_checkpoint.updated_at)
        }
      : null;
    attempt.step_status = normalizeStepStatusMap(attempt.step_status);
    attempt.governance_calls = Array.isArray(attempt.governance_calls) ? attempt.governance_calls : [];
    attempt.governance_metrics = normalizeGovernanceMetrics(attempt.governance_metrics);
    attempt.verification_outcomes = Array.isArray(attempt.verification_outcomes) ? attempt.verification_outcomes : [];
    attempt.review_cycle_count = Math.max(safeInteger(attempt.review_cycle_count, 0), 0);
    attempt.self_fix_cycle_count = Math.max(safeInteger(attempt.self_fix_cycle_count, 0), 0);
    attempt.blockers = Array.isArray(attempt.blockers) ? attempt.blockers : [];
    attempt.worker_bindings = isPlainObject(attempt.worker_bindings) ? { ...attempt.worker_bindings } : {};
    attempt.last_checkpoint_at = emptyToNull(attempt.last_checkpoint_at);
    attempt.last_event_at = emptyToNull(attempt.last_event_at);
  }

  if (Object.keys(attempts).length === 0) {
    const attemptId = fallbackAttemptId ?? buildAttemptId(1);
    attempts[attemptId] = buildEmptyAttemptSummary(attemptId, 1);
  }
  return attempts;
}

function normalizeStepStatusMap(stepStatus) {
  const next = initialStepStatusMap();
  if (!isPlainObject(stepStatus)) {
    return next;
  }
  for (const step of NORMAL_ROUTE_STEP_ORDER) {
    if (!isPlainObject(stepStatus[step])) continue;
    next[step] = {
      status: STEP_OUTCOME_STATUSES.has(stepStatus[step].status) ? stepStatus[step].status : "not_started",
      started_at: emptyToNull(stepStatus[step].started_at),
      completed_at: emptyToNull(stepStatus[step].completed_at),
      duration_seconds: Number.isFinite(Number(stepStatus[step].duration_seconds)) ? Number(stepStatus[step].duration_seconds) : null,
      note: emptyToNull(stepStatus[step].note)
    };
  }
  return next;
}

function normalizeGovernanceMetrics(metrics) {
  if (!isPlainObject(metrics)) {
    return {
      call_count: 0,
      total_duration_ms: 0,
      total_estimated_cost_usd: 0,
      total_prompt_tokens_estimated: 0,
      total_completion_tokens_estimated: 0,
      total_tokens_estimated: 0
    };
  }
  return {
    call_count: Math.max(safeInteger(metrics.call_count, 0), 0),
    total_duration_ms: Math.max(Number(metrics.total_duration_ms ?? 0) || 0, 0),
    total_estimated_cost_usd: Math.max(Number(metrics.total_estimated_cost_usd ?? 0) || 0, 0),
    total_prompt_tokens_estimated: Math.max(safeInteger(metrics.total_prompt_tokens_estimated, 0), 0),
    total_completion_tokens_estimated: Math.max(safeInteger(metrics.total_completion_tokens_estimated, 0), 0),
    total_tokens_estimated: Math.max(safeInteger(metrics.total_tokens_estimated, 0), 0)
  };
}

function buildEmptyAttemptSummary(attemptId, attemptNumber) {
  return {
    attempt_id: attemptId,
    attempt_number: attemptNumber,
    status: "ready_for_implementation",
    terminal_status: null,
    started_at: nowIso(),
    updated_at: nowIso(),
    reset_at: null,
    reset_reason: null,
    superseded_by_attempt_id: null,
    resume_checkpoint: {
      step: "implementation",
      status: "ready",
      reason: "Awaiting implementor dispatch.",
      updated_at: nowIso()
    },
    step_status: initialStepStatusMap(),
    governance_calls: [],
    governance_metrics: normalizeGovernanceMetrics(null),
    verification_outcomes: [],
    review_cycle_count: 0,
    self_fix_cycle_count: 0,
    blockers: [],
    worker_bindings: {},
    last_checkpoint_at: null,
    last_event_at: null
  };
}

function hasLegacyExecutionSignal(state) {
  return Boolean(
    isFilled(state.implementor_execution_id)
    || isFilled(state.last_completed_step)
    || isFilled(state.last_commit_sha)
    || (state.active_run_status && state.active_run_status !== "idle")
    || (state.merge_status && state.merge_status !== "not_required")
    || Object.keys(state.run_timestamps ?? {}).length > 0
    || (state.event_log ?? []).length > 0
  );
}

function buildLegacyExecutionRunSummary({ state, paths }) {
  const artifactPaths = buildArtifactPaths(paths, state);
  const runId = "legacy-normal-" + sanitizePathSegment(paths.registryKey) + "-" + sanitizePathSegment(state.created_at ?? nowIso());
  const attemptId = buildAttemptId(1);
  const workerKey = buildWorkerKey("implementor", null);
  return {
    run_id: runId,
    run_mode: "normal",
    lifecycle_status: state.active_run_status === "completed" ? "completed" : state.active_run_status === "blocked" ? "blocked" : "active",
    terminal_status: state.active_run_status === "completed" ? "completed" : state.active_run_status === "blocked" ? "blocked" : null,
    contract_schema_version: EXECUTION_CONTRACT_SCHEMA_VERSION,
    contract_revision: 1,
    feature_contract_path: normalizeSlashes(artifactPaths.executionContractPath),
    contract_path: normalizeSlashes(resolveRunContractPath(artifactPaths, runId)),
    projection_path: normalizeSlashes(resolveRunProjectionPath(artifactPaths, runId)),
    run_root: normalizeSlashes(resolveRunRootPath(artifactPaths, runId)),
    benchmark_context: emptyBenchmarkContext(),
    worker_keys: [workerKey],
    current_attempt_id: attemptId,
    attempt_counter: 1,
    attempts: {
      [attemptId]: buildLegacyAttemptSummary(state, workerKey)
    },
    created_at: state.created_at ?? nowIso(),
    updated_at: state.updated_at ?? nowIso(),
    last_event_at: state.updated_at ?? null
  };
}

function buildLegacyAttemptSummary(state, workerKey) {
  const attempt = buildEmptyAttemptSummary(buildAttemptId(1), 1);
  attempt.status = legacyActiveRunStatusToAttemptStatus(state.active_run_status);
  attempt.terminal_status = state.active_run_status === "completed" ? "completed" : state.active_run_status === "blocked" ? "blocked" : null;
  attempt.started_at = state.run_timestamps?.implementor_started_at ?? state.created_at ?? nowIso();
  attempt.updated_at = state.updated_at ?? nowIso();
  attempt.last_checkpoint_at = state.updated_at ?? nowIso();
  attempt.last_event_at = state.updated_at ?? nowIso();
  attempt.resume_checkpoint = {
    step: legacyLastCompletedStepToResumeStep(state.last_completed_step, state.active_run_status, state.merge_status),
    status: legacyResumeCheckpointStatus(state.active_run_status),
    reason: "Recovered from legacy single-state projection.",
    updated_at: state.updated_at ?? nowIso()
  };
  attempt.step_status = buildLegacyStepStatusMap(state.run_timestamps ?? {}, state.active_run_status, {
    last_completed_step: state.last_completed_step,
    merge_status: state.merge_status,
    state_updated_at: state.updated_at ?? nowIso()
  });
  attempt.worker_bindings[workerKey] = {
    worker_id: workerKey,
    lane_id: null,
    role: "implementor",
    provider: emptyToNull(state.implementor_provider),
    runtime: emptyToNull(state.implementor_execution_runtime),
    model: emptyToNull(state.implementor_model),
    reasoning_effort: emptyToNull(state.implementor_reasoning_effort),
    access_mode: emptyToNull(state.implementor_execution_access_mode),
    execution_id: emptyToNull(state.implementor_execution_id),
    bound_at: state.updated_at ?? nowIso(),
    selection_source: "legacy_state_migration",
    recreated_due_to_access: false
  };
  return attempt;
}

function hasLegacyMergedCloseoutState(lastCompletedStep, activeRunStatus, mergeStatus) {
  return activeRunStatus === "closeout_pending"
    && (mergeStatus === "merged" || String(lastCompletedStep ?? "").includes("merge"));
}

function buildLegacyStepStatusMap(runTimestamps, activeRunStatus, legacyState = {}) {
  const lastCompletedStep = emptyToNull(legacyState?.last_completed_step);
  const mergeStatus = emptyToNull(legacyState?.merge_status);
  const stateUpdatedAt = emptyToNull(legacyState?.state_updated_at);
  const steps = initialStepStatusMap();
  applyLegacyStepTimestamps(steps.implementation, runTimestamps.implementor_started_at, runTimestamps.implementor_finished_at);
  applyLegacyStepTimestamps(steps.machine_verification, runTimestamps.implementor_finished_at, runTimestamps.verification_finished_at);
  applyLegacyStepTimestamps(steps.review_cycle, runTimestamps.review_requested_at, null);
  applyLegacyStepTimestamps(steps.human_testing, runTimestamps.human_verification_requested_at, null);
  applyLegacyStepTimestamps(steps.merge_queue, runTimestamps.merge_started_at, runTimestamps.merge_finished_at);

  if (activeRunStatus === "review_pending" && steps.review_cycle.status === "not_started") {
    steps.review_cycle.status = "ready";
  }
  if (activeRunStatus === "human_verification_pending" && steps.human_testing.status === "not_started") {
    steps.human_testing.status = "ready";
  }
  if (activeRunStatus === "merge_ready" && steps.merge_queue.status === "not_started") {
    steps.merge_queue.status = "ready";
  }
  if (activeRunStatus === "merge_queued") {
    steps.merge_queue.status = "ready";
  }
  if (activeRunStatus === "merge_in_progress") {
    steps.merge_queue.status = "in_progress";
  }
  if (activeRunStatus === "merge_blocked") {
    steps.merge_queue.status = "blocked";
  }
  if (hasLegacyMergedCloseoutState(lastCompletedStep, activeRunStatus, mergeStatus) && steps.merge_queue.status !== "completed") {
    steps.merge_queue.status = "completed";
    steps.merge_queue.started_at = steps.merge_queue.started_at
      ?? steps.machine_verification.completed_at
      ?? steps.implementation.completed_at
      ?? null;
    steps.merge_queue.completed_at = steps.merge_queue.completed_at
      ?? emptyToNull(runTimestamps.merge_finished_at)
      ?? stateUpdatedAt
      ?? null;
    if (steps.merge_queue.started_at && steps.merge_queue.completed_at) {
      steps.merge_queue.duration_seconds = diffSeconds(steps.merge_queue.started_at, steps.merge_queue.completed_at);
    }
  }
  if (activeRunStatus === "completed" && steps.merge_queue.status !== "completed") {
    steps.merge_queue.status = "completed";
    steps.merge_queue.completed_at = emptyToNull(runTimestamps.merge_finished_at) ?? emptyToNull(runTimestamps.closeout_finished_at);
    if (steps.merge_queue.started_at && steps.merge_queue.completed_at) {
      steps.merge_queue.duration_seconds = diffSeconds(steps.merge_queue.started_at, steps.merge_queue.completed_at);
    }
  }

  return steps;
}

function applyLegacyStepTimestamps(step, startedAt, completedAt) {
  step.started_at = emptyToNull(startedAt);
  step.completed_at = emptyToNull(completedAt);
  if (step.started_at && step.completed_at) {
    step.status = "completed";
    step.duration_seconds = diffSeconds(step.started_at, step.completed_at);
  } else if (step.started_at) {
    step.status = "in_progress";
  }
}

function legacyActiveRunStatusToAttemptStatus(activeRunStatus) {
  switch (activeRunStatus) {
    case "implementation_running":
      return "implementation_running";
    case "verification_pending":
      return "verification_pending";
    case "closeout_pending":
      return "closeout_pending";
    case "review_pending":
      return "review_pending";
    case "human_verification_pending":
      return "human_testing_pending";
    case "merge_ready":
      return "merge_ready";
    case "merge_queued":
      return "merge_queued";
    case "merge_in_progress":
      return "merge_in_progress";
    case "merge_blocked":
    case "blocked":
    case "integrity_failed":
      return "blocked";
    case "completed":
      return "completed";
    default:
      return "ready_for_implementation";
  }
}

function legacyLastCompletedStepToResumeStep(lastCompletedStep, activeRunStatus, mergeStatus = null) {
  if (activeRunStatus === "implementation_running") return "implementation";
  if (activeRunStatus === "verification_pending") return "machine_verification";
  if (activeRunStatus === "closeout_pending") {
    return hasLegacyMergedCloseoutState(lastCompletedStep, activeRunStatus, mergeStatus)
      ? "merge_queue"
      : "machine_verification";
  }
  if (activeRunStatus === "review_pending") return "review_cycle";
  if (activeRunStatus === "human_verification_pending") return "human_testing";
  if (["merge_ready", "merge_queued", "merge_in_progress", "merge_blocked"].includes(activeRunStatus)) return "merge_queue";
  if (activeRunStatus === "completed") return "merge_queue";
  if (mergeStatus === "merged" || String(lastCompletedStep ?? "").includes("merge")) return "merge_queue";
  if (String(lastCompletedStep ?? "").includes("review")) return "review_cycle";
  if (String(lastCompletedStep ?? "").includes("verification")) return "machine_verification";
  return "implementation";
}

function legacyResumeCheckpointStatus(activeRunStatus) {
  switch (activeRunStatus) {
    case "implementation_running":
    case "merge_in_progress":
      return "in_progress";
    case "blocked":
    case "merge_blocked":
    case "integrity_failed":
      return "blocked";
    case "closeout_pending":
    case "completed":
      return "completed";
    default:
      return "ready";
  }
}

function detectInvokerProvider() {
  if (isFilled(process.env.CODEX_HOME) || isFilled(process.env.CODEX_SANDBOX)) {
    return "codex";
  }
  if (isFilled(process.env.CLAUDE_SKILLS_ROOT) || isFilled(process.env.CLAUDECODE)) {
    return "claude";
  }
  if (isFilled(process.env.GEMINI_SKILLS_ROOT)) {
    return "gemini";
  }
  return null;
}

function inferProviderFromWorkerSelection({ provider, runtime, accessMode, model, fallbackProvider = null }) {
  const normalizedProvider = emptyToNull(provider);
  if (normalizedProvider) return normalizedProvider;

  if (runtime === "claude_code_exec" || accessMode === "claude_code_skip_permissions") {
    return "claude";
  }
  if (runtime === "codex_cli_exec" || accessMode === "codex_cli_full_auto_bypass") {
    return "codex";
  }

  const normalizedModel = emptyToNull(model)?.toLowerCase() ?? null;
  if (normalizedModel?.startsWith("claude")) return "claude";
  if (normalizedModel?.startsWith("gemini")) return "gemini";
  if (
    normalizedModel?.startsWith("gpt-")
    || normalizedModel?.startsWith("o1")
    || normalizedModel?.startsWith("o3")
  ) {
    return "codex";
  }

  return emptyToNull(fallbackProvider);
}

function resolveInvokerRuntimeSummary(setup) {
  const executionRuntime = setup.data.preferred_execution_runtime ?? null;
  const accessMode = setup.data.preferred_implementor_access_mode
    ?? setup.data.preferred_execution_access_mode
    ?? setup.data.fallback_execution_access_mode
    ?? null;
  const configuredModel = setup.data.preferred_implementor_model ?? "gpt-5.4";
  const detectedProvider = inferProviderFromWorkerSelection({
    provider: detectInvokerProvider(),
    runtime: executionRuntime,
    accessMode,
    model: configuredModel,
    fallbackProvider: detectInvokerProvider()
  });
  return {
    provider: detectedProvider,
    execution_runtime: executionRuntime,
    control_plane_runtime: setup.data.preferred_control_plane_runtime ?? executionRuntime ?? null,
    access_mode: accessMode,
    model: configuredModel,
    reasoning_effort: sanitizeWorkerReasoningEffort(
      setup.data.preferred_implementor_reasoning_effort ?? defaultReasoningEffortForRuntime(executionRuntime),
      detectedProvider,
      executionRuntime
    ),
    runtime_permission_model: setup.data.runtime_permission_model ?? null,
    selection_source: "invoker_runtime_defaults"
  };
}

function resolveWorkerSelection({ setup, state, input }) {
  const invokerRuntime = resolveInvokerRuntimeSummary(setup);
  const modelOverride = input.workerModel ?? input.implementorModel ?? null;
  const reasoningOverride = normalizeReasoningEffortValue(input.workerReasoningEffort ?? input.implementorReasoningEffort ?? null);

  const defaults = {
    provider: inferProviderFromWorkerSelection({
      provider: invokerRuntime.provider,
      runtime: invokerRuntime.execution_runtime,
      accessMode: invokerRuntime.access_mode,
      model: invokerRuntime.model,
      fallbackProvider: detectInvokerProvider()
    }),
    runtime: invokerRuntime.execution_runtime,
    access_mode: invokerRuntime.access_mode,
    model: invokerRuntime.model,
    reasoning_effort: sanitizeWorkerReasoningEffort(
      invokerRuntime.reasoning_effort,
      invokerRuntime.provider,
      invokerRuntime.execution_runtime
    )
  };

  const continuity = {
    provider: inferProviderFromWorkerSelection({
      provider: state.implementor_provider ?? null,
      runtime: state.implementor_execution_runtime ?? null,
      accessMode: state.implementor_execution_access_mode ?? null,
      model: state.implementor_model ?? null
    }),
    runtime: state.implementor_execution_runtime ?? null,
    access_mode: state.implementor_execution_access_mode ?? null,
    model: state.implementor_model ?? null,
    reasoning_effort: normalizeReasoningEffortValue(state.implementor_reasoning_effort ?? null)
  };

  const overrides = {
    provider: inferProviderFromWorkerSelection({
      provider: input.workerProvider ?? null,
      runtime: input.workerRuntime ?? null,
      accessMode: input.workerAccessMode ?? null,
      model: modelOverride ?? null
    }),
    runtime: input.workerRuntime ?? null,
    access_mode: input.workerAccessMode ?? null,
    model: modelOverride ?? null,
    reasoning_effort: reasoningOverride ?? null
  };

  const resolved = {};
  const resolvedSources = {};
  const inheritance = {};
  for (const field of WORKER_SELECTION_FIELDS.filter((candidate) => candidate !== "reasoning_effort")) {
    if (overrides[field] !== null) {
      resolved[field] = overrides[field];
      resolvedSources[field] = "explicit_override";
      inheritance[field] = false;
    } else if (continuity[field] !== null) {
      resolved[field] = continuity[field];
      resolvedSources[field] = "persisted_continuity";
      inheritance[field] = false;
    } else {
      resolved[field] = defaults[field] ?? null;
      resolvedSources[field] = "invoker_inheritance";
      inheritance[field] = true;
    }
  }

  const resolvedProviderBeforeInference = resolved.provider ?? null;
  resolved.provider = inferProviderFromWorkerSelection({
    provider: resolved.provider,
    runtime: resolved.runtime,
    accessMode: resolved.access_mode,
    model: resolved.model,
    fallbackProvider: continuity.provider ?? defaults.provider ?? detectInvokerProvider()
  });
  if (resolvedProviderBeforeInference !== resolved.provider && resolvedSources.provider !== "explicit_override") {
    resolvedSources.provider = "derived_from_worker_runtime";
    inheritance.provider = false;
  }

  const resolvedReasoning = resolveWorkerReasoningSelection({
    defaults,
    continuity,
    overrides,
    resolved
  });
  resolved.reasoning_effort = resolvedReasoning.value;
  resolvedSources.reasoning_effort = resolvedReasoning.source;
  inheritance.reasoning_effort = resolvedReasoning.source === "invoker_inheritance";

  const llmTools = setup.data?.llm_tools ?? {};
  const availableWorkers = [];
  for (const [name, tool] of Object.entries(llmTools)) {
    if (tool && tool.available === true) {
      availableWorkers.push({
        name,
        autonomous_invoke: tool.autonomous_invoke ?? null,
        version: tool.version ?? null
      });
    }
  }

  return {
    invoker_runtime: invokerRuntime,
    defaults,
    continuity,
    overrides,
    resolved,
    resolved_sources: resolvedSources,
    inheritance,
    available_workers: availableWorkers
  };
}

function createExecutionRunSummary({ paths, input, workerSelection }) {
  const artifactPaths = buildArtifactPaths(paths, {
    project_root: input.canonicalProjectRoot ?? input.projectRoot
  });
  const runId = createOpaqueId(input.runMode === "benchmarking" ? "bench-run" : "run");
  const attemptId = buildAttemptId(1);
  const workerKey = buildWorkerKey("implementor", input.runMode === "benchmarking" ? input.benchmarkLaneId : null);
  const attempt = buildEmptyAttemptSummary(attemptId, 1);
  attempt.worker_bindings[workerKey] = buildWorkerBinding(workerKey, workerSelection);
  if (input.runMode === "benchmarking") {
    attempt.status = "supervisor_deferred";
    attempt.resume_checkpoint = {
      step: "implementation",
      status: "ready",
      reason: "Benchmarking substrate materialized. External supervisor is deferred to Spec 2.",
      updated_at: nowIso()
    };
  }

  return {
    run_id: runId,
    run_mode: input.runMode,
    lifecycle_status: input.runMode === "benchmarking" ? "supervisor_deferred" : "active",
    terminal_status: null,
    contract_schema_version: EXECUTION_CONTRACT_SCHEMA_VERSION,
    contract_revision: 1,
    feature_contract_path: normalizeSlashes(artifactPaths.executionContractPath),
    contract_path: normalizeSlashes(resolveRunContractPath(artifactPaths, runId)),
    projection_path: normalizeSlashes(resolveRunProjectionPath(artifactPaths, runId)),
    run_root: normalizeSlashes(resolveRunRootPath(artifactPaths, runId)),
    benchmark_context: {
      benchmark_run_id: input.benchmarkRunId ?? null,
      benchmark_suite_id: input.benchmarkSuiteId ?? null,
      lane_id: input.benchmarkLaneId ?? null,
      lane_label: input.benchmarkLaneLabel ?? null
    },
    worker_keys: [workerKey],
    current_attempt_id: attemptId,
    attempt_counter: 1,
    attempts: {
      [attemptId]: attempt
    },
    created_at: nowIso(),
    updated_at: nowIso(),
    last_event_at: null
  };
}

function buildWorkerBinding(workerKey, workerSelection) {
  const laneSegment = workerKey.includes("/") ? workerKey.split("/").slice(1).join("/") : null;
  const selectionSource = {};
  for (const field of WORKER_SELECTION_FIELDS) {
    selectionSource[field] = workerSelection?.resolved_sources?.[field]
      ?? (workerSelection?.inheritance?.[field] === true ? "invoker_inheritance" : null)
      ?? (workerSelection?.overrides?.[field] !== null && workerSelection?.overrides?.[field] !== undefined ? "explicit_override" : null)
      ?? "persisted_continuity";
  }
  return {
    worker_id: workerKey,
    lane_id: laneSegment && laneSegment !== "default" ? laneSegment : null,
    role: "implementor",
    provider: workerSelection.resolved.provider ?? null,
    runtime: workerSelection.resolved.runtime ?? null,
    model: workerSelection.resolved.model ?? null,
    reasoning_effort: workerSelection.resolved.reasoning_effort ?? null,
    access_mode: workerSelection.resolved.access_mode ?? null,
    execution_id: null,
    bound_at: nowIso(),
    selection_source: selectionSource,
    recreated_due_to_access: false
  };
}

function findActiveExecutionRun(state, runMode) {
  const runId = state.execution_runs?.active_by_mode?.[runMode] ?? null;
  if (!runId) {
    return null;
  }
  return state.execution_runs.runs?.[runId] ?? null;
}

function benchmarkingContextMatches(run, input) {
  if (!run) return false;
  if (run.run_mode !== "benchmarking") return false;
  const benchmark = run.benchmark_context ?? {};
  return (input.benchmarkRunId ?? null) === (benchmark.benchmark_run_id ?? null)
    && (input.benchmarkSuiteId ?? null) === (benchmark.benchmark_suite_id ?? null)
    && (input.benchmarkLaneId ?? null) === (benchmark.lane_id ?? null);
}

function ensureExecutionRunContext({ state, paths, input, workerSelection }) {
  let run = findActiveExecutionRun(state, input.runMode);
  let createdRun = false;

  if (!run || (input.runMode === "benchmarking" && !benchmarkingContextMatches(run, input))) {
    run = createExecutionRunSummary({ paths, input, workerSelection });
    state.execution_runs.runs[run.run_id] = run;
    state.execution_runs.active_by_mode[input.runMode] = run.run_id;
    createdRun = true;
  } else {
    const workerKey = run.worker_keys[0] ?? buildWorkerKey("implementor", run.benchmark_context?.lane_id ?? null);
    run.worker_keys = [workerKey];
    const attempt = run.attempts[run.current_attempt_id];
    const previousBinding = attempt.worker_bindings?.[workerKey] ?? buildWorkerBinding(workerKey, workerSelection);
    attempt.worker_bindings[workerKey] = {
      ...previousBinding,
      provider: workerSelection.resolved.provider ?? null,
      runtime: workerSelection.resolved.runtime ?? null,
      model: workerSelection.resolved.model ?? null,
      reasoning_effort: workerSelection.resolved.reasoning_effort ?? null,
      access_mode: workerSelection.resolved.access_mode ?? null,
      selection_source: {
        ...(isPlainObject(previousBinding.selection_source) ? previousBinding.selection_source : {}),
        ...buildWorkerBinding(workerKey, workerSelection).selection_source
      }
    };
    run.updated_at = nowIso();
  }

  state.current_run_id = run.run_id;
  state.current_attempt_id = run.current_attempt_id;

  return {
    run,
    attempt: run.attempts[run.current_attempt_id],
    worker_key: run.worker_keys[0],
    created_run: createdRun
  };
}

function buildExecutionContract({ paths, state, input, setup, integrity, workerSelection, run, attempt, workerKey, verificationPlanState }) {
  const artifactPaths = buildArtifactPaths(paths, state, input.canonicalProjectRoot ?? input.projectRoot);
  const reviewRequiredByHumanPlan = verificationPlanState.human_required === true;
  const effectiveReviewMaxCycles = input.postSendToReview && input.reviewUntilComplete ? (input.reviewMaxCycles ?? 5) : null;
  return {
    schema_version: EXECUTION_CONTRACT_SCHEMA_VERSION,
    contract_kind: "implement-plan-execution",
    contract_revision: run.contract_revision,
    prepared_at: nowIso(),
    feature_identity: {
      project_root: resolveArtifactProjectRoot(paths, state, input.canonicalProjectRoot ?? input.projectRoot),
      phase_number: input.phaseNumber,
      feature_slug: input.featureSlug,
      feature_registry_key: paths.registryKey,
      feature_root: normalizeSlashes(artifactPaths.featureRoot)
    },
    run_identity: {
      run_mode: input.runMode,
      run_id: run.run_id,
      attempt_id: attempt.attempt_id,
      attempt_number: attempt.attempt_number,
      lane_id: run.benchmark_context?.lane_id ?? null,
      worker_id: workerKey
    },
    invoker_runtime: workerSelection.invoker_runtime,
    worker_selection: {
      defaults: workerSelection.defaults,
      continuity: workerSelection.continuity,
      overrides: workerSelection.overrides,
      resolved: workerSelection.resolved,
      resolved_sources: workerSelection.resolved_sources,
      inheritance: workerSelection.inheritance
    },
    route_policy: {
      normal_mode_governed_flow: NORMAL_ROUTE_STEP_ORDER,
      normal_mode_requires_review_cycle_when_requested: true,
      human_testing_requires_route_level_review_gate: true,
      merge_completion_required_for_terminal_completion: true,
      supported_operator_stop_surface: false,
      supported_reset_surface: "helper-reset-attempt",
      normal_mode_shortcuts_allowed: false
    },
    review_handoff: {
      post_send_to_review: input.postSendToReview,
      review_until_complete: input.postSendToReview ? input.reviewUntilComplete : false,
      review_max_cycles: effectiveReviewMaxCycles,
      review_required_by_human_plan: reviewRequiredByHumanPlan
    },
    benchmarking: {
      enabled: input.runMode === "benchmarking",
      supervisor_status: input.runMode === "benchmarking" ? "deferred_to_spec_2" : "not_applicable",
      benchmark_run_id: input.benchmarkRunId ?? null,
      benchmark_suite_id: input.benchmarkSuiteId ?? null,
      lane_id: input.benchmarkLaneId ?? null,
      lane_label: input.benchmarkLaneLabel ?? null
    },
    resume_policy: {
      resumable_after_crash_or_kill: true,
      reuse_cached_workers_when_valid: true,
      recreate_workers_when_invalid: true,
      last_truthful_checkpoint: attempt.resume_checkpoint
    },
    reset_policy: {
      supported: true,
      behavior: "new_attempt_from_implementation_preserving_history",
      next_attempt_number: run.attempt_counter + 1
    },
    kpi_policy: {
      source: "governed_production_flow",
      step_timing_enabled: true,
      governance_call_timing_enabled: true,
      verification_outcomes_enabled: true,
      review_and_self_fix_counts_enabled: true,
      blocker_classification_enabled: true,
      terminal_status_enabled: true
    },
    integrity: {
      blocking_issue_count: integrity.blocking_issues.length,
      blocking_issue_classes: integrity.blocking_issues.map((item) => item.issue_class),
      next_safe_move: integrity.next_safe_move
    },
    artifacts: {
      state_path: normalizeSlashes(artifactPaths.statePath),
      markdown_contract_path: normalizeSlashes(artifactPaths.contractPath),
      execution_contract_path: normalizeSlashes(artifactPaths.executionContractPath),
      run_contract_path: normalizeSlashes(resolveRunContractPath(artifactPaths, run.run_id)),
      run_projection_path: normalizeSlashes(resolveRunProjectionPath(artifactPaths, run.run_id)),
      execution_run_root: normalizeSlashes(resolveRunRootPath(artifactPaths, run.run_id)),
      event_root: normalizeSlashes(resolveAttemptEventsRoot(artifactPaths, run.run_id, attempt.attempt_id)),
      worktree_path: state.worktree_path ?? null
    }
  };
}

async function writeExecutionContract({ paths, artifactPaths = null, run, contract }) {
  const contractPath = resolveRunContractPath(paths, run.run_id);
  const featureContractPath = paths.executionContractPath;
  await mkdir(resolveRunRootPath(paths, run.run_id), { recursive: true });
  const resolvedArtifactPaths = artifactPaths ?? buildArtifactPaths(paths, null);

  let revision = 1;
  if (await pathExists(featureContractPath)) {
    try {
      const existing = await readJson(featureContractPath);
      const baseExisting = stripExecutionContractRevision(existing);
      const baseNext = stripExecutionContractRevision(contract);
      revision = sameJson(baseExisting, baseNext)
        ? Math.max(safeInteger(existing.contract_revision, 1), 1)
        : Math.max(safeInteger(existing.contract_revision, 1), 1) + 1;
    } catch {
      revision = Math.max(safeInteger(run.contract_revision, 1), 1) + 1;
    }
  }

  const next = {
    ...contract,
    contract_revision: revision
  };
  await writeJsonAtomic(featureContractPath, next);
  await writeJsonAtomic(contractPath, next);
  run.contract_revision = revision;
  run.contract_path = normalizeSlashes(resolveRunContractPath(resolvedArtifactPaths, run.run_id));
  run.feature_contract_path = normalizeSlashes(resolvedArtifactPaths.executionContractPath);
  run.run_root = normalizeSlashes(resolveRunRootPath(resolvedArtifactPaths, run.run_id));
  run.updated_at = nowIso();
  return next;
}

async function loadLiveExecutionContractSeed(paths, run) {
  for (const candidate of [paths.executionContractPath, resolveRunContractPath(paths, run.run_id)]) {
    if (!(await pathExists(candidate))) {
      continue;
    }
    try {
      const contract = await readJson(candidate);
      if (isPlainObject(contract)) {
        return contract;
      }
    } catch {
      // Ignore malformed stale contract content and fall back to a minimal live snapshot.
    }
  }
  return {};
}

function buildLiveContractWorkerSelection(existingContract, state) {
  const existingSelection = isPlainObject(existingContract?.worker_selection) ? existingContract.worker_selection : {};
  const defaults = {};
  const overrides = {};
  const continuity = {};
  const resolved = {};
  const resolvedSources = {};
  const inheritance = {};

  for (const field of WORKER_SELECTION_FIELDS.filter((candidate) => candidate !== "reasoning_effort")) {
    defaults[field] = emptyToNull(existingSelection.defaults?.[field]);
    overrides[field] = emptyToNull(existingSelection.overrides?.[field]);
    if (field === "provider") {
      continuity[field] = emptyToNull(state.implementor_provider);
    } else if (field === "runtime") {
      continuity[field] = emptyToNull(state.implementor_execution_runtime);
    } else if (field === "access_mode") {
      continuity[field] = emptyToNull(state.implementor_execution_access_mode);
    } else if (field === "model") {
      continuity[field] = emptyToNull(state.implementor_model);
    } else if (field === "reasoning_effort") {
      continuity[field] = emptyToNull(state.implementor_reasoning_effort);
    }

    if (overrides[field] !== null) {
      resolved[field] = overrides[field];
      resolvedSources[field] = "explicit_override";
      inheritance[field] = false;
    } else if (continuity[field] !== null) {
      resolved[field] = continuity[field];
      resolvedSources[field] = "persisted_continuity";
      inheritance[field] = false;
    } else {
      resolved[field] = defaults[field] ?? null;
      resolvedSources[field] = "invoker_inheritance";
      inheritance[field] = true;
    }
  }

  defaults.provider = inferProviderFromWorkerSelection({
    provider: defaults.provider,
    runtime: defaults.runtime,
    accessMode: defaults.access_mode,
    model: defaults.model,
    fallbackProvider: detectInvokerProvider()
  });
  continuity.provider = inferProviderFromWorkerSelection({
    provider: continuity.provider,
    runtime: continuity.runtime,
    accessMode: continuity.access_mode,
    model: continuity.model
  });
  overrides.provider = inferProviderFromWorkerSelection({
    provider: overrides.provider,
    runtime: overrides.runtime,
    accessMode: overrides.access_mode,
    model: overrides.model
  });
  resolved.provider = inferProviderFromWorkerSelection({
    provider: resolved.provider,
    runtime: resolved.runtime,
    accessMode: resolved.access_mode,
    model: resolved.model,
    fallbackProvider: continuity.provider ?? defaults.provider ?? detectInvokerProvider()
  });
  if (resolvedSources.provider !== "explicit_override" && resolved.provider !== null) {
    const inheritedProviderSources = new Set(["persisted_continuity", "invoker_inheritance"]);
    if (!inheritedProviderSources.has(resolvedSources.provider)) {
      resolvedSources.provider = "derived_from_worker_runtime";
      inheritance.provider = false;
    }
  }

  defaults.reasoning_effort = sanitizeWorkerReasoningEffort(
    emptyToNull(existingSelection.defaults?.reasoning_effort),
    defaults.provider,
    defaults.runtime
  );
  overrides.reasoning_effort = normalizeReasoningEffortValue(emptyToNull(existingSelection.overrides?.reasoning_effort));
  continuity.reasoning_effort = normalizeReasoningEffortValue(state.implementor_reasoning_effort);

  const resolvedReasoning = resolveWorkerReasoningSelection({
    defaults,
    continuity,
    overrides,
    resolved
  });
  resolved.reasoning_effort = resolvedReasoning.value;
  resolvedSources.reasoning_effort = resolvedReasoning.source;
  inheritance.reasoning_effort = resolvedReasoning.source === "invoker_inheritance";

  return {
    defaults,
    continuity,
    overrides,
    resolved,
    resolved_sources: resolvedSources,
    inheritance
  };
}

function resolveWorkerReasoningSelection({ defaults, continuity, overrides, resolved }) {
  const targetProvider = resolved.provider ?? continuity.provider ?? defaults.provider ?? null;
  const targetRuntime = resolved.runtime ?? continuity.runtime ?? defaults.runtime ?? null;

  const explicitValue = sanitizeWorkerReasoningEffort(overrides.reasoning_effort, targetProvider, targetRuntime);
  if (overrides.reasoning_effort !== null) {
    return {
      value: explicitValue,
      source: explicitValue === null ? "unsupported_for_resolved_worker" : "explicit_override"
    };
  }

  const continuityMatchesTarget =
    sameWorkerSelectionTarget(continuity.provider, continuity.runtime, targetProvider, targetRuntime);
  if (continuityMatchesTarget) {
    const continuityValue = sanitizeWorkerReasoningEffort(
      continuity.reasoning_effort,
      continuity.provider,
      continuity.runtime
    );
    if (continuityValue !== null) {
      return { value: continuityValue, source: "persisted_continuity" };
    }
  }

  const defaultsMatchTarget =
    sameWorkerSelectionTarget(defaults.provider, defaults.runtime, targetProvider, targetRuntime);
  if (defaultsMatchTarget) {
    const defaultValue = sanitizeWorkerReasoningEffort(
      defaults.reasoning_effort,
      defaults.provider,
      defaults.runtime
    );
    if (defaultValue !== null) {
      return { value: defaultValue, source: "invoker_inheritance" };
    }
  }

  return { value: null, source: "unsupported_for_resolved_worker" };
}

function sameWorkerSelectionTarget(leftProvider, leftRuntime, rightProvider, rightRuntime) {
  return emptyToNull(leftProvider) === emptyToNull(rightProvider)
    && emptyToNull(leftRuntime) === emptyToNull(rightRuntime);
}

function defaultReasoningEffortForRuntime(runtime) {
  if (runtime === "codex_cli_exec" || runtime === "native_agent_tools") {
    return "xhigh";
  }
  return null;
}

function normalizeReasoningEffortValue(value) {
  const normalized = emptyToNull(value);
  if (!isFilled(normalized)) return null;
  if (/^(true|false)$/i.test(String(normalized).trim())) {
    return null;
  }
  return String(normalized).trim();
}

function workerSupportsReasoningEffort(provider, runtime) {
  if (runtime === "codex_cli_exec" || runtime === "native_agent_tools") {
    return true;
  }
  if (provider === "codex") {
    return true;
  }
  return false;
}

function sanitizeWorkerReasoningEffort(value, provider, runtime) {
  const normalized = normalizeReasoningEffortValue(value);
  if (!normalized) return null;
  if (!workerSupportsReasoningEffort(provider, runtime)) {
    return null;
  }
  return normalized;
}

function buildLiveExecutionContract({ paths, state, run, attempt, workerKey, existingContract }) {
  const artifactPaths = buildArtifactPaths(paths, state);
  const featureIdentity = isPlainObject(existingContract?.feature_identity) ? existingContract.feature_identity : {};
  const routePolicy = isPlainObject(existingContract?.route_policy) ? existingContract.route_policy : {};
  const reviewHandoff = isPlainObject(existingContract?.review_handoff) ? existingContract.review_handoff : {};
  const benchmarking = isPlainObject(existingContract?.benchmarking) ? existingContract.benchmarking : {};
  const resumePolicy = isPlainObject(existingContract?.resume_policy) ? existingContract.resume_policy : {};
  const resetPolicy = isPlainObject(existingContract?.reset_policy) ? existingContract.reset_policy : {};
  const kpiPolicy = isPlainObject(existingContract?.kpi_policy) ? existingContract.kpi_policy : {};
  const integrity = isPlainObject(existingContract?.integrity) ? existingContract.integrity : {};
  const artifacts = isPlainObject(existingContract?.artifacts) ? existingContract.artifacts : {};
  const invokerRuntime = isPlainObject(existingContract?.invoker_runtime) ? existingContract.invoker_runtime : {};
  const workerSelection = buildLiveContractWorkerSelection(existingContract, state);

  return {
    schema_version: EXECUTION_CONTRACT_SCHEMA_VERSION,
    contract_kind: "implement-plan-execution",
    contract_revision: run.contract_revision,
    prepared_at: nowIso(),
    feature_identity: {
      ...featureIdentity,
      project_root: normalizeSlashes(state.project_root ?? featureIdentity.project_root ?? null),
      phase_number: state.phase_number,
      feature_slug: state.feature_slug,
      feature_registry_key: paths.registryKey,
      feature_root: normalizeSlashes(artifactPaths.featureRoot)
    },
    run_identity: {
      ...(isPlainObject(existingContract?.run_identity) ? existingContract.run_identity : {}),
      run_mode: run.run_mode,
      run_id: run.run_id,
      attempt_id: attempt.attempt_id,
      attempt_number: attempt.attempt_number,
      lane_id: run.benchmark_context?.lane_id ?? null,
      worker_id: workerKey
    },
    invoker_runtime: {
      ...invokerRuntime,
      provider: emptyToNull(invokerRuntime.provider) ?? workerSelection.defaults.provider ?? detectInvokerProvider(),
      execution_runtime: emptyToNull(invokerRuntime.execution_runtime) ?? workerSelection.defaults.runtime ?? null,
      control_plane_runtime: emptyToNull(invokerRuntime.control_plane_runtime) ?? emptyToNull(invokerRuntime.execution_runtime) ?? workerSelection.defaults.runtime ?? null,
      access_mode: emptyToNull(invokerRuntime.access_mode) ?? workerSelection.defaults.access_mode ?? null,
      model: emptyToNull(invokerRuntime.model) ?? workerSelection.defaults.model ?? null,
      reasoning_effort: sanitizeWorkerReasoningEffort(
        emptyToNull(invokerRuntime.reasoning_effort) ?? workerSelection.defaults.reasoning_effort ?? null,
        emptyToNull(invokerRuntime.provider) ?? workerSelection.defaults.provider ?? detectInvokerProvider(),
        emptyToNull(invokerRuntime.execution_runtime) ?? workerSelection.defaults.runtime ?? null
      ),
      runtime_permission_model: emptyToNull(invokerRuntime.runtime_permission_model) ?? emptyToNull(state.resolved_runtime_permission_model),
      selection_source: invokerRuntime.selection_source ?? "invoker_runtime_defaults"
    },
    worker_selection: workerSelection,
    route_policy: {
      normal_mode_governed_flow: routePolicy.normal_mode_governed_flow ?? NORMAL_ROUTE_STEP_ORDER,
      normal_mode_requires_review_cycle_when_requested: routePolicy.normal_mode_requires_review_cycle_when_requested ?? true,
      human_testing_requires_route_level_review_gate: routePolicy.human_testing_requires_route_level_review_gate ?? true,
      merge_completion_required_for_terminal_completion: routePolicy.merge_completion_required_for_terminal_completion ?? true,
      supported_operator_stop_surface: routePolicy.supported_operator_stop_surface ?? false,
      supported_reset_surface: routePolicy.supported_reset_surface ?? "helper-reset-attempt",
      normal_mode_shortcuts_allowed: routePolicy.normal_mode_shortcuts_allowed ?? false
    },
    review_handoff: {
      post_send_to_review: reviewHandoff.post_send_to_review ?? false,
      review_until_complete: reviewHandoff.review_until_complete ?? false,
      review_max_cycles: reviewHandoff.review_max_cycles ?? null,
      review_required_by_human_plan: reviewHandoff.review_required_by_human_plan ?? false
    },
    benchmarking: {
      enabled: run.run_mode === "benchmarking",
      supervisor_status: run.run_mode === "benchmarking"
        ? (emptyToNull(benchmarking.supervisor_status) ?? "deferred_to_spec_2")
        : "not_applicable",
      benchmark_run_id: run.benchmark_context?.benchmark_run_id ?? null,
      benchmark_suite_id: run.benchmark_context?.benchmark_suite_id ?? null,
      lane_id: run.benchmark_context?.lane_id ?? null,
      lane_label: run.benchmark_context?.lane_label ?? null
    },
    resume_policy: {
      resumable_after_crash_or_kill: resumePolicy.resumable_after_crash_or_kill ?? true,
      reuse_cached_workers_when_valid: resumePolicy.reuse_cached_workers_when_valid ?? true,
      recreate_workers_when_invalid: resumePolicy.recreate_workers_when_invalid ?? true,
      last_truthful_checkpoint: attempt.resume_checkpoint
    },
    reset_policy: {
      supported: resetPolicy.supported ?? true,
      behavior: resetPolicy.behavior ?? "new_attempt_from_implementation_preserving_history",
      next_attempt_number: run.attempt_counter + 1
    },
    kpi_policy: {
      source: kpiPolicy.source ?? "governed_production_flow",
      step_timing_enabled: kpiPolicy.step_timing_enabled ?? true,
      governance_call_timing_enabled: kpiPolicy.governance_call_timing_enabled ?? true,
      verification_outcomes_enabled: kpiPolicy.verification_outcomes_enabled ?? true,
      review_and_self_fix_counts_enabled: kpiPolicy.review_and_self_fix_counts_enabled ?? true,
      blocker_classification_enabled: kpiPolicy.blocker_classification_enabled ?? true,
      terminal_status_enabled: kpiPolicy.terminal_status_enabled ?? true
    },
    integrity,
    artifacts: {
      ...artifacts,
      state_path: normalizeSlashes(artifactPaths.statePath),
      markdown_contract_path: normalizeSlashes(artifactPaths.contractPath),
      execution_contract_path: normalizeSlashes(artifactPaths.executionContractPath),
      run_contract_path: normalizeSlashes(resolveRunContractPath(artifactPaths, run.run_id)),
      run_projection_path: normalizeSlashes(resolveRunProjectionPath(artifactPaths, run.run_id)),
      execution_run_root: normalizeSlashes(resolveRunRootPath(artifactPaths, run.run_id)),
      event_root: normalizeSlashes(resolveAttemptEventsRoot(artifactPaths, run.run_id, attempt.attempt_id)),
      worktree_path: state.worktree_path ?? null
    }
  };
}

async function syncLiveNormalExecutionArtifacts({ paths, state, run, attempt, workerKey }) {
  if (!run || !attempt || run.run_mode !== "normal") {
    return null;
  }
  const artifactPaths = buildArtifactPaths(paths, state);

  const executionContract = await writeExecutionContract({
    paths,
    artifactPaths,
    run,
    contract: buildLiveExecutionContract({
      paths,
      state,
      run,
      attempt,
      workerKey,
      existingContract: await loadLiveExecutionContractSeed(paths, run)
    })
  });
  const runProjectionPath = await writeRunProjection({ paths, artifactPaths, run, state });
  state.artifacts = {
    ...(state.artifacts ?? {}),
    readme_path: normalizeSlashes(artifactPaths.readmePath),
    context_path: normalizeSlashes(artifactPaths.contextPath),
    state_path: normalizeSlashes(artifactPaths.statePath),
    contract_path: normalizeSlashes(artifactPaths.contractPath),
    execution_contract_path: executionContract.artifacts.execution_contract_path,
    execution_run_contract_path: executionContract.artifacts.run_contract_path,
    execution_run_projection_path: runProjectionPath,
    pushback_path: normalizeSlashes(artifactPaths.pushbackPath),
    brief_path: normalizeSlashes(artifactPaths.briefPath),
    completion_summary_path: normalizeSlashes(artifactPaths.completionSummaryPath),
    implementation_run_dir: normalizeSlashes(artifactPaths.implementationRunDir),
    worktree_path: state.worktree_path ?? normalizeSlashes(resolveFeatureWorktreePath(paths))
  };
  return {
    executionContract,
    runProjectionPath
  };
}

function stripExecutionContractRevision(contract) {
  if (!isPlainObject(contract)) {
    return {};
  }
  const next = { ...contract };
  delete next.contract_revision;
  delete next.prepared_at;
  return next;
}

async function appendExecutionAuditEvent({ paths, state, run, attempt, eventType, payload = {}, occurredAt = nowIso() }) {
  const result = await appendJsonEvent(resolveAttemptEventsRoot(paths, run.run_id, attempt.attempt_id), {
    schema_version: 1,
    event_type: eventType,
    feature_registry_key: paths.registryKey,
    run_id: run.run_id,
    run_mode: run.run_mode,
    attempt_id: attempt.attempt_id,
    occurred_at: occurredAt,
    payload
  });

  state.event_log = Array.isArray(state.event_log) ? state.event_log : [];
  state.event_log.push({
    event_id: result.payload.event_id,
    event_type: eventType,
    run_id: run.run_id,
    run_mode: run.run_mode,
    attempt_id: attempt.attempt_id,
    timestamp: occurredAt,
    note: payload.note ?? null
  });
  state.event_log = state.event_log.slice(-100);
  run.last_event_at = occurredAt;
  attempt.last_event_at = occurredAt;
  return result;
}

function buildRunProjection(paths, run, state = null, artifactPaths = null) {
  const resolvedArtifactPaths = artifactPaths ?? buildArtifactPaths(paths, state);
  const currentAttempt = run.attempts?.[run.current_attempt_id] ?? null;
  return {
    schema_version: RUN_PROJECTION_SCHEMA_VERSION,
    projection_kind: "implement-plan-run-projection",
    feature_registry_key: paths.registryKey,
    run_id: run.run_id,
    run_mode: run.run_mode,
    updated_at: nowIso(),
    artifacts: {
      execution_contract_path: normalizeSlashes(resolvedArtifactPaths.executionContractPath),
      run_contract_path: normalizeSlashes(resolveRunContractPath(resolvedArtifactPaths, run.run_id)),
      run_projection_path: normalizeSlashes(resolveRunProjectionPath(resolvedArtifactPaths, run.run_id)),
      event_root: normalizeSlashes(resolveAttemptEventsRoot(resolvedArtifactPaths, run.run_id, currentAttempt?.attempt_id ?? run.current_attempt_id))
    },
    run
  };
}

async function writeRunProjection({ paths, artifactPaths = null, run, state = null }) {
  const projectionPath = resolveRunProjectionPath(paths, run.run_id);
  await mkdir(resolveRunRootPath(paths, run.run_id), { recursive: true });
  const resolvedArtifactPaths = artifactPaths ?? buildArtifactPaths(paths, state);
  await writeJsonAtomic(projectionPath, buildRunProjection(paths, run, state, resolvedArtifactPaths));
  run.projection_path = normalizeSlashes(resolveRunProjectionPath(resolvedArtifactPaths, run.run_id));
  run.run_root = normalizeSlashes(resolveRunRootPath(resolvedArtifactPaths, run.run_id));
  return normalizeSlashes(resolveRunProjectionPath(resolvedArtifactPaths, run.run_id));
}

function updateAttemptCheckpoint(attempt, step, status, reason) {
  attempt.resume_checkpoint = {
    step,
    status,
    reason,
    updated_at: nowIso()
  };
  attempt.last_checkpoint_at = attempt.resume_checkpoint.updated_at;
}

function syncNormalRunProjectionFromState({ state, run, attempt, workerKey, workerSelection }) {
  attempt.status = legacyActiveRunStatusToAttemptStatus(state.active_run_status);
  attempt.terminal_status = state.active_run_status === "completed" ? "completed" : state.active_run_status === "blocked" ? "blocked" : null;
  attempt.updated_at = nowIso();
  attempt.step_status = buildLegacyStepStatusMap(state.run_timestamps ?? {}, state.active_run_status, {
    last_completed_step: state.last_completed_step,
    merge_status: state.merge_status,
    state_updated_at: state.updated_at ?? nowIso()
  });
  attempt.review_cycle_count = Math.max(
    safeInteger(attempt.review_cycle_count, 0),
    (state.run_timestamps?.review_requested_at ? 1 : 0)
  );
  const existingBinding = attempt.worker_bindings?.[workerKey] ?? buildWorkerBinding(workerKey, workerSelection);
  attempt.worker_bindings[workerKey] = {
    ...existingBinding,
    provider: state.implementor_provider ?? workerSelection.resolved.provider ?? null,
    runtime: state.implementor_execution_runtime ?? workerSelection.resolved.runtime ?? null,
    model: state.implementor_model ?? workerSelection.resolved.model ?? null,
    reasoning_effort: sanitizeWorkerReasoningEffort(
      state.implementor_reasoning_effort ?? workerSelection.resolved.reasoning_effort ?? null,
      state.implementor_provider ?? workerSelection.resolved.provider ?? null,
      state.implementor_execution_runtime ?? workerSelection.resolved.runtime ?? null
    ),
    access_mode: state.implementor_execution_access_mode ?? workerSelection.resolved.access_mode ?? null,
    execution_id: state.implementor_execution_id ?? null,
    selection_source: {
      ...(isPlainObject(existingBinding.selection_source) ? existingBinding.selection_source : {}),
      ...buildWorkerBinding(workerKey, workerSelection).selection_source
    }
  };
  updateAttemptCheckpoint(
    attempt,
    legacyLastCompletedStepToResumeStep(state.last_completed_step, state.active_run_status, state.merge_status),
    legacyResumeCheckpointStatus(state.active_run_status),
    "Resume from the last truthful normal-mode checkpoint."
  );
  run.lifecycle_status = state.active_run_status === "completed"
    ? "completed"
    : state.active_run_status === "blocked" || state.active_run_status === "integrity_failed"
      ? "blocked"
      : "active";
  run.terminal_status = attempt.terminal_status;
  run.updated_at = nowIso();
}

function syncBenchmarkingProjection({ run, attempt, integrity }) {
  attempt.status = integrity.blocking_issues.length > 0 ? "blocked" : "supervisor_deferred";
  attempt.terminal_status = attempt.status === "blocked" ? "blocked" : null;
  attempt.updated_at = nowIso();
  updateAttemptCheckpoint(
    attempt,
    "implementation",
    integrity.blocking_issues.length > 0 ? "blocked" : "ready",
    integrity.blocking_issues.length > 0
      ? "Benchmarking contract blocked at integrity gate."
      : "Benchmarking contract materialized. External supervisor is deferred to Spec 2."
  );
  run.lifecycle_status = integrity.blocking_issues.length > 0 ? "blocked" : "supervisor_deferred";
  run.terminal_status = attempt.terminal_status;
  run.updated_at = nowIso();
}

function buildRunKpiProjection(run) {
  const attempt = run.attempts?.[run.current_attempt_id] ?? null;
  if (!attempt) {
    return {
      terminal_status: run.terminal_status ?? null,
      per_step_timing: {},
      governance_call_metrics: normalizeGovernanceMetrics(null),
      verification_outcomes: [],
      review_cycle_count: 0,
      self_fix_cycle_count: 0,
      blocker_history: []
    };
  }

  const perStepTiming = {};
  for (const step of NORMAL_ROUTE_STEP_ORDER) {
    const summary = attempt.step_status?.[step] ?? defaultStepStatus();
    perStepTiming[step] = {
      status: summary.status,
      started_at: summary.started_at,
      completed_at: summary.completed_at,
      duration_seconds: summary.duration_seconds
    };
  }

  return {
    terminal_status: attempt.terminal_status ?? run.terminal_status ?? null,
    per_step_timing: perStepTiming,
    governance_call_metrics: attempt.governance_metrics ?? normalizeGovernanceMetrics(null),
    verification_outcomes: attempt.verification_outcomes ?? [],
    review_cycle_count: attempt.review_cycle_count ?? 0,
    self_fix_cycle_count: attempt.self_fix_cycle_count ?? 0,
    blocker_history: attempt.blockers ?? []
  };
}

function buildLegacyRunTimestampsFromAttempt(attempt, previousRunTimestamps = {}) {
  return {
    context_collected_at: emptyToNull(previousRunTimestamps.context_collected_at),
    worktree_prepared_at: emptyToNull(previousRunTimestamps.worktree_prepared_at),
    integrity_passed_at: emptyToNull(previousRunTimestamps.integrity_passed_at),
    integrity_failed_at: emptyToNull(previousRunTimestamps.integrity_failed_at),
    brief_written_at: emptyToNull(previousRunTimestamps.brief_written_at),
    implementor_started_at: attempt.step_status?.implementation?.started_at ?? null,
    implementor_finished_at: attempt.step_status?.implementation?.completed_at ?? null,
    verification_finished_at: attempt.step_status?.machine_verification?.completed_at ?? null,
    review_requested_at: attempt.step_status?.review_cycle?.started_at ?? null,
    human_verification_requested_at: attempt.step_status?.human_testing?.started_at ?? null,
    merge_started_at: attempt.step_status?.merge_queue?.started_at ?? null,
    merge_finished_at: attempt.step_status?.merge_queue?.completed_at ?? null,
    closeout_finished_at: attempt.terminal_status === "completed" ? (attempt.updated_at ?? nowIso()) : null
  };
}

function syncLegacyNormalStateFromRun({ state, run, preserveFeatureStatus = true }) {
  const attempt = run?.attempts?.[run.current_attempt_id] ?? null;
  if (!attempt) {
    return;
  }

  const workerKey = run.worker_keys?.[0] ?? buildWorkerKey("implementor", run.benchmark_context?.lane_id ?? null);
  const workerBinding = attempt.worker_bindings?.[workerKey] ?? null;

  state.current_run_id = run.run_id;
  state.current_attempt_id = attempt.attempt_id;
  state.run_timestamps = buildLegacyRunTimestampsFromAttempt(attempt, state.run_timestamps ?? {});
  state.active_run_status = deriveLegacyActiveRunStatusFromAttempt(attempt, state);
  state.last_completed_step = deriveLegacyLastCompletedStepFromAttempt(attempt, state.active_run_status);
  state.merge_required = true;
  state.merge_status = deriveLegacyMergeStatusFromAttempt(attempt, state.merge_status ?? null);
  state.local_target_sync_status = state.local_target_sync_status ?? "not_started";
  state.last_commit_sha = state.last_commit_sha ?? null;
  state.last_error = state.active_run_status === "blocked" ? (attempt.resume_checkpoint?.reason ?? state.last_error ?? null) : state.last_error ?? null;

  if (!preserveFeatureStatus) {
    state.feature_status = attempt.terminal_status === "completed"
      ? "completed"
      : attempt.terminal_status === "blocked"
        ? "blocked"
        : "active";
  }

  if (workerBinding) {
    state.implementor_provider = workerBinding.provider ?? state.implementor_provider ?? null;
    state.implementor_execution_runtime = workerBinding.runtime ?? state.implementor_execution_runtime ?? null;
    state.implementor_execution_access_mode = workerBinding.access_mode ?? state.implementor_execution_access_mode ?? null;
    state.implementor_model = workerBinding.model ?? state.implementor_model ?? null;
    state.implementor_reasoning_effort = sanitizeWorkerReasoningEffort(
      workerBinding.reasoning_effort ?? state.implementor_reasoning_effort ?? null,
      workerBinding.provider ?? state.implementor_provider ?? null,
      workerBinding.runtime ?? state.implementor_execution_runtime ?? null
    );
    state.implementor_execution_id = workerBinding.execution_id ?? state.implementor_execution_id ?? null;
  }

  state.artifacts = {
    ...(state.artifacts ?? {}),
    execution_contract_path: run.feature_contract_path ?? state.artifacts?.execution_contract_path ?? null,
    execution_run_contract_path: run.contract_path ?? state.artifacts?.execution_run_contract_path ?? null,
    execution_run_projection_path: run.projection_path ?? state.artifacts?.execution_run_projection_path ?? null
  };
}

function deriveLegacyActiveRunStatusFromAttempt(attempt, state) {
  const steps = attempt.step_status ?? {};
  if (attempt.terminal_status === "completed") return "completed";
  if (attempt.terminal_status === "blocked" || attempt.status === "blocked") return "blocked";
  if (steps.merge_queue?.status === "in_progress") return "merge_in_progress";
  if (steps.merge_queue?.status === "ready") return "merge_ready";
  if (steps.human_testing?.status === "in_progress" || steps.human_testing?.status === "ready") return "human_verification_pending";
  if (steps.review_cycle?.status === "in_progress" || steps.review_cycle?.status === "ready") return "review_pending";
  if (steps.machine_verification?.status === "completed") return "closeout_pending";
  if (steps.machine_verification?.status === "in_progress" || steps.machine_verification?.status === "ready") return "verification_pending";
  if (steps.implementation?.status === "completed") return "verification_pending";
  if (steps.implementation?.status === "in_progress") return "implementation_running";
  return state.worktree_status === "ready" ? "context_ready" : "idle";
}

function deriveLegacyLastCompletedStepFromAttempt(attempt, activeRunStatus) {
  if (activeRunStatus === "completed") return "marked_complete";
  if (activeRunStatus === "merge_in_progress" || activeRunStatus === "merge_ready") return "merge_ready";
  if (activeRunStatus === "review_pending") return "review_requested";
  if (activeRunStatus === "human_verification_pending") return "human_verification_requested";
  if (activeRunStatus === "verification_pending") {
    return attempt.step_status?.machine_verification?.status === "completed"
      ? "verification_finished"
      : "implementor_finished";
  }
  if (activeRunStatus === "closeout_pending") {
    return attempt.step_status?.merge_queue?.status === "completed"
      ? "merge_finished"
      : "verification_finished";
  }
  if (activeRunStatus === "implementation_running") return "implementor_started";

  const ordered = [
    ["merge_queue", "merge_finished"],
    ["human_testing", "human_verification_requested"],
    ["review_cycle", "review_requested"],
    ["machine_verification", "verification_finished"],
    ["implementation", "implementor_finished"]
  ];
  for (const [step, legacyStep] of ordered) {
    if (attempt.step_status?.[step]?.status === "completed") {
      return legacyStep;
    }
  }
  return "context_collected";
}

function deriveLegacyMergeStatusFromAttempt(attempt, fallbackMergeStatus) {
  const mergeStep = attempt.step_status?.merge_queue ?? defaultStepStatus();
  if (attempt.terminal_status === "completed" || mergeStep.status === "completed") return "merged";
  if (mergeStep.status === "in_progress") return "in_progress";
  if (mergeStep.status === "ready") return "ready_to_queue";
  if (mergeStep.status === "blocked" || attempt.status === "blocked") return "blocked";
  return fallbackMergeStatus ?? "not_ready";
}

function hasRecordedLocalTargetSyncStatus(localTargetSyncStatus) {
  return isFilled(localTargetSyncStatus) && localTargetSyncStatus !== "not_started";
}

function hasGuardedNormalCompletionEvidence(state) {
  const completionCommit = emptyToNull(state.merge_commit_sha ?? state.last_commit_sha ?? null);
  return state.feature_status === "completed"
    && state.active_run_status === "completed"
    && state.last_completed_step === "marked_complete"
    && state.merge_status === "merged"
    && isFilled(completionCommit)
    && hasRecordedLocalTargetSyncStatus(state.local_target_sync_status);
}

function resolveRunForMutation(state, runMode = "normal", explicitRunId = null) {
  const runId = explicitRunId
    ?? (runMode ? state.execution_runs?.active_by_mode?.[runMode] ?? null : null)
    ?? state.current_run_id
    ?? null;
  if (!runId) {
    return null;
  }
  return state.execution_runs?.runs?.[runId] ?? null;
}

function resolveAttemptForMutation(run, explicitAttemptId = null) {
  if (!run) return null;
  const attemptId = explicitAttemptId ?? run.current_attempt_id ?? null;
  if (!attemptId) return null;
  return run.attempts?.[attemptId] ?? null;
}

async function loadEventPayload(payloadFile) {
  if (!payloadFile) {
    return {};
  }
  const payload = await readJson(payloadFile);
  if (!isPlainObject(payload)) {
    fail("Event payload file must contain a JSON object.");
  }
  return payload;
}

function applyStructuredExecutionEvent({ state, run, attempt, eventType, payload, occurredAt }) {
  switch (eventType) {
    case "worker-bound": {
      const workerId = emptyToNull(payload.worker_id) ?? run.worker_keys?.[0] ?? buildWorkerKey("implementor", run.benchmark_context?.lane_id ?? null);
      attempt.worker_bindings = isPlainObject(attempt.worker_bindings) ? attempt.worker_bindings : {};
      attempt.worker_bindings[workerId] = {
        ...(attempt.worker_bindings?.[workerId] ?? {}),
        ...payload.worker_binding
      };
      run.worker_keys = [workerId];
      break;
    }
    case "step-transition": {
      const step = parseOptionalStepName(payload.step ?? null, "payload.step");
      const stepStatus = parseOptionalStepStatus(payload.status ?? null, "payload.status");
      if (!step || !stepStatus) {
        fail("Structured step-transition events require payload.step and payload.status.");
      }
      const target = attempt.step_status?.[step] ?? defaultStepStatus();
      if (stepStatus === "in_progress" || stepStatus === "ready") {
        target.started_at = target.started_at ?? occurredAt;
      }
      if (["completed", "blocked", "skipped", "invalidated"].includes(stepStatus)) {
        target.completed_at = occurredAt;
      }
      target.status = stepStatus;
      target.duration_seconds = target.started_at && target.completed_at ? diffSeconds(target.started_at, target.completed_at) : target.duration_seconds;
      target.note = emptyToNull(payload.note) ?? target.note;
      attempt.step_status[step] = target;
      updateAttemptCheckpoint(
        attempt,
        step,
        stepStatus,
        emptyToNull(payload.reason) ?? ("Structured step transition recorded for " + step + ".")
      );
      attempt.status = stepToAttemptStatus(step, stepStatus, attempt.status);
      break;
    }
    case "governance-call-recorded": {
      attempt.governance_calls = Array.isArray(attempt.governance_calls) ? attempt.governance_calls : [];
      const call = {
        call_id: emptyToNull(payload.call_id) ?? createOpaqueId("gov-call"),
        role: emptyToNull(payload.role),
        kind: emptyToNull(payload.kind),
        provider: emptyToNull(payload.provider),
        runtime: emptyToNull(payload.runtime),
        model: emptyToNull(payload.model),
        reasoning_effort: emptyToNull(payload.reasoning_effort),
        started_at: emptyToNull(payload.started_at),
        ended_at: emptyToNull(payload.ended_at) ?? occurredAt,
        duration_ms: Number(payload.duration_ms ?? 0) || 0,
        estimated_prompt_tokens: safeInteger(payload.estimated_prompt_tokens, 0),
        estimated_completion_tokens: safeInteger(payload.estimated_completion_tokens, 0),
        estimated_total_tokens: safeInteger(payload.estimated_total_tokens, 0),
        estimated_cost_usd: Number(payload.estimated_cost_usd ?? 0) || 0
      };
      attempt.governance_calls.push(call);
      attempt.governance_metrics = normalizeGovernanceMetrics({
        call_count: (attempt.governance_metrics?.call_count ?? 0) + 1,
        total_duration_ms: (attempt.governance_metrics?.total_duration_ms ?? 0) + call.duration_ms,
        total_estimated_cost_usd: Number((attempt.governance_metrics?.total_estimated_cost_usd ?? 0) + call.estimated_cost_usd),
        total_prompt_tokens_estimated: (attempt.governance_metrics?.total_prompt_tokens_estimated ?? 0) + call.estimated_prompt_tokens,
        total_completion_tokens_estimated: (attempt.governance_metrics?.total_completion_tokens_estimated ?? 0) + call.estimated_completion_tokens,
        total_tokens_estimated: (attempt.governance_metrics?.total_tokens_estimated ?? 0) + call.estimated_total_tokens
      });
      break;
    }
    case "verification-recorded": {
      const outcome = {
        verification_id: emptyToNull(payload.verification_id) ?? createOpaqueId("verification"),
        kind: emptyToNull(payload.kind) ?? "machine",
        status: emptyToNull(payload.status) ?? "unknown",
        review_cycle_number: safeInteger(payload.review_cycle_number, 0),
        self_fix_cycle_number: safeInteger(payload.self_fix_cycle_number, 0),
        note: emptyToNull(payload.note),
        recorded_at: occurredAt
      };
      attempt.verification_outcomes = Array.isArray(attempt.verification_outcomes) ? attempt.verification_outcomes : [];
      attempt.verification_outcomes.push(outcome);
      attempt.review_cycle_count = Math.max(attempt.review_cycle_count ?? 0, outcome.review_cycle_number ?? 0);
      attempt.self_fix_cycle_count = Math.max(attempt.self_fix_cycle_count ?? 0, outcome.self_fix_cycle_number ?? 0);
      break;
    }
    case "blocker-recorded": {
      attempt.blockers = Array.isArray(attempt.blockers) ? attempt.blockers : [];
      attempt.blockers.push({
        classification: emptyToNull(payload.classification) ?? "unspecified",
        step: emptyToNull(payload.step),
        note: emptyToNull(payload.note),
        recorded_at: occurredAt
      });
      attempt.status = "blocked";
      attempt.terminal_status = emptyToNull(payload.terminal_status) ?? "blocked";
      updateAttemptCheckpoint(
        attempt,
        emptyToNull(payload.step) ?? "implementation",
        "blocked",
        emptyToNull(payload.note) ?? "A blocker was recorded."
      );
      break;
    }
    case "terminal-status-recorded": {
      const terminalStatus = emptyToNull(payload.terminal_status) ?? "completed";
      if (run.run_mode === "normal" && terminalStatus === "completed" && !hasGuardedNormalCompletionEvidence(state)) {
        fail("Refusing to record terminal completion for the normal-mode route before guarded merge-backed closeout evidence exists.");
      }
      attempt.terminal_status = terminalStatus;
      attempt.status = terminalStatus === "blocked" ? "blocked" : terminalStatus === "completed" ? "completed" : attempt.status;
      run.terminal_status = terminalStatus;
      run.lifecycle_status = terminalStatus === "blocked" ? "blocked" : terminalStatus === "completed" ? "completed" : run.lifecycle_status;
      updateAttemptCheckpoint(
        attempt,
        emptyToNull(payload.step) ?? "merge_queue",
        terminalStatus === "completed" ? "completed" : "blocked",
        emptyToNull(payload.note) ?? "Terminal status was recorded."
      );
      break;
    }
    default:
      break;
  }

  attempt.updated_at = occurredAt;
  attempt.last_event_at = occurredAt;
  run.updated_at = occurredAt;
  run.last_event_at = occurredAt;
  run.kpi_projection = buildRunKpiProjection(run);

  if (run.run_mode === "normal") {
    state.run_timestamps = buildLegacyRunTimestampsFromAttempt(attempt, state.run_timestamps ?? {});
  }
}

function stepToAttemptStatus(step, stepStatus, fallbackStatus) {
  if (stepStatus === "blocked") return "blocked";
  if (step === "implementation") return stepStatus === "completed" ? "verification_pending" : stepStatus === "in_progress" ? "implementation_running" : fallbackStatus;
  if (step === "machine_verification") return stepStatus === "completed" ? "closeout_pending" : stepStatus === "in_progress" ? "verification_pending" : fallbackStatus;
  if (step === "review_cycle") return stepStatus === "completed" ? "closeout_pending" : stepStatus === "in_progress" ? "review_pending" : fallbackStatus;
  if (step === "human_testing") return stepStatus === "completed" ? "merge_ready" : stepStatus === "in_progress" ? "human_testing_pending" : fallbackStatus;
  if (step === "merge_queue") return stepStatus === "completed" ? "completed" : stepStatus === "in_progress" ? "merge_in_progress" : stepStatus === "ready" ? "merge_ready" : fallbackStatus;
  return fallbackStatus;
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
  const kpiPlanState = evaluateKpiPlanState(verificationSourceText);

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

  if (!isFilled(kpiPlanState.applicability_raw)) {
    blockingIssues.push(issue(
      "missing-kpi-applicability-decision",
      "The implementation slice does not explicitly state whether KPI support is required, not required, or covered by an approved temporary exception.",
      contractSource.paths,
      "Add `KPI Applicability: required`, `KPI Applicability: not required`, or `KPI Applicability: temporary exception approved` to the contract."
    ));
  } else if (kpiPlanState.applicability === null) {
    blockingIssues.push(issue(
      "invalid-kpi-applicability-decision",
      "The implementation slice uses an unsupported KPI applicability value.",
      contractSource.paths,
      "Use one of: " + KPI_APPLICABILITY_ALLOWED_VALUES.join(", ") + "."
    ));
  } else if (kpiPlanState.applicability === "not_required") {
    if (!kpiPlanState.non_applicability_rationale_present) {
      blockingIssues.push(issue(
        "missing-kpi-non-applicability-rationale",
        "The implementation slice says KPI support is not required but does not explain why the slice is outside the KPI rule.",
        contractSource.paths,
        "Add `KPI Non-Applicability Rationale:` with the exact reason this slice is outside the KPI instrumentation requirement."
      ));
    }
  } else {
    const missingKpiFields = [];
    if (!kpiPlanState.route_or_touched_path_present) missingKpiFields.push("`KPI Route / Touched Path`");
    if (!kpiPlanState.raw_truth_source_present) missingKpiFields.push("`KPI Raw-Truth Source`");
    if (!kpiPlanState.coverage_or_proof_present) missingKpiFields.push("`KPI Coverage / Proof`");
    if (!kpiPlanState.production_proof_partition_present) missingKpiFields.push("`KPI Production / Proof Partition`");

    if (missingKpiFields.length > 0) {
      blockingIssues.push(issue(
        "incomplete-kpi-contract-freeze",
        "The implementation slice requires KPI support but does not freeze the full KPI contract.",
        contractSource.paths,
        "Add the missing KPI contract fields: " + missingKpiFields.join(", ") + "."
      ));
    }

    if (kpiPlanState.applicability === "temporary_exception_approved") {
      const missingExceptionFields = [];
      if (!kpiPlanState.exception_owner_present) missingExceptionFields.push("`KPI Exception Owner`");
      if (!kpiPlanState.exception_expiry_present) missingExceptionFields.push("`KPI Exception Expiry`");
      if (!kpiPlanState.exception_compensating_control_present) missingExceptionFields.push("`KPI Compensating Control`");
      if (!kpiPlanState.exception_production_status_present) missingExceptionFields.push("`KPI Exception Production Status`");

      if (missingExceptionFields.length > 0) {
        blockingIssues.push(issue(
          "incomplete-kpi-temporary-exception",
          "The implementation slice uses a temporary KPI exception but does not record the full approval and recovery details.",
          contractSource.paths,
          "Add the missing temporary-exception fields: " + missingExceptionFields.join(", ") + "."
        ));
      } else if (!kpiPlanState.exception_marks_not_production_complete) {
        blockingIssues.push(issue(
          "invalid-kpi-exception-production-status",
          "The temporary KPI exception does not explicitly keep the slice out of production-complete status.",
          contractSource.paths,
          "Set `KPI Exception Production Status:` to an explicit not-production-complete statement."
        ));
      }
    }
  }

  const missingCompatLabels = [];
  for (const label of COMPATIBILITY_GATE_CONTENT_LABELS) {
    if (!hasMeaningfulLabeledValue(verificationSourceText, label)) {
      missingCompatLabels.push("`" + label + "`");
    }
  }
  if (missingCompatLabels.length > 0) {
    blockingIssues.push(issue(
      "missing-compatibility-gate-fields",
      "The implementation slice does not explicitly state compatibility with the full Vision/Phase 1/Master-Plan/Gap-Closure authority chain.",
      contractSource.paths,
      "Add the missing compatibility fields: " + missingCompatLabels.join(", ") + ". Each must contain a substantive compatibility statement, not a placeholder."
    ));
  }

  const compatDecisionRaw = extractLabeledValue(verificationSourceText, "Compatibility Decision");
  if (!isFilled(compatDecisionRaw)) {
    blockingIssues.push(issue(
      "missing-compatibility-decision",
      "The implementation slice does not include a Compatibility Decision.",
      contractSource.paths,
      "Add `Compatibility Decision:` with one of: " + COMPATIBILITY_DECISION_ALLOWED_VALUES.join(", ") + "."
    ));
  } else {
    const normalizedDecision = String(compatDecisionRaw).toLowerCase().replace(/[_\s]+/g, "-").trim();
    if (!COMPATIBILITY_DECISION_ALLOWED_VALUES.includes(normalizedDecision)) {
      blockingIssues.push(issue(
        "invalid-compatibility-decision",
        "The Compatibility Decision value is not recognized.",
        contractSource.paths,
        "Use one of: " + COMPATIBILITY_DECISION_ALLOWED_VALUES.join(", ") + "."
      ));
    } else if (normalizedDecision !== "compatible") {
      blockingIssues.push(issue(
        "compatibility-decision-not-legal",
        "The Compatibility Decision is `" + normalizedDecision + "` which is not implementation-legal. Only `compatible` allows implementation to proceed.",
        contractSource.paths,
        normalizedDecision === "defer-later-company"
          ? "This slice is later-company work. Log it for a future phase instead of implementing now."
          : "This slice needs a user decision before implementation can proceed. Resolve the block and update the Compatibility Decision."
      ));
    }
  }

  const laterCompanyRaw = extractLabeledValue(verificationSourceText, "Later-Company Check");
  if (isFilled(laterCompanyRaw) && /^yes$/i.test(String(laterCompanyRaw).trim())) {
    blockingIssues.push(issue(
      "later-company-check-failed",
      "The slice is marked `Later-Company Check: yes` — it belongs to a later company phase and must not proceed.",
      contractSource.paths,
      "This work should be logged for a future phase. Do not implement later-company work in the active phase."
    ));
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

function evaluateKpiPlanState(text) {
  const source = String(text ?? "");
  const applicabilityRaw = extractLabeledValue(source, "KPI Applicability");
  const applicability = normalizeKpiApplicabilityValue(applicabilityRaw);

  return {
    applicability_raw: applicabilityRaw,
    applicability,
    route_or_touched_path_present: hasMeaningfulLabeledValue(source, "KPI Route / Touched Path"),
    raw_truth_source_present: hasMeaningfulLabeledValue(source, "KPI Raw-Truth Source"),
    coverage_or_proof_present: hasMeaningfulLabeledValue(source, "KPI Coverage / Proof"),
    production_proof_partition_present: hasMeaningfulLabeledValue(source, "KPI Production / Proof Partition"),
    non_applicability_rationale_present: hasMeaningfulLabeledValue(source, "KPI Non-Applicability Rationale"),
    exception_owner_present: hasMeaningfulLabeledValue(source, "KPI Exception Owner"),
    exception_expiry_present: hasMeaningfulLabeledValue(source, "KPI Exception Expiry"),
    exception_compensating_control_present: hasMeaningfulLabeledValue(source, "KPI Compensating Control"),
    exception_production_status_present: hasMeaningfulLabeledValue(source, "KPI Exception Production Status"),
    exception_marks_not_production_complete: /not[- ]production[- ]complete|not yet production[- ]complete|non-production/.test(
      String(extractLabeledValue(source, "KPI Exception Production Status") ?? "").toLowerCase()
    )
  };
}

function normalizeKpiApplicabilityValue(value) {
  if (!isFilled(value)) return null;
  const normalized = String(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized === "required") return "required";
  if (normalized === "not required" || normalized === "not applicable") return "not_required";
  if (
    normalized === "temporary exception approved"
    || normalized === "approved temporary exception"
    || normalized === "temporary approved exception"
  ) {
    return "temporary_exception_approved";
  }
  return null;
}

function hasMeaningfulLabeledValue(text, label) {
  const value = extractLabeledValue(text, label);
  if (!isFilled(value)) return false;
  return !KPI_PLACEHOLDER_VALUE_PATTERNS.some((pattern) => pattern.test(String(value).trim()));
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
    const activeNormalRunId = state.execution_runs?.active_by_mode?.normal ?? null;
    const activeNormalRun = activeNormalRunId ? state.execution_runs?.runs?.[activeNormalRunId] ?? null : null;
    const activeAttempt = activeNormalRun ? activeNormalRun.attempts?.[activeNormalRun.current_attempt_id] ?? null : null;
    const workerKey = activeNormalRun?.worker_keys?.[0] ?? buildWorkerKey("implementor", null);
    const workerBinding = activeAttempt?.worker_bindings?.[workerKey] ?? null;

    if (isFilled(state.implementor_execution_id) || isFilled(existing.implementor_execution_id) || activeNormalRun) {
      next.features[paths.registryKey] = {
        phase_number: paths.phaseNumber,
        feature_slug: paths.featureSlug,
        feature_root: normalizeSlashes(paths.featureRoot),
        current_run_id: activeNormalRun?.run_id ?? state.current_run_id ?? existing.current_run_id ?? null,
        current_attempt_id: activeAttempt?.attempt_id ?? state.current_attempt_id ?? existing.current_attempt_id ?? null,
        current_worker_id: workerBinding?.worker_id ?? existing.current_worker_id ?? null,
        implementor_execution_id: state.implementor_execution_id ?? workerBinding?.execution_id ?? existing.implementor_execution_id ?? null,
        implementor_execution_access_mode: state.implementor_execution_access_mode ?? workerBinding?.access_mode ?? existing.implementor_execution_access_mode ?? null,
        implementor_execution_runtime: state.implementor_execution_runtime ?? workerBinding?.runtime ?? existing.implementor_execution_runtime ?? null,
        implementor_provider: state.implementor_provider ?? workerBinding?.provider ?? existing.implementor_provider ?? null,
        implementor_model: state.implementor_model ?? workerBinding?.model ?? existing.implementor_model ?? null,
        implementor_reasoning_effort: sanitizeWorkerReasoningEffort(
          state.implementor_reasoning_effort ?? workerBinding?.reasoning_effort ?? existing.implementor_reasoning_effort ?? null,
          state.implementor_provider ?? workerBinding?.provider ?? existing.implementor_provider ?? null,
          state.implementor_execution_runtime ?? workerBinding?.runtime ?? existing.implementor_execution_runtime ?? null
        ),
        resolved_runtime_permission_model: state.resolved_runtime_permission_model ?? existing.resolved_runtime_permission_model ?? null,
        execution_contract_path: state.artifacts?.execution_contract_path ?? existing.execution_contract_path ?? null,
        execution_run_contract_path: state.artifacts?.execution_run_contract_path ?? existing.execution_run_contract_path ?? null,
        execution_run_projection_path: state.artifacts?.execution_run_projection_path ?? existing.execution_run_projection_path ?? null,
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
      current_run_id: state.current_run_id ?? null,
      current_attempt_id: state.current_attempt_id ?? null,
      normal_run_id: state.execution_runs?.active_by_mode?.normal ?? null,
      benchmarking_run_id: state.execution_runs?.active_by_mode?.benchmarking ?? null,
      execution_contract_path: state.artifacts?.execution_contract_path ?? null,
      execution_run_projection_path: state.artifacts?.execution_run_projection_path ?? null,
      merge_status: state.merge_status ?? null,
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

function extractCompletionSections(text) {
  const sections = {};
  for (const heading of COMPLETION_HEADINGS) {
    sections[heading] = extractHeadingSection(text, heading);
  }
  return sections;
}

function extractLabeledValue(text, label) {
  if (!text) return null;
  const expression = new RegExp("^" + escapeRegex(label) + "\\s*:\\s*(.+)$", "im");
  const match = expression.exec(text);
  return match ? match[1].trim() : null;
}

async function loadJsonIfExists(targetPath) {
  if (!(await pathExists(targetPath))) {
    return null;
  }
  try {
    return await readJson(targetPath);
  } catch {
    return null;
  }
}

function normalizeSection(text) {
  return String(text ?? "").trim() || "- None.";
}

function filterSectionLines(section, patterns) {
  return String(section ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => !patterns.some((pattern) => pattern.test(line.trim())));
}

function uniqueLines(lines) {
  const result = [];
  const seen = new Set();
  for (const line of lines) {
    const normalized = line.trim();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(line);
  }
  return result;
}

function buildFinalVerificationSection({ existingSection, state, reviewState, mergeCommitSha }) {
  const preservedLines = filterSectionLines(existingSection, [
    /^(?:-\s*)?Review-Cycle Status\s*:/i,
    /^(?:-\s*)?Merge Status\s*:/i,
    /^(?:-\s*)?Local Target Sync Status\s*:/i,
    /^(?:-\s*)?Execution Contract \/ Run Projection Proof\s*:/i,
    /^(?:-\s*)?Approved(?: feature)? commit\s*:/i,
    /^(?:-\s*)?Merge commit\s*:/i,
    /^(?:-\s*)?Final closeout commit\s*:/i,
    /^(?:-\s*)?Push\s*:/i
  ]);
  const lines = uniqueLines([
    ...preservedLines,
    "- Execution Contract / Run Projection Proof: repo-owned state, execution contract, and run projection now point at canonical C:/ADF artifact paths.",
    "- Review-Cycle Status: " + buildReviewCycleStatusSummary(reviewState),
    "- Merge Status: " + buildMergeStatusSummary(state, mergeCommitSha),
    "- Local Target Sync Status: " + (state.local_target_sync_status ?? "unknown")
  ]);
  return lines.join("\n");
}

function buildFinalArtifactsSection({ existingSection, paths }) {
  const lines = uniqueLines([
    ...String(existingSection ?? "").split(/\r?\n/),
    "- `docs/phase" + paths.phaseNumber + "/" + paths.featureSlug + "/completion-summary.md`",
    "- `docs/phase" + paths.phaseNumber + "/" + paths.featureSlug + "/implement-plan-state.json`",
    "- `docs/phase" + paths.phaseNumber + "/" + paths.featureSlug + "/implementation-run/`"
  ]);
  return lines.join("\n");
}

function buildFinalCommitSection({ state, mergeCommitSha, completionNote }) {
  const lines = [];
  if (state.approved_commit_sha) {
    lines.push("- Approved feature commit: " + state.approved_commit_sha);
  }
  if (mergeCommitSha) {
    lines.push("- Merge commit: " + mergeCommitSha);
  }
  if (state.last_commit_sha && state.last_commit_sha !== mergeCommitSha) {
    lines.push("- Final closeout commit: " + state.last_commit_sha);
  }
  lines.push("- Push: success to origin/" + (state.base_branch ?? "main"));
  if (completionNote) {
    lines.push("- Closeout note: " + completionNote);
  }
  return lines.join("\n");
}

function buildFinalDebtSection({ existingSection, state }) {
  const preservedLines = filterSectionLines(existingSection, [
    /review-cycle.*deferred/i,
    /merge-queue.*deferred/i,
    /feature remains unmerged/i,
    /feature is not marked completed/i
  ]);
  if (preservedLines.some((line) => line.trim())) {
    return preservedLines.join("\n");
  }
  if (state.feature_status === "completed") {
    return "- No remaining route debt for this feature closeout.";
  }
  return "- Remaining route debt is recorded in the active feature state.";
}

function buildReviewCycleStatusSummary(reviewState) {
  if (!isPlainObject(reviewState)) {
    return "not run";
  }
  const cycleNumber = safeInteger(reviewState.last_completed_cycle ?? reviewState.active_cycle_number, null);
  const cycleName = cycleNumber ? "cycle-" + String(cycleNumber).padStart(2, "0") : reviewState.cycle_runtime?.cycle_name ?? "review-cycle";
  const cycleStatus = reviewState.cycle_runtime?.status ?? null;
  const laneVerdicts = isPlainObject(reviewState.cycle_runtime?.lane_verdicts) ? reviewState.cycle_runtime.lane_verdicts : {};
  if (cycleStatus === "completed" && laneVerdicts.auditor === "approve" && laneVerdicts.reviewer === "approve") {
    return cycleName + " approved and closed";
  }
  if (cycleStatus === "completed") {
    return cycleName + " completed";
  }
  return cycleName + " " + (cycleStatus ?? "pending");
}

function buildMergeStatusSummary(state, mergeCommitSha) {
  if (state.merge_status === "merged") {
    return "merged via merge-queue (merge commit " + (mergeCommitSha ?? state.merge_commit_sha ?? state.last_commit_sha ?? "unknown") + ")";
  }
  if (state.merge_status === "blocked") {
    return "blocked";
  }
  if (state.merge_status === "ready_to_queue") {
    return "ready_to_queue";
  }
  if (state.merge_status === "queued") {
    return "queued";
  }
  if (state.merge_status === "in_progress") {
    return "in_progress";
  }
  return state.merge_status ?? "unknown";
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
    merge_status: item.merge_status ?? null,
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
  if (input.runMode === "benchmarking") return "materialize_benchmarking_contract_and_defer_supervisor";
  if (input.executionAction === "recreate") return "recreate_implementor_with_stronger_access_then_resume";
  if (input.executionAction === "resume") return "resume_implementor_with_brief";
  if (input.executionAction === "defer") return "prepare_contract_then_wait_for_operator";
  return "spawn_implementor_with_brief";
}

function applyEventTransition(state, event, timestamp) {
  const transitions = {
    "context-collected": { activeRunStatus: "context_ready", lastCompletedStep: "context_collected", timestampKey: "context_collected_at" },
    "integrity-passed": { activeRunStatus: "brief_ready", lastCompletedStep: "integrity_passed", timestampKey: "integrity_passed_at" },
    "integrity-failed": { activeRunStatus: state.feature_status === "blocked" ? "blocked" : "integrity_failed", lastCompletedStep: "integrity_failed", timestampKey: "integrity_failed_at" },
    "brief-written": { activeRunStatus: "brief_ready", lastCompletedStep: "brief_written", timestampKey: "brief_written_at" },
    "worktree-prepared": { activeRunStatus: "brief_ready", lastCompletedStep: "worktree_prepared", timestampKey: "worktree_prepared_at" },
    "implementor-started": { activeRunStatus: "implementation_running", lastCompletedStep: "implementor_started", timestampKey: "implementor_started_at" },
    "implementor-finished": { activeRunStatus: "verification_pending", lastCompletedStep: "implementor_finished", timestampKey: "implementor_finished_at" },
    "verification-finished": { activeRunStatus: "closeout_pending", lastCompletedStep: "verification_finished", timestampKey: "verification_finished_at" },
    "review-requested": { activeRunStatus: "review_pending", lastCompletedStep: "review_requested", timestampKey: "review_requested_at" },
    "human-verification-requested": { activeRunStatus: "human_verification_pending", lastCompletedStep: "human_verification_requested", timestampKey: "human_verification_requested_at" },
    "merge-ready": { activeRunStatus: "merge_ready", lastCompletedStep: "merge_ready", timestampKey: "merge_ready_at" },
    "merge-queued": { activeRunStatus: "merge_queued", lastCompletedStep: "merge_queued", timestampKey: "merge_queued_at" },
    "merge-started": { activeRunStatus: "merge_in_progress", lastCompletedStep: "merge_started", timestampKey: "merge_started_at" },
    "merge-blocked": { activeRunStatus: "merge_blocked", lastCompletedStep: "merge_blocked", timestampKey: "merge_blocked_at" },
    "merge-finished": { activeRunStatus: "closeout_pending", lastCompletedStep: "merge_finished", timestampKey: "merge_finished_at" },
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
  if (event === "merge-ready") {
    state.merge_required = true;
    state.merge_status = "ready_to_queue";
  } else if (event === "merge-queued") {
    state.merge_required = true;
    state.merge_status = "queued";
  } else if (event === "merge-started") {
    state.merge_required = true;
    state.merge_status = "in_progress";
  } else if (event === "merge-blocked") {
    state.merge_required = true;
    state.merge_status = "blocked";
  } else if (event === "merge-finished") {
    state.merge_required = true;
    state.merge_status = "merged";
  }
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

function parseRunMode(value) {
  const normalized = emptyToNull(value) ?? "normal";
  if (!IMPLEMENT_PLAN_RUN_MODES.has(normalized)) {
    fail("Invalid value for --run-mode. Allowed values: " + Array.from(IMPLEMENT_PLAN_RUN_MODES).join(", ") + ".");
  }
  return normalized;
}

function parseOptionalSafeToken(value, label) {
  if (!isFilled(value)) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(String(value))) {
    fail("Invalid value for --" + label + ". Use a safe token containing only letters, numbers, dot, underscore, dash, or colon.");
  }
  return String(value);
}

function parseOptionalStepName(value, label) {
  if (!isFilled(value)) return null;
  if (!EXECUTION_STEP_NAMES.has(value)) {
    fail("Invalid value for --" + label + ". Allowed values: " + Array.from(EXECUTION_STEP_NAMES).join(", ") + ".");
  }
  return value;
}

function parseOptionalStepStatus(value, label) {
  if (!isFilled(value)) return null;
  if (!STEP_OUTCOME_STATUSES.has(value)) {
    fail("Invalid value for --" + label + ". Allowed values: " + Array.from(STEP_OUTCOME_STATUSES).join(", ") + ".");
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

function parseOptionalWorktreeStatus(value, label) {
  if (!isFilled(value)) return null;
  if (!WORKTREE_STATUSES.has(value)) {
    fail("Invalid value for --" + label + ". Allowed values: " + Array.from(WORKTREE_STATUSES).join(", ") + ".");
  }
  return value;
}

function parseOptionalMergeStatus(value, label) {
  if (!isFilled(value)) return null;
  if (!MERGE_STATUSES.has(value)) {
    fail("Invalid value for --" + label + ". Allowed values: " + Array.from(MERGE_STATUSES).join(", ") + ".");
  }
  return value;
}

function parseOptionalLocalTargetSyncStatus(value, label) {
  if (!isFilled(value)) return null;
  if (!LOCAL_TARGET_SYNC_STATUSES.has(value)) {
    fail("Invalid value for --" + label + ". Allowed values: " + Array.from(LOCAL_TARGET_SYNC_STATUSES).join(", ") + ".");
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
