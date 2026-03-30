import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadResumeState } from "./resume-state.js";

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
