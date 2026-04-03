import { z } from "zod";
import { RequirementArtifact, WorkingScopeArtifact } from "./onion-artifact.js";
import {
  OnionLlmCallRecord,
  OnionOperationRecord,
  OnionWorkflowAuditTrace,
} from "./onion-observability.js";
import { OnionLayer, OnionState } from "./onion-state.js";

export const OnionPersistenceReceipt = z.object({
  kind: z.enum([
    "thread_workflow_state",
    "finalized_requirement_create",
    "finalized_requirement_lock",
    "provisional_finalized_requirement_retire",
    "superseded_requirement_retire",
  ]),
  target: z.enum(["thread", "memory_engine"]),
  status: z.enum(["stored", "created", "locked", "archived", "superseded", "skipped", "failed"]),
  artifact_kind: z.string(),
  action: z.string(),
  scope_path: z.string().nullable().default(null),
  record_id: z.string().nullable().default(null),
  duration_ms: z.number().int().nonnegative().default(0),
  success: z.boolean(),
  message: z.string(),
});
export type OnionPersistenceReceipt = z.infer<typeof OnionPersistenceReceipt>;

export const OnionWorkflowLifecycleStatus = z.enum([
  "active",
  "awaiting_freeze_approval",
  "approved",
  "handoff_ready",
  "blocked",
]);
export type OnionWorkflowLifecycleStatus = z.infer<typeof OnionWorkflowLifecycleStatus>;

export const OnionWorkflowThreadState = z.object({
  trace_id: z.string(),
  last_turn_id: z.string(),
  lifecycle_status: OnionWorkflowLifecycleStatus,
  current_layer: OnionLayer,
  selected_next_question: z.string().nullable(),
  no_question_reason: z.string().nullable(),
  state: OnionState,
  working_artifact: WorkingScopeArtifact,
  requirement_artifact: RequirementArtifact.nullable(),
  finalized_requirement_memory_id: z.string().uuid().nullable().default(null),
  latest_audit_trace: OnionWorkflowAuditTrace,
  latest_llm_calls: z.array(OnionLlmCallRecord).default([]),
  latest_persistence_receipts: z.array(OnionPersistenceReceipt).default([]),
});
export type OnionWorkflowThreadState = z.infer<typeof OnionWorkflowThreadState>;

export const OnionTurnResultRecord = z.object({
  trace_id: z.string(),
  turn_id: z.string(),
  lifecycle_status: OnionWorkflowLifecycleStatus,
  current_layer: OnionLayer,
  turn_latency_ms: z.number().int().nonnegative().default(0),
  parser_latency_ms: z.number().int().nonnegative().default(0),
  llm_totals: z.object({
    tokens_in: z.number().int().nonnegative(),
    tokens_out: z.number().int().nonnegative(),
    estimated_cost_usd: z.number().nonnegative().nullable().default(null),
  }).default({
    tokens_in: 0,
    tokens_out: 0,
    estimated_cost_usd: null,
  }),
  layer_metrics: z.object({
    turns_in_current_layer: z.number().int().nonnegative(),
    time_in_current_layer_ms: z.number().int().nonnegative(),
    clarification_turn_count_total: z.number().int().nonnegative(),
    freeze_blocker_count: z.number().int().nonnegative(),
    open_decision_count: z.number().int().nonnegative(),
  }),
  state: OnionState,
  working_artifact: WorkingScopeArtifact,
  requirement_artifact: RequirementArtifact.nullable(),
  finalized_requirement_memory_id: z.string().uuid().nullable().default(null),
  workflow_trace: OnionWorkflowAuditTrace,
  operation_records: z.array(OnionOperationRecord),
  llm_calls: z.array(OnionLlmCallRecord).default([]),
  persistence_receipts: z.array(OnionPersistenceReceipt).default([]),
  state_commit_summary: z.string(),
  open_loops: z.array(z.string()).default([]),
});
export type OnionTurnResultRecord = z.infer<typeof OnionTurnResultRecord>;
