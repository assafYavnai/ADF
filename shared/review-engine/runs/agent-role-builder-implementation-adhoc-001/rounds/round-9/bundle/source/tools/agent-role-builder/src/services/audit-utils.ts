import { stat } from "node:fs/promises";
import type { ParticipantRecord } from "../schemas/result.js";

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export function buildAuditEnvelope(params: {
  requestJobId: string;
  round: number;
  reviewMode: string | null;
  participants: ParticipantRecord[];
  artifactRefs: Record<string, string | null> | Record<string, string> | null;
}) {
  const leaderParticipant = params.participants.find((participant) => participant.role === "leader") ?? params.participants[0] ?? null;
  return {
    component: "agent-role-builder",
    job_id: params.requestJobId,
    round: params.round,
    review_mode: params.reviewMode ?? "none",
    provider: leaderParticipant?.provider ?? null,
    model: leaderParticipant?.model ?? null,
    latency_ms: params.participants.reduce((sum, participant) => sum + (participant.latency_ms ?? 0), 0),
    fallback_used: params.participants.some((participant) => participant.was_fallback ?? false),
    artifact_refs: params.artifactRefs
      ? Object.fromEntries(
          Object.entries(params.artifactRefs).map(([key, value]) => [key, typeof value === "string" ? value.replace(/\\/g, "/") : null])
        )
      : null,
  };
}

// Board unresolved/deferred identifiers are case-sensitive because reviewer group IDs are part of the value.
export function uniqueStringsCaseSensitive(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

// Result/open-question summaries are human-facing aggregates and should collapse casing-only duplicates.
export function uniqueStringsCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
}
