#!/usr/bin/env node

/**
 * Targeted tests for the approved-commit-closeout-state-separation slice.
 *
 * Tests verify:
 * 1. Pre-merge closeout readiness accepts approved_commit_sha without last_commit_sha
 * 2. Pre-merge closeout readiness blocks when approved_commit_sha is missing
 * 3. Pre-merge closeout readiness blocks when completion-summary.md is missing
 * 4. Pre-merge closeout readiness blocks when feature is already completed
 * 5. mark-complete still requires last_commit_sha (post-merge evidence)
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const testRoot = join(
  process.env.TEMP || process.env.TMPDIR || "/tmp",
  "closeout-sep-test-" + randomUUID()
);

const scriptDir = dirname(fileURLToPath(import.meta.url));
const helperPath = join(scriptDir, "..", "implement-plan", "scripts", "implement-plan-helper.mjs");
const mergeHelperPath = join(scriptDir, "..", "merge-queue", "scripts", "merge-queue-helper.mjs");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion failed: " + message);
  }
}

function runHelper(args, cwd) {
  const result = spawnSync("node", [helperPath, ...args], {
    cwd: cwd || testRoot,
    encoding: "utf8",
    windowsHide: true,
    timeout: 15000
  });
  return {
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim()
  };
}

function parseHelperJson(result) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

const COMPLETION_SUMMARY_VALID = `1. Objective Completed

Test objective completed.

2. Deliverables Produced

Test deliverables.

3. Files Changed And Why

None.

4. Verification Evidence

Machine Verification: passed.
Human Verification Requirement: not required.
Human Verification Status: not applicable.
Review-Cycle Status: not applicable.
Merge Status: pending.
Local Target Sync Status: pending.

5. Feature Artifacts Updated

None.

6. Commit And Push Result

Pending.

7. Remaining Non-Goals / Debt

None.
`;

async function setupFeature(testDir, phaseNumber, featureSlug, stateOverrides, opts = {}) {
  const featureRoot = join(testDir, "docs", "phase" + phaseNumber, featureSlug);
  await mkdir(featureRoot, { recursive: true });

  if (!opts.skipCompletionSummary) {
    await writeFile(join(featureRoot, "completion-summary.md"), COMPLETION_SUMMARY_VALID, "utf8");
  }

  if (stateOverrides !== null) {
    const state = {
      schema_version: 2,
      phase_number: phaseNumber,
      feature_slug: featureSlug,
      feature_status: "active",
      approved_commit_sha: null,
      merge_commit_sha: null,
      merge_queue_request_id: null,
      merge_required: true,
      merge_status: "not_ready",
      local_target_sync_status: "not_started",
      last_completed_step: "implementation_finished",
      last_commit_sha: null,
      active_run_status: "implementation_complete",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      run_timestamps: {},
      event_log: [],
      artifacts: {},
      last_error: null,
      current_run_id: null,
      current_attempt_id: null,
      execution_runs: { active_by_mode: { normal: null, benchmarking: null }, runs: {} },
      ...stateOverrides
    };
    await writeFile(join(featureRoot, "implement-plan-state.json"), JSON.stringify(state, null, 2), "utf8");
  }

  return featureRoot;
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

// Test 1: Pre-merge readiness passes with approved_commit_sha and no last_commit_sha
await runTest("pre-merge readiness passes with approved_commit_sha and no last_commit_sha", async (dir) => {
  await setupFeature(dir, 1, "test-feature", {
    approved_commit_sha: "abc123def456",
    last_commit_sha: null
  });

  const result = runHelper([
    "validate-closeout-readiness",
    "--project-root", dir,
    "--phase-number", "1",
    "--feature-slug", "test-feature"
  ], dir);

  const json = parseHelperJson(result);
  assert(json !== null, "helper should return valid JSON, got: " + result.stdout + " stderr: " + result.stderr);
  assert(json.closeout_ready === true, "closeout_ready should be true when approved_commit_sha is present. Blockers: " + JSON.stringify(json.blockers));
  assert(json.blockers === null, "blockers should be null");
});

// Test 2: Pre-merge readiness blocks when approved_commit_sha is missing
await runTest("pre-merge readiness blocks when approved_commit_sha is missing", async (dir) => {
  await setupFeature(dir, 1, "test-feature", {
    approved_commit_sha: null,
    last_commit_sha: null
  });

  const result = runHelper([
    "validate-closeout-readiness",
    "--project-root", dir,
    "--phase-number", "1",
    "--feature-slug", "test-feature"
  ], dir);

  const json = parseHelperJson(result);
  assert(json !== null, "helper should return valid JSON");
  assert(json.closeout_ready === false, "closeout_ready should be false when approved_commit_sha is missing");
  assert(Array.isArray(json.blockers), "blockers should be an array");
  assert(json.blockers.some(b => b.includes("approved_commit_sha")), "blockers should mention approved_commit_sha");
});

// Test 3: Pre-merge readiness blocks even with last_commit_sha when approved_commit_sha missing
await runTest("last_commit_sha alone is not sufficient for pre-merge readiness", async (dir) => {
  await setupFeature(dir, 1, "test-feature", {
    approved_commit_sha: null,
    last_commit_sha: "some_commit_sha_value"
  });

  const result = runHelper([
    "validate-closeout-readiness",
    "--project-root", dir,
    "--phase-number", "1",
    "--feature-slug", "test-feature"
  ], dir);

  const json = parseHelperJson(result);
  assert(json !== null, "helper should return valid JSON");
  assert(json.closeout_ready === false, "closeout_ready should be false when approved_commit_sha is missing even with last_commit_sha present");
});

// Test 4: Pre-merge readiness blocks when completion-summary.md is missing
await runTest("pre-merge readiness blocks when completion-summary.md is missing", async (dir) => {
  await setupFeature(dir, 1, "test-feature", {
    approved_commit_sha: "abc123def456"
  }, { skipCompletionSummary: true });

  const result = runHelper([
    "validate-closeout-readiness",
    "--project-root", dir,
    "--phase-number", "1",
    "--feature-slug", "test-feature"
  ], dir);

  const json = parseHelperJson(result);
  assert(json !== null, "helper should return valid JSON");
  assert(json.closeout_ready === false, "closeout_ready should be false when completion-summary.md is missing");
  assert(json.blockers.some(b => b.includes("completion-summary.md")), "blockers should mention completion-summary.md");
});

// Test 5: Pre-merge readiness blocks when feature is already completed
await runTest("pre-merge readiness blocks when feature is already completed", async (dir) => {
  await setupFeature(dir, 1, "test-feature", {
    feature_status: "completed",
    approved_commit_sha: "abc123def456",
    last_commit_sha: "abc123def456"
  });

  const result = runHelper([
    "validate-closeout-readiness",
    "--project-root", dir,
    "--phase-number", "1",
    "--feature-slug", "test-feature"
  ], dir);

  const json = parseHelperJson(result);
  assert(json !== null, "helper should return valid JSON");
  assert(json.closeout_ready === false, "closeout_ready should be false when feature is already completed");
  assert(json.blockers.some(b => b.includes("already marked completed")), "blockers should mention already completed");
});

// Test 6: mark-complete fails without last_commit_sha (post-merge evidence)
await runTest("mark-complete fails without last_commit_sha post-merge evidence", async (dir) => {
  await setupFeature(dir, 1, "test-feature", {
    approved_commit_sha: "abc123def456",
    last_commit_sha: null,
    merge_status: "merged",
    merge_required: true,
    local_target_sync_status: "fast_forwarded"
  });

  const result = runHelper([
    "mark-complete",
    "--project-root", dir,
    "--phase-number", "1",
    "--feature-slug", "test-feature"
  ], dir);

  assert(result.status !== 0, "mark-complete should fail without last_commit_sha");
  assert(result.stderr.includes("last_commit_sha"), "error should mention last_commit_sha requirement, got: " + result.stderr);
});

// Test 7: Pre-merge readiness blocks when state file is missing entirely
await runTest("pre-merge readiness blocks when state file is missing", async (dir) => {
  await setupFeature(dir, 1, "test-feature", null);

  const result = runHelper([
    "validate-closeout-readiness",
    "--project-root", dir,
    "--phase-number", "1",
    "--feature-slug", "test-feature"
  ], dir);

  const json = parseHelperJson(result);
  assert(json !== null, "helper should return valid JSON");
  assert(json.closeout_ready === false, "closeout_ready should be false when state file is missing");
  assert(json.blockers.some(b => b.includes("implement-plan-state.json")), "blockers should mention missing state file");
});

// --- Merge-queue approved-SHA authority tests ---

// Helper: set up a git-initialized project with valid merge-queue setup
async function setupMergeQueueProject(testDir, featureState) {
  spawnSync("git", ["init"], { cwd: testDir, encoding: "utf8", windowsHide: true });
  spawnSync("git", ["commit", "--allow-empty", "-m", "init"], { cwd: testDir, encoding: "utf8", windowsHide: true });

  const featureRoot = join(testDir, "docs", "phase1", "test-feature");
  await mkdir(featureRoot, { recursive: true });

  const mqRoot = join(testDir, ".codex", "merge-queue");
  await mkdir(join(mqRoot, "locks", "project"), { recursive: true });
  await mkdir(join(mqRoot, "worktrees"), { recursive: true });

  const ipRoot = join(testDir, ".codex", "implement-plan");
  await mkdir(join(ipRoot, "locks", "features"), { recursive: true });
  await mkdir(join(ipRoot, "locks", "project"), { recursive: true });

  const normalizedDir = testDir.replace(/\\/g, "/");
  await writeFile(join(mqRoot, "setup.json"), JSON.stringify({
    project_root: normalizedDir,
    preferred_execution_access_mode: "native_full_access",
    fallback_execution_access_mode: "interactive_fallback",
    runtime_permission_model: "native_explicit_full_access",
    execution_access_notes: "test",
    preferred_execution_runtime: "claude_code_exec",
    persistent_execution_strategy: "artifact_continuity_only",
    detected_runtime_capabilities: {},
    updated_at: new Date().toISOString()
  }, null, 2), "utf8");

  if (featureState) {
    await writeFile(join(featureRoot, "implement-plan-state.json"), JSON.stringify(featureState, null, 2), "utf8");
  }

  return normalizedDir;
}

function runMergeHelper(args, cwd) {
  const result = spawnSync("node", [mergeHelperPath, ...args], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });
  return {
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim()
  };
}

// Test 8: merge-queue enqueue rejects when approved_commit_sha is missing (even with last_commit_sha)
await runTest("merge-queue enqueue rejects missing approved_commit_sha", async (dir) => {
  const projectRoot = await setupMergeQueueProject(dir, {
    state_schema_version: 2,
    feature_status: "active",
    approved_commit_sha: null,
    last_commit_sha: "should-not-be-used-as-authority",
    merge_commit_sha: null,
    base_branch: "main",
    feature_branch: "implement-plan/phase1/test-feature"
  });

  const result = runMergeHelper([
    "enqueue",
    "--project-root", projectRoot,
    "--phase-number", "1",
    "--feature-slug", "test-feature"
  ], dir);

  assert(result.status !== 0, "enqueue should fail without approved_commit_sha");
  const output = (result.stderr + " " + result.stdout).toLowerCase();
  assert(output.includes("approved commit sha"), "error should mention approved commit SHA, got: " + output);
});

// Test 9: merge-queue enqueue rejects completed features
await runTest("merge-queue enqueue rejects completed features", async (dir) => {
  const projectRoot = await setupMergeQueueProject(dir, {
    state_schema_version: 2,
    feature_status: "completed",
    approved_commit_sha: "abc123",
    last_commit_sha: "abc123",
    merge_commit_sha: "merge789",
    base_branch: "main",
    feature_branch: "implement-plan/phase1/test-feature"
  });

  const result = runMergeHelper([
    "enqueue",
    "--project-root", projectRoot,
    "--phase-number", "1",
    "--feature-slug", "test-feature"
  ], dir);

  assert(result.status !== 0, "enqueue should fail for completed features");
  const output = (result.stderr + " " + result.stdout).toLowerCase();
  assert(output.includes("completed"), "error should mention completed, got: " + output);
});

// Test 10: merge-queue workflow contract explicitly documents the authority rule
await runTest("merge-queue workflow contract states last_commit_sha is not merge authority", async () => {
  const { readFile } = await import("node:fs/promises");
  const contractPath = join(scriptDir, "..", "merge-queue", "references", "workflow-contract.md");
  const text = await readFile(contractPath, "utf8");
  assert(text.includes("last_commit_sha") && text.includes("not merge authority"),
    "workflow contract must state that last_commit_sha is not merge authority");
  assert(text.includes("approved_commit_sha"),
    "workflow contract must reference approved_commit_sha");
});

// Summary
process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
