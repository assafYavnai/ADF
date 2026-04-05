import test from "node:test";
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { runBenchmarkManifest } from "./harness.js";
import type { InvocationParams, InvocationResult } from "../../shared/llm-invoker/types.js";
import { createLLMProvenance } from "../../shared/provenance/types.js";

function buildStubInvocationResult(params: InvocationParams, invocationId: string, responseText = "stub"): InvocationResult {
  return {
    provenance: createLLMProvenance(
      invocationId,
      params.cli,
      params.model,
      params.reasoning ?? params.effort ?? "default",
      false,
      params.source_path,
    ),
    response: responseText,
    latency_ms: params.cli === "codex" ? 110 : 180,
    attempts: [
      {
        provenance: createLLMProvenance(
          invocationId,
          params.cli,
          params.model,
          params.reasoning ?? params.effort ?? "default",
          false,
          params.source_path,
        ),
        latency_ms: params.cli === "codex" ? 110 : 180,
        success: true,
        session_status: "none",
        usage: {
          prompt_chars: params.prompt.length,
          response_chars: responseText.length,
          tokens_in_estimated: Math.max(1, Math.ceil(params.prompt.length / 4)),
          tokens_out_estimated: Math.max(1, Math.ceil(responseText.length / 4)),
          estimated_cost_usd: params.cli === "codex" ? 0.002 : 0.003,
          token_estimation_basis: "char_heuristic_v1",
          cost_estimation_basis: "stub",
        },
      },
    ],
  };
}

function gitAvailable(): boolean {
  return spawnSync("git", ["--version"], { encoding: "utf-8", windowsHide: true }).status === 0;
}

function gitRun(repoRoot: string, args: string[]): void {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf-8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, `git ${args.join(" ")} failed: ${(result.stderr || result.stdout || "unknown error").trim()}`);
}

async function initTempRepo(): Promise<string> {
  const repoRoot = await mkdtemp(join(tmpdir(), "adf-implement-plan-benchmark-"));
  await mkdir(join(repoRoot, "docs", "phase1", "feature"), { recursive: true });
  await writeFile(join(repoRoot, "tracked.txt"), "base\n", "utf-8");
  gitRun(repoRoot, ["init"]);
  gitRun(repoRoot, ["config", "user.email", "benchmark@example.com"]);
  gitRun(repoRoot, ["config", "user.name", "Benchmark"]);
  gitRun(repoRoot, ["add", "."]);
  gitRun(repoRoot, ["commit", "-m", "initial"]);
  return repoRoot;
}

async function seedRuntimeArtifacts(repoRoot: string): Promise<void> {
  await mkdir(join(repoRoot, "COO", "node_modules", ".bin"), { recursive: true });
  await mkdir(join(repoRoot, "shared", "node_modules", "zod"), { recursive: true });
  await mkdir(join(repoRoot, "components", "memory-engine", "dist"), { recursive: true });
  await mkdir(join(repoRoot, ".codex", "runtime"), { recursive: true });
  await writeFile(join(repoRoot, "COO", "package.json"), JSON.stringify({ name: "coo-test" }, null, 2), "utf-8");
  await writeFile(join(repoRoot, "shared", "package.json"), JSON.stringify({ name: "shared-test" }, null, 2), "utf-8");
  await writeFile(join(repoRoot, "components", "memory-engine", "package.json"), JSON.stringify({ name: "memory-engine-test" }, null, 2), "utf-8");
  await writeFile(join(repoRoot, "COO", "node_modules", ".bin", "tsx.cmd"), "echo tsx\r\n", "utf-8");
  await writeFile(join(repoRoot, "shared", "node_modules", "zod", "index.js"), "module.exports = {};\n", "utf-8");
  await writeFile(join(repoRoot, "components", "memory-engine", "dist", "server.js"), "export {};\n", "utf-8");
  await writeFile(join(repoRoot, ".codex", "runtime", "install-state.json"), JSON.stringify({ ok: true }, null, 2), "utf-8");
}

async function cleanupTestRoots(...paths: string[]): Promise<void> {
  for (const target of paths) {
    await rm(target, { recursive: true, force: true });
  }
}

