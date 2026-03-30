import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import type { RoleBuilderRequest, BoardParticipant } from "../schemas/request.js";
import type { InvocationSessionHandle, InvocationSessionResult } from "../shared-imports.js";

const SessionSourceSchema = z.enum(["provider_returned", "caller_assigned", "manual_recovery"]);

const SessionHandleSchema = z.object({
  provider: z.enum(["codex", "claude", "gemini"]),
  session_id: z.string(),
  source: SessionSourceSchema,
});

const SessionRegistryEntrySchema = z.object({
  slot_key: z.string(),
  role: z.enum(["leader", "reviewer"]),
  provider: z.enum(["codex", "claude", "gemini"]),
  model: z.string(),
  handle: SessionHandleSchema.nullable(),
  last_status: z.enum(["loaded", "fresh", "resumed", "replaced"]).nullable(),
  updated_at: z.string().datetime().nullable(),
  last_invocation_id: z.string().uuid().nullable(),
  last_round: z.number().int().nonnegative().nullable(),
});

const SessionRegistrySchema = z.object({
  schema_version: z.literal("1.0"),
  request_job_id: z.string(),
  role_slug: z.string(),
  execution_mode: z.string(),
  started_at_utc: z.string(),
  updated_at_utc: z.string(),
  slots: z.record(SessionRegistryEntrySchema),
});

export type SessionRegistry = z.infer<typeof SessionRegistrySchema>;
type SessionRegistryEntry = z.infer<typeof SessionRegistryEntrySchema>;

export function buildLeaderSlotKey(participant: BoardParticipant): string {
  return `leader-${participant.provider}`;
}

export function buildReviewerSlotKey(slotIndex: number, participant: BoardParticipant): string {
  return `reviewer-${slotIndex}-${participant.provider}`;
}

export function buildInitialSessionRegistry(params: {
  request: RoleBuilderRequest;
  startedAtIso: string;
  initialHandles?: Record<string, InvocationSessionHandle>;
}): SessionRegistry {
  const initialHandles = params.initialHandles ?? {};
  const slots = Object.fromEntries([
    buildSessionRegistryEntry(
      buildLeaderSlotKey(params.request.board_roster.leader),
      "leader",
      params.request.board_roster.leader,
      initialHandles
    ),
    ...params.request.board_roster.reviewers.map((reviewer, index) =>
      buildSessionRegistryEntry(buildReviewerSlotKey(index, reviewer), "reviewer", reviewer, initialHandles)
    ),
  ]);

  return {
    schema_version: "1.0",
    request_job_id: params.request.job_id,
    role_slug: params.request.role_slug,
    execution_mode: params.request.runtime.execution_mode,
    started_at_utc: params.startedAtIso,
    updated_at_utc: params.startedAtIso,
    slots,
  };
}

export async function writeSessionRegistry(path: string, registry: SessionRegistry): Promise<void> {
  const nextRegistry: SessionRegistry = {
    ...registry,
    updated_at_utc: new Date().toISOString(),
  };
  await writeFile(path, JSON.stringify(nextRegistry, null, 2), "utf-8");
}

export async function loadSessionRegistry(path: string): Promise<SessionRegistry> {
  const raw = await readFile(path, "utf-8");
  return SessionRegistrySchema.parse(JSON.parse(raw));
}

export async function updateSessionRegistrySlot(params: {
  sessionRegistryPath: string;
  slotKey: string;
  round: number;
  invocationId: string | null;
  session: InvocationSessionResult;
}): Promise<void> {
  const registry = await loadSessionRegistry(params.sessionRegistryPath);
  const existing = registry.slots[params.slotKey];
  if (!existing) {
    throw new Error(`Session registry slot not found: ${params.slotKey}`);
  }

  const updatedEntry: SessionRegistryEntry = {
    ...existing,
    handle: params.session.handle,
    last_status: params.session.status,
    updated_at: new Date().toISOString(),
    last_invocation_id: params.invocationId,
    last_round: params.round,
  };

  await writeSessionRegistry(params.sessionRegistryPath, {
    ...registry,
    slots: {
      ...registry.slots,
      [params.slotKey]: updatedEntry,
    },
  });
}

function buildSessionRegistryEntry(
  slotKey: string,
  role: "leader" | "reviewer",
  participant: BoardParticipant,
  initialHandles: Record<string, InvocationSessionHandle>
): [string, SessionRegistryEntry] {
  const handle = initialHandles[slotKey] ?? null;
  return [
    slotKey,
    {
      slot_key: slotKey,
      role,
      provider: participant.provider,
      model: participant.model,
      handle,
      last_status: handle ? "loaded" : null,
      updated_at: handle ? new Date().toISOString() : null,
      last_invocation_id: null,
      last_round: null,
    },
  ];
}
