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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0];
  if (!command) {
    fail("Missing command. Use 'prepare', 'update-state', 'record-event', or 'cycle-summary'.");
  }

  if (command === "prepare") {
    printJson(await prepareCycle({
      phaseNumber: parsePhaseNumber(requiredArg(args, "phase-number")),
      featureSlug: requiredArg(args, "feature-slug"),
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
      phaseNumber: parsePhaseNumber(requiredArg(args, "phase-number")),
      featureSlug: requiredArg(args, "feature-slug"),
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
      phaseNumber: parsePhaseNumber(requiredArg(args, "phase-number")),
      featureSlug: requiredArg(args, "feature-slug"),
      repoRoot: normalizeRepoRoot(args.values["repo-root"] ?? "C:/ADF"),
      event: requiredArg(args, "event"),
      role: args.values.role ?? null,
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
      phaseNumber: parsePhaseNumber(requiredArg(args, "phase-number")),
      featureSlug: requiredArg(args, "feature-slug"),
      repoRoot: normalizeRepoRoot(args.values["repo-root"] ?? "C:/ADF"),
      cycleNumber: args.values["cycle-number"] ?? null
    }));
    return;
  }

  fail("Unknown command '" + command + "'. Use 'prepare', 'update-state', 'record-event', or 'cycle-summary'.");
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
    repoRoot: input.repoRoot,
    phaseNumber: input.phaseNumber,
    featureSlug: input.featureSlug,
    taskSummary: input.taskSummary,
    scopeHint: input.scopeHint,
    nonGoals: input.nonGoals
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

  const cycleStatus = await selectCycle(featureRoot, safeNumber(stateLoad.state.last_completed_cycle, 0));
  if (cycleStatus.mode === "new") {
    await mkdir(cycleStatus.cycleDir, { recursive: true });
  }

  const activeArtifacts = await inspectCycleArtifacts(cycleStatus.cycleDir);
  const currentCycleState = describeCycleState(
    cycleStatus.cycleNumber,
    activeArtifacts,
    safeNumber(stateLoad.state.last_completed_cycle, 0)
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
  const commitPushPending = fixReportExists && safeNumber(nextState.last_completed_cycle, 0) < cycleStatus.cycleNumber;
  const executionActions = {
    auditor: decideExecutionAction(nextState.auditor_execution_id, recreateDueToWeakAccess.auditor),
    reviewer: decideExecutionAction(nextState.reviewer_execution_id, recreateDueToWeakAccess.reviewer),
    implementor: decideExecutionAction(nextState.implementor_execution_id, recreateDueToWeakAccess.implementor)
  };
  const reportsReady = nextState.cycle_runtime?.report_ready ?? { auditor: false, reviewer: false };
  const reportsSurfaced = nextState.cycle_runtime?.report_surfaced ?? { auditor: false, reviewer: false };
  const setupStatus = setupInfo.complete ? "ready" : setupInfo.exists ? "incomplete" : "missing";
  const nextAction = determineNextAction({
    setupStatus,
    recreateDueToWeakAccess,
    commitPushPending,
    currentCycleState,
    reportsReady,
    reportsSurfaced
  });

  return {
    repo_root: normalizeSlashes(input.repoRoot),
    setup_path: normalizeSlashes(setupInfo.path),
    registry_path: normalizeSlashes(registryLoad.path),
    setup_exists: setupInfo.exists,
    setup_complete: setupInfo.complete,
    auto_invoke_setup_required: !setupInfo.complete,
    feature_root: normalizeSlashes(featureRoot),
    readme_path: normalizeSlashes(readmePath),
    context_path: normalizeSlashes(contextPath),
    state_path: normalizeSlashes(statePath),
    registry_key: registryKey,
    readme_created: readmeCreated,
    state_created: stateLoad.created,
    needs_context_creation: !(await pathExists(contextPath)),
    latest_cycle_number: cycleStatus.latestCycleNumber,
    last_completed_cycle: safeNumber(nextState.last_completed_cycle, 0),
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
      runtime: nextState.cycle_runtime
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
      reviewer_reasoning_effort: nextState.reviewer_reasoning_effort ?? null
    },
    continuity: {
      registry_entry_found: Boolean(registryEntry),
      continuity_strategy: setupInfo.data.persistent_execution_strategy ?? "artifact_continuity_only",
      preferred_execution_runtime: setupInfo.data.preferred_execution_runtime ?? null,
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

  if (input.auditorExecutionId !== undefined) next.auditor_execution_id = input.auditorExecutionId || null;
  if (input.reviewerExecutionId !== undefined) next.reviewer_execution_id = input.reviewerExecutionId || null;
  if (input.implementorExecutionId !== undefined) next.implementor_execution_id = input.implementorExecutionId || null;
  if (input.auditorExecutionAccessMode !== undefined) next.auditor_execution_access_mode = input.auditorExecutionAccessMode || null;
  if (input.reviewerExecutionAccessMode !== undefined) next.reviewer_execution_access_mode = input.reviewerExecutionAccessMode || null;
  if (input.implementorExecutionAccessMode !== undefined) next.implementor_execution_access_mode = input.implementorExecutionAccessMode || null;
  if (input.auditorModel !== undefined) next.auditor_model = input.auditorModel || null;
  if (input.reviewerModel !== undefined) next.reviewer_model = input.reviewerModel || null;
  if (input.auditorReasoningEffort !== undefined) next.auditor_reasoning_effort = input.auditorReasoningEffort || null;
  if (input.reviewerReasoningEffort !== undefined) next.reviewer_reasoning_effort = input.reviewerReasoningEffort || null;
  if (input.resolvedRuntimePermissionModel !== undefined) next.resolved_runtime_permission_model = input.resolvedRuntimePermissionModel || null;
  if (input.accessModeResolutionNotes !== undefined) next.access_mode_resolution_notes = input.accessModeResolutionNotes || null;
  if (input.currentBranch !== undefined) next.current_branch = input.currentBranch || null;
  if (input.lastCommitSha !== undefined) next.last_commit_sha = input.lastCommitSha || null;
  if (input.lastCompletedCycle !== undefined) next.last_completed_cycle = parsePhaseNumber(input.lastCompletedCycle);
  if (input.activeCycleNumber !== undefined) next.active_cycle_number = parsePhaseNumber(input.activeCycleNumber);

  next.resolved_runtime_capabilities = {
    ...(next.resolved_runtime_capabilities ?? {}),
    ...parseCapabilityPairs(input.capabilityPairs)
  };

  if (input.recreatedExecutionRoles.length > 0) {
    ensureCycleRuntime(next, next.active_cycle_number ?? safeNumber(next.last_completed_cycle, 0) + 1, "manual_state_update");
    for (const role of input.recreatedExecutionRoles) {
      if (!["auditor", "reviewer", "implementor"].includes(role)) {
        fail("Unsupported recreated execution role '" + role + "'.");
      }
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
    registry_entry: registrySync.entry
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
    ? parsePhaseNumber(input.cycleNumber)
    : next.active_cycle_number ?? Math.max(safeNumber(next.last_completed_cycle, 0) + 1, 1);
  const cycleName = formatCycleName(cycleNumber);
  const cycleDir = join(featureRoot, cycleName);
  await mkdir(cycleDir, { recursive: true });
  const artifacts = await inspectCycleArtifacts(cycleDir);
  const currentCycleState = describeCycleState(cycleNumber, artifacts, safeNumber(next.last_completed_cycle, 0));
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
    timestamp,
    note: input.note
  });

  if (input.currentBranch !== null) synced.current_branch = input.currentBranch || null;
  if (input.lastCommitSha !== null) synced.last_commit_sha = input.lastCommitSha || null;
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
    registry_entry: registrySync.entry
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
    ? parsePhaseNumber(input.cycleNumber)
    : stateLoad.state.active_cycle_number ?? Math.max(safeNumber(stateLoad.state.last_completed_cycle, 0), 1);
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

  return {
    feature_root: normalizeSlashes(featureRoot),
    cycle_number: cycleNumber,
    cycle_name: cycleName,
    cycle_dir: normalizeSlashes(cycleDir),
    fix_report_exists: artifacts.required_artifacts["fix-report.md"].usable_for_resume,
    current_cycle_state: describeCycleState(cycleNumber, artifacts, safeNumber(stateLoad.state.last_completed_cycle, 0)),
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
    runtime
  };
}

function applyEvent(input) {
  const state = input.state;
  ensureCycleRuntime(
    state,
    state.active_cycle_number ?? Math.max(safeNumber(state.last_completed_cycle, 0) + 1, 1),
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
      runtime.review_requested_at ??= runtime.review_requested_at ?? timestamp;
      runtime.report_ready[input.role] = true;
      if (input.role === "auditor") runtime.auditor_finished_at ??= timestamp;
      if (input.role === "reviewer") runtime.reviewer_finished_at ??= timestamp;
      runtime.status = runtime.report_ready.auditor && runtime.report_ready.reviewer ? "both_reviews_ready" : "partial_review_ready";
      break;
    case "report-surfaced":
      requireReportRole(input.role);
      runtime.report_surfaced[input.role] = true;
      if (!runtime.report_surface_order.includes(input.role)) {
        runtime.report_surface_order.push(input.role);
      }
      runtime.status = runtime.report_ready.auditor && runtime.report_ready.reviewer && runtime.report_surfaced.auditor && runtime.report_surfaced.reviewer
        ? "reviews_surfaced_ready_for_fix_plan"
        : runtime.status;
      break;
    case "implementor-started":
      runtime.implementor_started_at ??= timestamp;
      runtime.status = "implementation_running";
      break;
    case "implementor-finished":
      runtime.implementor_finished_at ??= timestamp;
      runtime.status = "implementation_finished_pending_verification";
      break;
    case "verification-finished":
      runtime.verification_finished_at ??= timestamp;
      runtime.status = "verification_complete";
      break;
    case "fix-report-saved":
      runtime.status = "fix_report_complete_commit_push_pending";
      break;
    case "closeout-finished":
      runtime.cycle_finished_at ??= timestamp;
      runtime.status = "completed";
      state.last_completed_cycle = Math.max(safeNumber(state.last_completed_cycle, 0), runtime.cycle_number);
      break;
    default:
      fail("Unsupported event '" + input.event + "'.");
  }

  if (input.note) {
    runtime.last_note = input.note;
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
    changed: JSON.stringify(input.state.cycle_runtime ?? null) !== JSON.stringify(runtime)
      || safeNumber(input.state.active_cycle_number, 0) !== input.cycleStatus.cycleNumber
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
    status,
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
    recreated_executions: { auditor: false, reviewer: false, implementor: false },
    last_note: null
  };
}

function normalizeCycleRuntime(runtime) {
  return {
    cycle_number: runtime.cycle_number,
    cycle_name: runtime.cycle_name ?? formatCycleName(runtime.cycle_number),
    status: runtime.status ?? "review_not_started",
    cycle_started_at: runtime.cycle_started_at ?? null,
    review_requested_at: runtime.review_requested_at ?? null,
    auditor_finished_at: runtime.auditor_finished_at ?? null,
    reviewer_finished_at: runtime.reviewer_finished_at ?? null,
    implementor_started_at: runtime.implementor_started_at ?? null,
    implementor_finished_at: runtime.implementor_finished_at ?? null,
    verification_finished_at: runtime.verification_finished_at ?? null,
    cycle_finished_at: runtime.cycle_finished_at ?? null,
    report_ready: {
      auditor: Boolean(runtime.report_ready?.auditor),
      reviewer: Boolean(runtime.report_ready?.reviewer)
    },
    report_surfaced: {
      auditor: Boolean(runtime.report_surfaced?.auditor),
      reviewer: Boolean(runtime.report_surfaced?.reviewer)
    },
    report_surface_order: sanitizeReportSurfaceOrder(runtime.report_surface_order ?? [], runtime.report_surfaced ?? {}),
    recreated_executions: {
      auditor: Boolean(runtime.recreated_executions?.auditor),
      reviewer: Boolean(runtime.recreated_executions?.reviewer),
      implementor: Boolean(runtime.recreated_executions?.implementor)
    },
    last_note: runtime.last_note ?? null
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
    if (existingStatus === "verification_complete") return existingStatus;
    if (existingStatus === "implementation_finished_pending_verification") return existingStatus;
    if (existingStatus === "implementation_running") return existingStatus;
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
  if (executionId && recreateDueToWeakAccess) return "recreate";
  if (executionId) return "resume";
  return "spawn";
}

async function loadOrInitializeState(input) {
  const defaults = defaultState(input);
  const initialized = mergeStateWithRegistryEntry(defaults, input.registryEntry);

  if (!(await pathExists(input.statePath))) {
    await writeJson(input.statePath, initialized.state);
    return { created: true, changed: true, state: initialized.state };
  }

  const existing = await readJson(input.statePath);
  const merged = {
    ...defaults,
    ...existing,
    feature_agent_registry_key: existing.feature_agent_registry_key ?? defaults.feature_agent_registry_key,
    resolved_runtime_capabilities: {
      ...(defaults.resolved_runtime_capabilities ?? {}),
      ...(existing.resolved_runtime_capabilities ?? {})
    },
    created_at: existing.created_at ?? defaults.created_at,
    updated_at: existing.updated_at ?? defaults.updated_at,
    cycle_runtime: existing.cycle_runtime ?? defaults.cycle_runtime
  };

  if (safeNumber(existing.last_completed_cycle, 0) === 0 && safeNumber(input.inferredLastCompletedCycle, 0) > 0) {
    merged.last_completed_cycle = input.inferredLastCompletedCycle;
  }
  if (!existing.last_commit_sha && input.inferredLastCommitSha) {
    merged.last_commit_sha = input.inferredLastCommitSha;
  }

  const withRegistry = mergeStateWithRegistryEntry(merged, input.registryEntry);
  if (withRegistry.changed || JSON.stringify(existing) !== JSON.stringify(withRegistry.state)) {
    withRegistry.state.updated_at = nowIso();
    await writeJson(input.statePath, withRegistry.state);
    return { created: false, changed: true, state: withRegistry.state };
  }

  return { created: false, changed: false, state: withRegistry.state };
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
  const inferredCycle = Math.max(safeNumber(input.inferredLastCompletedCycle, 0) + 1, 1);
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
    last_completed_cycle: safeNumber(input.inferredLastCompletedCycle, 0),
    last_commit_sha: input.inferredLastCommitSha ?? null,
    active_cycle_number: inferredCycle,
    cycle_runtime: null,
    created_at: nowIso(),
    updated_at: nowIso()
  };
}

async function loadSetup(repoRoot) {
  const setupPath = resolve(repoRoot, ".codex", "review-cycle", "setup.json");
  if (!(await pathExists(setupPath))) {
    return { path: setupPath, exists: false, complete: false, data: {} };
  }

  const data = await readJson(setupPath);
  const complete = REQUIRED_SETUP_FIELDS.every((key) => isFilled(data[key]));
  return { path: setupPath, exists: true, complete, data };
}

async function loadRegistry(repoRoot) {
  const registryPath = resolve(repoRoot, ".codex", "review-cycle", "agent-registry.json");
  if (!(await pathExists(registryPath))) {
    return { path: registryPath, exists: false, registry: defaultRegistry() };
  }

  const data = await readJson(registryPath);
  return {
    path: registryPath,
    exists: true,
    registry: {
      version: data.version ?? 1,
      features: data.features ?? {}
    }
  };
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
    if (existingEntry) {
      const nextRegistry = {
        ...input.registryLoad.registry,
        features: { ...input.registryLoad.registry.features }
      };
      delete nextRegistry.features[input.registryKey];
      await writeJson(input.registryLoad.path, nextRegistry);
      return {
        changed: true,
        entry: null,
        registry_path: normalizeSlashes(input.registryLoad.path)
      };
    }
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
  const changed = JSON.stringify(stripUpdatedAt(existingEntry)) !== JSON.stringify(stripUpdatedAt(nextEntry));
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
  await writeText(input.readmePath, lines.join("\n") + "\n");
  return true;
}

async function selectCycle(featureRoot, lastCompletedCycle) {
  const entries = await safeReaddir(featureRoot);
  const cycles = entries
    .map((entry) => {
      const match = /^cycle-(\d+)$/.exec(entry.name);
      if (!match || !entry.isDirectory()) return null;
      return { number: Number(match[1]), name: entry.name, dir: join(featureRoot, entry.name) };
    })
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);

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

  const nextNumber = latestCycleNumber > 0 ? latestCycleNumber + 1 : 1;
  return {
    latestCycleNumber,
    mode: "new",
    cycleNumber: nextNumber,
    cycleName: formatCycleName(nextNumber),
    cycleDir: join(featureRoot, formatCycleName(nextNumber))
  };
}

