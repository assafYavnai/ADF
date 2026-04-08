#!/usr/bin/env node

/**
 * Targeted tests for merge-queue resume-blocked behavior.
 *
 * Validates that resume-blocked:
 * - transitions a blocked request back to queued
 * - rejects when the request is not blocked
 * - rejects when the request does not exist
 * - rejects when no approved commit SHA is available
 * - accepts an updated approved commit SHA
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
  "merge-queue-resume-blocked-test-" + randomUUID()
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

function runResumeBlocked(projectRoot, requestId, extraArgs = []) {
  return spawnSync("node", [
    mergeHelperPath,
    "resume-blocked",
    "--project-root", projectRoot,
    "--request-id", requestId,
    ...extraArgs
  ], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });
}

async function setupQueueWithBlockedRequest(testDir, requestOverrides = {}) {
  const queueRoot = join(testDir, ".codex", "merge-queue");
  await mkdir(queueRoot, { recursive: true });

  // Write a valid setup.json
  await writeFile(join(queueRoot, "setup.json"), JSON.stringify({
    project_root: testDir.replace(/\\/g, "/"),
    preferred_execution_access_mode: "claude_code_skip_permissions",
    preferred_execution_runtime: "claude_code_exec",
    fallback_execution_access_mode: "inherits_current_runtime_access",
    runtime_permission_model: "claude_code_skip_permissions",
    execution_access_notes: "Test setup.",
    persistent_execution_strategy: "artifact_continuity_only",
    detected_runtime_capabilities: {},
    setup_schema_version: 2
  }, null, 2), "utf8");

  const request = {
    request_id: "test-blocked-request-1",
    phase_number: 1,
    feature_slug: "test-feature",
    feature_registry_key: "phase1/test-feature",
    feature_root: join(testDir, "docs", "phase1", "test-feature").replace(/\\/g, "/"),
    project_root: testDir.replace(/\\/g, "/"),
    control_project_root: testDir.replace(/\\/g, "/"),
    base_branch: "main",
    feature_branch: "implement-plan/phase1/test-feature",
    worktree_path: join(testDir, ".codex", "implement-plan", "worktrees", "phase1", "test-feature").replace(/\\/g, "/"),
    approved_commit_sha: "old-sha-123",
    queued_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    merged_at: null,
    blocked_at: new Date().toISOString(),
    status: "blocked",
    merge_commit_sha: null,
    local_target_sync_status: "not_started",
    queue_note: null,
    last_error: "Merge failed: conflict",
    ...requestOverrides
  };

  const queue = {
    version: 1,
    updated_at: new Date().toISOString(),
    lanes: {
      main: {
        base_branch: "main",
        requests: [request]
      }
    }
  };

  await writeFile(join(queueRoot, "queue.json"), JSON.stringify(queue, null, 2), "utf8");

  // Create feature state for implement-plan
  const featureRoot = join(testDir, "docs", "phase1", "test-feature");
  await mkdir(featureRoot, { recursive: true });
  await writeFile(join(featureRoot, "implement-plan-state.json"), JSON.stringify({
    state_schema_version: 2,
    feature_status: "active",
    merge_status: "blocked",
    active_run_status: "merge_blocked",
    last_error: "Merge failed: conflict"
  }, null, 2), "utf8");

  return testDir;
}

async function runTest(name, fn) {
  const testDir = join(testRoot, name.replace(/\s+/g, "-"));
  await mkdir(testDir, { recursive: true });
  // Initialize a git repo so the helper can resolve git project root
  git(testDir, ["init"]);
  git(testDir, ["commit", "--allow-empty", "-m", "init"]);
  try {
    await fn(testDir);
    passed += 1;
    process.stdout.write("PASS: " + name + "\n");
  } catch (error) {
    failed += 1;
    process.stderr.write("FAIL: " + name + "\n  " + (error.stack ?? error.message ?? String(error)) + "\n");
  }
}

// Test 1: resume-blocked transitions a blocked request back to queued
await runTest("transitions blocked request to queued", async (dir) => {
  await setupQueueWithBlockedRequest(dir);
  const result = runResumeBlocked(dir, "test-blocked-request-1", ["--approved-commit-sha", "new-sha-456"]);
  assert(result.status === 0, "should succeed, got: " + result.stderr);
  const output = JSON.parse(result.stdout.trim());
  assert(output.resumed === true, "should report resumed=true");
  assert(output.approved_commit_sha === "new-sha-456", "should use the new approved commit SHA");

  // Verify the queue was updated
  const queueData = JSON.parse(await readFile(join(dir, ".codex", "merge-queue", "queue.json"), "utf8"));
  const request = queueData.lanes.main.requests[0];
  assert(request.status === "queued", "request status should be queued, got: " + request.status);
  assert(request.approved_commit_sha === "new-sha-456", "approved SHA should be updated");
  assert(request.last_error === null, "last_error should be cleared");
  assert(request.blocked_at === null, "blocked_at should be cleared");
});

// Test 2: resume-blocked rejects when request does not exist
await runTest("rejects when request does not exist", async (dir) => {
  await setupQueueWithBlockedRequest(dir);
  const result = runResumeBlocked(dir, "nonexistent-request-id", ["--approved-commit-sha", "sha1"]);
  assert(result.status !== 0, "should fail for nonexistent request");
  assert(result.stderr.includes("does not exist"), "error should mention request does not exist");
});

// Test 3: resume-blocked rejects when request is not blocked (already queued)
await runTest("rejects when request is not blocked", async (dir) => {
  await setupQueueWithBlockedRequest(dir, { status: "queued", blocked_at: null, last_error: null });
  const result = runResumeBlocked(dir, "test-blocked-request-1", ["--approved-commit-sha", "sha1"]);
  assert(result.status !== 0, "should fail for non-blocked request");
  assert(result.stderr.includes("not 'blocked'"), "error should mention the request is not blocked");
});

// Test 4: resume-blocked rejects when no approved commit SHA is available
await runTest("rejects when no approved commit SHA available", async (dir) => {
  await setupQueueWithBlockedRequest(dir, { approved_commit_sha: null });
  const result = runResumeBlocked(dir, "test-blocked-request-1");
  assert(result.status !== 0, "should fail without approved commit SHA");
  assert(result.stderr.includes("approved commit SHA"), "error should mention approved commit SHA");
});

// Test 5: resume-blocked rejects same SHA for conflict-blocked requests
await runTest("rejects same SHA for conflict-blocked requests", async (dir) => {
  await setupQueueWithBlockedRequest(dir);
  const result = runResumeBlocked(dir, "test-blocked-request-1");
  assert(result.status !== 0, "should fail when reusing same SHA for merge_conflict blocker");
  assert(result.stderr.includes("merge-conflict"), "error should mention merge-conflict blocker class");
});

// Test 6: resume-blocked rejects same SHA for stale-commit-blocked requests
await runTest("rejects same SHA for stale-commit-blocked requests", async (dir) => {
  await setupQueueWithBlockedRequest(dir, {
    last_error: "Approved commit abc123 is already an ancestor of main. This request is stale."
  });
  const result = runResumeBlocked(dir, "test-blocked-request-1");
  assert(result.status !== 0, "should fail when reusing same SHA for stale_commit blocker");
  assert(result.stderr.includes("stale-commit"), "error should mention stale-commit blocker class");
});

// Test 7: resume-blocked allows same SHA for closeout-readiness-blocked requests
await runTest("allows same SHA for closeout-readiness-blocked requests", async (dir) => {
  await setupQueueWithBlockedRequest(dir, {
    last_error: "Pre-merge closeout readiness failed: completion-summary.md is missing"
  });
  const result = runResumeBlocked(dir, "test-blocked-request-1");
  assert(result.status === 0, "should succeed with same SHA for closeout_readiness blocker, got: " + result.stderr);
  const output = JSON.parse(result.stdout.trim());
  assert(output.blocker_class === "closeout_readiness", "blocker_class should be closeout_readiness");
});

// Test 8: resume-blocked migrates request between lanes when base_branch changes
await runTest("migrates request between lanes when base_branch changes", async (dir) => {
  await setupQueueWithBlockedRequest(dir, {
    last_error: "Pre-merge closeout readiness failed: completion-summary.md is missing"
  });
  const result = runResumeBlocked(dir, "test-blocked-request-1", [
    "--approved-commit-sha", "new-sha-789",
    "--base-branch", "release"
  ]);
  assert(result.status === 0, "should succeed with lane migration, got: " + result.stderr);
  const output = JSON.parse(result.stdout.trim());
  assert(output.base_branch === "release", "base_branch should be release");

  // Verify queue lane migration
  const queueData = JSON.parse(await readFile(join(dir, ".codex", "merge-queue", "queue.json"), "utf8"));
  assert(!queueData.lanes.main || queueData.lanes.main.requests.length === 0, "old main lane should be empty or removed");
  assert(queueData.lanes.release, "release lane should exist");
  assert(queueData.lanes.release.requests.length === 1, "release lane should have the migrated request");
  assert(queueData.lanes.release.requests[0].request_id === "test-blocked-request-1", "migrated request should be in release lane");
});

// Summary
process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
