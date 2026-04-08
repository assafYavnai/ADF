import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { invoke } from "../../shared/llm-invoker/invoker.js";
import { runManagedProcess } from "../../shared/llm-invoker/managed-process.js";
import type {
  InvocationAttempt,
  InvocationParams,
  InvocationResult,
  InvocationSessionHandle,
  InvocationUsageEstimate,
} from "../../shared/llm-invoker/types.js";

type BenchmarkProvider = "codex" | "claude" | "gemini";
type LaneStatus = "succeeded" | "failed" | "blocked_skipped" | "max_cycles_exhausted" | "global_cutoff_reached";
type VerificationStatus = "not_run" | "not_configured" | "passed" | "failed" | "blocked" | "global_cutoff_reached";
type VerificationCommandStatus = "passed" | "failed" | "blocked" | "optional_failed" | "cutoff";
type BlockerKind =
  | "provider_unavailable"
  | "provider_execution_failed"
  | "provider_auth"
  | "model_unavailable"
  | "verification_command_unavailable"
  | "verification_cwd_missing"
  | "workspace_preparation_failed"
  | "global_cutoff_reached";

interface BenchmarkLaneManifest {
  id: string;
  display_name?: string;
  cli: BenchmarkProvider;
  model: string;
  reasoning?: string;
  effort?: string;
  bypass?: boolean;
  timeout_ms?: number;
}

interface BenchmarkIsolationManifest {
  mode?: "none" | "git_worktree";
  target_slug?: string;
  base_ref?: string;
  worktree_root?: string;
}

interface BenchmarkExecutionPolicyManifest {
  max_review_cycles?: number;
  skip_human_testing?: boolean;
  global_cutoff_minutes?: number;
}

interface BenchmarkVerificationCommandManifest {
  id?: string;
  label?: string;
  command: string;
  args?: string[];
  cwd?: string;
  timeout_ms?: number;
  optional?: boolean;
}

interface BenchmarkArtifactPolicyManifest {
  required_paths?: string[];
  required_changed_prefixes?: string[];
  allowed_edit_prefixes?: string[];
  forbidden_edit_prefixes?: string[];
}

interface BenchmarkManifest {
  schema_version: 1;
  benchmark_id: string;
  description?: string;
  task_summary: string;
  instructions?: string;
  instructions_path?: string;
  context_files?: string[];
  response_requirements?: string;
  telemetry_metadata?: Record<string, unknown>;
  engines: BenchmarkLaneManifest[];
  isolation?: BenchmarkIsolationManifest;
  execution_policy?: BenchmarkExecutionPolicyManifest;
  verification_commands?: BenchmarkVerificationCommandManifest[];
  artifact_policy?: BenchmarkArtifactPolicyManifest;
  output_root?: string;
}

interface ResolvedContextFile {
  requested_path: string;
  resolved_path: string;
  content: string;
}

interface ResolvedVerificationCommand {
  id: string;
  label: string;
  command: string;
  args: string[];
  cwd: string;
  timeout_ms: number;
  optional: boolean;
}

interface ResolvedArtifactPolicy {
  required_paths: string[];
  required_changed_prefixes: string[];
  allowed_edit_prefixes: string[];
  forbidden_edit_prefixes: string[];
}

interface ResolvedBenchmarkManifest {
  schema_version: 1;
  benchmark_id: string;
  description: string | null;
  task_summary: string;
  instructions: string;
  instructions_path: string | null;
  context_files: ResolvedContextFile[];
  response_requirements: string | null;
  telemetry_metadata: Record<string, unknown>;
  engines: BenchmarkLaneManifest[];
  isolation: {
    mode: "none" | "git_worktree";
    target_slug: string | null;
    base_ref: string | null;
    worktree_root: string | null;
  };
  execution_policy: {
    max_review_cycles: number;
    skip_human_testing: boolean;
    global_cutoff_minutes: number | null;
  };
  verification_commands: ResolvedVerificationCommand[];
  artifact_policy: ResolvedArtifactPolicy;
  output_root: string;
}

interface BenchmarkRunOptions {
  repo_root?: string;
  manifest_path?: string;
  resume_run_root?: string;
  deadline_at_ms?: number;
  invoke_fn?: (params: InvocationParams) => Promise<InvocationResult>;
}

interface BenchmarkPhaseMetricsSummary {
  workspace_preparation_ms: number;
  implementation_invocation_ms: number;
  machine_verification_ms: number;
  self_fix_cycle_count: number;
  self_fix_wall_clock_ms: number;
  self_fix_invocation_ms: number;
  self_fix_verification_ms: number;
  audit_ms: number | null;
  review_ms: number | null;
  human_testing_ms: number | null;
  human_testing_skipped: boolean;
  time_to_first_green_ms: number | null;
}

interface PersistedLaneState {
  schema_version: 1;
  benchmark_id: string;
  lane_id: string;
  started_at: string;
  updated_at: string;
  status: "running" | LaneStatus;
  workspace: PreparedLaneWorkspace | null;
  workspace_preparation_ms: number;
  session_handle: InvocationSessionHandle | null;
  next_cycle_number: number;
  feedback: string | null;
  verification_failures: string[];
  final_response_path: string | null;
  final_result_path: string | null;
  final_request_path: string | null;
  final_verification_path: string | null;
}

interface PreparedLaneWorkspace {
  isolation_mode: "none" | "git_worktree";
  working_directory: string;
  worktree_path: string | null;
  base_ref: string | null;
  starting_head_sha: string | null;
}

interface BenchmarkCycleSummary {
  cycle_number: number;
  started_at: string;
  finished_at: string;
  cycle_wall_clock_ms: number;
  prompt_path: string;
  request_path: string;
  response_path: string | null;
  result_path: string;
  verification_path: string | null;
  invocation_status: "succeeded" | "failed" | "blocked";
  verification_status: VerificationStatus;
  llm_latency_ms: number | null;
  invocation_attempt_count: number;
  estimated_cost_usd: number | null;
  prompt_tokens_estimated: number | null;
  response_tokens_estimated: number | null;
  total_tokens_estimated: number | null;
  verification_latency_ms: number;
  session_handle: InvocationSessionHandle | null;
  error_message: string | null;
  blocker_kind: BlockerKind | null;
  blocker_reason: string | null;
  verification_failures: string[];
}

interface VerificationCommandResult {
  id: string;
  label: string;
  command: string;
  args: string[];
  cwd: string;
  optional: boolean;
  status: VerificationCommandStatus;
  exit_code: number | null;
  latency_ms: number;
  stdout: string;
  stderr: string;
  error_message: string | null;
  blocker_kind: BlockerKind | null;
}

interface VerificationRunSummary {
  status: VerificationStatus;
  results: VerificationCommandResult[];
  failures: string[];
  blocker_kind: BlockerKind | null;
  blocker_reason: string | null;
}

interface ArtifactQualitySummary {
  score: number;
  rating: "strong" | "partial" | "weak";
  rubric_version: "heuristic_v1";
  notes: string[];
  signals: {
    verification_passed: boolean;
    changed_file_count: number;
    required_paths_total: number;
    required_paths_present: number;
    required_changed_prefixes_total: number;
    required_changed_prefixes_satisfied: number;
    allowed_surface_violations: string[];
    forbidden_surface_violations: string[];
  };
}

interface BenchmarkLaneSummary {
  lane_id: string;
  display_name: string | null;
  cli: BenchmarkProvider;
  model: string;
  reasoning: string | null;
  effort: string | null;
  isolation_mode: "none" | "git_worktree";
  working_directory: string;
  worktree_path: string | null;
  base_ref: string | null;
  starting_head_sha: string | null;
  status: LaneStatus;
  cycle_wall_clock_ms: number;
  total_llm_latency_ms: number;
  review_cycle_count: number;
  invocation_attempt_count: number;
  verification_status: VerificationStatus;
  blocker_kind: BlockerKind | null;
  blocker_reason: string | null;
  error_message: string | null;
  estimated_cost_usd: number | null;
  prompt_tokens_estimated: number | null;
  response_tokens_estimated: number | null;
  total_tokens_estimated: number | null;
  final_response_path: string | null;
  final_result_path: string | null;
  final_request_path: string | null;
  final_verification_path: string | null;
  lane_summary_path: string;
  cycles_path: string;
  git_status_path: string | null;
  diff_stat_path: string | null;
  diff_patch_path: string | null;
  changed_paths_path: string | null;
  changed_paths: string[];
  verification_failures: string[];
  latest_session_handle: InvocationSessionHandle | null;
  resume_supported: boolean;
  phase_metrics: BenchmarkPhaseMetricsSummary;
  artifact_quality: ArtifactQualitySummary;
}

interface BenchmarkSummary {
  benchmark_id: string;
  description: string | null;
  task_summary: string;
  started_at: string;
  finished_at: string;
  run_root: string;
  resumed_from_run_root: string | null;
  global_cutoff_at: string | null;
  manifest_path: string | null;
  prompt_path: string;
  prompt_chars: number;
  isolation: {
    mode: "none" | "git_worktree";
    target_slug: string | null;
    base_ref: string | null;
    worktree_root: string | null;
  };
  execution_policy: {
    max_review_cycles: number;
    skip_human_testing: boolean;
    global_cutoff_minutes: number | null;
  };
  verification_plan: {
    command_count: number;
    commands: Array<{
      id: string;
      label: string;
      rendered_command: string;
      cwd: string;
      timeout_ms: number;
      optional: boolean;
    }>;
  };
  lanes: BenchmarkLaneSummary[];
  totals: {
    lane_count: number;
    success_count: number;
    failure_count: number;
    blocked_count: number;
    max_cycles_exhausted_count: number;
    global_cutoff_count: number;
    total_estimated_cost_usd: number;
    total_prompt_tokens_estimated: number;
    total_response_tokens_estimated: number;
    total_tokens_estimated: number;
    phase_metrics: BenchmarkPhaseMetricsSummary;
  };
  rankings: {
    fastest_success_lane_id: string | null;
    lowest_cost_success_lane_id: string | null;
    best_quality_lane_id: string | null;
    fewest_review_cycles_success_lane_id: string | null;
  };
}

const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const defaultArtifactsRoot = resolve(repoRoot, "tests", "artifacts", "implement-plan-benchmark");
const defaultVerificationTimeoutMs = 300_000;
const defaultWorkspacePreflightTimeoutMs = 120_000;
const runtimeDiscoveryRoots = ["COO", "shared", "components", "tools"];
const runtimeDiscoveryIgnoredDirectories = new Set([
  ".git",
  ".codex",
  "node_modules",
  "dist",
  "coverage",
  "tests",
  "docs",
  "memory",
  "threads",
  "tmp",
  "dev",
]);

function fail(message: string): never {
  throw new Error(message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertSafeSlug(value: string, label: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    fail(`${label} must match /^[A-Za-z0-9._-]+$/; received '${value}'.`);
  }
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") fail(`Expected boolean value, received '${String(value)}'.`);
  return value;
}

function asOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") fail(`${label} must be a string when provided.`);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asOptionalPositiveInteger(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    fail(`${label} must be a positive integer when provided.`);
  }
  return value;
}

function asStringArray(raw: unknown, label: string): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) fail(`${label} must be an array when provided.`);
  return raw.map((entry, index) => {
    const value = asOptionalString(entry, `${label}[${index}]`);
    if (!value) fail(`${label}[${index}] must be a non-empty string.`);
    return value;
  });
}

function normalizeRepoPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function ensurePrefix(prefix: string): string {
  const normalized = normalizeRepoPath(prefix);
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function parseLaneManifest(raw: unknown, seenIds: Set<string>): BenchmarkLaneManifest {
  if (!isPlainObject(raw)) fail("Each engine entry must be an object.");
  const id = asOptionalString(raw.id, "engine.id");
  const cli = asOptionalString(raw.cli, "engine.cli");
  const model = asOptionalString(raw.model, "engine.model");
  if (!id || !cli || !model) fail("Each engine must define non-empty id, cli, and model values.");
  if (cli !== "codex" && cli !== "claude" && cli !== "gemini") {
    fail(`Unsupported engine cli '${cli}'. Allowed values: codex, claude, gemini.`);
  }
  assertSafeSlug(id, "engine.id");
  if (seenIds.has(id)) fail(`Duplicate engine id '${id}' is not allowed.`);
  seenIds.add(id);
  return {
    id,
    display_name: asOptionalString(raw.display_name, "engine.display_name"),
    cli,
    model,
    reasoning: asOptionalString(raw.reasoning, "engine.reasoning"),
    effort: asOptionalString(raw.effort, "engine.effort"),
    bypass: asBoolean(raw.bypass, false),
    timeout_ms: asOptionalPositiveInteger(raw.timeout_ms, "engine.timeout_ms"),
  };
}

function parseIsolationManifest(
  raw: unknown,
  manifestDirectory: string,
): ResolvedBenchmarkManifest["isolation"] {
  if (raw === undefined) {
    return { mode: "none", target_slug: null, base_ref: null, worktree_root: null };
  }
  if (!isPlainObject(raw)) fail("isolation must be an object when provided.");
  const mode = asOptionalString(raw.mode, "isolation.mode") ?? "none";
  if (mode !== "none" && mode !== "git_worktree") {
    fail(`Unsupported isolation.mode '${mode}'. Allowed values: none, git_worktree.`);
  }
  const targetSlug = asOptionalString(raw.target_slug, "isolation.target_slug");
  if (targetSlug) assertSafeSlug(targetSlug, "isolation.target_slug");
  const baseRef = asOptionalString(raw.base_ref, "isolation.base_ref") ?? null;
  if (mode === "git_worktree" && !baseRef) {
    fail("isolation.base_ref is required when isolation.mode=git_worktree.");
  }
  const worktreeRootInput = asOptionalString(raw.worktree_root, "isolation.worktree_root");
  return {
    mode,
    target_slug: targetSlug ?? null,
    base_ref: baseRef,
    worktree_root: worktreeRootInput ? resolve(manifestDirectory, worktreeRootInput) : null,
  };
}

function parseExecutionPolicyManifest(raw: unknown): ResolvedBenchmarkManifest["execution_policy"] {
  if (raw === undefined) {
    return { max_review_cycles: 1, skip_human_testing: false, global_cutoff_minutes: null };
  }
  if (!isPlainObject(raw)) fail("execution_policy must be an object when provided.");
  const maxReviewCycles = asOptionalPositiveInteger(raw.max_review_cycles, "execution_policy.max_review_cycles") ?? 1;
  if (maxReviewCycles > 6) fail("execution_policy.max_review_cycles cannot exceed 6.");
  const globalCutoffMinutes = asOptionalPositiveInteger(raw.global_cutoff_minutes, "execution_policy.global_cutoff_minutes") ?? null;
  return {
    max_review_cycles: maxReviewCycles,
    skip_human_testing: asBoolean(raw.skip_human_testing, false),
    global_cutoff_minutes: globalCutoffMinutes,
  };
}

function parseVerificationCommands(raw: unknown): ResolvedVerificationCommand[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) fail("verification_commands must be an array when provided.");
  return raw.map((entry, index) => {
    if (!isPlainObject(entry)) fail(`verification_commands[${index}] must be an object.`);
    const command = asOptionalString(entry.command, `verification_commands[${index}].command`);
    if (!command) fail(`verification_commands[${index}].command is required.`);
    return {
      id: asOptionalString(entry.id, `verification_commands[${index}].id`) ?? `verification-${index + 1}`,
      label: asOptionalString(entry.label, `verification_commands[${index}].label`) ?? command,
      command,
      args: entry.args === undefined ? [] : asStringArray(entry.args, `verification_commands[${index}].args`),
      cwd: normalizeRepoPath(asOptionalString(entry.cwd, `verification_commands[${index}].cwd`) ?? "."),
      timeout_ms:
        asOptionalPositiveInteger(entry.timeout_ms, `verification_commands[${index}].timeout_ms`) ?? defaultVerificationTimeoutMs,
      optional: asBoolean(entry.optional, false),
    };
  });
}

function parseArtifactPolicy(raw: unknown): ResolvedArtifactPolicy {
  if (raw === undefined) {
    return {
      required_paths: [],
      required_changed_prefixes: [],
      allowed_edit_prefixes: [],
      forbidden_edit_prefixes: [],
    };
  }
  if (!isPlainObject(raw)) fail("artifact_policy must be an object when provided.");
  return {
    required_paths: asStringArray(raw.required_paths, "artifact_policy.required_paths").map(normalizeRepoPath),
    required_changed_prefixes: asStringArray(raw.required_changed_prefixes, "artifact_policy.required_changed_prefixes").map(ensurePrefix),
    allowed_edit_prefixes: asStringArray(raw.allowed_edit_prefixes, "artifact_policy.allowed_edit_prefixes").map(ensurePrefix),
    forbidden_edit_prefixes: asStringArray(raw.forbidden_edit_prefixes, "artifact_policy.forbidden_edit_prefixes").map(ensurePrefix),
  };
}

async function resolveInstructions(
  raw: BenchmarkManifest,
  manifestDirectory: string,
): Promise<{ text: string; path: string | null }> {
  const inlineInstructions = asOptionalString(raw.instructions, "instructions");
  const instructionsPath = asOptionalString(raw.instructions_path, "instructions_path");
  if (inlineInstructions && instructionsPath) fail("Provide either instructions or instructions_path, not both.");
  if (!inlineInstructions && !instructionsPath) fail("Benchmark manifest must define instructions or instructions_path.");
  if (inlineInstructions) return { text: inlineInstructions, path: null };
  const resolvedPath = resolve(manifestDirectory, instructionsPath!);
  const text = await readFile(resolvedPath, "utf-8");
  if (!text.trim()) fail(`instructions_path resolved to an empty file: ${resolvedPath}`);
  return { text, path: resolvedPath };
}

async function resolveContextFiles(
  rawContextFiles: unknown,
  manifestDirectory: string,
): Promise<ResolvedContextFile[]> {
  if (rawContextFiles === undefined) return [];
  if (!Array.isArray(rawContextFiles)) fail("context_files must be an array when provided.");
  const files: ResolvedContextFile[] = [];
  for (const entry of rawContextFiles) {
    const requestedPath = asOptionalString(entry, "context_files[]");
    if (!requestedPath) fail("context_files entries must be non-empty strings.");
    const resolvedPath = resolve(manifestDirectory, requestedPath);
    const content = await readFile(resolvedPath, "utf-8");
    files.push({ requested_path: requestedPath, resolved_path: resolvedPath, content });
  }
  return files;
}

export async function parseBenchmarkManifest(
  rawManifest: unknown,
  options: { manifest_directory: string } = { manifest_directory: repoRoot },
): Promise<ResolvedBenchmarkManifest> {
  if (!isPlainObject(rawManifest)) fail("Benchmark manifest must be a JSON object.");
  if (rawManifest.schema_version !== 1) fail("Benchmark manifest schema_version must equal 1.");
  const benchmarkId = asOptionalString(rawManifest.benchmark_id, "benchmark_id");
  const taskSummary = asOptionalString(rawManifest.task_summary, "task_summary");
  if (!benchmarkId || !taskSummary) fail("Benchmark manifest must define non-empty benchmark_id and task_summary.");
  assertSafeSlug(benchmarkId, "benchmark_id");
  if (!Array.isArray(rawManifest.engines) || rawManifest.engines.length === 0) {
    fail("Benchmark manifest must define at least one engine.");
  }
  const seenIds = new Set<string>();
  const engines = rawManifest.engines.map((entry) => parseLaneManifest(entry, seenIds));
  const instructions = await resolveInstructions(rawManifest as BenchmarkManifest, options.manifest_directory);
  const contextFiles = await resolveContextFiles(rawManifest.context_files, options.manifest_directory);
  const isolation = parseIsolationManifest(rawManifest.isolation, options.manifest_directory);
  const executionPolicy = parseExecutionPolicyManifest(rawManifest.execution_policy);
  const verificationCommands = parseVerificationCommands(rawManifest.verification_commands);
  const artifactPolicy = parseArtifactPolicy(rawManifest.artifact_policy);
  const outputRoot = asOptionalString(rawManifest.output_root, "output_root")
    ? resolve(options.manifest_directory, asOptionalString(rawManifest.output_root, "output_root")!)
    : defaultArtifactsRoot;
  const telemetryMetadata = isPlainObject(rawManifest.telemetry_metadata)
    ? rawManifest.telemetry_metadata
    : rawManifest.telemetry_metadata === undefined
      ? {}
      : fail("telemetry_metadata must be an object when provided.");
  return {
    schema_version: 1,
    benchmark_id: benchmarkId,
    description: asOptionalString(rawManifest.description, "description") ?? null,
    task_summary: taskSummary,
    instructions: instructions.text,
    instructions_path: instructions.path,
    context_files: contextFiles,
    response_requirements: asOptionalString(rawManifest.response_requirements, "response_requirements") ?? null,
    telemetry_metadata: telemetryMetadata,
    engines,
    isolation,
    execution_policy: executionPolicy,
    verification_commands: verificationCommands,
    artifact_policy: artifactPolicy,
    output_root: outputRoot,
  };
}

function isoStampForPath(iso: string): string {
  return iso.replace(/:/g, "-").replace(/\./g, "_");
}

function renderCommand(command: { command: string; args: string[] }): string {
  return [command.command, ...command.args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg))].join(" ");
}

function buildPrompt(manifest: ResolvedBenchmarkManifest): string {
  const parts: string[] = [];
  parts.push("You are participating in a controlled multi-engine implementation benchmark for the ADF implement-plan workflow.");
  if (manifest.isolation.mode === "git_worktree") {
    parts.push("Every lane runs inside its own isolated git worktree from the same base snapshot.");
  }
  parts.push("");
  parts.push("<benchmark>");
  parts.push(`id: ${manifest.benchmark_id}`);
  if (manifest.description) parts.push(`description: ${manifest.description}`);
  if (manifest.isolation.target_slug) parts.push(`target_slug: ${manifest.isolation.target_slug}`);
  if (manifest.isolation.base_ref) parts.push(`base_ref: ${manifest.isolation.base_ref}`);
  parts.push("</benchmark>");
  parts.push("");
  parts.push("<execution_policy>");
  parts.push(`max_review_cycles: ${manifest.execution_policy.max_review_cycles}`);
  parts.push(`skip_human_testing: ${manifest.execution_policy.skip_human_testing ? "true" : "false"}`);
  parts.push(`global_cutoff_minutes: ${manifest.execution_policy.global_cutoff_minutes ?? "none"}`);
  parts.push("</execution_policy>");
  parts.push("");
  parts.push("<task_summary>");
  parts.push(manifest.task_summary);
  parts.push("</task_summary>");
  parts.push("");
  parts.push("<instructions>");
  parts.push(manifest.instructions);
  parts.push("</instructions>");
  for (const file of manifest.context_files) {
    parts.push("");
    parts.push(`<context_file path="${file.requested_path}">`);
    parts.push(file.content);
    parts.push("</context_file>");
  }
  if (manifest.verification_commands.length > 0) {
    parts.push("");
    parts.push("<machine_verification>");
    parts.push("The harness will run these machine checks after each review cycle:");
    for (const command of manifest.verification_commands) {
      parts.push(`- ${command.label}: ${renderCommand(command)} (cwd=${command.cwd}, timeout_ms=${command.timeout_ms}, optional=${command.optional ? "true" : "false"})`);
    }
    parts.push("</machine_verification>");
  }
  if (
    manifest.artifact_policy.required_paths.length > 0
    || manifest.artifact_policy.required_changed_prefixes.length > 0
    || manifest.artifact_policy.allowed_edit_prefixes.length > 0
    || manifest.artifact_policy.forbidden_edit_prefixes.length > 0
  ) {
    parts.push("");
    parts.push("<artifact_policy>");
    if (manifest.artifact_policy.required_paths.length > 0) parts.push(`required_paths: ${manifest.artifact_policy.required_paths.join(", ")}`);
    if (manifest.artifact_policy.required_changed_prefixes.length > 0) parts.push(`required_changed_prefixes: ${manifest.artifact_policy.required_changed_prefixes.join(", ")}`);
    if (manifest.artifact_policy.allowed_edit_prefixes.length > 0) parts.push(`allowed_edit_prefixes: ${manifest.artifact_policy.allowed_edit_prefixes.join(", ")}`);
    if (manifest.artifact_policy.forbidden_edit_prefixes.length > 0) parts.push(`forbidden_edit_prefixes: ${manifest.artifact_policy.forbidden_edit_prefixes.join(", ")}`);
    parts.push("</artifact_policy>");
  }
  if (manifest.response_requirements) {
    parts.push("");
    parts.push("<response_requirements>");
    parts.push(manifest.response_requirements);
    parts.push("</response_requirements>");
  }
  parts.push("");
  parts.push("Return only your substantive answer for this benchmark run.");
  return parts.join("\n");
}