async function inferExistingStreamState(repoRoot, featureRoot) {
  const entries = await safeReaddir(featureRoot);
  const cycles = entries
    .map((entry) => {
      const match = /^cycle-(\d+)$/.exec(entry.name);
      if (!match || !entry.isDirectory()) return null;
      return { number: Number(match[1]), dir: join(featureRoot, entry.name) };
    })
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);

  let lastCompletedCycle = 0;
  let lastCommitSha = null;

  for (const cycle of cycles) {
    const status = await inspectCycleArtifacts(cycle.dir);
    if (!status.complete) {
      continue;
    }

    const allTrackedAndClean = Object.values(status.required_artifacts).every((artifact) =>
      isGitTrackedAndClean(repoRoot, artifact.path)
    );
    if (!allTrackedAndClean) {
      continue;
    }

    lastCompletedCycle = cycle.number;
    const cycleCommit = gitOutput(repoRoot, ["log", "-1", "--format=%H", "--", normalizeGitPath(repoRoot, cycle.dir)]);
    if (cycleCommit) {
      lastCommitSha = cycleCommit;
    }
  }

  return { lastCompletedCycle, lastCommitSha };
}

async function inspectCycleArtifacts(cycleDir) {
  const artifacts = {};
  let complete = true;
  let reusableComplete = true;
  for (const name of REQUIRED_ARTIFACTS) {
    const filePath = join(cycleDir, name);
    const exists = await pathExists(filePath);
    let valid = false;
    let validation_error = null;
    if (exists) {
      const raw = await readFile(filePath, "utf8");
      const validation = validateArtifactContent(name, raw);
      valid = validation.valid;
      validation_error = validation.error;
    }
    const usable_for_resume = exists && valid;
    artifacts[name] = {
      path: normalizeSlashes(filePath),
      exists,
      valid,
      usable_for_resume,
      validation_error
    };
    if (!exists) complete = false;
    if (!usable_for_resume) reusableComplete = false;
  }
  return { complete, reusable_complete: reusableComplete, required_artifacts: artifacts };
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
  if (!executionId || !requiredMode) return false;
  if (!existingMode) return true;
  return rankAccessMode(existingMode) < rankAccessMode(requiredMode);
}

