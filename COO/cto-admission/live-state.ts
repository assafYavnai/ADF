import { z } from "zod";

export const AdmissionStatus = z.enum([
  "admission_not_started",
  "admission_build_failed",
  "admission_pending_decision",
  "admission_admitted",
  "admission_deferred",
  "admission_blocked",
]);
export type AdmissionStatus = z.infer<typeof AdmissionStatus>;

export const AdmissionDecisionValue = z.enum(["admit", "defer", "block"]);
export type AdmissionDecisionValue = z.infer<typeof AdmissionDecisionValue>;

export const AdmissionBuildOutcome = z.enum(["admitted", "deferred", "blocked", "build_failed"]);
export type AdmissionBuildOutcome = z.infer<typeof AdmissionBuildOutcome>;

export const PacketKpiSnapshot = z.object({
  admission_packet_build_latency_ms: z.number().nonnegative(),
  admission_packets_built_count: z.number().int().nonnegative(),
  admission_packets_admitted_count: z.number().int().nonnegative(),
  admission_packets_deferred_count: z.number().int().nonnegative(),
  admission_packets_blocked_count: z.number().int().nonnegative(),
  missing_required_input_count: z.number().int().nonnegative(),
  dependency_blocked_count: z.number().int().nonnegative(),
  scope_conflict_detected_count: z.number().int().nonnegative(),
  admission_source_metadata_completeness_rate: z.number().min(0).max(1),
  requirement_to_packet_parity_count: z.number().int().nonnegative(),
  partition: z.enum(["production", "proof"]),
});
export type PacketKpiSnapshot = z.infer<typeof PacketKpiSnapshot>;

export const AdmissionArtifactPaths = z.object({
  feature_root: z.string(),
  request_json: z.string().nullable().default(null),
  decision_template_json: z.string().nullable().default(null),
  summary_md: z.string().nullable().default(null),
});
export type AdmissionArtifactPaths = z.infer<typeof AdmissionArtifactPaths>;

export const AdmissionLatencySummary = z.object({
  samples_ms: z.array(z.number().int().nonnegative()).default([]),
  last_ms: z.number().int().nonnegative().default(0),
  p50_ms: z.number().int().nonnegative().default(0),
  p95_ms: z.number().int().nonnegative().default(0),
  p99_ms: z.number().int().nonnegative().default(0),
  over_1s_count: z.number().int().nonnegative().default(0),
  over_10s_count: z.number().int().nonnegative().default(0),
  over_60s_count: z.number().int().nonnegative().default(0),
});
export type AdmissionLatencySummary = z.infer<typeof AdmissionLatencySummary>;

export const AdmissionKpiState = z.object({
  finalized_requirement_to_admission_latency_ms: AdmissionLatencySummary.default({}),
  finalized_requirement_handoff_count: z.number().int().nonnegative().default(0),
  admission_artifact_build_success_count: z.number().int().nonnegative().default(0),
  admission_artifact_build_failed_count: z.number().int().nonnegative().default(0),
  admission_pending_decision_count: z.number().int().nonnegative().default(0),
  admission_admitted_count: z.number().int().nonnegative().default(0),
  admission_deferred_count: z.number().int().nonnegative().default(0),
  admission_blocked_count: z.number().int().nonnegative().default(0),
  admission_artifact_persist_failure_count: z.number().int().nonnegative().default(0),
  requirement_to_admission_artifact_parity_count: z.number().int().nonnegative().default(0),
  admission_status_write_attempt_count: z.number().int().nonnegative().default(0),
  admission_status_write_complete_count: z.number().int().nonnegative().default(0),
  admission_status_write_completeness_rate: z.number().min(0).max(1).default(0),
  production_handoff_count: z.number().int().nonnegative().default(0),
  proof_handoff_count: z.number().int().nonnegative().default(0),
});
export type AdmissionKpiState = z.infer<typeof AdmissionKpiState>;

export const CtoAdmissionThreadState = z.object({
  feature_slug: z.string(),
  requirement_artifact_source: z.string(),
  finalized_requirement_memory_id: z.string().uuid().nullable().default(null),
  partition: z.enum(["production", "proof"]).default("production"),
  status: AdmissionStatus,
  outcome: AdmissionBuildOutcome.nullable().default(null),
  packet_built_at: z.string().datetime().nullable().default(null),
  decision: AdmissionDecisionValue.nullable().default(null),
  decision_reason: z.string().nullable().default(null),
  decided_at: z.string().datetime().nullable().default(null),
  decided_by: z.string().nullable().default(null),
  dependency_blocked: z.boolean().default(false),
  scope_conflict_detected: z.boolean().default(false),
  validation_errors: z.array(z.string()).default([]),
  last_error: z.string().nullable().default(null),
  artifact_paths: AdmissionArtifactPaths,
  packet_kpi_snapshot: PacketKpiSnapshot.nullable().default(null),
  kpi: AdmissionKpiState.default({}),
  updated_at: z.string().datetime(),
});
export type CtoAdmissionThreadState = z.infer<typeof CtoAdmissionThreadState>;