function buildCyclePrompt(
  basePrompt: string,
  lane: BenchmarkLaneManifest,
  cycleNumber: number,
  maxCycles: number,
  feedback: string | null,
): string {
  const parts = [basePrompt, "", "<lane_execution>"];
  parts.push(`lane_id: ${lane.id}`);
  parts.push(`provider: ${lane.cli}`);
  parts.push(`model: ${lane.model}`);
  parts.push(`review_cycle: ${cycleNumber} of ${maxCycles}`);
  parts.push("Work directly in the current git worktree. Make the code and test changes yourself.");
  parts.push("The harness is invoking you in non-interactive full-access mode for this benchmark lane. Never stop to request permission, approval, or sandbox elevation.");
  parts.push("The harness has already prewarmed local runtime dependencies and built artifacts for this worktree. Do not run install/bootstrap unless machine verification proves it is still required.");
  parts.push("Do not ask for approval. Do not merge, push, or perform human testing.");
  parts.push("If the plan mentions human testing or human verification, treat it as disabled for this benchmark. Stop at machine-verification green.");
  if (feedback) {
    parts.push("</lane_execution>");
    parts.push("");
    parts.push("<previous_cycle_feedback>");
    parts.push(feedback);
    parts.push("</previous_cycle_feedback>");
  } else {
    parts.push("Aim to pass machine verification in this cycle.");
    parts.push("</lane_execution>");
  }
  return parts.join("\n");
}

function extractAttempts(error: unknown): InvocationAttempt[] {
  if (
    error
    && typeof error === "object"
    && "attempts" in error
    && Array.isArray((error as { attempts?: unknown[] }).attempts)
  ) {
    return (error as { attempts: InvocationAttempt[] }).attempts;
  }
  return [];
}

function sumEstimatedCost(attempts: InvocationAttempt[]): number | null {
  if (attempts.length === 0) return null;
  let total = 0;
  let sawCost = false;
  for (const attempt of attempts) {
    const cost = attempt.usage?.estimated_cost_usd;
    if (typeof cost === "number") {
      total += cost;
      sawCost = true;
    }
  }
  return sawCost ? Number(total.toFixed(6)) : null;
}

function lastUsage(
  attempts: InvocationAttempt[],
  fallbackUsage: InvocationUsageEstimate | undefined,
): InvocationUsageEstimate | undefined {
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    if (attempts[index].usage) return attempts[index].usage;
  }
  return fallbackUsage;
}

function sumEstimatedTokens(
  attempts: InvocationAttempt[],
  selector: (usage: InvocationUsageEstimate) => number,
  fallbackUsage: InvocationUsageEstimate | undefined,
): number | null {
  if (attempts.length === 0) return fallbackUsage ? selector(fallbackUsage) : null;
  let sawUsage = false;
  let total = 0;
  for (const attempt of attempts) {
    if (attempt.usage) {
      total += selector(attempt.usage);
      sawUsage = true;
    }
  }
  if (sawUsage) return total;
  return fallbackUsage ? selector(fallbackUsage) : null;
}

function describeGitFailure(result: ReturnType<typeof spawnSync>, fallbackMessage: string): string {
  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
  return stderr || stdout || fallbackMessage;
}

function gitRun(repoRootOrWorktree: string, args: string[], cwd = repoRootOrWorktree): ReturnType<typeof spawnSync> {
  return spawnSync("git", args, { cwd, encoding: "utf-8", windowsHide: true });
}

function gitStdoutOrNull(repoRootOrWorktree: string, args: string[], cwd = repoRootOrWorktree): string | null {
  const result = gitRun(repoRootOrWorktree, args, cwd);
  if (result.status !== 0) return null;
  return typeof result.stdout === "string" ? result.stdout.trim() : null;
}

function resolveEffectiveWorktreesRoot(manifest: ResolvedBenchmarkManifest, runRoot: string): string | null {
  if (manifest.isolation.mode !== "git_worktree") return null;
  return manifest.isolation.worktree_root ?? resolve(runRoot, "worktrees", manifest.isolation.target_slug ?? manifest.benchmark_id);
}

async function prepareLaneWorkspace(
  manifest: ResolvedBenchmarkManifest,
  lane: BenchmarkLaneManifest,
  runRoot: string,
  effectiveRepoRoot: string,
  existingWorkspace?: PreparedLaneWorkspace | null,
): Promise<PreparedLaneWorkspace> {
  if (existingWorkspace?.working_directory && existsSync(existingWorkspace.working_directory)) {
    return existingWorkspace;
  }
  if (manifest.isolation.mode !== "git_worktree") {
    return {
      isolation_mode: "none",
      working_directory: effectiveRepoRoot,
      worktree_path: null,
      base_ref: null,
      starting_head_sha: gitStdoutOrNull(effectiveRepoRoot, ["rev-parse", "HEAD"]),
    };
  }
  const baseRef = manifest.isolation.base_ref!;
  const verifyRepo = gitRun(effectiveRepoRoot, ["rev-parse", "--show-toplevel"]);
  if (verifyRepo.status !== 0) {
    fail(`Benchmark isolation requires a git repo at '${effectiveRepoRoot}': ${describeGitFailure(verifyRepo, "git rev-parse failed.")}`);
  }
  const verifyBaseRef = gitRun(effectiveRepoRoot, ["rev-parse", "--verify", `${baseRef}^{commit}`]);
  if (verifyBaseRef.status !== 0) {
    fail(`Benchmark isolation base_ref '${baseRef}' is not available in '${effectiveRepoRoot}': ${describeGitFailure(verifyBaseRef, "git rev-parse failed.")}`);
  }
  const worktreesRoot = resolveEffectiveWorktreesRoot(manifest, runRoot);
  if (!worktreesRoot) fail("Benchmark isolation did not resolve a worktrees root.");
  mkdirSync(worktreesRoot, { recursive: true });
  const worktreePath = existingWorkspace?.worktree_path ? existingWorkspace.worktree_path : resolve(worktreesRoot, lane.id);
  if (!existsSync(worktreePath)) {
    const addResult = gitRun(effectiveRepoRoot, ["worktree", "add", "--detach", worktreePath, baseRef]);
    if (addResult.status !== 0) {
      fail(`Failed to create lane worktree '${worktreePath}': ${describeGitFailure(addResult, "git worktree add failed.")}`);
    }
  }
  await prewarmLaneWorkspaceRuntime(effectiveRepoRoot, worktreePath);
  await verifyPreparedWorkspace(effectiveRepoRoot, worktreePath);
  return {
    isolation_mode: "git_worktree",
    working_directory: worktreePath,
    worktree_path: worktreePath,
    base_ref: baseRef,
    starting_head_sha: gitStdoutOrNull(worktreePath, ["rev-parse", "HEAD"], worktreePath),
  };
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureParentDirectory(filePath);
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
}

async function loadJsonIfExists<T>(filePath: string): Promise<T | null> {
  if (!existsSync(filePath)) return null;
  return JSON.parse(await readFile(filePath, "utf-8")) as T;
}

function supportsPersistentSession(provider: BenchmarkProvider): boolean {
  return provider === "codex" || provider === "claude";
}

function isTerminalLaneStatus(status: LaneStatus): boolean {
  return status === "succeeded"
    || status === "blocked_skipped"
    || status === "max_cycles_exhausted";
}

function computeRemainingMs(deadlineAtMs: number | null, now = Date.now()): number | null {
  if (deadlineAtMs === null) return null;
  return Math.max(0, deadlineAtMs - now);
}

function deriveEffectiveTimeoutMs(configuredTimeoutMs: number | undefined, deadlineAtMs: number | null): number | undefined {
  const remainingMs = computeRemainingMs(deadlineAtMs);
  if (remainingMs === null) return configuredTimeoutMs;
  if (configuredTimeoutMs === undefined) return remainingMs;
  return Math.max(1, Math.min(configuredTimeoutMs, remainingMs));
}

function isGlobalCutoffReached(deadlineAtMs: number | null, now = Date.now()): boolean {
  const remainingMs = computeRemainingMs(deadlineAtMs, now);
  return remainingMs !== null && remainingMs <= 0;
}

function createPhaseMetricsSummary(
  workspacePreparationMs: number,
  implementationInvocationMs: number,
  machineVerificationMs: number,
  selfFixCycleCount: number,
  selfFixWallClockMs: number,
  selfFixInvocationMs: number,
  selfFixVerificationMs: number,
  humanTestingSkipped: boolean,
  timeToFirstGreenMs: number | null,
): BenchmarkPhaseMetricsSummary {
  return {
    workspace_preparation_ms: workspacePreparationMs,
    implementation_invocation_ms: implementationInvocationMs,
    machine_verification_ms: machineVerificationMs,
    self_fix_cycle_count: selfFixCycleCount,
    self_fix_wall_clock_ms: selfFixWallClockMs,
    self_fix_invocation_ms: selfFixInvocationMs,
    self_fix_verification_ms: selfFixVerificationMs,
    audit_ms: null,
    review_ms: null,
    human_testing_ms: null,
    human_testing_skipped: humanTestingSkipped,
    time_to_first_green_ms: timeToFirstGreenMs,
  };
}

function sumPhaseMetrics(lanes: BenchmarkLaneSummary[], humanTestingSkipped: boolean): BenchmarkPhaseMetricsSummary {
  const total = createPhaseMetricsSummary(0, 0, 0, 0, 0, 0, 0, humanTestingSkipped, null);
  for (const lane of lanes) {
    total.workspace_preparation_ms += lane.phase_metrics.workspace_preparation_ms;
    total.implementation_invocation_ms += lane.phase_metrics.implementation_invocation_ms;
    total.machine_verification_ms += lane.phase_metrics.machine_verification_ms;
    total.self_fix_cycle_count += lane.phase_metrics.self_fix_cycle_count;
    total.self_fix_wall_clock_ms += lane.phase_metrics.self_fix_wall_clock_ms;
    total.self_fix_invocation_ms += lane.phase_metrics.self_fix_invocation_ms;
    total.self_fix_verification_ms += lane.phase_metrics.self_fix_verification_ms;
  }
  return total;
}

async function loadPersistedLaneState(filePath: string): Promise<PersistedLaneState | null> {
  const state = await loadJsonIfExists<PersistedLaneState>(filePath);
  if (!state || state.schema_version !== 1) return null;
  return state;
}

async function savePersistedLaneState(filePath: string, state: PersistedLaneState): Promise<void> {
  await writeJson(filePath, state);
}

