import { writeFile } from "node:fs/promises";
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
  provider_failures: Array<{ provider: string; count: number }>;
  fallback_used: boolean;
  learning_artifact_written: boolean;
  latest_learning_path: string | null;
  governance_snapshot_path: string | null;
  run_postmortem_path: string | null;
  cycle_postmortem_path: string | null;
  result_path: string | null;
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
    return verdict === "error" || verdict === "parse-error";
  }).length;

  const providerFailures = summarizeProviderFailures(params.telemetryEvents);

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
    provider_failures: providerFailures,
    fallback_used: params.participants.some((participant) => participant.was_fallback ?? false),
    learning_artifact_written: Boolean(params.latestLearningPath),
    latest_learning_path: params.latestLearningPath,
    governance_snapshot_path: params.governanceBinding?.snapshot_manifest_path ?? null,
    run_postmortem_path: params.runPostmortemPath,
    cycle_postmortem_path: params.cyclePostmortemPath,
    result_path: params.resultPath,
  };
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
  await writeFile(join(params.runDir, "runtime", "run-telemetry.json"), JSON.stringify(snapshot, null, 2), "utf-8");
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