test("runBenchmarkManifest captures verification KPIs and changed-file artifacts", { skip: !gitAvailable() }, async () => {
  const repoRoot = await initTempRepo();
  const outputRoot = await mkdtemp(join(tmpdir(), "adf-implement-plan-artifacts-"));

  try {
    const summary = await runBenchmarkManifest({
      schema_version: 1,
      benchmark_id: "unit-kpis",
      task_summary: "Validate KPI-rich benchmark summary.",
      instructions: "Implement the lane and return a compact report.",
      output_root: outputRoot,
      execution_policy: {
        max_review_cycles: 2,
        skip_human_testing: true,
      },
      verification_commands: [
        {
          id: "artifact-check",
          label: "artifact check",
          command: process.execPath,
          args: ["-e", "const fs=require('node:fs'); process.exit(fs.existsSync('docs/phase1/feature/artifact.txt')?0:1);"],
          cwd: ".",
          timeout_ms: 5_000,
        },
      ],
      artifact_policy: {
        required_paths: ["docs/phase1/feature/artifact.txt", "docs/phase1/feature/completion-summary.md"],
        allowed_edit_prefixes: ["docs/phase1/feature/"],
        required_changed_prefixes: ["docs/phase1/feature/"],
      },
      engines: [
        { id: "codex-default", display_name: "Codex GPT-5.4", cli: "codex", model: "gpt-5.4", reasoning: "xhigh", bypass: true },
      ],
    }, {
      repo_root: repoRoot,
      invoke_fn: async (params) => {
        const workdir = params.working_directory ?? assert.fail("Expected working directory.");
        await writeFile(join(workdir, "docs", "phase1", "feature", "artifact.txt"), "ok\n", "utf-8");
        await writeFile(join(workdir, "docs", "phase1", "feature", "completion-summary.md"), "# done\n", "utf-8");
        return buildStubInvocationResult(params, "kpi-pass", "summary: ok");
      },
    });

    assert.equal(summary.totals.success_count, 1);
    assert.equal(summary.lanes[0]?.status, "succeeded", JSON.stringify(summary.lanes[0], null, 2));
    assert.equal(summary.lanes[0]?.review_cycle_count, 1);
    assert.equal(summary.lanes[0]?.verification_status, "passed");
    assert.ok((summary.lanes[0]?.total_tokens_estimated ?? 0) > 0);
    assert.ok(summary.lanes[0]?.changed_paths.includes("docs/phase1/feature/artifact.txt"));
    assert.equal(summary.lanes[0]?.artifact_quality.rating, "strong");
    assert.equal(summary.lanes[0]?.phase_metrics.human_testing_skipped, true);
    assert.ok((summary.lanes[0]?.phase_metrics.machine_verification_ms ?? 0) >= 0);

    const laneSummary = JSON.parse(await readFile(summary.lanes[0]!.lane_summary_path, "utf-8"));
    assert.equal(laneSummary.artifact_quality.signals.required_paths_present, 2);
    const request = JSON.parse(await readFile(summary.lanes[0]!.final_request_path!, "utf-8"));
    assert.equal(request.invocation.access_mode, "non_interactive_full_access");
  } finally {
    await cleanupTestRoots(outputRoot, repoRoot);
  }
});

test("runBenchmarkManifest retries until verification passes or the cycle cap is reached", { skip: !gitAvailable() }, async () => {
  const repoRoot = await initTempRepo();
  const outputRoot = await mkdtemp(join(tmpdir(), "adf-implement-plan-artifacts-"));
  const calls = new Map<string, number>();

  try {
    const summary = await runBenchmarkManifest({
      schema_version: 1,
      benchmark_id: "retry-loop",
      task_summary: "Validate multi-cycle repair behavior.",
      instructions: "Fix the failing verification command.",
      output_root: outputRoot,
      execution_policy: {
        max_review_cycles: 3,
        skip_human_testing: true,
      },
      verification_commands: [
        {
          id: "state-check",
          label: "state check",
          command: process.execPath,
          args: ["-e", "const fs=require('node:fs'); const value=fs.readFileSync('state.txt','utf8').trim(); process.exit(value==='fixed'?0:1);"],
          cwd: ".",
          timeout_ms: 5_000,
        },
      ],
      engines: [
        { id: "codex-default", cli: "codex", model: "gpt-5.4", reasoning: "xhigh" },
      ],
    }, {
      repo_root: repoRoot,
      invoke_fn: async (params) => {
        const workdir = params.working_directory ?? assert.fail("Expected working directory.");
        const count = (calls.get(workdir) ?? 0) + 1;
        calls.set(workdir, count);
        await writeFile(join(workdir, "state.txt"), count === 1 ? "broken\n" : "fixed\n", "utf-8");
        return buildStubInvocationResult(params, `retry-${count}`, `cycle ${count}`);
      },
    });

    assert.equal(summary.lanes[0]?.status, "succeeded");
    assert.equal(summary.lanes[0]?.review_cycle_count, 2);
    assert.equal(summary.rankings.fewest_review_cycles_success_lane_id, "codex-default");

    const cycles = JSON.parse(await readFile(summary.lanes[0]!.cycles_path, "utf-8"));
    assert.equal(cycles.length, 2);
    assert.equal(cycles[0].verification_status, "failed");
    assert.equal(cycles[1].verification_status, "passed");
  } finally {
    await cleanupTestRoots(outputRoot, repoRoot);
  }
});

