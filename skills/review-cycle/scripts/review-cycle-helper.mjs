#!/usr/bin/env node

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";

const REQUIRED_ARTIFACTS = [
  "audit-findings.md",
  "review-findings.md",
  "fix-plan.md",
  "fix-report.md"
];

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

const ARTIFACT_VALIDATION_RULES = {
  "audit-findings.md": [
    "1. Findings",
    "2. Conceptual Root Cause",
    "3. High-Level View Of System Routes That Still Need Work"
  ],
  "review-findings.md": [
    "1. Closure Verdicts",
    "2. Remaining Root Cause",
    "3. Next Minimal Fix Pass"
  ],
  "fix-plan.md": [
    "1. Failure Classes",
    "2. Route Contracts",
    "3. Sweep Scope",
    "4. Planned Changes",
    "5. Closure Proof",
    "6. Non-Goals"
  ],
  "fix-report.md": [
    "1. Failure Classes Closed",
    "2. Route Contracts Now Enforced",
    "3. Files Changed And Why",
    "4. Sibling Sites Checked",
    "5. Proof Of Closure",
    "6. Remaining Debt / Non-Goals",
    "7. Next Cycle Starting Point"
  ]
};

const REPORT_ROLES = ["auditor", "reviewer"];
const LANE_VERDICTS = new Set([
  "unknown",
  "approve",
  "reject"
]);
const REVIEW_STRATEGY_MODES = new Set([
  "full_pair",
  "rejecting_lane_only",
  "final_regression_sanity"
]);
const EXECUTION_ID_FIELDS = [
  "auditor_execution_id",
  "reviewer_execution_id",
  "implementor_execution_id"
];
const EXECUTION_MODE_FIELDS = [
  "auditor_execution_access_mode",
  "reviewer_execution_access_mode",
  "implementor_execution_access_mode"
];

const ACCESS_MODES = new Set([
  "native_full_access",
  "native_elevated_permissions",
  "codex_cli_full_auto_bypass",
  "inherits_current_runtime_access",
  "interactive_fallback"
]);

const ACCESS_MODE_RANK = {
  native_full_access: 50,
  native_elevated_permissions: 40,
  codex_cli_full_auto_bypass: 30,
  inherits_current_runtime_access: 20,
  interactive_fallback: 10
};

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

const CYCLE_STATES = new Set([
  "review_not_started",
  "review_in_progress",
  "findings_ready_for_fix_planning",
  "fix_planned_or_implementation_in_progress",
  "fix_report_complete_commit_push_pending",
  "invalid_cycle_artifacts",
  "completed"
]);

const RUNTIME_STATUSES = new Set([
  "review_not_started",
  "review_running",
  "partial_review_ready",
  "both_reviews_ready",
  "reviews_surfaced_ready_for_fix_plan",
  "implementation_running",
  "implementation_finished_pending_verification",
  "verification_complete",
  "fix_report_complete_commit_push_pending",
  "invalid_cycle_artifacts",
  "completed",
  "manual_state_update"
]);

const EVENT_NAMES = new Set([
  "cycle-started",
  "review-requested",
  "report-ready",
  "report-surfaced",
  "implementor-started",
  "implementor-finished",
  "verification-finished",
  "fix-report-saved",
  "closeout-finished"
]);



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
  const command = args.positionals[0] ?? "help";

  if (command === "help") {
    printJson(await renderHelp({
      repoRoot: normalizeRepoRoot(args.values["repo-root"] ?? "C:/ADF")
    }));
    return;
  }

  if (command === "get-settings") {
    printJson(await getSettings({
      repoRoot: normalizeRepoRoot(args.values["repo-root"] ?? "C:/ADF")
    }));
    return;
  }

  if (command === "list-features") {
    printJson(await listFeatures({
      repoRoot: normalizeRepoRoot(args.values["repo-root"] ?? "C:/ADF")
    }));
    return;
  }

  if (command === "prepare") {
    printJson(await prepareCycle({
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug")),
      taskSummary: requiredArg(args, "task-summary"),
      repoRoot: normalizeRepoRoot(args.values["repo-root"] ?? "C:/ADF"),
      scopeHint: args.values["scope-hint"] ?? null,
      nonGoals: args.values["non-goals"] ?? null,
      auditorModel: args.values["auditor-model"] ?? null,
      reviewerModel: args.values["reviewer-model"] ?? null,
      auditorReasoningEffort: args.values["auditor-reasoning-effort"] ?? null,
      reviewerReasoningEffort: args.values["reviewer-reasoning-effort"] ?? null,
      currentBranch: args.values["current-branch"] ?? null
    }));
    return;
  }

  if (command === "update-state") {
    printJson(await updateState({
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug")),
      repoRoot: normalizeRepoRoot(args.values["repo-root"] ?? "C:/ADF"),
      auditorExecutionId: args.values["auditor-execution-id"],
      reviewerExecutionId: args.values["reviewer-execution-id"],
      implementorExecutionId: args.values["implementor-execution-id"],
      auditorExecutionAccessMode: args.values["auditor-execution-access-mode"],
      reviewerExecutionAccessMode: args.values["reviewer-execution-access-mode"],
      implementorExecutionAccessMode: args.values["implementor-execution-access-mode"],
      auditorModel: args.values["auditor-model"],
      reviewerModel: args.values["reviewer-model"],
      auditorReasoningEffort: args.values["auditor-reasoning-effort"],
      reviewerReasoningEffort: args.values["reviewer-reasoning-effort"],
      resolvedRuntimePermissionModel: args.values["resolved-runtime-permission-model"],
      accessModeResolutionNotes: args.values["access-mode-resolution-notes"],
      currentBranch: args.values["current-branch"],
      lastCompletedCycle: args.values["last-completed-cycle"],
      lastCommitSha: args.values["last-commit-sha"],
      activeCycleNumber: args.values["active-cycle-number"],
      capabilityPairs: args.multi["capability"] ?? [],
      recreatedExecutionRoles: args.multi["recreated-execution"] ?? []
    }));
    return;
  }

  if (command === "record-event") {
    printJson(await recordEvent({
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug")),
      repoRoot: normalizeRepoRoot(args.values["repo-root"] ?? "C:/ADF"),
      event: requiredArg(args, "event"),
      role: args.values.role ?? null,
      laneVerdict: args.values["lane-verdict"] ?? null,
      cycleNumber: args.values["cycle-number"] ?? null,
      timestamp: args.values.timestamp ?? null,
      note: args.values.note ?? null,
      currentBranch: args.values["current-branch"] ?? null,
      lastCommitSha: args.values["last-commit-sha"] ?? null
    }));
    return;
  }

  if (command === "cycle-summary") {
    printJson(await cycleSummary({
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug")),
      repoRoot: normalizeRepoRoot(args.values["repo-root"] ?? "C:/ADF"),
      cycleNumber: args.values["cycle-number"] ?? null
    }));
    return;
  }

  fail("Unknown command '" + command + "'. Use 'help', 'get-settings', 'list-features', 'prepare', 'update-state', 'record-event', or 'cycle-summary'.");
}

async function renderHelp(input) {
  const settings = await getSettings({ repoRoot: input.repoRoot });
  const features = await listFeatures({ repoRoot: input.repoRoot });

  return {
    command: "help",
    repo_root: normalizeSlashes(input.repoRoot),
    purpose: "Run one governed route-level audit, review, fix, verify, and closeout cycle for a feature stream, with truthful setup validation, persistent reviewer continuity, and optional multi-cycle closure mode.",
    actions: ["help", "get-settings", "list-features", "run"],
    required_inputs_for_run: ["phase_number", "feature_slug", "task_summary"],
    optional_inputs: [
      "repo_root",
      "scope_hint",
      "non_goals",
      "auditor_model",
      "reviewer_model",
      "auditor_reasoning_effort",
      "reviewer_reasoning_effort",
      "until_complete",
      "max_cycles"
    ],
    transparent_setup_behavior: "The main skill validates setup internally and auto-refreshes it with the internal review-cycle setup helper when setup is missing or invalid before reviewer or implementor work starts.",
    current_settings_summary: settings.summary,
    active_open_review_streams_summary: features.sections,
    resume_note: "If a feature already has an incomplete cycle or a surfaced reviewer report, review-cycle resumes that state conservatively instead of starting a new cycle.",
    pending_closeout_note: "If fix-report.md already exists for the active cycle, review-cycle finishes verification or git closeout before starting another review pass.",
    split_verdict_note: "If one lane approves and the other rejects, the next cycle reruns only the rejecting lane. Once that lane clears, review-cycle requires one final regression_sanity pass from the previously approving lane before closure.",
    until_complete_note: "When until_complete=true, review-cycle may continue automatically for up to max_cycles cycles. If max_cycles is omitted in that mode, default it to 5."
  };
}

async function getSettings(input) {
  const setupInfo = await loadSetup(input.repoRoot);
  return {
    command: "get-settings",
    repo_root: normalizeSlashes(input.repoRoot),
    setup_path: normalizeSlashes(setupInfo.path),
    setup_exists: setupInfo.exists,
    setup_complete: setupInfo.complete,
    validation_errors: setupInfo.validation_errors,
    validation_warnings: setupInfo.validation_warnings,
    summary: {
      preferred_execution_access_mode: setupInfo.data.preferred_execution_access_mode ?? null,
      preferred_auditor_access_mode: setupInfo.data.preferred_auditor_access_mode ?? null,
      preferred_reviewer_access_mode: setupInfo.data.preferred_reviewer_access_mode ?? null,
      preferred_implementor_access_mode: setupInfo.data.preferred_implementor_access_mode ?? null,
      fallback_execution_access_mode: setupInfo.data.fallback_execution_access_mode ?? null,
      runtime_permission_model: setupInfo.data.runtime_permission_model ?? null,
      execution_access_notes: setupInfo.data.execution_access_notes ?? null,
      preferred_execution_runtime: setupInfo.data.preferred_execution_runtime ?? null,
      preferred_control_plane_runtime: setupInfo.data.preferred_control_plane_runtime ?? setupInfo.data.preferred_execution_runtime ?? null,
      persistent_execution_strategy: setupInfo.data.persistent_execution_strategy ?? null,
      detected_runtime_capabilities: setupInfo.data.detected_runtime_capabilities ?? {}
    }
  };
}

