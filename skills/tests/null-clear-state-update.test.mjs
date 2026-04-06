#!/usr/bin/env node

/**
 * Targeted tests for CLI-driven null-clear of nullable state fields.
 *
 * Validates that:
 * - update-state --last-commit-sha '' clears the field to null (not "true")
 * - update-state --last-commit-sha '' does not corrupt other state fields
 * - parseArgs preserves empty-string values instead of treating them as boolean flags
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
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
  "null-clear-test-" + randomUUID()
);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion failed: " + message);
  }
}

async function setupFeature(testDir, { state }) {
  const featureRoot = join(testDir, "docs", "phase1", "test-feature");
  await mkdir(featureRoot, { recursive: true });
  await mkdir(join(testDir, ".codex", "implement-plan", "locks", "features"), { recursive: true });
  if (state !== undefined) {
    await writeFile(join(featureRoot, "implement-plan-state.json"), JSON.stringify(state, null, 2), "utf8");
  }
  return testDir;
}

function runUpdateState(projectRoot, phaseNumber, featureSlug, extraArgs = []) {
  const result = spawnSync("node", [
    helperPath,
    "update-state",
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

// Test 1: update-state --last-commit-sha '' clears to null
await runTest("update-state clears last_commit_sha to null with empty string", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: {
      state_schema_version: 2,
      feature_status: "active",
      approved_commit_sha: "abc123",
      last_commit_sha: "stale-value-should-be-cleared",
      merge_commit_sha: null
    }
  });

  const result = runUpdateState(projectRoot, 1, "test-feature", ["--last-commit-sha", ""]);
  assert(result.status === 0, "update-state should succeed, got: " + (result.stderr || result.stdout || "unknown"));

  const stateAfter = JSON.parse(await readFile(join(projectRoot, "docs", "phase1", "test-feature", "implement-plan-state.json"), "utf8"));
  assert(stateAfter.last_commit_sha === null, "last_commit_sha should be null after clearing, got: " + JSON.stringify(stateAfter.last_commit_sha));
});

// Test 2: update-state --last-commit-sha '' does not corrupt approved_commit_sha
await runTest("null-clear does not corrupt other state fields", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: {
      state_schema_version: 2,
      feature_status: "active",
      approved_commit_sha: "abc123",
      last_commit_sha: "stale-value",
      merge_commit_sha: null
    }
  });

  const result = runUpdateState(projectRoot, 1, "test-feature", ["--last-commit-sha", ""]);
  assert(result.status === 0, "update-state should succeed");

  const stateAfter = JSON.parse(await readFile(join(projectRoot, "docs", "phase1", "test-feature", "implement-plan-state.json"), "utf8"));
  assert(stateAfter.approved_commit_sha === "abc123", "approved_commit_sha should be preserved, got: " + JSON.stringify(stateAfter.approved_commit_sha));
  assert(stateAfter.feature_status === "active", "feature_status should be preserved");
});

// Test 3: update-state with non-empty --last-commit-sha sets the value
await runTest("update-state sets last_commit_sha with non-empty value", async (dir) => {
  const projectRoot = await setupFeature(dir, {
    state: {
      state_schema_version: 2,
      feature_status: "active",
      approved_commit_sha: "abc123",
      last_commit_sha: null,
      merge_commit_sha: null
    }
  });

  const result = runUpdateState(projectRoot, 1, "test-feature", ["--last-commit-sha", "deadbeef123"]);
  assert(result.status === 0, "update-state should succeed");

  const stateAfter = JSON.parse(await readFile(join(projectRoot, "docs", "phase1", "test-feature", "implement-plan-state.json"), "utf8"));
  assert(stateAfter.last_commit_sha === "deadbeef123", "last_commit_sha should be set, got: " + JSON.stringify(stateAfter.last_commit_sha));
});

// Summary
process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