test("runBenchmarkManifest skips blocked lanes without taking down successful lanes", { skip: !gitAvailable() }, async () => {
  const repoRoot = await initTempRepo();
  const outputRoot = await mkdtemp(join(tmpdir(), "adf-implement-plan-artifacts-"));

  try {
    const summary = await runBenchmarkManifest({
      schema_version: 1,
      benchmark_id: "blocked-lane",
      task_summary: "Validate blocker classification.",
      instructions: "Implement the lane in the current worktree.",
      output_root: outputRoot,
      execution_policy: {
        max_review_cycles: 2,
        skip_human_testing: true,
      },
      verification_commands: [
        {
          id: "artifact-check",
          label: "artifact check",
          command: process.execPath,
          args: ["-e", "const fs=require('node:fs'); process.exit(fs.existsSync('artifact.txt')?0:1);"],
          cwd: ".",
          timeout_ms: 5_000,
        },
      ],
      engines: [
        { id: "codex-default", cli: "codex", model: "gpt-5.4", reasoning: "xhigh" },
        { id: "claude-opus", cli: "claude", model: "opus-4.6", effort: "max" },
      ],
    }, {
      repo_root: repoRoot,
      invoke_fn: async (params) => {
        if (params.cli === "claude") {
          throw new Error("Authentication required. Please login to Claude before running this lane.");
        }
        const workdir = params.working_directory ?? assert.fail("Expected working directory.");
        await writeFile(join(workdir, "artifact.txt"), "ok\n", "utf-8");
        return buildStubInvocationResult(params, "success-lane", "ok");
      },
    });

    assert.equal(summary.totals.success_count, 1);
    assert.equal(summary.totals.blocked_count, 1);
    assert.equal(summary.totals.failure_count, 0);
    const blockedLane = summary.lanes.find((lane) => lane.lane_id === "claude-opus");
    assert.equal(blockedLane?.status, "blocked_skipped");
    assert.equal(blockedLane?.blocker_kind, "provider_auth");
  } finally {
    await cleanupTestRoots(outputRoot, repoRoot);
  }
});

test("runBenchmarkManifest classifies model lookup failures ahead of credential noise", { skip: !gitAvailable() }, async () => {
  const repoRoot = await initTempRepo();
  const outputRoot = await mkdtemp(join(tmpdir(), "adf-implement-plan-artifacts-"));

  try {
    const summary = await runBenchmarkManifest({
      schema_version: 1,
      benchmark_id: "model-unavailable",
      task_summary: "Validate model-unavailable blocker classification.",
      instructions: "Implement the lane in the current worktree.",
      output_root: outputRoot,
      execution_policy: {
        max_review_cycles: 6,
        skip_human_testing: true,
      },
      engines: [
        { id: "gemini-pro", cli: "gemini", model: "gemini-3.1-pro" },
      ],
    }, {
      repo_root: repoRoot,
      invoke_fn: async () => {
        throw new Error(
          "Loaded cached credentials. ModelNotFoundError: Requested entity was not found.",
        );
      },
    });

    assert.equal(summary.lanes[0]?.status, "blocked_skipped");
    assert.equal(summary.lanes[0]?.review_cycle_count, 1);
    assert.equal(summary.lanes[0]?.blocker_kind, "model_unavailable");
  } finally {
    await cleanupTestRoots(outputRoot, repoRoot);
  }
});

test("runBenchmarkManifest blocks provider execution failures without burning all review cycles", { skip: !gitAvailable() }, async () => {
  const repoRoot = await initTempRepo();
  const outputRoot = await mkdtemp(join(tmpdir(), "adf-implement-plan-artifacts-"));

  try {
    const summary = await runBenchmarkManifest({
      schema_version: 1,
      benchmark_id: "provider-execution-failure",
      task_summary: "Validate provider execution blocker classification.",
      instructions: "Implement the lane in the current worktree.",
      output_root: outputRoot,
      execution_policy: {
        max_review_cycles: 6,
        skip_human_testing: true,
      },
      engines: [
        { id: "claude-opus", cli: "claude", model: "opus-4.6", effort: "max" },
      ],
    }, {
      repo_root: repoRoot,
      invoke_fn: async () => {
        throw new Error("claude failed (exit 1): ");
      },
    });

    assert.equal(summary.lanes[0]?.status, "blocked_skipped");
    assert.equal(summary.lanes[0]?.review_cycle_count, 1);
    assert.equal(summary.lanes[0]?.blocker_kind, "provider_execution_failed");
  } finally {
    await cleanupTestRoots(outputRoot, repoRoot);
  }
});