async function listFeatures(input) {
  const docsRoot = resolve(input.repoRoot, "docs");
  const stateFiles = await findStateFiles(docsRoot, "review-cycle-state.json");
  const entries = [];

  for (const statePath of stateFiles) {
    try {
      const state = await readJson(statePath);
      const runtimeStatus = validateRuntimeStatus(state.cycle_runtime?.status);
      entries.push({
        feature_registry_key: state.feature_agent_registry_key ?? buildRegistryKey(state.phase_number ?? "unknown", state.feature_slug ?? "unknown"),
        phase_number: safeInteger(state.phase_number, 0),
        feature_slug: state.feature_slug ?? null,
        feature_root: normalizeSlashes(dirname(statePath)),
        current_cycle_number: safeInteger(state.active_cycle_number ?? state.cycle_runtime?.cycle_number, 0),
        current_cycle_name: state.cycle_runtime?.cycle_name ?? null,
        cycle_runtime_status: runtimeStatus,
        last_completed_cycle: safeInteger(state.last_completed_cycle, 0),
        last_commit_sha: state.last_commit_sha ?? null,
        current_branch: state.current_branch ?? null,
        updated_at: state.updated_at ?? null
      });
    } catch (error) {
      entries.push({
        feature_registry_key: normalizeSlashes(dirname(statePath)),
        phase_number: 0,
        feature_slug: null,
        feature_root: normalizeSlashes(dirname(statePath)),
        current_cycle_number: 0,
        current_cycle_name: null,
        cycle_runtime_status: "invalid_or_unreadable",
        last_completed_cycle: 0,
        last_commit_sha: null,
        current_branch: null,
        updated_at: null,
        validation_error: describeError(error)
      });
    }
  }

  const sortEntries = (items) =>
    items.slice().sort((left, right) => String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? "")));

  const sections = {
    open_or_in_progress: sortEntries(entries.filter((entry) =>
      entry.cycle_runtime_status !== "completed"
      && entry.cycle_runtime_status !== "fix_report_complete_commit_push_pending"
      && entry.cycle_runtime_status !== "invalid_or_unreadable"
    )),
    pending_closeout: sortEntries(entries.filter((entry) => entry.cycle_runtime_status === "fix_report_complete_commit_push_pending")),
    completed: sortEntries(entries.filter((entry) => entry.cycle_runtime_status === "completed")),
    invalid_or_unreadable: sortEntries(entries.filter((entry) => entry.cycle_runtime_status === "invalid_or_unreadable")),
    known_stream_count: entries.length
  };

  return {
    command: "list-features",
    repo_root: normalizeSlashes(input.repoRoot),
    docs_root: normalizeSlashes(docsRoot),
    sections
  };
}

async function findStateFiles(rootPath, targetName) {
  const matches = [];
  const entries = await safeReaddir(rootPath);

  for (const entry of entries) {
    const childPath = join(rootPath, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findStateFiles(childPath, targetName)));
      continue;
    }
    if (entry.isFile() && entry.name === targetName) {
      matches.push(childPath);
    }
  }

  return matches;
}

async function prepareCycle(input) {
  const featureRoot = resolveFeatureRoot(input.repoRoot, input.phaseNumber, input.featureSlug);
  await mkdir(featureRoot, { recursive: true });

  const readmePath = join(featureRoot, "README.md");
  const contextPath = join(featureRoot, "context.md");
  const statePath = join(featureRoot, "review-cycle-state.json");

  const setupInfo = await loadSetup(input.repoRoot);
  const registryLoad = await loadRegistry(input.repoRoot);
  const registryKey = buildRegistryKey(input.phaseNumber, input.featureSlug);
  const registryEntry = registryLoad.registry.features[registryKey] ?? null;

  const readmeCreated = await ensureReadme({
    readmePath,
    taskSummary: input.taskSummary,
    scopeHint: input.scopeHint,
    nonGoals: input.nonGoals,
    featureSlug: input.featureSlug
  });

  const inferredStreamState = await inferExistingStreamState(input.repoRoot, featureRoot);
  const stateLoad = await loadOrInitializeState({
    statePath,
    phaseNumber: input.phaseNumber,
    featureSlug: input.featureSlug,
    repoRoot: input.repoRoot,
    auditorModel: input.auditorModel,
    reviewerModel: input.reviewerModel,
    auditorReasoningEffort: input.auditorReasoningEffort,
    reviewerReasoningEffort: input.reviewerReasoningEffort,
    currentBranch: input.currentBranch,
    inferredLastCompletedCycle: inferredStreamState.lastCompletedCycle,
    inferredLastCommitSha: inferredStreamState.lastCommitSha,
    registryKey,
    registryEntry
  });

  const cycleStatus = await selectCycle(featureRoot, safeInteger(stateLoad.state.last_completed_cycle, 0));
  if (cycleStatus.mode === "new") {
    await mkdir(cycleStatus.cycleDir, { recursive: true });
  }

  const activeArtifacts = await inspectCycleArtifacts(cycleStatus.cycleDir);
  const currentCycleState = describeCycleState(
    cycleStatus.cycleNumber,
    activeArtifacts,
    safeInteger(stateLoad.state.last_completed_cycle, 0)
  );
  const requiredAccessModes = resolveRequiredAccessModes(setupInfo.data);

  const recreateDueToWeakAccess = {
    auditor: shouldRecreateExecution(
      stateLoad.state.auditor_execution_id,
      stateLoad.state.auditor_execution_access_mode,
      requiredAccessModes.auditor
    ),
    reviewer: shouldRecreateExecution(
      stateLoad.state.reviewer_execution_id,
      stateLoad.state.reviewer_execution_access_mode,
      requiredAccessModes.reviewer
    ),
    implementor: shouldRecreateExecution(
      stateLoad.state.implementor_execution_id,
      stateLoad.state.implementor_execution_access_mode,
      requiredAccessModes.implementor
    )
  };

  const runtimeSync = syncCycleRuntime({
    state: stateLoad.state,
    cycleStatus,
    currentCycleState,
    activeArtifacts,
    recreateDueToWeakAccess
  });

  let nextState = runtimeSync.state;
  let stateChanged = stateLoad.changed || runtimeSync.changed;

  const detectedBranch = input.currentBranch ?? detectCurrentBranch(input.repoRoot) ?? null;
  if (!nextState.current_branch && detectedBranch) {
    nextState.current_branch = detectedBranch;
    stateChanged = true;
  }

  if (!nextState.resolved_runtime_permission_model && setupInfo.data.runtime_permission_model) {
    nextState.resolved_runtime_permission_model = setupInfo.data.runtime_permission_model;
    stateChanged = true;
  }

  if (!nextState.access_mode_resolution_notes && setupInfo.data.execution_access_notes) {
    nextState.access_mode_resolution_notes = setupInfo.data.execution_access_notes;
    stateChanged = true;
  }

  const setupCapabilities = isPlainObject(setupInfo.data.detected_runtime_capabilities)
    ? setupInfo.data.detected_runtime_capabilities
    : {};
  if (!sameJson(nextState.resolved_runtime_capabilities ?? {}, setupCapabilities)) {
    nextState.resolved_runtime_capabilities = {
      ...(nextState.resolved_runtime_capabilities ?? {}),
      ...setupCapabilities
    };
    stateChanged = true;
  }

  if (stateChanged) {
    nextState.updated_at = nowIso();
    await writeJson(statePath, nextState);
  }

  const registrySync = await syncRegistryFromState({
    registryLoad,
    registryKey,
    state: nextState,
    featureRoot
  });

  const priorCycleNumber = cycleStatus.cycleNumber > 1 ? cycleStatus.cycleNumber - 1 : null;
  const priorCycleDir = priorCycleNumber ? join(featureRoot, formatCycleName(priorCycleNumber)) : null;
  const priorArtifacts = priorCycleDir ? await inspectCycleArtifacts(priorCycleDir) : null;

  const fixReportExists = activeArtifacts.required_artifacts["fix-report.md"].usable_for_resume;
  const commitPushPending = fixReportExists && safeInteger(nextState.last_completed_cycle, 0) < cycleStatus.cycleNumber;
  const executionActions = {
    auditor: decideExecutionAction(nextState.auditor_execution_id, recreateDueToWeakAccess.auditor),
    reviewer: decideExecutionAction(nextState.reviewer_execution_id, recreateDueToWeakAccess.reviewer),
    implementor: decideExecutionAction(nextState.implementor_execution_id, recreateDueToWeakAccess.implementor)
  };
  const reportsReady = nextState.cycle_runtime?.report_ready ?? { auditor: false, reviewer: false };
  const reportsSurfaced = nextState.cycle_runtime?.report_surfaced ?? { auditor: false, reviewer: false };
  const reviewStrategy = resolveReviewStrategy(nextState);
  const setupStatus = setupInfo.complete ? "ready" : setupInfo.exists ? "incomplete" : "missing";
  const nextAction = determineNextAction({
    setupStatus,
    recreateDueToWeakAccess,
    commitPushPending,
    currentCycleState,
    reportsReady,
    reportsSurfaced,
    reviewStrategy
  });

  return {
    repo_root: normalizeSlashes(input.repoRoot),
    setup_path: normalizeSlashes(setupInfo.path),
    registry_path: normalizeSlashes(registryLoad.path),
    setup_exists: setupInfo.exists,
    setup_complete: setupInfo.complete,
    setup_validation_errors: setupInfo.validation_errors,
    setup_validation_warnings: setupInfo.validation_warnings,
    auto_invoke_setup_required: !setupInfo.complete,
    feature_root: normalizeSlashes(featureRoot),
    readme_path: normalizeSlashes(readmePath),
    context_path: normalizeSlashes(contextPath),
    state_path: normalizeSlashes(statePath),
    registry_key: registryKey,
    readme_created: readmeCreated,
    state_created: stateLoad.created,
    state_repairs: stateLoad.repairs,
    registry_validation_errors: registryLoad.validation_errors,
    needs_context_creation: !(await pathExists(contextPath)),
    latest_cycle_number: cycleStatus.latestCycleNumber,
    last_completed_cycle: safeInteger(nextState.last_completed_cycle, 0),
    current_branch: nextState.current_branch ?? null,
    cycle: {
      number: cycleStatus.cycleNumber,
      name: cycleStatus.cycleName,
      dir: normalizeSlashes(cycleStatus.cycleDir),
      mode: cycleStatus.mode,
      current_cycle_state: currentCycleState,
      fix_report_exists: fixReportExists,
      commit_push_pending: commitPushPending,
      artifact_status: activeArtifacts,
      runtime: nextState.cycle_runtime,
      review_strategy: reviewStrategy
    },
    prior_cycle: priorCycleDir
      ? {
          number: priorCycleNumber,
          name: formatCycleName(priorCycleNumber),
          dir: normalizeSlashes(priorCycleDir),
          artifact_status: priorArtifacts
        }
      : null,
    reviewer_state: {
      feature_agent_registry_key: nextState.feature_agent_registry_key,
      auditor_execution_id: nextState.auditor_execution_id ?? null,
      reviewer_execution_id: nextState.reviewer_execution_id ?? null,
      implementor_execution_id: nextState.implementor_execution_id ?? null,
      auditor_execution_access_mode: nextState.auditor_execution_access_mode ?? null,
      reviewer_execution_access_mode: nextState.reviewer_execution_access_mode ?? null,
      implementor_execution_access_mode: nextState.implementor_execution_access_mode ?? null,
      resolved_runtime_permission_model: nextState.resolved_runtime_permission_model ?? setupInfo.data.runtime_permission_model ?? null,
      access_mode_resolution_notes: nextState.access_mode_resolution_notes ?? setupInfo.data.execution_access_notes ?? null,
      resolved_runtime_capabilities: nextState.resolved_runtime_capabilities ?? {},
      auditor_model: nextState.auditor_model ?? null,
      reviewer_model: nextState.reviewer_model ?? null,
      auditor_reasoning_effort: nextState.auditor_reasoning_effort ?? null,
      reviewer_reasoning_effort: nextState.reviewer_reasoning_effort ?? null,
      split_review_continuity: nextState.split_review_continuity
    },
    continuity: {
      registry_entry_found: Boolean(registryEntry),
      continuity_strategy: setupInfo.data.persistent_execution_strategy ?? "artifact_continuity_only",
      preferred_execution_runtime: setupInfo.data.preferred_execution_runtime ?? null,
      preferred_control_plane_runtime: setupInfo.data.preferred_control_plane_runtime ?? setupInfo.data.preferred_execution_runtime ?? null,
      execution_actions: executionActions,
      registry_entry: registrySync.entry
    },
    setup_guidance: {
      preferred_execution_access_mode: setupInfo.data.preferred_execution_access_mode ?? null,
      preferred_auditor_access_mode: requiredAccessModes.auditor,
      preferred_reviewer_access_mode: requiredAccessModes.reviewer,
      preferred_implementor_access_mode: requiredAccessModes.implementor,
      fallback_execution_access_mode: setupInfo.data.fallback_execution_access_mode ?? null,
      runtime_permission_model: setupInfo.data.runtime_permission_model ?? null,
      execution_access_notes: setupInfo.data.execution_access_notes ?? null,
      preferred_execution_runtime: setupInfo.data.preferred_execution_runtime ?? null,
      preferred_control_plane_runtime: setupInfo.data.preferred_control_plane_runtime ?? setupInfo.data.preferred_execution_runtime ?? null,
      persistent_execution_strategy: setupInfo.data.persistent_execution_strategy ?? null
    },
    recreate_due_to_weaker_access: recreateDueToWeakAccess,
    detected_status_summary: {
      detected_project_root: normalizeSlashes(input.repoRoot),
      detected_artifact_root: normalizeSlashes(featureRoot),
      latest_cycle_number: cycleStatus.latestCycleNumber,
      current_cycle_state: currentCycleState,
      fix_report_exists: fixReportExists,
      commit_push_pending: commitPushPending,
      execution_access_modes: requiredAccessModes,
      cached_execution_ids: {
        auditor: nextState.auditor_execution_id ?? null,
        reviewer: nextState.reviewer_execution_id ?? null,
        implementor: nextState.implementor_execution_id ?? null
      },
      execution_actions: executionActions,
      report_ready: reportsReady,
      report_surfaced: reportsSurfaced,
      review_strategy: reviewStrategy,
      recreated_due_to_weaker_access: recreateDueToWeakAccess,
      next_action: nextAction
    }
  };
}

