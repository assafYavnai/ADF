#!/usr/bin/env node

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

const REQUIRED_ARTIFACTS = [
  "audit-findings.md",
  "review-findings.md",
  "fix-plan.md",
  "fix-report.md",
];

const REQUIRED_SETUP_FIELDS = [
  "preferred_execution_access_mode",
  "preferred_auditor_access_mode",
  "preferred_reviewer_access_mode",
  "preferred_implementor_access_mode",
  "fallback_execution_access_mode",
  "runtime_permission_model",
  "execution_access_notes",
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0];
  if (!command) {
    fail("Missing command. Use 'prepare' or 'update-state'.");
  }

  if (command === "prepare") {
    const phaseNumber = parsePhaseNumber(requiredArg(args, "phase-number"));
    const featureSlug = requiredArg(args, "feature-slug");
    const taskSummary = requiredArg(args, "task-summary");
    const repoRoot = normalizeRepoRoot(args.values["repo-root"] ?? "C:/ADF");
    const scopeHint = args.values["scope-hint"] ?? null;
    const nonGoals = args.values["non-goals"] ?? null;
    const auditorModel = args.values["auditor-model"] ?? null;
    const reviewerModel = args.values["reviewer-model"] ?? null;
    const auditorReasoningEffort = args.values["auditor-reasoning-effort"] ?? null;
    const reviewerReasoningEffort = args.values["reviewer-reasoning-effort"] ?? null;
    const currentBranch = args.values["current-branch"] ?? null;

    const result = await prepareCycle({
      phaseNumber,
      featureSlug,
      taskSummary,
      repoRoot,
      scopeHint,
      nonGoals,
      auditorModel,
      reviewerModel,
      auditorReasoningEffort,
      reviewerReasoningEffort,
      currentBranch,
    });
    printJson(result);
    return;
  }

  if (command === "update-state") {
    const phaseNumber = parsePhaseNumber(requiredArg(args, "phase-number"));
    const featureSlug = requiredArg(args, "feature-slug");
    const repoRoot = normalizeRepoRoot(args.values["repo-root"] ?? "C:/ADF");
    const capabilityPairs = args.multi["capability"] ?? [];

    const result = await updateState({
      phaseNumber,
      featureSlug,
      repoRoot,
      auditorExecutionId: args.values["auditor-execution-id"],
      reviewerExecutionId: args.values["reviewer-execution-id"],
      implementorExecutionId: args.values["implementor-execution-id"],
      auditorExecutionAccessMode: args.values["auditor-execution-access-mode"],
      reviewerExecutionAccessMode: args.values["reviewer-execution-access-mode"],
      implementorExecutionAccessMode: args.values["implementor-execution-access-mode"],
      auditorModel: args.values["auditor-model"],
      reviewerModel: args.values["reviewer-model"],
      auditorReasoningEffort: args.values["auditor-reasoning-effort"],
      reviewerReasoningEffort: args.values["reviewer-reasoning-effort"],
      resolvedRuntimePermissionModel: args.values["resolved-runtime-permission-model"],
      accessModeResolutionNotes: args.values["access-mode-resolution-notes"],
      currentBranch: args.values["current-branch"],
      lastCompletedCycle: args.values["last-completed-cycle"],
      lastCommitSha: args.values["last-commit-sha"],
      capabilityPairs,
    });
    printJson(result);
    return;
  }

  fail(`Unknown command '${command}'. Use 'prepare' or 'update-state'.`);
}

