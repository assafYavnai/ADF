import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { assertResumePackageMatchesRole, buildNextResumePackage, loadResumeState, resolveResumeLearningArtifactPath } from "./resume-state.js";

test("loadResumeState loads markdown and defaults missing reviewer_status", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "adf-resume-state-test-"));
  const markdownPath = join(tempRoot, "agent-role-builder-role.md");
  const resumePath = join(tempRoot, "resume-package.json");

  await writeFile(markdownPath, "# Resumed markdown", "utf-8");
  await writeFile(
    resumePath,
    JSON.stringify(
      {
        schema_version: "1.0",
        role_slug: "agent-role-builder",
        request_job_id: "resume-test",
        next_step: "resume_board_review",
        unresolved: [],
        latest_markdown_path: markdownPath,
        latest_contract_path: join(tempRoot, "contract.json"),
        latest_board_summary_path: join(tempRoot, "board-summary.md"),
        latest_decision_log_path: join(tempRoot, "decision-log.md"),
        round_files: [],
      },
      null,
      2
    ),
    "utf-8"
  );

  try {
    const loaded = await loadResumeState(resumePath);
    assert.equal(loaded.markdown, "# Resumed markdown");
    assert.deepEqual(loaded.resumePackage.reviewer_status, {});
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("buildNextResumePackage carries forward reviewer status, rounds, and prior round files", () => {
  const nextResumePackage = buildNextResumePackage({
    roleSlug: "agent-role-builder",
    requestJobId: "resume-test-next",
    unresolved: ["Carry reviewer status forward"],
    latestMarkdownPath: "tools/agent-role-builder/runs/resume/agent-role-builder-role.md",
    latestContractPath: "tools/agent-role-builder/runs/resume/agent-role-builder-contract.json",
    latestBoardSummaryPath: "tools/agent-role-builder/runs/resume/agent-role-builder-board-summary.md",
    latestDecisionLogPath: "tools/agent-role-builder/runs/resume/agent-role-builder-decision-log.md",
    roundFiles: [
      "tools/agent-role-builder/runs/resume/rounds/round-0.json",
      "tools/agent-role-builder/runs/resume/rounds/round-1.json",
    ],
    reviewerStatus: {
      "reviewer-0-codex": "approved",
      "reviewer-1-claude": "conditional",
    },
    roundsCompletedThisRun: 2,
    priorResumePackage: {
      schema_version: "1.0",
      role_slug: "agent-role-builder",
      request_job_id: "resume-test-prev",
      next_step: "resume_board_review",
      unresolved: [],
      latest_markdown_path: "older.md",
      latest_contract_path: "older.json",
      latest_board_summary_path: "older-summary.md",
      latest_decision_log_path: "older-log.md",
      round_files: [
        "tools/agent-role-builder/runs/prior/rounds/round-0.json",
        "tools/agent-role-builder/runs/resume/rounds/round-0.json",
      ],
      reviewer_status: {
        "reviewer-0-codex": "reject",
      },
      rounds_completed: 3,
    },
  });

  assert.deepEqual(nextResumePackage.reviewer_status, {
    "reviewer-0-codex": "approved",
    "reviewer-1-claude": "conditional",
  });
  assert.equal(nextResumePackage.rounds_completed, 5);
  assert.deepEqual(nextResumePackage.round_files, [
    "tools/agent-role-builder/runs/prior/rounds/round-0.json",
    "tools/agent-role-builder/runs/resume/rounds/round-0.json",
    "tools/agent-role-builder/runs/resume/rounds/round-1.json",
  ]);
});

test("assertResumePackageMatchesRole rejects mismatched role slug", () => {
  assert.throws(
    () =>
      assertResumePackageMatchesRole(
        {
          schema_version: "1.0",
          role_slug: "other-role",
          request_job_id: "resume-test-prev",
          next_step: "resume_board_review",
          unresolved: [],
          latest_markdown_path: "older.md",
          latest_contract_path: "older.json",
          latest_board_summary_path: "older-summary.md",
          latest_decision_log_path: "older-log.md",
          round_files: [],
          reviewer_status: {},
          rounds_completed: 0,
        },
        "agent-role-builder"
      ),
    /role_slug mismatch/
  );
});

test("resolveResumeLearningArtifactPath falls back to the latest round learning.json for older resume packages", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "adf-resume-learning-test-"));
  const roundFilePath = join(tempRoot, "rounds", "round-0.json");
  const learningPath = join(dirname(roundFilePath), "learning.json");
  await mkdir(dirname(roundFilePath), { recursive: true });

  await writeFile(roundFilePath, JSON.stringify({ round: 0 }, null, 2), "utf-8");
  await writeFile(learningPath, JSON.stringify({ new_rules: [], existing_rules_covering: [], no_rule_needed: [] }, null, 2), "utf-8");

  try {
    const resolved = await resolveResumeLearningArtifactPath({
      schema_version: "1.0",
      role_slug: "agent-role-builder",
      request_job_id: "resume-test-prev",
      next_step: "resume_board_review",
      unresolved: [],
      latest_markdown_path: "older.md",
      latest_contract_path: "older.json",
      latest_board_summary_path: "older-summary.md",
      latest_decision_log_path: "older-log.md",
      round_files: [roundFilePath],
      reviewer_status: {},
      rounds_completed: 1,
    });

    assert.equal(resolved, learningPath);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