async function updateState(input) {
  const featureRoot = resolveFeatureRoot(input.repoRoot, input.phaseNumber, input.featureSlug);
  const statePath = join(featureRoot, "review-cycle-state.json");
  const registryLoad = await loadRegistry(input.repoRoot);
  const registryKey = buildRegistryKey(input.phaseNumber, input.featureSlug);
  const registryEntry = registryLoad.registry.features[registryKey] ?? null;

  const existing = await loadOrInitializeState({
    statePath,
    phaseNumber: input.phaseNumber,
    featureSlug: input.featureSlug,
    repoRoot: input.repoRoot,
    auditorModel: null,
    reviewerModel: null,
    auditorReasoningEffort: null,
    reviewerReasoningEffort: null,
    currentBranch: null,
    registryKey,
    registryEntry
  });

  const next = { ...existing.state };

  if (input.auditorExecutionId !== undefined) next.auditor_execution_id = emptyToNull(input.auditorExecutionId);
  if (input.reviewerExecutionId !== undefined) next.reviewer_execution_id = emptyToNull(input.reviewerExecutionId);
  if (input.implementorExecutionId !== undefined) next.implementor_execution_id = emptyToNull(input.implementorExecutionId);

  if (input.auditorExecutionAccessMode !== undefined) {
    next.auditor_execution_access_mode = validateOptionalEnum(input.auditorExecutionAccessMode, ACCESS_MODES, "auditor-execution-access-mode");
  }
  if (input.reviewerExecutionAccessMode !== undefined) {
    next.reviewer_execution_access_mode = validateOptionalEnum(input.reviewerExecutionAccessMode, ACCESS_MODES, "reviewer-execution-access-mode");
  }
  if (input.implementorExecutionAccessMode !== undefined) {
    next.implementor_execution_access_mode = validateOptionalEnum(input.implementorExecutionAccessMode, ACCESS_MODES, "implementor-execution-access-mode");
  }

  if (input.auditorModel !== undefined) next.auditor_model = emptyToNull(input.auditorModel);
  if (input.reviewerModel !== undefined) next.reviewer_model = emptyToNull(input.reviewerModel);
  if (input.auditorReasoningEffort !== undefined) next.auditor_reasoning_effort = emptyToNull(input.auditorReasoningEffort);
  if (input.reviewerReasoningEffort !== undefined) next.reviewer_reasoning_effort = emptyToNull(input.reviewerReasoningEffort);

  if (input.resolvedRuntimePermissionModel !== undefined) {
    next.resolved_runtime_permission_model = validateOptionalEnum(
      input.resolvedRuntimePermissionModel,
      RUNTIME_PERMISSION_MODELS,
      "resolved-runtime-permission-model"
    );
  }

  if (input.accessModeResolutionNotes !== undefined) next.access_mode_resolution_notes = emptyToNull(input.accessModeResolutionNotes);
  if (input.currentBranch !== undefined) next.current_branch = emptyToNull(input.currentBranch);
  if (input.lastCommitSha !== undefined) next.last_commit_sha = emptyToNull(input.lastCommitSha);
  if (input.lastCompletedCycle !== undefined) next.last_completed_cycle = parseNonNegativeInteger(input.lastCompletedCycle, "last-completed-cycle");
  if (input.activeCycleNumber !== undefined) next.active_cycle_number = parsePositiveInteger(input.activeCycleNumber, "active-cycle-number");

  next.resolved_runtime_capabilities = {
    ...(next.resolved_runtime_capabilities ?? {}),
    ...parseCapabilityPairs(input.capabilityPairs)
  };

  if (input.recreatedExecutionRoles.length > 0) {
    ensureCycleRuntime(
      next,
      next.active_cycle_number ?? Math.max(safeInteger(next.last_completed_cycle, 0) + 1, 1),
      "manual_state_update"
    );
    for (const role of input.recreatedExecutionRoles) {
      requireWorkerRole(role);
      next.cycle_runtime.recreated_executions[role] = true;
    }
  }

  next.updated_at = nowIso();
  await writeJson(statePath, next);

  const registrySync = await syncRegistryFromState({
    registryLoad,
    registryKey,
    state: next,
    featureRoot
  });

  return {
    state_path: normalizeSlashes(statePath),
    registry_path: normalizeSlashes(registryLoad.path),
    state: next,
    registry_entry: registrySync.entry,
    state_repairs: existing.repairs
  };
}

async function recordEvent(input) {
  const featureRoot = resolveFeatureRoot(input.repoRoot, input.phaseNumber, input.featureSlug);
  const statePath = join(featureRoot, "review-cycle-state.json");
  const registryLoad = await loadRegistry(input.repoRoot);
  const registryKey = buildRegistryKey(input.phaseNumber, input.featureSlug);
  const registryEntry = registryLoad.registry.features[registryKey] ?? null;

  const existing = await loadOrInitializeState({
    statePath,
    phaseNumber: input.phaseNumber,
    featureSlug: input.featureSlug,
    repoRoot: input.repoRoot,
    auditorModel: null,
    reviewerModel: null,
    auditorReasoningEffort: null,
    reviewerReasoningEffort: null,
    currentBranch: null,
    registryKey,
    registryEntry
  });

  const next = { ...existing.state };
  const timestamp = input.timestamp ?? nowIso();
  const cycleNumber = input.cycleNumber !== null
    ? parsePositiveInteger(input.cycleNumber, "cycle-number")
    : next.active_cycle_number ?? Math.max(safeInteger(next.last_completed_cycle, 0) + 1, 1);
  const cycleName = formatCycleName(cycleNumber);
  const cycleDir = join(featureRoot, cycleName);
  await mkdir(cycleDir, { recursive: true });

  const artifacts = await inspectCycleArtifacts(cycleDir);
  const currentCycleState = describeCycleState(cycleNumber, artifacts, safeInteger(next.last_completed_cycle, 0));
  const synced = syncCycleRuntime({
    state: next,
    cycleStatus: {
      latestCycleNumber: cycleNumber,
      mode: "resume",
      cycleNumber,
      cycleName,
      cycleDir
    },
    currentCycleState,
    activeArtifacts: artifacts,
    recreateDueToWeakAccess: next.cycle_runtime?.recreated_executions ?? {
      auditor: false,
      reviewer: false,
      implementor: false
    }
  }).state;

  applyEvent({
    state: synced,
    event: input.event,
    role: input.role,
    laneVerdict: input.laneVerdict,
    timestamp,
    note: input.note
  });

  if (input.currentBranch !== null) synced.current_branch = emptyToNull(input.currentBranch);
  if (input.lastCommitSha !== null) synced.last_commit_sha = emptyToNull(input.lastCommitSha);

  synced.updated_at = timestamp;
  await writeJson(statePath, synced);

  const registrySync = await syncRegistryFromState({
    registryLoad,
    registryKey,
    state: synced,
    featureRoot
  });

  return {
    state_path: normalizeSlashes(statePath),
    registry_path: normalizeSlashes(registryLoad.path),
    cycle_dir: normalizeSlashes(cycleDir),
    state: synced,
    registry_entry: registrySync.entry,
    state_repairs: existing.repairs
  };
}

