import { z } from "zod";
import { EvidenceLifecycleStatus, ProvenanceSchema } from "../provenance.js";

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
  "rule",
  "role",
  "setting",
  "finding",
]);
export type ContentType = z.infer<typeof ContentType>;

export const TrustLevel = z.enum(["working", "reviewed", "locked"]);
export type TrustLevel = z.infer<typeof TrustLevel>;

export const WorkflowStatus = z.enum([
  "current",
  "pending_finalization",
  "archived",
  "superseded",
]);
export type WorkflowStatus = z.infer<typeof WorkflowStatus>;

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
  evidence_format_version: z.number().int(),
  evidence_lifecycle_status: EvidenceLifecycleStatus,
  legacy_marker: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type MemoryItem = z.infer<typeof MemoryItemSchema>;

export const CaptureMemoryInput = z.object({
  content: z.union([z.string(), z.record(z.unknown())]),
  content_type: ContentType.default("text"),
  scope: z.string(),
  tags: z.array(z.string()).default([]),
  trust_level: TrustLevel.default("working"),
  skip_dedup: z.boolean().default(false),
  provenance: ProvenanceSchema,
});
export type CaptureMemoryInput = z.infer<typeof CaptureMemoryInput>;

export const SearchMemoryInput = z.object({
  query: z.string(),
  scope: z.string(),
  content_type: ContentType.optional(),
  content_types: z.array(ContentType).min(1).optional(),
  trust_levels: z.array(TrustLevel).min(1).optional(),
  semantic_weight: z.number().min(0).max(1).default(0.7),
  max_results: z.number().min(1).max(100).default(10),
  include_legacy: z.boolean().default(false),
  provenance: ProvenanceSchema.optional(),
});
export type SearchMemoryInput = z.infer<typeof SearchMemoryInput>;

export const ContextSummaryInput = z.object({
  scope: z.string(),
  content_type: ContentType.optional(),
  limit: z.number().min(1).max(200).default(50),
  include_legacy: z.boolean().default(false),
  provenance: ProvenanceSchema.optional(),
});
export type ContextSummaryInput = z.infer<typeof ContextSummaryInput>;

export const ListRecentInput = z.object({
  scope: z.string(),
  content_type: ContentType.optional(),
  limit: z.number().min(1).max(200).default(20),
  offset: z.number().min(0).default(0),
  include_legacy: z.boolean().default(false),
  provenance: ProvenanceSchema.optional(),
});
export type ListRecentInput = z.infer<typeof ListRecentInput>;

export const MemoryManageInput = z.object({
  action: z.enum([
    "delete",
    "archive",
    "supersede",
    "update_tags",
    "update_trust_level",
    "publish_finalized_requirement",
  ]),
  memory_id: z.string().uuid(),
  scope: z.string(),
  tags: z.array(z.string()).optional(),
  trust_level: TrustLevel.optional(),
  reason: z.string().optional(),
  provenance: ProvenanceSchema,
});
export type MemoryManageInput = z.infer<typeof MemoryManageInput>;