test("runBenchmarkManifest provisions isolated git worktrees per lane", { skip: !gitAvailable() }, async () => {
  const repoRoot = await initTempRepo();
  const outputRoot = await mkdtemp(join(tmpdir(), "adf-implement-plan-artifacts-"));
  const seenWorkingDirectories = new Set<string>();

  try {
    const summary = await runBenchmarkManifest({
      schema_version: 1,
      benchmark_id: "isolated-worktrees",
      task_summary: "Verify each lane gets its own worktree.",
      instructions: "Return compact JSON only.",
      output_root: outputRoot,
      isolation: {
        mode: "git_worktree",
        target_slug: "coo-freeze-to-cto-admission-wiring",
        base_ref: "HEAD",
      },
      verification_commands: [
        {
          id: "tracked-check",
          label: "tracked file check",
          command: process.execPath,
          args: ["-e", "const fs=require('node:fs'); process.exit(fs.existsSync('tracked.txt')?0:1);"],
          cwd: ".",
          timeout_ms: 5_000,
        },
      ],
      engines: [
        { id: "codex-baseline", cli: "codex", model: "gpt-5.4", reasoning: "xhigh" },
        { id: "claude-opus", cli: "claude", model: "opus-4.6", effort: "max" },
      ],
    }, {
      repo_root: repoRoot,
      invoke_fn: async (params) => {
        const workingDirectory = params.working_directory ?? assert.fail("Expected working_directory for isolated lane.");
        seenWorkingDirectories.add(workingDirectory);
        const trackedText = await readFile(join(workingDirectory, "tracked.txt"), "utf-8");
        assert.match(trackedText, /^base\r?\n$/);
        await writeFile(join(workingDirectory, "lane-marker.txt"), params.cli, "utf-8");
        return buildStubInvocationResult(params, `${params.cli}-worktree-id`, "ok");
      },
    });

    assert.equal(summary.isolation.mode, "git_worktree");
    assert.equal(summary.isolation.base_ref, "HEAD");
    assert.equal(seenWorkingDirectories.size, 2);

    for (const lane of summary.lanes) {
      assert.equal(lane.status, "succeeded");
      assert.equal(lane.working_directory.includes("coo-freeze-to-cto-admission-wiring"), true);
      const trackedText = await readFile(join(lane.working_directory, "tracked.txt"), "utf-8");
      assert.match(trackedText, /^base\r?\n$/);
    }
  } finally {
    await cleanupTestRoots(outputRoot, repoRoot);
  }
});

test("runBenchmarkManifest prewarms isolated worktrees with runtime dependencies and install state", { skip: !gitAvailable() }, async () => {
  const repoRoot = await initTempRepo();
  const outputRoot = await mkdtemp(join(tmpdir(), "adf-implement-plan-artifacts-"));
  await seedRuntimeArtifacts(repoRoot);

  try {
    const summary = await runBenchmarkManifest({
      schema_version: 1,
      benchmark_id: "prewarmed-worktrees",
      task_summary: "Verify isolated worktrees inherit runnable runtime artifacts.",
      instructions: "Return compact JSON only.",
      output_root: outputRoot,
      isolation: {
        mode: "git_worktree",
        target_slug: "implement-plan-benchmark-worktree-stabilization",
        base_ref: "HEAD",
      },
      verification_commands: [
        {
          id: "tracked-check",
          label: "tracked file check",
          command: process.execPath,
          args: ["-e", "const fs=require('node:fs'); process.exit(fs.existsSync('tracked.txt')?0:1);"],
          cwd: ".",
          timeout_ms: 5_000,
        },
      ],
      engines: [
        { id: "codex-baseline", cli: "codex", model: "gpt-5.4", reasoning: "xhigh" },
      ],
    }, {
      repo_root: repoRoot,
      invoke_fn: async (params) => {
        const workingDirectory = params.working_directory ?? assert.fail("Expected working_directory for isolated lane.");
        await access(join(workingDirectory, "COO", "node_modules", ".bin", "tsx.cmd"), constants.F_OK);
        await access(join(workingDirectory, "shared", "node_modules", "zod", "index.js"), constants.F_OK);
        await access(join(workingDirectory, "components", "memory-engine", "dist", "server.js"), constants.F_OK);
        await access(join(workingDirectory, ".codex", "runtime", "install-state.json"), constants.F_OK);
        await writeFile(join(workingDirectory, "artifact.txt"), "ok\n", "utf-8");
        return buildStubInvocationResult(params, "prewarmed-worktree", "ok");
      },
    });

    assert.equal(summary.lanes[0]?.status, "succeeded");
    assert.equal(summary.lanes[0]?.verification_status, "passed");
  } finally {
    await cleanupTestRoots(outputRoot, repoRoot);
  }
});