async function cycleSummary(input) {
  const featureRoot = resolveFeatureRoot(input.repoRoot, input.phaseNumber, input.featureSlug);
  const statePath = join(featureRoot, "review-cycle-state.json");
  const registryLoad = await loadRegistry(input.repoRoot);
  const registryKey = buildRegistryKey(input.phaseNumber, input.featureSlug);
  const registryEntry = registryLoad.registry.features[registryKey] ?? null;

  const stateLoad = await loadOrInitializeState({
    statePath,
    phaseNumber: input.phaseNumber,
    featureSlug: input.featureSlug,
    repoRoot: input.repoRoot,
    auditorModel: null,
    reviewerModel: null,
    auditorReasoningEffort: null,
    reviewerReasoningEffort: null,
    currentBranch: null,
    registryKey,
    registryEntry
  });

  const cycleNumber = input.cycleNumber !== null
    ? parsePositiveInteger(input.cycleNumber, "cycle-number")
    : stateLoad.state.active_cycle_number ?? Math.max(safeInteger(stateLoad.state.last_completed_cycle, 0), 1);
  const cycleName = formatCycleName(cycleNumber);
  const cycleDir = join(featureRoot, cycleName);
  const artifacts = await inspectCycleArtifacts(cycleDir);

  const runtime = stateLoad.state.cycle_runtime && stateLoad.state.cycle_runtime.cycle_number === cycleNumber
    ? normalizeCycleRuntime(stateLoad.state.cycle_runtime)
    : null;

  const auditText = await readTextIfExists(join(cycleDir, "audit-findings.md"));
  const reviewText = await readTextIfExists(join(cycleDir, "review-findings.md"));
  const fixReportText = await readTextIfExists(join(cycleDir, "fix-report.md"));

  const reviewFinishedAt = maxTimestamp(runtime?.auditor_finished_at, runtime?.reviewer_finished_at);
  const cycleEndedAt = maxTimestamp(
    runtime?.cycle_finished_at,
    runtime?.verification_finished_at,
    runtime?.implementor_finished_at,
    reviewFinishedAt
  );
  const totalDurationSeconds = diffSeconds(runtime?.cycle_started_at ?? null, cycleEndedAt ?? null);
  const auditorVerdict = formatLaneVerdictLabel(runtime?.lane_verdicts?.auditor);
  const reviewerVerdict = formatLaneVerdictLabel(runtime?.lane_verdicts?.reviewer);

  return {
    feature_root: normalizeSlashes(featureRoot),
    cycle_number: cycleNumber,
    cycle_name: cycleName,
    cycle_dir: normalizeSlashes(cycleDir),
    fix_report_exists: artifacts.required_artifacts["fix-report.md"].usable_for_resume,
    current_cycle_state: describeCycleState(cycleNumber, artifacts, safeInteger(stateLoad.state.last_completed_cycle, 0)),
    cycle_started_at: runtime?.cycle_started_at ?? null,
    cycle_finished_at: runtime?.cycle_finished_at ?? null,
    total_cycle_seconds: totalDurationSeconds,
    total_cycle_duration: formatDuration(totalDurationSeconds),
    phase_durations: {
      review_seconds: diffSeconds(runtime?.review_requested_at ?? runtime?.cycle_started_at ?? null, reviewFinishedAt),
      implementation_seconds: diffSeconds(runtime?.implementor_started_at ?? null, runtime?.implementor_finished_at ?? null),
      verification_seconds: diffSeconds(runtime?.implementor_finished_at ?? null, runtime?.verification_finished_at ?? null),
      closeout_seconds: diffSeconds(runtime?.verification_finished_at ?? null, runtime?.cycle_finished_at ?? null)
    },
    verdict_summary: {
      auditor: auditorVerdict,
      reviewer: reviewerVerdict,
      overall: resolveCycleOverallVerdict(auditorVerdict, reviewerVerdict)
    },
    high_level_findings: {
      auditor: extractHighlights(auditText, "1. Findings", 4),
      reviewer: extractHighlights(reviewText, "1. Closure Verdicts", 4)
    },
    high_level_fixes: [
      ...extractHighlights(fixReportText, "1. Failure Classes Closed", 3),
      ...extractHighlights(fixReportText, "2. Route Contracts Now Enforced", 3)
    ].slice(0, 6),
    verification_highlights: extractHighlights(fixReportText, "5. Proof Of Closure", 4),
    remaining_highlights: extractHighlights(fixReportText, "6. Remaining Debt / Non-Goals", 4),
    runtime,
    review_strategy: resolveReviewStrategy(stateLoad.state),
    split_review_continuity: stateLoad.state.split_review_continuity,
    state_repairs: stateLoad.repairs
  };
}

function applyEvent(input) {
  if (!EVENT_NAMES.has(input.event)) {
    fail("Unsupported event '" + input.event + "'.");
  }

  const state = input.state;
  ensureCycleRuntime(
    state,
    state.active_cycle_number ?? Math.max(safeInteger(state.last_completed_cycle, 0) + 1, 1),
    state.cycle_runtime?.status ?? "review_not_started"
  );

  const runtime = state.cycle_runtime;
  const timestamp = input.timestamp;

  switch (input.event) {
    case "cycle-started":
      runtime.cycle_started_at ??= timestamp;
      runtime.status = "review_not_started";
      break;

    case "review-requested":
      runtime.cycle_started_at ??= timestamp;
      runtime.review_requested_at ??= timestamp;
      runtime.status = "review_running";
      break;

    case "report-ready":
      requireReportRole(input.role);
      runtime.cycle_started_at ??= timestamp;
      runtime.review_requested_at ??= timestamp;
      runtime.report_ready[input.role] = true;
      if (input.laneVerdict !== null) {
        runtime.lane_verdicts[input.role] = validateLaneVerdict(input.laneVerdict, "lane-verdict");
        updateSplitReviewContinuity({
          state,
          role: input.role,
          verdict: runtime.lane_verdicts[input.role],
          timestamp
        });
      }
      if (input.role === "auditor") runtime.auditor_finished_at ??= timestamp;
      if (input.role === "reviewer") runtime.reviewer_finished_at ??= timestamp;
      runtime.status = runtime.report_ready.auditor && runtime.report_ready.reviewer
        ? "both_reviews_ready"
        : "partial_review_ready";
      break;

    case "report-surfaced":
      requireReportRole(input.role);
      if (!runtime.report_ready[input.role]) {
        fail("Cannot record report-surfaced for role '" + input.role + "' before report-ready.");
      }
      runtime.report_surfaced[input.role] = true;
      if (!runtime.report_surface_order.includes(input.role)) {
        runtime.report_surface_order.push(input.role);
      }
      runtime.status = runtime.report_ready.auditor
        && runtime.report_ready.reviewer
        && runtime.report_surfaced.auditor
        && runtime.report_surfaced.reviewer
        ? "reviews_surfaced_ready_for_fix_plan"
        : runtime.status;
      break;

    case "implementor-started":
      if (
        !(runtime.report_ready.auditor && runtime.report_ready.reviewer
          && runtime.report_surfaced.auditor && runtime.report_surfaced.reviewer)
      ) {
        fail("Cannot record implementor-started before both reviewer reports are ready and surfaced.");
      }
      runtime.implementor_started_at ??= timestamp;
      runtime.status = "implementation_running";
      break;

    case "implementor-finished":
      if (!runtime.implementor_started_at) {
        fail("Cannot record implementor-finished before implementor-started.");
      }
      runtime.implementor_finished_at ??= timestamp;
      runtime.status = "implementation_finished_pending_verification";
      break;

    case "verification-finished":
      if (!runtime.implementor_finished_at && !(runtime.report_ready.auditor && runtime.report_ready.reviewer)) {
        fail("Cannot record verification-finished before implementation or a clean-review-only path exists.");
      }
      runtime.verification_finished_at ??= timestamp;
      runtime.status = "verification_complete";
      break;

    case "fix-report-saved":
      runtime.status = "fix_report_complete_commit_push_pending";
      break;

    case "closeout-finished":
      runtime.cycle_finished_at ??= timestamp;
      runtime.status = "completed";
      state.last_completed_cycle = Math.max(safeInteger(state.last_completed_cycle, 0), runtime.cycle_number);
      if (state.split_review_continuity?.mode === "final_regression_sanity"
        && state.split_review_continuity?.final_sanity_completed) {
        state.split_review_continuity = defaultSplitReviewContinuity();
      }
      break;

    default:
      fail("Unsupported event '" + input.event + "'.");
  }

  if (isFilled(input.note)) {
    runtime.last_note = String(input.note).trim();
  }

  state.active_cycle_number = runtime.cycle_number;
}

function syncCycleRuntime(input) {
  const existing = input.state.cycle_runtime && input.state.cycle_runtime.cycle_number === input.cycleStatus.cycleNumber
    ? normalizeCycleRuntime(input.state.cycle_runtime)
    : null;

  const reportReady = {
    auditor: Boolean(input.activeArtifacts.required_artifacts["audit-findings.md"].usable_for_resume),
    reviewer: Boolean(input.activeArtifacts.required_artifacts["review-findings.md"].usable_for_resume)
  };

  const reportSurfaced = {
    auditor: reportReady.auditor && Boolean(existing?.report_surfaced?.auditor),
    reviewer: reportReady.reviewer && Boolean(existing?.report_surfaced?.reviewer)
  };

  const runtime = {
    cycle_number: input.cycleStatus.cycleNumber,
    cycle_name: input.cycleStatus.cycleName,
    status: resolveRuntimeStatus(input.currentCycleState, reportReady, reportSurfaced, existing?.status),
    cycle_started_at: existing?.cycle_started_at ?? nowIso(),
    review_requested_at: existing?.review_requested_at ?? null,
    auditor_finished_at: reportReady.auditor ? (existing?.auditor_finished_at ?? null) : null,
    reviewer_finished_at: reportReady.reviewer ? (existing?.reviewer_finished_at ?? null) : null,
    implementor_started_at: existing?.implementor_started_at ?? null,
    implementor_finished_at: existing?.implementor_finished_at ?? null,
    verification_finished_at: existing?.verification_finished_at ?? null,
    cycle_finished_at: existing?.cycle_finished_at ?? null,
    report_ready: reportReady,
    report_surfaced: reportSurfaced,
    report_surface_order: sanitizeReportSurfaceOrder(existing?.report_surface_order ?? [], reportSurfaced),
    lane_verdicts: {
      auditor: reportReady.auditor ? normalizeLaneVerdict(existing?.lane_verdicts?.auditor) : "unknown",
      reviewer: reportReady.reviewer ? normalizeLaneVerdict(existing?.lane_verdicts?.reviewer) : "unknown"
    },
    recreated_executions: {
      auditor: Boolean(existing?.recreated_executions?.auditor) || Boolean(input.recreateDueToWeakAccess.auditor),
      reviewer: Boolean(existing?.recreated_executions?.reviewer) || Boolean(input.recreateDueToWeakAccess.reviewer),
      implementor: Boolean(existing?.recreated_executions?.implementor) || Boolean(input.recreateDueToWeakAccess.implementor)
    },
    last_note: existing?.last_note ?? null
  };

  const nextState = {
    ...input.state,
    active_cycle_number: input.cycleStatus.cycleNumber,
    cycle_runtime: runtime
  };

  return {
    state: nextState,
    changed: !sameJson(input.state.cycle_runtime ?? null, runtime)
      || safeInteger(input.state.active_cycle_number, 0) !== input.cycleStatus.cycleNumber
  };
}

function ensureCycleRuntime(state, cycleNumber, status) {
  if (state.cycle_runtime && state.cycle_runtime.cycle_number === cycleNumber) {
    state.cycle_runtime = normalizeCycleRuntime(state.cycle_runtime);
    return;
  }

  state.active_cycle_number = cycleNumber;
  state.cycle_runtime = {
    cycle_number: cycleNumber,
    cycle_name: formatCycleName(cycleNumber),
    status: validateRuntimeStatus(status),
    cycle_started_at: nowIso(),
    review_requested_at: null,
    auditor_finished_at: null,
    reviewer_finished_at: null,
    implementor_started_at: null,
    implementor_finished_at: null,
    verification_finished_at: null,
    cycle_finished_at: null,
    report_ready: { auditor: false, reviewer: false },
    report_surfaced: { auditor: false, reviewer: false },
    report_surface_order: [],
    lane_verdicts: { auditor: "unknown", reviewer: "unknown" },
    recreated_executions: { auditor: false, reviewer: false, implementor: false },
    last_note: null
  };
}