async function prepareCycle(input) {
  const featureRoot = resolveFeatureRoot(input.repoRoot, input.phaseNumber, input.featureSlug);
  await mkdir(featureRoot, { recursive: true });

  const readmePath = join(featureRoot, "README.md");
  const contextPath = join(featureRoot, "context.md");
  const statePath = join(featureRoot, "review-cycle-state.json");
  const setupInfo = await loadSetup(input.repoRoot);

  const readmeCreated = await ensureReadme({
    readmePath,
    repoRoot: input.repoRoot,
    phaseNumber: input.phaseNumber,
    featureSlug: input.featureSlug,
    taskSummary: input.taskSummary,
    scopeHint: input.scopeHint,
    nonGoals: input.nonGoals,
  });

  const inferredStreamState = await inferExistingStreamState(input.repoRoot, featureRoot);

  const stateLoad = await loadOrInitializeState({
    statePath,
    phaseNumber: input.phaseNumber,
    featureSlug: input.featureSlug,
    repoRoot: input.repoRoot,
    auditorModel: input.auditorModel,
    reviewerModel: input.reviewerModel,
    auditorReasoningEffort: input.auditorReasoningEffort,
    reviewerReasoningEffort: input.reviewerReasoningEffort,
    currentBranch: input.currentBranch,
    inferredLastCompletedCycle: inferredStreamState.lastCompletedCycle,
    inferredLastCommitSha: inferredStreamState.lastCommitSha,
  });

  const cycleStatus = await selectCycle(featureRoot, safeNumber(stateLoad.state.last_completed_cycle, 0));
  if (cycleStatus.mode === "new") {
    await mkdir(cycleStatus.cycleDir, { recursive: true });
  }

  const activeArtifacts = await inspectCycleArtifacts(cycleStatus.cycleDir);
  const priorCycleNumber = cycleStatus.cycleNumber > 1 ? cycleStatus.cycleNumber - 1 : null;
  const priorCycleDir = priorCycleNumber ? join(featureRoot, formatCycleName(priorCycleNumber)) : null;
  const priorArtifacts = priorCycleDir ? await inspectCycleArtifacts(priorCycleDir) : null;
  const requiredAccessModes = resolveRequiredAccessModes(setupInfo.data);
  const recreateDueToWeakAccess = {
    auditor: shouldRecreateExecution(
      stateLoad.state.auditor_execution_id,
      stateLoad.state.auditor_execution_access_mode,
      requiredAccessModes.auditor,
    ),
    reviewer: shouldRecreateExecution(
      stateLoad.state.reviewer_execution_id,
      stateLoad.state.reviewer_execution_access_mode,
      requiredAccessModes.reviewer,
    ),
    implementor: shouldRecreateExecution(
      stateLoad.state.implementor_execution_id,
      stateLoad.state.implementor_execution_access_mode,
      requiredAccessModes.implementor,
    ),
  };

  const fixReportExists = activeArtifacts.required_artifacts["fix-report.md"].exists;
  const currentCycleState = describeCycleState(
    cycleStatus.cycleNumber,
    activeArtifacts,
    safeNumber(stateLoad.state.last_completed_cycle, 0),
  );
  const commitPushPending =
    fixReportExists && safeNumber(stateLoad.state.last_completed_cycle, 0) < cycleStatus.cycleNumber;
  const setupStatus = setupInfo.complete ? "ready" : setupInfo.exists ? "incomplete" : "missing";
  const nextAction = determineNextAction({
    setupStatus,
    recreateDueToWeakAccess,
    commitPushPending,
    currentCycleState,
  });

  return {
    repo_root: normalizeSlashes(input.repoRoot),
    setup_path: normalizeSlashes(setupInfo.path),
    setup_exists: setupInfo.exists,
    setup_complete: setupInfo.complete,
    auto_invoke_setup_required: !setupInfo.complete,
    feature_root: normalizeSlashes(featureRoot),
    readme_path: normalizeSlashes(readmePath),
    context_path: normalizeSlashes(contextPath),
    state_path: normalizeSlashes(statePath),
    readme_created: readmeCreated,
    state_created: stateLoad.created,
    needs_context_creation: !(await pathExists(contextPath)),
    latest_cycle_number: cycleStatus.latestCycleNumber,
    last_completed_cycle: safeNumber(stateLoad.state.last_completed_cycle, 0),
    current_branch: stateLoad.state.current_branch ?? input.currentBranch ?? null,
    cycle: {
      number: cycleStatus.cycleNumber,
      name: cycleStatus.cycleName,
      dir: normalizeSlashes(cycleStatus.cycleDir),
      mode: cycleStatus.mode,
      current_cycle_state: currentCycleState,
      fix_report_exists: fixReportExists,
      commit_push_pending: commitPushPending,
      artifact_status: activeArtifacts,
    },
    prior_cycle: priorCycleDir
      ? {
          number: priorCycleNumber,
          name: formatCycleName(priorCycleNumber),
          dir: normalizeSlashes(priorCycleDir),
          artifact_status: priorArtifacts,
        }
      : null,
    reviewer_state: {
      auditor_execution_id: stateLoad.state.auditor_execution_id ?? null,
      reviewer_execution_id: stateLoad.state.reviewer_execution_id ?? null,
      implementor_execution_id: stateLoad.state.implementor_execution_id ?? null,
      auditor_execution_access_mode: stateLoad.state.auditor_execution_access_mode ?? null,
      reviewer_execution_access_mode: stateLoad.state.reviewer_execution_access_mode ?? null,
      implementor_execution_access_mode: stateLoad.state.implementor_execution_access_mode ?? null,
      resolved_runtime_permission_model:
        stateLoad.state.resolved_runtime_permission_model ?? setupInfo.data.runtime_permission_model ?? null,
      access_mode_resolution_notes:
        stateLoad.state.access_mode_resolution_notes ?? setupInfo.data.execution_access_notes ?? null,
      resolved_runtime_capabilities: stateLoad.state.resolved_runtime_capabilities ?? {},
      auditor_model: stateLoad.state.auditor_model ?? null,
      reviewer_model: stateLoad.state.reviewer_model ?? null,
      auditor_reasoning_effort: stateLoad.state.auditor_reasoning_effort ?? null,
      reviewer_reasoning_effort: stateLoad.state.reviewer_reasoning_effort ?? null,
    },    setup_guidance: {
      preferred_execution_access_mode: setupInfo.data.preferred_execution_access_mode ?? null,
      preferred_auditor_access_mode: requiredAccessModes.auditor,
      preferred_reviewer_access_mode: requiredAccessModes.reviewer,
      preferred_implementor_access_mode: requiredAccessModes.implementor,
      fallback_execution_access_mode: setupInfo.data.fallback_execution_access_mode ?? null,
      runtime_permission_model: setupInfo.data.runtime_permission_model ?? null,
      execution_access_notes: setupInfo.data.execution_access_notes ?? null,
    },
    recreate_due_to_weaker_access: recreateDueToWeakAccess,
    detected_status_summary: {
      detected_project_root: normalizeSlashes(input.repoRoot),
      detected_artifact_root: normalizeSlashes(featureRoot),
      latest_cycle_number: cycleStatus.latestCycleNumber,
      current_cycle_state: currentCycleState,
      fix_report_exists: fixReportExists,
      commit_push_pending: commitPushPending,
      execution_access_modes: requiredAccessModes,
      recreated_due_to_weaker_access: recreateDueToWeakAccess,
      next_action: nextAction,
    },
  };
}

