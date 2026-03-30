import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { invokeWithSelfRepair, repairRuntimeArtifact } from "./index.js";

test("repairRuntimeArtifact backs up and rewrites an invalid runtime artifact", async () => {
  const runDir = await mkdtemp(join(tmpdir(), "adf-self-repair-artifact-"));
  try {
    const targetPath = join(runDir, "runtime", "session-registry.json");
    await mkdir(join(runDir, "runtime"), { recursive: true });
    await writeFile(targetPath, "{bad json", "utf-8");

    const repair = await repairRuntimeArtifact({
      component: "agent-role-builder",
      requestJobId: "job-1",
      runDir,
      engine: "startup",
      incidentType: "invalid_runtime_artifact",
      message: "Supplemental session registry was malformed",
      targetPath,
      replacementText: "{\"ok\":true}\n",
    });

    const repaired = await readFile(targetPath, "utf-8");
    assert.equal(repaired.trim(), "{\"ok\":true}");
    assert.equal(repair.status, "repaired");
    assert.equal(repair.action, "regenerated_artifact");
    assert.ok(repair.backup_path);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("invokeWithSelfRepair retries once and succeeds", async () => {
  const runDir = await mkdtemp(join(tmpdir(), "adf-self-repair-invoke-"));
  try {
    let attempts = 0;
    const result = await invokeWithSelfRepair({
      component: "agent-role-builder",
      requestJobId: "job-2",
      runDir,
      engine: "board-review",
      message: "Reviewer provider call failed",
      provider: "codex",
      model: "gpt-5.4",
      primary: async () => {
        attempts++;
        throw new Error("codex exec failed (exit 1): boom");
      },
      repair: async () => {
        attempts++;
        return "ok";
      },
    });

    assert.equal(result.value, "ok");
    assert.equal(result.repair.status, "repaired");
    assert.equal(result.repair.action, "cold_start_retry");
    assert.equal(attempts, 2);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("invokeWithSelfRepair escalates non-retryable failures", async () => {
  const runDir = await mkdtemp(join(tmpdir(), "adf-self-repair-escalate-"));
  try {
    await assert.rejects(
      () =>
        invokeWithSelfRepair({
          component: "agent-role-builder",
          requestJobId: "job-3",
          runDir,
          engine: "self-learning-engine",
          message: "Learning parse failed",
          provider: "codex",
          model: "gpt-5.4",
          primary: async () => {
            throw new Error("schema validation failed");
          },
          repair: async () => "ok",
        }),
      /Self-repair result:/
    );
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});
