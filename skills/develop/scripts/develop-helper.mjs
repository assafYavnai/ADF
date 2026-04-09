#!/usr/bin/env node

import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  gitRun,
  normalizeFeatureSlug,
  normalizeProjectRoot,
  parseArgs,
  parsePositiveInteger,
  pathExists,
  printJson,
  readJsonIfExists,
  readTextIfExists,
  requiredArg,
  resolveFeatureRoot,
  withLock,
  writeJsonAtomic
} from "../../governed-feature-runtime.mjs";
import { ensureSetup } from "./develop-setup-helper.mjs";
import { checkLaneConflict, validateIntegrity, validatePrerequisites } from "./develop-governor.mjs";

const SETTINGS_KEYS = new Set([
  "schema_version",
  "implementor_model",
  "implementor_effort",
  "auditor_model",
  "auditor_effort",
  "reviewer_model",
  "reviewer_effort",
  "max_review_cycles"
]);

const HUMAN_VERIFICATION_STATUSES = new Set(["pending", "approved", "rejected", "stale", "not_required"]);

function parseJsonInput(raw, label) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { error: label + " must be valid JSON: " + error.message };
  }
}

function stageFromState(committedState) {
  return committedState.active_run_status ?? committedState.feature_status ?? "unknown";
}

function latestEvent(committedState) {
  const events = committedState.event_log;
  if (!Array.isArray(events) || events.length === 0) {
    return null;
  }
  return events[events.length - 1].event_type ?? null;
}

function normalizeHumanVerificationStatus(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return HUMAN_VERIFICATION_STATUSES.has(normalized) ? normalized : null;
}

function humanVerificationInputRequired(committedState) {
  const humanStatus = normalizeHumanVerificationStatus(committedState?.human_verification_status ?? null);
  if (humanStatus === "pending") {
    return true;
  }
  return humanStatus === null
    && String(committedState?.active_run_status ?? "").toLowerCase() === "human_verification_pending";
}

function nextHumanVerificationTransition(committedState) {
  const humanStatus = normalizeHumanVerificationStatus(committedState?.human_verification_status ?? null);
  if (humanStatus === null || humanStatus === "pending") {
    return "human_testing";
  }
  if (humanStatus === "approved" || humanStatus === "not_required") {
    return "merge_queue";
  }
  if (humanStatus === "rejected" || humanStatus === "stale") {
    return "implementation";
  }
  return "unknown";
}

function nextTransition(committedState) {
  const status = String(committedState.active_run_status ?? "").toLowerCase();
  switch (status) {
    case "context_ready":
      return "implementation";
    case "implementation_running":
      return "machine_verification";
    case "human_verification_pending":
      return nextHumanVerificationTransition(committedState);
    case "verification_pending":
      return "review_cycle";
    case "review_pending":
      return "human_verification";
    case "merge_ready":
    case "merge_queued":
    case "merge_in_progress":
      return "merge_completion";
    case "closeout_pending":
      return "completion_reconciliation";
    case "completed":
      return "none";
    default:
      return "unknown";
  }
}

function summaryToCommittedResult({ phaseNumber, featureSlug }) {
  return {
    slice_identity: { phase_number: phaseNumber, feature_slug: featureSlug },
    current_stage: "completed",
    current_status: "completed",
    current_blocker: null,
    latest_durable_event: "completion_summary_written",
    latest_review_verdicts: null,
    human_input_required: false,
    next_expected_transition: "none",
    merge_truth: null
  };
}

async function laneSummaries(projectRoot, featureSlug = null, phaseNumber = null) {
  const lanesRoot = join(projectRoot, ".codex", "develop", "lanes");
  if (!(await pathExists(lanesRoot))) {
    return [];
  }
  const entries = await readdir(lanesRoot, { withFileTypes: true });
  const lanes = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const laneStatePath = join(lanesRoot, entry.name, "lane-state.json");
    const laneState = await readJsonIfExists(laneStatePath, null);
    if (!laneState) continue;
    if (featureSlug && laneState.feature_slug !== featureSlug) continue;
    if (phaseNumber !== null) {
      const lanePhase = Number(laneState.phase_number);
      if (!Number.isInteger(lanePhase) || lanePhase !== phaseNumber) continue;
    }
    lanes.push({
      lane_id: entry.name,
      feature_slug: laneState.feature_slug ?? null,
      phase_number: laneState.phase_number ?? null,
      status: laneState.status ?? "unknown"
    });
  }
  return lanes;
}