async function updateState(input) {
  const featureRoot = resolveFeatureRoot(input.repoRoot, input.phaseNumber, input.featureSlug);
  const statePath = join(featureRoot, "review-cycle-state.json");
  const existing = await loadOrInitializeState({
    statePath,
    phaseNumber: input.phaseNumber,
    featureSlug: input.featureSlug,
    repoRoot: input.repoRoot,
    auditorModel: null,
    reviewerModel: null,
    auditorReasoningEffort: null,
    reviewerReasoningEffort: null,
    currentBranch: null,
  });

  const next = { ...existing.state };

  if (input.auditorExecutionId !== undefined) next.auditor_execution_id = input.auditorExecutionId || null;
  if (input.reviewerExecutionId !== undefined) next.reviewer_execution_id = input.reviewerExecutionId || null;
  if (input.implementorExecutionId !== undefined) next.implementor_execution_id = input.implementorExecutionId || null;
  if (input.auditorExecutionAccessMode !== undefined) next.auditor_execution_access_mode = input.auditorExecutionAccessMode || null;
  if (input.reviewerExecutionAccessMode !== undefined) next.reviewer_execution_access_mode = input.reviewerExecutionAccessMode || null;
  if (input.implementorExecutionAccessMode !== undefined) next.implementor_execution_access_mode = input.implementorExecutionAccessMode || null;
  if (input.auditorModel !== undefined) next.auditor_model = input.auditorModel || null;
  if (input.reviewerModel !== undefined) next.reviewer_model = input.reviewerModel || null;
  if (input.auditorReasoningEffort !== undefined) next.auditor_reasoning_effort = input.auditorReasoningEffort || null;
  if (input.reviewerReasoningEffort !== undefined) next.reviewer_reasoning_effort = input.reviewerReasoningEffort || null;
  if (input.resolvedRuntimePermissionModel !== undefined) next.resolved_runtime_permission_model = input.resolvedRuntimePermissionModel || null;
  if (input.accessModeResolutionNotes !== undefined) next.access_mode_resolution_notes = input.accessModeResolutionNotes || null;
  if (input.currentBranch !== undefined) next.current_branch = input.currentBranch || null;
  if (input.lastCommitSha !== undefined) next.last_commit_sha = input.lastCommitSha || null;
  if (input.lastCompletedCycle !== undefined) next.last_completed_cycle = parsePhaseNumber(input.lastCompletedCycle);

  const capabilityPatch = parseCapabilityPairs(input.capabilityPairs);
  next.resolved_runtime_capabilities = {
    ...(next.resolved_runtime_capabilities ?? {}),
    ...capabilityPatch,
  };
  next.updated_at = nowIso();

  await writeJson(statePath, next);
  return {
    state_path: normalizeSlashes(statePath),
    state: next,
  };
}