function normalizeCycleRuntime(runtime) {
  if (!isPlainObject(runtime)) {
    return {
      cycle_number: 1,
      cycle_name: "cycle-01",
      status: "review_not_started",
      cycle_started_at: null,
      review_requested_at: null,
      auditor_finished_at: null,
      reviewer_finished_at: null,
      implementor_started_at: null,
      implementor_finished_at: null,
      verification_finished_at: null,
      cycle_finished_at: null,
      report_ready: { auditor: false, reviewer: false },
      report_surfaced: { auditor: false, reviewer: false },
      report_surface_order: [],
      recreated_executions: { auditor: false, reviewer: false, implementor: false },
      last_note: null
    };
  }

  const cycleNumber = safeInteger(runtime.cycle_number, 1);

  return {
    cycle_number: cycleNumber,
    cycle_name: runtime.cycle_name ?? formatCycleName(cycleNumber),
    status: validateRuntimeStatus(runtime.status),
    cycle_started_at: emptyToNull(runtime.cycle_started_at),
    review_requested_at: emptyToNull(runtime.review_requested_at),
    auditor_finished_at: emptyToNull(runtime.auditor_finished_at),
    reviewer_finished_at: emptyToNull(runtime.reviewer_finished_at),
    implementor_started_at: emptyToNull(runtime.implementor_started_at),
    implementor_finished_at: emptyToNull(runtime.implementor_finished_at),
    verification_finished_at: emptyToNull(runtime.verification_finished_at),
    cycle_finished_at: emptyToNull(runtime.cycle_finished_at),
    report_ready: {
      auditor: Boolean(runtime.report_ready?.auditor),
      reviewer: Boolean(runtime.report_ready?.reviewer)
    },
    report_surfaced: {
      auditor: Boolean(runtime.report_surfaced?.auditor),
      reviewer: Boolean(runtime.report_surfaced?.reviewer)
    },
    report_surface_order: sanitizeReportSurfaceOrder(runtime.report_surface_order ?? [], runtime.report_surfaced ?? {}),
    lane_verdicts: {
      auditor: normalizeLaneVerdict(runtime.lane_verdicts?.auditor),
      reviewer: normalizeLaneVerdict(runtime.lane_verdicts?.reviewer)
    },
    recreated_executions: {
      auditor: Boolean(runtime.recreated_executions?.auditor),
      reviewer: Boolean(runtime.recreated_executions?.reviewer),
      implementor: Boolean(runtime.recreated_executions?.implementor)
    },
    last_note: emptyToNull(runtime.last_note)
  };
}

function sanitizeReportSurfaceOrder(order, reportSurfaced) {
  const next = [];
  for (const role of order) {
    if (REPORT_ROLES.includes(role) && reportSurfaced[role] && !next.includes(role)) {
      next.push(role);
    }
  }
  return next;
}

function resolveRuntimeStatus(currentCycleState, reportReady, reportSurfaced, existingStatus) {
  if (currentCycleState === "completed") return "completed";
  if (currentCycleState === "fix_report_complete_commit_push_pending") return "fix_report_complete_commit_push_pending";
  if (currentCycleState === "invalid_cycle_artifacts") return "invalid_cycle_artifacts";

  if (currentCycleState === "fix_planned_or_implementation_in_progress") {
    if (existingStatus === "verification_complete") return "verification_complete";
    if (existingStatus === "implementation_finished_pending_verification") return "implementation_finished_pending_verification";
    if (existingStatus === "implementation_running") return "implementation_running";
    return "implementation_running";
  }

  if (reportReady.auditor && reportReady.reviewer) {
    if (reportSurfaced.auditor && reportSurfaced.reviewer) return "reviews_surfaced_ready_for_fix_plan";
    return "both_reviews_ready";
  }

  if (reportReady.auditor || reportReady.reviewer) return "partial_review_ready";
  if (currentCycleState === "review_in_progress") return "review_running";
  return "review_not_started";
}

function decideExecutionAction(executionId, recreateDueToWeakAccess) {
  if (isFilled(executionId) && recreateDueToWeakAccess) return "recreate";
  if (isFilled(executionId)) return "resume";
  return "spawn";
}

function resolveReviewStrategy(state) {
  const continuity = normalizeSplitReviewContinuity(state.split_review_continuity);
  const runtime = normalizeCycleRuntime(state.cycle_runtime);

  if (continuity.mode === "rejecting_lane_only" && continuity.rejecting_lane) {
    return {
      mode: continuity.mode,
      review_kind: "delta",
      requested_lanes: [continuity.rejecting_lane],
      carried_forward_lanes: continuity.approving_lane ? [continuity.approving_lane] : [],
      approving_lane: continuity.approving_lane,
      rejecting_lane: continuity.rejecting_lane,
      final_sanity_lane: null,
      carried_from_cycle: continuity.carried_from_cycle,
      final_sanity_completed: false,
      review_requirement_satisfied: runtime.report_ready[continuity.rejecting_lane] && runtime.report_surfaced[continuity.rejecting_lane],
      lane_verdicts: runtime.lane_verdicts,
      note: continuity.note ?? "Reuse the previously approving lane as carried-forward evidence and rerun only the rejecting lane."
    };
  }

  if (continuity.mode === "final_regression_sanity" && continuity.final_sanity_lane) {
    return {
      mode: continuity.mode,
      review_kind: "regression_sanity",
      requested_lanes: continuity.final_sanity_completed ? [] : [continuity.final_sanity_lane],
      carried_forward_lanes: REPORT_ROLES.filter((role) => role !== continuity.final_sanity_lane),
      approving_lane: continuity.approving_lane,
      rejecting_lane: continuity.rejecting_lane,
      final_sanity_lane: continuity.final_sanity_lane,
      carried_from_cycle: continuity.carried_from_cycle,
      final_sanity_completed: continuity.final_sanity_completed,
      review_requirement_satisfied: continuity.final_sanity_completed
        || (runtime.report_ready[continuity.final_sanity_lane] && runtime.report_surfaced[continuity.final_sanity_lane]),
      lane_verdicts: runtime.lane_verdicts,
      note: continuity.note ?? "Run one final regression_sanity pass from the previously approving lane before closure."
    };
  }

  const requestedLanes = REPORT_ROLES.filter((role) => !runtime.report_ready[role]);
  return {
    mode: "full_pair",
    review_kind: "full",
    requested_lanes: requestedLanes,
    carried_forward_lanes: [],
    approving_lane: null,
    rejecting_lane: null,
    final_sanity_lane: null,
    carried_from_cycle: null,
    final_sanity_completed: false,
    review_requirement_satisfied: runtime.report_ready.auditor
      && runtime.report_ready.reviewer
      && runtime.report_surfaced.auditor
      && runtime.report_surfaced.reviewer,
    lane_verdicts: runtime.lane_verdicts,
    note: requestedLanes.length === 0
      ? "The current cycle already has the required full-pair review evidence."
      : "Run the auditor and reviewer in parallel unless one lane is already resumable."
  };
}

function defaultSplitReviewContinuity() {
  return {
    mode: "full_pair",
    approving_lane: null,
    rejecting_lane: null,
    final_sanity_lane: null,
    carried_from_cycle: null,
    final_sanity_completed: false,
    updated_at: null,
    note: null
  };
}

function normalizeSplitReviewContinuity(value) {
  if (!isPlainObject(value)) {
    return defaultSplitReviewContinuity();
  }

  const next = {
    mode: REVIEW_STRATEGY_MODES.has(value.mode) ? value.mode : "full_pair",
    approving_lane: REPORT_ROLES.includes(value.approving_lane) ? value.approving_lane : null,
    rejecting_lane: REPORT_ROLES.includes(value.rejecting_lane) ? value.rejecting_lane : null,
    final_sanity_lane: REPORT_ROLES.includes(value.final_sanity_lane) ? value.final_sanity_lane : null,
    carried_from_cycle: value.carried_from_cycle === null || value.carried_from_cycle === undefined
      ? null
      : safeInteger(value.carried_from_cycle, null),
    final_sanity_completed: Boolean(value.final_sanity_completed),
    updated_at: emptyToNull(value.updated_at),
    note: emptyToNull(value.note)
  };

  if (next.mode === "rejecting_lane_only") {
    if (!next.approving_lane || !next.rejecting_lane || next.approving_lane === next.rejecting_lane) {
      return defaultSplitReviewContinuity();
    }
    next.final_sanity_lane = null;
    next.final_sanity_completed = false;
    return next;
  }

  if (next.mode === "final_regression_sanity") {
    if (!next.final_sanity_lane) {
      return defaultSplitReviewContinuity();
    }
    return next;
  }

  return defaultSplitReviewContinuity();
}

function normalizeLaneVerdict(value) {
  return LANE_VERDICTS.has(value) ? value : "unknown";
}

function formatLaneVerdictLabel(value) {
  const normalized = normalizeLaneVerdict(value);
  if (normalized === "approve") return "APPROVED";
  if (normalized === "reject") return "REJECTED";
  return "PENDING";
}

function resolveCycleOverallVerdict(auditorVerdict, reviewerVerdict) {
  if (auditorVerdict === "REJECTED" || reviewerVerdict === "REJECTED") return "REJECTED";
  if (auditorVerdict === "APPROVED" && reviewerVerdict === "APPROVED") return "APPROVED";
  return "PENDING";
}

function validateLaneVerdict(value, fieldName) {
  if (!LANE_VERDICTS.has(value)) {
    fail(fieldName + " must be one of: " + Array.from(LANE_VERDICTS).join(", ") + ".");
  }
  return value;
}

function updateSplitReviewContinuity(input) {
  const state = input.state;
  const continuity = normalizeSplitReviewContinuity(state.split_review_continuity);
  const otherRole = REPORT_ROLES.find((role) => role !== input.role);
  const otherVerdict = normalizeLaneVerdict(state.cycle_runtime?.lane_verdicts?.[otherRole]);

  if (continuity.mode === "final_regression_sanity" && input.role === continuity.final_sanity_lane) {
    if (input.verdict === "approve") {
      state.split_review_continuity = {
        ...continuity,
        final_sanity_completed: true,
        updated_at: input.timestamp,
        note: "Split verdict cleared after final regression_sanity by " + continuity.final_sanity_lane + "."
      };
      return;
    }

    if (input.verdict === "reject") {
      state.split_review_continuity = {
        mode: "rejecting_lane_only",
        approving_lane: otherRole,
        rejecting_lane: input.role,
        final_sanity_lane: null,
        carried_from_cycle: state.active_cycle_number ?? state.cycle_runtime?.cycle_number ?? null,
        final_sanity_completed: false,
        updated_at: input.timestamp,
        note: "Final regression_sanity reopened the split verdict. Rerun only the rejecting lane next cycle."
      };
      return;
    }
  }

  if (continuity.mode === "rejecting_lane_only" && input.role === continuity.rejecting_lane) {
    if (input.verdict === "approve") {
      state.split_review_continuity = {
        mode: "final_regression_sanity",
        approving_lane: continuity.approving_lane,
        rejecting_lane: continuity.rejecting_lane,
        final_sanity_lane: continuity.approving_lane,
        carried_from_cycle: continuity.carried_from_cycle ?? state.active_cycle_number ?? state.cycle_runtime?.cycle_number ?? null,
        final_sanity_completed: false,
        updated_at: input.timestamp,
        note: "Rejecting lane cleared. One final regression_sanity pass is now required from the previously approving lane."
      };
      return;
    }

    if (input.verdict === "reject") {
      state.split_review_continuity = {
        ...continuity,
        carried_from_cycle: state.active_cycle_number ?? state.cycle_runtime?.cycle_number ?? continuity.carried_from_cycle,
        final_sanity_completed: false,
        updated_at: input.timestamp,
        note: "Rejecting lane still has open findings. Keep rerunning only that lane."
      };
      return;
    }
  }

  if (otherVerdict === "unknown") {
    return;
  }

  if (input.verdict === "approve" && otherVerdict === "reject") {
    state.split_review_continuity = {
      mode: "rejecting_lane_only",
      approving_lane: input.role,
      rejecting_lane: otherRole,
      final_sanity_lane: null,
      carried_from_cycle: state.active_cycle_number ?? state.cycle_runtime?.cycle_number ?? null,
      final_sanity_completed: false,
      updated_at: input.timestamp,
      note: "Split verdict detected. Reuse the approving lane and rerun only the rejecting lane next cycle."
    };
    return;
  }

  if (input.verdict === "reject" && otherVerdict === "approve") {
    state.split_review_continuity = {
      mode: "rejecting_lane_only",
      approving_lane: otherRole,
      rejecting_lane: input.role,
      final_sanity_lane: null,
      carried_from_cycle: state.active_cycle_number ?? state.cycle_runtime?.cycle_number ?? null,
      final_sanity_completed: false,
      updated_at: input.timestamp,
      note: "Split verdict detected. Reuse the approving lane and rerun only the rejecting lane next cycle."
    };
    return;
  }

  if ((input.verdict === "approve" && otherVerdict === "approve")
    || (input.verdict === "reject" && otherVerdict === "reject")) {
    state.split_review_continuity = defaultSplitReviewContinuity();
  }
}

