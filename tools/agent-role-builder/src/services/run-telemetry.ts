import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import type { RoleBuilderRequest } from "../schemas/request.js";
import type { ParticipantRecord, RoleBuilderStatus } from "../schemas/result.js";
import type { GovernanceBinding } from "../schemas/result.js";
import type { TelemetryEvent } from "../shared-imports.js";
import { getTelemetryBuffer } from "../shared-imports.js";

const execFileAsync = promisify(execFile);
let cachedCommitSha: string | null | undefined;

export interface RunTelemetrySnapshot {
  schema_version: "1.0";
  component: "agent-role-builder";
  request_job_id: string;
  role_slug: string;
  execution_mode: string;
  commit_sha: string | null;
  started_at: string;
  last_updated_at: string;
  current_phase: string;
  terminal_status: RoleBuilderStatus | null;
  stop_reason: string | null;
  duration_ms: number;
  rounds_attempted: number;
  rounds_completed: number;
  reviewer_success_count: number;
  reviewer_error_count: number;
  llm_call_count: number;
  llm_failure_count: number;
  total_llm_latency_ms: number;
  total_tokens_in_estimated: number;
  total_tokens_out_estimated: number;
  total_estimated_cost_usd: number;
  provider_failures: Array<{ provider: string; count: number }>;
  session_status_counts: {
    none: number;
    fresh: number;
    resumed: number;
    replaced: number;
  };
  session_latency_ms: {
    none: number;
    fresh: number;
    resumed: number;
    replaced: number;
  };
  engine_metrics: Array<{
    engine: string;
    llm_call_count: number;
    llm_failure_count: number;
    tool_event_count: number;
    tool_failure_count: number;
    total_latency_ms: number;
    llm_latency_ms: number;
    tool_latency_ms: number;
    tokens_in_estimated: number;
    tokens_out_estimated: number;
    estimated_cost_usd: number;
    session_status_counts: {
      none: number;
      fresh: number;
      resumed: number;
      replaced: number;
    };
    review_finding_count: number;
    new_rule_count: number;
    rules_checked: number;
    non_compliant_rule_count: number;
    fix_item_count: number;
    changed_artifact_count: number;
  }>;
  rule_metrics: {
    checked_total: number;
    non_compliant_total: number;
    new_rule_proposal_total: number;
    rule_usage: Array<{
      rule_id: string;
      checked_count: number;
      non_compliant_count: number;
      learning_cover_count: number;
      proposal_count: number;
    }>;
  };
  major_bottleneck_engine: string | null;
  fallback_used: boolean;
  learning_artifact_written: boolean;
  latest_learning_path: string | null;
  governance_snapshot_path: string | null;
  run_postmortem_path: string | null;
  cycle_postmortem_path: string | null;
  result_path: string | null;
}

export interface RunHistoryLedgerEntry {
  schema_version: "1.0";
  component: "agent-role-builder";
  recorded_at: string;
  snapshot: RunTelemetrySnapshot;
}

export interface ArtifactQualityAssessment {
  score: number;
  band: "high" | "medium" | "low";
  method: "status-and-issue-weighting-v1";
  basis: {
    terminal_status: RoleBuilderStatus;
    validation_issue_count: number;
    self_check_issue_count: number;
    review_issue_count: number;
    unresolved_count: number;
  };
}

export interface PhaseDurationEntry {
  phase: string;
  duration_ms: number;
}