async function ensureReadme(input) {
  if (await pathExists(input.readmePath)) return false;
  const lines = [
    `# ${input.featureSlug}`,
    "",
    "## Feature Goal",
    "",
    input.taskSummary.trim(),
    "",
    "## Requested Scope",
    "",
    input.scopeHint?.trim() || "Use the task summary and current repo state to keep the fix route-level and tight.",
    "",
    "## Non-Goals",
    "",
    input.nonGoals?.trim() || "- None recorded yet.",
    "",
    "## Artifact Map",
    "",
    "- `context.md`",
    "- `review-cycle-state.json`",
    "- `cycle-XX/audit-findings.md`",
    "- `cycle-XX/review-findings.md`",
    "- `cycle-XX/fix-plan.md`",
    "- `cycle-XX/fix-report.md`",
    "- `<repo_root>/.codex/review-cycle/setup.json`",
    "",
    "## Cycle Rules",
    "",
    "- One invocation = one full audit/review/fix/report cycle.",
    "- Do not auto-start the next cycle in the same run.",
    "- A fix report from cycle N becomes reviewer input only in cycle N+1.",
    "- Reuse incomplete or pending-closeout cycle artifacts when resuming.",
    "",
    "## Commit Rules",
    "",
    "- Commit code changes, cycle artifacts, related docs, and changed setup artifacts together.",
    "- Push to origin after the cycle closes.",
    "- If commit or push fails, preserve artifacts and report the exact git failure.",
    "",
  ];
  await writeText(input.readmePath, `${lines.join("\n")}\n`);
  return true;
}

async function loadOrInitializeState(input) {
  const defaults = defaultState(input);
  if (!(await pathExists(input.statePath))) {
    await writeJson(input.statePath, defaults);
    return { created: true, state: defaults };
  }

  const existing = await readJson(input.statePath);
  const merged = {
    ...defaults,
    ...existing,
    resolved_runtime_capabilities: {
      ...(defaults.resolved_runtime_capabilities ?? {}),
      ...(existing.resolved_runtime_capabilities ?? {}),
    },
    created_at: existing.created_at ?? defaults.created_at,
    updated_at: existing.updated_at ?? defaults.updated_at,
  };

  if (safeNumber(existing.last_completed_cycle, 0) === 0 && safeNumber(input.inferredLastCompletedCycle, 0) > 0) {
    merged.last_completed_cycle = input.inferredLastCompletedCycle;
  }

  if (!existing.last_commit_sha && input.inferredLastCommitSha) {
    merged.last_commit_sha = input.inferredLastCommitSha;
  }

  if (JSON.stringify(existing) !== JSON.stringify(merged)) {
    merged.updated_at = nowIso();
    await writeJson(input.statePath, merged);
  }

  return { created: false, state: merged };
}

