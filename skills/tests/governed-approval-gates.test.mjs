#!/usr/bin/env node

/**
 * Targeted tests for governed approval truth hardening.
 *
 * Validates that:
 * - required human verification blocks pre-merge readiness when no durable state exists
 * - split review verdicts cannot be promoted to merge-ready truth
 * - changing approved_commit_sha after human approval stales the prior approval
 * - mark-complete fails when the human approval is stale
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
  "governed-approval-gates-test-" + randomUUID()
);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion failed: " + message);
  }
}

function runHelper(args, cwd) {
  const result = spawnSync("node", [helperPath, ...args], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });
  return {
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim()
  };
}

function parseJson(result) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

const VALID_COMPLETION = `1. Objective Completed
Done.

2. Deliverables Produced
Done.

3. Files Changed And Why
Done.

4. Verification Evidence
Machine Verification: passed.
Human Verification Requirement: required.
Human Verification Status: pending.
Review-Cycle Status: pending.
Merge Status: pending.
Local Target Sync Status: pending.

5. Feature Artifacts Updated
Done.

6. Commit And Push Result
Done.

7. Remaining Non-Goals / Debt
None.
`;

const HUMAN_REQUIRED_CONTRACT = `1. Implementation Objective

Test.

2. Slice Scope

Test.

3. Required Deliverables

Test.

4. Allowed Edits

Test.

5. Forbidden Edits

Test.

6. Acceptance Gates

Machine Verification Plan:
- test

Human Verification Plan:
Required: true

7. Observability / Audit

Test.

8. Dependencies / Constraints

Test.

9. Non-Goals

Test.

10. Source Authorities

Test.
`;

const HUMAN_NOT_REQUIRED_CONTRACT = HUMAN_REQUIRED_CONTRACT.replace("Required: true", "Required: false");

function buildReviewState({ auditor = "approve", reviewer = "approve", status = "completed" } = {}) {
  return {
    phase_number: 1,
    feature_slug: "test-feature",
    cycle_runtime: {
      cycle_number: 1,
      cycle_name: "cycle-01",
      status,
      lane_verdicts: {
        auditor,
        reviewer
      }
    },
    last_completed_cycle: 1,
    active_cycle_number: 1
  };
}

async function setupFeature(testDir, {
  stateOverrides = {},
  contractText = HUMAN_REQUIRED_CONTRACT,
  completionText = VALID_COMPLETION,
  reviewState = buildReviewState()
} = {}) {
  const featureRoot = join(testDir, "docs", "phase1", "test-feature");
  await mkdir(featureRoot, { recursive: true });
  await mkdir(join(testDir, ".codex", "implement-plan", "locks", "features"), { recursive: true });
  await mkdir(join(testDir, ".codex", "implement-plan", "locks", "project"), { recursive: true });

  const state = {
    state_schema_version: 2,
    phase_number: 1,
    feature_slug: "test-feature",
    project_root: testDir.replace(/\\/g, "/"),
    feature_registry_key: "phase1/test-feature",
    feature_status: "active",
    approved_commit_sha: "abc123",
    merge_commit_sha: null,
    merge_queue_request_id: null,
    merge_required: true,
    merge_status: "not_ready",
    local_target_sync_status: "not_started",
    human_verification_status: null,
    human_verification_approved_at: null,
    human_verification_approved_commit_sha: null,
    last_completed_step: "verification_finished",
    last_commit_sha: null,
    active_run_status: "closeout_pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    run_timestamps: {},
    event_log: [],
    artifacts: {},
    last_error: null,
    current_run_id: null,
    current_attempt_id: null,
    execution_runs: { active_by_mode: { normal: null, benchmarking: null }, runs: {} },
    ...stateOverrides
  };

  await writeFile(join(featureRoot, "implement-plan-state.json"), JSON.stringify(state, null, 2), "utf8");
  await writeFile(join(featureRoot, "implement-plan-contract.md"), contractText, "utf8");
  await writeFile(join(featureRoot, "completion-summary.md"), completionText, "utf8");
  if (reviewState !== null) {
    await writeFile(join(featureRoot, "review-cycle-state.json"), JSON.stringify(reviewState, null, 2), "utf8");
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

await runTest("validate-closeout-readiness blocks missing durable human approval", async (dir) => {
  await setupFeature(dir, {
    stateOverrides: {
      human_verification_status: null,
      approved_commit_sha: "abc123"
    }
  });

  const result = runHelper([
    "validate-closeout-readiness",
    "--project-root", dir,
    "--phase-number", "1",
    "--feature-slug", "test-feature"
  ], dir);

  const json = parseJson(result);
  assert(json !== null, "expected JSON output");
  assert(json.closeout_ready === false, "closeout should be blocked");
  assert(
    (json.blockers || []).some((value) => value.includes("human_verification_status")),
    "blockers should mention missing durable human_verification_status"
  );
});

await runTest("record-event merge-ready rejects split review verdict", async (dir) => {
  await setupFeature(dir, {
    contractText: HUMAN_NOT_REQUIRED_CONTRACT,
    reviewState: buildReviewState({ auditor: "reject", reviewer: "approve" })
  });

  const result = runHelper([
    "record-event",
    "--project-root", dir,
    "--phase-number", "1",
    "--feature-slug", "test-feature",
    "--event", "merge-ready"
  ], dir);

  assert(result.status !== 0, "merge-ready should fail on split review verdict");
  const output = (result.stderr || result.stdout || "").toLowerCase();
  assert(output.includes("dual approval"), "error should mention dual approval, got: " + output);
});

await runTest("update-state stales human approval when approved_commit_sha changes", async (dir) => {
  await setupFeature(dir, {
    stateOverrides: {
      approved_commit_sha: "abc123",
      human_verification_status: "approved",
      human_verification_approved_at: "2026-04-08T00:00:00.000Z",
      human_verification_approved_commit_sha: "abc123"
    }
  });

  const result = runHelper([
    "update-state",
    "--project-root", dir,
    "--phase-number", "1",
    "--feature-slug", "test-feature",
    "--approved-commit-sha", "def456"
  ], dir);

  const json = parseJson(result);
  assert(json !== null, "expected JSON output");
  assert(json.state.human_verification_status === "stale", "human verification should become stale");
  assert(json.state.human_verification_approved_commit_sha === "abc123", "prior approved commit should be preserved");
});

await runTest("mark-complete rejects stale human approval", async (dir) => {
  await setupFeature(dir, {
    stateOverrides: {
      approved_commit_sha: "def456",
      human_verification_status: "stale",
      human_verification_approved_at: "2026-04-08T00:00:00.000Z",
      human_verification_approved_commit_sha: "abc123",
      last_commit_sha: "merge789",
      merge_commit_sha: "merge789",
      merge_status: "merged",
      local_target_sync_status: "fast_forwarded",
      active_run_status: "closeout_pending"
    }
  });

  const result = runHelper([
    "mark-complete",
    "--project-root", dir,
    "--phase-number", "1",
    "--feature-slug", "test-feature"
  ], dir);

  assert(result.status !== 0, "mark-complete should fail when human approval is stale");
  const output = (result.stderr || result.stdout || "").toLowerCase();
  assert(output.includes("stale"), "error should mention stale human verification, got: " + output);
});

process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
