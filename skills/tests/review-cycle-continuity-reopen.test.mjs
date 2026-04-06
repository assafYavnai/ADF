#!/usr/bin/env node

/**
 * Targeted tests for review-cycle fix-cycle continuity and reopen guardrail contract.
 *
 * Validates that the review-cycle SKILL.md and workflow-contract.md contain
 * the required fix-cycle continuity and reopen guardrail rules.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const skillRoot = join(__dirname, "..", "review-cycle");

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

// Test 1: SKILL.md contains fix-cycle continuity rule
await runTest("SKILL.md contains fix-cycle continuity rule", async () => {
  const text = await readFile(join(skillRoot, "SKILL.md"), "utf8");
  assert(text.includes("Fix-cycle continuity rule"), "SKILL.md should contain 'Fix-cycle continuity rule' heading");
  assert(text.includes("reuse the same implementor execution"), "SKILL.md should state that fix cycles reuse the same implementor execution");
  assert(text.includes("do not send a fresh long implementation prompt"), "SKILL.md should state that fix cycles do not send a fresh long implementation prompt");
  assert(text.includes("rejected findings or report artifact paths plus a short fix instruction"), "SKILL.md should state that fix cycles send only rejected findings plus a short fix instruction");
});

// Test 2: SKILL.md contains reopen guardrail rule
await runTest("SKILL.md contains reopen guardrail rule", async () => {
  const text = await readFile(join(skillRoot, "SKILL.md"), "utf8");
  assert(text.includes("Reopen guardrail rule"), "SKILL.md should contain 'Reopen guardrail rule' heading");
  assert(text.includes("new diffs"), "SKILL.md should require new diffs or explicit reopen request");
  assert(text.includes("explicitly requests a reopen"), "SKILL.md should mention explicit reopen request as override");
});

// Test 3: workflow-contract.md contains fix-cycle continuity contract
await runTest("workflow-contract.md contains fix-cycle continuity contract", async () => {
  const text = await readFile(join(skillRoot, "references", "workflow-contract.md"), "utf8");
  assert(text.includes("Fix-cycle continuity contract"), "workflow-contract.md should contain 'Fix-cycle continuity contract' heading");
  assert(text.includes("reuse the same implementor execution"), "workflow-contract.md should state fix-cycle continuity rule");
  assert(text.includes("do not send a fresh long implementation prompt"), "workflow-contract.md should prohibit fresh long prompts in fix cycles");
  assert(text.includes("only the delta work"), "workflow-contract.md should state implementor receives only the delta");
});

// Test 4: workflow-contract.md contains reopen guardrail contract
await runTest("workflow-contract.md contains reopen guardrail contract", async () => {
  const text = await readFile(join(skillRoot, "references", "workflow-contract.md"), "utf8");
  assert(text.includes("Reopen guardrail contract"), "workflow-contract.md should contain 'Reopen guardrail contract' heading");
  assert(text.includes("new diffs on the feature branch"), "workflow-contract.md should require new diffs for reopen");
  assert(text.includes("explicitly requests a reopen"), "workflow-contract.md should mention explicit reopen override");
  assert(text.includes("do not start a new audit or review pass"), "workflow-contract.md should prohibit new pass without changes");
});

// Summary
process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