async function loadOrInitializeState(input) {
  const defaults = defaultState(input);
  const initialized = mergeStateWithRegistryEntry(defaults, input.registryEntry);
  const repairs = [];

  if (!(await pathExists(input.statePath))) {
    await writeJson(input.statePath, initialized.state);
    return { created: true, changed: true, state: initialized.state, repairs };
  }

  let existing;
  try {
    existing = await readJson(input.statePath);
  } catch (error) {
    repairs.push("Existing review-cycle-state.json could not be parsed and was reinitialized from defaults: " + describeError(error));
    const recovered = initialized.state;
    recovered.updated_at = nowIso();
    await writeJson(input.statePath, recovered);
    return { created: false, changed: true, state: recovered, repairs };
  }

  const normalized = normalizeStateObject(existing, defaults, repairs);
  const withRegistry = mergeStateWithRegistryEntry(normalized, input.registryEntry);

  if (withRegistry.changed || !sameJson(existing, withRegistry.state)) {
    withRegistry.state.updated_at = nowIso();
    await writeJson(input.statePath, withRegistry.state);
    return { created: false, changed: true, state: withRegistry.state, repairs };
  }

  return { created: false, changed: false, state: withRegistry.state, repairs };
}

function normalizeStateObject(existing, defaults, repairs) {
  if (!isPlainObject(existing)) {
    repairs.push("State payload was not an object and was replaced with defaults.");
    return defaults;
  }

  const merged = {
    ...defaults,
    ...existing,
    phase_number: defaults.phase_number,
    feature_slug: defaults.feature_slug,
    repo_root: defaults.repo_root,
    feature_agent_registry_key: emptyToNull(existing.feature_agent_registry_key) ?? defaults.feature_agent_registry_key,
    resolved_runtime_capabilities: isPlainObject(existing.resolved_runtime_capabilities)
      ? existing.resolved_runtime_capabilities
      : {},
    created_at: emptyToNull(existing.created_at) ?? defaults.created_at,
    updated_at: emptyToNull(existing.updated_at) ?? defaults.updated_at,
    cycle_runtime: existing.cycle_runtime ?? defaults.cycle_runtime,
    split_review_continuity: existing.split_review_continuity ?? defaults.split_review_continuity
  };

  if (!isPlainObject(existing.resolved_runtime_capabilities) && existing.resolved_runtime_capabilities !== undefined) {
    repairs.push("resolved_runtime_capabilities was not an object and was reset.");
  }

  merged.last_completed_cycle = safeInteger(existing.last_completed_cycle, defaults.last_completed_cycle);
  merged.active_cycle_number = safeInteger(existing.active_cycle_number, defaults.active_cycle_number);
  merged.auditor_execution_id = emptyToNull(existing.auditor_execution_id);
  merged.reviewer_execution_id = emptyToNull(existing.reviewer_execution_id);
  merged.implementor_execution_id = emptyToNull(existing.implementor_execution_id);

  merged.auditor_execution_access_mode = validateOptionalStateEnum(existing.auditor_execution_access_mode, ACCESS_MODES, "auditor_execution_access_mode", repairs);
  merged.reviewer_execution_access_mode = validateOptionalStateEnum(existing.reviewer_execution_access_mode, ACCESS_MODES, "reviewer_execution_access_mode", repairs);
  merged.implementor_execution_access_mode = validateOptionalStateEnum(existing.implementor_execution_access_mode, ACCESS_MODES, "implementor_execution_access_mode", repairs);
  merged.resolved_runtime_permission_model = validateOptionalStateEnum(
    existing.resolved_runtime_permission_model,
    RUNTIME_PERMISSION_MODELS,
    "resolved_runtime_permission_model",
    repairs
  );

  merged.auditor_model = emptyToNull(existing.auditor_model);
  merged.reviewer_model = emptyToNull(existing.reviewer_model);
  merged.auditor_reasoning_effort = emptyToNull(existing.auditor_reasoning_effort);
  merged.reviewer_reasoning_effort = emptyToNull(existing.reviewer_reasoning_effort);
  merged.access_mode_resolution_notes = emptyToNull(existing.access_mode_resolution_notes);
  merged.current_branch = emptyToNull(existing.current_branch);
  merged.last_commit_sha = emptyToNull(existing.last_commit_sha);

  if (merged.last_completed_cycle < 0) {
    repairs.push("last_completed_cycle was negative and was reset to 0.");
    merged.last_completed_cycle = 0;
  }

  if (merged.active_cycle_number < 1) {
    repairs.push("active_cycle_number was below 1 and was reset.");
    merged.active_cycle_number = Math.max(merged.last_completed_cycle + 1, 1);
  }

  if (existing.cycle_runtime !== undefined && existing.cycle_runtime !== null) {
    merged.cycle_runtime = normalizeCycleRuntime(existing.cycle_runtime);
    if (merged.cycle_runtime.cycle_number !== merged.active_cycle_number) {
      repairs.push("active_cycle_number was synchronized to cycle_runtime.cycle_number for consistency.");
      merged.active_cycle_number = merged.cycle_runtime.cycle_number;
    }
  } else {
    merged.cycle_runtime = null;
  }

  merged.split_review_continuity = normalizeSplitReviewContinuity(existing.split_review_continuity);

  return merged;
}

function mergeStateWithRegistryEntry(state, registryEntry) {
  if (!registryEntry) {
    return { changed: false, state };
  }

  const next = { ...state };
  let changed = false;

  for (const field of [...EXECUTION_ID_FIELDS, ...EXECUTION_MODE_FIELDS, "resolved_runtime_permission_model"]) {
    if (!isFilled(next[field]) && isFilled(registryEntry[field])) {
      next[field] = registryEntry[field];
      changed = true;
    }
  }

  if (!isFilled(next.feature_agent_registry_key)) {
    next.feature_agent_registry_key = buildRegistryKey(next.phase_number, next.feature_slug);
    changed = true;
  }

  return { changed, state: next };
}

function defaultState(input) {
  const inferredCycle = Math.max(safeInteger(input.inferredLastCompletedCycle, 0) + 1, 1);
  return {
    phase_number: input.phaseNumber,
    feature_slug: input.featureSlug,
    repo_root: normalizeSlashes(input.repoRoot),
    feature_agent_registry_key: input.registryKey,
    auditor_execution_id: null,
    reviewer_execution_id: null,
    implementor_execution_id: null,
    auditor_execution_access_mode: null,
    reviewer_execution_access_mode: null,
    implementor_execution_access_mode: null,
    auditor_model: input.auditorModel ?? null,
    reviewer_model: input.reviewerModel ?? null,
    auditor_reasoning_effort: input.auditorReasoningEffort ?? null,
    reviewer_reasoning_effort: input.reviewerReasoningEffort ?? null,
    resolved_runtime_permission_model: null,
    access_mode_resolution_notes: null,
    resolved_runtime_capabilities: {},
    current_branch: input.currentBranch ?? null,
    last_completed_cycle: safeInteger(input.inferredLastCompletedCycle, 0),
    last_commit_sha: input.inferredLastCommitSha ?? null,
    active_cycle_number: inferredCycle,
    cycle_runtime: null,
    split_review_continuity: defaultSplitReviewContinuity(),
    created_at: nowIso(),
    updated_at: nowIso()
  };
}

async function loadSetup(repoRoot) {
  const setupPath = resolve(repoRoot, ".codex", "review-cycle", "setup.json");
  if (!(await pathExists(setupPath))) {
    return { path: setupPath, exists: false, complete: false, validation_errors: [], validation_warnings: [], data: {} };
  }

  try {
    const data = await readJson(setupPath);
    const validation = validateSetupData(data, repoRoot);
    return {
      path: setupPath,
      exists: true,
      complete: validation.complete,
      validation_errors: validation.errors,
      validation_warnings: validation.warnings,
      data: validation.normalized
    };
  } catch (error) {
    return {
      path: setupPath,
      exists: true,
      complete: false,
      validation_errors: ["setup.json could not be parsed: " + describeError(error)],
      validation_warnings: [],
      data: {}
    };
  }
}

function validateSetupData(data, repoRoot) {
  const errors = [];
  const warnings = [];
  const normalized = isPlainObject(data) ? { ...data } : {};

  if (!isPlainObject(data)) {
    errors.push("setup.json must contain a JSON object.");
  }

  for (const field of REQUIRED_SETUP_FIELDS) {
    if (!isFilled(normalized[field])) {
      errors.push("Missing required setup field '" + field + "'.");
    }
  }

  validateEnumValue(normalized.preferred_execution_access_mode, ACCESS_MODES, "preferred_execution_access_mode", errors);
  validateEnumValue(normalized.preferred_auditor_access_mode, ACCESS_MODES, "preferred_auditor_access_mode", errors);
  validateEnumValue(normalized.preferred_reviewer_access_mode, ACCESS_MODES, "preferred_reviewer_access_mode", errors);
  validateEnumValue(normalized.preferred_implementor_access_mode, ACCESS_MODES, "preferred_implementor_access_mode", errors);
  validateEnumValue(normalized.fallback_execution_access_mode, ACCESS_MODES, "fallback_execution_access_mode", errors);
  validateEnumValue(normalized.runtime_permission_model, RUNTIME_PERMISSION_MODELS, "runtime_permission_model", errors);
  validateEnumValue(normalized.preferred_execution_runtime, EXECUTION_RUNTIMES, "preferred_execution_runtime", errors);
  if (isFilled(normalized.preferred_control_plane_runtime)) {
    validateEnumValue(normalized.preferred_control_plane_runtime, EXECUTION_RUNTIMES, "preferred_control_plane_runtime", errors);
  }
  validateEnumValue(normalized.persistent_execution_strategy, PERSISTENT_EXECUTION_STRATEGIES, "persistent_execution_strategy", errors);

  if (isFilled(normalized.project_root) && normalizeSlashes(resolve(normalized.project_root)) !== repoRoot) {
    errors.push("setup.json project_root must match '" + repoRoot + "'.");
  }

  if (!isPlainObject(normalized.detected_runtime_capabilities)) {
    warnings.push("detected_runtime_capabilities was missing or not an object.");
    normalized.detected_runtime_capabilities = {};
  }

  if (normalized.preferred_execution_access_mode === "codex_cli_full_auto_bypass"
    && normalized.preferred_execution_runtime !== "codex_cli_exec") {
    errors.push("preferred_execution_runtime must be 'codex_cli_exec' when preferred_execution_access_mode is 'codex_cli_full_auto_bypass'.");
  }

  if (!Array.isArray(normalized.project_specific_permission_rules)) {
    warnings.push("project_specific_permission_rules was missing or not an array.");
    normalized.project_specific_permission_rules = [];
  }

  if (normalized.project_specific_permission_rules.length > 0
    && normalized.requires_project_specific_permission_rules !== true) {
    warnings.push("requires_project_specific_permission_rules should be true when permission rules are present.");
  }

  return {
    complete: errors.length === 0,
    errors,
    warnings,
    normalized
  };
}