function rankAccessMode(mode) {
  const normalized = String(mode ?? "").toLowerCase();
  if (/(full_auto|dangerously-bypass|full-access|elevated|approval_never|never_prompt)/.test(normalized)) return 5;
  if (/(project_rules|inherits_current_runtime_access|inherits_runtime_access|workspace-write)/.test(normalized)) return 4;
  if (/(auto_edit|approval_auto|yolo)/.test(normalized)) return 3;
  if (/(interactive|prompt|manual)/.test(normalized)) return 1;
  return 0;
}

function determineNextAction(input) {
  if (input.setupStatus !== "ready") return "auto_invoke_review_cycle_setup";
  if (input.commitPushPending) return "finish_verification_and_git_closeout";
  if (input.currentCycleState === "invalid_cycle_artifacts") return "clean_invalid_cycle_artifacts_and_restart_current_cycle";
  if (input.reportsReady.auditor && !input.reportsSurfaced.auditor) return "surface_auditor_report_and_continue_wait";
  if (input.reportsReady.reviewer && !input.reportsSurfaced.reviewer) return "surface_reviewer_report_and_continue_wait";
  if (Object.values(input.recreateDueToWeakAccess).some(Boolean)) return "recreate_execution_with_stronger_access_and_resume";
  if (input.currentCycleState === "findings_ready_for_fix_planning") return "synthesize_fix_plan_and_resume_implementor";
  if (input.currentCycleState === "fix_planned_or_implementation_in_progress") return "finish_implementation_verification_and_fix_report";
  if (input.currentCycleState === "review_in_progress") return "resume_parallel_review_wait";
  return "send_cycle_request_to_auditor_and_reviewer";
}

