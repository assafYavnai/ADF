#!/usr/bin/env node

import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
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
  formatCommandFailure,
  gitRefExists,
  gitRun,
  inferCanonicalProjectRoot,
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
  resolveFeatureRoot,
  resolveSkillStateRoot,
  safeInteger,
  sanitizePathSegment,
  withLock,
  writeJsonAtomic,
  fail
} from "../../governed-feature-runtime.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const skillRoot = dirname(dirname(scriptPath));

const REQUIRED_SETUP_FIELDS = [
  "preferred_execution_access_mode",
  "fallback_execution_access_mode",
  "runtime_permission_model",
  "execution_access_notes",
  "preferred_execution_runtime",
  "persistent_execution_strategy"
];

const REQUEST_STATUSES = new Set(["queued", "in_progress", "merged", "blocked"]);
const LOCAL_SYNC_STATUSES = new Set([
  "not_started",
  "fetched_only",
  "fast_forwarded",
  "clean_worktree_ready",
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
  if (command === "retry-request") {
    printJson(await retryRequest({
      projectRoot: normalizeProjectRoot(requiredArg(args, "project-root")),
      requestId: requiredArg(args, "request-id"),
      queueNote: args.values["queue-note"] ?? null
    }));
    return;
  }
  if (command === "requeue-request") {
    printJson(await requeueRequest({
      projectRoot: normalizeProjectRoot(requiredArg(args, "project-root")),
      requestId: requiredArg(args, "request-id"),
      approvedCommitSha: args.values["approved-commit-sha"] ?? null,
      baseBranch: args.values["base-branch"] ?? null,
      featureBranch: args.values["feature-branch"] ?? null,
      worktreePath: args.values["worktree-path"] ?? null,
      queueNote: args.values["queue-note"] ?? null
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

  fail("Unknown command '" + command + "'. Use help, get-settings, status, enqueue, retry-request, requeue-request, or process-next.");
}

async function renderHelp(args) {
  const projectRoot = inferCanonicalProjectRoot(normalizeProjectRoot(args.values["project-root"] ?? process.cwd()));
  const settings = await getSettingsCore(projectRoot);
  const status = await getStatusCore(projectRoot);
  return {
    command: "help",
    project_root: projectRoot,
    purpose: "Queue and land approved feature merges FIFO per target branch using isolated merge worktrees and truthful completion handoff.",
    actions: ["help", "get-settings", "status", "enqueue", "retry-request", "requeue-request", "process-next"],
    required_inputs_for_enqueue: ["project_root", "phase_number", "feature_slug"],
    optional_enqueue_inputs: ["approved_commit_sha", "base_branch", "feature_branch", "worktree_path", "queue_note"],
    required_inputs_for_retry_request: ["project_root", "request_id"],
    optional_retry_request_inputs: ["queue_note"],
    required_inputs_for_requeue_request: ["project_root", "request_id"],
    optional_requeue_request_inputs: ["approved_commit_sha", "base_branch", "feature_branch", "worktree_path", "queue_note"],
    transparent_setup_behavior: "The main skill validates setup internally and refreshes it when missing or invalid before merge work starts.",
    current_settings_summary: settings.summary,
    queue_summary: status.summary
  };
}

async function getSettings(args) {
  const projectRoot = inferCanonicalProjectRoot(normalizeProjectRoot(args.values["project-root"] ?? process.cwd()));
  return getSettingsCore(projectRoot);
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
  const projectRoot = inferCanonicalProjectRoot(normalizeProjectRoot(args.values["project-root"] ?? process.cwd()));
  return getStatusCore(projectRoot);
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
  const paths = buildPaths(input.projectRoot);
  const setup = await loadSetup(paths.canonicalProjectRoot);
  if (!setup.complete) {
    fail("merge-queue setup is missing or invalid. Refresh setup before enqueue.");
  }

  const featureContext = await readImplementPlanFeatureContext(
    paths.canonicalProjectRoot,
    input.phaseNumber,
    input.featureSlug,
    input.worktreePath ?? null
  );
  if (featureContext.indexEntry?.feature_status === "completed" || featureContext.state?.feature_status === "completed") {
    fail("Cannot enqueue merge for a feature that is already completed.");
  }
  const baseBranch = input.baseBranch
    ?? featureContext.indexEntry?.base_branch
    ?? featureContext.state?.base_branch
    ?? detectDefaultBaseBranch(paths.canonicalProjectRoot);
  const featureBranch = input.featureBranch
    ?? featureContext.indexEntry?.feature_branch
    ?? featureContext.state?.feature_branch
    ?? "implement-plan/phase" + input.phaseNumber + "/" + input.featureSlug.replace(/\//g, "-");
  const worktreePath = normalizeSlashes(
    input.worktreePath
      ?? featureContext.indexEntry?.worktree_path
      ?? featureContext.state?.worktree_path
      ?? join(resolveSkillStateRoot(paths.canonicalProjectRoot, "implement-plan"), "worktrees", "phase" + input.phaseNumber, ...input.featureSlug.split("/").map((segment) => sanitizePathSegment(segment)))
  );
  const approvedCommitSha = input.approvedCommitSha
    ?? featureContext.indexEntry?.approved_commit_sha
    ?? featureContext.state?.approved_commit_sha
    ?? null;

  if (!approvedCommitSha) {
    fail("Cannot enqueue merge without an approved commit SHA.");
  }

  const registryKey = buildFeatureRegistryKey(input.phaseNumber, input.featureSlug);
  const now = nowIso();
  const laneKey = normalizeLaneKey(baseBranch);
  const requestId = "merge-" + sanitizePathSegment(baseBranch) + "-" + input.phaseNumber + "-" + sanitizePathSegment(input.featureSlug) + "-" + Date.now();
  const canonicalFeatureRoot = featureContext.canonicalFeatureRoot ?? normalizeSlashes(resolveFeatureRoot(paths.canonicalProjectRoot, input.phaseNumber, input.featureSlug));
  const executionProjectRoot = featureContext.executionProjectRoot ?? paths.executionProjectRoot;
  const executionFeatureRoot = featureContext.executionFeatureRoot ?? normalizeSlashes(resolveFeatureRoot(executionProjectRoot, input.phaseNumber, input.featureSlug));

  const result = await withLock(paths.projectLocksRoot, "queue", async () => {
    const current = await loadQueue(paths.canonicalProjectRoot);
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
      feature_root: canonicalFeatureRoot,
      project_root: paths.canonicalProjectRoot,
      execution_project_root: executionProjectRoot,
      execution_feature_root: executionFeatureRoot,
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
      shared_root_sync_status: "not_started",
      queue_note: input.queueNote ?? null,
      last_error: null,
      retry_count: 0,
      supersedes_request_id: null,
      superseded_by_request_id: null,
      transition_log: []
    };
    appendRequestTransition(request, "queued", input.queueNote ?? "Queued for merge.");
    lane.requests.push(request);
    next.lanes[laneKey] = lane;
    next.version = 1;
    next.updated_at = nowIso();
    await writeJsonAtomic(paths.queuePath, next);
    return { queue: next, request, created: true };
  });

  await updateImplementPlanFeatureOperationalState(paths.canonicalProjectRoot, input.phaseNumber, input.featureSlug, {
    feature_root: canonicalFeatureRoot,
    feature_status: featureContext.indexEntry?.feature_status ?? "active",
    active_run_status: "merge_queued",
    base_branch: baseBranch,
    feature_branch: featureBranch,
    worktree_path: worktreePath,
    merge_status: "queued",
    merge_required: true,
    merge_queue_request_id: result.request.request_id,
    approved_commit_sha: approvedCommitSha,
    last_completed_step: "merge_queued",
    execution_project_root: executionProjectRoot,
    last_commit_sha: featureContext.indexEntry?.last_commit_sha ?? featureContext.state?.last_commit_sha ?? null
  });

  return {
    command: "enqueue",
    project_root: paths.canonicalProjectRoot,
    queue_path: normalizeSlashes(paths.queuePath),
    created: result.created,
    request: result.request,
    next_action: "Run process-next when this request reaches the head of its base-branch lane."
  };
}

async function retryRequest(input) {
  const paths = buildPaths(input.projectRoot);
  let retriedRequest = null;
  await withLock(paths.projectLocksRoot, "queue", async () => {
    const queue = await loadQueue(paths.canonicalProjectRoot);
    const request = findRequest(queue.data, input.requestId);
    if (!request) {
      fail("Queue request '" + input.requestId + "' does not exist.");
    }
    if (request.status !== "blocked") {
      fail("Queue request '" + input.requestId + "' is not blocked and cannot be retried.");
    }
    request.status = "queued";
    request.started_at = null;
    request.blocked_at = null;
    request.last_error = null;
    request.retry_count = safeInteger(request.retry_count, 0) + 1;
    appendRequestTransition(request, "queued", input.queueNote ?? "Blocked request was retried.");
    queue.data.updated_at = nowIso();
    await writeJsonAtomic(paths.queuePath, queue.data);
    retriedRequest = request;
  });

  await updateImplementPlanFeatureOperationalState(paths.canonicalProjectRoot, retriedRequest.phase_number, retriedRequest.feature_slug, {
    feature_root: retriedRequest.feature_root,
    feature_status: "active",
    active_run_status: "merge_queued",
    base_branch: retriedRequest.base_branch,
    feature_branch: retriedRequest.feature_branch,
    worktree_path: retriedRequest.worktree_path,
    merge_required: true,
    merge_status: "queued",
    approved_commit_sha: retriedRequest.approved_commit_sha,
    merge_queue_request_id: retriedRequest.request_id,
    last_completed_step: "merge_queued",
    last_error: null
  });

  return {
    command: "retry-request",
    project_root: paths.canonicalProjectRoot,
    request_id: retriedRequest.request_id,
    feature_registry_key: retriedRequest.feature_registry_key,
    status: retriedRequest.status,
    next_action: "Run process-next when this request reaches the head of its base-branch lane."
  };
}

async function requeueRequest(input) {
  const paths = buildPaths(input.projectRoot);
  let newRequest = null;
  await withLock(paths.projectLocksRoot, "queue", async () => {
    const queue = await loadQueue(paths.canonicalProjectRoot);
    const existing = findRequest(queue.data, input.requestId);
    if (!existing) {
      fail("Queue request '" + input.requestId + "' does not exist.");
    }
    if (existing.status !== "blocked") {
      fail("Queue request '" + input.requestId + "' is not blocked and cannot be requeued.");
    }

    const baseBranch = input.baseBranch ?? existing.base_branch;
    const featureBranch = input.featureBranch ?? existing.feature_branch;
    const worktreePath = normalizeSlashes(input.worktreePath ?? existing.worktree_path);
    const approvedCommitSha = input.approvedCommitSha ?? existing.approved_commit_sha;
    if (!isFilled(approvedCommitSha)) {
      fail("Cannot requeue without an approved commit SHA.");
    }

    const laneKey = normalizeLaneKey(baseBranch);
    const lane = queue.data.lanes[laneKey] ?? { base_branch: baseBranch, requests: [] };
    lane.base_branch = baseBranch;
    lane.requests = Array.isArray(lane.requests) ? lane.requests : [];

    const requestId = "merge-" + sanitizePathSegment(baseBranch) + "-" + existing.phase_number + "-" + sanitizePathSegment(existing.feature_slug) + "-" + Date.now();
    newRequest = {
      ...existing,
      request_id: requestId,
      base_branch: baseBranch,
      feature_branch: featureBranch,
      worktree_path: worktreePath,
      approved_commit_sha: approvedCommitSha,
      queued_at: nowIso(),
      started_at: null,
      merged_at: null,
      blocked_at: null,
      status: "queued",
      merge_commit_sha: null,
      local_target_sync_status: "not_started",
      shared_root_sync_status: "not_started",
      queue_note: input.queueNote ?? existing.queue_note ?? null,
      last_error: null,
      supersedes_request_id: existing.request_id,
      superseded_by_request_id: null,
      transition_log: []
    };
    appendRequestTransition(newRequest, "queued", input.queueNote ?? "Created a replacement queued request for a blocked entry.");
    existing.superseded_by_request_id = requestId;
    appendRequestTransition(existing, "blocked", "Superseded by requeued request '" + requestId + "'.");
    lane.requests.push(newRequest);
    queue.data.lanes[laneKey] = lane;
    queue.data.updated_at = nowIso();
    await writeJsonAtomic(paths.queuePath, queue.data);
  });

  await updateImplementPlanFeatureOperationalState(paths.canonicalProjectRoot, newRequest.phase_number, newRequest.feature_slug, {
    feature_root: newRequest.feature_root,
    feature_status: "active",
    active_run_status: "merge_queued",
    base_branch: newRequest.base_branch,
    feature_branch: newRequest.feature_branch,
    worktree_path: newRequest.worktree_path,
    merge_required: true,
    merge_status: "queued",
    approved_commit_sha: newRequest.approved_commit_sha,
    merge_queue_request_id: newRequest.request_id,
    last_completed_step: "merge_queued",
    last_error: null
  });

  return {
    command: "requeue-request",
    project_root: paths.canonicalProjectRoot,
    request_id: newRequest.request_id,
    supersedes_request_id: input.requestId,
    feature_registry_key: newRequest.feature_registry_key,
    status: newRequest.status,
    next_action: "Run process-next when the replacement request reaches the head of its base-branch lane."
  };
}

async function processNext(input) {
  const paths = buildPaths(input.projectRoot);
  const setup = await loadSetup(paths.canonicalProjectRoot);
  if (!setup.complete) {
    fail("merge-queue setup is missing or invalid. Refresh setup before processing merges.");
  }

  const selected = await withLock(paths.projectLocksRoot, "queue", async () => {
    const queue = await loadQueue(paths.canonicalProjectRoot);
    const request = selectNextQueuedRequest(queue.data, input.baseBranch);
    if (!request) {
      return null;
    }
    request.status = "in_progress";
    request.started_at = nowIso();
    request.last_error = null;
    appendRequestTransition(request, "in_progress", "Merge processing started.");
    queue.data.updated_at = nowIso();
    await writeJsonAtomic(paths.queuePath, queue.data);
    return request;
  });

  if (!selected) {
    return {
      command: "process-next",
      project_root: input.projectRoot,
      processed: false,
      reason: "No queued merge requests were found."
    };
  }

  await updateImplementPlanFeatureOperationalState(paths.canonicalProjectRoot, selected.phase_number, selected.feature_slug, {
    feature_root: selected.feature_root,
    feature_status: "active",
    base_branch: selected.base_branch,
    feature_branch: selected.feature_branch,
    worktree_path: selected.worktree_path,
    merge_status: "in_progress",
    merge_required: true,
    merge_queue_request_id: selected.request_id,
    approved_commit_sha: selected.approved_commit_sha,
    active_run_status: "merge_in_progress",
    last_completed_step: "merge_started"
  });

  const mergeWorktreePath = join(paths.mergeWorktreesRoot, sanitizePathSegment(selected.base_branch), sanitizePathSegment(selected.request_id));
  await mkdir(join(paths.mergeWorktreesRoot, sanitizePathSegment(selected.base_branch)), { recursive: true });

  const baseRef = gitRefExists(paths.canonicalProjectRoot, "refs/remotes/origin/" + selected.base_branch)
    ? "origin/" + selected.base_branch
    : selected.base_branch;

  const fetchBaseResult = gitRun(paths.canonicalProjectRoot, ["fetch", "--prune", "origin", selected.base_branch], { timeoutMs: 30000 });
  if (fetchBaseResult.status !== 0 && !gitRefExists(paths.canonicalProjectRoot, "refs/heads/" + selected.base_branch)) {
    return await failQueuedRequest(
      paths.canonicalProjectRoot,
      paths.queuePath,
      selected.request_id,
      selected,
      formatCommandFailure("git", ["fetch", "--prune", "origin", selected.base_branch], fetchBaseResult, "Failed to fetch base branch '" + selected.base_branch + "'."),
      "Repair the base-branch fetch problem and retry-request."
    );
  }

  const fetchFeatureResult = gitRun(paths.canonicalProjectRoot, ["fetch", "--prune", "origin", selected.feature_branch], { timeoutMs: 30000 });
  const featureRef = resolveFeatureRef(paths.canonicalProjectRoot, selected.feature_branch);
  if (fetchFeatureResult.status !== 0 && !featureRef) {
    return await failQueuedRequest(
      paths.canonicalProjectRoot,
      paths.queuePath,
      selected.request_id,
      selected,
      formatCommandFailure("git", ["fetch", "--prune", "origin", selected.feature_branch], fetchFeatureResult, "Failed to fetch feature branch '" + selected.feature_branch + "'."),
      "Push or restore the feature branch and retry-request, or requeue-request with a corrected feature branch."
    );
  }
  if (!featureRef) {
    return await failQueuedRequest(
      paths.canonicalProjectRoot,
      paths.queuePath,
      selected.request_id,
      selected,
      "The approved feature branch '" + selected.feature_branch + "' is not available locally after fetch.",
      "Restore the feature branch or requeue-request with a truthful replacement branch."
    );
  }
  if (!gitCommitExists(paths.canonicalProjectRoot, selected.approved_commit_sha)) {
    return await failQueuedRequest(
      paths.canonicalProjectRoot,
      paths.queuePath,
      selected.request_id,
      selected,
      "The approved commit SHA '" + selected.approved_commit_sha + "' is not available locally after fetch.",
      "Re-run the feature closeout so merge-ready freezes the approved SHA truthfully, then retry-request or requeue-request."
    );
  }
  const reachabilityCheck = gitRun(paths.canonicalProjectRoot, ["merge-base", "--is-ancestor", selected.approved_commit_sha, featureRef], { timeoutMs: 30000 });
  if (reachabilityCheck.status !== 0) {
    return await failQueuedRequest(
      paths.canonicalProjectRoot,
      paths.queuePath,
      selected.request_id,
      selected,
      "The approved commit SHA '" + selected.approved_commit_sha + "' is not reachable from '" + featureRef + "'.",
      "Requeue the request with the correct approved SHA or correct feature branch."
    );
  }

  const addResult = gitRun(paths.canonicalProjectRoot, ["worktree", "add", "--detach", mergeWorktreePath, baseRef], { timeoutMs: 30000 });
  if (addResult.status !== 0) {
    return await failQueuedRequest(
      paths.canonicalProjectRoot,
      paths.queuePath,
      selected.request_id,
      selected,
      formatCommandFailure("git", ["worktree", "add", "--detach", mergeWorktreePath, baseRef], addResult, "Failed to create merge worktree."),
      "Repair the worktree creation problem and retry-request."
    );
  }

  let cleanupError = null;
  try {
    const mergeResult = gitRun(mergeWorktreePath, ["merge", "--no-ff", "--no-edit", selected.approved_commit_sha], { timeoutMs: 30000 });
    if (mergeResult.status !== 0) {
      gitRun(mergeWorktreePath, ["merge", "--abort"], { timeoutMs: 10000 });
      return await failQueuedRequest(
        paths.canonicalProjectRoot,
        paths.queuePath,
        selected.request_id,
        selected,
        formatCommandFailure("git", ["merge", "--no-ff", "--no-edit", selected.approved_commit_sha], mergeResult, "Merge failed."),
        "Inspect the merge conflict or merge failure, repair the feature branch, then retry-request or requeue-request."
      );
    }

    const mergeCommitSha = gitRun(mergeWorktreePath, ["rev-parse", "HEAD"]).stdout || null;
    if (!mergeCommitSha) {
      return await failQueuedRequest(
        paths.canonicalProjectRoot,
        paths.queuePath,
        selected.request_id,
        selected,
        "Merge succeeded but the merge commit SHA could not be resolved.",
        "Inspect the temporary merge worktree and retry-request only after the merge commit can be resolved truthfully."
      );
    }

    const pushResult = gitRun(mergeWorktreePath, ["push", "origin", "HEAD:refs/heads/" + selected.base_branch], { timeoutMs: 30000 });
    if (pushResult.status !== 0) {
      return await failQueuedRequest(
        paths.canonicalProjectRoot,
        paths.queuePath,
        selected.request_id,
        selected,
        formatCommandFailure("git", ["push", "origin", "HEAD:refs/heads/" + selected.base_branch], pushResult, "Push failed."),
        "Repair the push failure, confirm the approved commit is still truthful, then retry-request."
      );
    }

    const sync = input.syncLocalTarget
      ? await syncLocalTargetBranch(paths, selected.base_branch)
      : { status: "not_started", detail: "sync-local-target was disabled." };

    await markRequestMerged(paths.canonicalProjectRoot, paths.queuePath, selected.request_id, mergeCommitSha, sync.status, sync.shared_root_sync_status ?? "not_started");
    await updateImplementPlanFeatureOperationalState(paths.canonicalProjectRoot, selected.phase_number, selected.feature_slug, {
      feature_root: selected.feature_root,
      feature_status: "completed",
      active_run_status: "completed",
      base_branch: selected.base_branch,
      feature_branch: selected.feature_branch,
      worktree_path: selected.worktree_path,
      merge_status: "merged",
      merge_required: true,
      merge_commit_sha: mergeCommitSha,
      approved_commit_sha: selected.approved_commit_sha,
      merge_queue_request_id: selected.request_id,
      local_target_sync_status: sync.status,
      last_completed_step: "marked_complete",
      last_commit_sha: mergeCommitSha,
      last_error: sync.status === "failed" ? sync.detail : null
    });

    return {
      command: "process-next",
      project_root: paths.canonicalProjectRoot,
      processed: true,
      request_id: selected.request_id,
      feature_registry_key: selected.feature_registry_key,
      merge_commit_sha: mergeCommitSha,
      local_target_sync_status: sync.status,
      shared_root_sync_status: sync.shared_root_sync_status ?? "not_started",
      local_target_sync_detail: sync.detail,
      next_action: "No further queue action is required unless review or follow-up implementation reopens the feature."
    };
  } finally {
    const removeResult = gitRun(paths.canonicalProjectRoot, ["worktree", "remove", "--force", mergeWorktreePath], { timeoutMs: 30000 });
    if (removeResult.status !== 0 && (await pathExists(mergeWorktreePath))) {
      cleanupError = formatCommandFailure("git", ["worktree", "remove", "--force", mergeWorktreePath], removeResult, "Failed to remove the temporary merge worktree cleanly.");
      await rm(mergeWorktreePath, { recursive: true, force: true });
    }
    if (cleanupError) {
      process.stderr.write(cleanupError + "\n");
    }
  }
}

async function syncLocalTargetBranch(paths, baseBranch) {
  const fetchResult = gitRun(paths.canonicalProjectRoot, ["fetch", "--prune", "origin", baseBranch], { timeoutMs: 30000 });
  if (fetchResult.status !== 0) {
    return {
      status: "failed",
      detail: formatCommandFailure("git", ["fetch", "--prune", "origin", baseBranch], fetchResult, "Local target-branch fetch failed."),
      shared_root_sync_status: "failed"
    };
  }

  const currentBranch = detectCurrentBranch(paths.canonicalProjectRoot);
  if (currentBranch !== baseBranch) {
    return ensureCleanTargetSyncWorktree(paths, baseBranch, "skipped_branch_not_checked_out", "Shared root checkout is on '" + (currentBranch ?? "detached") + "'.");
  }

  const dirty = gitRun(paths.canonicalProjectRoot, ["status", "--porcelain"]).stdout;
  if (dirty) {
    return ensureCleanTargetSyncWorktree(paths, baseBranch, "skipped_dirty_checkout", "Shared root checkout is dirty and was not fast-forwarded.");
  }

  const ffResult = gitRun(paths.canonicalProjectRoot, ["merge", "--ff-only", "origin/" + baseBranch], { timeoutMs: 30000 });
  if (ffResult.status !== 0) {
    return {
      status: "failed",
      detail: formatCommandFailure("git", ["merge", "--ff-only", "origin/" + baseBranch], ffResult, "Fast-forward of the shared root target branch failed."),
      shared_root_sync_status: "failed"
    };
  }

  return {
    status: "fast_forwarded",
    detail: "Fetched and fast-forwarded the shared root '" + baseBranch + "' checkout.",
    shared_root_sync_status: "fast_forwarded"
  };
}

async function ensureCleanTargetSyncWorktree(paths, baseBranch, sharedRootSyncStatus, sharedRootReason) {
  const syncRoot = join(paths.mergeWorktreesRoot, "target-sync");
  const syncWorktreePath = join(syncRoot, sanitizePathSegment(baseBranch));
  await mkdir(syncRoot, { recursive: true });

  if (await pathExists(syncWorktreePath)) {
    const removeResult = gitRun(paths.canonicalProjectRoot, ["worktree", "remove", "--force", syncWorktreePath], { timeoutMs: 30000 });
    if (removeResult.status !== 0) {
      await rm(syncWorktreePath, { recursive: true, force: true });
    }
  }

  const targetRef = gitRefExists(paths.canonicalProjectRoot, "refs/remotes/origin/" + baseBranch)
    ? "origin/" + baseBranch
    : baseBranch;
  const addResult = gitRun(paths.canonicalProjectRoot, ["worktree", "add", "--detach", syncWorktreePath, targetRef], { timeoutMs: 30000 });
  if (addResult.status !== 0) {
    return {
      status: "failed",
      detail: formatCommandFailure("git", ["worktree", "add", "--detach", syncWorktreePath, targetRef], addResult, "Failed to create a clean target-sync worktree."),
      shared_root_sync_status: sharedRootSyncStatus
    };
  }

  return {
    status: "clean_worktree_ready",
    detail: sharedRootReason + " Created a clean detached target-sync worktree at '" + normalizeSlashes(syncWorktreePath) + "'.",
    shared_root_sync_status: sharedRootSyncStatus
  };
}

async function failQueuedRequest(projectRoot, queuePath, requestId, request, message, nextAction = "Repair the blocker and retry the request.") {
  await markRequestBlocked(projectRoot, queuePath, requestId, message);
  await updateImplementPlanFeatureOperationalState(projectRoot, request.phase_number, request.feature_slug, {
    feature_root: request.feature_root,
    feature_status: "active",
    base_branch: request.base_branch,
    feature_branch: request.feature_branch,
    worktree_path: request.worktree_path,
    merge_status: "blocked",
    merge_required: true,
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
    merge_landed: false,
    operational_state_updated: true,
    error: message,
    next_action: nextAction
  };
}

async function markRequestMerged(projectRoot, queuePath, requestId, mergeCommitSha, localTargetSyncStatus, sharedRootSyncStatus) {
  await mutateQueue(projectRoot, queuePath, (queue) => {
    const request = findRequest(queue, requestId);
    if (!request) {
      fail("Queue request '" + requestId + "' disappeared before merge completion could be recorded.");
    }
    request.status = "merged";
    request.merged_at = nowIso();
    request.merge_commit_sha = mergeCommitSha;
    request.local_target_sync_status = localTargetSyncStatus;
    request.shared_root_sync_status = sharedRootSyncStatus;
    request.last_error = null;
    appendRequestTransition(request, "merged", "Merge landed successfully.", { merge_commit_sha: mergeCommitSha });
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
    request.shared_root_sync_status = request.shared_root_sync_status ?? "not_started";
    appendRequestTransition(request, "blocked", errorMessage);
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
  const executionProjectRoot = normalizeProjectRoot(projectRoot);
  const canonicalProjectRoot = inferCanonicalProjectRoot(executionProjectRoot);
  const queueRoot = resolveSkillStateRoot(canonicalProjectRoot, "merge-queue");
  const implementPlanStateRoot = resolveSkillStateRoot(canonicalProjectRoot, "implement-plan");
  return {
    projectRoot: executionProjectRoot,
    executionProjectRoot,
    canonicalProjectRoot,
    queueRoot,
    setupPath: join(queueRoot, "setup.json"),
    queuePath: join(queueRoot, "queue.json"),
    locksRoot: join(queueRoot, "locks"),
    projectLocksRoot: join(queueRoot, "locks", "project"),
    mergeWorktreesRoot: join(queueRoot, "worktrees"),
    implementPlanStateRoot,
    implementPlanFeaturesIndexPath: join(implementPlanStateRoot, "features-index.json"),
    implementPlanProjectLocksRoot: join(implementPlanStateRoot, "locks", "project")
  };
}

async function loadSetup(projectRoot) {
  const canonicalProjectRoot = inferCanonicalProjectRoot(projectRoot);
  const path = join(resolveSkillStateRoot(canonicalProjectRoot, "merge-queue"), "setup.json");
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

  if (isFilled(setup.project_root) && normalizeProjectRoot(setup.project_root) !== inferCanonicalProjectRoot(projectRoot)) {
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
  const canonicalProjectRoot = inferCanonicalProjectRoot(projectRoot);
  const path = join(resolveSkillStateRoot(canonicalProjectRoot, "merge-queue"), "queue.json");
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

async function loadImplementPlanFeaturesIndex(projectRoot) {
  const canonicalProjectRoot = inferCanonicalProjectRoot(projectRoot);
  const path = join(resolveSkillStateRoot(canonicalProjectRoot, "implement-plan"), "features-index.json");
  const empty = { version: 1, updated_at: null, features: {} };
  if (!(await pathExists(path))) {
    return { exists: false, path, data: empty };
  }
  try {
    const parsed = await readJson(path);
    if (!isPlainObject(parsed) || !isPlainObject(parsed.features)) {
      return { exists: true, path, data: empty };
    }
    return { exists: true, path, data: parsed };
  } catch {
    return { exists: true, path, data: empty };
  }
}

async function readImplementPlanStateFromProjectRoot(projectRoot, phaseNumber, featureSlug) {
  const featureRoot = resolveFeatureRoot(projectRoot, phaseNumber, featureSlug);
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

async function readImplementPlanFeatureContext(projectRoot, phaseNumber, featureSlug, preferredWorktreePath = null) {
  const canonicalProjectRoot = inferCanonicalProjectRoot(projectRoot);
  const registryKey = buildFeatureRegistryKey(phaseNumber, featureSlug);
  const featureIndex = await loadImplementPlanFeaturesIndex(canonicalProjectRoot);
  const indexEntry = featureIndex.data.features?.[registryKey] ?? null;

  const candidateRoots = [];
  if (isFilled(preferredWorktreePath)) candidateRoots.push(normalizeProjectRoot(preferredWorktreePath));
  if (isFilled(indexEntry?.execution_project_root)) candidateRoots.push(normalizeProjectRoot(indexEntry.execution_project_root));
  if (isFilled(indexEntry?.worktree_path)) candidateRoots.push(normalizeProjectRoot(indexEntry.worktree_path));
  candidateRoots.push(canonicalProjectRoot);

  const seenRoots = new Set();
  let state = null;
  let stateProjectRoot = null;
  for (const candidateRoot of candidateRoots) {
    const normalizedRoot = normalizeProjectRoot(candidateRoot);
    if (seenRoots.has(normalizedRoot)) continue;
    seenRoots.add(normalizedRoot);
    state = await readImplementPlanStateFromProjectRoot(normalizedRoot, phaseNumber, featureSlug);
    if (state) {
      stateProjectRoot = normalizedRoot;
      break;
    }
  }

  return {
    registryKey,
    indexEntry,
    state,
    canonicalFeatureRoot: normalizeSlashes(resolveFeatureRoot(canonicalProjectRoot, phaseNumber, featureSlug)),
    executionProjectRoot: normalizeSlashes(
      indexEntry?.execution_project_root
      ?? state?.execution_project_root
      ?? stateProjectRoot
      ?? canonicalProjectRoot
    ),
    executionFeatureRoot: normalizeSlashes(resolveFeatureRoot(
      indexEntry?.execution_project_root
      ?? state?.execution_project_root
      ?? stateProjectRoot
      ?? canonicalProjectRoot,
      phaseNumber,
      featureSlug
    ))
  };
}

async function updateImplementPlanFeatureOperationalState(projectRoot, phaseNumber, featureSlug, fields) {
  const paths = buildPaths(projectRoot);
  const registryKey = buildFeatureRegistryKey(phaseNumber, featureSlug);
  const canonicalFeatureRoot = fields.feature_root ?? normalizeSlashes(resolveFeatureRoot(paths.canonicalProjectRoot, phaseNumber, featureSlug));
  await withLock(paths.implementPlanProjectLocksRoot, "features-index", async () => {
    const current = await loadImplementPlanFeaturesIndex(paths.canonicalProjectRoot);
    const next = isPlainObject(current.data) && isPlainObject(current.data.features)
      ? current.data
      : { version: 1, updated_at: null, features: {} };
    next.version = 1;
    next.features = isPlainObject(next.features) ? next.features : {};
    const existing = isPlainObject(next.features[registryKey]) ? next.features[registryKey] : {};
    next.features[registryKey] = {
      phase_number: phaseNumber,
      feature_slug: featureSlug,
      feature_root: canonicalFeatureRoot,
      project_root: paths.canonicalProjectRoot,
      execution_project_root: fields.execution_project_root ?? existing.execution_project_root ?? paths.executionProjectRoot,
      feature_status: fields.feature_status ?? existing.feature_status ?? "active",
      active_run_status: fields.active_run_status ?? existing.active_run_status ?? null,
      base_branch: fields.base_branch ?? existing.base_branch ?? null,
      feature_branch: fields.feature_branch ?? existing.feature_branch ?? null,
      worktree_path: fields.worktree_path ?? existing.worktree_path ?? null,
      merge_required: fields.merge_required ?? existing.merge_required ?? true,
      merge_status: fields.merge_status ?? existing.merge_status ?? null,
      approved_commit_sha: fields.approved_commit_sha ?? existing.approved_commit_sha ?? null,
      merge_commit_sha: fields.merge_commit_sha ?? existing.merge_commit_sha ?? null,
      merge_queue_request_id: fields.merge_queue_request_id ?? existing.merge_queue_request_id ?? null,
      local_target_sync_status: fields.local_target_sync_status ?? existing.local_target_sync_status ?? null,
      last_completed_step: fields.last_completed_step ?? existing.last_completed_step ?? null,
      last_commit_sha: fields.last_commit_sha ?? existing.last_commit_sha ?? null,
      last_error: fields.last_error ?? existing.last_error ?? null,
      updated_at: nowIso()
    };
    next.updated_at = nowIso();
    await writeJsonAtomic(paths.implementPlanFeaturesIndexPath, next);
  });
}

function gitCommitExists(projectRoot, commitSha) {
  if (!isFilled(commitSha)) return false;
  return gitRun(projectRoot, ["cat-file", "-e", commitSha + "^{commit}"], { timeoutMs: 10000 }).status === 0;
}

function resolveFeatureRef(projectRoot, featureBranch) {
  if (gitRefExists(projectRoot, "refs/remotes/origin/" + featureBranch)) {
    return "origin/" + featureBranch;
  }
  if (gitRefExists(projectRoot, "refs/heads/" + featureBranch)) {
    return featureBranch;
  }
  return null;
}

function appendRequestTransition(request, status, note, extra = {}) {
  request.transition_log = Array.isArray(request.transition_log) ? request.transition_log : [];
  request.transition_log.push({
    status,
    at: nowIso(),
    note,
    ...extra
  });
  request.transition_log = request.transition_log.slice(-50);
}

function normalizeLaneKey(baseBranch) {
  return sanitizePathSegment(baseBranch).toLowerCase();
}

function validateEnum(value, allowed, fieldName, errors) {
  if (!isFilled(value)) return;
  if (!allowed.has(value)) {
    errors.push("Field '" + fieldName + "' must be one of: " + Array.from(allowed).join(", ") + ".");
  }
}