test("runBenchmarkManifest stops at the global cutoff and resumes with the persisted session handle", { skip: !gitAvailable() }, async () => {
  const repoRoot = await initTempRepo();
  const outputRoot = await mkdtemp(join(tmpdir(), "adf-implement-plan-artifacts-"));
  const seenSessionIds: Array<string | null> = [];
  const runState = new Map<string, number>();

  try {
    const manifest = {
      schema_version: 1 as const,
      benchmark_id: "global-cutoff-resume",
      task_summary: "Validate global cutoff resume flow.",
      instructions: "Fix the verification failure without asking for approval.",
      output_root: outputRoot,
      execution_policy: {
        max_review_cycles: 3,
        skip_human_testing: true,
      },
      verification_commands: [
        {
          id: "state-check",
          label: "state check",
          command: process.execPath,
          args: ["-e", "const fs=require('node:fs'); const value=fs.readFileSync('state.txt','utf8').trim(); process.exit(value==='fixed'?0:1);"],
          cwd: ".",
          timeout_ms: 5_000,
        },
      ],
      engines: [
        { id: "codex-default", cli: "codex" as const, model: "gpt-5.4", reasoning: "xhigh", bypass: true },
      ],
    };

    const firstSummary = await runBenchmarkManifest(manifest, {
      repo_root: repoRoot,
      deadline_at_ms: Date.now() + 200,
      invoke_fn: async (params) => {
        const workdir = params.working_directory ?? assert.fail("Expected working directory.");
        const count = (runState.get(workdir) ?? 0) + 1;
        runState.set(workdir, count);
        seenSessionIds.push(params.session?.handle?.session_id ?? null);
        await new Promise((resolve) => setTimeout(resolve, 250));
        await writeFile(join(workdir, "state.txt"), "broken\n", "utf-8");
        return {
          ...buildStubInvocationResult(params, `cutoff-${count}`, `cycle ${count}`),
          session: {
            handle: {
              provider: "codex",
              model: params.model,
              session_id: "agent-uuid-1",
              source: "provider_returned",
            },
            status: count === 1 ? "fresh" : "resumed",
          },
        };
      },
    });

    assert.equal(firstSummary.lanes[0]?.status, "global_cutoff_reached");
    assert.equal(firstSummary.lanes[0]?.review_cycle_count, 1);
    assert.equal(firstSummary.lanes[0]?.latest_session_handle?.session_id, "agent-uuid-1");
    assert.equal(firstSummary.lanes[0]?.resume_supported, true);
    assert.equal(seenSessionIds[0], null);

    const resumedSummary = await runBenchmarkManifest(manifest, {
      repo_root: repoRoot,
      resume_run_root: firstSummary.run_root,
      deadline_at_ms: Date.now() + 5_000,
      invoke_fn: async (params) => {
        const workdir = params.working_directory ?? assert.fail("Expected working directory.");
        const count = (runState.get(workdir) ?? 0) + 1;
        runState.set(workdir, count);
        seenSessionIds.push(params.session?.handle?.session_id ?? null);
        await writeFile(join(workdir, "state.txt"), "fixed\n", "utf-8");
        return {
          ...buildStubInvocationResult(params, `resume-${count}`, `cycle ${count}`),
          session: {
            handle: {
              provider: "codex",
              model: params.model,
              session_id: "agent-uuid-1",
              source: "provider_returned",
            },
            status: "resumed",
          },
        };
      },
    });

    assert.equal(resumedSummary.lanes[0]?.status, "succeeded");
    assert.equal(resumedSummary.lanes[0]?.review_cycle_count, 2);
    assert.equal(seenSessionIds[1], "agent-uuid-1");
    assert.equal(resumedSummary.global_cutoff_at !== null, true);
    assert.ok((resumedSummary.lanes[0]?.phase_metrics.self_fix_cycle_count ?? 0) >= 1);
  } finally {
    await cleanupTestRoots(outputRoot, repoRoot);
  }
});