function validateEnumValue(value, allowedValues, fieldName, errors) {
  if (!isFilled(value)) return;
  if (!allowedValues.has(value)) {
    errors.push("Field '" + fieldName + "' must be one of: " + Array.from(allowedValues).join(", ") + ".");
  }
}

async function loadRegistry(repoRoot) {
  const registryPath = resolve(repoRoot, ".codex", "review-cycle", "agent-registry.json");
  if (!(await pathExists(registryPath))) {
    return {
      path: registryPath,
      exists: false,
      validation_errors: [],
      registry: defaultRegistry()
    };
  }

  try {
    const data = await readJson(registryPath);
    if (!isPlainObject(data) || !isPlainObject(data.features)) {
      return {
        path: registryPath,
        exists: true,
        validation_errors: ["agent-registry.json was not a valid registry object and was treated as empty."],
        registry: defaultRegistry()
      };
    }

    return {
      path: registryPath,
      exists: true,
      validation_errors: [],
      registry: {
        version: safeInteger(data.version, 1),
        features: data.features
      }
    };
  } catch (error) {
    return {
      path: registryPath,
      exists: true,
      validation_errors: ["agent-registry.json could not be parsed and was treated as empty: " + describeError(error)],
      registry: defaultRegistry()
    };
  }
}

function defaultRegistry() {
  return {
    version: 1,
    features: {}
  };
}

async function syncRegistryFromState(input) {
  const existingEntry = input.registryLoad.registry.features[input.registryKey] ?? null;
  const candidate = {
    phase_number: input.state.phase_number,
    feature_slug: input.state.feature_slug,
    feature_root: normalizeSlashes(input.featureRoot),
    auditor_execution_id: input.state.auditor_execution_id ?? null,
    reviewer_execution_id: input.state.reviewer_execution_id ?? null,
    implementor_execution_id: input.state.implementor_execution_id ?? null,
    auditor_execution_access_mode: input.state.auditor_execution_access_mode ?? null,
    reviewer_execution_access_mode: input.state.reviewer_execution_access_mode ?? null,
    implementor_execution_access_mode: input.state.implementor_execution_access_mode ?? null,
    resolved_runtime_permission_model: input.state.resolved_runtime_permission_model ?? null,
    updated_at: nowIso()
  };

  const hasContinuity = EXECUTION_ID_FIELDS.some((field) => isFilled(candidate[field]));

  if (!hasContinuity) {
    return {
      changed: false,
      entry: existingEntry,
      registry_path: normalizeSlashes(input.registryLoad.path)
    };
  }

  const nextEntry = {
    ...(existingEntry ?? {}),
    ...candidate
  };

  const changed = !sameJson(stripUpdatedAt(existingEntry), stripUpdatedAt(nextEntry));
  if (!changed) {
    return {
      changed: false,
      entry: existingEntry,
      registry_path: normalizeSlashes(input.registryLoad.path)
    };
  }

  const nextRegistry = {
    ...input.registryLoad.registry,
    features: {
      ...input.registryLoad.registry.features,
      [input.registryKey]: nextEntry
    }
  };

  await writeJson(input.registryLoad.path, nextRegistry);

  return {
    changed: true,
    entry: nextEntry,
    registry_path: normalizeSlashes(input.registryLoad.path)
  };
}

function stripUpdatedAt(value) {
  if (!value) return null;
  const next = { ...value };
  delete next.updated_at;
  return next;
}

async function ensureReadme(input) {
  if (await pathExists(input.readmePath)) return false;

  const lines = [
    "# " + input.featureSlug,
    "",
    "## Feature Goal",
    "",
    input.taskSummary.trim(),
    "",
    "## Requested Scope",
    "",
    input.scopeHint?.trim() || "Use the task summary and current repo state to keep the fix route-level and tight.",
    "",
    "## Non-Goals",
    "",
    input.nonGoals?.trim() || "- None recorded yet.",
    "",
    "## Artifact Map",
    "",
    "- context.md",
    "- review-cycle-state.json",
    "- cycle-XX/audit-findings.md",
    "- cycle-XX/review-findings.md",
    "- cycle-XX/fix-plan.md",
    "- cycle-XX/fix-report.md",
    "- <repo_root>/.codex/review-cycle/setup.json",
    "- <repo_root>/.codex/review-cycle/agent-registry.json",
    "",
    "## Cycle Rules",
    "",
    "- One invocation = one full audit/review/fix/report cycle.",
    "- Do not auto-start the next cycle in the same run.",
    "- A fix report from cycle N becomes reviewer input only in cycle N+1.",
    "- Reuse incomplete or pending-closeout cycle artifacts when resuming.",
    "- Reuse cached auditor/reviewer/implementor executions per feature stream when they are still valid.",
    "",
    "## Commit Rules",
    "",
    "- Commit code changes, cycle artifacts, related docs, and changed setup artifacts together.",
    "- Push to origin after the cycle closes.",
    "- If commit or push fails, preserve artifacts and report the exact git failure.",
    ""
  ];

  await writeText(input.readmePath, lines.join("\n"));
  return true;
}

async function selectCycle(featureRoot, lastCompletedCycle) {
  const cycles = await listCycleDirectories(featureRoot);
  const latestCycleNumber = cycles.length > 0 ? cycles[cycles.length - 1].number : 0;

  const expectedOpenCycle = cycles.find((cycle) => cycle.number === lastCompletedCycle + 1);
  if (expectedOpenCycle) {
    const status = await inspectCycleArtifacts(expectedOpenCycle.dir);
    return {
      latestCycleNumber,
      mode: status.reusable_complete ? "resume_pending_closeout" : "resume",
      cycleNumber: expectedOpenCycle.number,
      cycleName: expectedOpenCycle.name,
      cycleDir: expectedOpenCycle.dir
    };
  }

  for (const cycle of cycles) {
    if (cycle.number <= lastCompletedCycle) {
      continue;
    }
    const status = await inspectCycleArtifacts(cycle.dir);
    if (!status.reusable_complete) {
      return {
        latestCycleNumber,
        mode: "resume",
        cycleNumber: cycle.number,
        cycleName: cycle.name,
        cycleDir: cycle.dir
      };
    }
  }

  const nextNumber = Math.max(latestCycleNumber, lastCompletedCycle) + 1;
  return {
    latestCycleNumber,
    mode: "new",
    cycleNumber: nextNumber,
    cycleName: formatCycleName(nextNumber),
    cycleDir: join(featureRoot, formatCycleName(nextNumber))
  };
}

async function inferExistingStreamState(repoRoot, featureRoot) {
  const cycles = await listCycleDirectories(featureRoot);

  let lastCompletedCycle = 0;
  let lastCommitSha = null;
  let expectedCycleNumber = 1;

  for (const cycle of cycles) {
    if (cycle.number !== expectedCycleNumber) {
      break;
    }

    const status = await inspectCycleArtifacts(cycle.dir);
    if (!status.reusable_complete) {
      break;
    }

    const allTrackedAndClean = Object.values(status.required_artifacts).every((artifact) =>
      isGitTrackedAndClean(repoRoot, artifact.path)
    );
    if (!allTrackedAndClean) {
      break;
    }

    lastCompletedCycle = cycle.number;
    const cycleCommit = gitOutput(repoRoot, [
      "log",
      "-1",
      "--format=%H",
      "--",
      normalizeGitPath(repoRoot, cycle.dir)
    ]);
    if (cycleCommit) {
      lastCommitSha = cycleCommit;
    }

    expectedCycleNumber += 1;
  }

  return { lastCompletedCycle, lastCommitSha };
}

async function listCycleDirectories(featureRoot) {
  const entries = await safeReaddir(featureRoot);
  return entries
    .map((entry) => {
      const match = /^cycle-(\d+)$/.exec(entry.name);
      if (!match || !entry.isDirectory()) return null;
      return { number: Number(match[1]), name: entry.name, dir: join(featureRoot, entry.name) };
    })
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);
}

async function inspectCycleArtifacts(cycleDir) {
  const artifacts = {};
  let complete = true;
  let reusableComplete = true;

  for (const name of REQUIRED_ARTIFACTS) {
    const filePath = join(cycleDir, name);
    const exists = await pathExists(filePath);
    let valid = false;
    let validationError = null;

    if (exists) {
      try {
        const raw = await readFile(filePath, "utf8");
        const validation = validateArtifactContent(name, raw);
        valid = validation.valid;
        validationError = validation.error;
      } catch (error) {
        valid = false;
        validationError = "Unable to read artifact: " + describeError(error);
      }
    }

    const usableForResume = exists && valid;

    artifacts[name] = {
      path: normalizeSlashes(filePath),
      exists,
      valid,
      usable_for_resume: usableForResume,
      validation_error: validationError
    };

    if (!exists) complete = false;
    if (!usableForResume) reusableComplete = false;
  }

  return {
    complete,
    reusable_complete: reusableComplete,
    required_artifacts: artifacts
  };
}

function describeCycleState(cycleNumber, artifacts, lastCompletedCycle) {
  const fixReportExists = artifacts.required_artifacts["fix-report.md"].usable_for_resume;
  const fixPlanExists = artifacts.required_artifacts["fix-plan.md"].usable_for_resume;
  const auditExists = artifacts.required_artifacts["audit-findings.md"].usable_for_resume;
  const reviewExists = artifacts.required_artifacts["review-findings.md"].usable_for_resume;

  if (fixReportExists && lastCompletedCycle >= cycleNumber) return "completed";
  if (fixReportExists) return "fix_report_complete_commit_push_pending";
  if (hasInvalidCycleArtifacts(artifacts)) return "invalid_cycle_artifacts";
  if (fixPlanExists) return "fix_planned_or_implementation_in_progress";
  if (auditExists && reviewExists) return "findings_ready_for_fix_planning";
  if (auditExists || reviewExists) return "review_in_progress";
  return "review_not_started";
}

