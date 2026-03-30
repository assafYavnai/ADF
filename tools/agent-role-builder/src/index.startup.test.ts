import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildRole } from "./index.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

function extractIncidentPath(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/Bootstrap incident:\s+(.+)$/);
  assert.ok(match, `Expected bootstrap incident path in error message, got: ${message}`);
  return match[1].trim();
}

function createValidSchemaRequest(jobId: string) {
  return {
    schema_version: "1.0",
    request_type: "role_definition",
    operation: "fix",
    job_id: jobId,
    role_slug: "agent-role-builder",
    role_name: "Agent Role Builder",
    intent: "Test startup guards",
    business_context: "Unit test",
    primary_objective: "Exercise startup-only code paths",
    out_of_scope: ["Live execution"],
    source_refs: [
      {
        path: "docs/v0/context/2026-03-31-arb-next-steps-workplan.md",
        purpose: "Schema-valid source reference",
        required: true,
      },
    ],
    board_roster: {
      profile: "small",
      leader_count: 1,
      reviewer_count: 2,
      leader: {
        provider: "codex",
        model: "gpt-5.4",
        role: "leader",
      },
      reviewers: [
        {
          provider: "codex",
          model: "gpt-5.4-mini",
          role: "reviewer",
        },
        {
          provider: "claude",
          model: "sonnet",
          role: "reviewer",
        },
      ],
    },
    governance: {
      mode: "governed",
      max_review_rounds: 3,
      allow_single_arbitration_round: true,
      freeze_requires_no_material_pushback: true,
      pushback_on_material_ambiguity: true,
    },
    runtime: {
      execution_mode: "live-roster-v1",
      watchdog_timeout_seconds: 600,
      max_launch_attempts: 2,
      allow_provider_fallback: false,
    },
    required_outputs: [
      "tools/agent-role-builder/role/agent-role-builder-role.md",
      "tools/agent-role-builder/role/agent-role-builder-role-contract.json",
      "tools/agent-role-builder/role/agent-role-builder-decision-log.md",
      "tools/agent-role-builder/role/agent-role-builder-board-summary.md",
    ],
    role_requirements: {
      role_summary: "Startup guard coverage only.",
      authority: {
        reports_to: "COO controller",
        subordinate_to: [],
        owns: ["startup validation"],
        does_not_own: ["runtime execution"],
      },
      scope: {
        use_when: ["Testing startup guard paths"],
        not_in_scope: ["Full run execution"],
      },
      context_gathering: ["Load request only."],
      inputs: {
        required: ["Schema-valid request"],
        optional: [],
        examples: ["Exercise duplicate job guard"],
      },
      guardrails: ["Never run past the duplicate-job guard in this test."],
      steps: [
        {
          title: "Validate",
          actions: ["Parse the request."],
          outputs: ["normalized-request.json"],
        },
      ],
      outputs: {
        artifacts: [],
        state_changes: [],
      },
      completion: ["Startup incident is written when blocked before run execution."],
    },
  };
}

test("buildRole writes a bootstrap incident for unreadable request files", async () => {
  await assert.rejects(
    async () => {
      try {
        await buildRole("C:/ADF/tools/agent-role-builder/tmp/does-not-exist-request.json");
      } catch (error) {
        const incidentPath = extractIncidentPath(error);
        const recorded = JSON.parse(await readFile(incidentPath, "utf-8")) as {
          stage: string;
          normalization: unknown;
          outcome: string;
        };
        assert.equal(recorded.stage, "request_file_read");
        assert.equal(recorded.normalization, null);
        assert.equal(recorded.outcome, "blocked");
        await rm(incidentPath, { force: true });
        throw error;
      }
    },
    /Bootstrap incident:/
  );
});

test("buildRole writes a bootstrap incident for schema-invalid request JSON", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "adf-role-builder-startup-test-"));
  const requestPath = join(tempRoot, "schema-invalid-request.json");
  await writeFile(requestPath, JSON.stringify({ job_id: "schema-invalid-only" }, null, 2), "utf-8");

  try {
    await assert.rejects(
      async () => {
        try {
          await buildRole(requestPath);
        } catch (error) {
          const incidentPath = extractIncidentPath(error);
          const recorded = JSON.parse(await readFile(incidentPath, "utf-8")) as {
            stage: string;
            normalization: { transform?: string } | null;
            outcome: string;
          };
          assert.equal(recorded.stage, "request_schema_validation");
          assert.equal(recorded.normalization?.transform, "none");
          assert.equal(recorded.outcome, "blocked");
          await rm(incidentPath, { force: true });
          throw error;
        }
      },
      /Bootstrap incident:/
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("buildRole writes a bootstrap incident for duplicate job_id runs", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "adf-role-builder-duplicate-job-test-"));
  const requestPath = join(tempRoot, "duplicate-job-request.json");
  const runDir = join(tempRoot, "duplicate-job-run");
  await writeFile(requestPath, JSON.stringify(createValidSchemaRequest("duplicate-job-id"), null, 2), "utf-8");
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "result.json"), JSON.stringify({ status: "frozen" }, null, 2), "utf-8");

  try {
    await assert.rejects(
      async () => {
        try {
          await buildRole(requestPath, runDir);
        } catch (error) {
          const incidentPath = extractIncidentPath(error);
          const recorded = JSON.parse(await readFile(incidentPath, "utf-8")) as {
            stage: string;
            outcome: string;
            details?: { existing_result_path?: string };
          };
          assert.equal(recorded.stage, "duplicate_job_id");
          assert.equal(recorded.outcome, "blocked");
          assert.equal(recorded.details?.existing_result_path, join(runDir, "result.json").replace(/\\/g, "/"));
          await rm(incidentPath, { force: true });
          throw error;
        }
      },
      /Bootstrap incident:/
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
