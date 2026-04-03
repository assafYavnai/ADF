/**
 * COO -> CTO Admission Packet Builder — Main Builder
 *
 * Reads a finalized requirement artifact, validates it, and produces:
 * - cto-admission-request.json
 * - cto-admission-decision.template.json
 * - cto-admission-summary.md
 */

import type {
  FinalizedRequirementArtifact,
  CtoAdmissionRequest,
  CtoAdmissionDecisionTemplate,
  AdmissionDecision,
  PacketBuildResult,
  PacketBuildOptions,
} from "./types.js";
import { validateRequirementArtifact, computeMetadataCompleteness } from "./validate.js";
import { AdmissionKpiTracker } from "./kpi.js";
import { renderAdmissionSummary } from "./render-summary.js";

export function buildAdmissionPacket(
  input: unknown,
  options: PacketBuildOptions = {}
): PacketBuildResult {
  const startMs = Date.now();
  const partition = options.partition ?? "production";
  const tracker = new AdmissionKpiTracker(partition);

  // Validate input
  const validation = validateRequirementArtifact(input);
  if (!validation.valid || !validation.parsed) {
    const latencyMs = Date.now() - startMs;
    tracker.recordBuild("build_failed", latencyMs, 0, {
      validationErrors: validation.errors,
    });
    return {
      outcome: "build_failed",
      request: null,
      decision_template: null,
      summary_md: null,
      build_latency_ms: latencyMs,
      validation_errors: validation.errors,
      kpi_snapshot: tracker.snapshot(),
    };
  }

  const req = validation.parsed;
  const completeness = computeMetadataCompleteness(input as Record<string, unknown>);

  // Determine dependency-blocked and scope-conflict states
  const dependencyBlocked =
    options.dependency_blocked_override ??
    req.suggested_execution_mode === "dependency-blocked";

  const scopeConflict = options.scope_conflict_override ?? false;

  // Determine pre-decision from input signals
  let preDecision: AdmissionDecision | null = null;
  const admitConditions: string[] = [];
  const deferConditions: string[] = [];
  const blockConditions: string[] = [];

  if (dependencyBlocked) {
    blockConditions.push("Dependency blocked: suggested_execution_mode is dependency-blocked");
  }
  if (scopeConflict) {
    blockConditions.push("Scope conflict detected");
  }
  if (req.business_priority === "low") {
    deferConditions.push("Business priority is low — consider deferring");
  }
  if (req.business_priority === "critical" || req.business_priority === "high") {
    admitConditions.push(`Business priority is ${req.business_priority}`);
  }
  if (req.claimed_scope_paths.length > 0) {
    admitConditions.push("Scope paths are claimed and non-empty");
  }
  if (completeness.completeness_rate >= 1.0) {
    admitConditions.push("Source metadata is complete");
  }

  // Auto-resolve decision when signals are unambiguous
  if (dependencyBlocked || scopeConflict) {
    preDecision = "block";
  } else if (blockConditions.length > 0) {
    preDecision = "block";
  } else if (deferConditions.length > 0 && admitConditions.length === 0) {
    preDecision = "defer";
  }
  // Otherwise leave null for manual decision

  const buildLatencyMs = Date.now() - startMs;

  // Build request
  const request: CtoAdmissionRequest = {
    schema_version: 1,
    feature_slug: req.feature_slug,
    requirement_artifact_source: req.requirement_artifact_source,
    business_priority: req.business_priority,
    claimed_scope_paths: req.claimed_scope_paths,
    non_goals: req.non_goals,
    boundaries: req.boundaries,
    sequencing_hint: req.sequencing_hint,
    dependency_notes: req.dependency_notes,
    conflict_notes: req.conflict_notes,
    suggested_execution_mode: req.suggested_execution_mode,
    requirement_summary: req.requirement_summary,
    source_frozen_at: req.frozen_at,
    packet_built_at: new Date().toISOString(),
    build_latency_ms: buildLatencyMs,
    source_metadata_completeness: completeness,
    partition,
  };

  // Build decision template
  const decisionTemplate: CtoAdmissionDecisionTemplate = {
    schema_version: 1,
    feature_slug: req.feature_slug,
    decision: preDecision,
    decision_reason: preDecision
      ? `Auto-resolved: ${preDecision === "block" ? blockConditions.join("; ") : deferConditions.join("; ")}`
      : null,
    decided_by: preDecision ? "packet-builder-auto" : null,
    decided_at: preDecision ? new Date().toISOString() : null,
    dependency_blocked: dependencyBlocked,
    scope_conflict_detected: scopeConflict,
    admit_conditions: admitConditions,
    defer_conditions: deferConditions,
    block_conditions: blockConditions,
  };

  // Determine outcome
  let outcome: "admitted" | "deferred" | "blocked";
  if (preDecision === "block") {
    outcome = "blocked";
  } else if (preDecision === "defer") {
    outcome = "deferred";
  } else {
    outcome = "admitted";
  }

  tracker.recordBuild(outcome, buildLatencyMs, completeness.completeness_rate, {
    dependencyBlocked,
    scopeConflict,
  });

  const kpiSnapshot = tracker.snapshot();

  // Render summary
  const summaryMd = renderAdmissionSummary(request, decisionTemplate, kpiSnapshot);

  return {
    outcome,
    request,
    decision_template: decisionTemplate,
    summary_md: summaryMd,
    build_latency_ms: buildLatencyMs,
    validation_errors: [],
    kpi_snapshot: kpiSnapshot,
  };
}
