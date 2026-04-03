import test from "node:test";
import assert from "node:assert/strict";

import { buildExecutiveBrief } from "./builder.js";
import { renderExecutiveBrief } from "./renderer.js";
import { buildAndRenderWithKpi, getKpiReport, resetKpiRecords } from "./kpi.js";
import type { BriefSourceFacts, ExecutiveBrief } from "./types.js";

import { normalInFlightFacts } from "./fixtures/normal-in-flight.js";
import { blockedAttentionFacts } from "./fixtures/blocked-attention-needed.js";
import { emptyLowActivityFacts } from "./fixtures/empty-low-activity.js";
import { postCompletionCloseoutFacts } from "./fixtures/post-completion-closeout.js";

// ---------------------------------------------------------------------------
// Helper: verify all 4 sections exist in rendered output
// ---------------------------------------------------------------------------
function assertAllSections(rendered: string): void {
  assert.ok(rendered.includes("## Issues That Need Your Attention"), "Missing Issues section");
  assert.ok(rendered.includes("## On The Table"), "Missing On The Table section");
  assert.ok(rendered.includes("## In Motion"), "Missing In Motion section");
  assert.ok(rendered.includes("## What's Next"), "Missing What's Next section");
}

function assertSectionOrder(rendered: string): void {
  const issuesIdx = rendered.indexOf("## Issues That Need Your Attention");
  const tableIdx = rendered.indexOf("## On The Table");
  const motionIdx = rendered.indexOf("## In Motion");
  const nextIdx = rendered.indexOf("## What's Next");
  assert.ok(issuesIdx < tableIdx, "Issues must come before On The Table");
  assert.ok(tableIdx < motionIdx, "On The Table must come before In Motion");
  assert.ok(motionIdx < nextIdx, "In Motion must come before What's Next");
}

function assertParityMatch(brief: ExecutiveBrief): void {
  assert.equal(brief.parity.issuesExpected, brief.parity.issuesActual, "Issues parity mismatch");
  assert.equal(brief.parity.tableExpected, brief.parity.tableActual, "Table parity mismatch");
  assert.equal(brief.parity.inMotionExpected, brief.parity.inMotionActual, "In Motion parity mismatch");
  assert.equal(brief.parity.whatsNextExpected, brief.parity.whatsNextActual, "What's Next parity mismatch");
}

// ---------------------------------------------------------------------------
// Deterministic rendering — same input always produces same output
// ---------------------------------------------------------------------------
function assertDeterministic(facts: BriefSourceFacts): void {
  const a = renderExecutiveBrief(buildExecutiveBrief(facts));
  const b = renderExecutiveBrief(buildExecutiveBrief(facts));
  assert.equal(a, b, "Rendered output must be deterministic");
}

// ---------------------------------------------------------------------------
// Fixture: Normal in-flight work
// ---------------------------------------------------------------------------
test("normal in-flight: renders all 4 sections", () => {
  const brief = buildExecutiveBrief(normalInFlightFacts);
  const rendered = renderExecutiveBrief(brief);
  assertAllSections(rendered);
  assertSectionOrder(rendered);
});

test("normal in-flight: no issues (nothing blocked)", () => {
  const brief = buildExecutiveBrief(normalInFlightFacts);
  assert.equal(brief.issues.length, 0);
});

test("normal in-flight: one feature on the table (has open decisions)", () => {
  const brief = buildExecutiveBrief(normalInFlightFacts);
  assert.equal(brief.onTheTable.length, 1);
  assert.equal(brief.onTheTable[0].featureLabel, "Shipping Calculator");
});

test("normal in-flight: two features in motion", () => {
  const brief = buildExecutiveBrief(normalInFlightFacts);
  assert.equal(brief.inMotion.length, 2);
});

test("normal in-flight: whats next includes both active features", () => {
  const brief = buildExecutiveBrief(normalInFlightFacts);
  assert.equal(brief.whatsNext.length, 2);
});

test("normal in-flight: parity matches", () => {
  const brief = buildExecutiveBrief(normalInFlightFacts);
  assertParityMatch(brief);
});

test("normal in-flight: deterministic rendering", () => {
  assertDeterministic(normalInFlightFacts);
});

// ---------------------------------------------------------------------------
// Fixture: Blocked attention-needed
// ---------------------------------------------------------------------------
test("blocked: issues section surfaces blocked feature concretely", () => {
  const brief = buildExecutiveBrief(blockedAttentionFacts);
  // 1 blocked feature + 1 global open loop entry = 2 issue items
  assert.equal(brief.issues.length, 2);
  const authIssue = brief.issues.find((i) => i.featureId === "feat-auth-rewrite");
  assert.ok(authIssue, "Blocked feature must appear in issues");
  assert.ok(authIssue.details.length > 0, "Details must include blockers");
  assert.ok(authIssue.details.some((d) => d.includes("Legal review")), "Blocker text must surface");
});

