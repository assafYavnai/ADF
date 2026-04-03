/**
 * COO -> CTO Admission Packet Builder — Type Definitions
 *
 * These types define the shared contract pack for admission requests,
 * decision templates, and KPI instrumentation.
 */

// --- Finalized Requirement Input ---

export interface FinalizedRequirementArtifact {
  feature_slug: string;
  requirement_artifact_source: string;
  business_priority: "critical" | "high" | "medium" | "low";
  claimed_scope_paths: string[];
  non_goals: string[];
  boundaries: string[];
  sequencing_hint: "before" | "after" | "independent" | "any";
  dependency_notes: string[];
  conflict_notes: string[];
  suggested_execution_mode: "sequential" | "safe-parallel" | "dependency-blocked";
  requirement_summary: string;
  frozen_at: string; // ISO-8601
}

// --- Admission Request (output) ---

export interface CtoAdmissionRequest {
  schema_version: 1;
  feature_slug: string;
  requirement_artifact_source: string;
  business_priority: "critical" | "high" | "medium" | "low";
  claimed_scope_paths: string[];
  non_goals: string[];
  boundaries: string[];
  sequencing_hint: "before" | "after" | "independent" | "any";
  dependency_notes: string[];
  conflict_notes: string[];
  suggested_execution_mode: "sequential" | "safe-parallel" | "dependency-blocked";
  requirement_summary: string;
  source_frozen_at: string;
  packet_built_at: string; // ISO-8601
  build_latency_ms: number;
  source_metadata_completeness: SourceMetadataCompleteness;
  partition: "production" | "proof";
}

export interface SourceMetadataCompleteness {
  total_fields: number;
  present_fields: number;
  missing_fields: string[];
  completeness_rate: number; // 0..1
}

// --- Admission Decision Template (output) ---

export type AdmissionDecision = "admit" | "defer" | "block";

export interface CtoAdmissionDecisionTemplate {
  schema_version: 1;
  feature_slug: string;
  decision: AdmissionDecision | null; // null = not yet decided
  decision_reason: string | null;
  decided_by: string | null;
  decided_at: string | null; // ISO-8601
  dependency_blocked: boolean;
  scope_conflict_detected: boolean;
  admit_conditions: string[];
  defer_conditions: string[];
  block_conditions: string[];
}

// --- Build Result ---

export type BuildOutcome = "admitted" | "deferred" | "blocked" | "build_failed";

export interface PacketBuildResult {
  outcome: BuildOutcome;
  request: CtoAdmissionRequest | null;
  decision_template: CtoAdmissionDecisionTemplate | null;
  summary_md: string | null;
  build_latency_ms: number;
  validation_errors: string[];
  kpi_snapshot: KpiSnapshot;
}

// --- KPI Types ---

export interface KpiSnapshot {
  admission_packet_build_latency_ms: number;
  admission_packets_built_count: number;
  admission_packets_admitted_count: number;
  admission_packets_deferred_count: number;
  admission_packets_blocked_count: number;
  missing_required_input_count: number;
  dependency_blocked_count: number;
  scope_conflict_detected_count: number;
  admission_source_metadata_completeness_rate: number;
  requirement_to_packet_parity_count: number;
  partition: "production" | "proof";
}

export interface LatencyBuckets {
  over_1s: number;
  over_10s: number;
  over_60s: number;
}

// --- Build Options ---

export interface PacketBuildOptions {
  partition?: "production" | "proof";
  dependency_blocked_override?: boolean;
  scope_conflict_override?: boolean;
}
