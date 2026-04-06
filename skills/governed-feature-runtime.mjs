#!/usr/bin/env node

import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export const ACCESS_MODES = new Set([
  "native_full_access",
  "native_elevated_permissions",
  "codex_cli_full_auto_bypass",
  "claude_code_skip_permissions",
  "inherits_current_runtime_access",
  "interactive_fallback"
]);

export const ACCESS_MODE_RANK = {
  native_full_access: 50,
  native_elevated_permissions: 40,
  codex_cli_full_auto_bypass: 30,
  claude_code_skip_permissions: 30,
  inherits_current_runtime_access: 20,
  interactive_fallback: 10
};

export const RUNTIME_PERMISSION_MODELS = new Set([
  "native_explicit_full_access",
  "codex_cli_explicit_full_auto",
  "claude_code_skip_permissions",
  "native_inherited_access_only",
  "interactive_or_limited"
]);

export const EXECUTION_RUNTIMES = new Set([
  "native_agent_tools",
  "codex_cli_exec",
  "claude_code_exec",
  "artifact_continuity_only"
]);

export const PERSISTENT_EXECUTION_STRATEGIES = new Set([
  "per_feature_agent_registry",
  "per_feature_cli_sessions",
  "artifact_continuity_only"
]);

export const IMPLEMENT_PLAN_RUN_MODES = new Set([
  "normal",
  "benchmarking"
]);

export const BENCHMARK_LANE_STATUSES = new Set([
  "provisioning",
  "running",
  "verification_pending",
  "review_pending",
  "succeeded",
  "failed",
  "blocked",
  "stopped",
  "max_cycles_exhausted",
  "global_cutoff_reached",
  "suite_stopped",
  "provider_stopped",
  "lane_stopped"
]);

export const BENCHMARK_SUITE_STATUSES = new Set([
  "initializing",
  "running",
  "completing",
  "completed",
  "stopped",
  "failed"
]);

export const BENCHMARK_EVENTS = new Set([
  "suite-started",
  "lane-provisioning",
  "lane-started",
  "lane-cycle-started",
  "lane-cycle-completed",
  "lane-verification-passed",
  "lane-verification-failed",
  "lane-review-started",
  "lane-review-completed",
  "lane-blocked",
  "lane-stopped",
  "lane-completed",
  "lane-failed",
  "lane-reset",
  "suite-progress",
  "suite-completed",
  "suite-stopped",
  "suite-failed",
  "global-failure"
]);

export const BENCHMARK_TERMINAL_LANE_STATUSES = new Set([
  "succeeded",
  "failed",
  "blocked",
  "max_cycles_exhausted",
  "global_cutoff_reached",
  "suite_stopped",
  "provider_stopped",
  "lane_stopped"
]);

export const FEATURE_STATUSES = new Set([
  "active",
  "blocked",
  "completed",
  "closed"
]);

export const IMPLEMENT_PLAN_ACTIVE_RUN_STATUSES = new Set([
  "idle",
  "context_ready",
  "integrity_failed",
  "brief_ready",
  "implementation_running",
  "verification_pending",
  "review_pending",
  "human_verification_pending",
  "merge_ready",
  "merge_queued",
  "merge_in_progress",
  "merge_blocked",
  "closeout_pending",
  "completed",
  "blocked"
]);

export const IMPLEMENT_PLAN_EVENTS = new Set([
  "context-collected",
  "integrity-passed",
  "integrity-failed",
  "brief-written",
  "worktree-prepared",
  "implementor-started",
  "implementor-finished",
  "verification-finished",
  "review-requested",
  "human-verification-requested",
  "merge-ready",
  "merge-queued",
  "merge-started",
  "merge-blocked",
  "merge-finished",
  "completion-summary-written",
  "closeout-finished",
  "feature-blocked",
  "feature-reopened"
]);

export const CAPABILITY_KEYS = [
  "native_agent_spawning_available",
  "native_agent_access_configurable",
  "native_agent_inherits_runtime_access",
  "native_agent_resume_available",
  "native_agent_send_input_available",
  "native_agent_wait_available",
  "native_parallel_wait_available",
  "codex_cli_available",
  "codex_cli_full_auto_supported",
  "codex_cli_bypass_supported"
];