function defaultState(input) {
  return {
    phase_number: input.phaseNumber,
    feature_slug: input.featureSlug,
    repo_root: normalizeSlashes(input.repoRoot),
    auditor_execution_id: null,
    reviewer_execution_id: null,
    implementor_execution_id: null,
    auditor_execution_access_mode: null,
    reviewer_execution_access_mode: null,
    implementor_execution_access_mode: null,
    auditor_model: input.auditorModel ?? null,
    reviewer_model: input.reviewerModel ?? null,
    auditor_reasoning_effort: input.auditorReasoningEffort ?? null,
    reviewer_reasoning_effort: input.reviewerReasoningEffort ?? null,
    resolved_runtime_permission_model: null,
    access_mode_resolution_notes: null,
    resolved_runtime_capabilities: {},
    current_branch: input.currentBranch ?? null,
    last_completed_cycle: safeNumber(input.inferredLastCompletedCycle, 0),
    last_commit_sha: input.inferredLastCommitSha ?? null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

async function loadSetup(repoRoot) {
  const setupPath = resolve(repoRoot, ".codex", "review-cycle", "setup.json");
  if (!(await pathExists(setupPath))) {
    return { path: setupPath, exists: false, complete: false, data: {} };
  }

  const data = await readJson(setupPath);
  const complete = REQUIRED_SETUP_FIELDS.every((key) => isFilled(data[key]));
  return { path: setupPath, exists: true, complete, data };
}

async function selectCycle(featureRoot, lastCompletedCycle) {
  const entries = await safeReaddir(featureRoot);
  const cycles = entries
    .map((entry) => {
      const match = /^cycle-(\d+)$/.exec(entry.name);
      if (!match || !entry.isDirectory()) return null;
      return { number: Number(match[1]), name: entry.name, dir: join(featureRoot, entry.name) };
    })
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);

  const latestCycleNumber = cycles.length > 0 ? cycles[cycles.length - 1].number : 0;
  const expectedOpenCycle = cycles.find((cycle) => cycle.number === lastCompletedCycle + 1);
  if (expectedOpenCycle) {
    const status = await inspectCycleArtifacts(expectedOpenCycle.dir);
    return {
      latestCycleNumber,
      mode: status.complete ? "resume_pending_closeout" : "resume",
      cycleNumber: expectedOpenCycle.number,
      cycleName: expectedOpenCycle.name,
      cycleDir: expectedOpenCycle.dir,
    };
  }

  for (const cycle of cycles) {
    const status = await inspectCycleArtifacts(cycle.dir);
    if (!status.complete) {
      return {
        latestCycleNumber,
        mode: "resume",
        cycleNumber: cycle.number,
        cycleName: cycle.name,
        cycleDir: cycle.dir,
      };
    }
  }

  const nextNumber = latestCycleNumber > 0 ? latestCycleNumber + 1 : 1;
  return {
    latestCycleNumber,
    mode: "new",
    cycleNumber: nextNumber,
    cycleName: formatCycleName(nextNumber),
    cycleDir: join(featureRoot, formatCycleName(nextNumber)),
  };
}

async function inferExistingStreamState(repoRoot, featureRoot) {
  const entries = await safeReaddir(featureRoot);
  const cycles = entries
    .map((entry) => {
      const match = /^cycle-(\d+)$/.exec(entry.name);
      if (!match || !entry.isDirectory()) return null;
      return { number: Number(match[1]), dir: join(featureRoot, entry.name) };
    })
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);

  let lastCompletedCycle = 0;
  let lastCommitSha = null;

  for (const cycle of cycles) {
    const status = await inspectCycleArtifacts(cycle.dir);
    if (!status.complete) {
      continue;
    }

    const allTrackedAndClean = Object.values(status.required_artifacts).every((artifact) =>
      isGitTrackedAndClean(repoRoot, artifact.path)
    );
    if (!allTrackedAndClean) {
      continue;
    }

    lastCompletedCycle = cycle.number;
    const cycleCommit = gitOutput(repoRoot, ["log", "-1", "--format=%H", "--", normalizeGitPath(cycle.dir)]);
    if (cycleCommit) {
      lastCommitSha = cycleCommit;
    }
  }

  return { lastCompletedCycle, lastCommitSha };
}

async function inspectCycleArtifacts(cycleDir) {
  const artifacts = {};
  let complete = true;
  for (const name of REQUIRED_ARTIFACTS) {
    const filePath = join(cycleDir, name);
    const exists = await pathExists(filePath);
    artifacts[name] = { path: normalizeSlashes(filePath), exists };
    if (!exists) complete = false;
  }
  return { complete, required_artifacts: artifacts };
}

function describeCycleState(cycleNumber, artifacts, lastCompletedCycle) {
  const fixReportExists = artifacts.required_artifacts["fix-report.md"].exists;
  const fixPlanExists = artifacts.required_artifacts["fix-plan.md"].exists;
  const auditExists = artifacts.required_artifacts["audit-findings.md"].exists;
  const reviewExists = artifacts.required_artifacts["review-findings.md"].exists;
  if (fixReportExists && lastCompletedCycle >= cycleNumber) return "completed";
  if (fixReportExists) return "fix_report_complete_commit_push_pending";
  if (fixPlanExists) return "fix_planned_or_implementation_in_progress";
  if (auditExists && reviewExists) return "findings_ready_for_fix_planning";
  if (auditExists || reviewExists) return "review_in_progress";
  return "review_not_started";
}

function resolveRequiredAccessModes(setupData) {
  const fallback = setupData.fallback_execution_access_mode ?? "interactive_fallback";
  return {
    auditor: setupData.preferred_auditor_access_mode ?? setupData.preferred_execution_access_mode ?? fallback,
    reviewer: setupData.preferred_reviewer_access_mode ?? setupData.preferred_execution_access_mode ?? fallback,
    implementor: setupData.preferred_implementor_access_mode ?? setupData.preferred_execution_access_mode ?? fallback,
  };
}

