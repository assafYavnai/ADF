#!/usr/bin/env node

/**
 * benchmark-suite-helper.mjs — Main benchmark suite supervisor.
 *
 * Commands: help, run, resume, status, tail-lane, stop-lane, stop-provider,
 *           stop-suite, reset-lane, dry-run
 *
 * All output is JSON via printJson(). All state mutations use withLock() +
 * writeJsonAtomic(). All paths in JSON are normalizeSlashes()'d.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  BENCHMARK_LANE_STATUSES,
  BENCHMARK_SUITE_STATUSES,
  BENCHMARK_EVENTS,
  BENCHMARK_TERMINAL_LANE_STATUSES,
  describeError,
  installBrokenPipeGuards,
  isFilled,
  isPlainObject,
  normalizeProjectRoot,
  normalizeSlashes,
  nowIso,
  parseArgs,
  pathExists,
  printJson,
  readJson,
  readJsonIfExists,
  requiredArg,
  resolveSkillStateRoot,
  safeInteger,
  withLock,
  writeJsonAtomic,
  writeTextAtomic,
  fail
} from "../../governed-feature-runtime.mjs";

import {
  parseBenchmarkSuiteConfig,
  prepareLaneWorkspace,
  prewarmLaneWorkspaceRuntime,
  resolveEffectiveWorktreesRoot,
  verifyPreparedWorkspace,
  executeVerificationCommand,
  runVerificationPlan,
  buildVerificationFeedback,
  classifyInvocationBlocker,
  classifyVerificationBlocker,
  classifyFailureScope,
  createEmptyPhaseMetrics,
  sumPhaseMetrics,
  buildSuiteRankings,
  evaluateArtifactQuality,
  collectLaneGitArtifacts,
  buildCyclePrompt,
  computeRemainingMs,
  deriveEffectiveTimeoutMs,
  isGlobalCutoffReached,
  supportsPersistentSession,
  createStopSignal,
  checkStopSignal,
  clearStopSignal,
  writeHeartbeat,
  readAllHeartbeats,
  appendEventLog,
  buildBrainSummaryMarkdown,
  normalizeRepoPath,
  renderCommand,
  truncateText,
  trimForPrompt,
  benchmarkGitRun,
  benchmarkGitStdoutOrNull,
  DEFAULT_VERIFICATION_TIMEOUT_MS
} from "../../benchmark-runtime.mjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SKILL_NAME = "benchmark-suite";
const SUITE_STATE_FILE = "suite-state.json";
const RESOLVED_CONFIG_FILE = "config.resolved.json";
const SUMMARY_FILE = "summary.json";
const BRAIN_SUMMARY_FILE = "brain-summary.md";

const ALLOWED_COMMANDS = new Set([
  "help", "run", "resume", "status", "tail-lane",
  "stop-lane", "stop-provider", "stop-suite", "reset-lane", "dry-run"
]);

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

installBrokenPipeGuards();

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0] ?? "help";

  if (!ALLOWED_COMMANDS.has(command)) {
    fail("Unknown command '" + command + "'. Allowed: " + Array.from(ALLOWED_COMMANDS).join(", "));
  }

  switch (command) {
    case "help":       return commandHelp(args);
    case "run":        return commandRun(args);
    case "resume":     return commandResume(args);
    case "status":     return commandStatus(args);
    case "tail-lane":  return commandTailLane(args);
    case "stop-lane":  return commandStopLane(args);
    case "stop-provider": return commandStopProvider(args);
    case "stop-suite": return commandStopSuite(args);
    case "reset-lane": return commandResetLane(args);
    case "dry-run":    return commandDryRun(args);
  }
}

// ---------------------------------------------------------------------------
// help
// ---------------------------------------------------------------------------

function commandHelp() {
  printJson({
    command: "help",
    skill: SKILL_NAME,
    description: "Supervise multi-lane implementation benchmarks across providers and models.",
    commands: {
      help: "Show this help",
      run: "Start a new benchmark suite from a config JSON file. Required: --project-root, --config",
      resume: "Resume an interrupted suite run. Required: --project-root, --run-root",
      status: "Show suite status and lane progress. Required: --project-root, --run-root",
      "tail-lane": "Show latest heartbeat for a lane. Required: --project-root, --run-root, --lane-id",
      "stop-lane": "Stop a single lane. Required: --project-root, --run-root, --lane-id",
      "stop-provider": "Stop all lanes for a provider. Required: --project-root, --run-root, --provider",
      "stop-suite": "Stop the entire suite. Required: --project-root, --run-root",
      "reset-lane": "Reset a stopped/failed lane for re-run. Required: --project-root, --run-root, --lane-id",
      "dry-run": "Parse config and show planned matrix. Required: --project-root, --config"
    },
    config_schema_versions: ["v1 (auto-converts to v2)", "v2 (native)"],
    supported_providers: ["codex", "claude", "gemini"],
    max_review_cycles: 6
  });
}

// ---------------------------------------------------------------------------
// dry-run
// ---------------------------------------------------------------------------

async function commandDryRun(args) {
  const projectRoot = normalizeProjectRoot(requiredArg(args, "project-root"));
  const configPath = resolve(requiredArg(args, "config"));

  if (!existsSync(configPath)) {
    fail("Config file does not exist: " + configPath);
  }

  const rawConfig = JSON.parse(await readFile(configPath, "utf8"));
  const config = parseBenchmarkSuiteConfig(rawConfig);

  const verificationPlan = (config.verification_commands ?? []).map((cmd) => ({
    id: cmd.id,
    label: cmd.label,
    rendered_command: renderCommand(cmd),
    cwd: cmd.cwd,
    timeout_ms: cmd.timeout_ms,
    optional: cmd.optional
  }));

  const laneMatrix = config.engines.map((engine) => ({
    lane_id: engine.id,
    display_name: engine.display_name,
    provider: engine.provider,
    model: engine.model,
    reasoning: engine.reasoning,
    effort: engine.effort,
    bypass: engine.bypass,
    access_mode: engine.access_mode,
    timeout_ms: engine.timeout_ms
  }));

  printJson({
    command: "dry-run",
    config_path: normalizeSlashes(configPath),
    project_root: normalizeSlashes(projectRoot),
    suite_id: config.suite_id,
    description: config.description,
    schema_version: config.schema_version,
    feature: config.feature,
    isolation: config.isolation,
    execution_policy: config.execution_policy,
    artifact_policy: config.artifact_policy,
    notification_policy: config.notification_policy,
    verification_plan: {
      command_count: verificationPlan.length,
      commands: verificationPlan
    },
    lane_matrix: {
      lane_count: laneMatrix.length,
      lanes: laneMatrix
    },
    context_files_count: (config.context_files ?? []).length,
    response_requirements: config.response_requirements ?? null,
    validation: "passed"
  });
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function commandRun(args) {
  const projectRoot = normalizeProjectRoot(requiredArg(args, "project-root"));
  const configPath = resolve(requiredArg(args, "config"));
  const globalCutoffOverride = args.values["global-cutoff-minutes"]
    ? safeInteger(args.values["global-cutoff-minutes"], null)
    : null;

  if (!existsSync(configPath)) {
    fail("Config file does not exist: " + configPath);
  }

  const rawConfig = JSON.parse(await readFile(configPath, "utf8"));
  const config = parseBenchmarkSuiteConfig(rawConfig);

  if (globalCutoffOverride !== null) {
    config.execution_policy.global_cutoff_minutes = globalCutoffOverride;
  }

  const isoStamp = nowIso().replace(/:/g, "-").replace(/\./g, "_");
  const explicitRunRoot = args.values["run-root"];
  const runRoot = explicitRunRoot
    ? resolve(explicitRunRoot)
    : resolve(projectRoot, ".codex", SKILL_NAME, "runs", config.suite_id + "-" + isoStamp);

  await mkdir(runRoot, { recursive: true });

  const suiteState = buildInitialSuiteState(config, runRoot, configPath);
  const locksRoot = join(runRoot, "locks");

  await withLock(locksRoot, "suite-state", async () => {
    await writeJsonAtomic(join(runRoot, SUITE_STATE_FILE), suiteState);
  });
  await writeJsonAtomic(join(runRoot, RESOLVED_CONFIG_FILE), config);

  await appendEventLog(join(runRoot, "events"), {
    event: "suite-started",
    suite_id: config.suite_id,
    run_root: normalizeSlashes(runRoot),
    lane_count: config.engines.length
  });

  const basePrompt = buildBasePrompt(config);
  await writeTextAtomic(join(runRoot, "prompt.txt"), basePrompt);

  const deadlineAtMs = config.execution_policy.global_cutoff_minutes
    ? Date.now() + (config.execution_policy.global_cutoff_minutes * 60_000)
    : null;

  if (deadlineAtMs) {
    suiteState.global_cutoff_at = new Date(deadlineAtMs).toISOString();
  }

  await withLock(locksRoot, "suite-state", async () => {
    suiteState.status = "running";
    suiteState.updated_at = nowIso();
    await writeJsonAtomic(join(runRoot, SUITE_STATE_FILE), suiteState);
  });

  const laneSummaries = await runAllLanes(config, suiteState, runRoot, projectRoot, basePrompt, deadlineAtMs, locksRoot);

  const suiteSummary = await buildAndWriteSuiteSummary(config, suiteState, runRoot, laneSummaries, locksRoot);

  printJson({
    command: "run",
    suite_id: config.suite_id,
    run_root: normalizeSlashes(runRoot),
    status: suiteSummary.status,
    totals: suiteSummary.totals,
    rankings: suiteSummary.rankings,
    lanes: laneSummaries.map(summarizeLaneForOutput)
  });
}

// ---------------------------------------------------------------------------
// resume
// ---------------------------------------------------------------------------

async function commandResume(args) {
  const projectRoot = normalizeProjectRoot(requiredArg(args, "project-root"));
  const runRoot = resolve(requiredArg(args, "run-root"));

  if (!existsSync(join(runRoot, SUITE_STATE_FILE))) {
    fail("No suite-state.json found in run-root: " + runRoot);
  }

  const suiteState = await readJson(join(runRoot, SUITE_STATE_FILE));
  const config = await readJson(join(runRoot, RESOLVED_CONFIG_FILE));
  const locksRoot = join(runRoot, "locks");

  if (suiteState.status === "completed") {
    printJson({
      command: "resume",
      suite_id: config.suite_id,
      run_root: normalizeSlashes(runRoot),
      status: "completed",
      message: "Suite already completed. Nothing to resume."
    });
    return;
  }

  await withLock(locksRoot, "suite-state", async () => {
    suiteState.status = "running";
    suiteState.resumed_at = nowIso();
    suiteState.updated_at = nowIso();
    await writeJsonAtomic(join(runRoot, SUITE_STATE_FILE), suiteState);
  });

  await appendEventLog(join(runRoot, "events"), {
    event: "suite-started",
    suite_id: config.suite_id,
    run_root: normalizeSlashes(runRoot),
    lane_count: config.engines.length,
    resumed: true
  });

  const basePrompt = await readFile(join(runRoot, "prompt.txt"), "utf8").catch(() => buildBasePrompt(config));

  const deadlineAtMs = suiteState.global_cutoff_at
    ? Date.parse(suiteState.global_cutoff_at)
    : config.execution_policy.global_cutoff_minutes
      ? Date.now() + (config.execution_policy.global_cutoff_minutes * 60_000)
      : null;

  const laneSummaries = await runAllLanes(config, suiteState, runRoot, projectRoot, basePrompt, deadlineAtMs, locksRoot);

  const suiteSummary = await buildAndWriteSuiteSummary(config, suiteState, runRoot, laneSummaries, locksRoot);

  printJson({
    command: "resume",
    suite_id: config.suite_id,
    run_root: normalizeSlashes(runRoot),
    status: suiteSummary.status,
    totals: suiteSummary.totals,
    rankings: suiteSummary.rankings,
    lanes: laneSummaries.map(summarizeLaneForOutput)
  });
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

async function commandStatus(args) {
  const projectRoot = normalizeProjectRoot(requiredArg(args, "project-root"));
  const runRoot = resolve(requiredArg(args, "run-root"));

  if (!existsSync(join(runRoot, SUITE_STATE_FILE))) {
    fail("No suite-state.json found in run-root: " + runRoot);
  }

  const suiteState = await readJson(join(runRoot, SUITE_STATE_FILE));
  const config = await readJsonIfExists(join(runRoot, RESOLVED_CONFIG_FILE), null);
  const heartbeats = await readAllHeartbeats(join(runRoot, "heartbeats"));

  const laneStatuses = [];
  const lanesRoot = join(runRoot, "lanes");
  if (await pathExists(lanesRoot)) {
    let entries;
    try {
      entries = await readdir(lanesRoot, { withFileTypes: true });
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const laneStatePath = join(lanesRoot, entry.name, "lane-state.json");
      const laneState = await readJsonIfExists(laneStatePath, null);
      if (laneState) {
        const heartbeat = heartbeats.find((h) => h.lane_id === entry.name) ?? null;
        laneStatuses.push({
          lane_id: entry.name,
          status: laneState.status ?? "unknown",
          cycle_number: laneState.next_cycle_number ?? 1,
          provider: laneState.provider ?? null,
          model: laneState.model ?? null,
          verification_status: laneState.verification_status ?? null,
          updated_at: laneState.updated_at ?? null,
          heartbeat_at: heartbeat?.heartbeat_at ?? null,
          heartbeat_step: heartbeat?.step ?? null
        });
      }
    }
  }

  const totalCount = laneStatuses.length;
  const activeCount = laneStatuses.filter((l) => l.status === "running" || l.status === "provisioning" || l.status === "verification_pending" || l.status === "review_pending").length;
  const completedCount = laneStatuses.filter((l) => l.status === "succeeded").length;
  const failedCount = laneStatuses.filter((l) => l.status === "failed" || l.status === "max_cycles_exhausted").length;
  const blockedCount = laneStatuses.filter((l) => l.status === "blocked").length;
  const stoppedCount = laneStatuses.filter((l) => l.status === "stopped" || l.status === "lane_stopped" || l.status === "provider_stopped" || l.status === "suite_stopped").length;
  const resumableCount = laneStatuses.filter((l) => !BENCHMARK_TERMINAL_LANE_STATUSES.has(l.status) || l.status === "failed" || l.status === "stopped" || l.status === "lane_stopped" || l.status === "provider_stopped" || l.status === "suite_stopped").length;

  printJson({
    command: "status",
    suite_id: suiteState.suite_id ?? config?.suite_id ?? "unknown",
    run_root: normalizeSlashes(runRoot),
    suite_status: suiteState.status ?? "unknown",
    started_at: suiteState.started_at ?? null,
    updated_at: suiteState.updated_at ?? null,
    global_cutoff_at: suiteState.global_cutoff_at ?? null,
    totals: {
      total: totalCount,
      active: activeCount,
      completed: completedCount,
      failed: failedCount,
      blocked: blockedCount,
      stopped: stoppedCount,
      resumable: resumableCount
    },
    lanes: laneStatuses
  });
}

// ---------------------------------------------------------------------------
// tail-lane
// ---------------------------------------------------------------------------

async function commandTailLane(args) {
  const projectRoot = normalizeProjectRoot(requiredArg(args, "project-root"));
  const runRoot = resolve(requiredArg(args, "run-root"));
  const laneId = requiredArg(args, "lane-id");

  const laneRoot = join(runRoot, "lanes", laneId);
  if (!existsSync(laneRoot)) {
    fail("Lane directory does not exist: " + laneRoot);
  }

  const laneState = await readJsonIfExists(join(laneRoot, "lane-state.json"), null);
  const heartbeats = await readAllHeartbeats(join(runRoot, "heartbeats"));
  const heartbeat = heartbeats.find((h) => h.lane_id === laneId) ?? null;
  const cycles = await readJsonIfExists(join(laneRoot, "cycles.json"), []);
  const latestCycle = Array.isArray(cycles) && cycles.length > 0 ? cycles[cycles.length - 1] : null;

  printJson({
    command: "tail-lane",
    lane_id: laneId,
    run_root: normalizeSlashes(runRoot),
    lane_status: laneState?.status ?? "unknown",
    cycle_number: laneState?.next_cycle_number ?? 1,
    provider: laneState?.provider ?? null,
    model: laneState?.model ?? null,
    updated_at: laneState?.updated_at ?? null,
    heartbeat: heartbeat ? {
      heartbeat_at: heartbeat.heartbeat_at,
      step: heartbeat.step,
      cycle_number: heartbeat.cycle_number,
      status: heartbeat.status
    } : null,
    latest_cycle: latestCycle ? {
      cycle_number: latestCycle.cycle_number,
      started_at: latestCycle.started_at,
      finished_at: latestCycle.finished_at,
      invocation_status: latestCycle.invocation_status,
      verification_status: latestCycle.verification_status,
      error_message: latestCycle.error_message
    } : null,
    verification_failures: laneState?.verification_failures ?? []
  });
}

// ---------------------------------------------------------------------------
// stop-lane
// ---------------------------------------------------------------------------

async function commandStopLane(args) {
  const projectRoot = normalizeProjectRoot(requiredArg(args, "project-root"));
  const runRoot = resolve(requiredArg(args, "run-root"));
  const laneId = requiredArg(args, "lane-id");

  const signalsRoot = join(runRoot, "signals");
  const signalPath = await createStopSignal(signalsRoot, "lane", laneId, "Operator requested lane stop.");

  await appendEventLog(join(runRoot, "events"), {
    event: "lane-stopped",
    lane_id: laneId,
    reason: "Operator requested lane stop.",
    signal_path: normalizeSlashes(signalPath)
  });

  printJson({
    command: "stop-lane",
    lane_id: laneId,
    run_root: normalizeSlashes(runRoot),
    signal_path: normalizeSlashes(signalPath),
    message: "Stop signal created for lane '" + laneId + "'. Lane will stop at next cycle boundary."
  });
}

// ---------------------------------------------------------------------------
// stop-provider
// ---------------------------------------------------------------------------

async function commandStopProvider(args) {
  const projectRoot = normalizeProjectRoot(requiredArg(args, "project-root"));
  const runRoot = resolve(requiredArg(args, "run-root"));
  const provider = requiredArg(args, "provider");

  if (!["codex", "claude", "gemini"].includes(provider)) {
    fail("Provider must be one of: codex, claude, gemini. Received: " + provider);
  }

  const signalsRoot = join(runRoot, "signals");
  const signalPath = await createStopSignal(signalsRoot, "provider", provider, "Operator requested provider stop.");

  await appendEventLog(join(runRoot, "events"), {
    event: "lane-stopped",
    provider,
    reason: "Operator requested provider stop.",
    signal_path: normalizeSlashes(signalPath)
  });

  printJson({
    command: "stop-provider",
    provider,
    run_root: normalizeSlashes(runRoot),
    signal_path: normalizeSlashes(signalPath),
    message: "Stop signal created for provider '" + provider + "'. All " + provider + " lanes will stop at next cycle boundary."
  });
}

// ---------------------------------------------------------------------------
// stop-suite
// ---------------------------------------------------------------------------

async function commandStopSuite(args) {
  const projectRoot = normalizeProjectRoot(requiredArg(args, "project-root"));
  const runRoot = resolve(requiredArg(args, "run-root"));

  const signalsRoot = join(runRoot, "signals");
  const signalPath = await createStopSignal(signalsRoot, "suite", "all", "Operator requested suite stop.");

  const locksRoot = join(runRoot, "locks");
  await withLock(locksRoot, "suite-state", async () => {
    const suiteState = await readJsonIfExists(join(runRoot, SUITE_STATE_FILE), null);
    if (suiteState && suiteState.status !== "completed") {
      suiteState.status = "stopped";
      suiteState.updated_at = nowIso();
      await writeJsonAtomic(join(runRoot, SUITE_STATE_FILE), suiteState);
    }
  });

  await appendEventLog(join(runRoot, "events"), {
    event: "suite-stopped",
    reason: "Operator requested suite stop.",
    signal_path: normalizeSlashes(signalPath)
  });

  printJson({
    command: "stop-suite",
    run_root: normalizeSlashes(runRoot),
    signal_path: normalizeSlashes(signalPath),
    message: "Stop signal created for entire suite. All lanes will stop at next cycle boundary."
  });
}

// ---------------------------------------------------------------------------
// reset-lane
// ---------------------------------------------------------------------------

async function commandResetLane(args) {
  const projectRoot = normalizeProjectRoot(requiredArg(args, "project-root"));
  const runRoot = resolve(requiredArg(args, "run-root"));
  const laneId = requiredArg(args, "lane-id");

  const laneRoot = join(runRoot, "lanes", laneId);
  if (!existsSync(laneRoot)) {
    fail("Lane directory does not exist: " + laneRoot);
  }

  const laneStatePath = join(laneRoot, "lane-state.json");
  const laneState = await readJsonIfExists(laneStatePath, null);

  if (!laneState) {
    fail("No lane-state.json found for lane '" + laneId + "'.");
  }

  const resettableStatuses = new Set([
    "failed", "stopped", "lane_stopped", "provider_stopped", "suite_stopped",
    "max_cycles_exhausted", "blocked"
  ]);

  if (!resettableStatuses.has(laneState.status)) {
    fail("Lane '" + laneId + "' is in status '" + laneState.status + "' which cannot be reset. Resettable statuses: " + Array.from(resettableStatuses).join(", "));
  }

  const previousStatus = laneState.status;
  const locksRoot = join(runRoot, "locks");

  await withLock(locksRoot, "lane-" + laneId, async () => {
    laneState.status = "provisioning";
    laneState.updated_at = nowIso();
    await writeJsonAtomic(laneStatePath, laneState);
  });

  // Clear any stop signal for this lane
  const signalsRoot = join(runRoot, "signals");
  await clearStopSignal(signalsRoot, "lane", laneId);

  await appendEventLog(join(runRoot, "events"), {
    event: "lane-reset",
    lane_id: laneId,
    previous_status: previousStatus,
    new_status: "provisioning"
  });

  printJson({
    command: "reset-lane",
    lane_id: laneId,
    run_root: normalizeSlashes(runRoot),
    previous_status: previousStatus,
    new_status: "provisioning",
    message: "Lane '" + laneId + "' reset from '" + previousStatus + "' to 'provisioning'. Use 'resume' to re-run."
  });
}

// ---------------------------------------------------------------------------
// Lane execution engine
// ---------------------------------------------------------------------------

async function runAllLanes(config, suiteState, runRoot, projectRoot, basePrompt, deadlineAtMs, locksRoot) {
  const lanesRoot = join(runRoot, "lanes");
  await mkdir(lanesRoot, { recursive: true });

  const signalsRoot = join(runRoot, "signals");
  const heartbeatsRoot = join(runRoot, "heartbeats");
  const eventsRoot = join(runRoot, "events");
  const laneSummaries = [];

  for (const engine of config.engines) {
    // Check suite-level stop before each lane
    const suiteStop = await checkStopSignal(signalsRoot, null, null);
    if (suiteStop) {
      const stoppedSummary = buildStoppedLaneSummary(engine, config, "suite_stopped", "Suite stop signal detected before lane execution.");
      laneSummaries.push(stoppedSummary);
      continue;
    }

    if (isGlobalCutoffReached(deadlineAtMs)) {
      const cutoffSummary = buildStoppedLaneSummary(engine, config, "global_cutoff_reached", "Global cutoff reached before lane could start.");
      laneSummaries.push(cutoffSummary);
      continue;
    }

    try {
      const summary = await runSingleLane(
        config, engine, suiteState, runRoot, projectRoot,
        basePrompt, deadlineAtMs, locksRoot, signalsRoot, heartbeatsRoot, eventsRoot
      );
      laneSummaries.push(summary);
    } catch (error) {
      const errorMessage = describeError(error);
      const fallbackSummary = buildErrorLaneSummary(engine, config, errorMessage);
      laneSummaries.push(fallbackSummary);

      await appendEventLog(eventsRoot, {
        event: "lane-failed",
        lane_id: engine.id,
        provider: engine.provider,
        model: engine.model,
        error_message: truncateText(errorMessage, 2000)
      });
    }

    // Update suite state after each lane
    await withLock(locksRoot, "suite-state", async () => {
      suiteState.updated_at = nowIso();
      suiteState.lanes_completed = laneSummaries.filter((l) => BENCHMARK_TERMINAL_LANE_STATUSES.has(l.status)).length;
      suiteState.lanes_succeeded = laneSummaries.filter((l) => l.status === "succeeded").length;
      suiteState.lanes_failed = laneSummaries.filter((l) => l.status === "failed" || l.status === "max_cycles_exhausted").length;
      await writeJsonAtomic(join(runRoot, SUITE_STATE_FILE), suiteState);
    });
  }

  return laneSummaries;
}

async function runSingleLane(config, engine, suiteState, runRoot, projectRoot, basePrompt, deadlineAtMs, locksRoot, signalsRoot, heartbeatsRoot, eventsRoot) {
  const laneRoot = join(runRoot, "lanes", engine.id);
  await mkdir(laneRoot, { recursive: true });

  const laneStatePath = join(laneRoot, "lane-state.json");
  const laneSummaryPath = join(laneRoot, "lane-summary.json");
  const cyclesPath = join(laneRoot, "cycles.json");

  // Check for existing completed summary (resume case)
  const existingSummary = await readJsonIfExists(laneSummaryPath, null);
  if (existingSummary && BENCHMARK_TERMINAL_LANE_STATUSES.has(existingSummary.status)) {
    return existingSummary;
  }

  // Load or initialize lane state
  const existingState = await readJsonIfExists(laneStatePath, null);
  const laneStartedAt = existingState?.started_at ?? nowIso();
  const laneStartedMs = Date.parse(laneStartedAt);

  const laneState = existingState ?? {
    schema_version: 1,
    suite_id: config.suite_id,
    lane_id: engine.id,
    provider: engine.provider,
    model: engine.model,
    started_at: laneStartedAt,
    updated_at: laneStartedAt,
    status: "provisioning",
    workspace: null,
    workspace_preparation_ms: 0,
    session_handle: null,
    next_cycle_number: 1,
    feedback: null,
    verification_status: null,
    verification_failures: [],
    final_response_path: null,
    final_result_path: null,
    final_request_path: null,
    final_verification_path: null
  };

  let workspacePreparationMs = laneState.workspace_preparation_ms ?? 0;

  // Emit lane-provisioning event
  await appendEventLog(eventsRoot, {
    event: "lane-provisioning",
    lane_id: engine.id,
    provider: engine.provider,
    model: engine.model
  });

  await writeHeartbeat(heartbeatsRoot, engine.id, {
    step: "provisioning",
    provider: engine.provider,
    model: engine.model,
    status: "provisioning"
  });

  // Provision workspace
  let workspace;
  const workspaceStart = Date.now();
  try {
    workspace = await prepareLaneWorkspace(
      config.isolation, engine, runRoot, projectRoot,
      config.suite_id, laneState.workspace, null /* no runProcessFn for preflight */
    );
    if (!laneState.workspace) {
      workspacePreparationMs += Date.now() - workspaceStart;
    }
    laneState.workspace = workspace;
  } catch (error) {
    const errorMessage = describeError(error);
    laneState.status = "blocked";
    laneState.updated_at = nowIso();
    await writeJsonAtomic(laneStatePath, laneState);

    const summary = buildBlockedLaneSummary(engine, config, laneRoot, laneSummaryPath, cyclesPath, errorMessage, workspacePreparationMs);
    await writeJsonAtomic(cyclesPath, []);
    await writeJsonAtomic(laneSummaryPath, summary);

    await appendEventLog(eventsRoot, {
      event: "lane-blocked",
      lane_id: engine.id,
      provider: engine.provider,
      model: engine.model,
      blocker_kind: "workspace_preparation_failed",
      error_message: truncateText(errorMessage, 2000)
    });

    return summary;
  }

  // Update lane state to running
  laneState.status = "running";
  laneState.workspace_preparation_ms = workspacePreparationMs;
  laneState.updated_at = nowIso();
  await writeJsonAtomic(laneStatePath, laneState);

  await appendEventLog(eventsRoot, {
    event: "lane-started",
    lane_id: engine.id,
    provider: engine.provider,
    model: engine.model,
    working_directory: normalizeSlashes(workspace.working_directory)
  });

  // Run cycles
  const existingCycles = await readJsonIfExists(cyclesPath, []) ?? [];
  const cycles = Array.isArray(existingCycles) ? [...existingCycles] : [];

  let sessionHandle = laneState.session_handle;
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
  let timeToFirstGreenMs = null;

  let finalResponsePath = laneState.final_response_path;
  let finalResultPath = laneState.final_result_path;
  let finalRequestPath = laneState.final_request_path;
  let finalVerificationPath = laneState.final_verification_path;
  let verificationFailures = laneState.verification_failures ?? [];
  let feedback = laneState.feedback;
  let finalStatus = "failed";
  let finalVerificationStatus = (config.verification_commands ?? []).length > 0 ? "failed" : "not_configured";
  let blockerKind = null;
  let blockerReason = null;
  let finalErrorMessage = null;

  // Replay existing cycle metrics
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
    finalVerificationStatus = existingCycle.verification_status ?? finalVerificationStatus;
  }

  const maxCycles = Math.min(config.execution_policy.max_review_cycles ?? 1, 6);
  const startCycleNumber = Math.max(1, laneState.next_cycle_number ?? 1);

  for (let cycleNumber = startCycleNumber; cycleNumber <= maxCycles; cycleNumber += 1) {
    // Check stop signals
    const stopSignal = await checkStopSignal(signalsRoot, engine.id, engine.provider);
    if (stopSignal) {
      const stopStatus = stopSignal.scope === "suite" ? "suite_stopped"
        : stopSignal.scope === "provider" ? "provider_stopped"
        : "lane_stopped";
      finalStatus = stopStatus;
      finalErrorMessage = "Stopped by " + stopSignal.scope + " signal.";
      laneState.status = stopStatus;
      laneState.next_cycle_number = cycleNumber;
      laneState.updated_at = nowIso();
      await writeJsonAtomic(laneStatePath, laneState);

      await appendEventLog(eventsRoot, {
        event: "lane-stopped",
        lane_id: engine.id,
        provider: engine.provider,
        stop_scope: stopSignal.scope,
        stop_target: stopSignal.target
      });
      break;
    }

    // Check global cutoff
    if (isGlobalCutoffReached(deadlineAtMs)) {
      finalStatus = "global_cutoff_reached";
      blockerKind = "global_cutoff_reached";
      blockerReason = "Global benchmark cutoff reached before the next review cycle could start.";
      finalErrorMessage = blockerReason;
      laneState.status = "global_cutoff_reached";
      laneState.next_cycle_number = cycleNumber;
      laneState.updated_at = nowIso();
      await writeJsonAtomic(laneStatePath, laneState);
      break;
    }

    await writeHeartbeat(heartbeatsRoot, engine.id, {
      step: "cycle-" + cycleNumber,
      cycle_number: cycleNumber,
      provider: engine.provider,
      model: engine.model,
      status: "running"
    });

    await appendEventLog(eventsRoot, {
      event: "lane-cycle-started",
      lane_id: engine.id,
      provider: engine.provider,
      model: engine.model,
      cycle_number: cycleNumber
    });

    const cycleRoot = join(laneRoot, "cycle-" + String(cycleNumber).padStart(2, "0"));
    await mkdir(cycleRoot, { recursive: true });

    const prompt = buildCyclePrompt(basePrompt, engine, cycleNumber, maxCycles, feedback);
    const promptPath = join(cycleRoot, "prompt.txt");
    const requestPath = join(cycleRoot, "request.json");
    const responsePath = join(cycleRoot, "response.txt");
    const resultPath = join(cycleRoot, "result.json");
    const verificationPath = join(cycleRoot, "verification.json");
    await writeFile(promptPath, prompt, "utf-8");

    const invocationRequest = {
      lane: { id: engine.id, provider: engine.provider, model: engine.model },
      cycle_number: cycleNumber,
      invocation: {
        provider: engine.provider,
        model: engine.model,
        reasoning: engine.reasoning,
        effort: engine.effort,
        bypass: engine.bypass,
        access_mode: engine.access_mode,
        timeout_ms: deriveEffectiveTimeoutMs(engine.timeout_ms, deadlineAtMs),
        working_directory: normalizeSlashes(workspace.working_directory),
        prompt_chars: prompt.length,
        prompt_path: normalizeSlashes(promptPath),
        session_handle: sessionHandle
      }
    };
    await writeJsonAtomic(requestPath, invocationRequest);

    const cycleStartedAt = nowIso();
    const cycleStartedMs = Date.now();

    // Execute the invocation
    // In the supervisor context, we build the request but do not directly invoke
    // the provider. Instead, we record what would be invoked and run verification.
    // The actual provider invocation happens through implement-plan's governed flow.
    //
    // For the supervisor, each "cycle" consists of:
    // 1. Building the prompt and request
    // 2. Running verification on the current workspace state
    // 3. Recording the cycle result
    //
    // The lane's provider invocation is deferred to implement-plan integration.
    // Here we simulate the verification-only cycle for the supervisor infrastructure.

    const verification = await runVerificationPlan(
      config.verification_commands ?? [],
      workspace,
      deadlineAtMs,
      runManagedProcessStub
    );
    const verificationLatencyMs = verification.results.reduce((sum, r) => sum + (r.latency_ms ?? 0), 0);
    totalVerificationLatencyMs += verificationLatencyMs;
    await writeJsonAtomic(verificationPath, verification);

    finalVerificationPath = (config.verification_commands ?? []).length > 0 ? normalizeSlashes(verificationPath) : null;
    verificationFailures = verification.failures ?? [];
    laneState.final_verification_path = finalVerificationPath;
    laneState.verification_failures = verificationFailures;
    laneState.verification_status = verification.status;
    feedback = buildVerificationFeedback(verification.results);
    laneState.feedback = feedback;

    const cycleWallClockMs = Math.max(0, Date.now() - cycleStartedMs);
    if (cycleNumber > 1) {
      selfFixCycleCount += 1;
      selfFixWallClockMs += cycleWallClockMs;
      selfFixVerificationMs += verificationLatencyMs;
    }

    if (timeToFirstGreenMs === null && (verification.status === "passed" || verification.status === "not_configured")) {
      timeToFirstGreenMs = Math.max(0, Date.now() - laneStartedMs);
    }

    const cycleSummary = {
      cycle_number: cycleNumber,
      started_at: cycleStartedAt,
      finished_at: nowIso(),
      cycle_wall_clock_ms: cycleWallClockMs,
      prompt_path: normalizeSlashes(promptPath),
      request_path: normalizeSlashes(requestPath),
      response_path: null,
      result_path: normalizeSlashes(resultPath),
      verification_path: finalVerificationPath,
      invocation_status: "deferred",
      verification_status: verification.status,
      llm_latency_ms: null,
      invocation_attempt_count: 0,
      estimated_cost_usd: null,
      prompt_tokens_estimated: null,
      response_tokens_estimated: null,
      total_tokens_estimated: null,
      verification_latency_ms: verificationLatencyMs,
      session_handle: sessionHandle,
      error_message: verification.status === "failed" ? (verification.failures ?? []).join(" | ") : verification.blocker_reason,
      blocker_kind: verification.blocker_kind ?? null,
      blocker_reason: verification.blocker_reason ?? null,
      verification_failures: verification.failures ?? []
    };

    cycles.push(cycleSummary);
    await writeJsonAtomic(resultPath, cycleSummary);

    await appendEventLog(eventsRoot, {
      event: "lane-cycle-completed",
      lane_id: engine.id,
      provider: engine.provider,
      model: engine.model,
      cycle_number: cycleNumber,
      verification_status: verification.status
    });

    if (verification.status === "passed" || verification.status === "not_configured") {
      finalStatus = "succeeded";
      finalVerificationStatus = verification.status;
      finalErrorMessage = null;
      laneState.status = "succeeded";
      laneState.next_cycle_number = cycleNumber + 1;
      laneState.updated_at = nowIso();
      await writeJsonAtomic(laneStatePath, laneState);

      await appendEventLog(eventsRoot, {
        event: "lane-completed",
        lane_id: engine.id,
        provider: engine.provider,
        model: engine.model,
        status: "succeeded"
      });
      break;
    }

    if (verification.status === "global_cutoff_reached") {
      finalStatus = "global_cutoff_reached";
      finalVerificationStatus = verification.status;
      blockerKind = "global_cutoff_reached";
      blockerReason = verification.blocker_reason;
      finalErrorMessage = verification.blocker_reason;
      laneState.status = "global_cutoff_reached";
      laneState.next_cycle_number = cycleNumber + 1;
      laneState.updated_at = nowIso();
      await writeJsonAtomic(laneStatePath, laneState);
      break;
    }

    if (verification.status === "blocked") {
      finalStatus = "blocked";
      finalVerificationStatus = verification.status;
      blockerKind = verification.blocker_kind;
      blockerReason = verification.blocker_reason;
      finalErrorMessage = verification.blocker_reason;
      laneState.status = "blocked";
      laneState.next_cycle_number = cycleNumber + 1;
      laneState.updated_at = nowIso();
      await writeJsonAtomic(laneStatePath, laneState);

      await appendEventLog(eventsRoot, {
        event: "lane-blocked",
        lane_id: engine.id,
        provider: engine.provider,
        model: engine.model,
        blocker_kind: blockerKind,
        error_message: blockerReason
      });
      break;
    }

    // Verification failed — continue to next cycle or exhaust
    finalStatus = cycleNumber >= maxCycles ? "max_cycles_exhausted" : "failed";
    finalVerificationStatus = verification.status;
    finalErrorMessage = (verification.failures ?? []).join(" | ");
    laneState.status = finalStatus;
    laneState.next_cycle_number = cycleNumber + 1;
    laneState.updated_at = nowIso();
    await writeJsonAtomic(laneStatePath, laneState);

    if (cycleNumber >= maxCycles) {
      await appendEventLog(eventsRoot, {
        event: "lane-failed",
        lane_id: engine.id,
        provider: engine.provider,
        model: engine.model,
        status: "max_cycles_exhausted"
      });
      break;
    }
  }

  // Collect git artifacts
  const gitArtifacts = await collectLaneGitArtifacts(laneRoot, workspace);

  // Build lane summary
  const phaseMetrics = createEmptyPhaseMetrics();
  phaseMetrics.workspace_preparation_ms = workspacePreparationMs;
  phaseMetrics.implementation_invocation_ms = totalLlmLatencyMs;
  phaseMetrics.machine_verification_ms = totalVerificationLatencyMs;
  phaseMetrics.self_fix_cycle_count = selfFixCycleCount;
  phaseMetrics.self_fix_wall_clock_ms = selfFixWallClockMs;
  phaseMetrics.self_fix_invocation_ms = selfFixInvocationMs;
  phaseMetrics.self_fix_verification_ms = selfFixVerificationMs;
  phaseMetrics.human_testing_skipped = config.execution_policy.skip_human_testing ?? true;
  phaseMetrics.time_to_first_green_ms = timeToFirstGreenMs;

  const laneSummary = {
    lane_id: engine.id,
    display_name: engine.display_name ?? null,
    provider: engine.provider,
    cli: engine.cli ?? engine.provider,
    model: engine.model,
    reasoning: engine.reasoning ?? null,
    effort: engine.effort ?? null,
    isolation_mode: workspace.isolation_mode,
    working_directory: normalizeSlashes(workspace.working_directory),
    worktree_path: workspace.worktree_path ? normalizeSlashes(workspace.worktree_path) : null,
    base_ref: workspace.base_ref ?? null,
    starting_head_sha: workspace.starting_head_sha ?? null,
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
    final_response_path: finalResponsePath ? normalizeSlashes(finalResponsePath) : null,
    final_result_path: finalResultPath ? normalizeSlashes(finalResultPath) : null,
    final_request_path: finalRequestPath ? normalizeSlashes(finalRequestPath) : null,
    final_verification_path: finalVerificationPath,
    lane_summary_path: normalizeSlashes(laneSummaryPath),
    cycles_path: normalizeSlashes(cyclesPath),
    git_status_path: gitArtifacts.git_status_path,
    diff_stat_path: gitArtifacts.diff_stat_path,
    diff_patch_path: gitArtifacts.diff_patch_path,
    changed_paths_path: gitArtifacts.changed_paths_path,
    changed_paths: gitArtifacts.changed_paths,
    verification_failures: verificationFailures,
    latest_session_handle: sessionHandle,
    resume_supported: supportsPersistentSession(engine.provider) && sessionHandle !== null,
    phase_metrics: phaseMetrics,
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
        forbidden_surface_violations: []
      }
    }
  };

  // Evaluate artifact quality
  laneSummary.artifact_quality = evaluateArtifactQuality(
    config.artifact_policy ?? {},
    workspace,
    laneSummary
  );

  await writeJsonAtomic(cyclesPath, cycles);
  await writeJsonAtomic(laneSummaryPath, laneSummary);

  await writeHeartbeat(heartbeatsRoot, engine.id, {
    step: "completed",
    cycle_number: cycles.length,
    provider: engine.provider,
    model: engine.model,
    status: finalStatus
  });

  return laneSummary;
}

