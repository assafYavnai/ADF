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
    "superseded_requirement_archive",
  ]),
  target: z.enum(["thread", "memory_engine"]),
  status: z.enum(["stored", "created", "locked", "archived", "skipped", "failed"]),
  artifact_kind: z.string(),
  action: z.string(),
  scope_path: z.string().nullable().default(null),
  record_id: z.string().nullable().default(null),
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
