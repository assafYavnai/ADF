/**
 * COO -> CTO Admission Packet Builder — Summary Renderer
 *
 * Renders a Markdown summary of the admission request and decision template.
 */

import type {
  CtoAdmissionRequest,
  CtoAdmissionDecisionTemplate,
  KpiSnapshot,
} from "./types.js";

export function renderAdmissionSummary(
  request: CtoAdmissionRequest,
  decisionTemplate: CtoAdmissionDecisionTemplate,
  kpi: KpiSnapshot
): string {
  const lines: string[] = [];

  lines.push(`# CTO Admission Summary: ${request.feature_slug}`);
  lines.push("");
  lines.push(`## Request`);
  lines.push("");
  lines.push(`- **Feature slug:** ${request.feature_slug}`);
  lines.push(`- **Requirement source:** ${request.requirement_artifact_source}`);
  lines.push(`- **Business priority:** ${request.business_priority}`);
  lines.push(`- **Sequencing hint:** ${request.sequencing_hint}`);
  lines.push(`- **Execution mode:** ${request.suggested_execution_mode}`);
  lines.push(`- **Source frozen at:** ${request.source_frozen_at}`);
  lines.push(`- **Packet built at:** ${request.packet_built_at}`);
  lines.push(`- **Build latency:** ${request.build_latency_ms}ms`);
  lines.push(`- **Partition:** ${request.partition}`);
  lines.push("");

  lines.push(`### Claimed Scope`);
  lines.push("");
  for (const p of request.claimed_scope_paths) {
    lines.push(`- \`${p}\``);
  }
  lines.push("");

  lines.push(`### Non-Goals`);
  lines.push("");
  if (request.non_goals.length === 0) {
    lines.push("None.");
  } else {
    for (const ng of request.non_goals) {
      lines.push(`- ${ng}`);
    }
  }
  lines.push("");

  lines.push(`### Boundaries`);
  lines.push("");
  if (request.boundaries.length === 0) {
    lines.push("None.");
  } else {
    for (const b of request.boundaries) {
      lines.push(`- ${b}`);
    }
  }
  lines.push("");

  lines.push(`### Dependency Notes`);
  lines.push("");
  if (request.dependency_notes.length === 0) {
    lines.push("None.");
  } else {
    for (const d of request.dependency_notes) {
      lines.push(`- ${d}`);
    }
  }
  lines.push("");

  lines.push(`### Conflict Notes`);
  lines.push("");
  if (request.conflict_notes.length === 0) {
    lines.push("None.");
  } else {
    for (const c of request.conflict_notes) {
      lines.push(`- ${c}`);
    }
  }
  lines.push("");

  lines.push(`### Requirement Summary`);
  lines.push("");
  lines.push(request.requirement_summary);
  lines.push("");

  lines.push(`### Source Metadata Completeness`);
  lines.push("");
  lines.push(`- **Total fields:** ${request.source_metadata_completeness.total_fields}`);
  lines.push(`- **Present fields:** ${request.source_metadata_completeness.present_fields}`);
  lines.push(`- **Completeness rate:** ${(request.source_metadata_completeness.completeness_rate * 100).toFixed(1)}%`);
  if (request.source_metadata_completeness.missing_fields.length > 0) {
    lines.push(`- **Missing:** ${request.source_metadata_completeness.missing_fields.join(", ")}`);
  }
  lines.push("");

  lines.push(`## Decision Template`);
  lines.push("");
  lines.push(`- **Decision:** ${decisionTemplate.decision ?? "pending"}`);
  lines.push(`- **Dependency blocked:** ${decisionTemplate.dependency_blocked}`);
  lines.push(`- **Scope conflict detected:** ${decisionTemplate.scope_conflict_detected}`);
  lines.push("");

  if (decisionTemplate.admit_conditions.length > 0) {
    lines.push(`### Admit Conditions`);
    lines.push("");
    for (const c of decisionTemplate.admit_conditions) {
      lines.push(`- ${c}`);
    }
    lines.push("");
  }

  if (decisionTemplate.defer_conditions.length > 0) {
    lines.push(`### Defer Conditions`);
    lines.push("");
    for (const c of decisionTemplate.defer_conditions) {
      lines.push(`- ${c}`);
    }
    lines.push("");
  }

  if (decisionTemplate.block_conditions.length > 0) {
    lines.push(`### Block Conditions`);
    lines.push("");
    for (const c of decisionTemplate.block_conditions) {
      lines.push(`- ${c}`);
    }
    lines.push("");
  }

  lines.push(`## KPI Snapshot`);
  lines.push("");
  lines.push(`- **Build latency:** ${kpi.admission_packet_build_latency_ms}ms`);
  lines.push(`- **Packets built:** ${kpi.admission_packets_built_count}`);
  lines.push(`- **Admitted:** ${kpi.admission_packets_admitted_count}`);
  lines.push(`- **Deferred:** ${kpi.admission_packets_deferred_count}`);
  lines.push(`- **Blocked:** ${kpi.admission_packets_blocked_count}`);
  lines.push(`- **Missing input:** ${kpi.missing_required_input_count}`);
  lines.push(`- **Dependency blocked:** ${kpi.dependency_blocked_count}`);
  lines.push(`- **Scope conflict:** ${kpi.scope_conflict_detected_count}`);
  lines.push(`- **Metadata completeness rate:** ${(kpi.admission_source_metadata_completeness_rate * 100).toFixed(1)}%`);
  lines.push(`- **Requirement-to-packet parity:** ${kpi.requirement_to_packet_parity_count}`);
  lines.push(`- **Partition:** ${kpi.partition}`);
  lines.push("");

  return lines.join("\n");
}