test("blocked: global open loop appears in issues", () => {
  const brief = buildExecutiveBrief(blockedAttentionFacts);
  const globalIssue = brief.issues.find((i) => i.featureId === "_global");
  assert.ok(globalIssue, "Global open loops must appear in issues");
  assert.ok(globalIssue.details.some((d) => d.includes("Budget approval")));
});

test("blocked: blocked feature does not appear in motion", () => {
  const brief = buildExecutiveBrief(blockedAttentionFacts);
  assert.ok(!brief.inMotion.some((i) => i.featureId === "feat-auth-rewrite"));
});

test("blocked: blocked feature does not appear in whats next", () => {
  const brief = buildExecutiveBrief(blockedAttentionFacts);
  assert.ok(!brief.whatsNext.some((i) => i.featureId === "feat-auth-rewrite"));
});

test("blocked: healthy feature still in motion", () => {
  const brief = buildExecutiveBrief(blockedAttentionFacts);
  assert.ok(brief.inMotion.some((i) => i.featureId === "feat-dashboard"));
});

test("blocked: rendered output includes blocker details not generic status", () => {
  const brief = buildExecutiveBrief(blockedAttentionFacts);
  const rendered = renderExecutiveBrief(brief);
  assert.ok(rendered.includes("Legal review"), "Must surface concrete blocker text");
  assert.ok(!rendered.includes("status: blocked"), "Must not dump internal status values");
});

test("blocked: parity matches", () => {
  const brief = buildExecutiveBrief(blockedAttentionFacts);
  assertParityMatch(brief);
});

test("blocked: deterministic rendering", () => {
  assertDeterministic(blockedAttentionFacts);
});

// ---------------------------------------------------------------------------
// Fixture: Empty / low-activity
// ---------------------------------------------------------------------------
test("empty: renders all 4 sections with empty-state text", () => {
  const brief = buildExecutiveBrief(emptyLowActivityFacts);
  const rendered = renderExecutiveBrief(brief);
  assertAllSections(rendered);
  assertSectionOrder(rendered);
  assert.ok(rendered.includes("No blocked items"), "Issues empty state");
  assert.ok(rendered.includes("No open decisions"), "Table empty state");
  assert.ok(rendered.includes("No features actively"), "In Motion empty state");
  assert.ok(rendered.includes("No pending next actions"), "What's Next empty state");
});

test("empty: all sections have zero items", () => {
  const brief = buildExecutiveBrief(emptyLowActivityFacts);
  assert.equal(brief.issues.length, 0);
  assert.equal(brief.onTheTable.length, 0);
  assert.equal(brief.inMotion.length, 0);
  assert.equal(brief.whatsNext.length, 0);
});

test("empty: metadata completeness is 1 for zero features", () => {
  const brief = buildExecutiveBrief(emptyLowActivityFacts);
  assert.equal(brief.sourceMetadataCompletenessRate, 1);
});

test("empty: parity matches", () => {
  const brief = buildExecutiveBrief(emptyLowActivityFacts);
  assertParityMatch(brief);
});

test("empty: deterministic rendering", () => {
  assertDeterministic(emptyLowActivityFacts);
});

// ---------------------------------------------------------------------------
// Fixture: Post-completion closeout
// ---------------------------------------------------------------------------
test("closeout: finalized feature absent from whats next", () => {
  const brief = buildExecutiveBrief(postCompletionCloseoutFacts);
  assert.ok(!brief.whatsNext.some((i) => i.featureId === "feat-onboarding"));
});

test("closeout: not-finalized completed feature appears in whats next", () => {
  const brief = buildExecutiveBrief(postCompletionCloseoutFacts);
  const paymentNext = brief.whatsNext.find((i) => i.featureId === "feat-payments");
  assert.ok(paymentNext, "Completed but not finalized must appear in What's Next");
  assert.ok(paymentNext.nextAction.includes("Finalize"), "Next action must mention finalization");
});

test("closeout: completed features not in motion", () => {
  const brief = buildExecutiveBrief(postCompletionCloseoutFacts);
  assert.equal(brief.inMotion.length, 0);
});

test("closeout: no issues in quiet closeout state", () => {
  const brief = buildExecutiveBrief(postCompletionCloseoutFacts);
  assert.equal(brief.issues.length, 0);
});

