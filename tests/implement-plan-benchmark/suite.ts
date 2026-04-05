import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBenchmarkManifest } from "./harness.js";

interface SuiteEntrySummary {
  manifest_path: string;
  benchmark_id: string | null;
  status: "completed" | "failed";
  run_root: string | null;
  success_count: number | null;
  blocked_count: number | null;
  failure_count: number | null;
  max_cycles_exhausted_count: number | null;
  error_message: string | null;
}

interface SuiteSummary {
  suite_id: string;
  started_at: string;
  finished_at: string;
  global_cutoff_at: string | null;
  resumed_from_suite_root: string | null;
  manifests: SuiteEntrySummary[];
}

interface SuiteRunOptions {
  repo_root?: string;
  deadline_at_ms?: number;
  run_manifest_fn?: (manifestPath: string, rawManifest: unknown) => Promise<{
    benchmark_id: string;
    run_root: string;
    totals: {
      success_count: number;
      blocked_count: number;
      failure_count: number;
      max_cycles_exhausted_count: number;
    };
  }>;
}

const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const defaultFeatureManifests = [
  "tests/implement-plan-benchmark/coo-freeze-to-cto-admission-wiring.manifest.json",
  "tests/implement-plan-benchmark/coo-live-executive-status-wiring.manifest.json",
];

function fail(message: string): never {
  throw new Error(message);
}

function isoStampForPath(iso: string): string {
  return iso.replace(/:/g, "-").replace(/\./g, "_");
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
}

async function loadManifest(manifestPath: string): Promise<unknown> {
  return JSON.parse(await readFile(manifestPath, "utf-8"));
}

function renderHelp(): string {
  return [
    "Usage:",
    "  tsx tests/implement-plan-benchmark/suite.ts help",
    "  tsx tests/implement-plan-benchmark/suite.ts run-current-phase1 [--global-cutoff-minutes <n>]",
    "  tsx tests/implement-plan-benchmark/suite.ts run --manifests <manifest-a.json,manifest-b.json> [--global-cutoff-minutes <n>]",
    "  tsx tests/implement-plan-benchmark/suite.ts resume --suite-root <path> [--global-cutoff-minutes <n>]",
    "",
    "Notes:",
    "  - run-current-phase1 launches both current benchmark features in parallel.",
    "  - Each feature still runs its own full model matrix in parallel inside the harness.",
    "  - The suite writes one top-level suite summary and points to each benchmark run root.",
    "  - A suite-level global cutoff applies one shared absolute deadline across all feature benchmarks.",
  ].join("\n");
}

function parseCliArgs(argv: string[]): { command: string; values: Record<string, string> } {
  const values: Record<string, string> = {};
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) fail(`Missing value for --${key}.`);
    values[key] = next;
    index += 1;
  }
  return { command: positionals[0] ?? "help", values };
}

export async function runSuite(manifestPaths: string[], options: SuiteRunOptions = {}): Promise<SuiteSummary> {
  const effectiveRepoRoot = options.repo_root ?? repoRoot;
  const startedAt = new Date().toISOString();
  const suiteId = `suite-${isoStampForPath(startedAt)}`;
  const suiteRoot = resolve(effectiveRepoRoot, "tests", "artifacts", "implement-plan-benchmark", "suites", suiteId);
  await mkdir(suiteRoot, { recursive: true });

  const settled = await Promise.allSettled(
    manifestPaths.map(async (manifestPath) => {
      const absoluteManifestPath = resolve(effectiveRepoRoot, manifestPath);
      const rawManifest = await loadManifest(absoluteManifestPath);
      const summary = options.run_manifest_fn
        ? await options.run_manifest_fn(absoluteManifestPath, rawManifest)
        : await runBenchmarkManifest(rawManifest, {
          manifest_path: absoluteManifestPath,
          deadline_at_ms: options.deadline_at_ms,
        });
      return {
        manifest_path: absoluteManifestPath,
        benchmark_id: summary.benchmark_id,
        status: "completed" as const,
        run_root: summary.run_root,
        success_count: summary.totals.success_count,
        blocked_count: summary.totals.blocked_count,
        failure_count: summary.totals.failure_count,
        max_cycles_exhausted_count: summary.totals.max_cycles_exhausted_count,
        error_message: null,
      };
    }),
  );

  const manifests: SuiteEntrySummary[] = settled.map((result, index) => {
    const manifestPath = resolve(effectiveRepoRoot, manifestPaths[index]!);
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      manifest_path: manifestPath,
      benchmark_id: null,
      status: "failed",
      run_root: null,
      success_count: null,
      blocked_count: null,
      failure_count: null,
      max_cycles_exhausted_count: null,
      error_message: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
  });

  const summary: SuiteSummary = {
    suite_id: suiteId,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    global_cutoff_at: options.deadline_at_ms ? new Date(options.deadline_at_ms).toISOString() : null,
    resumed_from_suite_root: null,
    manifests,
  };
  await writeJson(resolve(suiteRoot, "suite-summary.json"), summary);
  return summary;
}