export function buildRunTelemetrySnapshot(params: {
  request: RoleBuilderRequest;
  startedAtMs: number;
  startedAtIso: string;
  currentPhase: string;
  roundsAttempted: number;
  roundsCompleted: number;
  participants: ParticipantRecord[];
  telemetryEvents: TelemetryEvent[];
  governanceBinding: GovernanceBinding | null;
  latestLearningPath: string | null;
  runPostmortemPath: string | null;
  cyclePostmortemPath: string | null;
  resultPath: string | null;
  terminalStatus: RoleBuilderStatus | null;
  stopReason: string | null;
}): RunTelemetrySnapshot {
  const reviewerParticipants = params.participants.filter((participant) => participant.role === "reviewer");
  const reviewerSuccessCount = reviewerParticipants.filter((participant) => {
    const verdict = participant.verdict?.toLowerCase();
    return verdict === "approved" || verdict === "conditional" || verdict === "reject";
  }).length;
  const reviewerErrorCount = reviewerParticipants.filter((participant) => {
    const verdict = participant.verdict?.toLowerCase();
    return verdict === "error" || verdict === "parse-error" || (verdict?.startsWith("error:") ?? false);
  }).length;

  const providerFailures = summarizeProviderFailures(params.telemetryEvents);
  const llmSummary = summarizeLlmEconomics(params.telemetryEvents);
  const engineMetrics = summarizeEngineMetrics(params.telemetryEvents);
  const ruleMetrics = summarizeRuleMetrics(params.telemetryEvents);
  const majorBottleneckEngine = engineMetrics
    .slice()
    .sort((left, right) => right.total_latency_ms - left.total_latency_ms)[0]?.engine ?? null;

  return {
    schema_version: "1.0",
    component: "agent-role-builder",
    request_job_id: params.request.job_id,
    role_slug: params.request.role_slug,
    execution_mode: params.request.runtime.execution_mode,
    commit_sha: null,
    started_at: params.startedAtIso,
    last_updated_at: new Date().toISOString(),
    current_phase: params.currentPhase,
    terminal_status: params.terminalStatus,
    stop_reason: params.stopReason,
    duration_ms: Date.now() - params.startedAtMs,
    rounds_attempted: params.roundsAttempted,
    rounds_completed: params.roundsCompleted,
    reviewer_success_count: reviewerSuccessCount,
    reviewer_error_count: reviewerErrorCount,
    llm_call_count: llmSummary.llm_call_count,
    llm_failure_count: llmSummary.llm_failure_count,
    total_llm_latency_ms: llmSummary.total_llm_latency_ms,
    total_tokens_in_estimated: llmSummary.total_tokens_in_estimated,
    total_tokens_out_estimated: llmSummary.total_tokens_out_estimated,
    total_estimated_cost_usd: llmSummary.total_estimated_cost_usd,
    provider_failures: providerFailures,
    session_status_counts: llmSummary.session_status_counts,
    session_latency_ms: llmSummary.session_latency_ms,
    engine_metrics: engineMetrics,
    rule_metrics: ruleMetrics,
    major_bottleneck_engine: majorBottleneckEngine,
    fallback_used: params.participants.some((participant) => participant.was_fallback ?? false)
      || params.telemetryEvents.some((event) => event.category === "llm" && event.provenance.was_fallback),
    learning_artifact_written: Boolean(params.latestLearningPath),
    latest_learning_path: params.latestLearningPath,
    governance_snapshot_path: params.governanceBinding?.snapshot_manifest_path ?? null,
    run_postmortem_path: params.runPostmortemPath,
    cycle_postmortem_path: params.cyclePostmortemPath,
    result_path: params.resultPath,
  };
}

export function buildRunHistoryLedgerEntry(snapshot: RunTelemetrySnapshot): RunHistoryLedgerEntry {
  return {
    schema_version: "1.0",
    component: "agent-role-builder",
    recorded_at: snapshot.last_updated_at,
    snapshot,
  };
}

