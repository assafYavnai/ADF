#!/usr/bin/env node

/**
 * benchmark-runtime.mjs — Shared benchmark infrastructure for the benchmark-suite skill.
 *
 * Extracted from tests/implement-plan-benchmark/harness.ts and extended with
 * supervisor-specific capabilities (stop signals, heartbeats, failure classification,
 * Brain summary generation).
 *
 * All functions are pure ESM exports. No CLI entrypoint.
 */

import { existsSync, mkdirSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import {
  BENCHMARK_LANE_STATUSES,
  BENCHMARK_TERMINAL_LANE_STATUSES,
  BENCHMARK_SUITE_STATUSES,
  BENCHMARK_EVENTS,
  describeError,
  isFilled,
  isPlainObject,
  normalizeSlashes,
  nowIso,
  pathExists,
  readJson,
  readJsonIfExists,
  writeJsonAtomic,
  writeTextAtomic
} from "./governed-feature-runtime.mjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_VERIFICATION_TIMEOUT_MS = 300_000;
const DEFAULT_WORKSPACE_PREFLIGHT_TIMEOUT_MS = 120_000;
const RUNTIME_DISCOVERY_ROOTS = ["COO", "shared", "components", "tools"];
const RUNTIME_DISCOVERY_IGNORED = new Set([
  ".git", ".codex", "node_modules", "dist", "coverage",
  "tests", "docs", "memory", "threads", "tmp", "dev"
]);

export {
  DEFAULT_VERIFICATION_TIMEOUT_MS,
  DEFAULT_WORKSPACE_PREFLIGHT_TIMEOUT_MS
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

export function normalizeRepoPath(value) {
  return String(value).replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

export function truncateText(value, maxChars) {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars) + "\n...[truncated " + (value.length - maxChars) + " chars]";
}

export function trimForPrompt(value, maxChars) {
  const trimmed = String(value).trim();
  if (trimmed.length <= maxChars) return trimmed;
  return "...[truncated " + (trimmed.length - maxChars) + " chars]\n" + trimmed.slice(trimmed.length - maxChars);
}

export function renderCommand(command) {
  const parts = [command.command];
  for (const arg of command.args ?? []) {
    parts.push(/\s/.test(arg) ? JSON.stringify(arg) : arg);
  }
  return parts.join(" ");
}

export function assertSafeSlug(value, label) {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error(label + " must match /^[A-Za-z0-9._-]+$/; received '" + value + "'.");
  }
}

export function parseChangedPathsFromStatus(statusText) {
  const changed = new Set();
  for (const rawLine of String(statusText).split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    const body = line.slice(3).trim();
    if (!body) continue;
    const normalized = normalizeRepoPath(body.includes(" -> ") ? (body.split(" -> ").pop() ?? body) : body);
    if (normalized) changed.add(normalized);
  }
  return Array.from(changed).sort();
}

// ---------------------------------------------------------------------------
// Git helpers (standalone, no governed-feature-runtime dependency for git ops)
// ---------------------------------------------------------------------------

export function benchmarkGitRun(cwd, args, options = {}) {
  try {
    const result = spawnSync("git", args, {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      timeout: options.timeoutMs ?? 30000
    });
    return {
      status: result.status ?? 1,
      stdout: typeof result.stdout === "string" ? result.stdout.trim() : "",
      stderr: typeof result.stderr === "string" ? result.stderr.trim() : ""
    };
  } catch {
    return { status: 1, stdout: "", stderr: "" };
  }
}

export function benchmarkGitStdoutOrNull(cwd, args) {
  const result = benchmarkGitRun(cwd, args);
  return result.status === 0 && result.stdout ? result.stdout : null;
}

function describeGitFailure(result, fallbackMessage) {
  return result.stderr || result.stdout || fallbackMessage;
}

// ---------------------------------------------------------------------------
// Timing / cutoff helpers
// ---------------------------------------------------------------------------

export function computeRemainingMs(deadlineAtMs, now) {
  if (deadlineAtMs === null || deadlineAtMs === undefined) return null;
  return Math.max(0, deadlineAtMs - (now ?? Date.now()));
}

export function deriveEffectiveTimeoutMs(configuredTimeoutMs, deadlineAtMs) {
  const remainingMs = computeRemainingMs(deadlineAtMs);
  if (remainingMs === null) return configuredTimeoutMs ?? undefined;
  if (configuredTimeoutMs === undefined || configuredTimeoutMs === null) return remainingMs;
  return Math.max(1, Math.min(configuredTimeoutMs, remainingMs));
}

export function isGlobalCutoffReached(deadlineAtMs, now) {
  const remainingMs = computeRemainingMs(deadlineAtMs, now);
  return remainingMs !== null && remainingMs <= 0;
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export function supportsPersistentSession(provider) {
  return provider === "codex" || provider === "claude";
}

// ---------------------------------------------------------------------------
// Worktree provisioning
// ---------------------------------------------------------------------------

export async function discoverRuntimePackageRoots(sourceRepoRoot) {
  const discovered = new Set();

  async function walk(absoluteDirectory, relativeDirectory, depth) {
    if (existsSync(resolve(absoluteDirectory, "package.json"))) {
      discovered.add(normalizeRepoPath(relativeDirectory));
    }
    if (depth >= 2) return;
    let entries;
    try {
      entries = await readdir(absoluteDirectory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (RUNTIME_DISCOVERY_IGNORED.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;
      await walk(
        resolve(absoluteDirectory, entry.name),
        normalizeRepoPath(join(relativeDirectory, entry.name)),
        depth + 1
      );
    }
  }

  for (const root of RUNTIME_DISCOVERY_ROOTS) {
    const absoluteRoot = resolve(sourceRepoRoot, root);
    if (!existsSync(absoluteRoot)) continue;
    await walk(absoluteRoot, normalizeRepoPath(root), 0);
  }

  return Array.from(discovered).sort();
}

export async function materializeRuntimeDirectory(sourcePath, destinationPath, mode) {
  if (!existsSync(sourcePath)) return;
  await rm(destinationPath, { recursive: true, force: true });
  await mkdir(dirname(destinationPath), { recursive: true });
  if (mode === "junction") {
    await symlink(sourcePath, destinationPath, process.platform === "win32" ? "junction" : "dir");
    return;
  }
  await cp(sourcePath, destinationPath, { recursive: true, force: true });
}

export async function materializeRuntimeFile(sourcePath, destinationPath) {
  if (!existsSync(sourcePath)) return;
  await rm(destinationPath, { force: true });
  await mkdir(dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath, { force: true });
}

export async function prewarmLaneWorkspaceRuntime(sourceRepoRoot, workingDirectory) {
  const packageRoots = await discoverRuntimePackageRoots(sourceRepoRoot);
  for (const packageRoot of packageRoots) {
    await materializeRuntimeDirectory(
      resolve(sourceRepoRoot, packageRoot, "node_modules"),
      resolve(workingDirectory, packageRoot, "node_modules"),
      "junction"
    );
    await materializeRuntimeDirectory(
      resolve(sourceRepoRoot, packageRoot, "dist"),
      resolve(workingDirectory, packageRoot, "dist"),
      "copy"
    );
  }
  await materializeRuntimeFile(
    resolve(sourceRepoRoot, ".codex", "runtime", "install-state.json"),
    resolve(workingDirectory, ".codex", "runtime", "install-state.json")
  );
}

export async function verifyPreparedWorkspace(sourceRepoRoot, workingDirectory, runProcessFn) {
  const launcherPath = resolve(sourceRepoRoot, "adf.cmd");
  if (!existsSync(launcherPath)) return;

  const result = await runProcessFn({
    command: launcherPath,
    args: ["--runtime-preflight", "--json"],
    timeoutMs: DEFAULT_WORKSPACE_PREFLIGHT_TIMEOUT_MS,
    label: "benchmark-worktree-preflight",
    cwd: workingDirectory,
    env: { ...process.env },
    allowNonZeroExit: true
  });

  const outputText = (result.stdout ?? "").trim();
  if (result.exitCode !== 0) {
    throw new Error("Benchmark worktree preflight failed (exit " + result.exitCode + "): " + truncateText(outputText || (result.stderr ?? "").trim(), 2400));
  }
  let parsed = null;
  try {
    parsed = JSON.parse(outputText);
  } catch (error) {
    throw new Error("Benchmark worktree preflight returned invalid JSON: " + describeError(error));
  }
  if (parsed?.overall_status !== "pass") {
    throw new Error("Benchmark worktree preflight failed: " + truncateText(outputText, 2400));
  }
}

export function resolveEffectiveWorktreesRoot(isolation, runRoot, benchmarkId) {
  if (isolation.mode !== "git_worktree") return null;
  return isolation.worktree_root ?? resolve(runRoot, "worktrees", isolation.target_slug ?? benchmarkId);
}

export async function prepareLaneWorkspace(isolation, lane, runRoot, effectiveRepoRoot, benchmarkId, existingWorkspace, runProcessFn) {
  if (existingWorkspace?.working_directory && existsSync(existingWorkspace.working_directory)) {
    return existingWorkspace;
  }
  if (isolation.mode !== "git_worktree") {
    return {
      isolation_mode: "none",
      working_directory: effectiveRepoRoot,
      worktree_path: null,
      base_ref: null,
      starting_head_sha: benchmarkGitStdoutOrNull(effectiveRepoRoot, ["rev-parse", "HEAD"])
    };
  }
  const baseRef = isolation.base_ref;
  if (!baseRef) throw new Error("Benchmark isolation mode 'git_worktree' requires base_ref.");

  const verifyRepo = benchmarkGitRun(effectiveRepoRoot, ["rev-parse", "--show-toplevel"]);
  if (verifyRepo.status !== 0) {
    throw new Error("Benchmark isolation requires a git repo at '" + effectiveRepoRoot + "': " + describeGitFailure(verifyRepo, "git rev-parse failed."));
  }
  const verifyBaseRef = benchmarkGitRun(effectiveRepoRoot, ["rev-parse", "--verify", baseRef + "^{commit}"]);
  if (verifyBaseRef.status !== 0) {
    throw new Error("Benchmark isolation base_ref '" + baseRef + "' is not available in '" + effectiveRepoRoot + "': " + describeGitFailure(verifyBaseRef, "git rev-parse failed."));
  }
  const worktreesRoot = resolveEffectiveWorktreesRoot(isolation, runRoot, benchmarkId);
  if (!worktreesRoot) throw new Error("Benchmark isolation did not resolve a worktrees root.");
  mkdirSync(worktreesRoot, { recursive: true });

  const worktreePath = existingWorkspace?.worktree_path
    ? existingWorkspace.worktree_path
    : resolve(worktreesRoot, lane.id);

  if (!existsSync(worktreePath)) {
    const addResult = benchmarkGitRun(effectiveRepoRoot, ["worktree", "add", "--detach", worktreePath, baseRef]);
    if (addResult.status !== 0) {
      throw new Error("Failed to create lane worktree '" + worktreePath + "': " + describeGitFailure(addResult, "git worktree add failed."));
    }
  }

  await prewarmLaneWorkspaceRuntime(effectiveRepoRoot, worktreePath);
  if (runProcessFn) {
    await verifyPreparedWorkspace(effectiveRepoRoot, worktreePath, runProcessFn);
  }

  return {
    isolation_mode: "git_worktree",
    working_directory: worktreePath,
    worktree_path: worktreePath,
    base_ref: baseRef,
    starting_head_sha: benchmarkGitStdoutOrNull(worktreePath, ["rev-parse", "HEAD"])
  };
}

// ---------------------------------------------------------------------------
// Blocker classification
// ---------------------------------------------------------------------------

export function classifyInvocationBlocker(errorMessage) {
  const lower = String(errorMessage).toLowerCase();
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
    || /^(codex|claude|gemini) failed \(exit \d+\):\s*$/i.test(String(errorMessage).trim())
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

export function classifyVerificationBlocker(message) {
  if (
    /is not recognized as an internal or external command/i.test(message)
    || /spawn .*enoent/i.test(message)
    || /enoent/i.test(message)
  ) {
    return "verification_command_unavailable";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Failure scope classification (local vs global)
// ---------------------------------------------------------------------------

export function classifyFailureScope(blockerKind, errorMessage) {
  if (!blockerKind) return "local";
  switch (blockerKind) {
    case "provider_auth":
      if (/network|dns|certificate|ssl|tls|econnrefused|enotfound/i.test(String(errorMessage))) {
        return "global";
      }
      return "global";
    case "provider_unavailable":
      return "provider_local";
    case "model_unavailable":
      return "local";
    case "workspace_preparation_failed":
      return "local";
    case "global_cutoff_reached":
      return "global";
    case "provider_execution_failed":
      return "local";
    case "verification_command_unavailable":
      return "local";
    case "verification_cwd_missing":
      return "local";
    default:
      return "local";
  }
}

// ---------------------------------------------------------------------------
// Verification execution
// ---------------------------------------------------------------------------

export async function executeVerificationCommand(command, workspace, deadlineAtMs, runProcessFn) {
  const cwd = resolve(workspace.working_directory, command.cwd ?? ".");
  const started = Date.now();
  const effectiveTimeoutMs = deriveEffectiveTimeoutMs(command.timeout_ms ?? DEFAULT_VERIFICATION_TIMEOUT_MS, deadlineAtMs);

  if (effectiveTimeoutMs !== undefined && effectiveTimeoutMs <= 0) {
    return {
      id: command.id ?? "verification",
      label: command.label ?? command.command,
      command: command.command,
      args: command.args ?? [],
      cwd,
      optional: command.optional ?? false,
      status: "cutoff",
      exit_code: null,
      latency_ms: Date.now() - started,
      stdout: "",
      stderr: "",
      error_message: "Global benchmark cutoff reached before verification could start.",
      blocker_kind: "global_cutoff_reached"
    };
  }

  if (!existsSync(cwd)) {
    return {
      id: command.id ?? "verification",
      label: command.label ?? command.command,
      command: command.command,
      args: command.args ?? [],
      cwd,
      optional: command.optional ?? false,
      status: "blocked",
      exit_code: null,
      latency_ms: Date.now() - started,
      stdout: "",
      stderr: "",
      error_message: "Verification cwd does not exist: " + cwd,
      blocker_kind: "verification_cwd_missing"
    };
  }

  try {
    const result = await runProcessFn({
      command: command.command,
      args: command.args ?? [],
      timeoutMs: effectiveTimeoutMs ?? command.timeout_ms ?? DEFAULT_VERIFICATION_TIMEOUT_MS,
      label: command.label ?? command.command,
      cwd,
      env: { ...process.env },
      allowNonZeroExit: true
    });

    const passed = result.exitCode === 0;
    return {
      id: command.id ?? "verification",
      label: command.label ?? command.command,
      command: command.command,
      args: command.args ?? [],
      cwd,
      optional: command.optional ?? false,
      status: passed ? "passed" : (command.optional ? "optional_failed" : "failed"),
      exit_code: result.exitCode,
      latency_ms: Date.now() - started,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      error_message: passed ? null : (command.label ?? command.command) + " failed (exit " + result.exitCode + ")",
      blocker_kind: null
    };
  } catch (error) {
    const message = describeError(error);
    const timedOutOnGlobalCutoff = /timed out after \d+ms/i.test(message) && isGlobalCutoffReached(deadlineAtMs);
    if (timedOutOnGlobalCutoff) {
      return {
        id: command.id ?? "verification",
        label: command.label ?? command.command,
        command: command.command,
        args: command.args ?? [],
        cwd,
        optional: command.optional ?? false,
        status: "cutoff",
        exit_code: null,
        latency_ms: Date.now() - started,
        stdout: "",
        stderr: "",
        error_message: "Global benchmark cutoff reached during verification.",
        blocker_kind: "global_cutoff_reached"
      };
    }
    const blockerKind = classifyVerificationBlocker(message);
    return {
      id: command.id ?? "verification",
      label: command.label ?? command.command,
      command: command.command,
      args: command.args ?? [],
      cwd,
      optional: command.optional ?? false,
      status: blockerKind ? "blocked" : (command.optional ? "optional_failed" : "failed"),
      exit_code: null,
      latency_ms: Date.now() - started,
      stdout: "",
      stderr: "",
      error_message: message,
      blocker_kind: blockerKind ?? null
    };
  }
}

export async function runVerificationPlan(verificationCommands, workspace, deadlineAtMs, runProcessFn) {
  if (!verificationCommands || verificationCommands.length === 0) {
    return { status: "not_configured", results: [], failures: [], blocker_kind: null, blocker_reason: null };
  }
  const results = [];
  for (const command of verificationCommands) {
    results.push(await executeVerificationCommand(command, workspace, deadlineAtMs, runProcessFn));
  }
  const failures = results
    .filter((r) => r.status === "failed")
    .map((r) => r.label + ": " + (r.error_message ?? "exit " + (r.exit_code ?? "unknown")));

  const cutoff = results.find((r) => r.status === "cutoff");
  if (cutoff) {
    return { status: "global_cutoff_reached", results, failures, blocker_kind: "global_cutoff_reached", blocker_reason: cutoff.error_message };
  }
  const blocked = results.find((r) => r.status === "blocked");
  if (blocked) {
    return { status: "blocked", results, failures, blocker_kind: blocked.blocker_kind, blocker_reason: blocked.error_message };
  }
  if (failures.length > 0) {
    return { status: "failed", results, failures, blocker_kind: null, blocker_reason: null };
  }
  return { status: "passed", results, failures: [], blocker_kind: null, blocker_reason: null };
}

export function buildVerificationFeedback(results) {
  const failing = results.filter((r) => r.status === "failed" || r.status === "blocked");
  if (failing.length === 0) return null;
  const parts = [
    "The previous cycle did not pass machine verification. Fix the failures below and rerun the targeted tests yourself before finishing."
  ];
  for (const result of failing) {
    parts.push("");
    parts.push("Command: " + result.label);
    parts.push("Rendered: " + renderCommand(result));
    if (result.error_message) parts.push("Error: " + result.error_message);
    if ((result.stdout ?? "").trim()) {
      parts.push("Stdout:");
      parts.push(trimForPrompt(result.stdout, 1800));
    }
    if ((result.stderr ?? "").trim()) {
      parts.push("Stderr:");
      parts.push(trimForPrompt(result.stderr, 1800));
    }
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Git artifact collection
// ---------------------------------------------------------------------------

export async function collectLaneGitArtifacts(laneRoot, workspace) {
  const statusResult = benchmarkGitRun(workspace.working_directory, ["status", "--short", "--untracked-files=all"]);
  if (statusResult.status !== 0) {
    return { git_status_path: null, diff_stat_path: null, diff_patch_path: null, changed_paths_path: null, changed_paths: [] };
  }
  const statusText = statusResult.stdout ?? "";
  const diffStatText = benchmarkGitStdoutOrNull(workspace.working_directory, ["diff", "--stat"]) ?? "";
  const diffPatchResult = benchmarkGitRun(workspace.working_directory, ["diff", "--binary"]);
  const diffPatchText = diffPatchResult.stdout ?? "";
  const changedPaths = parseChangedPathsFromStatus(statusText);

  const gitStatusPath = resolve(laneRoot, "git-status.txt");
  const diffStatPath = resolve(laneRoot, "git-diff-stat.txt");
  const diffPatchPath = resolve(laneRoot, "git-diff.patch");
  const changedPathsPath = resolve(laneRoot, "changed-paths.json");

  await mkdir(dirname(gitStatusPath), { recursive: true });
  await writeFile(gitStatusPath, statusText, "utf-8");
  await writeFile(diffStatPath, diffStatText, "utf-8");
  await writeFile(diffPatchPath, diffPatchText, "utf-8");
  await writeFile(changedPathsPath, JSON.stringify(changedPaths, null, 2), "utf-8");

  return {
    git_status_path: normalizeSlashes(gitStatusPath),
    diff_stat_path: normalizeSlashes(diffStatPath),
    diff_patch_path: normalizeSlashes(diffPatchPath),
    changed_paths_path: normalizeSlashes(changedPathsPath),
    changed_paths: changedPaths
  };
}

// ---------------------------------------------------------------------------
// Artifact quality heuristic
// ---------------------------------------------------------------------------

export function evaluateArtifactQuality(artifactPolicy, workspace, lane) {
  const notes = [];
  const changedPaths = (lane.changed_paths ?? []).map(normalizeRepoPath);
  const allowedPrefixes = artifactPolicy.allowed_edit_prefixes ?? [];
  const forbiddenPrefixes = artifactPolicy.forbidden_edit_prefixes ?? [];
  const requiredPaths = artifactPolicy.required_paths ?? [];
  const requiredChangedPrefixes = artifactPolicy.required_changed_prefixes ?? [];

  const allowedViolations = allowedPrefixes.length === 0
    ? []
    : changedPaths.filter((p) => !allowedPrefixes.some((prefix) => p.startsWith(prefix)));
  const forbiddenViolations = changedPaths.filter((p) => forbiddenPrefixes.some((prefix) => p.startsWith(prefix)));
  const requiredPathsPresent = requiredPaths.filter((rp) => existsSync(resolve(workspace.working_directory, rp)));
  const requiredChangedSatisfied = requiredChangedPrefixes.filter((prefix) => changedPaths.some((p) => p.startsWith(prefix)));

  if (lane.verification_status !== "passed" && lane.verification_status !== "not_configured") {
    notes.push("Machine verification did not pass.");
  }
  if (!lane.final_response_path) notes.push("No final lane report was captured.");
  if (changedPaths.length === 0) notes.push("No code or doc changes were detected in the worktree.");
  if (requiredPathsPresent.length !== requiredPaths.length) {
    const missing = requiredPaths.filter((p) => !requiredPathsPresent.includes(p));
    if (missing.length > 0) notes.push("Missing required paths: " + missing.join(", "));
  }
  if (requiredChangedSatisfied.length !== requiredChangedPrefixes.length) {
    const missing = requiredChangedPrefixes.filter((p) => !requiredChangedSatisfied.includes(p));
    if (missing.length > 0) notes.push("Required changed prefixes not satisfied: " + missing.join(", "));
  }
  if (allowedViolations.length > 0) notes.push("Touched paths outside allowed edit surface: " + allowedViolations.join(", "));
  if (forbiddenViolations.length > 0) notes.push("Touched forbidden edit surface: " + forbiddenViolations.join(", "));

  let score = 0;
  if (lane.verification_status === "passed" || lane.verification_status === "not_configured") score += 55;
  if (lane.final_response_path) score += 10;
  if (changedPaths.length > 0) score += 10;
  score += requiredPaths.length > 0
    ? Math.round((requiredPathsPresent.length / requiredPaths.length) * 10) : 10;
  score += requiredChangedPrefixes.length > 0
    ? Math.round((requiredChangedSatisfied.length / requiredChangedPrefixes.length) * 10) : 10;
  if (allowedViolations.length === 0 && forbiddenViolations.length === 0) score += 5;
  if (allowedViolations.length > 0) score -= Math.min(20, allowedViolations.length * 5);
  if (forbiddenViolations.length > 0) score -= Math.min(30, forbiddenViolations.length * 10);
  if (lane.status === "blocked" || lane.status === "blocked_skipped") score = Math.min(score, 20);
  if (lane.status === "failed" || lane.status === "max_cycles_exhausted") score = Math.min(score, 45);

  const clampedScore = Math.max(0, Math.min(100, score));
  return {
    score: clampedScore,
    rating: clampedScore >= 85 ? "strong" : (clampedScore >= 60 ? "partial" : "weak"),
    rubric_version: "heuristic_v1",
    notes,
    signals: {
      verification_passed: lane.verification_status === "passed" || lane.verification_status === "not_configured",
      changed_file_count: changedPaths.length,
      required_paths_total: requiredPaths.length,
      required_paths_present: requiredPathsPresent.length,
      required_changed_prefixes_total: requiredChangedPrefixes.length,
      required_changed_prefixes_satisfied: requiredChangedSatisfied.length,
      allowed_surface_violations: allowedViolations,
      forbidden_surface_violations: forbiddenViolations
    }
  };
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

export function buildCyclePrompt(basePrompt, lane, cycleNumber, maxCycles, feedback) {
  const parts = [basePrompt, "", "<lane_execution>"];
  parts.push("lane_id: " + lane.id);
  parts.push("provider: " + (lane.provider ?? lane.cli));
  parts.push("model: " + lane.model);
  parts.push("review_cycle: " + cycleNumber + " of " + maxCycles);
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

// ---------------------------------------------------------------------------
// KPI summary builders
// ---------------------------------------------------------------------------

export function createEmptyPhaseMetrics() {
  return {
    workspace_preparation_ms: 0,
    implementation_invocation_ms: 0,
    machine_verification_ms: 0,
    self_fix_cycle_count: 0,
    self_fix_wall_clock_ms: 0,
    self_fix_invocation_ms: 0,
    self_fix_verification_ms: 0,
    audit_ms: null,
    review_ms: null,
    human_testing_ms: null,
    human_testing_skipped: true,
    time_to_first_green_ms: null
  };
}

export function sumPhaseMetrics(metricsList) {
  const sum = createEmptyPhaseMetrics();
  for (const m of metricsList) {
    if (!m) continue;
    sum.workspace_preparation_ms += m.workspace_preparation_ms ?? 0;
    sum.implementation_invocation_ms += m.implementation_invocation_ms ?? 0;
    sum.machine_verification_ms += m.machine_verification_ms ?? 0;
    sum.self_fix_cycle_count += m.self_fix_cycle_count ?? 0;
    sum.self_fix_wall_clock_ms += m.self_fix_wall_clock_ms ?? 0;
    sum.self_fix_invocation_ms += m.self_fix_invocation_ms ?? 0;
    sum.self_fix_verification_ms += m.self_fix_verification_ms ?? 0;
    if (m.audit_ms !== null && m.audit_ms !== undefined) sum.audit_ms = (sum.audit_ms ?? 0) + m.audit_ms;
    if (m.review_ms !== null && m.review_ms !== undefined) sum.review_ms = (sum.review_ms ?? 0) + m.review_ms;
    if (m.human_testing_ms !== null && m.human_testing_ms !== undefined) sum.human_testing_ms = (sum.human_testing_ms ?? 0) + m.human_testing_ms;
    if (m.human_testing_skipped === false) sum.human_testing_skipped = false;
  }
  return sum;
}

export function buildSuiteRankings(laneSummaries) {
  const succeeded = laneSummaries.filter((l) => l.status === "succeeded");
  const fastest = succeeded.length > 0
    ? succeeded.reduce((a, b) => (a.cycle_wall_clock_ms ?? Infinity) < (b.cycle_wall_clock_ms ?? Infinity) ? a : b)
    : null;
  const cheapest = succeeded.length > 0
    ? succeeded.reduce((a, b) => (a.estimated_cost_usd ?? Infinity) < (b.estimated_cost_usd ?? Infinity) ? a : b)
    : null;
  const bestQuality = laneSummaries.length > 0
    ? laneSummaries.reduce((a, b) => (a.artifact_quality?.score ?? 0) > (b.artifact_quality?.score ?? 0) ? a : b)
    : null;
  const fewestCycles = succeeded.length > 0
    ? succeeded.reduce((a, b) => {
        if ((a.review_cycle_count ?? Infinity) < (b.review_cycle_count ?? Infinity)) return a;
        if ((a.review_cycle_count ?? Infinity) > (b.review_cycle_count ?? Infinity)) return b;
        return (a.cycle_wall_clock_ms ?? Infinity) < (b.cycle_wall_clock_ms ?? Infinity) ? a : b;
      })
    : null;

  return {
    fastest_success_lane_id: fastest?.lane_id ?? null,
    lowest_cost_success_lane_id: cheapest?.lane_id ?? null,
    best_quality_lane_id: bestQuality?.lane_id ?? null,
    fewest_review_cycles_success_lane_id: fewestCycles?.lane_id ?? null
  };
}

// ---------------------------------------------------------------------------
// Stop signal management
// ---------------------------------------------------------------------------

export async function createStopSignal(signalsRoot, scope, targetId, reason) {
  await mkdir(signalsRoot, { recursive: true });
  const fileName = "stop-" + scope + "-" + targetId + ".json";
  const filePath = resolve(signalsRoot, fileName);
  await writeJsonAtomic(filePath, {
    signal_type: "stop_" + scope,
    target: targetId,
    created_at: nowIso(),
    reason: reason ?? "Operator requested stop."
  });
  return normalizeSlashes(filePath);
}

export async function checkStopSignal(signalsRoot, laneId, provider) {
  if (!(await pathExists(signalsRoot))) return null;
  const suiteSignal = resolve(signalsRoot, "stop-suite-all.json");
  if (await pathExists(suiteSignal)) {
    return { scope: "suite", target: "all", signal_path: normalizeSlashes(suiteSignal) };
  }
  if (provider) {
    const providerSignal = resolve(signalsRoot, "stop-provider-" + provider + ".json");
    if (await pathExists(providerSignal)) {
      return { scope: "provider", target: provider, signal_path: normalizeSlashes(providerSignal) };
    }
  }
  if (laneId) {
    const laneSignal = resolve(signalsRoot, "stop-lane-" + laneId + ".json");
    if (await pathExists(laneSignal)) {
      return { scope: "lane", target: laneId, signal_path: normalizeSlashes(laneSignal) };
    }
  }
  return null;
}

export async function clearStopSignal(signalsRoot, scope, targetId) {
  const fileName = "stop-" + scope + "-" + targetId + ".json";
  const filePath = resolve(signalsRoot, fileName);
  await rm(filePath, { force: true });
}

// ---------------------------------------------------------------------------
// Heartbeat management
// ---------------------------------------------------------------------------

export async function writeHeartbeat(heartbeatsRoot, laneId, data) {
  await mkdir(heartbeatsRoot, { recursive: true });
  const filePath = resolve(heartbeatsRoot, laneId + ".json");
  await writeJsonAtomic(filePath, {
    lane_id: laneId,
    heartbeat_at: nowIso(),
    step: data.step ?? null,
    cycle_number: data.cycle_number ?? null,
    provider: data.provider ?? null,
    model: data.model ?? null,
    status: data.status ?? null,
    ...data
  });
}

export async function readAllHeartbeats(heartbeatsRoot) {
  if (!(await pathExists(heartbeatsRoot))) return [];
  let entries;
  try {
    entries = await readdir(heartbeatsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const heartbeats = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    try {
      const data = await readJson(resolve(heartbeatsRoot, entry.name));
      heartbeats.push(data);
    } catch {
      // skip malformed
    }
  }
  return heartbeats;
}

// ---------------------------------------------------------------------------
// Event log (durable file-based notifications)
// ---------------------------------------------------------------------------

export async function appendEventLog(eventsRoot, event) {
  await mkdir(eventsRoot, { recursive: true });
  const timestamp = nowIso().replace(/:/g, "-").replace(/\./g, "_");
  const fileName = timestamp + "-" + (event.event ?? "unknown") + ".json";
  const filePath = resolve(eventsRoot, fileName);
  await writeJsonAtomic(filePath, {
    ...event,
    logged_at: nowIso()
  });
}

// ---------------------------------------------------------------------------
// Brain summary builder
// ---------------------------------------------------------------------------

export function buildBrainSummaryMarkdown(suiteSummary) {
  const lines = [];
  lines.push("# Benchmark Suite Summary");
  lines.push("");
  lines.push("**Suite ID:** " + (suiteSummary.suite_id ?? "unknown"));
  lines.push("**Started:** " + (suiteSummary.started_at ?? "unknown"));
  lines.push("**Finished:** " + (suiteSummary.finished_at ?? "unknown"));
  lines.push("**Status:** " + (suiteSummary.status ?? "unknown"));
  lines.push("");

  const totals = suiteSummary.totals ?? {};
  lines.push("## Results");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("|--------|-------|");
  lines.push("| Total Lanes | " + (totals.lane_count ?? 0) + " |");
  lines.push("| Succeeded | " + (totals.success_count ?? 0) + " |");
  lines.push("| Failed | " + (totals.failure_count ?? 0) + " |");
  lines.push("| Blocked | " + (totals.blocked_count ?? 0) + " |");
  lines.push("| Stopped | " + (totals.stopped_count ?? 0) + " |");
  lines.push("");

  const rankings = suiteSummary.rankings ?? {};
  if (rankings.fastest_success_lane_id || rankings.lowest_cost_success_lane_id) {
    lines.push("## Rankings");
    lines.push("");
    if (rankings.fastest_success_lane_id) lines.push("- **Fastest:** " + rankings.fastest_success_lane_id);
    if (rankings.lowest_cost_success_lane_id) lines.push("- **Lowest Cost:** " + rankings.lowest_cost_success_lane_id);
    if (rankings.best_quality_lane_id) lines.push("- **Best Quality:** " + rankings.best_quality_lane_id);
    if (rankings.fewest_review_cycles_success_lane_id) lines.push("- **Fewest Cycles:** " + rankings.fewest_review_cycles_success_lane_id);
    lines.push("");
  }

  if (suiteSummary.lanes && suiteSummary.lanes.length > 0) {
    lines.push("## Per-Lane Results");
    lines.push("");
    lines.push("| Lane | Provider | Model | Status | Cycles | Cost (USD) | Quality |");
    lines.push("|------|----------|-------|--------|--------|------------|---------|");
    for (const lane of suiteSummary.lanes) {
      lines.push("| " + (lane.lane_id ?? "?") +
        " | " + (lane.provider ?? "?") +
        " | " + (lane.model ?? "?") +
        " | " + (lane.status ?? "?") +
        " | " + (lane.review_cycle_count ?? "?") +
        " | " + (lane.estimated_cost_usd != null ? lane.estimated_cost_usd.toFixed(4) : "?") +
        " | " + (lane.artifact_quality?.score ?? "?") + " |");
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Config / manifest validation helpers
// ---------------------------------------------------------------------------

export function parseBenchmarkSuiteConfig(rawConfig) {
  if (!isPlainObject(rawConfig)) {
    throw new Error("Benchmark suite config must be a JSON object.");
  }
  const schemaVersion = rawConfig.schema_version;
  if (schemaVersion === 1) {
    return convertV1ToV2(rawConfig);
  }
  if (schemaVersion !== 2) {
    throw new Error("Benchmark suite config schema_version must be 1 or 2; received " + schemaVersion + ".");
  }
  return validateV2Config(rawConfig);
}

function convertV1ToV2(raw) {
  const engines = parseEnginesArray(raw.engines);
  return {
    schema_version: 2,
    suite_id: raw.benchmark_id ?? raw.suite_id ?? "benchmark-" + Date.now(),
    description: raw.description ?? null,
    feature: {
      project_root: raw.feature?.project_root ?? null,
      phase_number: raw.feature?.phase_number ?? null,
      feature_slug: raw.feature?.feature_slug ?? raw.isolation?.target_slug ?? null,
      task_summary: raw.task_summary ?? null,
      instructions: raw.instructions ?? null,
      instructions_path: raw.instructions_path ?? null
    },
    isolation: {
      mode: raw.isolation?.mode ?? "none",
      base_ref: raw.isolation?.base_ref ?? null,
      worktree_root: raw.isolation?.worktree_root ?? null,
      target_slug: raw.isolation?.target_slug ?? null
    },
    execution_policy: {
      max_review_cycles: Math.min(raw.execution_policy?.max_review_cycles ?? 1, 6),
      skip_human_testing: raw.execution_policy?.skip_human_testing ?? true,
      global_cutoff_minutes: raw.execution_policy?.global_cutoff_minutes ?? null,
      auto_merge_queue: false,
      terminal_state: "merge_ready"
    },
    verification_commands: parseVerificationCommands(raw.verification_commands),
    artifact_policy: {
      required_paths: raw.artifact_policy?.required_paths ?? [],
      required_changed_prefixes: raw.artifact_policy?.required_changed_prefixes ?? [],
      allowed_edit_prefixes: raw.artifact_policy?.allowed_edit_prefixes ?? [],
      forbidden_edit_prefixes: raw.artifact_policy?.forbidden_edit_prefixes ?? []
    },
    notification_policy: {
      required: false,
      channels: ["file_event_log"],
      progress_interval_seconds: 60
    },
    engines,
    context_files: raw.context_files ?? [],
    response_requirements: raw.response_requirements ?? null,
    telemetry_metadata: isPlainObject(raw.telemetry_metadata) ? raw.telemetry_metadata : {}
  };
}

function validateV2Config(raw) {
  const suiteId = raw.suite_id;
  if (!isFilled(suiteId)) throw new Error("Benchmark suite config requires suite_id.");
  assertSafeSlug(suiteId, "suite_id");

  const engines = parseEnginesArray(raw.engines);
  const feature = raw.feature ?? {};
  const isolation = raw.isolation ?? {};
  const executionPolicy = raw.execution_policy ?? {};
  const notificationPolicy = raw.notification_policy ?? {};

  if (isolation.mode === "git_worktree" && !isFilled(isolation.base_ref)) {
    throw new Error("Benchmark isolation mode 'git_worktree' requires base_ref.");
  }

  return {
    schema_version: 2,
    suite_id: suiteId,
    description: raw.description ?? null,
    feature: {
      project_root: feature.project_root ?? null,
      phase_number: feature.phase_number ?? null,
      feature_slug: feature.feature_slug ?? null,
      task_summary: feature.task_summary ?? null,
      instructions: feature.instructions ?? null,
      instructions_path: feature.instructions_path ?? null
    },
    isolation: {
      mode: isolation.mode ?? "none",
      base_ref: isolation.base_ref ?? null,
      worktree_root: isolation.worktree_root ?? null,
      target_slug: isolation.target_slug ?? null
    },
    execution_policy: {
      max_review_cycles: Math.min(executionPolicy.max_review_cycles ?? 1, 6),
      skip_human_testing: executionPolicy.skip_human_testing ?? true,
      global_cutoff_minutes: executionPolicy.global_cutoff_minutes ?? null,
      auto_merge_queue: executionPolicy.auto_merge_queue ?? false,
      terminal_state: executionPolicy.terminal_state ?? "merge_ready"
    },
    verification_commands: parseVerificationCommands(raw.verification_commands),
    artifact_policy: {
      required_paths: raw.artifact_policy?.required_paths ?? [],
      required_changed_prefixes: raw.artifact_policy?.required_changed_prefixes ?? [],
      allowed_edit_prefixes: raw.artifact_policy?.allowed_edit_prefixes ?? [],
      forbidden_edit_prefixes: raw.artifact_policy?.forbidden_edit_prefixes ?? []
    },
    notification_policy: {
      required: notificationPolicy.required ?? false,
      channels: Array.isArray(notificationPolicy.channels) ? notificationPolicy.channels : ["file_event_log"],
      progress_interval_seconds: notificationPolicy.progress_interval_seconds ?? 60
    },
    engines,
    context_files: Array.isArray(raw.context_files) ? raw.context_files : [],
    response_requirements: raw.response_requirements ?? null,
    telemetry_metadata: isPlainObject(raw.telemetry_metadata) ? raw.telemetry_metadata : {}
  };
}

function parseEnginesArray(rawEngines) {
  if (!Array.isArray(rawEngines) || rawEngines.length === 0) {
    throw new Error("Benchmark suite config must define at least one engine in 'engines' array.");
  }
  const seenIds = new Set();
  return rawEngines.map((entry, index) => {
    if (!isPlainObject(entry)) throw new Error("Engine at index " + index + " must be a JSON object.");
    const id = entry.id;
    if (!isFilled(id)) throw new Error("Engine at index " + index + " must have a non-empty 'id'.");
    assertSafeSlug(id, "engines[" + index + "].id");
    if (seenIds.has(id)) throw new Error("Duplicate engine id '" + id + "'.");
    seenIds.add(id);
    const provider = entry.provider ?? entry.cli;
    if (!provider || !["codex", "claude", "gemini"].includes(provider)) {
      throw new Error("Engine '" + id + "' must have provider (or cli) set to 'codex', 'claude', or 'gemini'.");
    }
    if (!isFilled(entry.model)) throw new Error("Engine '" + id + "' must have a non-empty 'model'.");
    return {
      id,
      display_name: entry.display_name ?? null,
      provider,
      cli: provider,
      model: entry.model,
      reasoning: entry.reasoning ?? null,
      effort: entry.effort ?? null,
      bypass: entry.bypass ?? true,
      access_mode: entry.access_mode ?? "native_full_access",
      timeout_ms: entry.timeout_ms ?? 120000
    };
  });
}

function parseVerificationCommands(rawCommands) {
  if (!Array.isArray(rawCommands)) return [];
  return rawCommands.map((cmd, index) => {
    if (!isPlainObject(cmd)) throw new Error("Verification command at index " + index + " must be a JSON object.");
    if (!isFilled(cmd.command)) throw new Error("Verification command at index " + index + " must have a 'command'.");
    return {
      id: cmd.id ?? "verification-" + (index + 1),
      label: cmd.label ?? cmd.command,
      command: cmd.command,
      args: Array.isArray(cmd.args) ? cmd.args : [],
      cwd: cmd.cwd ?? ".",
      timeout_ms: cmd.timeout_ms ?? DEFAULT_VERIFICATION_TIMEOUT_MS,
      optional: cmd.optional ?? false
    };
  });
}