async function ensureSettings(projectRoot) {
  const { setup } = await ensureSetup({ projectRoot });
  const settingsPath = join(projectRoot, ".codex", "develop", "settings.json");
  const existing = await readJsonIfExists(settingsPath, null);
  if (existing && existing.schema_version === 1) {
    return {
      settingsPath,
      settings: existing,
      setup
    };
  }
  const settings = {
    schema_version: 1,
    ...setup.defaults
  };
  await writeJsonAtomic(settingsPath, settings);
  return {
    settingsPath,
    settings,
    setup
  };
}

async function appendSettingsHistory(projectRoot, previousValue, nextValue, source) {
  const historyPath = join(projectRoot, ".codex", "develop", "settings-history.json");
  const existing = await readJsonIfExists(historyPath, []);
  const history = Array.isArray(existing) ? existing : [];
  history.push({
    timestamp: new Date().toISOString(),
    previous_value: previousValue,
    new_value: nextValue,
    source
  });
  await writeJsonAtomic(historyPath, history);
}

function validateSettingsPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "settings payload must be a JSON object.";
  }
  const unknownKeys = Object.keys(payload).filter((key) => !SETTINGS_KEYS.has(key));
  if (unknownKeys.length > 0) {
    return "unknown settings keys: " + unknownKeys.join(", ");
  }
  if ("schema_version" in payload && payload.schema_version !== 1) {
    return "schema_version must be 1.";
  }
  if ("implementor_model" in payload && typeof payload.implementor_model !== "string") {
    return "implementor_model must be a string.";
  }
  if ("implementor_effort" in payload && typeof payload.implementor_effort !== "string") {
    return "implementor_effort must be a string.";
  }
  if ("auditor_model" in payload && typeof payload.auditor_model !== "string") {
    return "auditor_model must be a string.";
  }
  if ("auditor_effort" in payload && typeof payload.auditor_effort !== "string") {
    return "auditor_effort must be a string.";
  }
  if ("reviewer_model" in payload && typeof payload.reviewer_model !== "string") {
    return "reviewer_model must be a string.";
  }
  if ("reviewer_effort" in payload && typeof payload.reviewer_effort !== "string") {
    return "reviewer_effort must be a string.";
  }
  if ("max_review_cycles" in payload) {
    if (!Number.isInteger(payload.max_review_cycles)) {
      return "max_review_cycles must be a positive integer.";
    }
    const value = payload.max_review_cycles;
    if (!Number.isInteger(value) || value < 1) {
      return "max_review_cycles must be a positive integer.";
    }
  }
  return null;
}

function humanStatus(result) {
  if (result.current_status === "no_known_state") {
    return "no known state for this slice.";
  }
  return [
    "Slice: " + result.slice_identity.feature_slug,
    "Stage: " + result.current_stage,
    "Status: " + result.current_status,
    "Blocker: " + (result.current_blocker ?? "none"),
    "Latest Event: " + (result.latest_durable_event ?? "none"),
    "Human Input Required: " + String(result.human_input_required),
    "Next Transition: " + (result.next_expected_transition ?? "unknown")
  ].join("\n");
}

async function mergeTruth(projectRoot, commitSha) {
  if (!commitSha) {
    return null;
  }
  return {
    commit_sha: commitSha,
    on_main: gitRun(projectRoot, ["merge-base", "--is-ancestor", commitSha, "main"]).status === 0,
    on_origin_main: gitRun(projectRoot, ["merge-base", "--is-ancestor", commitSha, "origin/main"]).status === 0
  };
}