export function buildArtifactQualityAssessment(params: {
  terminalStatus: RoleBuilderStatus;
  validationIssueCount: number;
  selfCheckIssueCount: number;
  reviewIssueCount: number;
  unresolvedCount: number;
}): ArtifactQualityAssessment {
  const baseScoreByStatus: Record<RoleBuilderStatus, number> = {
    frozen: 92,
    frozen_with_conditions: 82,
    resume_required: 55,
    blocked: 25,
    pushback: 20,
  };
  const rawScore = baseScoreByStatus[params.terminalStatus]
    - (params.validationIssueCount * 8)
    - (params.selfCheckIssueCount * 6)
    - (params.reviewIssueCount * 2)
    - (params.unresolvedCount * 4);
  const score = Math.max(0, Math.min(100, rawScore));
  return {
    score,
    band: score >= 80 ? "high" : score >= 60 ? "medium" : "low",
    method: "status-and-issue-weighting-v1",
    basis: {
      terminal_status: params.terminalStatus,
      validation_issue_count: params.validationIssueCount,
      self_check_issue_count: params.selfCheckIssueCount,
      review_issue_count: params.reviewIssueCount,
      unresolved_count: params.unresolvedCount,
    },
  };
}

export async function readPhaseDurations(runDir: string, nowMs = Date.now()): Promise<PhaseDurationEntry[]> {
  const historyPath = join(runDir, "runtime", "run-history.jsonl");
  let raw: string;
  try {
    raw = await readFile(historyPath, "utf-8");
  } catch {
    return [];
  }

  const entries = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as RunHistoryLedgerEntry)
    .filter((entry) => entry.snapshot?.current_phase && entry.recorded_at);

  if (entries.length === 0) {
    return [];
  }

  const durations = new Map<string, number>();
  for (let index = 0; index < entries.length; index++) {
    const current = entries[index];
    const next = entries[index + 1];
    const currentMs = Date.parse(current.recorded_at);
    const endMs = next ? Date.parse(next.recorded_at) : nowMs;
    if (!Number.isFinite(currentMs) || !Number.isFinite(endMs) || endMs < currentMs) {
      continue;
    }
    durations.set(
      current.snapshot.current_phase,
      (durations.get(current.snapshot.current_phase) ?? 0) + (endMs - currentMs)
    );
  }

  return [...durations.entries()]
    .map(([phase, duration_ms]) => ({ phase, duration_ms }))
    .sort((left, right) => right.duration_ms - left.duration_ms);
}

export async function writeRunTelemetry(params: {
  request: RoleBuilderRequest;
  runDir: string;
  startedAtMs: number;
  startedAtIso: string;
  currentPhase: string;
  roundsAttempted: number;
  roundsCompleted: number;
  participants: ParticipantRecord[];
  governanceBinding: GovernanceBinding | null;
  latestLearningPath?: string | null;
  runPostmortemPath?: string | null;
  cyclePostmortemPath?: string | null;
  resultPath?: string | null;
  terminalStatus?: RoleBuilderStatus | null;
  stopReason?: string | null;
}): Promise<void> {
  const snapshot = buildRunTelemetrySnapshot({
    request: params.request,
    startedAtMs: params.startedAtMs,
    startedAtIso: params.startedAtIso,
    currentPhase: params.currentPhase,
    roundsAttempted: params.roundsAttempted,
    roundsCompleted: params.roundsCompleted,
    participants: params.participants,
    telemetryEvents: getTelemetryBuffer(),
    governanceBinding: params.governanceBinding,
    latestLearningPath: params.latestLearningPath ?? null,
    runPostmortemPath: params.runPostmortemPath ?? null,
    cyclePostmortemPath: params.cyclePostmortemPath ?? null,
    resultPath: params.resultPath ?? null,
    terminalStatus: params.terminalStatus ?? null,
    stopReason: params.stopReason ?? null,
  });
  snapshot.commit_sha = await resolveCurrentCommitSha();
  const runtimeDir = join(params.runDir, "runtime");
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(join(runtimeDir, "run-telemetry.json"), JSON.stringify(snapshot, null, 2), "utf-8");
  const ledgerEntry = buildRunHistoryLedgerEntry(snapshot);
  await appendFile(join(runtimeDir, "run-history.jsonl"), `${JSON.stringify(ledgerEntry)}\n`, "utf-8");
}

