import { z } from "zod";
import { ProvenanceSchema } from "../provenance.js";

export const ContentType = z.enum([
  "text",
  "decision",
  "intent",
  "context",
  "lesson",
  "convention",
  "requirement",
  "note",
  "open_loop",
  "artifact_ref",
]);
export type ContentType = z.infer<typeof ContentType>;

export const TrustLevel = z.enum(["working", "reviewed", "locked"]);
export type TrustLevel = z.infer<typeof TrustLevel>;

export const ContextPriority = z.enum(["p0", "p1", "p2", "p3"]);
export type ContextPriority = z.infer<typeof ContextPriority>;

export const CompressionPolicy = z.enum(["full", "executive", "bullet", "drop"]);
export type CompressionPolicy = z.infer<typeof CompressionPolicy>;

export const ScopeLevel = z.enum([
  "organization",
  "project",
  "initiative",
  "phase",
  "thread",
]);
export type ScopeLevel = z.infer<typeof ScopeLevel>;

export const MemoryItemSchema = z.object({
  id: z.string().uuid(),
  content: z.record(z.unknown()),
  content_type: ContentType,
  trust_level: TrustLevel,
  scope_level: ScopeLevel,
  org_id: z.string().uuid().nullable(),
  project_id: z.string().uuid().nullable(),
  initiative_id: z.string().uuid().nullable(),
  phase_id: z.string().uuid().nullable(),
  thread_id: z.string().uuid().nullable(),
  agent_id: z.string().uuid().nullable(),
  tags: z.array(z.string()),
  context_priority: ContextPriority,
  compression_policy: CompressionPolicy,
  workflow_metadata: z.record(z.unknown()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type MemoryItem = z.infer<typeof MemoryItemSchema>;

export const CaptureMemoryInput = z.object({
  content: z.union([z.string(), z.record(z.unknown())]),
  content_type: ContentType.default("text"),
  scope: z.string().optional(),
  tags: z.array(z.string()).default([]),
  trust_level: TrustLevel.default("working"),
  skip_dedup: z.boolean().default(false),
  provenance: ProvenanceSchema.optional(),
});
export type CaptureMemoryInput = z.infer<typeof CaptureMemoryInput>;

export const SearchMemoryInput = z.object({
  query: z.string(),
  scope: z.string().optional(),
  content_type: ContentType.optional(),
  semantic_weight: z.number().min(0).max(1).default(0.7),
  max_results: z.number().min(1).max(100).default(10),
});
export type SearchMemoryInput = z.infer<typeof SearchMemoryInput>;

export const MemoryManageInput = z.object({
  action: z.enum(["delete", "archive", "update_tags", "update_trust_level"]),
  memory_id: z.string().uuid(),
  tags: z.array(z.string()).optional(),
  trust_level: TrustLevel.optional(),
  reason: z.string().optional(),
});
export type MemoryManageInput = z.infer<typeof MemoryManageInput>;