// ---------------------------------------------------------------------------
// Managed process stub for verification in supervisor context
// ---------------------------------------------------------------------------

async function runManagedProcessStub(params) {
  // The supervisor runs verification commands directly via child_process
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(params.command, params.args ?? [], {
    cwd: params.cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: params.timeoutMs ?? DEFAULT_VERIFICATION_TIMEOUT_MS,
    env: params.env ?? process.env
  });

  if (result.error) {
    throw result.error;
  }

  return {
    exitCode: result.status ?? 1,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : ""
  };
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildBasePrompt(config) {
  const parts = [];
  parts.push("You are participating in a controlled multi-engine implementation benchmark for the ADF implement-plan workflow.");

  if (config.isolation?.mode === "git_worktree") {
    parts.push("Every lane runs inside its own isolated git worktree from the same base snapshot.");
  }

  parts.push("");
  parts.push("<benchmark>");
  parts.push("id: " + config.suite_id);
  if (config.description) parts.push("description: " + config.description);
  if (config.isolation?.target_slug) parts.push("target_slug: " + config.isolation.target_slug);
  if (config.isolation?.base_ref) parts.push("base_ref: " + config.isolation.base_ref);
  parts.push("</benchmark>");

  parts.push("");
  parts.push("<execution_policy>");
  parts.push("max_review_cycles: " + (config.execution_policy?.max_review_cycles ?? 1));
  parts.push("skip_human_testing: " + (config.execution_policy?.skip_human_testing ? "true" : "false"));
  parts.push("global_cutoff_minutes: " + (config.execution_policy?.global_cutoff_minutes ?? "none"));
  parts.push("</execution_policy>");

  if (config.feature?.task_summary) {
    parts.push("");
    parts.push("<task_summary>");
    parts.push(config.feature.task_summary);
    parts.push("</task_summary>");
  }

  if (config.feature?.instructions) {
    parts.push("");
    parts.push("<instructions>");
    parts.push(config.feature.instructions);
    parts.push("</instructions>");
  }

  if (Array.isArray(config.context_files) && config.context_files.length > 0) {
    for (const filePath of config.context_files) {
      parts.push("");
      parts.push("<context_file path=\"" + filePath + "\">");
      parts.push("[content loaded at runtime]");
      parts.push("</context_file>");
    }
  }

  if (Array.isArray(config.verification_commands) && config.verification_commands.length > 0) {
    parts.push("");
    parts.push("<machine_verification>");
    parts.push("The harness will run these machine checks after each review cycle:");
    for (const cmd of config.verification_commands) {
      parts.push("- " + (cmd.label ?? cmd.command) + ": " + renderCommand(cmd) + " (cwd=" + (cmd.cwd ?? ".") + ", timeout_ms=" + (cmd.timeout_ms ?? DEFAULT_VERIFICATION_TIMEOUT_MS) + ", optional=" + (cmd.optional ? "true" : "false") + ")");
    }
    parts.push("</machine_verification>");
  }

  const ap = config.artifact_policy ?? {};
  if ((ap.required_paths?.length > 0) || (ap.required_changed_prefixes?.length > 0) || (ap.allowed_edit_prefixes?.length > 0) || (ap.forbidden_edit_prefixes?.length > 0)) {
    parts.push("");
    parts.push("<artifact_policy>");
    if (ap.required_paths?.length > 0) parts.push("required_paths: " + ap.required_paths.join(", "));
    if (ap.required_changed_prefixes?.length > 0) parts.push("required_changed_prefixes: " + ap.required_changed_prefixes.join(", "));
    if (ap.allowed_edit_prefixes?.length > 0) parts.push("allowed_edit_prefixes: " + ap.allowed_edit_prefixes.join(", "));
    if (ap.forbidden_edit_prefixes?.length > 0) parts.push("forbidden_edit_prefixes: " + ap.forbidden_edit_prefixes.join(", "));
    parts.push("</artifact_policy>");
  }

  if (config.response_requirements) {
    parts.push("");
    parts.push("<response_requirements>");
    parts.push(config.response_requirements);
    parts.push("</response_requirements>");
  }

  parts.push("");
  parts.push("Return only your substantive answer for this benchmark run.");
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Suite summary builder
// ---------------------------------------------------------------------------

async function buildAndWriteSuiteSummary(config, suiteState, runRoot, laneSummaries, locksRoot) {
  const finishedAt = nowIso();

  const successCount = laneSummaries.filter((l) => l.status === "succeeded").length;
  const failureCount = laneSummaries.filter((l) => l.status === "failed" || l.status === "max_cycles_exhausted").length;
  const blockedCount = laneSummaries.filter((l) => l.status === "blocked").length;
  const stoppedCount = laneSummaries.filter((l) =>
    l.status === "stopped" || l.status === "suite_stopped" || l.status === "provider_stopped" || l.status === "lane_stopped"
  ).length;
  const cutoffCount = laneSummaries.filter((l) => l.status === "global_cutoff_reached").length;

  const totalCost = Number(laneSummaries.reduce((sum, l) => sum + (l.estimated_cost_usd ?? 0), 0).toFixed(6));
  const totalPromptTokens = laneSummaries.reduce((sum, l) => sum + (l.prompt_tokens_estimated ?? 0), 0);
  const totalResponseTokens = laneSummaries.reduce((sum, l) => sum + (l.response_tokens_estimated ?? 0), 0);

  const allPhaseMetrics = laneSummaries.map((l) => l.phase_metrics).filter(Boolean);
  const aggregatePhaseMetrics = sumPhaseMetrics(allPhaseMetrics);

  const rankings = buildSuiteRankings(laneSummaries);

  const suiteStatus = successCount === laneSummaries.length ? "completed"
    : stoppedCount > 0 ? "stopped"
    : failureCount > 0 || blockedCount > 0 ? "failed"
    : "completed";

  const summary = {
    suite_id: config.suite_id,
    description: config.description,
    started_at: suiteState.started_at,
    finished_at: finishedAt,
    status: suiteStatus,
    run_root: normalizeSlashes(runRoot),
    resumed_from: suiteState.resumed_at ?? null,
    global_cutoff_at: suiteState.global_cutoff_at ?? null,
    config_path: suiteState.config_path ?? null,
    isolation: config.isolation,
    execution_policy: config.execution_policy,
    verification_plan: {
      command_count: (config.verification_commands ?? []).length,
      commands: (config.verification_commands ?? []).map((cmd) => ({
        id: cmd.id,
        label: cmd.label,
        rendered_command: renderCommand(cmd),
        cwd: cmd.cwd,
        timeout_ms: cmd.timeout_ms,
        optional: cmd.optional
      }))
    },
    lanes: laneSummaries,
    totals: {
      lane_count: laneSummaries.length,
      success_count: successCount,
      failure_count: failureCount,
      blocked_count: blockedCount,
      stopped_count: stoppedCount,
      global_cutoff_count: cutoffCount,
      total_estimated_cost_usd: totalCost,
      total_prompt_tokens_estimated: totalPromptTokens,
      total_response_tokens_estimated: totalResponseTokens,
      total_tokens_estimated: totalPromptTokens + totalResponseTokens,
      phase_metrics: aggregatePhaseMetrics
    },
    rankings
  };

  await writeJsonAtomic(join(runRoot, SUMMARY_FILE), summary);

  // Write Brain summary markdown
  const brainMarkdown = buildBrainSummaryMarkdown(summary);
  await writeTextAtomic(join(runRoot, BRAIN_SUMMARY_FILE), brainMarkdown);

  // Update suite state to terminal
  await withLock(locksRoot, "suite-state", async () => {
    suiteState.status = suiteStatus;
    suiteState.finished_at = finishedAt;
    suiteState.updated_at = finishedAt;
    await writeJsonAtomic(join(runRoot, SUITE_STATE_FILE), suiteState);
  });

  await appendEventLog(join(runRoot, "events"), {
    event: "suite-completed",
    suite_id: config.suite_id,
    status: suiteStatus,
    totals: summary.totals,
    rankings: summary.rankings
  });

  return summary;
}

// ---------------------------------------------------------------------------
// Helper: build initial suite state
// ---------------------------------------------------------------------------

function buildInitialSuiteState(config, runRoot, configPath) {
  return {
    schema_version: 1,
    suite_id: config.suite_id,
    status: "initializing",
    started_at: nowIso(),
    updated_at: nowIso(),
    finished_at: null,
    resumed_at: null,
    global_cutoff_at: null,
    config_path: configPath ? normalizeSlashes(configPath) : null,
    run_root: normalizeSlashes(runRoot),
    lane_count: config.engines.length,
    lanes_completed: 0,
    lanes_succeeded: 0,
    lanes_failed: 0
  };
}

// ---------------------------------------------------------------------------
// Helper: build stopped lane summary
// ---------------------------------------------------------------------------

function buildStoppedLaneSummary(engine, config, status, reason) {
  return {
    lane_id: engine.id,
    display_name: engine.display_name ?? null,
    provider: engine.provider,
    cli: engine.cli ?? engine.provider,
    model: engine.model,
    reasoning: engine.reasoning ?? null,
    effort: engine.effort ?? null,
    isolation_mode: config.isolation?.mode ?? "none",
    working_directory: null,
    worktree_path: null,
    base_ref: config.isolation?.base_ref ?? null,
    starting_head_sha: null,
    status,
    cycle_wall_clock_ms: 0,
    total_llm_latency_ms: 0,
    review_cycle_count: 0,
    invocation_attempt_count: 0,
    verification_status: "not_run",
    blocker_kind: status === "global_cutoff_reached" ? "global_cutoff_reached" : null,
    blocker_reason: reason,
    error_message: reason,
    estimated_cost_usd: null,
    prompt_tokens_estimated: null,
    response_tokens_estimated: null,
    total_tokens_estimated: null,
    final_response_path: null,
    final_result_path: null,
    final_request_path: null,
    final_verification_path: null,
    lane_summary_path: null,
    cycles_path: null,
    git_status_path: null,
    diff_stat_path: null,
    diff_patch_path: null,
    changed_paths_path: null,
    changed_paths: [],
    verification_failures: [],
    latest_session_handle: null,
    resume_supported: false,
    phase_metrics: createEmptyPhaseMetrics(),
    artifact_quality: {
      score: 0,
      rating: "weak",
      rubric_version: "heuristic_v1",
      notes: [reason],
      signals: {
        verification_passed: false,
        changed_file_count: 0,
        required_paths_total: (config.artifact_policy?.required_paths ?? []).length,
        required_paths_present: 0,
        required_changed_prefixes_total: (config.artifact_policy?.required_changed_prefixes ?? []).length,
        required_changed_prefixes_satisfied: 0,
        allowed_surface_violations: [],
        forbidden_surface_violations: []
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Helper: build error lane summary
// ---------------------------------------------------------------------------

function buildErrorLaneSummary(engine, config, errorMessage) {
  return {
    lane_id: engine.id,
    display_name: engine.display_name ?? null,
    provider: engine.provider,
    cli: engine.cli ?? engine.provider,
    model: engine.model,
    reasoning: engine.reasoning ?? null,
    effort: engine.effort ?? null,
    isolation_mode: config.isolation?.mode ?? "none",
    working_directory: null,
    worktree_path: null,
    base_ref: config.isolation?.base_ref ?? null,
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
    lane_summary_path: null,
    cycles_path: null,
    git_status_path: null,
    diff_stat_path: null,
    diff_patch_path: null,
    changed_paths_path: null,
    changed_paths: [],
    verification_failures: [],
    latest_session_handle: null,
    resume_supported: false,
    phase_metrics: createEmptyPhaseMetrics(),
    artifact_quality: {
      score: 0,
      rating: "weak",
      rubric_version: "heuristic_v1",
      notes: ["Lane crashed: " + truncateText(errorMessage, 500)],
      signals: {
        verification_passed: false,
        changed_file_count: 0,
        required_paths_total: (config.artifact_policy?.required_paths ?? []).length,
        required_paths_present: 0,
        required_changed_prefixes_total: (config.artifact_policy?.required_changed_prefixes ?? []).length,
        required_changed_prefixes_satisfied: 0,
        allowed_surface_violations: [],
        forbidden_surface_violations: []
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Helper: build blocked lane summary
// ---------------------------------------------------------------------------

function buildBlockedLaneSummary(engine, config, laneRoot, laneSummaryPath, cyclesPath, errorMessage, workspacePreparationMs) {
  const phaseMetrics = createEmptyPhaseMetrics();
  phaseMetrics.workspace_preparation_ms = workspacePreparationMs;
  phaseMetrics.human_testing_skipped = config.execution_policy?.skip_human_testing ?? true;

  return {
    lane_id: engine.id,
    display_name: engine.display_name ?? null,
    provider: engine.provider,
    cli: engine.cli ?? engine.provider,
    model: engine.model,
    reasoning: engine.reasoning ?? null,
    effort: engine.effort ?? null,
    isolation_mode: config.isolation?.mode ?? "none",
    working_directory: null,
    worktree_path: null,
    base_ref: config.isolation?.base_ref ?? null,
    starting_head_sha: null,
    status: "blocked",
    cycle_wall_clock_ms: 0,
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
    lane_summary_path: normalizeSlashes(laneSummaryPath),
    cycles_path: normalizeSlashes(cyclesPath),
    git_status_path: null,
    diff_stat_path: null,
    diff_patch_path: null,
    changed_paths_path: null,
    changed_paths: [],
    verification_failures: [],
    latest_session_handle: null,
    resume_supported: false,
    phase_metrics: phaseMetrics,
    artifact_quality: {
      score: 0,
      rating: "weak",
      rubric_version: "heuristic_v1",
      notes: ["Lane could not prepare its isolated workspace: " + truncateText(errorMessage, 500)],
      signals: {
        verification_passed: false,
        changed_file_count: 0,
        required_paths_total: (config.artifact_policy?.required_paths ?? []).length,
        required_paths_present: 0,
        required_changed_prefixes_total: (config.artifact_policy?.required_changed_prefixes ?? []).length,
        required_changed_prefixes_satisfied: 0,
        allowed_surface_violations: [],
        forbidden_surface_violations: []
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Helper: summarize lane for CLI output
// ---------------------------------------------------------------------------

function summarizeLaneForOutput(lane) {
  return {
    lane_id: lane.lane_id,
    provider: lane.provider,
    model: lane.model,
    status: lane.status,
    review_cycle_count: lane.review_cycle_count,
    verification_status: lane.verification_status,
    estimated_cost_usd: lane.estimated_cost_usd,
    cycle_wall_clock_ms: lane.cycle_wall_clock_ms,
    artifact_quality_score: lane.artifact_quality?.score ?? null,
    artifact_quality_rating: lane.artifact_quality?.rating ?? null,
    error_message: lane.error_message,
    blocker_kind: lane.blocker_kind
  };
}
