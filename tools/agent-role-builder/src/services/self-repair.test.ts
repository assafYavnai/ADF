import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { clearTelemetryBuffer, getTelemetryBuffer } from "../shared-imports.js";
import { invokeWithSelfRepair, repairSupplementalSessionRegistry } from "./self-repair.js";

test("repairSupplementalSessionRegistry writes repaired supplemental state under the current run", async () => {
  const root = await mkdtemp(join(tmpdir(), "adf-arb-self-repair-"));
  const originalCwd = process.cwd();
  try {
    process.chdir(resolve(import.meta.dirname, "../../../.."));
    const runDir = join(root, "run");
    const registryPath = join(root, "resume", "session-registry.json");
    const repairedRegistryPath = join(runDir, "runtime", "supplemental-session-registry.json");
    await mkdir(join(root, "resume"), { recursive: true });
    await writeFile(registryPath, "{bad json", "utf-8");

    const repair = await repairSupplementalSessionRegistry({
      request: { job_id: "repair-job-001" },
      runDir,
      sourceSessionRegistryPath: registryPath,
      repairedSessionRegistryPath: repairedRegistryPath,
      message: "Supplemental session registry was malformed",
      incidentType: "invalid_runtime_artifact",
      replacementText: JSON.stringify({ schema_version: "1.0", ok: true }, null, 2),
    });

    const original = await readFile(registryPath, "utf-8");
    const rewritten = JSON.parse(await readFile(repairedRegistryPath, "utf-8")) as { ok: boolean };
    const repairArtifact = JSON.parse(await readFile(repair.result.result_path, "utf-8")) as { status: string; action: string };

    assert.equal(original, "{bad json");
    assert.equal(rewritten.ok, true);
    assert.equal(repair.result.status, "repaired");
    assert.equal(repairArtifact.status, "repaired");
    assert.equal(repairArtifact.action, "regenerated_artifact");
    assert.equal(repair.result.updated_artifact_path, repairedRegistryPath.replace(/\\/g, "/"));
  } finally {
    process.chdir(originalCwd);
    await rm(root, { recursive: true, force: true });
  }
});

test("invokeWithSelfRepair does not emit repair telemetry on clean success", async () => {
  const root = await mkdtemp(join(tmpdir(), "adf-arb-self-repair-telemetry-"));
  const originalCwd = process.cwd();
  clearTelemetryBuffer();
  try {
    process.chdir(resolve(import.meta.dirname, "../../../.."));
    const result = await invokeWithSelfRepair({
      request: { job_id: "repair-job-002" },
      runDir: join(root, "run"),
      engine: "board-review",
      message: "reviewer call failed",
      provider: "codex",
      model: "gpt-5.4",
      sourcePath: "tools/agent-role-builder/review",
      primary: async () => ({
        provenance: {
          invocation_id: "11111111-1111-4111-8111-111111111111",
          provider: "codex" as const,
          model: "gpt-5.4",
          reasoning: "high",
          was_fallback: false,
          source_path: "tools/agent-role-builder/review",
          timestamp: new Date().toISOString(),
        },
        response: "{\"verdict\":\"approved\",\"conceptual_groups\":[],\"residual_risks\":[],\"strengths\":[]}",
        latency_ms: 10,
        session: null,
        attempts: [],
      }),
      buildColdStartParams: () => ({
        cli: "codex",
        model: "gpt-5.4",
        reasoning: "high",
        bypass: false,
        timeout_ms: 1_000,
        prompt: "unused",
        source_path: "tools/agent-role-builder/review",
      }),
    });

    assert.match(result.response, /approved/);
    assert.deepEqual(
      getTelemetryBuffer().filter((event) => event.operation === "self-repair-engine"),
      []
    );
  } finally {
    process.chdir(originalCwd);
    clearTelemetryBuffer();
    await rm(root, { recursive: true, force: true });
  }
});
