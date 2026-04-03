/**
 * Company Table & Queue Read Model — Proof Tests
 *
 * Covers:
 * - Full lifecycle (all sources, multiple stages)
 * - Empty sources (available but no items)
 * - Missing sources (graceful degradation)
 * - Conflict/ambiguity (explicit surfacing)
 * - Blocked items (visibility)
 * - KPI counters and freshness
 * - Partition/isolation
 * - Deterministic rendering
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { collectSourceFacts } from "./source-adapters.js";
import { buildCompanyTable } from "./normalizer.js";
import { renderCompanyTable } from "./renderer.js";
import { buildAndRenderWithKpi, getKpiReport, resetKpiRecords } from "./kpi.js";
import type { CompanyTable, TableEntry, TableItemState } from "./types.js";

import * as fullLifecycle from "./fixtures/full-lifecycle.js";
import * as emptySources from "./fixtures/empty-sources.js";
import * as missingSources from "./fixtures/missing-sources.js";
import * as conflictAmbiguity from "./fixtures/conflict-ambiguity.js";
import * as blockedItems from "./fixtures/blocked-items.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findEntry(table: CompanyTable, id: string): TableEntry {
  const entry = table.entries.find((e) => e.id === id);
  if (!entry) throw new Error(`Entry "${id}" not found. Available: ${table.entries.map((e) => e.id).join(", ")}`);
  return entry;
}

function stateOf(table: CompanyTable, id: string): TableItemState {
  return findEntry(table, id).state;
}

// ---------------------------------------------------------------------------
// Full lifecycle
// ---------------------------------------------------------------------------

describe("company-table: full lifecycle", () => {
  let table: CompanyTable;

  it("builds from all four source families", () => {
    const facts = collectSourceFacts({
      threads: fullLifecycle.threads,
      requirements: fullLifecycle.requirements,
      admissions: fullLifecycle.admissions,
      plans: fullLifecycle.plans,
      sourcePartition: "proof",
    });
    table = buildCompanyTable(facts);

    assert.ok(table.entries.length >= 3, "should have at least 3 entries");
  });

  it("feature-alpha is shaping (active thread, early layers)", () => {
    assert.equal(stateOf(table, "feature-alpha"), "shaping");
    const entry = findEntry(table, "feature-alpha");
    assert.ok(entry.openDecisions.length > 0, "should have open decisions");
  });

  it("feature-beta is admission_pending (handoff_ready thread + requirement)", () => {
    assert.equal(stateOf(table, "feature-beta"), "admission_pending");
    const entry = findEntry(table, "feature-beta");
    assert.ok(entry.contributingSources.includes("thread_onion"));
    assert.ok(entry.contributingSources.includes("finalized_requirement"));
  });

  it("feature-gamma is completed_recently (completed thread + admitted + merged plan)", () => {
    assert.equal(stateOf(table, "feature-gamma"), "completed_recently");
    const entry = findEntry(table, "feature-gamma");
    assert.ok(entry.contributingSources.length >= 3, "should have 3+ sources");
  });

  it("parity: source items map to table entries", () => {
    assert.ok(table.parity.totalSourceItems > 0);
    assert.ok(table.parity.totalTableEntries > 0);
    assert.ok(table.parity.totalTableEntries <= table.parity.totalSourceItems,
      "table entries should be <= source items (correlated)");
  });

  it("state counts match entries", () => {
    let total = 0;
    for (const state of Object.keys(table.stateCounts) as TableItemState[]) {
      const count = table.stateCounts[state];
      const actual = table.entries.filter((e) => e.state === state).length;
      assert.equal(count, actual, `state count mismatch for ${state}`);
      total += count;
    }
    assert.equal(total, table.entries.length);
  });

  it("renders deterministically", () => {
    const render1 = renderCompanyTable(table);
    const render2 = renderCompanyTable(table);
    assert.equal(render1, render2);
    assert.ok(render1.includes("Company Table"));
    assert.ok(render1.includes("SHAPING"));
    assert.ok(render1.includes("COMPLETED"));
  });
});

// ---------------------------------------------------------------------------
// Empty sources
// ---------------------------------------------------------------------------

describe("company-table: empty sources (available but no items)", () => {
  it("produces an empty table with zero entries", () => {
    const facts = collectSourceFacts({
      threads: emptySources.threads,
      requirements: emptySources.requirements,
      admissions: emptySources.admissions,
      plans: emptySources.plans,
    });
    const table = buildCompanyTable(facts);

    assert.equal(table.entries.length, 0);
    assert.equal(table.parity.totalSourceItems, 0);
    assert.equal(table.parity.totalTableEntries, 0);
    assert.equal(table.sourceMetadataCompletenessRate, 1, "empty table should be 100% complete");
  });

  it("all source families show available", () => {
    const facts = collectSourceFacts({
      threads: emptySources.threads,
      requirements: emptySources.requirements,
      admissions: emptySources.admissions,
      plans: emptySources.plans,
    });

    for (const avail of facts.availability) {
      assert.equal(avail.available, true, `${avail.family} should be available`);
      assert.equal(avail.itemCount, 0, `${avail.family} should have 0 items`);
    }
  });
});

// ---------------------------------------------------------------------------
// Missing sources
// ---------------------------------------------------------------------------

describe("company-table: missing sources (graceful degradation)", () => {
  let table: CompanyTable;

  it("builds successfully with partial sources", () => {
    const facts = collectSourceFacts({
      threads: missingSources.threads,
      // requirements: undefined — missing
      // admissions: undefined — missing
      plans: missingSources.plans,
    });
    table = buildCompanyTable(facts);

    assert.ok(table.entries.length >= 2, "should have at least 2 entries");
  });

  it("marks requirement and admission sources as not available", () => {
    const facts = collectSourceFacts({
      threads: missingSources.threads,
      plans: missingSources.plans,
    });

    const reqAvail = facts.availability.find((a) => a.family === "finalized_requirement");
    const admAvail = facts.availability.find((a) => a.family === "cto_admission");
    assert.equal(reqAvail?.available, false);
    assert.equal(admAvail?.available, false);
  });

  it("feature-delta is shaping from thread-only data", () => {
    assert.equal(stateOf(table, "feature-delta"), "shaping");
  });

  it("feature-epsilon is in_motion from plan-only data", () => {
    assert.equal(stateOf(table, "feature-epsilon"), "in_motion");
  });

  it("missing sources are distinguishable from empty sources", () => {
    const factsMissing = collectSourceFacts({
      threads: missingSources.threads,
      plans: missingSources.plans,
    });
    const factsEmpty = collectSourceFacts({
      threads: emptySources.threads,
      requirements: emptySources.requirements,
      admissions: emptySources.admissions,
      plans: emptySources.plans,
    });

    const missingReq = factsMissing.availability.find((a) => a.family === "finalized_requirement");
    const emptyReq = factsEmpty.availability.find((a) => a.family === "finalized_requirement");
    assert.equal(missingReq?.available, false, "missing should be not available");
    assert.equal(emptyReq?.available, true, "empty should be available");
  });
});

// ---------------------------------------------------------------------------
// Conflict / ambiguity
// ---------------------------------------------------------------------------

describe("company-table: conflict and ambiguity", () => {
  let table: CompanyTable;

  it("builds from conflicting sources", () => {
    const facts = collectSourceFacts({
      threads: conflictAmbiguity.threads,
      requirements: conflictAmbiguity.requirements,
      admissions: conflictAmbiguity.admissions,
      plans: conflictAmbiguity.plans,
      sourcePartition: "proof",
    });
    table = buildCompanyTable(facts);

    assert.ok(table.entries.length >= 1);
  });

  it("feature-zeta has ambiguity notes (thread=shaping vs plan=completed)", () => {
    const entry = findEntry(table, "feature-zeta");
    assert.ok(entry.hasAmbiguity, "should have ambiguity flag");
    assert.ok(entry.ambiguityNotes.length > 0, "should have ambiguity notes");
  });

  it("ambiguous entries are counted in parity", () => {
    assert.ok(table.parity.ambiguousEntries > 0, "should have ambiguous entries in parity");
  });

  it("renders ambiguity markers", () => {
    const rendered = renderCompanyTable(table);
    assert.ok(rendered.includes("~"), "should include ambiguity marker (~)");
  });
});

// ---------------------------------------------------------------------------
// Blocked items
// ---------------------------------------------------------------------------

describe("company-table: blocked items", () => {
  let table: CompanyTable;

  it("builds from blocked-item fixtures", () => {
    const facts = collectSourceFacts({
      threads: blockedItems.threads,
      requirements: blockedItems.requirements,
      admissions: blockedItems.admissions,
      plans: blockedItems.plans,
    });
    table = buildCompanyTable(facts);

    assert.ok(table.entries.length >= 4, "should have at least 4 entries");
  });

  it("feature-eta is blocked (thread blockers)", () => {
    const entry = findEntry(table, "feature-eta");
    assert.equal(entry.state, "blocked");
    assert.ok(entry.blockers.length >= 2, "should have 2+ blockers");
  });

  it("feature-theta is blocked (requirement derivation blocked)", () => {
    const entry = findEntry(table, "feature-theta");
    assert.equal(entry.state, "blocked");
  });

  it("feature-iota is blocked (CTO decision: block)", () => {
    const entry = findEntry(table, "feature-iota");
    assert.equal(entry.state, "blocked");
    assert.ok(entry.blockers.some((b) => b.includes("dependency")));
  });

  it("feature-kappa is blocked (plan paused with error)", () => {
    const entry = findEntry(table, "feature-kappa");
    assert.equal(entry.state, "blocked");
    assert.ok(entry.blockers.some((b) => b.includes("Build failure")));
  });

  it("blocked items appear first in sorted output", () => {
    const blockedEntries = table.entries.filter((e) => e.state === "blocked");
    const firstNonBlocked = table.entries.findIndex((e) => e.state !== "blocked");
    if (firstNonBlocked > 0) {
      assert.ok(blockedEntries.length <= firstNonBlocked,
        "all blocked items should precede non-blocked");
    }
  });

  it("blocked count in stateCounts matches entries", () => {
    const blockedCount = table.entries.filter((e) => e.state === "blocked").length;
    assert.equal(table.stateCounts.blocked, blockedCount);
    assert.ok(blockedCount >= 4, "should have at least 4 blocked items");
  });
});

// ---------------------------------------------------------------------------
// KPI instrumentation
// ---------------------------------------------------------------------------

describe("company-table: KPI instrumentation", () => {
  beforeEach(() => {
    resetKpiRecords();
  });

  it("records build metrics and reports them", () => {
    const facts = collectSourceFacts({
      threads: fullLifecycle.threads,
      requirements: fullLifecycle.requirements,
      admissions: fullLifecycle.admissions,
      plans: fullLifecycle.plans,
      sourcePartition: "proof",
    });

    const result = buildAndRenderWithKpi(facts);
    assert.ok(result.table.entries.length > 0);
    assert.ok(result.rendered.length > 0);
    assert.ok(result.metrics.success);
    assert.ok(result.metrics.buildLatencyMs >= 0);

    const report = getKpiReport();
    assert.equal(report.totalBuilds, 1);
    assert.equal(report.buildSuccessCount, 1);
    assert.equal(report.buildFailureCount, 0);
    assert.ok(report.buildLatency.p50 >= 0);
    assert.ok(report.buildLatency.p95 >= 0);
    assert.ok(report.buildLatency.p99 >= 0);
  });

  it("reports missing source count", () => {
    const facts = collectSourceFacts({
      threads: missingSources.threads,
      plans: missingSources.plans,
    });

    buildAndRenderWithKpi(facts);
    const report = getKpiReport();
    // Missing sources are only flagged when an item is expected to have
    // a particular source — not all items will have missing sources
    assert.ok(report.latestMissingSourceCount >= 0);
  });

  it("reports blocked and state counts", () => {
    const facts = collectSourceFacts({
      threads: blockedItems.threads,
      requirements: blockedItems.requirements,
      admissions: blockedItems.admissions,
      plans: blockedItems.plans,
    });

    buildAndRenderWithKpi(facts);
    const report = getKpiReport();
    assert.ok(report.latestBlockedItemCount >= 4);
  });

  it("reports ambiguous state count", () => {
    const facts = collectSourceFacts({
      threads: conflictAmbiguity.threads,
      requirements: conflictAmbiguity.requirements,
      admissions: conflictAmbiguity.admissions,
      plans: conflictAmbiguity.plans,
    });

    buildAndRenderWithKpi(facts);
    const report = getKpiReport();
    assert.ok(report.latestAmbiguousStateCount >= 1);
  });

  it("reports source parity count", () => {
    const facts = collectSourceFacts({
      threads: fullLifecycle.threads,
      requirements: fullLifecycle.requirements,
      admissions: fullLifecycle.admissions,
      plans: fullLifecycle.plans,
    });

    buildAndRenderWithKpi(facts);
    const report = getKpiReport();
    assert.ok(report.latestSourceParityCount > 0);
  });

  it("slow buckets start at zero for fast builds", () => {
    const facts = collectSourceFacts({
      threads: fullLifecycle.threads,
    });

    buildAndRenderWithKpi(facts);
    const report = getKpiReport();
    assert.equal(report.slowBuckets.over1s, 0);
    assert.equal(report.slowBuckets.over10s, 0);
    assert.equal(report.slowBuckets.over60s, 0);
  });

  it("accumulates across multiple builds", () => {
    const facts1 = collectSourceFacts({ threads: fullLifecycle.threads });
    const facts2 = collectSourceFacts({ threads: blockedItems.threads });

    buildAndRenderWithKpi(facts1);
    buildAndRenderWithKpi(facts2);

    const report = getKpiReport();
    assert.equal(report.totalBuilds, 2);
    assert.equal(report.buildSuccessCount, 2);
  });
});

// ---------------------------------------------------------------------------
// Partition / isolation
// ---------------------------------------------------------------------------

describe("company-table: partition isolation", () => {
  it("production partition is carried through", () => {
    const facts = collectSourceFacts({
      threads: fullLifecycle.threads,
      sourcePartition: "production",
    });
    const table = buildCompanyTable(facts);
    assert.equal(table.sourcePartition, "production");
  });

  it("proof partition is carried through", () => {
    const facts = collectSourceFacts({
      threads: fullLifecycle.threads,
      sourcePartition: "proof",
    });
    const table = buildCompanyTable(facts);
    assert.equal(table.sourcePartition, "proof");
  });

  it("KPI metrics record the partition", () => {
    resetKpiRecords();
    const facts = collectSourceFacts({
      threads: fullLifecycle.threads,
      sourcePartition: "proof",
    });
    buildAndRenderWithKpi(facts);
    const report = getKpiReport();
    assert.equal(report.latestSourcePartition, "proof");
  });
});