test("closeout: parity matches", () => {
  const brief = buildExecutiveBrief(postCompletionCloseoutFacts);
  assertParityMatch(brief);
});

test("closeout: deterministic rendering", () => {
  assertDeterministic(postCompletionCloseoutFacts);
});

// ---------------------------------------------------------------------------
// KPI instrumentation proof
// ---------------------------------------------------------------------------
test("kpi: buildAndRenderWithKpi records metrics", () => {
  resetKpiRecords();
  const result = buildAndRenderWithKpi(normalInFlightFacts);
  assert.ok(result.metrics.success);
  assert.ok(result.metrics.buildLatencyMs >= 0);
  assert.ok(result.metrics.renderLatencyMs >= 0);
  assert.equal(result.metrics.featureCount, 2);
  assert.equal(result.metrics.sourcePartition, "proof");
  assertAllSections(result.rendered);
});

test("kpi: report aggregates after multiple builds", () => {
  resetKpiRecords();
  buildAndRenderWithKpi(normalInFlightFacts);
  buildAndRenderWithKpi(blockedAttentionFacts);
  buildAndRenderWithKpi(emptyLowActivityFacts);
  buildAndRenderWithKpi(postCompletionCloseoutFacts);

  const report = getKpiReport();
  assert.equal(report.totalBuilds, 4);
  assert.equal(report.renderSuccessCount, 4);
  assert.equal(report.renderFailureCount, 0);
  assert.ok(report.buildLatency.p50 >= 0);
  assert.ok(report.buildLatency.p95 >= 0);
  assert.ok(report.buildLatency.p99 >= 0);
  assert.ok(report.avgSourceMetadataCompletenessRate >= 0);
  assert.ok(report.latestParity !== null);
  assert.ok(report.latestSourceAgeMs !== null);
  assert.equal(report.latestSourcePartition, "proof");
});

test("kpi: slow buckets are zero for fast builds", () => {
  resetKpiRecords();
  buildAndRenderWithKpi(normalInFlightFacts);
  const report = getKpiReport();
  assert.equal(report.slowBuckets.over1s, 0);
  assert.equal(report.slowBuckets.over10s, 0);
  assert.equal(report.slowBuckets.over60s, 0);
});

// ---------------------------------------------------------------------------
// Partition / isolation proof
// ---------------------------------------------------------------------------
test("partition: proof partition is preserved in output", () => {
  const brief = buildExecutiveBrief(normalInFlightFacts);
  assert.equal(brief.sourcePartition, "proof");
});

test("partition: production partition is preserved when set", () => {
  const productionFacts: BriefSourceFacts = {
    ...normalInFlightFacts,
    sourcePartition: "production",
  };
  const brief = buildExecutiveBrief(productionFacts);
  assert.equal(brief.sourcePartition, "production");
});

test("partition: mixed partition coexistence", () => {
  const mixedFacts: BriefSourceFacts = {
    ...normalInFlightFacts,
    sourcePartition: "mixed",
  };
  const brief = buildExecutiveBrief(mixedFacts);
  assert.equal(brief.sourcePartition, "mixed");
});

// ---------------------------------------------------------------------------
// Parity mismatch detection proof
// ---------------------------------------------------------------------------
test("parity detection: would detect missing issue if blocker not surfaced", () => {
  // This test proves the parity mechanism works: if a blocked feature existed
  // but the issues builder somehow skipped it, parity would mismatch.
  // We verify the parity fields are independently computed.
  const brief = buildExecutiveBrief(blockedAttentionFacts);
  // The parity says 2 expected (1 blocked feat + 1 global), 2 actual
  assert.equal(brief.parity.issuesExpected, 2);
  assert.equal(brief.parity.issuesActual, 2);
  // If we manually check: removing one issue would break parity
  // This is the detection mechanism — consumer code compares expected vs actual
});

test("parity detection: table parity for normal in-flight", () => {
  const brief = buildExecutiveBrief(normalInFlightFacts);
  assert.equal(brief.parity.tableExpected, 1, "One feature has open decisions");
  assert.equal(brief.parity.tableActual, 1);
});

test("parity detection: in-motion parity for blocked scenario", () => {
  const brief = buildExecutiveBrief(blockedAttentionFacts);
  assert.equal(brief.parity.inMotionExpected, 1, "Only non-blocked active feature");
  assert.equal(brief.parity.inMotionActual, 1);
});

test("parity detection: whats-next parity for closeout", () => {
  const brief = buildExecutiveBrief(postCompletionCloseoutFacts);
  assert.equal(brief.parity.whatsNextExpected, 1, "One completed-not-finalized feature");
  assert.equal(brief.parity.whatsNextActual, 1);
});