export async function resumeSuite(suiteRoot: string, options: SuiteRunOptions = {}): Promise<SuiteSummary> {
  const effectiveRepoRoot = options.repo_root ?? repoRoot;
  const existingSummaryPath = resolve(suiteRoot, "suite-summary.json");
  const existingSummary = JSON.parse(await readFile(existingSummaryPath, "utf-8")) as SuiteSummary;
  const startedAt = existingSummary.started_at ?? new Date().toISOString();
  const manifests = await Promise.all(existingSummary.manifests.map(async (entry) => {
    const rawManifest = await loadManifest(entry.manifest_path);
    const summary = options.run_manifest_fn
      ? await options.run_manifest_fn(entry.manifest_path, rawManifest)
      : await runBenchmarkManifest(rawManifest, {
        manifest_path: entry.manifest_path,
        resume_run_root: entry.run_root ?? undefined,
        deadline_at_ms: options.deadline_at_ms,
      });
    return {
      manifest_path: entry.manifest_path,
      benchmark_id: summary.benchmark_id,
      status: "completed" as const,
      run_root: summary.run_root,
      success_count: summary.totals.success_count,
      blocked_count: summary.totals.blocked_count,
      failure_count: summary.totals.failure_count,
      max_cycles_exhausted_count: summary.totals.max_cycles_exhausted_count,
      error_message: null,
    };
  }));
  const resumedSummary: SuiteSummary = {
    suite_id: existingSummary.suite_id,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    global_cutoff_at: options.deadline_at_ms ? new Date(options.deadline_at_ms).toISOString() : null,
    resumed_from_suite_root: suiteRoot,
    manifests,
  };
  await writeJson(existingSummaryPath, resumedSummary);
  return resumedSummary;
}

function parseOptionalGlobalCutoffMinutes(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) fail("--global-cutoff-minutes must be a positive integer.");
  return parsed;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const globalCutoffMinutes = parseOptionalGlobalCutoffMinutes(args.values["global-cutoff-minutes"]);
  const deadlineAtMs = globalCutoffMinutes ? Date.now() + (globalCutoffMinutes * 60_000) : undefined;
  if (args.command === "help") {
    console.log(renderHelp());
    return;
  }
  if (args.command === "run-current-phase1") {
    console.log(JSON.stringify(await runSuite(defaultFeatureManifests, { deadline_at_ms: deadlineAtMs }), null, 2));
    return;
  }
  if (args.command === "run") {
    const rawList = args.values.manifests ?? fail("Missing --manifests.");
    const manifestPaths = rawList.split(",").map((entry) => entry.trim()).filter(Boolean);
    if (manifestPaths.length === 0) fail("No manifest paths provided.");
    console.log(JSON.stringify(await runSuite(manifestPaths, { deadline_at_ms: deadlineAtMs }), null, 2));
    return;
  }
  if (args.command === "resume") {
    const suiteRoot = args.values["suite-root"] ? resolve(process.cwd(), args.values["suite-root"]) : fail("Missing --suite-root.");
    console.log(JSON.stringify(await resumeSuite(suiteRoot, { deadline_at_ms: deadlineAtMs }), null, 2));
    return;
  }
  fail(`Unknown command '${args.command}'. Use help, run-current-phase1, run, or resume.`);
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (executedPath === fileURLToPath(import.meta.url)) {
  void main();
}

assert.ok(repoRoot);