function buildRegistryKey(phaseNumber, featureSlug) {
  return "phase" + phaseNumber + "/" + featureSlug;
}

function resolveFeatureRoot(repoRoot, phaseNumber, featureSlug) {
  return resolve(repoRoot, "docs", "phase" + phaseNumber, featureSlug);
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

  const missingHeadings = requiredHeadings.filter((heading) => !hasExactHeading(text, heading));
  if (missingHeadings.length === 0) {
    return { valid: true, error: null };
  }

  return {
    valid: false,
    error: "Missing required headings: " + missingHeadings.join(", ")
  };
}

function hasExactHeading(text, heading) {
  return text
    .split(/\r?\n/)
    .some((line) => line.trim() === heading);
}

function hasInvalidCycleArtifacts(artifacts) {
  return Object.values(artifacts.required_artifacts).some((artifact) => artifact.exists && !artifact.valid);
}

function extractSection(text, heading) {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
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
  if (!value) fail("Missing required argument --" + key + ".");
  return value;
}

function parsePhaseNumber(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) fail("Expected a non-negative integer, got '" + value + "'.");
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

function normalizeRepoRoot(value) {
  return normalizeSlashes(resolve(value));
}

function normalizeSlashes(value) {
  return value.replace(/\\/g, "/");
}

function normalizeGitPath(repoRoot, targetPath) {
  const relativePath = relative(repoRoot, targetPath) || ".";
  return normalizeSlashes(relativePath);
}

function safeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function isFilled(value) {
  return !(value === undefined || value === null || String(value).trim() === "");
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
      windowsHide: true
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
  const tracked = spawnSync("git", ["-c", "safe.directory=" + normalizeSlashes(repoRoot), "ls-files", "--error-unmatch", "--", normalizedPath], {
    cwd: repoRoot,
    windowsHide: true,
    stdio: "ignore"
  });
  if (tracked.status !== 0) {
    return false;
  }

  const status = spawnSync("git", ["-c", "safe.directory=" + normalizeSlashes(repoRoot), "status", "--porcelain", "--", normalizedPath], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true
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
