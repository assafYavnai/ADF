#!/usr/bin/env node

/**
 * Targeted tests for implement-plan authoritative requirement-freeze guard.
 *
 * Validates that the implement-plan SKILL.md and workflow-contract.md contain
 * the required authoritative requirement-freeze guard rules.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const skillRoot = join(__dirname, "..", "implement-plan");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion failed: " + message);
  }
}

async function runTest(name, fn) {
  try {
    await fn();
    passed += 1;
    process.stdout.write("PASS: " + name + "\n");
  } catch (error) {
    failed += 1;
    process.stderr.write("FAIL: " + name + "\n  " + (error.stack ?? error.message ?? String(error)) + "\n");
  }
}

// Test 1: SKILL.md contains authoritative requirement-freeze guard
await runTest("SKILL.md contains authoritative requirement-freeze guard", async () => {
  const text = await readFile(join(skillRoot, "SKILL.md"), "utf8");
  assert(text.includes("Authoritative requirement-freeze guard"), "SKILL.md should contain 'Authoritative requirement-freeze guard' heading");
  assert(text.includes("independent authoritative requirement introduction"), "SKILL.md should state the guard protects against independent requirement introduction");
  assert(text.includes("base branch"), "SKILL.md should mention base branch divergence detection");
  assert(text.includes("pushback"), "SKILL.md should mention pushback as the response to divergence");
  assert(text.includes("feature-branch-internal"), "SKILL.md should clarify that feature-branch-internal changes are not blocked");
});

// Test 2: workflow-contract.md contains authoritative requirement-freeze guard
await runTest("workflow-contract.md contains authoritative requirement-freeze guard", async () => {
  const text = await readFile(join(skillRoot, "references", "workflow-contract.md"), "utf8");
  assert(text.includes("Authoritative Requirement-Freeze Guard"), "workflow-contract.md should contain 'Authoritative Requirement-Freeze Guard' heading");
  assert(text.includes("merge-base"), "workflow-contract.md should mention merge-base comparison");
  assert(text.includes("authority files"), "workflow-contract.md should mention authority files");
  assert(text.includes("pushback"), "workflow-contract.md should mention pushback for divergence");
  assert(text.includes("does not require the invoker to rebase"), "workflow-contract.md should clarify rebase is not required");
});

// Test 3: SKILL.md requirement-freeze guard does not block feature-branch-internal changes
await runTest("requirement-freeze guard does not block feature-branch-internal changes", async () => {
  const text = await readFile(join(skillRoot, "SKILL.md"), "utf8");
  assert(
    text.includes("does not block feature-branch-internal authority file updates that are part of the slice itself"),
    "SKILL.md should explicitly exempt feature-branch-internal authority file updates"
  );
});

// Test 4: workflow-contract.md requirement-freeze guard specifies refresh path
await runTest("workflow-contract.md specifies refresh path to clear guard", async () => {
  const text = await readFile(join(skillRoot, "references", "workflow-contract.md"), "utf8");
  assert(
    text.includes("refreshes the contract") || text.includes("refresh the contract"),
    "workflow-contract.md should specify that refreshing the contract clears the guard"
  );
});

// Summary
process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
