/**
 * Company Table KPI Instrumentation
 *
 * Local KPI collection for table build/render operations.
 * Self-contained — does not import from shared/telemetry.
 */

import type { TableBuildMetrics, TableKpiReport, CompanyTable, TableSourceFacts } from "./types.js";
import { buildCompanyTable } from "./normalizer.js";
import { renderCompanyTable } from "./renderer.js";

// ---------------------------------------------------------------------------
// Slow-bucket thresholds
// ---------------------------------------------------------------------------

const SLOW_THRESHOLDS_MS = [1_000, 10_000, 60_000] as const;

// ---------------------------------------------------------------------------
// In-memory collector (designed for proof/test; production would persist)
// ---------------------------------------------------------------------------

const records: TableBuildMetrics[] = [];

export function recordTableMetrics(metrics: TableBuildMetrics): void {
  records.push(metrics);
}

export function resetKpiRecords(): void {
  records.length = 0;
}

export function getKpiReport(): TableKpiReport {
  if (records.length === 0) {
    return {
      totalBuilds: 0,
      buildSuccessCount: 0,
      buildFailureCount: 0,
      buildLatency: { p50: 0, p95: 0, p99: 0 },
      slowBuckets: { over1s: 0, over10s: 0, over60s: 0 },
      latestMissingSourceCount: 0,
      latestAmbiguousStateCount: 0,
      latestBlockedItemCount: 0,
      latestAdmissionPendingCount: 0,
      latestInMotionCount: 0,
      latestCompletedRecentlyCount: 0,
      latestSourceFreshnessAgeMs: 0,
      latestSourceParityCount: 0,
      latestSourcePartition: null,
    };
  }

  const latencies = records.map((r) => r.buildLatencyMs).sort((a, b) => a - b);
  const latest = records[records.length - 1];

  return {
    totalBuilds: records.length,
    buildSuccessCount: records.filter((r) => r.success).length,
    buildFailureCount: records.filter((r) => !r.success).length,
    buildLatency: {
      p50: percentile(latencies, 0.50),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
    },
    slowBuckets: {
      over1s: latencies.filter((l) => l > SLOW_THRESHOLDS_MS[0]).length,
      over10s: latencies.filter((l) => l > SLOW_THRESHOLDS_MS[1]).length,
      over60s: latencies.filter((l) => l > SLOW_THRESHOLDS_MS[2]).length,
    },
    latestMissingSourceCount: latest.missingSourceCount,
    latestAmbiguousStateCount: latest.ambiguousStateCount,
    latestBlockedItemCount: latest.blockedItemCount,
    latestAdmissionPendingCount: latest.admissionPendingCount,
    latestInMotionCount: latest.inMotionCount,
    latestCompletedRecentlyCount: latest.completedRecentlyCount,
    latestSourceFreshnessAgeMs: latest.sourceFreshnessAgeMs,
    latestSourceParityCount: latest.sourceParityCount,
    latestSourcePartition: latest.sourcePartition,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// ---------------------------------------------------------------------------
// Metrics extraction from a built table
// ---------------------------------------------------------------------------

function extractMetrics(
  table: CompanyTable,
  facts: TableSourceFacts,
  buildLatencyMs: number,
  renderLatencyMs: number,
  success: boolean,
): TableBuildMetrics {
  const maxFreshnessAge = facts.availability
    .filter((a) => a.available)
    .reduce((max, a) => Math.max(max, a.freshnessAgeMs), 0);

  return {
    buildLatencyMs,
    renderLatencyMs,
    success,
    entryCount: table.entries.length,
    sourcePartition: table.sourcePartition,
    sourceAgeMs: table.sourceAgeMs,
    sourceMetadataCompletenessRate: table.sourceMetadataCompletenessRate,
    stateCounts: { ...table.stateCounts },
    parity: { ...table.parity },
    missingSourceCount: table.entries.filter((e) => e.missingSourceFamilies.length > 0).length,
    ambiguousStateCount: table.entries.filter((e) => e.hasAmbiguity).length,
    blockedItemCount: table.stateCounts.blocked,
    admissionPendingCount: table.stateCounts.admission_pending,
    inMotionCount: table.stateCounts.in_motion,
    completedRecentlyCount: table.stateCounts.completed_recently,
    sourceFreshnessAgeMs: maxFreshnessAge,
    sourceParityCount: table.parity.totalSourceItems,
  };
}

// ---------------------------------------------------------------------------
// Instrumented build + render
// ---------------------------------------------------------------------------

export interface InstrumentedTableResult {
  table: CompanyTable;
  rendered: string;
  metrics: TableBuildMetrics;
}

export function buildAndRenderWithKpi(facts: TableSourceFacts): InstrumentedTableResult {
  const buildStart = Date.now();
  let table: CompanyTable;
  let rendered: string;

  try {
    table = buildCompanyTable(facts);
  } catch (err) {
    const buildLatencyMs = Date.now() - buildStart;
    const emptyMetrics: TableBuildMetrics = {
      buildLatencyMs,
      renderLatencyMs: 0,
      success: false,
      entryCount: 0,
      sourcePartition: facts.sourcePartition,
      sourceAgeMs: Date.now() - new Date(facts.collectedAt).getTime(),
      sourceMetadataCompletenessRate: 0,
      stateCounts: { shaping: 0, admission_pending: 0, admitted: 0, in_motion: 0, blocked: 0, next: 0, completed_recently: 0 },
      parity: { totalSourceItems: 0, totalTableEntries: 0, multiSourceEntries: 0, ambiguousEntries: 0, missingSourceEntries: 0 },
      missingSourceCount: 0,
      ambiguousStateCount: 0,
      blockedItemCount: 0,
      admissionPendingCount: 0,
      inMotionCount: 0,
      completedRecentlyCount: 0,
      sourceFreshnessAgeMs: 0,
      sourceParityCount: 0,
    };
    recordTableMetrics(emptyMetrics);
    throw err;
  }

  const buildLatencyMs = Date.now() - buildStart;
  const renderStart = Date.now();

  try {
    rendered = renderCompanyTable(table);
  } catch (err) {
    const renderLatencyMs = Date.now() - renderStart;
    const metrics = extractMetrics(table, facts, buildLatencyMs, renderLatencyMs, false);
    recordTableMetrics(metrics);
    throw err;
  }

  const renderLatencyMs = Date.now() - renderStart;
  const metrics = extractMetrics(table, facts, buildLatencyMs, renderLatencyMs, true);
  recordTableMetrics(metrics);

  return { table, rendered, metrics };
}
