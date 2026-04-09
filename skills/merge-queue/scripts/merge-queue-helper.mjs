#!/usr/bin/env node

import { mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import {
  ACCESS_MODES,
  EXECUTION_RUNTIMES,
  PERSISTENT_EXECUTION_STRATEGIES,
  RUNTIME_PERMISSION_MODELS,
  buildFeatureRegistryKey,
  booleanArg,
  describeError,
  detectCurrentBranch,
  detectDefaultBaseBranch,
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
  requiredArg,
  resolveCanonicalGitProjectRoot,
  resolveFeatureRoot,
  resolveSkillStateRoot,
  sanitizePathSegment,
  withLock,
  writeJsonAtomic,
  fail
} from "../../governed-feature-runtime.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const skillRoot = dirname(dirname(scriptPath));
const skillsRoot = dirname(skillRoot);
const implementPlanHelperPath = join(skillsRoot, "implement-plan", "scripts", "implement-plan-helper.mjs");

const REQUIRED_SETUP_FIELDS = [
  "preferred_execution_access_mode",
  "fallback_execution_access_mode",
  "runtime_permission_model",
  "execution_access_notes",
  "preferred_execution_runtime",
  "persistent_execution_strategy"
];

const REQUEST_STATUSES = new Set(["queued", "in_progress", "merged", "blocked"]);
const LOCAL_OPERATIONAL_SETUP_PATH = /^\.codex\/[^/]+\/setup\.json$/i;
const LOCAL_SYNC_STATUSES = new Set([
  "not_started",
  "fetched_only",
  "fast_forwarded",
  "preserve_restore_succeeded",
  "preserve_restore_failed",
  "skipped_dirty_checkout",
  "skipped_branch_not_checked_out",
  "failed"
]);

installBrokenPipeGuards();

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0] ?? "help";

  if (command === "help") {
    printJson(await renderHelp(args));
    return;
  }
  if (command === "get-settings") {
    printJson(await getSettings(args));
    return;
  }
  if (command === "status") {
    printJson(await getStatus(args));
    return;
  }
  if (command === "enqueue") {
    printJson(await enqueueRequest({
      projectRoot: normalizeProjectRoot(requiredArg(args, "project-root")),
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug")),
      approvedCommitSha: args.values["approved-commit-sha"],
      baseBranch: args.values["base-branch"],
      featureBranch: args.values["feature-branch"],
      worktreePath: args.values["worktree-path"],
      queueNote: args.values["queue-note"]
    }));
    return;
  }
  if (command === "process-next") {
    printJson(await processNext({
      projectRoot: normalizeProjectRoot(requiredArg(args, "project-root")),
      baseBranch: args.values["base-branch"] ?? null,
      syncLocalTarget: booleanArg(args, "sync-local-target", true)
    }));
    return;
  }
  if (command === "resume-blocked") {
    printJson(await resumeBlocked({
      projectRoot: normalizeProjectRoot(requiredArg(args, "project-root")),
      requestId: requiredArg(args, "request-id"),
      approvedCommitSha: args.values["approved-commit-sha"] ?? null,
      baseBranch: args.values["base-branch"] ?? null
    }));
    return;
  }

  fail("Unknown command '" + command + "'. Use help, get-settings, status, enqueue, process-next, or resume-blocked.");
}

async function renderHelp(args) {
  const requestedProjectRoot = normalizeProjectRoot(args.values["project-root"] ?? process.cwd());
  const controlProjectRoot = resolveControlProjectRoot(requestedProjectRoot);
  const settings = await getSettingsCore(controlProjectRoot);
  const status = await getStatusCore(controlProjectRoot);
  return {
    command: "help",
    project_root: controlProjectRoot,
    requested_project_root: requestedProjectRoot === controlProjectRoot ? undefined : requestedProjectRoot,
    purpose: "Queue and land approved feature merges FIFO per target branch using isolated merge worktrees and truthful completion handoff.",
    actions: ["help", "get-settings", "status", "enqueue", "process-next", "resume-blocked"],
    required_inputs_for_enqueue: ["project_root", "phase_number", "feature_slug"],
    optional_enqueue_inputs: ["approved_commit_sha", "base_branch", "feature_branch", "worktree_path", "queue_note"],
    required_inputs_for_resume_blocked: ["project_root", "request_id"],
    optional_resume_blocked_inputs: ["approved_commit_sha", "base_branch"],
    blocked_merge_recovery: "Use resume-blocked to transition a blocked merge request back to queued after fixing the blocker. Do not use manual merge worktrees as the recovery path.",
    transparent_setup_behavior: "The main skill validates setup internally and refreshes it when missing or invalid before merge work starts.",
    current_settings_summary: settings.summary,
    queue_summary: status.summary
  };
}

async function getSettings(args) {
  const requestedProjectRoot = normalizeProjectRoot(args.values["project-root"] ?? process.cwd());
  const controlProjectRoot = resolveControlProjectRoot(requestedProjectRoot);
  const settings = await getSettingsCore(controlProjectRoot);
  return {
    ...settings,
    requested_project_root: requestedProjectRoot === controlProjectRoot ? undefined : requestedProjectRoot
  };
}

async function getSettingsCore(projectRoot) {
  const setup = await loadSetup(projectRoot);
  return {
    command: "get-settings",
    project_root: projectRoot,
    queue_root: normalizeSlashes(resolveSkillStateRoot(projectRoot, "merge-queue")),
    setup_path: normalizeSlashes(setup.path),
    setup_exists: setup.exists,
    setup_complete: setup.complete,
    validation_errors: setup.validation_errors,
    validation_warnings: setup.validation_warnings,
    summary: {
      setup_status: setup.complete ? "ready" : setup.exists ? "invalid" : "missing",
      preferred_execution_access_mode: setup.data.preferred_execution_access_mode ?? null,
      preferred_execution_runtime: setup.data.preferred_execution_runtime ?? null,
      preferred_control_plane_runtime: setup.data.preferred_control_plane_runtime ?? null,
      fallback_execution_access_mode: setup.data.fallback_execution_access_mode ?? null,
      runtime_permission_model: setup.data.runtime_permission_model ?? null,
      persistent_execution_strategy: setup.data.persistent_execution_strategy ?? null
    }
  };
}

