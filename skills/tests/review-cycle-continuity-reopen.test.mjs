#!/usr/bin/env node

/**
 * Targeted tests for review-cycle fix-cycle continuity and reopen guardrail contract.
 *
 * Validates that the review-cycle SKILL.md and workflow-contract.md contain
 * the required fix-cycle continuity and reopen guardrail rules.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const skillRoot = join(__dirname, "..", "review-cycle");
const helperPath = join(skillRoot, "scripts", "review-cycle-helper.mjs");
const testRoot = join(
  process.env.TEMP || process.env.TMPDIR || "/tmp",
  "review-cycle-reopen-test-" + randomUUID()
);

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

// Behavioral tests requiring a temp git repo

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true, timeout: 15000 });
  if (result.status !== 0) {
    throw new Error("git " + args.join(" ") + " failed: " + (result.stderr || result.stdout || "unknown"));
  }
  return (result.stdout || "").trim();
}

function runPrepare(repoRoot, phaseNumber, featureSlug, taskSummary, extraArgs = []) {
  const result = spawnSync("node", [
    helperPath,
    "prepare",
    "--phase-number", String(phaseNumber),
    "--feature-slug", featureSlug,
    "--task-summary", taskSummary,
    "--repo-root", repoRoot,
    ...extraArgs
  ], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });
  return result;
}

async function setupApprovedCycle(testDir) {
  const featureRoot = join(testDir, "docs", "phase1", "test-feature");
  const cycleDir = join(featureRoot, "cycle-01");
  await mkdir(cycleDir, { recursive: true });

  // Write valid cycle artifacts for a completed approved cycle
  for (const artifact of ["audit-findings.md", "review-findings.md", "fix-plan.md", "fix-report.md"]) {
    await writeFile(join(cycleDir, artifact), "# " + artifact + "\nDone.\n", "utf8");
  }

  // Commit the cycle artifacts
  git(testDir, ["add", "."]);
  git(testDir, ["commit", "-m", "approved cycle"]);

  // Write the state AFTER the commit, pointing at HEAD
  // The state file is a dirty working-copy file, matching real workflow where
  // state is updated by the helper after the last push.
  const approvedCommitSha = git(testDir, ["rev-parse", "HEAD"]);
  await writeFile(join(featureRoot, "review-cycle-state.json"), JSON.stringify({
    phase_number: 1,
    feature_slug: "test-feature",
    repo_root: testDir.replace(/\\/g, "/"),
    feature_agent_registry_key: "phase1/test-feature",
    last_completed_cycle: 1,
    last_commit_sha: approvedCommitSha,
    active_cycle_number: 1,
    cycle_runtime: null,
    split_review_continuity: { mode: "full_pair" },
    implementor_execution_id: "cached-impl-001",
    implementor_execution_access_mode: "claude_code_skip_permissions",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, null, 2), "utf8");

  return testDir;
}

// Test 5: Behavioral - approved stream with no new diffs returns approved_no_new_diffs
await (async () => {
  const testDir = join(testRoot, "no-new-diffs");
  await mkdir(testDir, { recursive: true });
  git(testDir, ["init"]);
  git(testDir, ["commit", "--allow-empty", "-m", "init"]);

  try {
    await setupApprovedCycle(testDir);

    const result = runPrepare(testDir, 1, "test-feature", "Check the route.");
    assert(result.status === 0, "prepare should succeed, got: " + result.stderr);
    const output = JSON.parse(result.stdout.trim());
    assert(
      output.cycle?.mode === "approved_no_new_diffs",
      "cycle mode should be approved_no_new_diffs when no new diffs exist, got: " + (output.cycle?.mode ?? "missing")
    );
    passed += 1;
    process.stdout.write("PASS: behavioral - approved stream with no new diffs stops\n");
  } catch (error) {
    failed += 1;
    process.stderr.write("FAIL: behavioral - approved stream with no new diffs stops\n  " + (error.stack ?? error.message ?? String(error)) + "\n");
  }
})();

// Test 6: Behavioral - approved stream with explicit reopen proceeds
await (async () => {
  const testDir = join(testRoot, "explicit-reopen");
  await mkdir(testDir, { recursive: true });
  git(testDir, ["init"]);
  git(testDir, ["commit", "--allow-empty", "-m", "init"]);

  try {
    await setupApprovedCycle(testDir);

    const result = runPrepare(testDir, 1, "test-feature", "Check the route.", ["--explicit-reopen", "true"]);
    assert(result.status === 0, "prepare should succeed, got: " + result.stderr);
    const output = JSON.parse(result.stdout.trim());
    assert(
      output.cycle?.mode === "new",
      "cycle mode should be new when explicit reopen is set, got: " + (output.cycle?.mode ?? "missing")
    );
    passed += 1;
    process.stdout.write("PASS: behavioral - explicit reopen proceeds\n");
  } catch (error) {
    failed += 1;
    process.stderr.write("FAIL: behavioral - explicit reopen proceeds\n  " + (error.stack ?? error.message ?? String(error)) + "\n");
  }
})();

// Test 7: Behavioral - approved stream with new commits reopens
await (async () => {
  const testDir = join(testRoot, "new-diffs-reopen");
  await mkdir(testDir, { recursive: true });
  git(testDir, ["init"]);
  git(testDir, ["commit", "--allow-empty", "-m", "init"]);

  try {
    await setupApprovedCycle(testDir);
    // Add a new commit after the approved cycle
    git(testDir, ["commit", "--allow-empty", "-m", "new work after approval"]);

    const result = runPrepare(testDir, 1, "test-feature", "Check the route.");
    assert(result.status === 0, "prepare should succeed, got: " + result.stderr);
    const output = JSON.parse(result.stdout.trim());
    assert(
      output.cycle?.mode === "new",
      "cycle mode should be new when there are new diffs, got: " + (output.cycle?.mode ?? "missing")
    );
    passed += 1;
    process.stdout.write("PASS: behavioral - new diffs after approval reopens\n");
  } catch (error) {
    failed += 1;
    process.stderr.write("FAIL: behavioral - new diffs after approval reopens\n  " + (error.stack ?? error.message ?? String(error)) + "\n");
  }
})();

// Test 8: Behavioral - fix-cycle continuity: implementor_execution_id preserved across cycles
await (async () => {
  const testDir = join(testRoot, "implementor-continuity");
  await mkdir(testDir, { recursive: true });
  git(testDir, ["init"]);
  git(testDir, ["commit", "--allow-empty", "-m", "init"]);

  try {
    await setupApprovedCycle(testDir);
    git(testDir, ["commit", "--allow-empty", "-m", "new work"]);

    const result = runPrepare(testDir, 1, "test-feature", "Fix the rejected findings.", ["--explicit-reopen", "true"]);
    assert(result.status === 0, "prepare should succeed, got: " + result.stderr);
    const output = JSON.parse(result.stdout.trim());
    assert(
      output.reviewer_state?.implementor_execution_id === "cached-impl-001",
      "implementor_execution_id should be preserved from prior cycle state, got: " + (output.reviewer_state?.implementor_execution_id ?? "missing")
    );
    passed += 1;
    process.stdout.write("PASS: behavioral - implementor_execution_id preserved across cycles\n");
  } catch (error) {
    failed += 1;
    process.stderr.write("FAIL: behavioral - implementor_execution_id preserved across cycles\n  " + (error.stack ?? error.message ?? String(error)) + "\n");
  }
})();

// Summary
process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