function chooseFastestSuccessfulLane(lanes: BenchmarkLaneSummary[]): string | null {
  const successful = lanes.filter((lane) => lane.status === "succeeded");
  if (successful.length === 0) return null;
  successful.sort((left, right) => left.cycle_wall_clock_ms - right.cycle_wall_clock_ms);
  return successful[0]?.lane_id ?? null;
}

function chooseLowestCostSuccessfulLane(lanes: BenchmarkLaneSummary[]): string | null {
  const successful = lanes.filter((lane) => lane.status === "succeeded" && typeof lane.estimated_cost_usd === "number");
  if (successful.length === 0) return null;
  successful.sort((left, right) => (left.estimated_cost_usd ?? Number.POSITIVE_INFINITY) - (right.estimated_cost_usd ?? Number.POSITIVE_INFINITY));
  return successful[0]?.lane_id ?? null;
}

function chooseBestQualityLane(lanes: BenchmarkLaneSummary[]): string | null {
  if (lanes.length === 0) return null;
  const ranked = [...lanes].sort((left, right) => right.artifact_quality.score - left.artifact_quality.score);
  return ranked[0]?.lane_id ?? null;
}

function chooseFewestReviewCyclesSuccessfulLane(lanes: BenchmarkLaneSummary[]): string | null {
  const successful = lanes.filter((lane) => lane.status === "succeeded");
  if (successful.length === 0) return null;
  successful.sort((left, right) => {
    if (left.review_cycle_count !== right.review_cycle_count) return left.review_cycle_count - right.review_cycle_count;
    return left.cycle_wall_clock_ms - right.cycle_wall_clock_ms;
  });
  return successful[0]?.lane_id ?? null;
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n...[truncated ${value.length - maxChars} chars]`;
}

function trimForPrompt(value: string, maxChars: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `...[truncated ${trimmed.length - maxChars} chars]\n${trimmed.slice(trimmed.length - maxChars)}`;
}

async function discoverRuntimePackageRoots(sourceRepoRoot: string): Promise<string[]> {
  const discovered = new Set<string>();

  async function walk(absoluteDirectory: string, relativeDirectory: string, depth: number): Promise<void> {
    if (existsSync(resolve(absoluteDirectory, "package.json"))) {
      discovered.add(normalizeRepoPath(relativeDirectory));
    }
    if (depth >= 2) return;
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (runtimeDiscoveryIgnoredDirectories.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;
      await walk(resolve(absoluteDirectory, entry.name), normalizeRepoPath(join(relativeDirectory, entry.name)), depth + 1);
    }
  }

  for (const root of runtimeDiscoveryRoots) {
    const absoluteRoot = resolve(sourceRepoRoot, root);
    if (!existsSync(absoluteRoot)) continue;
    await walk(absoluteRoot, normalizeRepoPath(root), 0);
  }

  return [...discovered].sort();
}

async function materializeRuntimeDirectory(
  sourcePath: string,
  destinationPath: string,
  mode: "junction" | "copy",
): Promise<void> {
  if (!existsSync(sourcePath)) return;
  await rm(destinationPath, { recursive: true, force: true });
  await mkdir(dirname(destinationPath), { recursive: true });
  if (mode === "junction") {
    await symlink(sourcePath, destinationPath, process.platform === "win32" ? "junction" : "dir");
    return;
  }
  await cp(sourcePath, destinationPath, { recursive: true, force: true });
}

async function materializeRuntimeFile(sourcePath: string, destinationPath: string): Promise<void> {
  if (!existsSync(sourcePath)) return;
  await rm(destinationPath, { force: true });
  await mkdir(dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath, { force: true });
}

async function prewarmLaneWorkspaceRuntime(sourceRepoRoot: string, workingDirectory: string): Promise<void> {
  const packageRoots = await discoverRuntimePackageRoots(sourceRepoRoot);
  for (const packageRoot of packageRoots) {
    await materializeRuntimeDirectory(
      resolve(sourceRepoRoot, packageRoot, "node_modules"),
      resolve(workingDirectory, packageRoot, "node_modules"),
      "junction",
    );
    await materializeRuntimeDirectory(
      resolve(sourceRepoRoot, packageRoot, "dist"),
      resolve(workingDirectory, packageRoot, "dist"),
      "copy",
    );
  }
  await materializeRuntimeFile(
    resolve(sourceRepoRoot, ".codex", "runtime", "install-state.json"),
    resolve(workingDirectory, ".codex", "runtime", "install-state.json"),
  );
}

async function verifyPreparedWorkspace(sourceRepoRoot: string, workingDirectory: string): Promise<void> {
  const launcherPath = resolve(sourceRepoRoot, "adf.cmd");
  if (!existsSync(launcherPath)) return;

  const result = await runManagedProcess({
    command: launcherPath,
    args: ["--runtime-preflight", "--json"],
    timeoutMs: defaultWorkspacePreflightTimeoutMs,
    label: "benchmark-worktree-preflight",
    cwd: workingDirectory,
    env: { ...process.env },
    allowNonZeroExit: true,
  });

  const outputText = result.stdout.trim();
  if (result.exitCode !== 0) {
    throw new Error(`Benchmark worktree preflight failed (exit ${result.exitCode}): ${truncateText(outputText || result.stderr.trim(), 2400)}`);
  }
  let parsed: { overall_status?: string } | null = null;
  try {
    parsed = JSON.parse(outputText) as { overall_status?: string };
  } catch (error) {
    throw new Error(
      `Benchmark worktree preflight returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (parsed?.overall_status !== "pass") {
    throw new Error(`Benchmark worktree preflight failed: ${truncateText(outputText, 2400)}`);
  }
}

function classifyInvocationBlocker(errorMessage: string): { blocker_kind: BlockerKind | null; blocker_reason: string | null } {
  const lower = errorMessage.toLowerCase();
  if (
    /modelnotfounderror/i.test(errorMessage)
    || /requested entity was not found/i.test(lower)
    || /unknown model/i.test(lower)
    || /unsupported model/i.test(lower)
    || /model .* not found/i.test(lower)
    || /unavailable model/i.test(lower)
  ) {
    return { blocker_kind: "model_unavailable", blocker_reason: errorMessage };
  }
  if (
    /benchmark worktree preflight failed/i.test(lower)
    || /runtime preflight found blocking issues/i.test(lower)
    || /install\/bootstrap repair failed/i.test(lower)
  ) {
    return { blocker_kind: "workspace_preparation_failed", blocker_reason: errorMessage };
  }
  if (
    /requires the `.*` cli on path/i.test(errorMessage)
    || /preflight failed for/i.test(errorMessage)
    || /^.*(codex|claude|gemini) failed: spawn .*enoent/i.test(errorMessage)
  ) {
    return { blocker_kind: "provider_unavailable", blocker_reason: errorMessage };
  }
  if (
    /timed out after \d+ms/i.test(lower)
    || /^(codex|claude|gemini) failed \(exit \d+\):\s*$/i.test(errorMessage.trim())
  ) {
    return { blocker_kind: "provider_execution_failed", blocker_reason: errorMessage };
  }
  if (
    /login/i.test(lower)
    || /authenticate/i.test(lower)
    || /api key/i.test(lower)
    || /credential/i.test(lower)
    || /unauthorized/i.test(lower)
    || /forbidden/i.test(lower)
  ) {
    return { blocker_kind: "provider_auth", blocker_reason: errorMessage };
  }
  return { blocker_kind: null, blocker_reason: null };
}

function classifyVerificationBlocker(message: string): BlockerKind | null {
  if (
    /is not recognized as an internal or external command/i.test(message)
    || /spawn .*enoent/i.test(message)
    || /enoent/i.test(message)
  ) {
    return "verification_command_unavailable";
  }
  return null;
}

