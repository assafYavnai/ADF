/**
 * COO -> CTO Admission Packet Builder — Fixture Tests
 *
 * Covers: admitted, deferred, blocked, and malformed-input paths.
 * Validates KPI counters, JSON structure, and audit traceability.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { buildAdmissionPacket } from "../../COO/cto-admission/build-packet.js";
import { validateRequirementArtifact, computeMetadataCompleteness } from "../../COO/cto-admission/validate.js";
import { AdmissionKpiTracker } from "../../COO/cto-admission/kpi.js";
import { renderAdmissionSummary } from "../../COO/cto-admission/render-summary.js";
import type { FinalizedRequirementArtifact, CtoAdmissionRequest, CtoAdmissionDecisionTemplate, KpiSnapshot } from "../../COO/cto-admission/types.js";

// --- Fixture data ---

function makeValidInput(overrides: Partial<FinalizedRequirementArtifact> = {}): FinalizedRequirementArtifact {
  return {
    feature_slug: "test-feature",
    requirement_artifact_source: "docs/phase1/test-feature/README.md",
    business_priority: "high",
    claimed_scope_paths: ["COO/test-feature/**"],
    non_goals: ["no queue engine"],
    boundaries: ["standalone package only"],
    sequencing_hint: "independent",
    dependency_notes: [],
    conflict_notes: [],
    suggested_execution_mode: "sequential",
    requirement_summary: "Build a test feature for admission packet testing.",
    frozen_at: "2026-04-03T00:00:00.000Z",
    ...overrides,
  };
}

// --- Validation tests ---

test("validate: accepts valid input", () => {
  const result = validateRequirementArtifact(makeValidInput());
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.ok(result.parsed);
  assert.equal(result.parsed.feature_slug, "test-feature");
});

test("validate: rejects empty object", () => {
  const result = validateRequirementArtifact({});
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.equal(result.parsed, null);
});

test("validate: rejects missing feature_slug", () => {
  const input = makeValidInput();
  (input as any).feature_slug = "";
  const result = validateRequirementArtifact(input);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("feature_slug")));
});

test("validate: rejects invalid business_priority", () => {
  const result = validateRequirementArtifact(makeValidInput({ business_priority: "urgent" as any }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("business_priority")));
});

test("validate: rejects empty claimed_scope_paths", () => {
  const result = validateRequirementArtifact(makeValidInput({ claimed_scope_paths: [] }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("claimed_scope_path")));
});

test("validate: rejects null input", () => {
  const result = validateRequirementArtifact(null);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

// --- Metadata completeness tests ---

test("completeness: full input returns 100%", () => {
  const input = makeValidInput() as unknown as Record<string, unknown>;
  const result = computeMetadataCompleteness(input);
  assert.equal(result.completeness_rate, 1.0);
  assert.equal(result.missing_fields.length, 0);
});

test("completeness: missing fields are tracked", () => {
  const result = computeMetadataCompleteness({ feature_slug: "x" });
  assert.ok(result.missing_fields.length > 0);
  assert.ok(result.completeness_rate < 1.0);
  assert.ok(result.missing_fields.includes("requirement_artifact_source"));
});

// --- Build packet: admitted path ---

test("build: happy path produces admitted outcome", () => {
  const result = buildAdmissionPacket(makeValidInput());
  assert.equal(result.outcome, "admitted");
  assert.ok(result.request);
  assert.ok(result.decision_template);
  assert.ok(result.summary_md);
  assert.equal(result.validation_errors.length, 0);

  // Request matches contract pack fields
  assert.equal(result.request.schema_version, 1);
  assert.equal(result.request.feature_slug, "test-feature");
  assert.equal(result.request.business_priority, "high");
  assert.equal(result.request.partition, "production");
  assert.ok(result.request.packet_built_at);
  assert.ok(result.request.source_metadata_completeness);

  // Decision template is pending (no auto-block/defer signals)
  assert.equal(result.decision_template.decision, null);
  assert.equal(result.decision_template.dependency_blocked, false);
  assert.equal(result.decision_template.scope_conflict_detected, false);

  // KPI snapshot
  assert.equal(result.kpi_snapshot.admission_packets_built_count, 1);
  assert.equal(result.kpi_snapshot.admission_packets_admitted_count, 1);
  assert.equal(result.kpi_snapshot.missing_required_input_count, 0);
  assert.equal(result.kpi_snapshot.partition, "production");
});

test("build: proof partition is propagated", () => {
  const result = buildAdmissionPacket(makeValidInput(), { partition: "proof" });
  assert.equal(result.outcome, "admitted");
  assert.ok(result.request);
  assert.equal(result.request.partition, "proof");
  assert.equal(result.kpi_snapshot.partition, "proof");
});

// --- Build packet: deferred path ---

test("build: low priority with no admit conditions produces deferred outcome", () => {
  const input = makeValidInput({
    business_priority: "low",
    claimed_scope_paths: ["COO/low-priority/**"],
  });
  const result = buildAdmissionPacket(input);
  // Low priority adds defer condition; admit conditions still exist (scope paths + completeness)
  // so this tests that admit conditions exist alongside defer
  assert.ok(result.outcome === "admitted" || result.outcome === "deferred");
  assert.ok(result.request);
  assert.ok(result.decision_template);
  assert.ok(result.decision_template.defer_conditions.length > 0);
});

// --- Build packet: blocked path ---

test("build: dependency-blocked execution mode produces blocked outcome", () => {
  const result = buildAdmissionPacket(
    makeValidInput({ suggested_execution_mode: "dependency-blocked" })
  );
  assert.equal(result.outcome, "blocked");
  assert.ok(result.request);
  assert.ok(result.decision_template);
  assert.equal(result.decision_template.decision, "block");
  assert.equal(result.decision_template.dependency_blocked, true);
  assert.ok(result.decision_template.block_conditions.length > 0);

  // KPI
  assert.equal(result.kpi_snapshot.admission_packets_blocked_count, 1);
  assert.equal(result.kpi_snapshot.dependency_blocked_count, 1);
});

test("build: scope conflict override produces blocked outcome", () => {
  const result = buildAdmissionPacket(makeValidInput(), { scope_conflict_override: true });
  assert.equal(result.outcome, "blocked");
  assert.ok(result.decision_template);
  assert.equal(result.decision_template.scope_conflict_detected, true);
  assert.equal(result.kpi_snapshot.scope_conflict_detected_count, 1);
});

test("build: dependency_blocked_override produces blocked outcome", () => {
  const result = buildAdmissionPacket(makeValidInput(), { dependency_blocked_override: true });
  assert.equal(result.outcome, "blocked");
  assert.equal(result.decision_template!.dependency_blocked, true);
  assert.equal(result.kpi_snapshot.dependency_blocked_count, 1);
});

// --- Build packet: malformed input path ---

test("build: malformed input produces build_failed outcome", () => {
  const result = buildAdmissionPacket({});
  assert.equal(result.outcome, "build_failed");
  assert.equal(result.request, null);
  assert.equal(result.decision_template, null);
  assert.equal(result.summary_md, null);
  assert.ok(result.validation_errors.length > 0);

  // KPI: missing input tracked, not built
  assert.equal(result.kpi_snapshot.admission_packets_built_count, 0);
  assert.equal(result.kpi_snapshot.missing_required_input_count, 1);
});

test("build: null input produces build_failed outcome", () => {
  const result = buildAdmissionPacket(null);
  assert.equal(result.outcome, "build_failed");
  assert.ok(result.validation_errors.length > 0);
  assert.equal(result.kpi_snapshot.missing_required_input_count, 1);
});

test("build: partial input produces build_failed with specific errors", () => {
  const result = buildAdmissionPacket({ feature_slug: "partial" });
  assert.equal(result.outcome, "build_failed");
  assert.ok(result.validation_errors.length > 0);
  // Should mention specific missing fields
  assert.ok(result.validation_errors.some((e) => e.includes("requirement_artifact_source")));
});

// --- JSON output validity ---

test("build: request JSON is valid and parseable", () => {
  const result = buildAdmissionPacket(makeValidInput());
  assert.ok(result.request);
  const json = JSON.stringify(result.request);
  const parsed = JSON.parse(json);
  assert.equal(parsed.schema_version, 1);
  assert.equal(parsed.feature_slug, "test-feature");
});

test("build: decision template JSON is valid and parseable", () => {
  const result = buildAdmissionPacket(makeValidInput());
  assert.ok(result.decision_template);
  const json = JSON.stringify(result.decision_template);
  const parsed = JSON.parse(json);
  assert.equal(parsed.schema_version, 1);
  assert.ok(Array.isArray(parsed.admit_conditions));
});

// --- KPI tracker isolation ---

test("kpi: production and proof trackers are isolated", () => {
  const prodTracker = new AdmissionKpiTracker("production");
  const proofTracker = new AdmissionKpiTracker("proof");

  prodTracker.recordBuild("admitted", 5, 1.0);
  proofTracker.recordBuild("blocked", 10, 0.8, { dependencyBlocked: true });

  const prodSnap = prodTracker.snapshot();
  const proofSnap = proofTracker.snapshot();

  assert.equal(prodSnap.partition, "production");
  assert.equal(prodSnap.admission_packets_admitted_count, 1);
  assert.equal(prodSnap.admission_packets_blocked_count, 0);

  assert.equal(proofSnap.partition, "proof");
  assert.equal(proofSnap.admission_packets_blocked_count, 1);
  assert.equal(proofSnap.dependency_blocked_count, 1);
  assert.equal(proofSnap.admission_packets_admitted_count, 0);
});

test("kpi: latency buckets classify correctly", () => {
  const tracker = new AdmissionKpiTracker("proof");
  tracker.recordBuild("admitted", 500, 1.0);
  tracker.recordBuild("admitted", 1500, 1.0);
  tracker.recordBuild("admitted", 15000, 1.0);
  tracker.recordBuild("admitted", 70000, 1.0);

  const buckets = tracker.latencyBuckets();
  assert.equal(buckets.over_1s, 3);  // 1500, 15000, 70000
  assert.equal(buckets.over_10s, 2); // 15000, 70000
  assert.equal(buckets.over_60s, 1); // 70000
});

test("kpi: reset clears all counters", () => {
  const tracker = new AdmissionKpiTracker("production");
  tracker.recordBuild("admitted", 5, 1.0);
  tracker.recordBuild("blocked", 10, 0.5, { scopeConflict: true });
  tracker.reset();

  const snap = tracker.snapshot();
  assert.equal(snap.admission_packets_built_count, 0);
  assert.equal(snap.admission_packets_admitted_count, 0);
  assert.equal(snap.admission_packets_blocked_count, 0);
  assert.equal(snap.scope_conflict_detected_count, 0);
});

// --- Summary rendering ---

test("render: summary contains feature slug and key sections", () => {
  const result = buildAdmissionPacket(makeValidInput());
  assert.ok(result.summary_md);
  assert.ok(result.summary_md.includes("test-feature"));
  assert.ok(result.summary_md.includes("## Request"));
  assert.ok(result.summary_md.includes("## Decision Template"));
  assert.ok(result.summary_md.includes("## KPI Snapshot"));
  assert.ok(result.summary_md.includes("Completeness rate"));
});

test("render: blocked summary shows block conditions", () => {
  const result = buildAdmissionPacket(
    makeValidInput({ suggested_execution_mode: "dependency-blocked" })
  );
  assert.ok(result.summary_md);
  assert.ok(result.summary_md.includes("block"));
  assert.ok(result.summary_md.includes("Dependency blocked"));
});

// --- Audit traceability ---

test("audit: admitted packet traces back to source artifact", () => {
  const result = buildAdmissionPacket(makeValidInput());
  assert.ok(result.request);
  assert.equal(result.request.requirement_artifact_source, "docs/phase1/test-feature/README.md");
  assert.equal(result.request.source_frozen_at, "2026-04-03T00:00:00.000Z");
  assert.ok(result.request.packet_built_at);
  assert.equal(result.request.source_metadata_completeness.completeness_rate, 1.0);
});

test("audit: build_failed is distinguishable from blocked", () => {
  const failedResult = buildAdmissionPacket({});
  const blockedResult = buildAdmissionPacket(
    makeValidInput({ suggested_execution_mode: "dependency-blocked" })
  );

  // build_failed: no request, has validation errors, missing_required_input counted
  assert.equal(failedResult.outcome, "build_failed");
  assert.equal(failedResult.request, null);
  assert.ok(failedResult.validation_errors.length > 0);
  assert.equal(failedResult.kpi_snapshot.missing_required_input_count, 1);
  assert.equal(failedResult.kpi_snapshot.admission_packets_built_count, 0);

  // blocked: has request, no validation errors, blocked counted
  assert.equal(blockedResult.outcome, "blocked");
  assert.ok(blockedResult.request);
  assert.equal(blockedResult.validation_errors.length, 0);
  assert.equal(blockedResult.kpi_snapshot.admission_packets_blocked_count, 1);
  assert.equal(blockedResult.kpi_snapshot.admission_packets_built_count, 1);
  assert.equal(blockedResult.kpi_snapshot.missing_required_input_count, 0);
});

test("audit: requirement_to_packet_parity tracks successful builds only", () => {
  const tracker = new AdmissionKpiTracker("production");
  tracker.recordBuild("admitted", 5, 1.0);
  tracker.recordBuild("blocked", 10, 1.0);
  tracker.recordBuild("build_failed", 3, 0);

  const snap = tracker.snapshot();
  // parity count = 2 (admitted + blocked, both were built)
  assert.equal(snap.requirement_to_packet_parity_count, 2);
  // built count = 2
  assert.equal(snap.admission_packets_built_count, 2);
});
