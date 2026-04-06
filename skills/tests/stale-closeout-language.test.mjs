#!/usr/bin/env node

/**
 * Targeted tests for stale closeout language validation in mark-complete.
 *
 * Validates that mark-complete rejects completion when the completion-summary.md
 * still contains stale pre-merge or in-progress language such as:
 * - not_ready
 * - closeout_pending
 * - review_cycle in progress
 * - approval-pending
 * - merge_blocked
 * - merge_queued
 * - merge_in_progress
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const helperPath = join(__dirname, "..", "implement-plan", "scripts", "implement-plan-helper.mjs");

const testRoot = join(
  process.env.TEMP || process.env.TMPDIR || "/tmp",
  "stale-closeout-language-test-" + randomUUID()
);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion failed: " + message);
  }
}

function runMarkComplete(projectRoot, phaseNumber, featureSlug, lastCommitSha) {
  return spawnSync("node", [
    helperPath,
    "mark-complete",
    "--project-root", projectRoot,
    "--phase-number", String(phaseNumber),
    "--feature-slug", featureSlug,
    "--last-commit-sha", lastCommitSha
  ], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });
}

function buildCompletionSummary(verificationContent) {
  return `1. Objective Completed
Done.

2. Deliverables Produced
Done.

3. Files Changed And Why
Done.

4. Verification Evidence
${verificationContent}

5. Feature Artifacts Updated
Done.

6. Commit And Push Result
Done.

7. Remaining Non-Goals / Debt
None.
`;
}

async function setupFeature(testDir, { state, completionSummary }) {
  const featureRoot = join(testDir, "docs", "phase1", "test-feature");
  await mkdir(featureRoot, { recursive: true });
  if (state !== undefined) {
    await writeFile(join(featureRoot, "implement-plan-state.json"), JSON.stringify(state, null, 2), "utf8");
  }
  if (completionSummary !== undefined) {
    await writeFile(join(featureRoot, "completion-summary.md"), completionSummary, "utf8");
  }
  return testDir;
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

const VALID_STATE = {
  state_schema_version: 2,
  feature_status: "active",
  active_run_status: "closeout_pending",
  merge_required: true,
  merge_status: "merged",
  approved_commit_sha: "abc123",
  merge_commit_sha: "merge456",
  last_commit_sha: "merge456",
  local_target_sync_status: "fast_forwarded"
};

// Test 1: mark-complete rejects when completion summary contains not_ready
await runTest("rejects completion summary containing not_ready", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: VALID_STATE,
    completionSummary: buildCompletionSummary("- Merge Status: not_ready")
  });
  const result = runMarkComplete(projectRoot, 1, "test-feature", "merge456");
  assert(result.status !== 0, "should fail when completion summary contains not_ready");
  assert(result.stderr.includes("stale closeout language"), "error should mention stale closeout language, got: " + result.stderr);
  assert(result.stderr.includes("not_ready"), "error should mention not_ready");
});

// Test 2: mark-complete rejects when completion summary contains closeout_pending
await runTest("rejects completion summary containing closeout_pending", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: VALID_STATE,
    completionSummary: buildCompletionSummary("- Status: closeout_pending")
  });
  const result = runMarkComplete(projectRoot, 1, "test-feature", "merge456");
  assert(result.status !== 0, "should fail when completion summary contains closeout_pending");
  assert(result.stderr.includes("stale closeout language"), "error should mention stale closeout language");
  assert(result.stderr.includes("closeout_pending"), "error should mention closeout_pending");
});

// Test 3: mark-complete rejects when completion summary contains review_cycle in progress
await runTest("rejects completion summary containing review_cycle in progress", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: VALID_STATE,
    completionSummary: buildCompletionSummary("- Review-Cycle Status: review_cycle in progress")
  });
  const result = runMarkComplete(projectRoot, 1, "test-feature", "merge456");
  assert(result.status !== 0, "should fail when completion summary contains review_cycle in progress");
  assert(result.stderr.includes("stale closeout language"), "error should mention stale closeout language");
});

// Test 4: mark-complete rejects when completion summary contains approval-pending
await runTest("rejects completion summary containing approval-pending", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: VALID_STATE,
    completionSummary: buildCompletionSummary("- Human Verification Status: approval-pending")
  });
  const result = runMarkComplete(projectRoot, 1, "test-feature", "merge456");
  assert(result.status !== 0, "should fail when completion summary contains approval-pending");
  assert(result.stderr.includes("stale closeout language"), "error should mention stale closeout language");
  assert(result.stderr.includes("approval-pending"), "error should mention approval-pending");
});

// Test 5: mark-complete accepts clean completion summary without stale language
await runTest("accepts clean completion summary without stale language", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: VALID_STATE,
    completionSummary: buildCompletionSummary("- Machine Verification: passed\n- Human Verification Requirement: not required\n- Merge Status: merged\n- Review-Cycle Status: approved")
  });
  const result = runMarkComplete(projectRoot, 1, "test-feature", "merge456");
  // mark-complete may still succeed or fail for other reasons (no git repo), but it should NOT fail for stale language
  if (result.status !== 0) {
    assert(!result.stderr.includes("stale closeout language"), "should not fail for stale closeout language, but got: " + result.stderr);
  }
});

// Test 6: mark-complete rejects when completion summary contains merge_blocked
await runTest("rejects completion summary containing merge_blocked", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: VALID_STATE,
    completionSummary: buildCompletionSummary("- Merge Status: merge_blocked")
  });
  const result = runMarkComplete(projectRoot, 1, "test-feature", "merge456");
  assert(result.status !== 0, "should fail when completion summary contains merge_blocked");
  assert(result.stderr.includes("stale closeout language"), "error should mention stale closeout language");
});

// Summary
process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