export function installBrokenPipeGuards() {
  process.stdout.on("error", (error) => {
    if (error && error.code === "EPIPE") {
      process.exit(0);
    }
    throw error;
  });

  process.stderr.on("error", (error) => {
    if (error && error.code === "EPIPE") {
      process.exit(1);
    }
    throw error;
  });
}

export function parseArgs(argv, multiKeys = []) {
  const values = {};
  const multi = {};
  const positionals = [];
  const multiSet = new Set(multiKeys);

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      values[key] = "true";
      continue;
    }

    if (multiSet.has(key)) {
      multi[key] ??= [];
      multi[key].push(next);
    } else {
      values[key] = next;
    }
    index += 1;
  }

  return { positionals, values, multi };
}

export function requiredArg(args, key) {
  const value = args.values[key];
  if (!isFilled(value)) {
    fail("Missing required argument --" + key + ".");
  }
  return value;
}

export function parsePositiveInteger(value, argumentName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    fail("Expected --" + argumentName + " to be a positive integer, got '" + value + "'.");
  }
  return parsed;
}

export function booleanArg(args, key, fallback) {
  const value = args.values[key];
  if (value === undefined) {
    return fallback;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  fail("Argument --" + key + " must be true or false.");
}

export function capabilityKeyToArgumentName(key) {
  return key.replace(/_/g, "-");
}

export function defaultCapabilityValue(key, cliDetection) {
  switch (key) {
    case "codex_cli_available":
      return cliDetection.cli_available;
    case "codex_cli_full_auto_supported":
      return cliDetection.cli_full_auto_supported;
    case "codex_cli_bypass_supported":
      return cliDetection.cli_bypass_supported;
    default:
      return false;
  }
}

export function detectCodexCliCapabilities() {
  const metadata = {
    cli_probe_attempted: true,
    cli_probe_succeeded: false,
    help_output_inspected: false,
    inferred_from_help: false,
    raw_signal_summary: []
  };

  try {
    const result = spawnSync("codex", ["--help"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000
    });

    const combinedOutput = ((result.stdout ?? "") + "\n" + (result.stderr ?? "")).toLowerCase();
    metadata.cli_probe_succeeded = result.status === 0;
    metadata.help_output_inspected = combinedOutput.trim().length > 0;

    const cliAvailable = result.status === 0;
    const fullAutoSupported = containsAny(combinedOutput, [
      "dangerously-skip-permissions",
      "approval never",
      "approval-never",
      "full-auto",
      "full auto",
      "--ask-for-approval",
      "--approval-mode"
    ]);
    const bypassSupported = containsAny(combinedOutput, [
      "dangerously-skip-permissions",
      "bypass",
      "approval never",
      "approval-never"
    ]);

    metadata.inferred_from_help = fullAutoSupported || bypassSupported;
    if (cliAvailable) metadata.raw_signal_summary.push("codex --help exited successfully");
    if (fullAutoSupported) metadata.raw_signal_summary.push("help output suggests non-interactive approval control");
    if (bypassSupported) metadata.raw_signal_summary.push("help output suggests permission bypass support");

    return {
      metadata,
      cli_available: cliAvailable,
      cli_full_auto_supported: fullAutoSupported,
      cli_bypass_supported: bypassSupported
    };
  } catch (error) {
    metadata.raw_signal_summary.push("codex probe failed: " + describeError(error));
    return {
      metadata,
      cli_available: false,
      cli_full_auto_supported: false,
      cli_bypass_supported: false
    };
  }
}

export async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function safeReaddir(targetPath) {
  try {
    return await readdir(targetPath, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function readJsonIfExists(filePath, fallback = null) {
  if (!(await pathExists(filePath))) {
    return fallback;
  }
  return readJson(filePath);
}

export async function readTextIfExists(filePath) {
  if (!(await pathExists(filePath))) {
    return "";
  }
  return readFile(filePath, "utf8");
}

export async function writeTextAtomic(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = filePath + ".tmp-" + process.pid + "-" + Date.now() + "-" + randomUUID();
  await writeFile(tempPath, value, "utf8");
  try {
    await rename(tempPath, filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error.code === "EEXIST" || error.code === "EPERM" || error.code === "EACCES")) {
      await rm(filePath, { force: true });
      await rename(tempPath, filePath);
    } else {
      throw error;
    }
  }
}

export async function writeJsonAtomic(filePath, value) {
  await writeTextAtomic(filePath, JSON.stringify(value, null, 2) + "\n");
}

export async function governedStateWrite({ statePath, featureSlug, mutator, skipLock = false }) {
  if (typeof mutator !== "function") {
    throw new Error("governedStateWrite: mutator must be a function.");
  }
  if (!isFilled(statePath)) {
    throw new Error("governedStateWrite: statePath is required.");
  }
  if (!isFilled(featureSlug)) {
    throw new Error("governedStateWrite: featureSlug is required.");
  }

  const lockRoot = join(dirname(statePath), ".gsw-locks");
  const lockKey = "gsw-" + sanitizeLockName(featureSlug);

  const doWrite = async () => {
    let currentState = null;
    let currentRevision = 0;

    if (await pathExists(statePath)) {
      const raw = await readFile(statePath, "utf8");
      currentState = JSON.parse(raw);
      currentRevision = typeof currentState?.__gsw_revision === "number" ? currentState.__gsw_revision : 0;
    }

    const nextState = await mutator(currentState);

    if (!isPlainObject(nextState)) {
      throw new Error("governedStateWrite: mutator must return a plain object.");
    }

    const writeId = "gsw-" + randomUUID();
    const nextRevision = currentRevision + 1;
    const timestamp = nowIso();

    nextState.__gsw_revision = nextRevision;
    nextState.__gsw_write_id = writeId;
    nextState.__gsw_timestamp = timestamp;

    await writeJsonAtomic(statePath, nextState);

    return {
      status: "committed",
      state: nextState,
      write_id: writeId,
      revision: nextRevision
    };
  };

  if (skipLock) {
    return doWrite();
  }

  return withLock(lockRoot, lockKey, doWrite);
}

export function createOpaqueId(prefix) {
  return sanitizePathSegment(prefix) + "-" + randomUUID();
}

export function timestampForPath(value = nowIso()) {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    fail("Invalid timestamp '" + value + "'.");
  }
  return timestamp
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.(\d{3})Z$/, "$1Z");
}

export async function appendJsonEvent(eventRoot, record) {
  await mkdir(eventRoot, { recursive: true });
  const occurredAt = record?.occurred_at ?? nowIso();
  const eventId = record?.event_id ?? createOpaqueId("event");
  const eventPath = join(eventRoot, timestampForPath(occurredAt) + "-" + eventId + ".json");
  const payload = {
    ...record,
    event_id: eventId,
    occurred_at: occurredAt
  };
  await writeJsonAtomic(eventPath, payload);
  return {
    event_id: eventId,
    event_path: normalizeSlashes(eventPath),
    payload
  };
}

export async function readJsonDirectory(rootPath, options = {}) {
  const recursive = options.recursive !== false;
  if (!(await pathExists(rootPath))) {
    return [];
  }

  const entries = (await safeReaddir(rootPath)).sort((left, right) => left.name.localeCompare(right.name));
  const files = [];

  for (const entry of entries) {
    const targetPath = join(rootPath, entry.name);
    if (entry.isDirectory()) {
      if (!recursive) continue;
      files.push(...(await readJsonDirectory(targetPath, options)));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    try {
      files.push({
        path: normalizeSlashes(targetPath),
        data: await readJson(targetPath),
        error: null
      });
    } catch (error) {
      if (options.failOnParseError) {
        throw error;
      }
      files.push({
        path: normalizeSlashes(targetPath),
        data: null,
        error: describeError(error)
      });
    }
  }

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function withLock(lockRoot, key, fn, options = {}) {
  const timeoutMs = options.timeoutMs ?? 15000;
  const staleMs = options.staleMs ?? 120000;
  const retryMs = options.retryMs ?? 200;
  const startedAt = Date.now();
  const lockName = sanitizeLockName(key) + ".lock";
  const lockDir = join(lockRoot, lockName);
  const ownerPath = join(lockDir, "owner.json");

  await mkdir(lockRoot, { recursive: true });

  while (true) {
    try {
      await mkdir(lockDir);
      await writeJsonAtomic(ownerPath, {
        pid: process.pid,
        key,
        acquired_at: nowIso()
      });
      break;
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) {
        throw error;
      }

      const stale = await isStaleLock(lockDir, staleMs);
      if (stale) {
        await rm(lockDir, { recursive: true, force: true });
        continue;
      }

      if (Date.now() - startedAt > timeoutMs) {
        fail("Timed out waiting for lock '" + key + "'.");
      }
      await sleep(retryMs);
    }
  }

  try {
    return await fn();
  } finally {
    await rm(lockDir, { recursive: true, force: true });
  }
}

export function normalizeProjectRoot(value) {
  return normalizeSlashes(resolve(value));
}

export function resolveCanonicalGitProjectRoot(projectRoot) {
  const normalizedRoot = normalizeProjectRoot(projectRoot);
  const commonDirResult = gitRun(normalizedRoot, ["rev-parse", "--path-format=absolute", "--git-common-dir"], { timeoutMs: 5000 });
  if (commonDirResult.status !== 0) {
    return normalizedRoot;
  }

  const commonDir = String(commonDirResult.stdout ?? "").trim();
  if (!commonDir) {
    return normalizedRoot;
  }

  return normalizeProjectRoot(dirname(commonDir));
}

export function normalizeSlashes(value) {
  return String(value).replace(/\\/g, "/");
}

export function normalizeFeatureSlug(featureSlug) {
  const normalized = String(featureSlug).trim().replace(/\\/g, "/").replace(/\/+/g, "/");
  if (!normalized) {
    fail("feature-slug cannot be empty.");
  }
  if (normalized.startsWith("/") || normalized.endsWith("/")) {
    fail("feature-slug must not start or end with '/'.");
  }

  const segments = normalized.split("/");
  for (const segment of segments) {
    if (!segment || segment === "." || segment === "..") {
      fail("feature-slug contains an invalid path segment.");
    }
    if (!/^[A-Za-z0-9._-]+$/.test(segment)) {
      fail("feature-slug contains an invalid segment '" + segment + "'. Allowed characters: letters, numbers, dot, underscore, dash.");
    }
  }

  return segments.join("/");
}

export function buildFeatureRegistryKey(phaseNumber, featureSlug) {
  return "phase" + phaseNumber + "/" + featureSlug;
}

export function resolveFeatureRoot(projectRoot, phaseNumber, featureSlug) {
  const phaseRoot = resolve(projectRoot, "docs", "phase" + phaseNumber);
  const target = resolve(phaseRoot, ...featureSlug.split("/"));
  assertPathInside(phaseRoot, target, "feature root");
  return target;
}

export function resolveSkillStateRoot(projectRoot, skillName) {
  return resolve(projectRoot, ".codex", skillName);
}

export function assertPathInside(basePath, targetPath, label) {
  const relativePath = relative(basePath, targetPath);
  if (relativePath === "" || relativePath === ".") {
    return;
  }
  if (relativePath.startsWith("..") || relativePath.includes("\\..") || relativePath.includes("/..")) {
    fail("Refusing to resolve " + label + " outside the allowed root.");
  }
}

export function validateOptionalEnum(value, allowedValues, argumentName) {
  if (!isFilled(value)) {
    return null;
  }
  if (!allowedValues.has(value)) {
    fail("Invalid value for --" + argumentName + ". Allowed values: " + Array.from(allowedValues).join(", "));
  }
  return value;
}

export function safeInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function emptyToNull(value) {
  return isFilled(value) ? value : null;
}

export function nowIso() {
  return new Date().toISOString();
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isFilled(value) {
  return !(value === undefined || value === null || String(value).trim() === "");
}

export function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function describeError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

export function fail(message) {
  process.stderr.write(message + "\n");
  process.exit(1);
}

export function rankAccessMode(mode) {
  return ACCESS_MODE_RANK[mode] ?? 0;
}

export function shouldRecreateExecution(executionId, existingMode, requiredMode) {
  if (!isFilled(executionId) || !isFilled(requiredMode)) {
    return false;
  }
  if (!isFilled(existingMode)) {
    return true;
  }
  return rankAccessMode(existingMode) < rankAccessMode(requiredMode);
}

export function gitOutput(projectRoot, args) {
  const result = gitRun(projectRoot, args);
  if (result.status !== 0) {
    return null;
  }
  return result.stdout || null;
}

export function gitRun(projectRoot, args, options = {}) {
  try {
    const result = spawnSync("git", ["-c", "safe.directory=" + normalizeSlashes(projectRoot), ...args], {
      cwd: projectRoot,
      encoding: "utf8",
      windowsHide: true,
      timeout: options.timeoutMs ?? 10000
    });
    return {
      status: result.status ?? 1,
      stdout: result.stdout?.trim() ?? "",
      stderr: result.stderr?.trim() ?? ""
    };
  } catch {
    return {
      status: 1,
      stdout: "",
      stderr: ""
    };
  }
}

export function detectCurrentBranch(projectRoot) {
  return gitOutput(projectRoot, ["branch", "--show-current"]);
}

export function detectOriginHeadBranch(projectRoot) {
  const symbolic = gitOutput(projectRoot, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  return symbolic?.startsWith("origin/") ? symbolic.slice("origin/".length) : null;
}

export function detectDefaultBaseBranch(projectRoot) {
  return detectCurrentBranch(projectRoot) ?? detectOriginHeadBranch(projectRoot) ?? "main";
}

export function gitRefExists(projectRoot, ref) {
  return gitRun(projectRoot, ["rev-parse", "--verify", ref]).status === 0;
}

export function sanitizePathSegment(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "");
  return normalized || "item";
}

export function stripCodeFences(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const kept = [];
  let inFence = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) {
      kept.push(line);
    }
  }

  return kept.join("\n");
}

export function validateHeadingContract(text, requiredHeadings) {
  const documentLines = stripCodeFences(text)
    .split(/\r?\n/)
    .map((line) => line.trim());

  const positions = [];
  const duplicates = [];
  const missing = [];

  for (const heading of requiredHeadings) {
    const headingPositions = [];
    for (let index = 0; index < documentLines.length; index += 1) {
      if (documentLines[index] === heading) {
        headingPositions.push(index);
      }
    }

    if (headingPositions.length === 0) {
      missing.push(heading);
      continue;
    }
    if (headingPositions.length > 1) {
      duplicates.push(heading);
    }
    positions.push(headingPositions[0]);
  }

  if (missing.length > 0) {
    return { valid: false, error: "Missing required headings: " + missing.join(", ") };
  }
  if (duplicates.length > 0) {
    return { valid: false, error: "Duplicate required headings detected: " + duplicates.join(", ") };
  }
  for (let index = 1; index < positions.length; index += 1) {
    if (positions[index] <= positions[index - 1]) {
      return { valid: false, error: "Required headings are out of order." };
    }
  }
  return { valid: true, error: null };
}

export function extractSection(text, heading) {
  if (!text) return "";
  const lines = stripCodeFences(text).split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return "";
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\d+\.\s+/.test(lines[index].trim())) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n").trim();
}

export function extractBulletishLines(text, heading, limit = 5) {
  const section = extractSection(text, heading);
  if (!section) return [];
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line)
    .map((line) => line.replace(/^[-*+]\s*/, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter((line) => line && line !== "None.")
    .slice(0, limit);
}

export function diffSeconds(start, end) {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return Math.round((endMs - startMs) / 1000);
}

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return null;
  const total = Math.max(0, seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  const parts = [];
  if (hours > 0) parts.push(String(hours) + "h");
  if (minutes > 0) parts.push(String(minutes) + "m");
  parts.push(String(remainingSeconds) + "s");
  return parts.join(" ");
}

function sanitizeLockName(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "lock";
}

async function isStaleLock(lockDir, staleMs) {
  try {
    const info = await stat(lockDir);
    return Date.now() - info.mtimeMs > staleMs;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function containsAny(text, fragments) {
  return fragments.some((fragment) => text.includes(fragment));
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}


