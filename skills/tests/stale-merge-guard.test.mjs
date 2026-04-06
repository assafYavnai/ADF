#!/usr/bin/env node

/**
 * Targeted tests for stale/already-merged queue request rejection.
 *
 * Validates that:
 * - process-next rejects a queue request whose approved_commit_sha is already
 *   an ancestor of the target branch (stale merge)
 * - process-next allows a non-stale queue request through the ancestor check
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const mergeHelperPath = join(__dirname, "..", "merge-queue", "scripts", "merge-queue-helper.mjs");

const testRoot = join(
  process.env.TEMP || process.env.TMPDIR || "/tmp",
  "stale-merge-guard-test-" + randomUUID()
);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion failed: " + message);
  }
}

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true, timeout: 15000 });
  if (result.status !== 0) {
    throw new Error("git " + args.join(" ") + " failed: " + (result.stderr || result.stdout || "unknown"));
  }
  return (result.stdout || "").trim();
}

function runProcessNext(projectRoot, baseBranch, extraArgs = []) {
  return spawnSync("node", [
    mergeHelperPath,
    "process-next",
    "--project-root", projectRoot,
    "--base-branch", baseBranch,
    "--no-sync-local-target",
    ...extraArgs
  ], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    cwd: projectRoot
  });
}

const VALID_COMPLETION = `1. Objective Completed
Done.

2. Deliverables Produced
Done.

3. Files Changed And Why
Done.

4. Verification Evidence
Done.

5. Feature Artifacts Updated
Done.

6. Commit And Push Result
Done.

7. Remaining Non-Goals / Debt
None.
`;

async function setupProjectWithMergedFeature(testDir) {
  // Init bare remote and clone
  const remotePath = join(testDir, "remote.git");
  const repoPath = join(testDir, "repo");
  await mkdir(remotePath, { recursive: true });
  await mkdir(repoPath, { recursive: true });

  git(remotePath, ["init", "--bare", "--initial-branch=main"]);
  git(testDir, ["clone", remotePath, "repo"]);
  git(repoPath, ["config", "user.email", "test@test.com"]);
  git(repoPath, ["config", "user.name", "Test"]);
  git(repoPath, ["checkout", "-B", "main"]);

  // Create initial commit on main
  git(repoPath, ["commit", "--allow-empty", "-m", "initial commit"]);
  git(repoPath, ["push", "-u", "origin", "main"]);

  // Create feature branch with a commit
  git(repoPath, ["checkout", "-b", "implement-plan/phase1/test-feature"]);
  const featureRoot = join(repoPath, "docs", "phase1", "test-feature");
  await mkdir(featureRoot, { recursive: true });
  await writeFile(join(featureRoot, "completion-summary.md"), VALID_COMPLETION, "utf8");
  await writeFile(join(featureRoot, "implement-plan-state.json"), JSON.stringify({
    state_schema_version: 2,
    feature_status: "active",
    project_root: repoPath.replace(/\\/g, "/"),
    approved_commit_sha: null,
    last_commit_sha: null,
    merge_commit_sha: null,
    merge_required: true,
    merge_status: "not_ready",
    base_branch: "main",
    feature_branch: "implement-plan/phase1/test-feature"
  }, null, 2), "utf8");
  git(repoPath, ["add", "."]);
  git(repoPath, ["commit", "-m", "feat: test feature"]);
  const approvedCommitSha = git(repoPath, ["rev-parse", "HEAD"]);
  git(repoPath, ["push", "-u", "origin", "implement-plan/phase1/test-feature"]);

  // Merge feature into main (simulating a prior successful merge)
  git(repoPath, ["checkout", "main"]);
  git(repoPath, ["merge", "--no-ff", "-m", "Merge test-feature", "implement-plan/phase1/test-feature"]);
  const mergeCommitSha = git(repoPath, ["rev-parse", "HEAD"]);
  git(repoPath, ["push", "origin", "main"]);

  // Set up merge-queue infrastructure
  const mqRoot = join(repoPath, ".codex", "merge-queue");
  await mkdir(join(mqRoot, "locks", "project"), { recursive: true });
  await mkdir(join(mqRoot, "worktrees"), { recursive: true });

  // Set up implement-plan infrastructure
  const ipRoot = join(repoPath, ".codex", "implement-plan");
  await mkdir(join(ipRoot, "locks", "features"), { recursive: true });
  await mkdir(join(ipRoot, "locks", "project"), { recursive: true });

  // Write merge-queue setup
  await writeFile(join(mqRoot, "setup.json"), JSON.stringify({
    project_root: repoPath.replace(/\\/g, "/"),
    preferred_execution_access_mode: "native_full_access",
    fallback_execution_access_mode: "interactive_fallback",
    runtime_permission_model: "native_explicit_full_access",
    execution_access_notes: "test environment",
    preferred_execution_runtime: "claude_code_exec",
    persistent_execution_strategy: "artifact_continuity_only",
    detected_runtime_capabilities: {},
    updated_at: new Date().toISOString()
  }, null, 2), "utf8");

  // Update feature state to look like it's ready for merge (pre-stale-request)
  await writeFile(join(featureRoot, "implement-plan-state.json"), JSON.stringify({
    state_schema_version: 2,
    feature_status: "active",
    project_root: repoPath.replace(/\\/g, "/"),
    approved_commit_sha: approvedCommitSha,
    last_commit_sha: null,
    merge_commit_sha: null,
    merge_required: true,
    merge_status: "not_ready",
    local_target_sync_status: "not_started",
    active_run_status: "merge_ready",
    last_completed_step: "verification_passed",
    base_branch: "main",
    feature_branch: "implement-plan/phase1/test-feature"
  }, null, 2), "utf8");

  return { repoPath, remotePath, approvedCommitSha, mergeCommitSha, featureRoot };
}

async function runTest(name, fn) {
  const testDir = join(testRoot, name.replace(/\s+/g, "-"));
  await mkdir(testDir, { recursive: true });
  try {
    await fn(testDir);
    passed += 1;
    process.stdout.write("PASS: " + name + "\n");
  } catch (error) {
    failed += 1;
    process.stderr.write("FAIL: " + name + "\n  " + (error.stack ?? error.message ?? String(error)) + "\n");
  }
}

// Test 1: process-next rejects a stale queue request whose commit is already merged
await runTest("process-next rejects stale already-merged queue request", async (dir) => {
  const { repoPath, approvedCommitSha } = await setupProjectWithMergedFeature(dir);

  // Pre-seed a stale queue request (as if an earlier merge succeeded but a duplicate was queued)
  const queuePath = join(repoPath, ".codex", "merge-queue", "queue.json");
  const staleQueue = {
    version: 1,
    updated_at: new Date().toISOString(),
    lanes: {
      main: {
        base_branch: "main",
        requests: [{
          request_id: "merge-main-1-test-feature-stale",
          phase_number: 1,
          feature_slug: "test-feature",
          feature_registry_key: "phase1/test-feature",
          feature_root: join(repoPath, "docs", "phase1", "test-feature").replace(/\\/g, "/"),
          project_root: repoPath.replace(/\\/g, "/"),
          control_project_root: repoPath.replace(/\\/g, "/"),
          base_branch: "main",
          feature_branch: "implement-plan/phase1/test-feature",
          worktree_path: repoPath.replace(/\\/g, "/"),
          approved_commit_sha: approvedCommitSha,
          queued_at: new Date().toISOString(),
          started_at: null,
          merged_at: null,
          blocked_at: null,
          status: "queued",
          merge_commit_sha: null,
          local_target_sync_status: "not_started",
          queue_note: "stale duplicate request",
          last_error: null
        }]
      }
    }
  };
  await writeFile(queuePath, JSON.stringify(staleQueue, null, 2), "utf8");

  const result = runProcessNext(repoPath, "main");

  // Should not have exit code 0 failure, but the command should succeed with a "blocked" status
  const output = result.stdout ? result.stdout.trim() : "";
  const stderr = result.stderr || "";

  // processNext returns JSON with processed: false and error message
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("Expected JSON output from process-next, got stdout: " + output + "\nstderr: " + stderr);
  }

  assert(parsed.processed === false, "stale request should not be processed, got processed=" + parsed.processed);
  assert(
    (parsed.error || "").includes("already an ancestor"),
    "error should mention 'already an ancestor', got: " + (parsed.error || "none")
  );

  // Verify queue request was marked blocked, not merged
  const updatedQueue = JSON.parse(await readFile(queuePath, "utf8"));
  const request = updatedQueue.lanes.main.requests.find(r => r.request_id === "merge-main-1-test-feature-stale");
  assert(request.status === "blocked", "request should be blocked, got: " + request.status);
  assert(
    (request.last_error || "").includes("already an ancestor"),
    "request error should mention 'already an ancestor'"
  );
});

// Test 2: Verify a non-stale queued request is NOT blocked by the ancestor check
await runTest("process-next allows non-stale queued request", async (dir) => {
  const { repoPath } = await setupProjectWithMergedFeature(dir);

  // Create a new feature branch with a commit that is NOT already in main
  git(repoPath, ["checkout", "-b", "implement-plan/phase1/fresh-feature", "main"]);
  const freshFeatureRoot = join(repoPath, "docs", "phase1", "fresh-feature");
  await mkdir(freshFeatureRoot, { recursive: true });
  await writeFile(join(freshFeatureRoot, "new-file.txt"), "fresh content", "utf8");
  await writeFile(join(freshFeatureRoot, "completion-summary.md"), VALID_COMPLETION, "utf8");
  await writeFile(join(freshFeatureRoot, "implement-plan-state.json"), JSON.stringify({
    state_schema_version: 2,
    feature_status: "active",
    project_root: repoPath.replace(/\\/g, "/"),
    approved_commit_sha: null,
    last_commit_sha: null,
    merge_commit_sha: null,
    merge_required: true,
    merge_status: "not_ready",
    base_branch: "main",
    feature_branch: "implement-plan/phase1/fresh-feature"
  }, null, 2), "utf8");
  git(repoPath, ["add", "."]);
  git(repoPath, ["commit", "-m", "feat: fresh feature"]);
  const freshSha = git(repoPath, ["rev-parse", "HEAD"]);
  git(repoPath, ["push", "-u", "origin", "implement-plan/phase1/fresh-feature"]);

  // Go back to main for process-next
  git(repoPath, ["checkout", "main"]);

  // Pre-seed a queue request with the fresh (non-stale) commit
  const queuePath = join(repoPath, ".codex", "merge-queue", "queue.json");
  const freshQueue = {
    version: 1,
    updated_at: new Date().toISOString(),
    lanes: {
      main: {
        base_branch: "main",
        requests: [{
          request_id: "merge-main-1-fresh-feature",
          phase_number: 1,
          feature_slug: "fresh-feature",
          feature_registry_key: "phase1/fresh-feature",
          feature_root: freshFeatureRoot.replace(/\\/g, "/"),
          project_root: repoPath.replace(/\\/g, "/"),
          control_project_root: repoPath.replace(/\\/g, "/"),
          base_branch: "main",
          feature_branch: "implement-plan/phase1/fresh-feature",
          worktree_path: repoPath.replace(/\\/g, "/"),
          approved_commit_sha: freshSha,
          queued_at: new Date().toISOString(),
          started_at: null,
          merged_at: null,
          blocked_at: null,
          status: "queued",
          merge_commit_sha: null,
          local_target_sync_status: "not_started",
          queue_note: "fresh non-stale request",
          last_error: null
        }]
      }
    }
  };
  await writeFile(queuePath, JSON.stringify(freshQueue, null, 2), "utf8");

  const result = runProcessNext(repoPath, "main");
  const output = result.stdout ? result.stdout.trim() : "";

  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch {
    // If it fails for non-stale reasons (e.g., worktree creation path issues), that's
    // acceptable — the point is it should NOT have been blocked as stale.
    const combined = (result.stderr || "") + output;
    assert(
      !combined.includes("already an ancestor"),
      "non-stale request should not be blocked as already-merged ancestor"
    );
    return;
  }

  // If we got JSON back, verify it was NOT blocked as stale
  if (parsed.processed === false && parsed.error) {
    assert(
      !parsed.error.includes("already an ancestor"),
      "non-stale request should not be blocked as already-merged ancestor"
    );
  }
});

// Summary
process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