function summarizeProviderFailures(events: TelemetryEvent[]): Array<{ provider: string; count: number }> {
  const failures = new Map<string, number>();

  for (const event of events) {
    if (event.category !== "llm" || event.success) continue;
    failures.set(event.provenance.provider, (failures.get(event.provenance.provider) ?? 0) + 1);
  }

  return [...failures.entries()]
    .map(([provider, count]) => ({ provider, count }))
    .sort((left, right) => left.provider.localeCompare(right.provider));
}

function summarizeLlmEconomics(events: TelemetryEvent[]) {
  const llmEvents = events.filter((event) => event.category === "llm");
  const sessionStatusCounts = {
    none: 0,
    fresh: 0,
    resumed: 0,
    replaced: 0,
  };
  const sessionLatencyMs = {
    none: 0,
    fresh: 0,
    resumed: 0,
    replaced: 0,
  };

  for (const event of llmEvents) {
    const sessionStatus = readStringMetadata(event, "session_status");
    if (sessionStatus === "none" || sessionStatus === "fresh" || sessionStatus === "resumed" || sessionStatus === "replaced") {
      sessionStatusCounts[sessionStatus] += 1;
      sessionLatencyMs[sessionStatus] += event.latency_ms;
    }
  }

  return {
    llm_call_count: llmEvents.length,
    llm_failure_count: llmEvents.filter((event) => !event.success).length,
    total_llm_latency_ms: llmEvents.reduce((sum, event) => sum + event.latency_ms, 0),
    total_tokens_in_estimated: sumOptionalNumber(llmEvents.map((event) => event.tokens_in)),
    total_tokens_out_estimated: sumOptionalNumber(llmEvents.map((event) => event.tokens_out)),
    total_estimated_cost_usd: Number(sumOptionalNumber(llmEvents.map((event) => event.estimated_cost_usd)).toFixed(6)),
    session_status_counts: sessionStatusCounts,
    session_latency_ms: sessionLatencyMs,
  };
}

function summarizeEngineMetrics(events: TelemetryEvent[]): RunTelemetrySnapshot["engine_metrics"] {
  const metrics = new Map<string, RunTelemetrySnapshot["engine_metrics"][number]>();

  for (const event of events) {
    const engine = readStringMetadata(event, "engine");
    if (!engine) continue;

    const current = metrics.get(engine) ?? {
      engine,
      llm_call_count: 0,
      llm_failure_count: 0,
      tool_event_count: 0,
      tool_failure_count: 0,
      total_latency_ms: 0,
      llm_latency_ms: 0,
      tool_latency_ms: 0,
      tokens_in_estimated: 0,
      tokens_out_estimated: 0,
      estimated_cost_usd: 0,
      session_status_counts: {
        none: 0,
        fresh: 0,
        resumed: 0,
        replaced: 0,
      },
      review_finding_count: 0,
      new_rule_count: 0,
      rules_checked: 0,
      non_compliant_rule_count: 0,
      fix_item_count: 0,
      changed_artifact_count: 0,
    };

    current.total_latency_ms += event.latency_ms;
    if (event.category === "llm") {
      current.llm_call_count += 1;
      current.llm_latency_ms += event.latency_ms;
      if (!event.success) {
        current.llm_failure_count += 1;
      }
      current.tokens_in_estimated += event.tokens_in ?? 0;
      current.tokens_out_estimated += event.tokens_out ?? 0;
      current.estimated_cost_usd = Number((current.estimated_cost_usd + (event.estimated_cost_usd ?? 0)).toFixed(6));
      const sessionStatus = readStringMetadata(event, "session_status");
      if (sessionStatus === "none" || sessionStatus === "fresh" || sessionStatus === "resumed" || sessionStatus === "replaced") {
        current.session_status_counts[sessionStatus] += 1;
      }
    } else if (event.category === "tool") {
      current.tool_event_count += 1;
      current.tool_latency_ms += event.latency_ms;
      if (!event.success) {
        current.tool_failure_count += 1;
      }
      current.review_finding_count += readNumberMetadata(event, "review_finding_count");
      current.new_rule_count += readNumberMetadata(event, "new_rule_count");
      current.rules_checked += readNumberMetadata(event, "rule_count_checked");
      current.non_compliant_rule_count += readNumberMetadata(event, "non_compliant_count");
      current.fix_item_count += readNumberMetadata(event, "fix_item_count");
      current.changed_artifact_count += readBooleanMetadata(event, "changed") ? 1 : 0;
    }

    metrics.set(engine, current);
  }

  return [...metrics.values()].sort((left, right) => left.engine.localeCompare(right.engine));
}