async function executeVerificationCommand(
  command: ResolvedVerificationCommand,
  workspace: PreparedLaneWorkspace,
  deadlineAtMs: number | null,
): Promise<VerificationCommandResult> {
  const cwd = resolve(workspace.working_directory, command.cwd);
  const started = Date.now();
  const effectiveTimeoutMs = deriveEffectiveTimeoutMs(command.timeout_ms, deadlineAtMs);
  if (effectiveTimeoutMs !== undefined && effectiveTimeoutMs <= 0) {
    return {
      id: command.id,
      label: command.label,
      command: command.command,
      args: command.args,
      cwd,
      optional: command.optional,
      status: "cutoff",
      exit_code: null,
      latency_ms: Date.now() - started,
      stdout: "",
      stderr: "",
      error_message: "Global benchmark cutoff reached before verification could start.",
      blocker_kind: "global_cutoff_reached",
    };
  }
  if (!existsSync(cwd)) {
    return {
      id: command.id,
      label: command.label,
      command: command.command,
      args: command.args,
      cwd,
      optional: command.optional,
      status: "blocked",
      exit_code: null,
      latency_ms: Date.now() - started,
      stdout: "",
      stderr: "",
      error_message: `Verification cwd does not exist: ${cwd}`,
      blocker_kind: "verification_cwd_missing",
    };
  }
  try {
    const result = await runManagedProcess({
      command: command.command,
      args: command.args,
      timeoutMs: effectiveTimeoutMs ?? command.timeout_ms,
      label: command.label,
      cwd,
      env: { ...process.env },
      allowNonZeroExit: true,
    });
    const passed = result.exitCode === 0;
    return {
      id: command.id,
      label: command.label,
      command: command.command,
      args: command.args,
      cwd,
      optional: command.optional,
      status: passed ? "passed" : command.optional ? "optional_failed" : "failed",
      exit_code: result.exitCode,
      latency_ms: Date.now() - started,
      stdout: result.stdout,
      stderr: result.stderr,
      error_message: passed ? null : `${command.label} failed (exit ${result.exitCode})`,
      blocker_kind: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timedOutOnGlobalCutoff = /timed out after \d+ms/i.test(message) && isGlobalCutoffReached(deadlineAtMs);
    if (timedOutOnGlobalCutoff) {
      return {
        id: command.id,
        label: command.label,
        command: command.command,
        args: command.args,
        cwd,
        optional: command.optional,
        status: "cutoff",
        exit_code: null,
        latency_ms: Date.now() - started,
        stdout: "",
        stderr: "",
        error_message: "Global benchmark cutoff reached during verification.",
        blocker_kind: "global_cutoff_reached",
      };
    }
    const blockerKind = classifyVerificationBlocker(message);
    return {
      id: command.id,
      label: command.label,
      command: command.command,
      args: command.args,
      cwd,
      optional: command.optional,
      status: blockerKind ? "blocked" : command.optional ? "optional_failed" : "failed",
      exit_code: null,
      latency_ms: Date.now() - started,
      stdout: "",
      stderr: "",
      error_message: message,
      blocker_kind: blockerKind,
    };
  }
}

async function runVerificationPlan(
  manifest: ResolvedBenchmarkManifest,
  workspace: PreparedLaneWorkspace,
  deadlineAtMs: number | null,
): Promise<VerificationRunSummary> {
  if (manifest.verification_commands.length === 0) {
    return { status: "not_configured", results: [], failures: [], blocker_kind: null, blocker_reason: null };
  }
  const results: VerificationCommandResult[] = [];
  for (const command of manifest.verification_commands) {
    results.push(await executeVerificationCommand(command, workspace, deadlineAtMs));
  }
  const failures = results
    .filter((result) => result.status === "failed")
    .map((result) => `${result.label}: ${result.error_message ?? `exit ${result.exit_code ?? "unknown"}`}`);
  const cutoff = results.find((result) => result.status === "cutoff");
  if (cutoff) {
    return {
      status: "global_cutoff_reached",
      results,
      failures,
      blocker_kind: "global_cutoff_reached",
      blocker_reason: cutoff.error_message,
    };
  }
  const blocked = results.find((result) => result.status === "blocked");
  if (blocked) {
    return {
      status: "blocked",
      results,
      failures,
      blocker_kind: blocked.blocker_kind,
      blocker_reason: blocked.error_message,
    };
  }
  if (failures.length > 0) {
    return { status: "failed", results, failures, blocker_kind: null, blocker_reason: null };
  }
  return { status: "passed", results, failures: [], blocker_kind: null, blocker_reason: null };
}

function buildVerificationFeedback(results: VerificationCommandResult[]): string | null {
  const failing = results.filter((result) => result.status === "failed" || result.status === "blocked");
  if (failing.length === 0) return null;
  const parts: string[] = [
    "The previous cycle did not pass machine verification. Fix the failures below and rerun the targeted tests yourself before finishing.",
  ];
  for (const result of failing) {
    parts.push("");
    parts.push(`Command: ${result.label}`);
    parts.push(`Rendered: ${renderCommand(result)}`);
    if (result.error_message) parts.push(`Error: ${result.error_message}`);
    if (result.stdout.trim()) {
      parts.push("Stdout:");
      parts.push(trimForPrompt(result.stdout, 1800));
    }
    if (result.stderr.trim()) {
      parts.push("Stderr:");
      parts.push(trimForPrompt(result.stderr, 1800));
    }
  }
  return parts.join("\n");
}

function parseChangedPathsFromStatus(statusText: string): string[] {
  const changed = new Set<string>();
  for (const rawLine of statusText.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    const body = line.slice(3).trim();
    if (!body) continue;
    const normalized = normalizeRepoPath(body.includes(" -> ") ? body.split(" -> ").pop() ?? body : body);
    if (normalized) changed.add(normalized);
  }
  return [...changed].sort();
}

async function collectLaneGitArtifacts(
  laneRoot: string,
  workspace: PreparedLaneWorkspace,
): Promise<{
  git_status_path: string | null;
  diff_stat_path: string | null;
  diff_patch_path: string | null;
  changed_paths_path: string | null;
  changed_paths: string[];
}> {
  const statusResult = gitRun(workspace.working_directory, ["status", "--short", "--untracked-files=all"], workspace.working_directory);
  if (statusResult.status !== 0) {
    return {
      git_status_path: null,
      diff_stat_path: null,
      diff_patch_path: null,
      changed_paths_path: null,
      changed_paths: [],
    };
  }
  const statusText = typeof statusResult.stdout === "string" ? statusResult.stdout : "";
  const diffStatText = gitStdoutOrNull(workspace.working_directory, ["diff", "--stat"], workspace.working_directory) ?? "";
  const diffPatchResult = gitRun(workspace.working_directory, ["diff", "--binary"], workspace.working_directory);
  const diffPatchText = typeof diffPatchResult.stdout === "string" ? diffPatchResult.stdout : "";
  const changedPaths = parseChangedPathsFromStatus(statusText);
  const gitStatusPath = resolve(laneRoot, "git-status.txt");
  const diffStatPath = resolve(laneRoot, "git-diff-stat.txt");
  const diffPatchPath = resolve(laneRoot, "git-diff.patch");
  const changedPathsPath = resolve(laneRoot, "changed-paths.json");
  await writeFile(gitStatusPath, statusText, "utf-8");
  await writeFile(diffStatPath, diffStatText, "utf-8");
  await writeFile(diffPatchPath, diffPatchText, "utf-8");
  await writeJson(changedPathsPath, changedPaths);
  return {
    git_status_path: gitStatusPath,
    diff_stat_path: diffStatPath,
    diff_patch_path: diffPatchPath,
    changed_paths_path: changedPathsPath,
    changed_paths: changedPaths,
  };
}

function evaluateArtifactQuality(
  manifest: ResolvedBenchmarkManifest,
  workspace: PreparedLaneWorkspace,
  lane: {
    status: LaneStatus;
    verification_status: VerificationStatus;
    final_response_path: string | null;
    changed_paths: string[];
  },
): ArtifactQualitySummary {
  const notes: string[] = [];
  const changedPaths = lane.changed_paths.map(normalizeRepoPath);
  const allowedViolations = manifest.artifact_policy.allowed_edit_prefixes.length === 0
    ? []
    : changedPaths.filter((path) => !manifest.artifact_policy.allowed_edit_prefixes.some((prefix) => path.startsWith(prefix)));
  const forbiddenViolations = changedPaths.filter((path) => manifest.artifact_policy.forbidden_edit_prefixes.some((prefix) => path.startsWith(prefix)));
  const requiredPathsPresent = manifest.artifact_policy.required_paths.filter((relativePath) =>
    existsSync(resolve(workspace.working_directory, relativePath.replace(/\//g, "\\"))));
  const requiredChangedPrefixesSatisfied = manifest.artifact_policy.required_changed_prefixes.filter((prefix) =>
    changedPaths.some((path) => path.startsWith(prefix)));

  if (lane.verification_status !== "passed" && lane.verification_status !== "not_configured") {
    notes.push("Machine verification did not pass.");
  }
  if (lane.final_response_path === null) notes.push("No final lane report was captured.");
  if (changedPaths.length === 0) notes.push("No code or doc changes were detected in the worktree.");
  if (requiredPathsPresent.length !== manifest.artifact_policy.required_paths.length) {
    const missing = manifest.artifact_policy.required_paths.filter((path) => !requiredPathsPresent.includes(path));
    if (missing.length > 0) notes.push(`Missing required paths: ${missing.join(", ")}`);
  }
  if (requiredChangedPrefixesSatisfied.length !== manifest.artifact_policy.required_changed_prefixes.length) {
    const missingPrefixes = manifest.artifact_policy.required_changed_prefixes.filter((prefix) => !requiredChangedPrefixesSatisfied.includes(prefix));
    if (missingPrefixes.length > 0) notes.push(`Required changed prefixes not satisfied: ${missingPrefixes.join(", ")}`);
  }
  if (allowedViolations.length > 0) notes.push(`Touched paths outside allowed edit surface: ${allowedViolations.join(", ")}`);
  if (forbiddenViolations.length > 0) notes.push(`Touched forbidden edit surface: ${forbiddenViolations.join(", ")}`);

  let score = 0;
  if (lane.verification_status === "passed" || lane.verification_status === "not_configured") score += 55;
  if (lane.final_response_path) score += 10;
  if (changedPaths.length > 0) score += 10;
  score += manifest.artifact_policy.required_paths.length > 0
    ? Math.round((requiredPathsPresent.length / manifest.artifact_policy.required_paths.length) * 10)
    : 10;
  score += manifest.artifact_policy.required_changed_prefixes.length > 0
    ? Math.round((requiredChangedPrefixesSatisfied.length / manifest.artifact_policy.required_changed_prefixes.length) * 10)
    : 10;
  if (allowedViolations.length === 0 && forbiddenViolations.length === 0) score += 5;
  if (allowedViolations.length > 0) score -= Math.min(20, allowedViolations.length * 5);
  if (forbiddenViolations.length > 0) score -= Math.min(30, forbiddenViolations.length * 10);
  if (lane.status === "blocked_skipped") score = Math.min(score, 20);
  if (lane.status === "failed" || lane.status === "max_cycles_exhausted") score = Math.min(score, 45);
  const clampedScore = Math.max(0, Math.min(100, score));
  return {
    score: clampedScore,
    rating: clampedScore >= 85 ? "strong" : clampedScore >= 60 ? "partial" : "weak",
    rubric_version: "heuristic_v1",
    notes,
    signals: {
      verification_passed: lane.verification_status === "passed" || lane.verification_status === "not_configured",
      changed_file_count: changedPaths.length,
      required_paths_total: manifest.artifact_policy.required_paths.length,
      required_paths_present: requiredPathsPresent.length,
      required_changed_prefixes_total: manifest.artifact_policy.required_changed_prefixes.length,
      required_changed_prefixes_satisfied: requiredChangedPrefixesSatisfied.length,
      allowed_surface_violations: allowedViolations,
      forbidden_surface_violations: forbiddenViolations,
    },
  };
}

async function runLane(
  manifest: ResolvedBenchmarkManifest,
  lane: BenchmarkLaneManifest,
  runRoot: string,
  effectiveRepoRoot: string,
  basePrompt: string,
  invokeFn: (params: InvocationParams) => Promise<InvocationResult>,
  deadlineAtMs: number | null,
): Promise<BenchmarkLaneSummary> {
  const laneRoot = resolve(runRoot, "lanes", lane.id);
  await mkdir(laneRoot, { recursive: true });
  const laneSummaryPath = resolve(laneRoot, "lane-summary.json");
  const cyclesPath = resolve(laneRoot, "cycles.json");
  const laneStatePath = resolve(laneRoot, "lane-state.json");
  const existingSummary = await loadJsonIfExists<BenchmarkLaneSummary>(laneSummaryPath);
  if (existingSummary && isTerminalLaneStatus(existingSummary.status)) {
    return existingSummary;
  }

  const existingState = await loadPersistedLaneState(laneStatePath);
  const existingCycles = (await loadJsonIfExists<BenchmarkCycleSummary[]>(cyclesPath)) ?? [];
  const laneStartedAt = existingState?.started_at ?? new Date().toISOString();
  const laneStartedMs = Date.parse(laneStartedAt);
  let workspacePreparationMs = existingState?.workspace_preparation_ms ?? 0;
  const laneState: PersistedLaneState = existingState ?? {
    schema_version: 1,
    benchmark_id: manifest.benchmark_id,
    lane_id: lane.id,
    started_at: laneStartedAt,
    updated_at: laneStartedAt,
    status: "running",
    workspace: null,
    workspace_preparation_ms: 0,
    session_handle: null,
    next_cycle_number: 1,
    feedback: null,
    verification_failures: [],
    final_response_path: null,
    final_result_path: null,
    final_request_path: null,
    final_verification_path: null,
  };

  async function persistLaneState(status: PersistedLaneState["status"], nextCycleNumber: number): Promise<void> {
    laneState.status = status;
    laneState.next_cycle_number = nextCycleNumber;
    laneState.workspace_preparation_ms = workspacePreparationMs;
    laneState.updated_at = new Date().toISOString();
    await savePersistedLaneState(laneStatePath, laneState);
  }

  let workspace: PreparedLaneWorkspace;
  const workspacePreparationStarted = Date.now();
  try {
    workspace = await prepareLaneWorkspace(manifest, lane, runRoot, effectiveRepoRoot, laneState.workspace);
    if (!laneState.workspace) {
      workspacePreparationMs += Date.now() - workspacePreparationStarted;
    }
    laneState.workspace = workspace;
    await persistLaneState("running", laneState.next_cycle_number);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const summary: BenchmarkLaneSummary = {
      lane_id: lane.id,
      display_name: lane.display_name ?? null,
      cli: lane.cli,
      model: lane.model,
      reasoning: lane.reasoning ?? null,
      effort: lane.effort ?? null,
      isolation_mode: manifest.isolation.mode,
      working_directory: effectiveRepoRoot,
      worktree_path: null,
      base_ref: manifest.isolation.base_ref,
      starting_head_sha: null,
      status: "blocked_skipped",
      cycle_wall_clock_ms: Math.max(0, Date.now() - laneStartedMs),
      total_llm_latency_ms: 0,
      review_cycle_count: 0,
      invocation_attempt_count: 0,
      verification_status: "not_run",
      blocker_kind: "workspace_preparation_failed",
      blocker_reason: errorMessage,
      error_message: errorMessage,
      estimated_cost_usd: null,
      prompt_tokens_estimated: null,
      response_tokens_estimated: null,
      total_tokens_estimated: null,
      final_response_path: null,
      final_result_path: null,
      final_request_path: null,
      final_verification_path: null,
      lane_summary_path: laneSummaryPath,
      cycles_path: cyclesPath,
      git_status_path: null,
      diff_stat_path: null,
      diff_patch_path: null,
      changed_paths_path: null,
      changed_paths: [],
      verification_failures: [],
      latest_session_handle: laneState.session_handle,
      resume_supported: supportsPersistentSession(lane.cli) && laneState.session_handle !== null,
      phase_metrics: createPhaseMetricsSummary(
        workspacePreparationMs,
        0,
        0,
        0,
        0,
        0,
        0,
        manifest.execution_policy.skip_human_testing,
        null,
      ),
      artifact_quality: {
        score: 0,
        rating: "weak",
        rubric_version: "heuristic_v1",
        notes: ["Lane could not prepare its isolated workspace."],
        signals: {
          verification_passed: false,
          changed_file_count: 0,
          required_paths_total: manifest.artifact_policy.required_paths.length,
          required_paths_present: 0,
          required_changed_prefixes_total: manifest.artifact_policy.required_changed_prefixes.length,
          required_changed_prefixes_satisfied: 0,
          allowed_surface_violations: [],
          forbidden_surface_violations: [],
        },
      },
    };
    await persistLaneState("blocked_skipped", laneState.next_cycle_number);
    await writeJson(cyclesPath, []);
    await writeJson(laneSummaryPath, summary);
    return summary;
  }

  const cycles: BenchmarkCycleSummary[] = [...existingCycles];
  let sessionHandle: InvocationSessionHandle | null = laneState.session_handle;
  let totalLlmLatencyMs = 0;
  let totalVerificationLatencyMs = 0;
  let totalInvocationAttempts = 0;
  let totalEstimatedCost = 0;
  let sawCost = false;
  let totalPromptTokens = 0;
  let sawPromptTokens = false;
  let totalResponseTokens = 0;
  let sawResponseTokens = false;
  let selfFixCycleCount = 0;
  let selfFixWallClockMs = 0;
  let selfFixInvocationMs = 0;
  let selfFixVerificationMs = 0;
  let timeToFirstGreenMs: number | null = null;
  let finalResponsePath: string | null = laneState.final_response_path;
  let finalResultPath: string | null = laneState.final_result_path;
  let finalRequestPath: string | null = laneState.final_request_path;
  let finalVerificationPath: string | null = laneState.final_verification_path;
  let verificationFailures: string[] = laneState.verification_failures;
  let feedback: string | null = laneState.feedback;
  let finalStatus: LaneStatus = "failed";
  let finalVerificationStatus: VerificationStatus = manifest.verification_commands.length > 0 ? "failed" : "not_configured";
  let blockerKind: BlockerKind | null = null;
  let blockerReason: string | null = null;
  let finalErrorMessage: string | null = null;

  for (const existingCycle of cycles) {
    totalLlmLatencyMs += existingCycle.llm_latency_ms ?? 0;
    totalVerificationLatencyMs += existingCycle.verification_latency_ms ?? 0;
    totalInvocationAttempts += existingCycle.invocation_attempt_count ?? 0;
    if (typeof existingCycle.estimated_cost_usd === "number") {
      totalEstimatedCost += existingCycle.estimated_cost_usd;
      sawCost = true;
    }
    if (typeof existingCycle.prompt_tokens_estimated === "number") {
      totalPromptTokens += existingCycle.prompt_tokens_estimated;
      sawPromptTokens = true;
    }
    if (typeof existingCycle.response_tokens_estimated === "number") {
      totalResponseTokens += existingCycle.response_tokens_estimated;
      sawResponseTokens = true;
    }
    if (existingCycle.cycle_number > 1) {
      selfFixCycleCount += 1;
      selfFixWallClockMs += existingCycle.cycle_wall_clock_ms ?? 0;
      selfFixInvocationMs += existingCycle.llm_latency_ms ?? 0;
      selfFixVerificationMs += existingCycle.verification_latency_ms ?? 0;
    }
    if (timeToFirstGreenMs === null && (existingCycle.verification_status === "passed" || existingCycle.verification_status === "not_configured")) {
      timeToFirstGreenMs = Math.max(0, Date.parse(existingCycle.finished_at) - laneStartedMs);
    }
    if (existingCycle.session_handle) {
      sessionHandle = existingCycle.session_handle;
    }
    finalVerificationStatus = existingCycle.verification_status;
  }

  const startCycleNumber = Math.max(1, laneState.next_cycle_number);
  for (let cycleNumber = startCycleNumber; cycleNumber <= manifest.execution_policy.max_review_cycles; cycleNumber += 1) {
    if (isGlobalCutoffReached(deadlineAtMs)) {
      finalStatus = "global_cutoff_reached";
      blockerKind = "global_cutoff_reached";
      blockerReason = "Global benchmark cutoff reached before the next review cycle could start.";
      finalErrorMessage = blockerReason;
      await persistLaneState("global_cutoff_reached", cycleNumber);
      break;
    }

    const cycleRoot = resolve(laneRoot, `cycle-${String(cycleNumber).padStart(2, "0")}`);
    await mkdir(cycleRoot, { recursive: true });
    const prompt = buildCyclePrompt(basePrompt, lane, cycleNumber, manifest.execution_policy.max_review_cycles, feedback);
    const promptPath = resolve(cycleRoot, "prompt.txt");
    const requestPath = resolve(cycleRoot, "request.json");
    const responsePath = resolve(cycleRoot, "response.txt");
    const resultPath = resolve(cycleRoot, "result.json");
    const verificationPath = resolve(cycleRoot, "verification.json");
    await writeFile(promptPath, prompt, "utf-8");

    const params: InvocationParams = {
      cli: lane.cli,
      model: lane.model,
      reasoning: lane.reasoning,
      effort: lane.effort,
      bypass: lane.bypass,
      timeout_ms: deriveEffectiveTimeoutMs(lane.timeout_ms, deadlineAtMs),
      working_directory: workspace.working_directory,
      prompt,
      source_path: `tests/implement-plan-benchmark/${manifest.benchmark_id}/${lane.id}/cycle-${String(cycleNumber).padStart(2, "0")}`,
      session: manifest.execution_policy.max_review_cycles > 1 ? { persist: true, handle: sessionHandle } : undefined,
      telemetry_metadata: {
        benchmark_id: manifest.benchmark_id,
        benchmark_lane_id: lane.id,
        benchmark_task_summary: manifest.task_summary,
        benchmark_target_slug: manifest.isolation.target_slug,
        benchmark_isolation_mode: workspace.isolation_mode,
        benchmark_base_ref: workspace.base_ref,
        benchmark_max_review_cycles: manifest.execution_policy.max_review_cycles,
        benchmark_skip_human_testing: manifest.execution_policy.skip_human_testing,
        benchmark_review_cycle: cycleNumber,
        ...manifest.telemetry_metadata,
      },
    };

    await writeJson(requestPath, {
      lane,
      cycle_number: cycleNumber,
      invocation: {
        ...params,
        access_mode: lane.bypass ? "non_interactive_full_access" : "provider_default",
        prompt_chars: prompt.length,
        prompt: undefined,
        prompt_path: promptPath,
        session_handle: sessionHandle,
      },
    });

    const cycleStartedAt = new Date().toISOString();
    const cycleStartedMs = Date.now();
    try {
      const result = await invokeFn(params);
      sessionHandle = result.session?.handle ?? sessionHandle;
      laneState.session_handle = sessionHandle;
      await writeFile(responsePath, result.response, "utf-8");
      await writeJson(resultPath, result);
      const usage = lastUsage(result.attempts, result.usage);
      const estimatedCost = sumEstimatedCost(result.attempts) ?? usage?.estimated_cost_usd ?? null;
      const promptTokens = sumEstimatedTokens(result.attempts, (entry) => entry.tokens_in_estimated, result.usage);
      const responseTokens = sumEstimatedTokens(result.attempts, (entry) => entry.tokens_out_estimated, result.usage);
      totalLlmLatencyMs += result.latency_ms;
      totalInvocationAttempts += result.attempts.length;
      if (estimatedCost !== null) {
        totalEstimatedCost += estimatedCost;
        sawCost = true;
      }
      if (promptTokens !== null) {
        totalPromptTokens += promptTokens;
        sawPromptTokens = true;
      }
      if (responseTokens !== null) {
        totalResponseTokens += responseTokens;
        sawResponseTokens = true;
      }

      const verification = await runVerificationPlan(manifest, workspace, deadlineAtMs);
      const verificationLatencyMs = verification.results.reduce((sum, entry) => sum + entry.latency_ms, 0);
      totalVerificationLatencyMs += verificationLatencyMs;
      await writeJson(verificationPath, verification);
      finalResponsePath = responsePath;
      finalResultPath = resultPath;
      finalRequestPath = requestPath;
      finalVerificationPath = manifest.verification_commands.length > 0 ? verificationPath : null;
      verificationFailures = verification.failures;
      laneState.final_response_path = finalResponsePath;
      laneState.final_result_path = finalResultPath;
      laneState.final_request_path = finalRequestPath;
      laneState.final_verification_path = finalVerificationPath;
      laneState.verification_failures = verificationFailures;
      feedback = buildVerificationFeedback(verification.results);
      laneState.feedback = feedback;
      const cycleWallClockMs = Math.max(0, Date.now() - cycleStartedMs);
      if (cycleNumber > 1) {
        selfFixCycleCount += 1;
        selfFixWallClockMs += cycleWallClockMs;
        selfFixInvocationMs += result.latency_ms;
        selfFixVerificationMs += verificationLatencyMs;
      }
      if (timeToFirstGreenMs === null && (verification.status === "passed" || verification.status === "not_configured")) {
        timeToFirstGreenMs = Math.max(0, Date.now() - laneStartedMs);
      }
      cycles.push({
        cycle_number: cycleNumber,
        started_at: cycleStartedAt,
        finished_at: new Date().toISOString(),
        cycle_wall_clock_ms: cycleWallClockMs,
        prompt_path: promptPath,
        request_path: requestPath,
        response_path: responsePath,
        result_path: resultPath,
        verification_path: manifest.verification_commands.length > 0 ? verificationPath : null,
        invocation_status: "succeeded",
        verification_status: verification.status,
        llm_latency_ms: result.latency_ms,
        invocation_attempt_count: result.attempts.length,
        estimated_cost_usd: estimatedCost,
        prompt_tokens_estimated: promptTokens,
        response_tokens_estimated: responseTokens,
        total_tokens_estimated: promptTokens !== null || responseTokens !== null ? (promptTokens ?? 0) + (responseTokens ?? 0) : null,
        verification_latency_ms: verificationLatencyMs,
        session_handle: sessionHandle,
        error_message: verification.status === "failed" ? verification.failures.join(" | ") : verification.blocker_reason,
        blocker_kind: verification.blocker_kind,
        blocker_reason: verification.blocker_reason,
        verification_failures: verification.failures,
      });

      if (verification.status === "passed" || verification.status === "not_configured") {
        finalStatus = "succeeded";
        finalVerificationStatus = verification.status;
        finalErrorMessage = null;
        await persistLaneState("succeeded", cycleNumber + 1);
        break;
      }
      if (verification.status === "global_cutoff_reached") {
        finalStatus = "global_cutoff_reached";
        finalVerificationStatus = verification.status;
        blockerKind = "global_cutoff_reached";
        blockerReason = verification.blocker_reason;
        finalErrorMessage = verification.blocker_reason;
        await persistLaneState("global_cutoff_reached", cycleNumber + 1);
        break;
      }
      if (verification.status === "blocked") {
        finalStatus = "blocked_skipped";
        finalVerificationStatus = verification.status;
        blockerKind = verification.blocker_kind;
        blockerReason = verification.blocker_reason;
        finalErrorMessage = verification.blocker_reason;
        await persistLaneState("blocked_skipped", cycleNumber + 1);
        break;
      }

      finalStatus = cycleNumber >= manifest.execution_policy.max_review_cycles ? "max_cycles_exhausted" : "failed";
      finalVerificationStatus = verification.status;
      finalErrorMessage = verification.failures.join(" | ");
      await persistLaneState(finalStatus, cycleNumber + 1);
      if (cycleNumber >= manifest.execution_policy.max_review_cycles) break;
    } catch (error) {
      const attempts = extractAttempts(error);
      const usage = lastUsage(attempts, undefined);
      const estimatedCost = sumEstimatedCost(attempts) ?? usage?.estimated_cost_usd ?? null;
      const promptTokens = sumEstimatedTokens(attempts, (entry) => entry.tokens_in_estimated, usage);
      const responseTokens = sumEstimatedTokens(attempts, (entry) => entry.tokens_out_estimated, usage);
      const llmLatencyMs = attempts.length > 0 ? attempts.reduce((sum, attempt) => sum + attempt.latency_ms, 0) : null;
      const errorMessage = error instanceof Error ? error.message : String(error);
      await writeJson(resultPath, { lane, cycle_number: cycleNumber, error_message: errorMessage, attempts });
      if (llmLatencyMs !== null) totalLlmLatencyMs += llmLatencyMs;
      totalInvocationAttempts += attempts.length;
      if (estimatedCost !== null) {
        totalEstimatedCost += estimatedCost;
        sawCost = true;
      }
      if (promptTokens !== null) {
        totalPromptTokens += promptTokens;
        sawPromptTokens = true;
      }
      if (responseTokens !== null) {
        totalResponseTokens += responseTokens;
        sawResponseTokens = true;
      }

      const cycleWallClockMs = Math.max(0, Date.now() - cycleStartedMs);
      if (cycleNumber > 1) {
        selfFixCycleCount += 1;
        selfFixWallClockMs += cycleWallClockMs;
        selfFixInvocationMs += llmLatencyMs ?? 0;
      }
      const cutoffReachedDuringInvocation = /timed out after \d+ms/i.test(errorMessage) && isGlobalCutoffReached(deadlineAtMs);
      const blocker = cutoffReachedDuringInvocation
        ? { blocker_kind: "global_cutoff_reached" as BlockerKind, blocker_reason: "Global benchmark cutoff reached during provider invocation." }
        : classifyInvocationBlocker(errorMessage);
      cycles.push({
        cycle_number: cycleNumber,
        started_at: cycleStartedAt,
        finished_at: new Date().toISOString(),
        cycle_wall_clock_ms: cycleWallClockMs,
        prompt_path: promptPath,
        request_path: requestPath,
        response_path: null,
        result_path: resultPath,
        verification_path: null,
        invocation_status: blocker.blocker_kind ? "blocked" : "failed",
        verification_status: "not_run",
        llm_latency_ms: llmLatencyMs,
        invocation_attempt_count: attempts.length,
        estimated_cost_usd: estimatedCost,
        prompt_tokens_estimated: promptTokens,
        response_tokens_estimated: responseTokens,
        total_tokens_estimated: promptTokens !== null || responseTokens !== null ? (promptTokens ?? 0) + (responseTokens ?? 0) : null,
        verification_latency_ms: 0,
        session_handle: sessionHandle,
        error_message: errorMessage,
        blocker_kind: blocker.blocker_kind,
        blocker_reason: blocker.blocker_reason,
        verification_failures: [],
      });

      finalRequestPath = requestPath;
      finalResultPath = resultPath;
      finalResponsePath = null;
      finalVerificationPath = null;
      finalVerificationStatus = "not_run";
      finalErrorMessage = errorMessage;
      laneState.final_request_path = finalRequestPath;
      laneState.final_result_path = finalResultPath;
      laneState.final_response_path = finalResponsePath;
      laneState.final_verification_path = finalVerificationPath;
      laneState.verification_failures = [];
      if (blocker.blocker_kind) {
        finalStatus = blocker.blocker_kind === "global_cutoff_reached" ? "global_cutoff_reached" : "blocked_skipped";
        blockerKind = blocker.blocker_kind;
        blockerReason = blocker.blocker_reason;
        await persistLaneState(finalStatus, cycleNumber + 1);
        break;
      }

      finalStatus = cycleNumber >= manifest.execution_policy.max_review_cycles ? "max_cycles_exhausted" : "failed";
      await persistLaneState(finalStatus, cycleNumber + 1);
      if (cycleNumber >= manifest.execution_policy.max_review_cycles) break;
      feedback = `The previous cycle failed before verification.\nError: ${truncateText(errorMessage, 2500)}\nRetry the implementation in the same worktree and then rerun the verification commands yourself.`;
      laneState.feedback = feedback;
    }
  }

  const gitArtifacts = await collectLaneGitArtifacts(laneRoot, workspace);
  const summary: BenchmarkLaneSummary = {
    lane_id: lane.id,
    display_name: lane.display_name ?? null,
    cli: lane.cli,
    model: lane.model,
    reasoning: lane.reasoning ?? null,
    effort: lane.effort ?? null,
    isolation_mode: workspace.isolation_mode,
    working_directory: workspace.working_directory,
    worktree_path: workspace.worktree_path,
    base_ref: workspace.base_ref,
    starting_head_sha: workspace.starting_head_sha,
    status: finalStatus,
    cycle_wall_clock_ms: Math.max(0, Date.now() - laneStartedMs),
    total_llm_latency_ms: totalLlmLatencyMs,
    review_cycle_count: cycles.length,
    invocation_attempt_count: totalInvocationAttempts,
    verification_status: finalVerificationStatus,
    blocker_kind: blockerKind,
    blocker_reason: blockerReason,
    error_message: finalErrorMessage,
    estimated_cost_usd: sawCost ? Number(totalEstimatedCost.toFixed(6)) : null,
    prompt_tokens_estimated: sawPromptTokens ? totalPromptTokens : null,
    response_tokens_estimated: sawResponseTokens ? totalResponseTokens : null,
    total_tokens_estimated: sawPromptTokens || sawResponseTokens ? totalPromptTokens + totalResponseTokens : null,
    final_response_path: finalResponsePath,
    final_result_path: finalResultPath,
    final_request_path: finalRequestPath,
    final_verification_path: finalVerificationPath,
    lane_summary_path: laneSummaryPath,
    cycles_path: cyclesPath,
    git_status_path: gitArtifacts.git_status_path,
    diff_stat_path: gitArtifacts.diff_stat_path,
    diff_patch_path: gitArtifacts.diff_patch_path,
    changed_paths_path: gitArtifacts.changed_paths_path,
    changed_paths: gitArtifacts.changed_paths,
    verification_failures: verificationFailures,
    latest_session_handle: sessionHandle,
    resume_supported: supportsPersistentSession(lane.cli) && sessionHandle !== null,
    phase_metrics: createPhaseMetricsSummary(
      workspacePreparationMs,
      totalLlmLatencyMs,
      totalVerificationLatencyMs,
      selfFixCycleCount,
      selfFixWallClockMs,
      selfFixInvocationMs,
      selfFixVerificationMs,
      manifest.execution_policy.skip_human_testing,
      timeToFirstGreenMs,
    ),
    artifact_quality: {
      score: 0,
      rating: "weak",
      rubric_version: "heuristic_v1",
      notes: [],
      signals: {
        verification_passed: false,
        changed_file_count: 0,
        required_paths_total: 0,
        required_paths_present: 0,
        required_changed_prefixes_total: 0,
        required_changed_prefixes_satisfied: 0,
        allowed_surface_violations: [],
        forbidden_surface_violations: [],
      },
    },
  };
  summary.artifact_quality = evaluateArtifactQuality(manifest, workspace, summary);
  laneState.session_handle = sessionHandle;
  laneState.feedback = feedback;
  laneState.verification_failures = verificationFailures;
  laneState.final_response_path = finalResponsePath;
  laneState.final_result_path = finalResultPath;
  laneState.final_request_path = finalRequestPath;
  laneState.final_verification_path = finalVerificationPath;
  await persistLaneState(finalStatus, Math.min(cycles.length + 1, manifest.execution_policy.max_review_cycles + 1));
  await writeJson(cyclesPath, cycles);
  await writeJson(laneSummaryPath, summary);
  return summary;
}

export async function runBenchmarkManifest(
  rawManifest: unknown,
  options: BenchmarkRunOptions = {},
): Promise<BenchmarkSummary> {
  const effectiveRepoRoot = options.repo_root ?? repoRoot;
  const manifestPath = options.manifest_path ?? null;
  const manifestDirectory = manifestPath ? dirname(manifestPath) : effectiveRepoRoot;
  const manifest = await parseBenchmarkManifest(rawManifest, { manifest_directory: manifestDirectory });
  const prompt = buildPrompt(manifest);
  const runRoot = options.resume_run_root
    ? resolve(options.resume_run_root)
    : resolve(manifest.output_root, `${manifest.benchmark_id}-${isoStampForPath(new Date().toISOString())}`);
  const existingSummary = options.resume_run_root
    ? await loadJsonIfExists<BenchmarkSummary>(resolve(runRoot, "summary.json"))
    : null;
  const startedAt = existingSummary?.started_at ?? new Date().toISOString();
  const deadlineAtMs = options.deadline_at_ms
    ?? (manifest.execution_policy.global_cutoff_minutes
      ? Date.now() + (manifest.execution_policy.global_cutoff_minutes * 60_000)
      : null);
  await mkdir(runRoot, { recursive: true });
  const promptPath = resolve(runRoot, "prompt.txt");
  await writeFile(promptPath, prompt, "utf-8");
  const effectiveWorktreeRoot = resolveEffectiveWorktreesRoot(manifest, runRoot);
  await writeJson(resolve(runRoot, "manifest.resolved.json"), {
    ...manifest,
    effective_repo_root: effectiveRepoRoot,
    effective_worktree_root: effectiveWorktreeRoot,
    resumed_from_run_root: options.resume_run_root ?? null,
    global_cutoff_at: deadlineAtMs ? new Date(deadlineAtMs).toISOString() : null,
    context_files: manifest.context_files.map((file) => ({
      requested_path: file.requested_path,
      resolved_path: file.resolved_path,
      content_chars: file.content.length,
    })),
  });

  const invokeFn = options.invoke_fn ?? invoke;
  const laneSettled = await Promise.allSettled(
    manifest.engines.map((lane) => runLane(manifest, lane, runRoot, effectiveRepoRoot, prompt, invokeFn, deadlineAtMs)),
  );
  const laneResults = await Promise.all(
    laneSettled.map(async (result, index) => {
      if (result.status === "fulfilled") return result.value;
      const lane = manifest.engines[index]!;
      const laneRoot = resolve(runRoot, "lanes", lane.id);
      const laneSummaryPath = resolve(laneRoot, "lane-summary.json");
      const cyclesPath = resolve(laneRoot, "cycles.json");
      await mkdir(laneRoot, { recursive: true });
      const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
      const fallbackSummary: BenchmarkLaneSummary = {
        lane_id: lane.id,
        display_name: lane.display_name ?? null,
        cli: lane.cli,
        model: lane.model,
        reasoning: lane.reasoning ?? null,
        effort: lane.effort ?? null,
        isolation_mode: manifest.isolation.mode,
        working_directory: effectiveRepoRoot,
        worktree_path: null,
        base_ref: manifest.isolation.base_ref,
        starting_head_sha: null,
        status: "failed",
        cycle_wall_clock_ms: 0,
        total_llm_latency_ms: 0,
        review_cycle_count: 0,
        invocation_attempt_count: 0,
        verification_status: "not_run",
        blocker_kind: null,
        blocker_reason: null,
        error_message: errorMessage,
        estimated_cost_usd: null,
        prompt_tokens_estimated: null,
        response_tokens_estimated: null,
        total_tokens_estimated: null,
        final_response_path: null,
        final_result_path: null,
        final_request_path: null,
        final_verification_path: null,
        lane_summary_path: laneSummaryPath,
        cycles_path: cyclesPath,
        git_status_path: null,
        diff_stat_path: null,
        diff_patch_path: null,
        changed_paths_path: null,
        changed_paths: [],
        verification_failures: [],
        latest_session_handle: null,
        resume_supported: false,
        phase_metrics: createPhaseMetricsSummary(
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          manifest.execution_policy.skip_human_testing,
          null,
        ),
        artifact_quality: {
          score: 0,
          rating: "weak",
          rubric_version: "heuristic_v1",
          notes: ["Lane crashed inside the harness before completion."],
          signals: {
            verification_passed: false,
            changed_file_count: 0,
            required_paths_total: manifest.artifact_policy.required_paths.length,
            required_paths_present: 0,
            required_changed_prefixes_total: manifest.artifact_policy.required_changed_prefixes.length,
            required_changed_prefixes_satisfied: 0,
            allowed_surface_violations: [],
            forbidden_surface_violations: [],
          },
        },
      };
      await writeJson(cyclesPath, []);
      await writeJson(laneSummaryPath, fallbackSummary);
      return fallbackSummary;
    }),
  );

  const finishedAt = new Date().toISOString();
  const successCount = laneResults.filter((lane) => lane.status === "succeeded").length;
  const blockedCount = laneResults.filter((lane) => lane.status === "blocked_skipped").length;
  const maxCyclesExhaustedCount = laneResults.filter((lane) => lane.status === "max_cycles_exhausted").length;
  const globalCutoffCount = laneResults.filter((lane) => lane.status === "global_cutoff_reached").length;
  const failureCount = laneResults.filter((lane) => lane.status === "failed").length;
  const totalEstimatedCost = Number(laneResults.reduce((sum, lane) => sum + (lane.estimated_cost_usd ?? 0), 0).toFixed(6));
  const totalPromptTokens = laneResults.reduce((sum, lane) => sum + (lane.prompt_tokens_estimated ?? 0), 0);
  const totalResponseTokens = laneResults.reduce((sum, lane) => sum + (lane.response_tokens_estimated ?? 0), 0);

  const summary: BenchmarkSummary = {
    benchmark_id: manifest.benchmark_id,
    description: manifest.description,
    task_summary: manifest.task_summary,
    started_at: startedAt,
    finished_at: finishedAt,
    run_root: runRoot,
    resumed_from_run_root: options.resume_run_root ?? null,
    global_cutoff_at: deadlineAtMs ? new Date(deadlineAtMs).toISOString() : null,
    manifest_path: manifestPath,
    prompt_path: promptPath,
    prompt_chars: prompt.length,
    isolation: {
      mode: manifest.isolation.mode,
      target_slug: manifest.isolation.target_slug,
      base_ref: manifest.isolation.base_ref,
      worktree_root: effectiveWorktreeRoot,
    },
    execution_policy: manifest.execution_policy,
    verification_plan: {
      command_count: manifest.verification_commands.length,
      commands: manifest.verification_commands.map((command) => ({
        id: command.id,
        label: command.label,
        rendered_command: renderCommand(command),
        cwd: command.cwd,
        timeout_ms: command.timeout_ms,
        optional: command.optional,
      })),
    },
    lanes: laneResults,
    totals: {
      lane_count: laneResults.length,
      success_count: successCount,
      failure_count: failureCount,
      blocked_count: blockedCount,
      max_cycles_exhausted_count: maxCyclesExhaustedCount,
      global_cutoff_count: globalCutoffCount,
      total_estimated_cost_usd: totalEstimatedCost,
      total_prompt_tokens_estimated: totalPromptTokens,
      total_response_tokens_estimated: totalResponseTokens,
      total_tokens_estimated: totalPromptTokens + totalResponseTokens,
      phase_metrics: sumPhaseMetrics(laneResults, manifest.execution_policy.skip_human_testing),
    },
    rankings: {
      fastest_success_lane_id: chooseFastestSuccessfulLane(laneResults),
      lowest_cost_success_lane_id: chooseLowestCostSuccessfulLane(laneResults),
      best_quality_lane_id: chooseBestQualityLane(laneResults),
      fewest_review_cycles_success_lane_id: chooseFewestReviewCyclesSuccessfulLane(laneResults),
    },
  };
  await writeJson(resolve(runRoot, "summary.json"), summary);
  return summary;
}

async function loadManifestFromFile(manifestPath: string): Promise<unknown> {
  return JSON.parse(await readFile(manifestPath, "utf-8"));
}

function buildSmokeManifest(): BenchmarkManifest {
  return {
    schema_version: 1,
    benchmark_id: "smoke",
    description: "Minimal harness smoke run for parallel provider benchmarking.",
    task_summary: "Verify that each configured provider can read one shared prompt and return compact JSON.",
    instructions: [
      "Respond with JSON only.",
      "Return an object with these keys:",
      "- provider_ready: boolean",
      "- benchmark_note: string",
      "- repo_acknowledged: boolean",
      "Do not include markdown fences.",
    ].join("\n"),
    response_requirements: "Return valid JSON only. Keep benchmark_note under 30 words.",
    engines: [
      { id: "codex-default", display_name: "Codex GPT-5.4", cli: "codex", model: "gpt-5.4", reasoning: "xhigh", bypass: true, timeout_ms: 120000 },
      { id: "claude-opus", display_name: "Claude Opus", cli: "claude", model: "opus", effort: "max", bypass: true, timeout_ms: 120000 },
    ],
  };
}

function buildImplementationModelMatrixManifest(): BenchmarkManifest {
  return {
    schema_version: 1,
    benchmark_id: "implementation-model-matrix",
    description: "Parallel implementation benchmark matrix across Codex, Claude, and Gemini model tiers.",
    task_summary: "Run the same implementation-oriented prompt across a cross-provider model matrix and compare outcome quality, speed, and cost.",
    instructions: [
      "Respond as if you are the implementation engine for one benchmark lane.",
      "Return substantive output only for the provided task.",
      "Assume this benchmark compares implementation quality across providers and models.",
      "Do not mention hidden benchmark internals unless the task explicitly asks for them.",
    ].join("\n"),
    response_requirements: "Return only the lane's substantive implementation/planning output.",
    execution_policy: { max_review_cycles: 6, skip_human_testing: true, global_cutoff_minutes: 30 },
    engines: [
      { id: "codex-gpt-5.4-baseline", display_name: "Codex GPT-5.4 xhigh (Baseline)", cli: "codex", model: "gpt-5.4", reasoning: "xhigh", bypass: true, timeout_ms: 120000 },
      { id: "codex-gpt-5.3-codex-spark", display_name: "Codex GPT-5.3 Codex Spark", cli: "codex", model: "gpt-5.3-codex-spark", reasoning: "medium", bypass: true, timeout_ms: 120000 },
      { id: "codex-gpt-5.4-mini", display_name: "Codex GPT-5.4 Mini", cli: "codex", model: "gpt-5.4-mini", reasoning: "high", bypass: true, timeout_ms: 120000 },
      { id: "codex-gpt-5.3-codex", display_name: "Codex GPT-5.3 Codex", cli: "codex", model: "gpt-5.3-codex", reasoning: "xhigh", bypass: true, timeout_ms: 120000 },
      { id: "claude-opus-4.6", display_name: "Claude Opus 4.6", cli: "claude", model: "opus-4.6", effort: "max", bypass: true, timeout_ms: 120000 },
      { id: "claude-sonnet-4.6", display_name: "Claude Sonnet 4.6", cli: "claude", model: "sonnet-4.6", effort: "high", bypass: true, timeout_ms: 120000 },
      { id: "gemini-3.1-pro", display_name: "Gemini 3.1 Pro", cli: "gemini", model: "gemini-3.1-pro", bypass: true, timeout_ms: 120000 },
      { id: "gemini-3-flash", display_name: "Gemini 3 Flash", cli: "gemini", model: "gemini-3-flash", bypass: true, timeout_ms: 120000 },
    ],
  };
}

async function writeSampleManifest(targetPath: string): Promise<string> {
  await writeJson(targetPath, buildSmokeManifest());
  return targetPath;
}

async function writeImplementationModelMatrixManifest(targetPath: string): Promise<string> {
  await writeJson(targetPath, buildImplementationModelMatrixManifest());
  return targetPath;
}

function renderHelp(): string {
  return [
    "Usage:",
    "  tsx tests/implement-plan-benchmark/harness.ts help",
    "  tsx tests/implement-plan-benchmark/harness.ts sample --output <path>",
    "  tsx tests/implement-plan-benchmark/harness.ts model-matrix-sample --output <path>",
    "  tsx tests/implement-plan-benchmark/harness.ts run --manifest <path> [--global-cutoff-minutes <n>]",
    "  tsx tests/implement-plan-benchmark/harness.ts resume --run-root <path> [--manifest <path>] [--global-cutoff-minutes <n>]",
    "  tsx tests/implement-plan-benchmark/harness.ts smoke [--global-cutoff-minutes <n>]",
    "",
    "Notes:",
    "  - This harness can run full implementation-review loops inside isolated worktrees.",
    "  - It captures cycle wall-clock time, review-cycle count, total LLM attempts, estimated cost, estimated token counts, verification history, git diff artifacts, heuristic artifact-quality scores, workspace-prep time, verification time, and self-fix-loop timing.",
    "  - Isolation mode 'git_worktree' provisions one detached git worktree per lane from the same base ref, prewarms runtime dependencies and dist artifacts, and passes that checkout as the lane working directory.",
    "  - Provider invocation timeouts are force-closed so a hung lane cannot hold the rest of the benchmark open indefinitely.",
    "  - A global cutoff can stop unfinished lanes after a fixed wall-clock budget; resumable lanes persist provider session UUIDs and worktree state under the run root.",
    "  - execution_policy.max_review_cycles is capped at 6 to keep unattended runs bounded.",
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

function parseOptionalGlobalCutoffMinutes(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    fail("--global-cutoff-minutes must be a positive integer.");
  }
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
  if (args.command === "sample") {
    const outputPath = args.values.output ? resolve(process.cwd(), args.values.output) : resolve(process.cwd(), "tests", "implement-plan-benchmark", "sample.manifest.json");
    console.log(JSON.stringify({ sample_manifest_path: await writeSampleManifest(outputPath) }, null, 2));
    return;
  }
  if (args.command === "model-matrix-sample") {
    const outputPath = args.values.output ? resolve(process.cwd(), args.values.output) : resolve(process.cwd(), "tests", "implement-plan-benchmark", "implementation-model-matrix.manifest.json");
    console.log(JSON.stringify({ model_matrix_manifest_path: await writeImplementationModelMatrixManifest(outputPath) }, null, 2));
    return;
  }
  if (args.command === "smoke") {
    console.log(JSON.stringify(await runBenchmarkManifest(buildSmokeManifest(), { deadline_at_ms: deadlineAtMs }), null, 2));
    return;
  }
  if (args.command === "run") {
    const manifestPath = args.values.manifest ? resolve(process.cwd(), args.values.manifest) : fail("Missing --manifest.");
    console.log(JSON.stringify(await runBenchmarkManifest(await loadManifestFromFile(manifestPath), {
      manifest_path: manifestPath,
      deadline_at_ms: deadlineAtMs,
    }), null, 2));
    return;
  }
  if (args.command === "resume") {
    const runRoot = args.values["run-root"] ? resolve(process.cwd(), args.values["run-root"]) : fail("Missing --run-root.");
    const existingSummary = await loadJsonIfExists<BenchmarkSummary>(resolve(runRoot, "summary.json"));
    const manifestPath = args.values.manifest
      ? resolve(process.cwd(), args.values.manifest)
      : existingSummary?.manifest_path
        ? resolve(existingSummary.manifest_path)
        : fail("Resume requires --manifest when the existing summary does not record manifest_path.");
    console.log(JSON.stringify(await runBenchmarkManifest(await loadManifestFromFile(manifestPath), {
      manifest_path: manifestPath,
      resume_run_root: runRoot,
      deadline_at_ms: deadlineAtMs,
    }), null, 2));
    return;
  }
  fail(`Unknown command '${args.command}'. Use help, sample, model-matrix-sample, run, resume, or smoke.`);
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (executedPath === fileURLToPath(import.meta.url)) {
  void main();
}

assert.ok(repoRoot);
