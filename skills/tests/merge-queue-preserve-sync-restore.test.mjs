#!/usr/bin/env node

/**
 * Targeted tests for merge-queue preserve-sync-restore behavior.
 *
 * Validates that:
 * - dirty tracked local changes are preserved and restored
 * - dirty untracked local changes are preserved and restored
 * - restore conflicts fail closed and leave durable recovery evidence
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
  "mpsr-" + randomUUID().slice(0, 8)
);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion failed: " + message);
  }
}

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });
  if (result.status !== 0) {
    throw new Error("git " + args.join(" ") + " failed: " + (result.stderr || result.stdout || "unknown"));
  }
  return (result.stdout || "").trim();
}

function runMergeHelper(args, cwd) {
  const result = spawnSync("node", [mergeHelperPath, ...args], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000
  });
  return {
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim()
  };
}

function parseJson(result) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

const COMPLETION_SUMMARY = `1. Objective Completed
Done.

2. Deliverables Produced
Done.

3. Files Changed And Why
Done.

4. Verification Evidence
Machine Verification: passed.
Human Verification Requirement: not required.
Human Verification Status: not required.
Review-Cycle Status: not run.
Merge Status: pending.
Local Target Sync Status: pending.

5. Feature Artifacts Updated
Done.

6. Commit And Push Result
Done.

7. Remaining Non-Goals / Debt
None.
`;

const CONTRACT = `1. Implementation Objective

Test.

2. Slice Scope

Test.

3. Required Deliverables

Test.

4. Allowed Edits

Test.

5. Forbidden Edits

Test.

6. Acceptance Gates

Machine Verification Plan:
- test

Human Verification Plan:
Required: false

7. Observability / Audit

Test.

8. Dependencies / Constraints

Test.

9. Non-Goals

Test.

10. Source Authorities

Test.
`;

async function setupQueueReadyProject(testDir, {
  featureFile = "feature.txt",
  featureContent = "feature change\n"
} = {}) {
  const remotePath = join(testDir, "remote.git");
  const repoPath = join(testDir, "repo");
  const featureWorktreePath = join(testDir, "feature-worktree");
  await mkdir(remotePath, { recursive: true });

  git(remotePath, ["init", "--bare", "--initial-branch=main"]);
  git(testDir, ["clone", remotePath, "repo"]);
  git(repoPath, ["config", "user.email", "test@test.com"]);
  git(repoPath, ["config", "user.name", "Test"]);
  git(repoPath, ["checkout", "-B", "main"]);

  await writeFile(join(repoPath, "tracked-local.txt"), "base tracked file\n", "utf8");
  await writeFile(join(repoPath, "shared.txt"), "base shared file\n", "utf8");
  git(repoPath, ["add", "."]);
  git(repoPath, ["commit", "-m", "initial main"]);
  git(repoPath, ["push", "-u", "origin", "main"]);

  git(repoPath, ["checkout", "-b", "implement-plan/phase1/test-feature"]);
  await writeFile(join(repoPath, featureFile), featureContent, "utf8");

  const featureRoot = join(repoPath, "docs", "phase1", "test-feature");
  await mkdir(featureRoot, { recursive: true });
  await writeFile(join(featureRoot, "completion-summary.md"), COMPLETION_SUMMARY, "utf8");
  await writeFile(join(featureRoot, "implement-plan-contract.md"), CONTRACT, "utf8");
  await writeFile(join(featureRoot, "implement-plan-state.json"), JSON.stringify({
    state_schema_version: 2,
    phase_number: 1,
    feature_slug: "test-feature",
    project_root: repoPath.replace(/\\/g, "/"),
    feature_registry_key: "phase1/test-feature",
    feature_status: "active",
    approved_commit_sha: null,
    merge_commit_sha: null,
    merge_required: true,
    merge_status: "not_ready",
    local_target_sync_status: "not_started",
    human_verification_status: null,
    human_verification_approved_at: null,
    human_verification_approved_commit_sha: null,
    base_branch: "main",
    feature_branch: "implement-plan/phase1/test-feature",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    run_timestamps: {},
    event_log: [],
    artifacts: {},
    current_run_id: null,
    current_attempt_id: null,
    execution_runs: { active_by_mode: { normal: null, benchmarking: null }, runs: {} }
  }, null, 2), "utf8");

  git(repoPath, ["add", "."]);
  git(repoPath, ["commit", "-m", "feature commit"]);
  const approvedCommitSha = git(repoPath, ["rev-parse", "HEAD"]);
  git(repoPath, ["push", "-u", "origin", "implement-plan/phase1/test-feature"]);

  const featureState = JSON.parse(await readFile(join(featureRoot, "implement-plan-state.json"), "utf8"));
  featureState.approved_commit_sha = approvedCommitSha;
  await writeFile(join(featureRoot, "implement-plan-state.json"), JSON.stringify(featureState, null, 2), "utf8");
  git(repoPath, ["add", join("docs", "phase1", "test-feature", "implement-plan-state.json")]);
  git(repoPath, ["commit", "-m", "record approved sha"]);
  git(repoPath, ["push"]);

  const mergeQueueRoot = join(repoPath, ".codex", "merge-queue");
  const implementPlanRoot = join(repoPath, ".codex", "implement-plan");
  await mkdir(join(mergeQueueRoot, "locks", "project"), { recursive: true });
  await mkdir(join(mergeQueueRoot, "worktrees"), { recursive: true });
  await mkdir(join(implementPlanRoot, "locks", "features"), { recursive: true });
  await mkdir(join(implementPlanRoot, "locks", "project"), { recursive: true });
  await writeFile(join(mergeQueueRoot, "setup.json"), JSON.stringify({
    project_root: repoPath.replace(/\\/g, "/"),
    preferred_execution_access_mode: "native_full_access",
    fallback_execution_access_mode: "interactive_fallback",
    runtime_permission_model: "native_explicit_full_access",
    execution_access_notes: "test",
    preferred_execution_runtime: "claude_code_exec",
    persistent_execution_strategy: "artifact_continuity_only",
    detected_runtime_capabilities: {},
    updated_at: new Date().toISOString()
  }, null, 2), "utf8");

  git(repoPath, ["checkout", "main"]);
  git(repoPath, ["worktree", "add", featureWorktreePath, "implement-plan/phase1/test-feature"]);
  const featureWorktreeRoot = join(featureWorktreePath, "docs", "phase1", "test-feature");

  const enqueueResult = runMergeHelper([
    "enqueue",
    "--project-root", featureWorktreePath.replace(/\\/g, "/"),
    "--phase-number", "1",
    "--feature-slug", "test-feature",
    "--approved-commit-sha", approvedCommitSha,
    "--base-branch", "main",
    "--feature-branch", "implement-plan/phase1/test-feature",
    "--worktree-path", featureWorktreePath.replace(/\\/g, "/")
  ], featureWorktreePath);
  const enqueueJson = parseJson(enqueueResult);
  assert(
    enqueueJson !== null && enqueueJson.request?.request_id,
    "enqueue should succeed, got stdout: " + enqueueResult.stdout + " stderr: " + enqueueResult.stderr
  );

  return {
    repoPath,
    featureWorktreePath,
    featureRoot: featureWorktreeRoot,
    approvedCommitSha,
    requestId: enqueueJson.request.request_id
  };
}

async function runTest(name, fn) {
  const testDir = join(testRoot, "case-" + String(passed + failed + 1).padStart(2, "0"));
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

await runTest("dirty tracked local changes are preserved and restored", async (dir) => {
  const { repoPath } = await setupQueueReadyProject(dir);
  await writeFile(join(repoPath, "tracked-local.txt"), "base tracked file\nlocal dirty change\n", "utf8");

  const result = runMergeHelper([
    "process-next",
    "--project-root", repoPath.replace(/\\/g, "/"),
    "--base-branch", "main"
  ], repoPath);
  const json = parseJson(result);
  assert(json !== null, "expected JSON output from process-next");
  assert(json.local_target_sync_status === "preserve_restore_succeeded", "tracked preserve/restore should succeed");

  const status = git(repoPath, ["status", "--porcelain"]);
  assert(status.includes(" tracked-local.txt") || status.includes("M tracked-local.txt"), "tracked dirty file should remain in working tree");
});

await runTest("dirty untracked local changes are preserved and restored", async (dir) => {
  const { repoPath } = await setupQueueReadyProject(dir);
  await writeFile(join(repoPath, "scratch.tmp"), "untracked local file\n", "utf8");

  const result = runMergeHelper([
    "process-next",
    "--project-root", repoPath.replace(/\\/g, "/"),
    "--base-branch", "main"
  ], repoPath);
  const json = parseJson(result);
  assert(json !== null, "expected JSON output from process-next");
  assert(json.local_target_sync_status === "preserve_restore_succeeded", "untracked preserve/restore should succeed");

  const status = git(repoPath, ["status", "--porcelain"]);
  assert(status.includes("?? scratch.tmp"), "untracked local file should remain after restore");
});

await runTest("restore conflicts fail closed and preserve recovery stash", async (dir) => {
  const { repoPath } = await setupQueueReadyProject(dir, {
    featureFile: "shared.txt",
    featureContent: "feature branch change\n"
  });
  await writeFile(join(repoPath, "shared.txt"), "local dirty conflicting change\n", "utf8");

  const result = runMergeHelper([
    "process-next",
    "--project-root", repoPath.replace(/\\/g, "/"),
    "--base-branch", "main"
  ], repoPath);
  const json = parseJson(result);
  assert(json !== null, "expected JSON output from process-next");
  assert(json.local_target_sync_status === "preserve_restore_failed", "restore conflict should fail closed");
  assert(json.closeout_persisted === false, "closeout should not be marked complete after restore failure");

  const stashList = git(repoPath, ["stash", "list"]);
  assert(stashList.includes("merge-queue-preserve-sync-main"), "recovery stash should be retained for manual recovery");
});

process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