function resolveRequiredAccessModes(setupData) {
  const fallback = setupData.fallback_execution_access_mode ?? "interactive_fallback";
  return {
    auditor: setupData.preferred_auditor_access_mode ?? setupData.preferred_execution_access_mode ?? fallback,
    reviewer: setupData.preferred_reviewer_access_mode ?? setupData.preferred_execution_access_mode ?? fallback,
    implementor: setupData.preferred_implementor_access_mode ?? setupData.preferred_execution_access_mode ?? fallback
  };
}

function shouldRecreateExecution(executionId, existingMode, requiredMode) {
  if (!isFilled(executionId) || !isFilled(requiredMode)) return false;
  if (!isFilled(existingMode)) return true;
  return rankAccessMode(existingMode) < rankAccessMode(requiredMode);
}

function rankAccessMode(mode) {
  return ACCESS_MODE_RANK[mode] ?? 0;
}

function determineNextAction(input) {
  if (input.setupStatus !== "ready") return "auto_invoke_review_cycle_setup";
  if (input.commitPushPending) return "finish_verification_and_git_closeout";
  if (input.currentCycleState === "invalid_cycle_artifacts") return "clean_invalid_cycle_artifacts_and_restart_current_cycle";
  for (const role of input.reviewStrategy.requested_lanes ?? []) {
    if (input.reportsReady[role] && !input.reportsSurfaced[role]) {
      return "surface_" + role + "_report_and_continue_wait";
    }
  }
  if (input.reportsReady.auditor && !input.reportsSurfaced.auditor) return "surface_auditor_report_and_continue_wait";
  if (input.reportsReady.reviewer && !input.reportsSurfaced.reviewer) return "surface_reviewer_report_and_continue_wait";
  if (Object.values(input.recreateDueToWeakAccess).some(Boolean)) return "recreate_execution_with_stronger_access_and_resume";
  if (input.currentCycleState === "fix_planned_or_implementation_in_progress") return "finish_implementation_verification_and_fix_report";
  if (input.reviewStrategy.mode === "final_regression_sanity") {
    if (input.reviewStrategy.review_requirement_satisfied) return "close_split_verdict_after_regression_sanity";
    return "request_final_regression_sanity_from_previously_approving_lane";
  }
  if (input.reviewStrategy.mode === "rejecting_lane_only") {
    if (input.reviewStrategy.review_requirement_satisfied) return "synthesize_fix_plan_from_rejecting_lane_only";
    return "request_rejecting_lane_only_and_carry_forward_prior_approval";
  }
  if (input.currentCycleState === "findings_ready_for_fix_planning") return "synthesize_fix_plan_and_resume_implementor";
  if (input.currentCycleState === "review_in_progress") return "resume_parallel_review_wait";
  return "send_cycle_request_to_auditor_and_reviewer";
}

function buildRegistryKey(phaseNumber, featureSlug) {
  return "phase" + phaseNumber + "/" + featureSlug;
}

function resolveFeatureRoot(repoRoot, phaseNumber, featureSlug) {
  const phaseRoot = resolve(repoRoot, "docs", "phase" + phaseNumber);
  const target = resolve(phaseRoot, ...featureSlug.split("/"));
  assertPathInside(phaseRoot, target, "feature root");
  return target;
}

function assertPathInside(basePath, targetPath, label) {
  const relativePath = relative(basePath, targetPath);
  if (relativePath === "" || relativePath === ".") {
    return;
  }
  if (relativePath.startsWith("..") || relativePath.includes("\\..") || relativePath.includes("/..")) {
    fail("Refusing to resolve " + label + " outside the allowed root.");
  }
}

function normalizeFeatureSlug(featureSlug) {
  const normalized = String(featureSlug).trim().replace(/\\/g, "/").replace(/\/+/g, "/");
  if (!normalized) {
    fail("feature-slug cannot be empty.");
  }
  if (normalized.startsWith("/") || normalized.endsWith("/")) {
    fail("feature-slug must not start or end with '/'.");
  }

  const segments = normalized.split("/");
  for (const segment of segments) {
    if (!segment || segment === "." || segment === "..") {
      fail("feature-slug contains an invalid path segment.");
    }
    if (!/^[A-Za-z0-9._-]+$/.test(segment)) {
      fail("feature-slug contains an invalid segment '" + segment + "'. Allowed characters: letters, numbers, dot, underscore, dash.");
    }
  }

  return segments.join("/");
}

function formatCycleName(number) {
  return "cycle-" + String(number).padStart(2, "0");
}

function detectCurrentBranch(repoRoot) {
  return gitOutput(repoRoot, ["branch", "--show-current"]);
}

function extractHighlights(text, heading, limit) {
  const section = extractSection(text, heading);
  if (!section) return [];
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^[-*+]\s*/, "").replace(/^\d+\)\s*/, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function validateArtifactContent(fileName, text) {
  const requiredHeadings = ARTIFACT_VALIDATION_RULES[fileName];
  if (!requiredHeadings) {
    return { valid: true, error: null };
  }

  const documentLines = stripCodeFences(text)
    .split(/\r?\n/)
    .map((line) => line.trim());

  const positions = [];
  const duplicates = [];
  const missing = [];

  for (const heading of requiredHeadings) {
    const headingPositions = [];
    for (let index = 0; index < documentLines.length; index += 1) {
      if (documentLines[index] === heading) {
        headingPositions.push(index);
      }
    }

    if (headingPositions.length === 0) {
      missing.push(heading);
      continue;
    }

    if (headingPositions.length > 1) {
      duplicates.push(heading);
    }

    positions.push(headingPositions[0]);
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: "Missing required headings: " + missing.join(", ")
    };
  }

  if (duplicates.length > 0) {
    return {
      valid: false,
      error: "Duplicate required headings detected: " + duplicates.join(", ")
    };
  }

  for (let index = 1; index < positions.length; index += 1) {
    if (positions[index] <= positions[index - 1]) {
      return {
        valid: false,
        error: "Required headings are out of order."
      };
    }
  }

  return { valid: true, error: null };
}

function stripCodeFences(text) {
  const lines = text.split(/\r?\n/);
  const kept = [];
  let inFence = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) {
      kept.push(line);
    }
  }

  return kept.join("\n");
}

function hasInvalidCycleArtifacts(artifacts) {
  return Object.values(artifacts.required_artifacts).some((artifact) => artifact.exists && !artifact.valid);
}

function extractSection(text, heading) {
  if (!text) return "";
  const lines = stripCodeFences(text).split(/\r?\n/);
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

function diffSeconds(start, end) {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return Math.round((endMs - startMs) / 1000);
}

function maxTimestamp(...values) {
  const filtered = values
    .filter(Boolean)
    .map((value) => ({ value, ms: Date.parse(value) }))
    .filter((entry) => Number.isFinite(entry.ms));

  if (filtered.length === 0) return null;
  filtered.sort((a, b) => a.ms - b.ms);
  return filtered[filtered.length - 1].value;
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return null;
  const total = Math.max(0, seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  const parts = [];
  if (hours > 0) parts.push(String(hours) + "h");
  if (minutes > 0) parts.push(String(minutes) + "m");
  parts.push(String(remainingSeconds) + "s");
  return parts.join(" ");
}

function requireReportRole(role) {
  if (!REPORT_ROLES.includes(role)) {
    fail("Expected --role auditor|reviewer, got '" + role + "'.");
  }
}

function requireWorkerRole(role) {
  if (!["auditor", "reviewer", "implementor"].includes(role)) {
    fail("Expected worker role auditor|reviewer|implementor, got '" + role + "'.");
  }
}

function validateRuntimeStatus(status) {
  return RUNTIME_STATUSES.has(status) ? status : "review_not_started";
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

    if (["capability", "recreated-execution"].includes(key)) {
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

function parsePositiveInteger(value, argumentName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    fail("Expected --" + argumentName + " to be a positive integer, got '" + value + "'.");
  }
  return parsed;
}

function parseNonNegativeInteger(value, argumentName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    fail("Expected --" + argumentName + " to be a non-negative integer, got '" + value + "'.");
  }
  return parsed;
}

function parseCapabilityPairs(pairs) {
  const result = {};
  for (const item of pairs) {
    const separator = item.indexOf("=");
    if (separator <= 0) fail("Capability '" + item + "' must use key=value form.");
    const key = item.slice(0, separator).trim();
    const rawValue = item.slice(separator + 1).trim();
    if (!key) fail("Capability '" + item + "' has an empty key.");
    result[key] = coerceValue(rawValue);
  }
  return result;
}

function coerceValue(rawValue) {
  if (rawValue === "true") return true;
  if (rawValue === "false") return false;
  if (rawValue === "null") return null;
  if (/^-?\d+$/.test(rawValue)) return Number(rawValue);
  return rawValue;
}

function validateOptionalEnum(value, allowedValues, argumentName) {
  if (!isFilled(value)) return null;
  if (!allowedValues.has(value)) {
    fail("Invalid value for --" + argumentName + ". Allowed values: " + Array.from(allowedValues).join(", "));
  }
  return value;
}

function validateOptionalStateEnum(value, allowedValues, fieldName, repairs) {
  if (!isFilled(value)) return null;
  if (!allowedValues.has(value)) {
    repairs.push("Field '" + fieldName + "' contained an unsupported value and was reset.");
    return null;
  }
  return value;
}

function normalizeRepoRoot(value) {
  return normalizeSlashes(resolve(value));
}

function normalizeSlashes(value) {
  return String(value).replace(/\\/g, "/");
}

function normalizeGitPath(repoRoot, targetPath) {
  const relativePath = relative(repoRoot, targetPath) || ".";
  return normalizeSlashes(relativePath);
}

function safeInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
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

function emptyToNull(value) {
  return isFilled(value) ? value : null;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function safeReaddir(targetPath) {
  try {
    return await readdir(targetPath, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function readTextIfExists(filePath) {
  if (!(await pathExists(filePath))) return "";
  return readFile(filePath, "utf8");
}

async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function writeText(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, value, "utf8");
}

function gitOutput(repoRoot, args) {
  try {
    const result = spawnSync("git", ["-c", "safe.directory=" + normalizeSlashes(repoRoot), ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      windowsHide: true,
      timeout: 10000
    });
    if (result.status !== 0) {
      return null;
    }
    const stdout = result.stdout?.trim();
    return stdout ? stdout : null;
  } catch {
    return null;
  }
}

function isGitTrackedAndClean(repoRoot, targetPath) {
  const normalizedPath = normalizeGitPath(repoRoot, targetPath);

  const tracked = spawnSync("git", [
    "-c",
    "safe.directory=" + normalizeSlashes(repoRoot),
    "ls-files",
    "--error-unmatch",
    "--",
    normalizedPath
  ], {
    cwd: repoRoot,
    windowsHide: true,
    stdio: "ignore",
    timeout: 10000
  });
  if (tracked.status !== 0) {
    return false;
  }

  const status = spawnSync("git", [
    "-c",
    "safe.directory=" + normalizeSlashes(repoRoot),
    "status",
    "--porcelain",
    "--",
    normalizedPath
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
    timeout: 10000
  });
  if (status.status !== 0) {
    return false;
  }

  return !status.stdout?.trim();
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
