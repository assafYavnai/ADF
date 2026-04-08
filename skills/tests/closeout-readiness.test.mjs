#!/usr/bin/env node

/**
 * Targeted tests for pre-merge closeout readiness.
 *
 * Validates that validate-closeout-readiness:
 * - accepts approved_commit_sha as the pre-merge commit authority
 * - does NOT require last_commit_sha before merge
 * - blocks when approved_commit_sha is missing
 * - blocks when completion-summary.md is missing
 * - blocks when feature is already completed
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
  "closeout-readiness-test-" + randomUUID()
);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion failed: " + message);
  }
}

function runHelper(projectRoot, phaseNumber, featureSlug) {
  const result = spawnSync("node", [
    helperPath,
    "validate-closeout-readiness",
    "--project-root", projectRoot,
    "--phase-number", String(phaseNumber),
    "--feature-slug", featureSlug
  ], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });
  if (result.status !== 0) {
    throw new Error("Helper failed: " + (result.stderr || result.stdout || "unknown"));
  }
  return JSON.parse(result.stdout.trim());
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

// Test 1: Pre-merge readiness passes with approved_commit_sha and no last_commit_sha
await runTest("pre-merge readiness passes with approved_commit_sha and no last_commit_sha", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: {
      state_schema_version: 2,
      feature_status: "active",
      approved_commit_sha: "abc123def456",
      last_commit_sha: null,
      merge_commit_sha: null
    },
    completionSummary: VALID_COMPLETION
  });

  const result = runHelper(projectRoot, 1, "test-feature");
  assert(result.closeout_ready === true, "should be ready with approved_commit_sha and no last_commit_sha");
  assert(result.blockers === null, "should have no blockers, got: " + JSON.stringify(result.blockers));
});

// Test 2: Pre-merge readiness blocks when approved_commit_sha is missing
await runTest("pre-merge readiness blocks when approved_commit_sha is missing", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: {
      state_schema_version: 2,
      feature_status: "active",
      approved_commit_sha: null,
      last_commit_sha: null,
      merge_commit_sha: null
    },
    completionSummary: VALID_COMPLETION
  });

  const result = runHelper(projectRoot, 1, "test-feature");
  assert(result.closeout_ready === false, "should not be ready without approved_commit_sha");
  assert(Array.isArray(result.blockers), "should have blockers");
  assert(result.blockers.some(b => b.includes("approved_commit_sha")), "blocker should mention approved_commit_sha");
});

// Test 3: Pre-merge readiness blocks when completion-summary.md is missing
await runTest("pre-merge readiness blocks when completion-summary is missing", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: {
      state_schema_version: 2,
      feature_status: "active",
      approved_commit_sha: "abc123def456",
      last_commit_sha: null
    },
    completionSummary: undefined
  });

  const result = runHelper(projectRoot, 1, "test-feature");
  assert(result.closeout_ready === false, "should not be ready without completion-summary");
  assert(Array.isArray(result.blockers), "should have blockers");
  assert(result.blockers.some(b => b.includes("completion-summary")), "blocker should mention completion-summary");
});

// Test 4: Pre-merge readiness blocks when feature is already completed
await runTest("pre-merge readiness blocks when feature is already completed", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: {
      state_schema_version: 2,
      feature_status: "completed",
      approved_commit_sha: "abc123def456",
      last_commit_sha: "abc123def456",
      merge_commit_sha: "merge789"
    },
    completionSummary: VALID_COMPLETION
  });

  const result = runHelper(projectRoot, 1, "test-feature");
  assert(result.closeout_ready === false, "should not be ready when already completed");
  assert(Array.isArray(result.blockers), "should have blockers");
  assert(result.blockers.some(b => b.includes("completed")), "blocker should mention completed status");
});

// Test 5: Pre-merge readiness passes even with both approved and last_commit_sha
await runTest("pre-merge readiness passes with both approved and last_commit_sha present", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: {
      state_schema_version: 2,
      feature_status: "active",
      approved_commit_sha: "abc123def456",
      last_commit_sha: "xyz789",
      merge_commit_sha: null
    },
    completionSummary: VALID_COMPLETION
  });

  const result = runHelper(projectRoot, 1, "test-feature");
  assert(result.closeout_ready === true, "should be ready with both SHAs present");
  assert(result.blockers === null, "should have no blockers");
});

// Test 6: Pre-merge readiness blocks when state file is missing
await runTest("pre-merge readiness blocks when state file is missing", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: undefined,
    completionSummary: VALID_COMPLETION
  });

  const result = runHelper(projectRoot, 1, "test-feature");
  assert(result.closeout_ready === false, "should not be ready without state file");
  assert(Array.isArray(result.blockers), "should have blockers");
});

// Summary
process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