function summarizeRuleMetrics(events: TelemetryEvent[]): RunTelemetrySnapshot["rule_metrics"] {
  const usage = new Map<string, RunTelemetrySnapshot["rule_metrics"]["rule_usage"][number]>();
  let checkedTotal = 0;
  let nonCompliantTotal = 0;
  let newRuleProposalTotal = 0;

  for (const event of events) {
    if (event.category !== "tool") continue;
    const engine = readStringMetadata(event, "engine");
    if (engine === "rules-compliance-enforcer") {
      const ruleIdsChecked = readStringArrayMetadata(event, "rule_ids_checked");
      const nonCompliantRuleIds = readStringArrayMetadata(event, "rule_ids_non_compliant");
      checkedTotal += ruleIdsChecked.length;
      nonCompliantTotal += nonCompliantRuleIds.length;
      for (const ruleId of ruleIdsChecked) {
        const current = usage.get(ruleId) ?? createRuleUsageEntry(ruleId);
        current.checked_count += 1;
        usage.set(ruleId, current);
      }
      for (const ruleId of nonCompliantRuleIds) {
        const current = usage.get(ruleId) ?? createRuleUsageEntry(ruleId);
        current.non_compliant_count += 1;
        usage.set(ruleId, current);
      }
    }

    if (engine === "self-learning-engine") {
      const newRuleIds = readStringArrayMetadata(event, "new_rule_ids");
      const coveredRuleIds = readStringArrayMetadata(event, "covered_rule_ids");
      newRuleProposalTotal += newRuleIds.length;
      for (const ruleId of newRuleIds) {
        const current = usage.get(ruleId) ?? createRuleUsageEntry(ruleId);
        current.proposal_count += 1;
        usage.set(ruleId, current);
      }
      for (const ruleId of coveredRuleIds) {
        const current = usage.get(ruleId) ?? createRuleUsageEntry(ruleId);
        current.learning_cover_count += 1;
        usage.set(ruleId, current);
      }
    }
  }

  return {
    checked_total: checkedTotal,
    non_compliant_total: nonCompliantTotal,
    new_rule_proposal_total: newRuleProposalTotal,
    rule_usage: [...usage.values()].sort((left, right) => left.rule_id.localeCompare(right.rule_id)),
  };
}

function createRuleUsageEntry(ruleId: string): RunTelemetrySnapshot["rule_metrics"]["rule_usage"][number] {
  return {
    rule_id: ruleId,
    checked_count: 0,
    non_compliant_count: 0,
    learning_cover_count: 0,
    proposal_count: 0,
  };
}

function readStringMetadata(event: TelemetryEvent, key: string): string | null {
  const value = event.metadata?.[key];
  return typeof value === "string" ? value : null;
}

function readBooleanMetadata(event: TelemetryEvent, key: string): boolean {
  return event.metadata?.[key] === true;
}

function readNumberMetadata(event: TelemetryEvent, key: string): number {
  const value = event.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readStringArrayMetadata(event: TelemetryEvent, key: string): string[] {
  const value = event.metadata?.[key];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function sumOptionalNumber(values: Array<number | undefined>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

async function resolveCurrentCommitSha(): Promise<string | null> {
  if (cachedCommitSha !== undefined) {
    return cachedCommitSha;
  }

  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: join(process.cwd()),
      windowsHide: true,
    });
    cachedCommitSha = stdout.trim() || null;
  } catch {
    cachedCommitSha = null;
  }

  return cachedCommitSha;
}