function shouldRecreateExecution(executionId, existingMode, requiredMode) {
  if (!executionId || !requiredMode) return false;
  if (!existingMode) return true;
  return rankAccessMode(existingMode) < rankAccessMode(requiredMode);
}

function rankAccessMode(mode) {
  const normalized = String(mode ?? "").toLowerCase();
  if (/(full_auto|dangerously-bypass|full-access|elevated|approval_never|never_prompt)/.test(normalized)) return 5;
  if (/(project_rules|inherits_current_runtime_access|inherits_runtime_access|workspace-write)/.test(normalized)) return 4;
  if (/(auto_edit|approval_auto|yolo)/.test(normalized)) return 3;
  if (/(interactive|prompt|manual)/.test(normalized)) return 1;
  return 0;
}

function determineNextAction(input) {
  if (input.setupStatus !== "ready") return "auto_invoke_review_cycle_setup";
  if (input.commitPushPending) return "finish_verification_and_git_closeout";
  if (Object.values(input.recreateDueToWeakAccess).some(Boolean)) return "recreate_execution_with_stronger_access_and_resume";
  if (input.currentCycleState === "findings_ready_for_fix_planning") return "synthesize_fix_plan_and_run_implementor";
  if (input.currentCycleState === "fix_planned_or_implementation_in_progress") return "finish_implementation_verification_and_fix_report";
  if (input.currentCycleState === "review_in_progress") return "complete_or_resume_review";
  return "send_cycle_request_to_auditor_and_reviewer";
}

function resolveFeatureRoot(repoRoot, phaseNumber, featureSlug) {
  return resolve(repoRoot, "docs", `phase${phaseNumber}`, featureSlug);
}

function formatCycleName(number) {
  return `cycle-${String(number).padStart(2, "0")}`;
}
function parseArgs(argv) {
  const values = {};
  const multi = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      values[key] = "true";
      continue;
    }
    if (key === "capability") {
      multi[key] ??= [];
      multi[key].push(next);
    } else {
      values[key] = next;
    }
    index += 1;
  }
  return { positionals, values, multi };
}

function requiredArg(args, key) {
  const value = args.values[key];
  if (!value) fail(`Missing required argument --${key}.`);
  return value;
}

function parsePhaseNumber(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) fail(`Expected a non-negative integer, got '${value}'.`);
  return parsed;
}

function parseCapabilityPairs(pairs) {
  const result = {};
  for (const item of pairs) {
    const separator = item.indexOf("=");
    if (separator <= 0) fail(`Capability '${item}' must use key=value form.`);
    const key = item.slice(0, separator).trim();
    const rawValue = item.slice(separator + 1).trim();
    if (!key) fail(`Capability '${item}' has an empty key.`);
    result[key] = coerceValue(rawValue);
  }
  return result;
}

function coerceValue(rawValue) {
  if (rawValue === "true") return true;
  if (rawValue === "false") return false;
  if (rawValue === "null") return null;
  if (/^-?\d+$/.test(rawValue)) return Number(rawValue);
  return rawValue;
}

function normalizeRepoRoot(value) {
  return normalizeSlashes(resolve(value));
}

function normalizeSlashes(value) {
  return value.replace(/\\/g, "/");
}

function normalizeGitPath(value) {
  return normalizeSlashes(value);
}

function safeNumber(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function isFilled(value) {
  return !(value === undefined || value === null || String(value).trim() === "");
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function safeReaddir(targetPath) {
  try {
    return await readdir(targetPath, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function writeText(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, value, "utf8");
}

function gitOutput(repoRoot, args) {
  try {
    const result = spawnSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0) {
      return null;
    }
    const stdout = result.stdout?.trim();
    return stdout ? stdout : null;
  } catch {
    return null;
  }
}

function isGitTrackedAndClean(repoRoot, targetPath) {
  const normalizedPath = normalizeGitPath(targetPath);
  const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "--", normalizedPath], {
    cwd: repoRoot,
    windowsHide: true,
    stdio: "ignore",
  });
  if (tracked.status !== 0) {
    return false;
  }

  const status = spawnSync("git", ["status", "--porcelain", "--", normalizedPath], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  if (status.status !== 0) {
    return false;
  }

  return !status.stdout?.trim();
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