async function getStatus(args) {
  const requestedProjectRoot = normalizeProjectRoot(args.values["project-root"] ?? process.cwd());
  const controlProjectRoot = resolveControlProjectRoot(requestedProjectRoot);
  const status = await getStatusCore(controlProjectRoot);
  return {
    ...status,
    requested_project_root: requestedProjectRoot === controlProjectRoot ? undefined : requestedProjectRoot
  };
}

async function getStatusCore(projectRoot) {
  const paths = buildPaths(projectRoot);
  const queue = await loadQueue(projectRoot);
  const lanes = Object.values(queue.data.lanes ?? {}).map((lane) => summarizeLane(lane));
  lanes.sort((left, right) => String(left.base_branch).localeCompare(String(right.base_branch)));
  return {
    command: "status",
    project_root: projectRoot,
    queue_path: normalizeSlashes(paths.queuePath),
    queue_exists: queue.exists,
    summary: {
      open_requests: lanes.reduce((sum, lane) => sum + lane.queued_count + lane.in_progress_count + lane.blocked_count, 0),
      merged_requests: lanes.reduce((sum, lane) => sum + lane.merged_count, 0),
      lane_count: lanes.length
    },
    lanes
  };
}

async function enqueueRequest(input) {
  const controlProjectRoot = resolveControlProjectRoot(input.projectRoot);
  const paths = buildPaths(controlProjectRoot);
  const setup = await loadSetup(controlProjectRoot);
  if (!setup.complete) {
    fail("merge-queue setup is missing or invalid. Refresh setup before enqueue.");
  }

  const featureRoot = resolveFeatureRoot(input.projectRoot, input.phaseNumber, input.featureSlug);
  const implementPlanState = await readImplementPlanState(featureRoot);
  if (implementPlanState?.feature_status === "completed") {
    fail("Cannot enqueue merge for a feature that is already completed.");
  }
  const baseBranch = input.baseBranch
    ?? implementPlanState?.base_branch
    ?? detectDefaultBaseBranch(controlProjectRoot);
  const featureBranch = input.featureBranch
    ?? implementPlanState?.feature_branch
    ?? "implement-plan/phase" + input.phaseNumber + "/" + input.featureSlug.replace(/\//g, "-");
  const worktreePath = normalizeSlashes(
    input.worktreePath
      ?? implementPlanState?.worktree_path
      ?? join(resolveSkillStateRoot(input.projectRoot, "implement-plan"), "worktrees", "phase" + input.phaseNumber, ...input.featureSlug.split("/").map((segment) => sanitizePathSegment(segment)))
  );
  const approvedCommitSha = input.approvedCommitSha
    ?? implementPlanState?.approved_commit_sha
    ?? null;

  if (!approvedCommitSha) {
    fail("Cannot enqueue merge without an approved commit SHA.");
  }
  const closeoutReadiness = await validateCloseoutReadinessBeforeMerge(input.projectRoot, input.phaseNumber, input.featureSlug);
  if (!closeoutReadiness.ready) {
    fail("Cannot enqueue merge because governed closeout readiness is not satisfied: " + closeoutReadiness.blockers.join("; "));
  }
  const forbiddenSetupChanges = detectForbiddenLocalOperationalSetupChanges(controlProjectRoot, baseBranch, approvedCommitSha);
  if (forbiddenSetupChanges.length > 0) {
    fail(buildForbiddenLocalOperationalSetupMessage(baseBranch, approvedCommitSha, forbiddenSetupChanges));
  }

  const registryKey = buildFeatureRegistryKey(input.phaseNumber, input.featureSlug);
  const now = nowIso();
  const laneKey = normalizeLaneKey(baseBranch);
  const requestId = "merge-" + sanitizePathSegment(baseBranch) + "-" + input.phaseNumber + "-" + sanitizePathSegment(input.featureSlug) + "-" + Date.now();

  const result = await withLock(paths.projectLocksRoot, "queue", async () => {
    const current = await loadQueue(controlProjectRoot);
    const next = current.data;
    const lane = next.lanes[laneKey] ?? { base_branch: baseBranch, requests: [] };
    lane.base_branch = baseBranch;
    lane.requests = Array.isArray(lane.requests) ? lane.requests : [];

    const existing = lane.requests.find((request) =>
      request.feature_registry_key === registryKey
      && ["queued", "in_progress"].includes(request.status)
    );
    if (existing) {
      return { queue: next, request: existing, created: false };
    }

    const request = {
      request_id: requestId,
      phase_number: input.phaseNumber,
      feature_slug: input.featureSlug,
      feature_registry_key: registryKey,
      feature_root: normalizeSlashes(featureRoot),
      project_root: normalizeSlashes(input.projectRoot),
      control_project_root: normalizeSlashes(controlProjectRoot),
      base_branch: baseBranch,
      feature_branch: featureBranch,
      worktree_path: worktreePath,
      approved_commit_sha: approvedCommitSha,
      queued_at: now,
      started_at: null,
      merged_at: null,
      blocked_at: null,
      status: "queued",
      merge_commit_sha: null,
      local_target_sync_status: "not_started",
      queue_note: input.queueNote ?? null,
      last_error: null
    };
    lane.requests.push(request);
    next.lanes[laneKey] = lane;
    next.version = 1;
    next.updated_at = nowIso();
    await writeJsonAtomic(paths.queuePath, next);
    return { queue: next, request, created: true };
  });

  await updateImplementPlanFeatureState(input.projectRoot, input.phaseNumber, input.featureSlug, {
    merge_status: "queued",
    merge_required: "true",
    merge_queue_request_id: result.request.request_id,
    approved_commit_sha: approvedCommitSha,
    active_run_status: "merge_queued",
    last_completed_step: "merge_queued",
    current_branch: featureBranch
  });

  return {
    command: "enqueue",
    project_root: input.projectRoot,
    control_project_root: controlProjectRoot,
    queue_path: normalizeSlashes(paths.queuePath),
    created: result.created,
    request: result.request
  };
}

async function processNext(input) {
  const controlProjectRoot = resolveControlProjectRoot(input.projectRoot);
  const paths = buildPaths(controlProjectRoot);
  const setup = await loadSetup(controlProjectRoot);
  if (!setup.complete) {
    fail("merge-queue setup is missing or invalid. Refresh setup before processing merges.");
  }

  const selected = await withLock(paths.projectLocksRoot, "queue", async () => {
    const queue = await loadQueue(controlProjectRoot);
    const request = selectNextQueuedRequest(queue.data, input.baseBranch);
    if (!request) {
      return null;
    }
    request.status = "in_progress";
    request.started_at = nowIso();
    request.last_error = null;
    queue.data.updated_at = nowIso();
    await writeJsonAtomic(paths.queuePath, queue.data);
    return request;
  });

  if (!selected) {
    return {
      command: "process-next",
      project_root: controlProjectRoot,
      processed: false,
      reason: "No queued merge requests were found."
    };
  }

  const featureProjectRoot = resolveRequestFeatureProjectRoot(selected, input.projectRoot);
  await updateImplementPlanFeatureState(featureProjectRoot, selected.phase_number, selected.feature_slug, {
    merge_status: "in_progress",
    merge_required: "true",
    merge_queue_request_id: selected.request_id,
    approved_commit_sha: selected.approved_commit_sha,
    active_run_status: "merge_in_progress",
    last_completed_step: "merge_started",
    current_branch: selected.feature_branch
  });

  const mergeWorktreePath = join(paths.mergeWorktreesRoot, sanitizePathSegment(selected.base_branch), sanitizePathSegment(selected.request_id));
  await mkdir(join(paths.mergeWorktreesRoot, sanitizePathSegment(selected.base_branch)), { recursive: true });

  const baseRef = gitRefExists(controlProjectRoot, "refs/remotes/origin/" + selected.base_branch)
    ? "origin/" + selected.base_branch
    : selected.base_branch;

  const fetchResult = gitRun(controlProjectRoot, ["fetch", "--prune", "origin", selected.base_branch], { timeoutMs: 30000 });
  if (fetchResult.status !== 0 && !gitRefExists(controlProjectRoot, "refs/heads/" + selected.base_branch)) {
    return await failQueuedRequest(controlProjectRoot, paths.queuePath, selected.request_id, selected, "Failed to fetch base branch '" + selected.base_branch + "': " + (fetchResult.stderr || fetchResult.stdout || "unknown error"));
  }
  // Stale-merge guard: reject if approved_commit_sha is already an ancestor of the base branch
  const ancestorCheck = gitRun(controlProjectRoot, ["merge-base", "--is-ancestor", selected.approved_commit_sha, baseRef], { timeoutMs: 10000 });
  if (ancestorCheck.status === 0) {
    return await failQueuedRequest(controlProjectRoot, paths.queuePath, selected.request_id, selected, "Approved commit " + selected.approved_commit_sha + " is already an ancestor of " + selected.base_branch + ". This request is stale and will not be re-merged.");
  }

  const forbiddenSetupChanges = detectForbiddenLocalOperationalSetupChanges(controlProjectRoot, selected.base_branch, selected.approved_commit_sha);
  if (forbiddenSetupChanges.length > 0) {
    return await failQueuedRequest(
      controlProjectRoot,
      paths.queuePath,
      selected.request_id,
      selected,
      buildForbiddenLocalOperationalSetupMessage(selected.base_branch, selected.approved_commit_sha, forbiddenSetupChanges)
    );
  }

  const closeoutReadiness = await validateCloseoutReadinessBeforeMerge(featureProjectRoot, selected.phase_number, selected.feature_slug);
  if (!closeoutReadiness.ready) {
    return await failQueuedRequest(
      controlProjectRoot,
      paths.queuePath,
      selected.request_id,
      selected,
      "Pre-merge closeout readiness failed: " + closeoutReadiness.blockers.join("; ")
    );
  }

  const addResult = gitRun(controlProjectRoot, ["worktree", "add", "--detach", mergeWorktreePath, baseRef], { timeoutMs: 30000 });
  if (addResult.status !== 0) {
    return await failQueuedRequest(controlProjectRoot, paths.queuePath, selected.request_id, selected, "Failed to create merge worktree: " + (addResult.stderr || addResult.stdout || "unknown error"));
  }

  let cleanupError = null;
  let preserveMergeWorktree = false;
  try {
    const mergeResult = gitRun(mergeWorktreePath, ["merge", "--no-ff", "--no-edit", selected.approved_commit_sha], { timeoutMs: 30000 });
    if (mergeResult.status !== 0) {
      gitRun(mergeWorktreePath, ["merge", "--abort"], { timeoutMs: 10000 });
      return await failQueuedRequest(controlProjectRoot, paths.queuePath, selected.request_id, selected, "Merge failed: " + (mergeResult.stderr || mergeResult.stdout || "unknown error"));
    }

    const mergeCommitSha = gitRun(mergeWorktreePath, ["rev-parse", "HEAD"]).stdout || null;
    if (!mergeCommitSha) {
      return await failQueuedRequest(controlProjectRoot, paths.queuePath, selected.request_id, selected, "Merge succeeded but merge commit SHA could not be resolved.");
    }

    const pushResult = gitRun(mergeWorktreePath, ["push", "origin", "HEAD:refs/heads/" + selected.base_branch], { timeoutMs: 30000 });
    if (pushResult.status !== 0) {
      return await failQueuedRequest(controlProjectRoot, paths.queuePath, selected.request_id, selected, "Push failed: " + (pushResult.stderr || pushResult.stdout || "unknown error"));
    }

    const sync = input.syncLocalTarget
      ? syncLocalTargetBranch(controlProjectRoot, selected.base_branch)
      : { status: "not_started", detail: "sync-local-target was disabled." };

    await markRequestMerged(controlProjectRoot, paths.queuePath, selected.request_id, mergeCommitSha, sync.status);

    const closeoutProjectRoot = chooseCloseoutProjectRoot(controlProjectRoot, mergeWorktreePath, sync.status);
    let closeoutResult;
    try {
      closeoutResult = await persistMergedFeatureCloseout({
        closeoutProjectRoot,
        canonicalProjectRoot: controlProjectRoot,
        phaseNumber: selected.phase_number,
        featureSlug: selected.feature_slug,
        baseBranch: selected.base_branch,
        approvedCommitSha: selected.approved_commit_sha,
        mergeCommitSha,
        requestId: selected.request_id,
        localTargetSyncStatus: sync.status,
        closeoutErrorDetail: sync.detail && (sync.status === "failed" || sync.status === "preserve_restore_failed") ? sync.detail : ""
      });
    } catch (error) {
      preserveMergeWorktree = closeoutProjectRoot === mergeWorktreePath;
      return {
        command: "process-next",
        project_root: controlProjectRoot,
        processed: true,
        request_id: selected.request_id,
        feature_registry_key: selected.feature_registry_key,
        merge_commit_sha: mergeCommitSha,
        closeout_persisted: false,
        closeout_error: describeError(error),
        recovery_merge_worktree_path: preserveMergeWorktree ? normalizeSlashes(mergeWorktreePath) : null,
        local_target_sync_status: sync.status,
        local_target_sync_detail: sync.detail
      };
    }

    return {
      command: "process-next",
      project_root: controlProjectRoot,
      processed: true,
      request_id: selected.request_id,
      feature_registry_key: selected.feature_registry_key,
      merge_commit_sha: mergeCommitSha,
      closeout_commit_sha: closeoutResult.closeout_commit_sha,
      closeout_project_root: closeoutResult.closeout_project_root,
      closeout_changes_persisted: closeoutResult.closeout_changes_persisted,
      local_target_sync_status: sync.status,
      local_target_sync_detail: sync.detail
    };
  } finally {
    if (!preserveMergeWorktree) {
      const removeResult = gitRun(controlProjectRoot, ["worktree", "remove", "--force", mergeWorktreePath], { timeoutMs: 30000 });
      if (removeResult.status !== 0 && (await pathExists(mergeWorktreePath))) {
        cleanupError = removeResult.stderr || removeResult.stdout || "Failed to remove merge worktree.";
        await rm(mergeWorktreePath, { recursive: true, force: true });
      }
    }
    if (cleanupError) {
      process.stderr.write(cleanupError + "\n");
    }
  }
}

async function resumeBlocked(input) {
  const controlProjectRoot = resolveControlProjectRoot(input.projectRoot);
  const paths = buildPaths(controlProjectRoot);

  const result = await withLock(paths.projectLocksRoot, "queue", async () => {
    const queue = await loadQueue(controlProjectRoot);
    const request = findRequest(queue.data, input.requestId);
    if (!request) {
      fail("Queue request '" + input.requestId + "' does not exist.");
    }
    if (request.status !== "blocked") {
      fail("Queue request '" + input.requestId + "' has status '" + request.status + "', not 'blocked'. Only blocked requests can be resumed.");
    }

    // Classify the blocker to enforce blocker-specific requirements
    const blockerClass = classifyBlocker(request.last_error);
    const newApprovedSha = input.approvedCommitSha ?? null;
    const effectiveSha = newApprovedSha ?? request.approved_commit_sha ?? null;

    if (!effectiveSha) {
      fail("Cannot resume blocked request without an approved commit SHA. Supply --approved-commit-sha.");
    }

    // For stale_commit or merge_conflict blockers, require a NEW approved commit SHA
    if ((blockerClass === "stale_commit" || blockerClass === "merge_conflict") && (!newApprovedSha || newApprovedSha === request.approved_commit_sha)) {
      fail("Cannot resume a " + blockerClass.replace(/_/g, "-") + " blocked request with the same approved commit SHA '" + (request.approved_commit_sha ?? "null") + "'. Supply a new --approved-commit-sha from the corrected feature branch.");
    }

    const baseBranch = input.baseBranch ?? request.base_branch;

    // Validate the approved SHA is not already merged
    const baseRef = gitRefExists(controlProjectRoot, "refs/remotes/origin/" + baseBranch)
      ? "origin/" + baseBranch
      : baseBranch;
    if (gitRefExists(controlProjectRoot, "refs/heads/" + baseBranch) || gitRefExists(controlProjectRoot, "refs/remotes/origin/" + baseBranch)) {
      const ancestorCheck = gitRun(controlProjectRoot, ["merge-base", "--is-ancestor", effectiveSha, baseRef], { timeoutMs: 10000 });
      if (ancestorCheck.status === 0) {
        fail("Approved commit " + effectiveSha + " is already an ancestor of " + baseBranch + ". Supply a newer approved commit SHA.");
      }
    }

    // Lane migration: if base_branch changed, move the request between lanes
    const oldLaneKey = normalizeLaneKey(request.base_branch);
    const newLaneKey = normalizeLaneKey(baseBranch);
    if (oldLaneKey !== newLaneKey) {
      const oldLane = queue.data.lanes[oldLaneKey];
      if (oldLane) {
        oldLane.requests = (oldLane.requests ?? []).filter((r) => r.request_id !== request.request_id);
        if (oldLane.requests.length === 0) {
          delete queue.data.lanes[oldLaneKey];
        }
      }
      const newLane = queue.data.lanes[newLaneKey] ?? { base_branch: baseBranch, requests: [] };
      newLane.base_branch = baseBranch;
      newLane.requests = Array.isArray(newLane.requests) ? newLane.requests : [];
      newLane.requests.push(request);
      queue.data.lanes[newLaneKey] = newLane;
    }

    request.status = "queued";
    request.approved_commit_sha = effectiveSha;
    request.base_branch = baseBranch;
    request.blocker_class = blockerClass;
    request.blocked_at = null;
    request.last_error = null;
    request.started_at = null;
    request.merged_at = null;
    request.merge_commit_sha = null;
    request.local_target_sync_status = "not_started";
    queue.data.updated_at = nowIso();
    await writeJsonAtomic(paths.queuePath, queue.data);
    return request;
  });

  await updateImplementPlanFeatureState(
    resolveRequestFeatureProjectRoot(result, input.projectRoot),
    result.phase_number,
    result.feature_slug,
    {
      merge_status: "queued",
      merge_required: "true",
      merge_queue_request_id: result.request_id,
      approved_commit_sha: result.approved_commit_sha,
      active_run_status: "merge_queued",
      last_completed_step: "merge_queued",
      last_error: null
    }
  );

  return {
    command: "resume-blocked",
    project_root: controlProjectRoot,
    request_id: result.request_id,
    feature_registry_key: result.feature_registry_key,
    approved_commit_sha: result.approved_commit_sha,
    base_branch: result.base_branch,
    blocker_class: result.blocker_class,
    resumed: true
  };
}

function classifyBlocker(lastError) {
  if (!lastError) return "unknown";
  const lower = String(lastError).toLowerCase();
  if (lower.includes("already an ancestor")) return "stale_commit";
  if (lower.includes("merge failed") || lower.includes("conflict")) return "merge_conflict";
  if (lower.includes("closeout readiness")) return "closeout_readiness";
  if (lower.includes("push failed")) return "push_failure";
  if (lower.includes("fetch") || lower.includes("worktree")) return "infrastructure";
  return "unknown";
}

function syncLocalTargetBranch(projectRoot, baseBranch) {
  const fetchResult = gitRun(projectRoot, ["fetch", "--prune", "origin", baseBranch], { timeoutMs: 30000 });
  if (fetchResult.status !== 0) {
    return {
      status: "failed",
      detail: fetchResult.stderr || fetchResult.stdout || "Local fetch failed."
    };
  }

  const currentBranch = detectCurrentBranch(projectRoot);
  if (currentBranch !== baseBranch) {
    return {
      status: "fetched_only",
      detail: "Fetched origin/" + baseBranch + ", but the local checkout is on '" + (currentBranch ?? "detached") + "'."
    };
  }

  const dirty = gitRun(projectRoot, ["status", "--porcelain"]).stdout;
  if (dirty) {
    const preservableDirtyPaths = collectPreservableDirtyPaths(projectRoot);
    let stashRef = null;
    if (preservableDirtyPaths.length > 0) {
      const stashMessage = "merge-queue-preserve-sync-" + sanitizePathSegment(baseBranch) + "-" + Date.now();
      const stashResult = gitRun(projectRoot, ["stash", "push", "--include-untracked", "-m", stashMessage, "--", ...preservableDirtyPaths], { timeoutMs: 30000 });
      if (stashResult.status !== 0) {
        return {
          status: "failed",
          detail: stashResult.stderr || stashResult.stdout || "Failed to preserve local changes before fast-forward."
        };
      }
      stashRef = resolveStashRef(projectRoot, stashMessage);
      if (!stashRef) {
        return {
          status: "failed",
          detail: "Local changes were detected, but the governed preserve-sync stash could not be resolved."
        };
      }
    }

    const ffResult = gitRun(projectRoot, ["merge", "--ff-only", "origin/" + baseBranch], { timeoutMs: 30000 });
    if (ffResult.status !== 0) {
      if (!stashRef) {
        return {
          status: "failed",
          detail: ffResult.stderr || ffResult.stdout || "Fast-forward of the local target branch failed."
        };
      }
      const restoreResult = restorePreservedLocalState(projectRoot, stashRef);
      return {
        status: restoreResult.ok ? "failed" : "preserve_restore_failed",
        detail: restoreResult.ok
          ? "Fast-forward of the local target branch failed after preserving local changes in " + stashRef + ", and the preserved state was restored."
          : "Fast-forward failed after preserving local changes in " + stashRef + ", and restore also failed: " + restoreResult.detail
      };
    }

    if (!stashRef) {
      return {
        status: "fast_forwarded",
        detail: "Fetched and fast-forwarded the local '" + baseBranch + "' checkout while leaving local operational .codex state in place."
      };
    }

    const restoreResult = restorePreservedLocalState(projectRoot, stashRef);
    if (!restoreResult.ok) {
      return {
        status: "preserve_restore_failed",
        detail: "Fast-forwarded the local '" + baseBranch + "' checkout, but restore of preserved local changes failed. Recovery stash: " + stashRef + ". " + restoreResult.detail
      };
    }
    return {
      status: "preserve_restore_succeeded",
      detail: "Preserved tracked and untracked local changes outside .codex, fast-forwarded the local '" + baseBranch + "' checkout, and restored local state."
    };
  }

  const ffResult = gitRun(projectRoot, ["merge", "--ff-only", "origin/" + baseBranch], { timeoutMs: 30000 });
  if (ffResult.status !== 0) {
    return {
      status: "failed",
      detail: ffResult.stderr || ffResult.stdout || "Fast-forward of the local target branch failed."
    };
  }

  return {
    status: "fast_forwarded",
    detail: "Fetched and fast-forwarded the local '" + baseBranch + "' checkout."
  };
}

function detectForbiddenLocalOperationalSetupChanges(projectRoot, baseBranch, approvedCommitSha) {
  const comparisonRef = resolveComparisonBaseRef(projectRoot, baseBranch);
  if (!comparisonRef) {
    fail("Cannot inspect approved commit '" + approvedCommitSha + "' because base branch '" + baseBranch + "' is not available locally.");
  }

  const mergeBaseResult = gitRun(projectRoot, ["merge-base", comparisonRef, approvedCommitSha], { timeoutMs: 30000 });
  if (mergeBaseResult.status !== 0 || !mergeBaseResult.stdout) {
    fail("Cannot inspect approved commit '" + approvedCommitSha + "' against '" + comparisonRef + "': " + (mergeBaseResult.stderr || mergeBaseResult.stdout || "merge-base failed"));
  }

  const mergeBase = mergeBaseResult.stdout;
  const diffResult = gitRun(projectRoot, ["diff", "--name-status", mergeBase, approvedCommitSha, "--", ".codex"], { timeoutMs: 30000 });
  if (diffResult.status !== 0) {
    fail("Cannot inspect approved commit '" + approvedCommitSha + "' for local operational setup changes: " + (diffResult.stderr || diffResult.stdout || "git diff failed"));
  }

  return String(diffResult.stdout ?? "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map(parseNameStatusRecord)
    .filter((value) => value !== null)
    .filter((value) => value.status !== "D")
    .filter((value) => LOCAL_OPERATIONAL_SETUP_PATH.test(value.path))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function resolveComparisonBaseRef(projectRoot, baseBranch) {
  if (gitRefExists(projectRoot, "refs/remotes/origin/" + baseBranch)) {
    return "origin/" + baseBranch;
  }
  if (gitRefExists(projectRoot, "refs/heads/" + baseBranch)) {
    return baseBranch;
  }
  return null;
}

function buildForbiddenLocalOperationalSetupMessage(baseBranch, approvedCommitSha, changes) {
  return "Cannot merge approved commit '" + approvedCommitSha
    + "' because its branch delta against '" + baseBranch
    + "' adds or modifies local operational setup files that must not be committed: "
    + changes.map((entry) => entry.path + " [" + entry.status + "]").join(", ")
    + ". Remove them from the approved branch and let the workflow recreate setup locally.";
}

function parseNameStatusRecord(line) {
  const parts = line.split("\t").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  const status = parts[0].trim().toUpperCase();
  const path = parts[parts.length - 1].trim().replace(/\\/g, "/");
  if (!status || !path) {
    return null;
  }
  return { status, path };
}

function resolveControlProjectRoot(projectRoot) {
  return resolveCanonicalGitProjectRoot(projectRoot);
}

function resolveRequestFeatureProjectRoot(request, fallbackProjectRoot) {
  const candidate = request?.project_root ?? request?.worktree_path ?? fallbackProjectRoot;
  return normalizeProjectRoot(candidate);
}

function chooseCloseoutProjectRoot(controlProjectRoot, mergeWorktreePath, localTargetSyncStatus) {
  return localTargetSyncStatus === "fast_forwarded" || localTargetSyncStatus === "preserve_restore_succeeded"
    ? controlProjectRoot
    : mergeWorktreePath;
}

function resolveStashRef(projectRoot, stashMessage) {
  const listResult = gitRun(projectRoot, ["stash", "list", "--format=%gd%x09%s"], { timeoutMs: 10000 });
  if (listResult.status !== 0) {
    return null;
  }
  for (const line of String(listResult.stdout ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [ref, message] = trimmed.split(/\t/, 2);
    const normalizedMessage = String(message ?? "").trim();
    if (
      normalizedMessage === stashMessage
      || normalizedMessage.endsWith(": " + stashMessage)
      || normalizedMessage.includes(stashMessage)
    ) {
      return ref;
    }
  }
  return null;
}

function collectPreservableDirtyPaths(projectRoot) {
  const paths = new Set();
  for (const dirtyPath of readGitPathList(projectRoot, ["diff", "--name-only"])) {
    if (!shouldExcludeFromGovernedPreserve(dirtyPath)) {
      paths.add(dirtyPath);
    }
  }
  for (const dirtyPath of readGitPathList(projectRoot, ["diff", "--cached", "--name-only"])) {
    if (!shouldExcludeFromGovernedPreserve(dirtyPath)) {
      paths.add(dirtyPath);
    }
  }
  for (const dirtyPath of readGitPathList(projectRoot, ["ls-files", "--others", "--exclude-standard"])) {
    if (!shouldExcludeFromGovernedPreserve(dirtyPath)) {
      paths.add(dirtyPath);
    }
  }
  return Array.from(paths).sort();
}

function readGitPathList(projectRoot, args) {
  const result = gitRun(projectRoot, args, { timeoutMs: 10000 });
  if (result.status !== 0) {
    return [];
  }
  return String(result.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => normalizeSlashes(line));
}

function shouldExcludeFromGovernedPreserve(path) {
  return normalizeSlashes(path).startsWith(".codex/");
}

function restorePreservedLocalState(projectRoot, stashRef) {
  const popResult = gitRun(projectRoot, ["stash", "pop", "--index", stashRef], { timeoutMs: 30000 });
  if (popResult.status !== 0) {
    return {
      ok: false,
      detail: popResult.stderr || popResult.stdout || ("Restore from " + stashRef + " failed.")
    };
  }
  return {
    ok: true,
    detail: "Restored local state from " + stashRef + "."
  };
}

async function persistMergedFeatureCloseout({
  closeoutProjectRoot,
  canonicalProjectRoot,
  phaseNumber,
  featureSlug,
  baseBranch,
  approvedCommitSha,
  mergeCommitSha,
  requestId,
  localTargetSyncStatus,
  closeoutErrorDetail
}) {
  await updateImplementPlanFeatureState(closeoutProjectRoot, phaseNumber, featureSlug, {
    merge_status: "merged",
    merge_required: "true",
    merge_commit_sha: mergeCommitSha,
    approved_commit_sha: approvedCommitSha,
    merge_queue_request_id: requestId,
    local_target_sync_status: localTargetSyncStatus,
    active_run_status: "closeout_pending",
    last_completed_step: "merge_finished",
    last_commit_sha: mergeCommitSha,
    current_branch: baseBranch,
    last_error: closeoutErrorDetail
  }, { canonicalProjectRoot });
  await markImplementPlanComplete(closeoutProjectRoot, phaseNumber, featureSlug, mergeCommitSha, canonicalProjectRoot);
  const closeoutCommitSha = await commitAndPushFeatureCloseout(closeoutProjectRoot, phaseNumber, featureSlug, baseBranch);
  return {
    closeout_project_root: normalizeSlashes(closeoutProjectRoot),
    closeout_commit_sha: closeoutCommitSha,
    closeout_changes_persisted: closeoutCommitSha !== null
  };
}

async function failQueuedRequest(projectRoot, queuePath, requestId, request, message) {
  await markRequestBlocked(projectRoot, queuePath, requestId, message);
  await updateImplementPlanFeatureState(resolveRequestFeatureProjectRoot(request, projectRoot), request.phase_number, request.feature_slug, {
    merge_status: "blocked",
    merge_required: "true",
    merge_queue_request_id: requestId,
    approved_commit_sha: request.approved_commit_sha,
    active_run_status: "merge_blocked",
    last_completed_step: "merge_blocked",
    last_error: message
  });
  return {
    command: "process-next",
    project_root: projectRoot,
    processed: false,
    request_id: requestId,
    feature_registry_key: request.feature_registry_key,
    error: message
  };
}

async function commitAndPushFeatureCloseout(projectRoot, phaseNumber, featureSlug, baseBranch) {
  const featureRoot = resolveFeatureRoot(projectRoot, phaseNumber, featureSlug);
  const relativeFeatureRoot = relative(projectRoot, featureRoot) || ".";
  const statusResult = gitRun(projectRoot, ["status", "--porcelain", "--", relativeFeatureRoot], { timeoutMs: 30000 });
  if (statusResult.status !== 0) {
    fail("Failed to inspect closeout changes: " + (statusResult.stderr || statusResult.stdout || "unknown error"));
  }
  if (!String(statusResult.stdout ?? "").trim()) {
    return null;
  }

  const addResult = gitRun(projectRoot, ["add", "--all", "--", relativeFeatureRoot], { timeoutMs: 30000 });
  if (addResult.status !== 0) {
    fail("Failed to stage closeout artifacts: " + (addResult.stderr || addResult.stdout || "unknown error"));
  }

  const commitMessage = "docs(" + featureSlug.replace(/\//g, "-") + "): finalize merge closeout truth";
  const commitResult = gitRun(projectRoot, ["commit", "-m", commitMessage], { timeoutMs: 30000 });
  if (commitResult.status !== 0) {
    fail("Failed to commit closeout artifacts: " + (commitResult.stderr || commitResult.stdout || "unknown error"));
  }

  const closeoutCommitSha = gitRun(projectRoot, ["rev-parse", "HEAD"], { timeoutMs: 10000 }).stdout || null;
  if (!closeoutCommitSha) {
    fail("Closeout commit succeeded but HEAD could not be resolved.");
  }

  const pushResult = gitRun(projectRoot, ["push", "origin", "HEAD:refs/heads/" + baseBranch], { timeoutMs: 30000 });
  if (pushResult.status !== 0) {
    fail("Failed to push closeout artifacts: " + (pushResult.stderr || pushResult.stdout || "unknown error"));
  }

  return closeoutCommitSha;
}

async function markRequestMerged(projectRoot, queuePath, requestId, mergeCommitSha, localTargetSyncStatus) {
  await mutateQueue(projectRoot, queuePath, (queue) => {
    const request = findRequest(queue, requestId);
    if (!request) {
      fail("Queue request '" + requestId + "' disappeared before merge completion could be recorded.");
    }
    request.status = "merged";
    request.merged_at = nowIso();
    request.merge_commit_sha = mergeCommitSha;
    request.local_target_sync_status = localTargetSyncStatus;
    request.last_error = null;
  });
}

async function markRequestBlocked(projectRoot, queuePath, requestId, errorMessage) {
  await mutateQueue(projectRoot, queuePath, (queue) => {
    const request = findRequest(queue, requestId);
    if (!request) {
      fail("Queue request '" + requestId + "' disappeared before the blocked state could be recorded.");
    }
    request.status = "blocked";
    request.blocked_at = nowIso();
    request.last_error = errorMessage;
    request.local_target_sync_status = request.local_target_sync_status ?? "not_started";
  });
}

async function mutateQueue(projectRoot, queuePath, mutate) {
  const paths = buildPaths(projectRoot);
  await withLock(paths.projectLocksRoot, "queue", async () => {
    const queue = await loadQueue(projectRoot);
    mutate(queue.data);
    queue.data.updated_at = nowIso();
    await writeJsonAtomic(queuePath, queue.data);
  });
}

function findRequest(queue, requestId) {
  for (const lane of Object.values(queue.lanes ?? {})) {
    for (const request of lane.requests ?? []) {
      if (request.request_id === requestId) {
        return request;
      }
    }
  }
  return null;
}

function selectNextQueuedRequest(queue, baseBranch) {
  const candidates = [];
  for (const lane of Object.values(queue.lanes ?? {})) {
    if (baseBranch && lane.base_branch !== baseBranch) {
      continue;
    }
    if (laneHasInProgressRequest(lane)) {
      continue;
    }
    for (const request of lane.requests ?? []) {
      if (request.status === "queued") {
        candidates.push(request);
      }
    }
  }
  candidates.sort((left, right) => String(left.queued_at).localeCompare(String(right.queued_at)));
  return candidates[0] ?? null;
}

function laneHasInProgressRequest(lane) {
  return (lane.requests ?? []).some((request) => request.status === "in_progress");
}

function summarizeLane(lane) {
  const requests = Array.isArray(lane.requests) ? lane.requests : [];
  return {
    base_branch: lane.base_branch,
    queued_count: requests.filter((request) => request.status === "queued").length,
    in_progress_count: requests.filter((request) => request.status === "in_progress").length,
    blocked_count: requests.filter((request) => request.status === "blocked").length,
    merged_count: requests.filter((request) => request.status === "merged").length,
    head_request: requests
      .filter((request) => request.status === "queued")
      .sort((left, right) => String(left.queued_at).localeCompare(String(right.queued_at)))[0] ?? null
  };
}

function buildPaths(projectRoot) {
  const queueRoot = resolveSkillStateRoot(projectRoot, "merge-queue");
  return {
    projectRoot,
    queueRoot,
    setupPath: join(queueRoot, "setup.json"),
    queuePath: join(queueRoot, "queue.json"),
    locksRoot: join(queueRoot, "locks"),
    projectLocksRoot: join(queueRoot, "locks", "project"),
    mergeWorktreesRoot: join(queueRoot, "worktrees")
  };
}

async function loadSetup(projectRoot) {
  const path = join(resolveSkillStateRoot(projectRoot, "merge-queue"), "setup.json");
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

  return {
    complete: errors.length === 0,
    errors,
    warnings
  };
}

async function loadQueue(projectRoot) {
  const path = join(resolveSkillStateRoot(projectRoot, "merge-queue"), "queue.json");
  const empty = { version: 1, updated_at: null, lanes: {} };
  if (!(await pathExists(path))) {
    return { exists: false, path, data: empty };
  }

  try {
    const parsed = await readJson(path);
    if (!isPlainObject(parsed) || !isPlainObject(parsed.lanes)) {
      return { exists: true, path, data: empty };
    }
    return { exists: true, path, data: parsed };
  } catch {
    return { exists: true, path, data: empty };
  }
}

async function readImplementPlanState(featureRoot) {
  const statePath = join(featureRoot, "implement-plan-state.json");
  if (!(await pathExists(statePath))) {
    return null;
  }
  try {
    const parsed = await readJson(statePath);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function updateImplementPlanFeatureState(projectRoot, phaseNumber, featureSlug, fields, options = {}) {
  const args = ["update-state", "--project-root", projectRoot, "--phase-number", String(phaseNumber), "--feature-slug", featureSlug];
  appendOptionalArg(args, "canonical-project-root", options.canonicalProjectRoot);
  appendOptionalArg(args, "feature-status", fields.feature_status);
  appendOptionalArg(args, "current-branch", fields.current_branch);
  appendOptionalArg(args, "base-branch", fields.base_branch);
  appendOptionalArg(args, "feature-branch", fields.feature_branch);
  appendOptionalArg(args, "worktree-path", fields.worktree_path);
  appendOptionalArg(args, "worktree-status", fields.worktree_status);
  appendOptionalArg(args, "merge-required", fields.merge_required);
  appendOptionalArg(args, "merge-status", fields.merge_status);
  appendOptionalArg(args, "approved-commit-sha", fields.approved_commit_sha);
  appendOptionalArg(args, "merge-commit-sha", fields.merge_commit_sha);
  appendOptionalArg(args, "merge-queue-request-id", fields.merge_queue_request_id);
  appendOptionalArg(args, "local-target-sync-status", fields.local_target_sync_status);
  appendOptionalArg(args, "last-completed-step", fields.last_completed_step);
  appendOptionalArg(args, "last-commit-sha", fields.last_commit_sha);
  appendOptionalArg(args, "active-run-status", fields.active_run_status);
  appendOptionalArg(args, "last-error", fields.last_error);
  await runNodeHelper(implementPlanHelperPath, args, projectRoot);
}

async function markImplementPlanComplete(projectRoot, phaseNumber, featureSlug, mergeCommitSha, canonicalProjectRoot = null) {
  await runNodeHelper(implementPlanHelperPath, [
    "mark-complete",
    "--project-root", projectRoot,
    ...(isFilled(canonicalProjectRoot) ? ["--canonical-project-root", canonicalProjectRoot] : []),
    "--phase-number", String(phaseNumber),
    "--feature-slug", featureSlug,
    "--last-commit-sha", mergeCommitSha,
    "--completion-note", "Merged via merge-queue after approval."
  ], projectRoot);
}

async function validateCloseoutReadinessBeforeMerge(projectRoot, phaseNumber, featureSlug) {
  try {
    const output = await runNodeHelper(implementPlanHelperPath, [
      "validate-closeout-readiness",
      "--project-root", projectRoot,
      "--phase-number", String(phaseNumber),
      "--feature-slug", featureSlug
    ], projectRoot);
    const result = JSON.parse(output);
    return {
      ready: result.closeout_ready === true,
      blockers: result.blockers ?? []
    };
  } catch (error) {
    return {
      ready: false,
      blockers: ["Closeout readiness check failed: " + describeError(error)]
    };
  }
}

async function runNodeHelper(scriptPath, args, workdir) {
  const result = spawnSync("node", [scriptPath, ...args], {
    cwd: workdir,
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "Node helper failed.").trim());
  }
  return result.stdout?.trim() ?? "";
}

function normalizeLaneKey(baseBranch) {
  return sanitizePathSegment(baseBranch).toLowerCase();
}

function appendOptionalArg(args, name, value) {
  if (!isFilled(value)) {
    return;
  }
  args.push("--" + name, String(value));
}

function validateEnum(value, allowed, fieldName, errors) {
  if (!isFilled(value)) return;
  if (!allowed.has(value)) {
    errors.push("Field '" + fieldName + "' must be one of: " + Array.from(allowed).join(", ") + ".");
  }
}
