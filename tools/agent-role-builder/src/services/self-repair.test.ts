import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { repairSupplementalSessionRegistry } from "./self-repair.js";

test("repairSupplementalSessionRegistry rewrites the registry and records repair artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "adf-arb-self-repair-"));
  const originalCwd = process.cwd();
  try {
    process.chdir(resolve(import.meta.dirname, "../../../.."));
    const runDir = join(root, "run");
    const registryPath = join(root, "resume", "session-registry.json");
    await mkdir(join(root, "resume"), { recursive: true });
    await writeFile(registryPath, "{bad json", "utf-8");

    const repair = await repairSupplementalSessionRegistry({
      request: { job_id: "repair-job-001" },
      runDir,
      sessionRegistryPath: registryPath,
      message: "Supplemental session registry was malformed",
      incidentType: "invalid_runtime_artifact",
      replacementText: JSON.stringify({ schema_version: "1.0", ok: true }, null, 2),
    });

    const rewritten = JSON.parse(await readFile(registryPath, "utf-8")) as { ok: boolean };
    const repairArtifact = JSON.parse(await readFile(repair.result.result_path, "utf-8")) as { status: string; action: string };

    assert.equal(rewritten.ok, true);
    assert.equal(repair.result.status, "repaired");
    assert.equal(repairArtifact.status, "repaired");
    assert.equal(repairArtifact.action, "regenerated_artifact");
  } finally {
    process.chdir(originalCwd);
    await rm(root, { recursive: true, force: true });
  }
});
