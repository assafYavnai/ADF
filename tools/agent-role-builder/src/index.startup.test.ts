import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
