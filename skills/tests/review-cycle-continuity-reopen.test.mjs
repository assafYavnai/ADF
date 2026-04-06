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

  // Write valid cycle artifacts with required headings for a completed approved cycle
  await writeFile(join(cycleDir, "audit-findings.md"), "1. Findings\nNone.\n\n2. Conceptual Root Cause\nNone.\n\n3. High-Level View Of System Routes That Still Need Work\nNone.\n", "utf8");
  await writeFile(join(cycleDir, "review-findings.md"), "1. Closure Verdicts\nAll closed.\n\n2. Remaining Root Cause\nNone.\n\n3. Next Minimal Fix Pass\nNone.\n", "utf8");
  await writeFile(join(cycleDir, "fix-plan.md"), "1. Failure Classes\nNone.\n\n2. Route Contracts\nNone.\n\n3. Sweep Scope\nNone.\n\n4. Planned Changes\nNone.\n\n5. Closure Proof\nNone.\n\n6. Non-Goals\nNone.\n", "utf8");
  await writeFile(join(cycleDir, "fix-report.md"), "1. Failure Classes Closed\nAll.\n\n2. Route Contracts Now Enforced\nAll.\n\n3. Files Changed And Why\nNone.\n\n4. Sibling Sites Checked\nNone.\n\n5. Proof Of Closure\nAll passed.\n\n6. Remaining Debt / Non-Goals\nNone.\n\n7. Next Cycle Starting Point\nDone.\n", "utf8");

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
    assert(
      output.detected_status_summary?.next_action === "approved_no_new_diffs_hold",
      "next_action should be approved_no_new_diffs_hold, got: " + (output.detected_status_summary?.next_action ?? "missing")
    );
    assert(
      typeof output.reopen_blocked_reason === "string" && output.reopen_blocked_reason.length > 0,
      "reopen_blocked_reason should be present"
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

// Test 9: Behavioral - fix_cycle_dispatch_mode is fresh for new cycles
await (async () => {
  const testDir = join(testRoot, "dispatch-mode-fresh");
  await mkdir(testDir, { recursive: true });
  git(testDir, ["init"]);
  git(testDir, ["commit", "--allow-empty", "-m", "init"]);

  try {
    // First cycle with no prior state — should be mode=new, dispatch=fresh
    const result = runPrepare(testDir, 1, "test-feature-fresh", "New review.");
    assert(result.status === 0, "prepare should succeed, got: " + result.stderr);
    const output = JSON.parse(result.stdout.trim());
    assert(output.fix_cycle_dispatch_mode === "fresh", "fix_cycle_dispatch_mode should be fresh for a new cycle, got: " + (output.fix_cycle_dispatch_mode ?? "missing"));
    passed += 1;
    process.stdout.write("PASS: behavioral - fix_cycle_dispatch_mode is fresh for new cycles\n");
  } catch (error) {
    failed += 1;
    process.stderr.write("FAIL: behavioral - fix_cycle_dispatch_mode is fresh for new cycles\n  " + (error.stack ?? error.message ?? String(error)) + "\n");
  }
})();

// Test 10: Behavioral - corrupt anchor SHA fails open (allows reopen, not blocks)
await (async () => {
  const testDir = join(testRoot, "corrupt-anchor");
  await mkdir(testDir, { recursive: true });
  git(testDir, ["init"]);
  git(testDir, ["commit", "--allow-empty", "-m", "init"]);

  try {
    await setupApprovedCycle(testDir);

    // Corrupt the anchor SHA in state
    const featureRoot = join(testDir, "docs", "phase1", "test-feature");
    const stateData = JSON.parse(await readFile(join(featureRoot, "review-cycle-state.json"), "utf8"));
    stateData.last_commit_sha = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    await writeFile(join(featureRoot, "review-cycle-state.json"), JSON.stringify(stateData, null, 2), "utf8");

    const result = runPrepare(testDir, 1, "test-feature", "Check the route after corruption.");
    assert(result.status === 0, "prepare should succeed, got: " + result.stderr);
    const output = JSON.parse(result.stdout.trim());
    // Corrupt anchor should fail open — allow reopen, not block as no-new-diffs
    assert(
      output.cycle?.mode !== "approved_no_new_diffs",
      "cycle mode should NOT be approved_no_new_diffs with corrupt anchor, got: " + (output.cycle?.mode ?? "missing")
    );
    passed += 1;
    process.stdout.write("PASS: behavioral - corrupt anchor SHA fails open (allows reopen)\n");
  } catch (error) {
    failed += 1;
    process.stderr.write("FAIL: behavioral - corrupt anchor SHA fails open (allows reopen)\n  " + (error.stack ?? error.message ?? String(error)) + "\n");
  }
})();

// Test 11: Behavioral - update-state rejects nonexistent SHA
await (async () => {
  const testDir = join(testRoot, "invalid-sha-update");
  await mkdir(testDir, { recursive: true });
  git(testDir, ["init"]);
  git(testDir, ["commit", "--allow-empty", "-m", "init"]);
  const featureRoot = join(testDir, "docs", "phase1", "test-feature");
  await mkdir(featureRoot, { recursive: true });
  await writeFile(join(featureRoot, "review-cycle-state.json"), JSON.stringify({
    phase_number: 1,
    feature_slug: "test-feature",
    repo_root: testDir.replace(/\\/g, "/"),
    feature_agent_registry_key: "phase1/test-feature",
    last_completed_cycle: 0,
    last_commit_sha: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, null, 2), "utf8");

  try {
    const result = spawnSync("node", [
      helperPath,
      "update-state",
      "--phase-number", "1",
      "--feature-slug", "test-feature",
      "--repo-root", testDir,
      "--last-commit-sha", "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
    ], { encoding: "utf8", windowsHide: true, timeout: 30000 });
    assert(result.status !== 0, "update-state should reject nonexistent SHA");
    assert(result.stderr.includes("does not resolve"), "error should mention SHA does not resolve, got: " + result.stderr);
    passed += 1;
    process.stdout.write("PASS: behavioral - update-state rejects nonexistent SHA\n");
  } catch (error) {
    failed += 1;
    process.stderr.write("FAIL: behavioral - update-state rejects nonexistent SHA\n  " + (error.stack ?? error.message ?? String(error)) + "\n");
  }
})();

// Summary
process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
