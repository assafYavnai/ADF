#!/usr/bin/env node

/**
 * Targeted tests for implement-plan authoritative requirement-freeze guard.
 *
 * Validates that the implement-plan SKILL.md and workflow-contract.md contain
 * the required authoritative requirement-freeze guard rules.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const skillRoot = join(__dirname, "..", "implement-plan");
const helperPath = join(skillRoot, "scripts", "implement-plan-helper.mjs");
const testRoot = join(
  process.env.TEMP || process.env.TMPDIR || "/tmp",
  "requirement-freeze-guard-test-" + randomUUID()
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

// Behavioral tests requiring a temp git repo

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true, timeout: 15000 });
  if (result.status !== 0) {
    throw new Error("git " + args.join(" ") + " failed: " + (result.stderr || result.stdout || "unknown"));
  }
  return (result.stdout || "").trim();
}

function runPrepare(projectRoot, phaseNumber, featureSlug, taskSummary, extraArgs = []) {
  return spawnSync("node", [
    helperPath,
    "prepare",
    "--project-root", projectRoot,
    "--phase-number", String(phaseNumber),
    "--feature-slug", featureSlug,
    "--task-summary", taskSummary,
    "--run-mode", "benchmarking",
    ...extraArgs
  ], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });
}

// Test 5: Behavioral - prepare pushes back when frozen authority file changed on base branch
await (async () => {
  const testDir = join(testRoot, "authority-divergence");
  await mkdir(testDir, { recursive: true });
  git(testDir, ["init", "-b", "main"]);
  git(testDir, ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "--allow-empty", "-m", "init"]);

  try {
    // Create a shared authority file and commit on main
    const docsDir = join(testDir, "docs");
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, "VISION.md"), "# Vision\nOriginal content.\n", "utf8");
    git(testDir, ["add", "."]);
    git(testDir, ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "add vision"]);

    // Create the feature branch
    git(testDir, ["checkout", "-b", "implement-plan/phase1/test-feature"]);

    // Create feature artifacts with a brief that references VISION.md
    const featureRoot = join(testDir, "docs", "phase1", "test-feature");
    await mkdir(featureRoot, { recursive: true });
    await writeFile(join(featureRoot, "README.md"), "# test-feature\nTest.\n", "utf8");
    await writeFile(join(featureRoot, "context.md"), "# Context\nTest context.\n- scope: test\n- non-goal: none\n- deliverable: test output\n- forbidden edits: none\n- acceptance: verification\n- constraint: bounded\n- slice: minimal\n", "utf8");
    const briefContent = `1. Implementation Objective
Test.

2. Exact Slice Scope
Test.

3. Inputs / Authorities Read
- ${testDir.replace(/\\/g, "/")}/docs/VISION.md

4. Required Deliverables
Test output.

5. Forbidden Edits
None.

6. Integrity-Verified Assumptions Only
Test.

7. Explicit Non-Goals
None.

8. Proof / Verification Expectations
Machine Verification Plan: node --check
Human Verification Plan: Required: false

9. Required Artifact Updates
None.

10. Closeout Rules
Human testing: not required.
`;
    await writeFile(join(featureRoot, "implement-plan-brief.md"), briefContent, "utf8");

    // Create minimal state
    await writeFile(join(featureRoot, "implement-plan-state.json"), JSON.stringify({
      state_schema_version: 2,
      feature_status: "active",
      base_branch: "main",
      feature_branch: "implement-plan/phase1/test-feature",
      project_root: testDir.replace(/\\/g, "/"),
      worktree_path: testDir.replace(/\\/g, "/")
    }, null, 2), "utf8");

    git(testDir, ["add", "."]);
    git(testDir, ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "feature artifacts"]);

    // Go back to main and change the authority file
    git(testDir, ["checkout", "main"]);
    await writeFile(join(docsDir, "VISION.md"), "# Vision\nChanged after feature branch.\n", "utf8");
    git(testDir, ["add", "."]);
    git(testDir, ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "change vision on main"]);

    // Go back to feature branch and run prepare
    git(testDir, ["checkout", "implement-plan/phase1/test-feature"]);

    const result = runPrepare(testDir, 1, "test-feature", "Test the authority freeze guard. Scope: bounded slice. Non-goal: none. Deliverable: test. Acceptance: verification.");
    assert(result.status === 0, "prepare should succeed (exits 0), got: " + result.stderr);
    const output = JSON.parse(result.stdout.trim());
    const hasAuthorityFreezeIssue = (output.integrity_precheck?.blocking_issues ?? []).some(
      (issue) => issue.issue_class === "authority-freeze-divergence"
    );
    assert(hasAuthorityFreezeIssue, "prepare should produce authority-freeze-divergence blocking issue when frozen authority changed on base, got issues: " + JSON.stringify(output.integrity_precheck?.blocking_issues ?? []));

    passed += 1;
    process.stdout.write("PASS: behavioral - prepare pushes back on authority divergence\n");
  } catch (error) {
    failed += 1;
    process.stderr.write("FAIL: behavioral - prepare pushes back on authority divergence\n  " + (error.stack ?? error.message ?? String(error)) + "\n");
  }
})();

// Test 6: Behavioral - prepare proceeds when base branch authority is unchanged
await (async () => {
  const testDir = join(testRoot, "authority-unchanged");
  await mkdir(testDir, { recursive: true });
  git(testDir, ["init", "-b", "main"]);
  git(testDir, ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "--allow-empty", "-m", "init"]);

  try {
    const docsDir = join(testDir, "docs");
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, "VISION.md"), "# Vision\nOriginal.\n", "utf8");
    git(testDir, ["add", "."]);
    git(testDir, ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "add vision"]);

    git(testDir, ["checkout", "-b", "implement-plan/phase1/test-feature2"]);

    const featureRoot = join(testDir, "docs", "phase1", "test-feature2");
    await mkdir(featureRoot, { recursive: true });
    await writeFile(join(featureRoot, "README.md"), "# test-feature2\nTest.\n", "utf8");
    await writeFile(join(featureRoot, "context.md"), "# Context\nTest. scope bounded. non-goal none. deliverable: test. acceptance: verification. constraint: test. slice: bounded.\n", "utf8");
    const briefContent = `1. Implementation Objective
Test.

2. Exact Slice Scope
Bounded test slice.

3. Inputs / Authorities Read
- ${testDir.replace(/\\/g, "/")}/docs/VISION.md

4. Required Deliverables
Test output.

5. Forbidden Edits
None.

6. Integrity-Verified Assumptions Only
Test.

7. Explicit Non-Goals
None.

8. Proof / Verification Expectations
Machine Verification Plan: node --check
Human Verification Plan: Required: false

9. Required Artifact Updates
None.

10. Closeout Rules
Human testing: not required.
`;
    await writeFile(join(featureRoot, "implement-plan-brief.md"), briefContent, "utf8");
    await writeFile(join(featureRoot, "implement-plan-state.json"), JSON.stringify({
      state_schema_version: 2,
      feature_status: "active",
      base_branch: "main",
      feature_branch: "implement-plan/phase1/test-feature2",
      project_root: testDir.replace(/\\/g, "/"),
      worktree_path: testDir.replace(/\\/g, "/")
    }, null, 2), "utf8");

    git(testDir, ["add", "."]);
    git(testDir, ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "feature artifacts"]);

    // Do NOT change VISION.md on main — base branch is unchanged
    const result = runPrepare(testDir, 1, "test-feature2", "Test unchanged authority. Scope: bounded. Non-goal: none. Deliverable: test. Acceptance: verification.");
    assert(result.status === 0, "prepare should succeed, got: " + result.stderr);
    const output = JSON.parse(result.stdout.trim());
    const hasAuthorityFreezeIssue = (output.integrity_precheck?.blocking_issues ?? []).some(
      (issue) => issue.issue_class === "authority-freeze-divergence"
    );
    assert(!hasAuthorityFreezeIssue, "prepare should NOT produce authority-freeze-divergence when base is unchanged");

    passed += 1;
    process.stdout.write("PASS: behavioral - prepare proceeds when authority unchanged\n");
  } catch (error) {
    failed += 1;
    process.stderr.write("FAIL: behavioral - prepare proceeds when authority unchanged\n  " + (error.stack ?? error.message ?? String(error)) + "\n");
  }
})();

// Test 7: Behavioral - contract-only authority freeze (no brief) detects divergence
await (async () => {
  const testDir = join(testRoot, "contract-only-divergence");
  await mkdir(testDir, { recursive: true });
  git(testDir, ["init", "-b", "main"]);
  git(testDir, ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "--allow-empty", "-m", "init"]);

  try {
    const docsDir = join(testDir, "docs");
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, "VISION.md"), "# Vision\nOriginal.\n", "utf8");
    git(testDir, ["add", "."]);
    git(testDir, ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "add vision"]);

    git(testDir, ["checkout", "-b", "implement-plan/phase1/test-contract-only"]);

    const featureRoot = join(testDir, "docs", "phase1", "test-contract-only");
    await mkdir(featureRoot, { recursive: true });
    await writeFile(join(featureRoot, "README.md"), "# test\nTest.\n", "utf8");
    await writeFile(join(featureRoot, "context.md"), "# Context\nscope bounded. non-goal none. deliverable t. acceptance verification. constraint t. slice bounded.\n", "utf8");
    // Contract with Source Authorities section referencing VISION.md — NO brief
    const contractContent = `## 1. Implementation Objective
Test.

## 2. Slice Scope
Test.

## 3. Required Deliverables
Test.

## 4. Allowed Edits
Test.

## 5. Forbidden Edits
None.

## 6. Acceptance Gates
Machine Verification Plan: test
Human Verification Plan: Required: false
KPI Applicability: not required
KPI Non-Applicability Rationale: test
Vision Compatibility: compatible
Phase 1 Compatibility: compatible
Master-Plan Compatibility: compatible
Current Gap-Closure Compatibility: compatible
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: test

## 7. Observability / Audit
None.

## 8. Dependencies / Constraints
None.

## 9. Non-Goals
None.

## 10. Source Authorities
- ${testDir.replace(/\\/g, "/")}/docs/VISION.md
`;
    await writeFile(join(featureRoot, "implement-plan-contract.md"), contractContent, "utf8");
    await writeFile(join(featureRoot, "implement-plan-state.json"), JSON.stringify({
      state_schema_version: 2,
      feature_status: "active",
      base_branch: "main",
      feature_branch: "implement-plan/phase1/test-contract-only",
      project_root: testDir.replace(/\\/g, "/"),
      worktree_path: testDir.replace(/\\/g, "/")
    }, null, 2), "utf8");

    git(testDir, ["add", "."]);
    git(testDir, ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "feature"]);

    git(testDir, ["checkout", "main"]);
    await writeFile(join(docsDir, "VISION.md"), "# Vision\nChanged on main.\n", "utf8");
    git(testDir, ["add", "."]);
    git(testDir, ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "change"]);

    git(testDir, ["checkout", "implement-plan/phase1/test-contract-only"]);

    const result = runPrepare(testDir, 1, "test-contract-only", "Test contract-only. Scope bounded. Non-goal none. Deliverable t. Acceptance verification.");
    assert(result.status === 0, "prepare should succeed (exits 0), got: " + result.stderr);
    const output = JSON.parse(result.stdout.trim());
    const hasIssue = (output.integrity_precheck?.blocking_issues ?? []).some(
      (i) => i.issue_class === "authority-freeze-divergence"
    );
    assert(hasIssue, "prepare should detect authority divergence from contract Source Authorities, got issues: " + JSON.stringify(output.integrity_precheck?.blocking_issues?.map(i => i.issue_class) ?? []));

    passed += 1;
    process.stdout.write("PASS: behavioral - contract-only authority freeze detects divergence\n");
  } catch (error) {
    failed += 1;
    process.stderr.write("FAIL: behavioral - contract-only authority freeze detects divergence\n  " + (error.stack ?? error.message ?? String(error)) + "\n");
  }
})();

// Summary
process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
