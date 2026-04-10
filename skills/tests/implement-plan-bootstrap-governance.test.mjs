#!/usr/bin/env node

/**
 * Targeted tests for bootstrap/manual-governance implement-plan hardening.
 *
 * Validates that:
 * - blocked bootstrap prepare keeps the route on a truthful blocked path
 * - feature-reopened fails closed until bootstrap approval is explicitly approved
 * - successful reopen restores brief_ready and the next prepare proceeds without re-blocking
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoSourceRoot = join(__dirname, "..", "..");
const helperPath = join(repoSourceRoot, "skills", "implement-plan", "scripts", "implement-plan-helper.mjs");
const sourceSliceRoot = join(repoSourceRoot, "docs", "phase1", "governance-path-hardening-bootstrap");

const testRoot = join(
  process.env.TEMP || process.env.TMPDIR || "/tmp",
  "ipbg-" + randomUUID().slice(0, 8)
);

const featureSlug = "governance-path-hardening-bootstrap";
const phaseNumber = 1;
const featureBranch = "implement-plan/phase1/" + featureSlug;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion failed: " + message);
  }
}

function normalizePath(value) {
  return String(value).replace(/\\/g, "/");
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

function runHelper(projectRoot, args) {
  return spawnSync("node", [helperPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120000
  });
}

function parseJson(result) {
  try {
    return JSON.parse((result.stdout || "").trim());
  } catch {
    return null;
  }
}

async function copySliceArtifact(name, featureRoot, projectRootNormalized) {
  const sourcePath = join(sourceSliceRoot, name);
  const destinationPath = join(featureRoot, name);
  const text = await readFile(sourcePath, "utf8");
  await writeFile(destinationPath, text.replaceAll("C:/ADF", projectRootNormalized), "utf8");
}

function buildSeedState(repoPath) {
  const projectRoot = normalizePath(repoPath);
  const featureRoot = normalizePath(join(repoPath, "docs", "phase1", featureSlug));
  const worktreePath = normalizePath(join(repoPath, ".codex", "implement-plan", "worktrees", "phase1", featureSlug));
  const timestamp = new Date().toISOString();
  return {
    state_schema_version: 2,
    phase_number: phaseNumber,
    feature_slug: featureSlug,
    project_root: projectRoot,
    feature_registry_key: "phase1/" + featureSlug,
    feature_status: "blocked",
    implementor_execution_id: null,
    implementor_execution_access_mode: null,
    implementor_execution_runtime: null,
    implementor_provider: null,
    implementor_model: null,
    implementor_reasoning_effort: null,
    resolved_runtime_permission_model: "claude_code_skip_permissions",
    resolved_runtime_capabilities: {
      native_agent_spawning_available: false,
      native_agent_access_configurable: false,
      native_agent_inherits_runtime_access: false,
      native_agent_resume_available: false,
      native_agent_send_input_available: false,
      native_agent_wait_available: false,
      native_parallel_wait_available: false,
      codex_cli_available: true,
      codex_cli_full_auto_supported: true,
      codex_cli_bypass_supported: true
    },
    current_branch: "main",
    base_branch: "main",
    feature_branch: featureBranch,
    worktree_path: worktreePath,
    worktree_status: "missing",
    merge_required: true,
    merge_status: "not_ready",
    approved_commit_sha: null,
    merge_commit_sha: null,
    merge_queue_request_id: null,
    local_target_sync_status: "not_started",
    human_verification_status: null,
    human_verification_approved_at: null,
    human_verification_approved_commit_sha: null,
    last_completed_step: "feature_blocked",
    last_commit_sha: null,
    active_run_status: "blocked",
    created_at: timestamp,
    updated_at: timestamp,
    run_timestamps: {
      context_collected_at: timestamp,
      worktree_prepared_at: null,
      integrity_passed_at: null,
      integrity_failed_at: null,
      brief_written_at: timestamp,
      implementor_started_at: null,
      implementor_finished_at: null,
      verification_finished_at: null,
      review_requested_at: null,
      human_verification_requested_at: null,
      merge_started_at: null,
      merge_finished_at: null,
      closeout_finished_at: null,
      feature_blocked_at: timestamp
    },
    event_log: [],
    artifacts: {
      readme_path: featureRoot + "/README.md",
      context_path: featureRoot + "/context.md",
      state_path: featureRoot + "/implement-plan-state.json",
      contract_path: featureRoot + "/implement-plan-contract.md",
      bootstrap_approval_path: featureRoot + "/bootstrap-approval.v1.json",
      pushback_path: featureRoot + "/implement-plan-pushback.md",
      brief_path: featureRoot + "/implement-plan-brief.md",
      completion_summary_path: featureRoot + "/completion-summary.md",
      implementation_run_dir: featureRoot + "/implementation-run",
      worktree_path: worktreePath
    },
    last_error: null,
    current_run_id: null,
    current_attempt_id: null,
    execution_runs: {
      active_by_mode: {
        normal: null,
        benchmarking: null
      },
      runs: {}
    }
  };
}

async function setupRepo(testDir) {
  const remotePath = join(testDir, "remote.git");
  const repoPath = join(testDir, "repo");
  await mkdir(remotePath, { recursive: true });
  git(remotePath, ["init", "--bare", "--initial-branch=main"]);
  git(testDir, ["clone", remotePath, "repo"]);
  git(repoPath, ["config", "user.email", "test@test.com"]);
  git(repoPath, ["config", "user.name", "Test"]);

  const featureRoot = join(repoPath, "docs", "phase1", featureSlug);
  const projectRootNormalized = normalizePath(repoPath);
  await mkdir(featureRoot, { recursive: true });
  await mkdir(join(repoPath, ".codex", "implement-plan", "locks", "features"), { recursive: true });
  await mkdir(join(repoPath, ".codex", "implement-plan", "locks", "project"), { recursive: true });

  for (const file of [
    "README.md",
    "context.md",
    "requirements.md",
    "decisions.md",
    "implement-plan-contract.md",
    "implement-plan-brief.md",
    "implement-plan-pushback.md",
    "bootstrap-approval.v1.json"
  ]) {
    await copySliceArtifact(file, featureRoot, projectRootNormalized);
  }

  await writeFile(
    join(featureRoot, "implement-plan-state.json"),
    JSON.stringify(buildSeedState(repoPath), null, 2),
    "utf8"
  );

  await writeFile(
    join(repoPath, ".codex", "implement-plan", "setup.json"),
    JSON.stringify({
      project_root: projectRootNormalized,
      preferred_execution_access_mode: "claude_code_skip_permissions",
      preferred_implementor_access_mode: "claude_code_skip_permissions",
      fallback_execution_access_mode: "interactive_fallback",
      runtime_permission_model: "claude_code_skip_permissions",
      execution_access_notes: "Test setup for bootstrap governance route hardening.",
      preferred_execution_runtime: "claude_code_exec",
      preferred_control_plane_runtime: "claude_code_exec",
      persistent_execution_strategy: "per_feature_cli_sessions",
      preferred_implementor_model: "claude-opus-4-6",
      preferred_implementor_reasoning_effort: null,
      requires_project_specific_permission_rules: false,
      project_specific_permission_rules: [],
      detected_runtime_capabilities: {
        native_agent_spawning_available: false,
        native_agent_access_configurable: false,
        native_agent_inherits_runtime_access: false,
        native_agent_resume_available: false,
        native_agent_send_input_available: false,
        native_agent_wait_available: false,
        native_parallel_wait_available: false,
        codex_cli_available: true,
        codex_cli_full_auto_supported: true,
        codex_cli_bypass_supported: true
      },
      setup_schema_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, null, 2),
    "utf8"
  );

  git(repoPath, ["add", "."]);
  git(repoPath, ["commit", "-m", "seed bootstrap slice"]);
  git(repoPath, ["push", "-u", "origin", "main"]);
  git(repoPath, ["checkout", "-b", featureBranch]);
  git(repoPath, ["push", "-u", "origin", featureBranch]);
  git(repoPath, ["checkout", "main"]);

  return {
    repoPath,
    featureRoot,
    bootstrapApprovalPath: join(featureRoot, "bootstrap-approval.v1.json")
  };
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

await runTest("blocked bootstrap prepare stays truthful and reopen requires approval", async (dir) => {
  const { repoPath, bootstrapApprovalPath } = await setupRepo(dir);
  const projectRoot = normalizePath(repoPath);

  const prepareResult = runHelper(repoPath, [
    "prepare",
    "--project-root", repoPath,
    "--phase-number", String(phaseNumber),
    "--feature-slug", featureSlug,
    "--task-summary", "Bootstrap manual-governance slice for governance path hardening"
  ]);
  assert(prepareResult.status === 0, "prepare should succeed, got stderr: " + prepareResult.stderr);
  const prepareJson = parseJson(prepareResult);
  assert(prepareJson !== null, "prepare should return JSON");
  const preparedState = JSON.parse(await readFile(prepareJson.state_path, "utf8"));

  const blockingIssues = prepareJson.integrity_precheck?.blocking_issues ?? [];
  assert(blockingIssues.length === 1, "prepare should report only the intentional bootstrap blocker");
  assert(blockingIssues[0]?.issue_class === "feature-blocked", "prepare should block only on feature-blocked");
  assert(
    !blockingIssues.some((issue) => String(issue.issue_class).includes("human-verification") || String(issue.issue_class).includes("review-cycle")),
    "prepare should not report governed human-verification blockers"
  );
  assert(prepareJson.worktree?.worktree_status === "ready", "prepare should report ready worktree truth");
  assert(preparedState.worktree_status === "ready", "prepare should persist ready worktree truth");
  assert(prepareJson.active_run_status === "blocked", "prepare should stay blocked");
  assert(preparedState.last_completed_step === "feature_blocked", "prepare should preserve feature_blocked checkpoint");
  assert(preparedState.last_error === null, "prepare should not leak the bootstrap hold into last_error");
  assert(isFilled(preparedState.run_timestamps?.worktree_prepared_at), "prepare should record worktree_prepared_at");
  assert(
    preparedState.artifacts?.bootstrap_approval_path === normalizePath(bootstrapApprovalPath),
    "prepare should keep the canonical bootstrap approval artifact path"
  );

  const checkpointReason = prepareJson.execution_projection?.resume_checkpoint?.reason ?? "";
  assert(!checkpointReason.includes("Benchmarking"), "prepare should not emit benchmarking wording for a normal blocked run");
  assert(checkpointReason.includes("bootstrap-approval.v1.json"), "prepare should mention the bootstrap approval artifact in the checkpoint reason");
  assert(
    prepareJson.detected_status_summary?.next_action === "write_pushback_for_blocked_feature",
    "blocked bootstrap prepare should stop on the blocked-feature path"
  );

  const pendingReopen = runHelper(repoPath, [
    "record-event",
    "--project-root", repoPath,
    "--phase-number", String(phaseNumber),
    "--feature-slug", featureSlug,
    "--event", "feature-reopened"
  ]);
  assert(pendingReopen.status !== 0, "feature-reopened should fail while bootstrap approval is pending");
  const pendingMessage = (pendingReopen.stderr || pendingReopen.stdout || "").toLowerCase();
  assert(pendingMessage.includes("bootstrap approval is pending"), "pending reopen should explain that approval is still pending");
  await rm(join(repoPath, ".codex", "implement-plan", "locks", "features", featureSlug + ".lock"), {
    recursive: true,
    force: true
  });

  const approvalRecord = JSON.parse(await readFile(bootstrapApprovalPath, "utf8"));
  approvalRecord.approval_status = "approved";
  approvalRecord.approved_by = "manual-reviewer";
  approvalRecord.approved_at = new Date().toISOString();
  await writeFile(bootstrapApprovalPath, JSON.stringify(approvalRecord, null, 2), "utf8");

  const reopenResult = runHelper(repoPath, [
    "record-event",
    "--project-root", repoPath,
    "--phase-number", String(phaseNumber),
    "--feature-slug", featureSlug,
    "--event", "feature-reopened",
    "--note", "Bootstrap approval recorded; reopen to implementation."
  ]);
  assert(reopenResult.status === 0, "feature-reopened should succeed after approval, got stderr: " + reopenResult.stderr);
  const reopenJson = parseJson(reopenResult);
  assert(reopenJson !== null, "feature-reopened should return JSON");
  assert(reopenJson.state?.feature_status === "active", "reopen should restore active feature status");
  assert(reopenJson.state?.active_run_status === "brief_ready", "reopen should restore brief_ready");
  assert(reopenJson.state?.last_error === null, "reopen should keep last_error clear");
  assert(
    reopenJson.state?.artifacts?.bootstrap_approval_path === normalizePath(bootstrapApprovalPath),
    "reopen should preserve the canonical bootstrap approval artifact path"
  );

  const reopenedRunId = reopenJson.state?.current_run_id;
  const reopenedAttemptId = reopenJson.state?.current_attempt_id;
  const reopenCheckpointReason = reopenJson.state?.execution_runs?.runs?.[reopenedRunId]?.attempts?.[reopenedAttemptId]?.resume_checkpoint?.reason ?? "";
  assert(reopenCheckpointReason.includes("Bootstrap approval recorded"), "reopen should update the checkpoint reason to the approved bootstrap path");

  const prepareAfterReopen = runHelper(repoPath, [
    "prepare",
    "--project-root", repoPath,
    "--phase-number", String(phaseNumber),
    "--feature-slug", featureSlug,
    "--task-summary", "Bootstrap manual-governance slice for governance path hardening"
  ]);
  assert(prepareAfterReopen.status === 0, "prepare after reopen should succeed, got stderr: " + prepareAfterReopen.stderr);
  const prepareAfterReopenJson = parseJson(prepareAfterReopen);
  assert(prepareAfterReopenJson !== null, "prepare after reopen should return JSON");
  const preparedAfterReopenState = JSON.parse(await readFile(prepareAfterReopenJson.state_path, "utf8"));
  assert(
    (prepareAfterReopenJson.integrity_precheck?.blocking_issues ?? []).length === 0,
    "prepare after reopen should clear the bootstrap blocker once approval is recorded"
  );
  assert(
    prepareAfterReopenJson.detected_status_summary?.next_action === "spawn_implementor_with_brief",
    "prepare after reopen should resume the implementation path"
  );
  assert(
    preparedAfterReopenState.artifacts?.bootstrap_approval_path === normalizePath(bootstrapApprovalPath),
    "post-reopen prepare should still preserve the canonical bootstrap approval artifact path"
  );
  assert(
    preparedAfterReopenState.project_root !== projectRoot,
    "normal prepare after reopen should move feature-local runtime artifacts into the isolated worktree"
  );
});

function isFilled(value) {
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
