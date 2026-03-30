import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyFutureRunRulebookPromotion } from "./rulebook-promotion.js";

test("applyFutureRunRulebookPromotion writes a promoted rulebook for prior learning proposals", async () => {
  const runDir = await mkdtemp(join(tmpdir(), "adf-rulebook-promotion-test-"));
  const runtimeDir = join(runDir, "runtime");
  const roundsDir = join(runDir, "rounds", "round-0");
  await mkdir(runtimeDir, { recursive: true });
  await mkdir(roundsDir, { recursive: true });

  const sourceRulebookPath = join(runDir, "source-rulebook.json");
  const learningPath = join(roundsDir, "learning.json");

  await writeFile(
    sourceRulebookPath,
    JSON.stringify(
      {
        schema_version: "1.0",
        component: "agent-role-builder",
        rules: [
          {
            id: "ARB-001",
            rule: "Existing rule",
            applies_to: ["<role>"],
            do: "Do it",
            dont: "Do not do it",
            source: "existing",
            version: 1,
          },
        ],
      },
      null,
      2
    ),
    "utf-8"
  );

  await writeFile(
    learningPath,
    JSON.stringify(
      {
        new_rules: [
          {
            id: "ARB-099",
            rule: "Promoted rule",
            applies_to: ["<outputs>"],
            do: "Write full output paths",
            dont: "Use only basenames",
            source: "Round 0: output-path drift",
            version: 1,
          },
        ],
        existing_rules_covering: [],
        no_rule_needed: [],
      },
      null,
      2
    ),
    "utf-8"
  );

  try {
    const result = await applyFutureRunRulebookPromotion({
      runDir,
      sourceRulebookPath,
      resumePackage: {
        schema_version: "1.0",
        role_slug: "agent-role-builder",
        request_job_id: "resume-test",
        next_step: "resume_board_review",
        unresolved: [],
        latest_markdown_path: "draft.md",
        latest_contract_path: "draft.json",
        latest_board_summary_path: "summary.md",
        latest_decision_log_path: "decision.md",
        latest_learning_path: learningPath,
        round_files: [join(roundsDir, "round-0.json")],
        reviewer_status: {},
        rounds_completed: 1,
      },
    });

    assert.match(result.effectiveRulebookPath.replace(/\\/g, "/"), /runtime\/promoted-rulebook\.json$/);
    const promoted = JSON.parse(await readFile(result.effectiveRulebookPath, "utf-8")) as { rules: Array<{ id: string }>; new_rule_ids: string[] };
    assert.deepEqual(promoted.rules.map((rule) => rule.id), ["ARB-001", "ARB-099"]);
    assert.deepEqual(promoted.new_rule_ids, ["ARB-099"]);

    const artifact = JSON.parse(await readFile(join(runtimeDir, "rulebook-promotion.json"), "utf-8")) as {
      status: string;
      applied_rule_ids: string[];
      skipped_rule_ids: string[];
    };
    assert.equal(artifact.status, "applied");
    assert.deepEqual(artifact.applied_rule_ids, ["ARB-099"]);
    assert.deepEqual(artifact.skipped_rule_ids, []);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("applyFutureRunRulebookPromotion falls back to the source rulebook when no learning artifact exists", async () => {
  const runDir = await mkdtemp(join(tmpdir(), "adf-rulebook-promotion-test-"));
  const runtimeDir = join(runDir, "runtime");
  await mkdir(runtimeDir, { recursive: true });

  const sourceRulebookPath = join(runDir, "source-rulebook.json");
  await writeFile(
    sourceRulebookPath,
    JSON.stringify({ schema_version: "1.0", component: "agent-role-builder", rules: [] }, null, 2),
    "utf-8"
  );

  try {
    const result = await applyFutureRunRulebookPromotion({
      runDir,
      sourceRulebookPath,
      resumePackage: {
        schema_version: "1.0",
        role_slug: "agent-role-builder",
        request_job_id: "resume-test",
        next_step: "resume_board_review",
        unresolved: [],
        latest_markdown_path: "draft.md",
        latest_contract_path: "draft.json",
        latest_board_summary_path: "summary.md",
        latest_decision_log_path: "decision.md",
        round_files: [],
        reviewer_status: {},
        rounds_completed: 1,
      },
    });

    assert.equal(result.effectiveRulebookPath, sourceRulebookPath);
    const artifact = JSON.parse(await readFile(join(runtimeDir, "rulebook-promotion.json"), "utf-8")) as { status: string };
    assert.equal(artifact.status, "no_learning_artifact");
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});
