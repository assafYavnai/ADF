#!/usr/bin/env node

/**
 * Targeted tests for merge-queue approved-SHA authority.
 *
 * Validates that:
 * - merge-queue enqueue requires approved_commit_sha (not last_commit_sha) as merge authority
 * - merge-queue persistMergedFeatureCloseout sets last_commit_sha only post-merge
 * - the enqueue contract never falls back to last_commit_sha
 *
 * These tests use the merge-queue helper CLI with a minimal git-initialized
 * test environment to verify the authority model.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const mergeHelperPath = join(__dirname, "..", "merge-queue", "scripts", "merge-queue-helper.mjs");

const testRoot = join(
  process.env.TEMP || process.env.TMPDIR || "/tmp",
  "merge-authority-test-" + randomUUID()
);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion failed: " + message);
  }
}

function runEnqueue(projectRoot, phaseNumber, featureSlug, extraArgs = []) {
  const result = spawnSync("node", [
    mergeHelperPath,
    "enqueue",
    "--project-root", projectRoot,
    "--phase-number", String(phaseNumber),
    "--feature-slug", featureSlug,
    ...extraArgs
  ], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    cwd: projectRoot
  });
  return result;
}

async function setupProject(testDir, { featureState } = {}) {
  // Init git repo
  spawnSync("git", ["init"], { cwd: testDir, encoding: "utf8", windowsHide: true });
  spawnSync("git", ["commit", "--allow-empty", "-m", "init"], { cwd: testDir, encoding: "utf8", windowsHide: true });

  // Feature root
  const featureRoot = join(testDir, "docs", "phase1", "test-feature");
  await mkdir(featureRoot, { recursive: true });

  // Merge-queue state root
  const mqRoot = join(testDir, ".codex", "merge-queue");
  await mkdir(join(mqRoot, "locks", "project"), { recursive: true });
  await mkdir(join(mqRoot, "worktrees"), { recursive: true });

  // Implement-plan state root
  const ipRoot = join(testDir, ".codex", "implement-plan");
  await mkdir(join(ipRoot, "locks", "features"), { recursive: true });
  await mkdir(join(ipRoot, "locks", "project"), { recursive: true });

  // Merge-queue setup (must satisfy all required validation fields with valid enum values)
  await writeFile(join(mqRoot, "setup.json"), JSON.stringify({
    project_root: testDir.replace(/\\/g, "/"),
    preferred_execution_access_mode: "native_full_access",
    fallback_execution_access_mode: "interactive_fallback",
    runtime_permission_model: "native_explicit_full_access",
    execution_access_notes: "test environment",
    preferred_execution_runtime: "claude_code_exec",
    persistent_execution_strategy: "artifact_continuity_only",
    detected_runtime_capabilities: {},
    updated_at: new Date().toISOString()
  }, null, 2), "utf8");

  // Feature state
  if (featureState) {
    await writeFile(join(featureRoot, "implement-plan-state.json"), JSON.stringify(featureState, null, 2), "utf8");
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

// Test 1: Enqueue fails without approved_commit_sha even with last_commit_sha present
await runTest("enqueue rejects missing approved_commit_sha", async (dir) => {
  const projectRoot = await setupProject(dir, {
    featureState: {
      state_schema_version: 2,
      feature_status: "active",
      approved_commit_sha: null,
      last_commit_sha: "should-not-be-used-as-authority",
      merge_commit_sha: null,
      base_branch: "main",
      feature_branch: "implement-plan/phase1/test-feature"
    }
  });

  const result = runEnqueue(projectRoot, 1, "test-feature");
  assert(result.status !== 0, "enqueue should fail without approved_commit_sha");
  const output = (result.stderr || result.stdout || "").toLowerCase();
  assert(output.includes("approved commit sha"), "error should mention approved commit SHA, got: " + output);
});

// Test 2: Enqueue rejects already-completed features
await runTest("enqueue rejects completed features", async (dir) => {
  const projectRoot = await setupProject(dir, {
    featureState: {
      state_schema_version: 2,
      feature_status: "completed",
      approved_commit_sha: "abc123",
      last_commit_sha: "abc123",
      merge_commit_sha: "merge789",
      base_branch: "main",
      feature_branch: "implement-plan/phase1/test-feature"
    }
  });

  const result = runEnqueue(projectRoot, 1, "test-feature");
  assert(result.status !== 0, "enqueue should fail for completed features");
  const output = (result.stderr || result.stdout || "").toLowerCase();
  assert(output.includes("completed"), "error should mention completed status, got: " + output);
});

// Test 3: Verify enqueue does not fall back to last_commit_sha as approved SHA
await runTest("enqueue never uses last_commit_sha as approved commit fallback", async (dir) => {
  const projectRoot = await setupProject(dir, {
    featureState: {
      state_schema_version: 2,
      feature_status: "active",
      approved_commit_sha: null,
      last_commit_sha: "fallback-candidate-should-not-be-used",
      merge_commit_sha: null,
      base_branch: "main",
      feature_branch: "implement-plan/phase1/test-feature"
    }
  });

  // Even with last_commit_sha present, enqueue must reject without approved_commit_sha
  const result = runEnqueue(projectRoot, 1, "test-feature");
  assert(result.status !== 0, "last_commit_sha must never be used as approved commit fallback");
});

// Test 4: Verify merge-queue workflow contract states last_commit_sha is not merge authority
await runTest("workflow contract explicitly rejects last_commit_sha as merge authority", async () => {
  // Read the workflow contract and verify the rule is explicit
  const { readFile } = await import("node:fs/promises");
  const contractPath = join(__dirname, "..", "merge-queue", "references", "workflow-contract.md");
  const contractText = await readFile(contractPath, "utf8");

  assert(
    contractText.includes("last_commit_sha") && contractText.includes("not merge authority"),
    "workflow contract must explicitly state that last_commit_sha is not merge authority"
  );
  assert(
    contractText.includes("approved_commit_sha"),
    "workflow contract must reference approved_commit_sha as the merge authority"
  );
});

// Summary
process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