async function handleHelp(projectRoot) {
  const guide = (await readTextIfExists(join(projectRoot, "skills", "develop", "references", "invoker-guide.md"))).trim();
  const lanes = await laneSummaries(projectRoot);
  const laneLines = lanes.length === 0
    ? ["Current Lane Statuses:", "- None."]
    : ["Current Lane Statuses:", ...lanes.map((lane) => "- " + lane.lane_id + ": " + lane.status)];
  process.stdout.write(guide + "\n\n" + laneLines.join("\n") + "\n");
}

async function handleSettings(projectRoot, rawPayload) {
  const lockRoot = join(projectRoot, ".codex", "develop", "locks");
  await mkdir(lockRoot, { recursive: true });

  await withLock(lockRoot, "develop-settings", async () => {
    const { settingsPath, settings } = await ensureSettings(projectRoot);
    if (!rawPayload) {
      printJson({
        command: "settings",
        status: "ok",
        settings_path: settingsPath.replace(/\\/g, "/"),
        settings
      });
      return;
    }

    const parsed = parseJsonInput(rawPayload, "settings");
    if (parsed.error) {
      printJson({ command: "settings", status: "error", error: parsed.error });
      return;
    }
    const validationError = validateSettingsPayload(parsed);
    if (validationError) {
      printJson({ command: "settings", status: "error", error: validationError });
      return;
    }

    const nextSettings = {
      ...settings,
      ...parsed,
      schema_version: 1
    };
    await writeJsonAtomic(settingsPath, nextSettings);
    await appendSettingsHistory(projectRoot, settings, nextSettings, "develop settings");
    printJson({
      command: "settings",
      status: "ok",
      settings_path: settingsPath.replace(/\\/g, "/"),
      settings: nextSettings
    });
  });
}

async function handleStatus(projectRoot, args) {
  const phaseNumber = parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number");
  const featureSlug = normalizeFeatureSlug(requiredArg(args, "feature-slug"));
  const featureRoot = resolveFeatureRoot(projectRoot, phaseNumber, featureSlug);
  const committedStatePath = join(featureRoot, "implement-plan-state.json");
  const reviewStatePath = join(featureRoot, "review-cycle-state.json");
  const receiptPath = join(featureRoot, "closeout-receipt.v1.json");
  const completionSummaryPath = join(featureRoot, "completion-summary.md");

  const committedState = await readJsonIfExists(committedStatePath, null);
  const reviewState = await readJsonIfExists(reviewStatePath, null);
  const receipt = await readJsonIfExists(receiptPath, null);
  const summaryExists = await pathExists(completionSummaryPath);
  const lanes = await laneSummaries(projectRoot, featureSlug, phaseNumber);
  const truthSources = {
    consulted: [
      committedState ? committedStatePath.replace(/\\/g, "/") : null,
      reviewState ? reviewStatePath.replace(/\\/g, "/") : null,
      receipt ? receiptPath.replace(/\\/g, "/") : null,
      summaryExists ? completionSummaryPath.replace(/\\/g, "/") : null,
      lanes.length > 0 ? ".codex/develop/lanes/*/lane-state.json" : null
    ].filter(Boolean),
    authoritative: {}
  };

  let result;
  if (committedState) {
    result = {
      slice_identity: { phase_number: phaseNumber, feature_slug: featureSlug },
      current_stage: stageFromState(committedState),
      current_status: committedState.feature_status ?? committedState.active_run_status ?? "unknown",
      current_blocker: committedState.last_error ?? null,
      latest_durable_event: latestEvent(committedState),
      latest_review_verdicts: reviewState?.cycle_runtime?.lane_verdicts ?? null,
      human_input_required: humanVerificationInputRequired(committedState),
      next_expected_transition: nextTransition(committedState),
      merge_truth: await mergeTruth(
        projectRoot,
        committedState.approved_commit_sha ?? committedState.last_commit_sha ?? receipt?.approved_feature_commit_sha ?? null
      ),
      truth_sources: truthSources
    };
    truthSources.authoritative = {
      stage: committedStatePath.replace(/\\/g, "/"),
      status: committedStatePath.replace(/\\/g, "/"),
      blocker: committedStatePath.replace(/\\/g, "/"),
      review_verdicts: reviewState ? reviewStatePath.replace(/\\/g, "/") : committedStatePath.replace(/\\/g, "/")
    };
  } else if (summaryExists) {
    result = {
      ...summaryToCommittedResult({ phaseNumber, featureSlug }),
      slice_identity: { phase_number: phaseNumber, feature_slug: featureSlug },
      truth_sources: truthSources
    };
    truthSources.authoritative = {
      stage: completionSummaryPath.replace(/\\/g, "/"),
      status: completionSummaryPath.replace(/\\/g, "/")
    };
  } else if (receipt) {
    result = {
      slice_identity: { phase_number: phaseNumber, feature_slug: featureSlug },
      current_stage: "receipt_recorded",
      current_status: receipt.status ?? "receipt_only",
      current_blocker: null,
      latest_durable_event: "receipt_recorded",
      latest_review_verdicts: null,
      human_input_required: false,
      next_expected_transition: "merge_completion",
      merge_truth: await mergeTruth(projectRoot, receipt.approved_feature_commit_sha ?? null),
      truth_sources: truthSources
    };
    truthSources.authoritative = {
      stage: receiptPath.replace(/\\/g, "/"),
      status: receiptPath.replace(/\\/g, "/")
    };
  } else if (lanes.length > 0) {
    result = {
      slice_identity: { phase_number: phaseNumber, feature_slug: featureSlug },
      current_stage: "projection_only",
      current_status: lanes[0].status,
      current_blocker: null,
      latest_durable_event: null,
      latest_review_verdicts: null,
      human_input_required: false,
      next_expected_transition: "committed_artifacts",
      merge_truth: null,
      truth_sources: truthSources
    };
    truthSources.authoritative = {
      status: ".codex/develop/lanes/*/lane-state.json"
    };
  } else {
    result = {
      slice_identity: { phase_number: phaseNumber, feature_slug: featureSlug },
      current_stage: "unknown",
      current_status: "no_known_state",
      current_blocker: null,
      latest_durable_event: null,
      latest_review_verdicts: null,
      human_input_required: false,
      next_expected_transition: "create_feature_artifacts",
      merge_truth: null,
      truth_sources: truthSources
    };
  }

  result.human_output = humanStatus(result);
  printJson(result);
}

