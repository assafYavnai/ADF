import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import type { RoleBuilderRequest, BoardParticipant } from "../schemas/request.js";
import type { InvocationSessionHandle, InvocationSessionResult } from "../shared-imports.js";

const SessionSourceSchema = z.enum(["provider_returned", "caller_assigned", "manual_recovery"]);

const SessionHandleSchema = z.object({
  provider: z.enum(["codex", "claude", "gemini"]),
  model: z.string().optional(),
  session_id: z.string(),
  source: SessionSourceSchema,
});

const SessionRegistryEntrySchema = z.object({
  slot_key: z.string(),
  role: z.enum(["leader", "reviewer"]),
  provider: z.enum(["codex", "claude", "gemini"]),
  model: z.string(),
  handle: SessionHandleSchema.nullable(),
  last_status: z.enum([
    "loaded",
    "ignored_provider_mismatch",
    "ignored_model_mismatch",
    "fresh",
    "resumed",
    "replaced",
  ]).nullable(),
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

export function assertSessionRegistryMatchesRequest(
  registry: SessionRegistry,
  request: Pick<RoleBuilderRequest, "job_id" | "role_slug" | "runtime">
): void {
  if (registry.request_job_id !== request.job_id) {
    throw new Error(
      `Session registry request_job_id mismatch: expected "${request.job_id}", got "${registry.request_job_id}"`
    );
  }
  if (registry.role_slug !== request.role_slug) {
    throw new Error(
      `Session registry role_slug mismatch: expected "${request.role_slug}", got "${registry.role_slug}"`
    );
  }
  if (registry.execution_mode !== request.runtime.execution_mode) {
    throw new Error(
      `Session registry execution_mode mismatch: expected "${request.runtime.execution_mode}", got "${registry.execution_mode}"`
    );
  }
}

export function extractActiveSessionHandles(registry: SessionRegistry): Record<string, InvocationSessionHandle> {
  return Object.fromEntries(
    Object.entries(registry.slots)
      .filter(([, entry]) => entry.handle !== null && entry.last_status !== "ignored_provider_mismatch" && entry.last_status !== "ignored_model_mismatch")
      .map(([slotKey, entry]) => [slotKey, entry.handle as InvocationSessionHandle])
  );
}

function buildSessionRegistryEntry(
  slotKey: string,
  role: "leader" | "reviewer",
  participant: BoardParticipant,
  initialHandles: Record<string, InvocationSessionHandle>
): [string, SessionRegistryEntry] {
  const providedHandle = initialHandles[slotKey] ?? null;
  const providerMismatch = providedHandle && providedHandle.provider !== participant.provider;
  const modelMismatch = providedHandle && providedHandle.model && providedHandle.model !== participant.model;
  const handle = providerMismatch || modelMismatch ? null : providedHandle;
  const lastStatus = providerMismatch
    ? "ignored_provider_mismatch"
    : modelMismatch
      ? "ignored_model_mismatch"
      : handle
        ? "loaded"
        : null;
  return [
    slotKey,
    {
      slot_key: slotKey,
      role,
      provider: participant.provider,
      model: participant.model,
      handle,
      last_status: lastStatus,
      updated_at: lastStatus ? new Date().toISOString() : null,
      last_invocation_id: null,
      last_round: null,
    },
  ];
}
