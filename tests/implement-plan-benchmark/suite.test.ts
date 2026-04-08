import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { runSuite } from "./suite.js";

test("runSuite aggregates multiple feature manifests and writes a suite summary", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "adf-implement-plan-suite-"));

  try {
    const benchmarkDir = join(repoRoot, "tests", "implement-plan-benchmark");
    await mkdir(benchmarkDir, { recursive: true });

    const manifestAPath = join(benchmarkDir, "feature-a.manifest.json");
    const manifestBPath = join(benchmarkDir, "feature-b.manifest.json");

    await writeFile(
      manifestAPath,
      JSON.stringify({
        schema_version: 1,
        benchmark_id: "feature-a",
        task_summary: "Feature A",
        instructions: "Do work",
        engines: [{ id: "lane-a", cli: "codex", model: "gpt-5.4" }],
      }, null, 2),
      "utf-8",
    );
    await writeFile(
      manifestBPath,
      JSON.stringify({
        schema_version: 1,
        benchmark_id: "feature-b",
        task_summary: "Feature B",
        instructions: "Do work",
        engines: [{ id: "lane-b", cli: "claude", model: "opus-4.6" }],
      }, null, 2),
      "utf-8",
    );

    const summary = await runSuite(
      [
        relative(repoRoot, manifestAPath),
        relative(repoRoot, manifestBPath),
      ],
      {
        repo_root: repoRoot,
        run_manifest_fn: async (manifestPath, rawManifest) => {
          const manifest = rawManifest as { benchmark_id: string };
          return {
            benchmark_id: manifest.benchmark_id,
            run_root: join(repoRoot, "fake-runs", manifest.benchmark_id),
            totals: {
              success_count: manifest.benchmark_id === "feature-a" ? 2 : 1,
              blocked_count: manifest.benchmark_id === "feature-b" ? 1 : 0,
              failure_count: 0,
              max_cycles_exhausted_count: 0,
            },
          };
        },
      },
    );

    assert.equal(summary.manifests.length, 2);
    assert.equal(summary.manifests[0]?.benchmark_id, "feature-a");
    assert.equal(summary.manifests[1]?.benchmark_id, "feature-b");
    assert.equal(summary.manifests[1]?.blocked_count, 1);

    const suiteSummaryPath = join(repoRoot, "tests", "artifacts", "implement-plan-benchmark", "suites", summary.suite_id, "suite-summary.json");
    const savedSummary = JSON.parse(await readFile(suiteSummaryPath, "utf-8"));
    assert.equal(savedSummary.manifests.length, 2);
    assert.equal(savedSummary.manifests[0].status, "completed");
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