async function handleGuarded(projectRoot, args, commandName) {
  const phaseNumber = parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number");
  const featureSlug = normalizeFeatureSlug(requiredArg(args, "feature-slug"));
  const validation = await validatePrerequisites({ projectRoot, phaseNumber, featureSlug });
  if (validation.status !== "pass") {
    printJson({
      command: commandName,
      status: "fail",
      prerequisite_validation: validation
    });
    return;
  }
  printJson({
    command: commandName,
    status: "not_yet_available",
    phase_number: phaseNumber,
    feature_slug: featureSlug,
    prerequisite_validation: validation,
    validation_attempted: true,
    message: commandName === "implement"
      ? "implement orchestration not yet available -- arrives in Slice B."
      : "fix path not yet available -- arrives in Slice C."
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0] ?? "help";
  const projectRoot = normalizeProjectRoot(args.values["project-root"] ?? process.cwd());
  await ensureSetup({ projectRoot });

  if (command === "help") {
    await handleHelp(projectRoot);
    return;
  }
  if (command === "settings") {
    await handleSettings(projectRoot, args.positionals[1] ?? null);
    return;
  }
  if (command === "status") {
    await handleStatus(projectRoot, args);
    return;
  }
  if (command === "implement" || command === "fix") {
    await handleGuarded(projectRoot, args, command);
    return;
  }
  if (command === "validate-prerequisites") {
    printJson(await validatePrerequisites({
      projectRoot,
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug"))
    }));
    return;
  }
  if (command === "validate-integrity") {
    printJson(await validateIntegrity({
      projectRoot,
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug"))
    }));
    return;
  }
  if (command === "check-lane-conflict") {
    printJson(await checkLaneConflict({
      projectRoot,
      phaseNumber: parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number"),
      featureSlug: normalizeFeatureSlug(requiredArg(args, "feature-slug"))
    }));
    return;
  }

  await handleHelp(projectRoot);
}

await main();
