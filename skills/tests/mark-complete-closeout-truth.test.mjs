#!/usr/bin/env node

/**
 * Targeted tests for post-merge mark-complete closeout truth.
 *
 * Validates that mark-complete:
 * - still requires last_commit_sha for post-merge closeout
 * - still requires valid completion-summary.md
 * - still requires merge_status=merged when merge_required
 * - still requires recorded local_target_sync_status
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
  "mark-complete-test-" + randomUUID()
);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion failed: " + message);
  }
}

function runMarkComplete(projectRoot, phaseNumber, featureSlug, extraArgs = []) {
  const result = spawnSync("node", [
    helperPath,
    "mark-complete",
    "--project-root", projectRoot,
    "--phase-number", String(phaseNumber),
    "--feature-slug", featureSlug,
    ...extraArgs
  ], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });
  return result;
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

async function setupFeature(testDir, { state, completionSummary }) {
  const featureRoot = join(testDir, "docs", "phase1", "test-feature");
  await mkdir(featureRoot, { recursive: true });
  // Also need skill state root for locks
  await mkdir(join(testDir, ".codex", "implement-plan", "locks", "features"), { recursive: true });
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

// Test 1: mark-complete fails without last_commit_sha
await runTest("mark-complete fails without last_commit_sha", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: {
      state_schema_version: 2,
      feature_status: "active",
      approved_commit_sha: "abc123",
      last_commit_sha: null,
      merge_commit_sha: "merge456",
      merge_required: true,
      merge_status: "merged",
      local_target_sync_status: "fast_forwarded",
      active_run_status: "closeout_pending"
    },
    completionSummary: VALID_COMPLETION
  });

  const result = runMarkComplete(projectRoot, 1, "test-feature");
  assert(result.status !== 0, "mark-complete should fail without last_commit_sha");
  const output = (result.stderr || result.stdout || "").toLowerCase();
  assert(output.includes("last_commit_sha"), "error should mention last_commit_sha, got: " + output);
});

// Test 2: mark-complete fails without completion-summary.md
await runTest("mark-complete fails without completion-summary", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: {
      state_schema_version: 2,
      feature_status: "active",
      approved_commit_sha: "abc123",
      last_commit_sha: "merge456",
      merge_commit_sha: "merge456",
      merge_required: true,
      merge_status: "merged",
      local_target_sync_status: "fast_forwarded",
      active_run_status: "closeout_pending"
    },
    completionSummary: undefined
  });

  const result = runMarkComplete(projectRoot, 1, "test-feature");
  assert(result.status !== 0, "mark-complete should fail without completion-summary");
  const output = (result.stderr || result.stdout || "").toLowerCase();
  assert(output.includes("completion-summary"), "error should mention completion-summary, got: " + output);
});

// Test 3: mark-complete fails when merge_required but merge_status is not merged
await runTest("mark-complete fails when merge not completed", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: {
      state_schema_version: 2,
      feature_status: "active",
      approved_commit_sha: "abc123",
      last_commit_sha: "merge456",
      merge_commit_sha: null,
      merge_required: true,
      merge_status: "queued",
      local_target_sync_status: "fast_forwarded",
      active_run_status: "merge_queued"
    },
    completionSummary: VALID_COMPLETION
  });

  const result = runMarkComplete(projectRoot, 1, "test-feature");
  assert(result.status !== 0, "mark-complete should fail when merge is not completed");
  const output = (result.stderr || result.stdout || "").toLowerCase();
  assert(output.includes("merge"), "error should mention merge status, got: " + output);
});

// Test 4: mark-complete accepts last_commit_sha via CLI argument
await runTest("mark-complete accepts last_commit_sha via argument", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: {
      state_schema_version: 2,
      feature_status: "active",
      approved_commit_sha: "abc123",
      last_commit_sha: null,
      merge_commit_sha: "merge456",
      merge_required: true,
      merge_status: "merged",
      local_target_sync_status: "fast_forwarded",
      active_run_status: "closeout_pending"
    },
    completionSummary: VALID_COMPLETION
  });

  const result = runMarkComplete(projectRoot, 1, "test-feature", ["--last-commit-sha", "merge456"]);
  assert(result.status === 0, "mark-complete should succeed with last_commit_sha provided via argument, got: " + (result.stderr || result.stdout || ""));
  const output = JSON.parse(result.stdout.trim());
  assert(output.last_commit_sha === "merge456", "should record last_commit_sha");
  assert(output.feature_status === "completed", "feature should be completed");
});

// Summary
process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
