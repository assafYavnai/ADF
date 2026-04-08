#!/usr/bin/env node

/**
 * Targeted tests for implement-plan origin refresh hardening.
 *
 * Validates that:
 * - prepare fails closed when the local feature branch is behind origin
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const helperPath = join(__dirname, "..", "implement-plan", "scripts", "implement-plan-helper.mjs");

const testRoot = join(
  process.env.TEMP || process.env.TMPDIR || "/tmp",
  "ipor-" + randomUUID().slice(0, 8)
);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion failed: " + message);
  }
}

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });
  if (result.status !== 0) {
    throw new Error("git " + args.join(" ") + " failed: " + (result.stderr || result.stdout || "unknown"));
  }
  return (result.stdout || "").trim();
}

function runPrepare(projectRoot, phaseNumber, featureSlug, taskSummary) {
  return spawnSync("node", [
    helperPath,
    "prepare",
    "--project-root", projectRoot,
    "--phase-number", String(phaseNumber),
    "--feature-slug", featureSlug,
    "--task-summary", taskSummary,
    "--run-mode", "normal"
  ], {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000
  });
}

async function writeFeatureArtifacts(repoPath, featureSlug) {
  const featureRoot = join(repoPath, "docs", "phase1", featureSlug);
  await mkdir(featureRoot, { recursive: true });
  await writeFile(join(featureRoot, "README.md"), "# " + featureSlug + "\nBounded test slice.\n", "utf8");
  await writeFile(
    join(featureRoot, "context.md"),
    "# Context\nscope: bounded.\nnon-goal: none.\ndeliverable: guarded prepare.\nacceptance: prepare either blocks or proceeds truthfully.\nconstraint: minimal.\nslice: origin refresh.\n",
    "utf8"
  );
  await writeFile(
    join(featureRoot, "implement-plan-brief.md"),
    `1. Implementation Objective
Test origin refresh hardening.

2. Exact Slice Scope
Bounded helper proof.

3. Inputs / Authorities Read
- ${repoPath.replace(/\\/g, "/")}/docs/VISION.md

4. Required Deliverables
Targeted proof only.

5. Forbidden Edits
None.

6. Integrity-Verified Assumptions Only
Test only.

7. Explicit Non-Goals
No product changes.

8. Proof / Verification Expectations
Machine Verification Plan: node --check
Human Verification Plan: Required: false

9. Required Artifact Updates
None.

10. Closeout Rules
Human testing: not required.
`,
    "utf8"
  );
  await writeFile(
    join(featureRoot, "implement-plan-state.json"),
    JSON.stringify({
      state_schema_version: 2,
      phase_number: 1,
      feature_slug: featureSlug,
      feature_status: "active",
      base_branch: "main",
      feature_branch: "implement-plan/phase1/" + featureSlug,
      project_root: repoPath.replace(/\\/g, "/"),
      worktree_path: repoPath.replace(/\\/g, "/"),
      active_run_status: "context_ready",
      last_completed_step: "context_collected",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, null, 2),
    "utf8"
  );
}

async function runTest(name, fn) {
  const testDir = join(testRoot, "case-" + String(passed + failed + 1).padStart(2, "0"));
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

await runTest("prepare blocks when local feature branch is behind origin after refresh", async (dir) => {
  const remotePath = join(dir, "remote.git");
  const repoPath = join(dir, "repo");
  const upstreamPath = join(dir, "upstream");
  const featureSlug = "test-feature";

  await mkdir(remotePath, { recursive: true });
  git(remotePath, ["init", "--bare", "--initial-branch=main"]);
  git(dir, ["clone", remotePath, "repo"]);
  git(repoPath, ["config", "user.email", "test@test.com"]);
  git(repoPath, ["config", "user.name", "Test"]);

  await mkdir(join(repoPath, "docs"), { recursive: true });
  await writeFile(join(repoPath, "docs", "VISION.md"), "# Vision\nOriginal.\n", "utf8");
  git(repoPath, ["add", "."]);
  git(repoPath, ["commit", "-m", "initial main"]);
  git(repoPath, ["push", "-u", "origin", "main"]);

  git(repoPath, ["checkout", "-b", "implement-plan/phase1/" + featureSlug]);
  await writeFeatureArtifacts(repoPath, featureSlug);
  git(repoPath, ["add", "."]);
  git(repoPath, ["commit", "-m", "feature artifacts"]);
  git(repoPath, ["push", "-u", "origin", "implement-plan/phase1/" + featureSlug]);

  git(dir, ["clone", remotePath, "upstream"]);
  git(upstreamPath, ["config", "user.email", "test@test.com"]);
  git(upstreamPath, ["config", "user.name", "Test"]);
  git(upstreamPath, ["checkout", "implement-plan/phase1/" + featureSlug]);
  await writeFile(join(upstreamPath, "upstream-change.txt"), "origin moved ahead\n", "utf8");
  git(upstreamPath, ["add", "."]);
  git(upstreamPath, ["commit", "-m", "advance feature branch on origin"]);
  git(upstreamPath, ["push"]);

  const result = runPrepare(
    repoPath,
    1,
    featureSlug,
    "Test origin refresh hardening. Scope: bounded helper proof. Non-goal: product changes."
  );
  assert(result.status === 0, "prepare should return JSON output, got stderr: " + result.stderr);

  const output = JSON.parse(result.stdout.trim());
  const blockingIssues = output.integrity_precheck?.blocking_issues ?? [];
  const originRefreshIssue = blockingIssues.find((issue) => issue.issue_class === "origin-refresh-failed");
  const hasOriginRefreshIssue = Boolean(originRefreshIssue);
  assert(hasOriginRefreshIssue, "prepare should report origin-refresh-failed, got: " + JSON.stringify(blockingIssues));
  assert(
    (originRefreshIssue?.required_repair || "").includes("behind origin/implement-plan/phase1/" + featureSlug),
    "origin-refresh-failed should explain that the local feature branch is behind origin"
  );
  assert(
    (output.state?.active_run_status ?? output.active_run_status) === "integrity_failed",
    "prepare should fail closed at integrity_failed"
  );
});

process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
