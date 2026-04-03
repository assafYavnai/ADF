/**
 * Executive Brief KPI Instrumentation
 *
 * Local KPI collection for brief build/render operations.
 * Does NOT import from shared/telemetry — stays self-contained
 * to respect the forbidden-edits boundary.
 */

import type { BriefBuildMetrics, BriefParityCounts } from "./types.js";

// ---------------------------------------------------------------------------
// KPI bucket definitions
// ---------------------------------------------------------------------------

const SLOW_THRESHOLDS_MS = [1_000, 10_000, 60_000] as const;

export interface BriefKpiReport {
  /** Total number of brief build+render cycles recorded */
  totalBuilds: number;
  /** Successful renders */
  renderSuccessCount: number;
  /** Failed renders */
  renderFailureCount: number;
  /** Latency percentiles for build phase */
  buildLatency: { p50: number; p95: number; p99: number };
  /** Slow-bucket counts */
  slowBuckets: { over1s: number; over10s: number; over60s: number };
  /** Average source metadata completeness across all builds */
  avgSourceMetadataCompletenessRate: number;
  /** Latest parity snapshot */
  latestParity: BriefParityCounts | null;
  /** Latest source age in ms */
  latestSourceAgeMs: number | null;
  /** Source partition for latest build */
  latestSourcePartition: "production" | "proof" | "mixed" | null;
}

// ---------------------------------------------------------------------------
// In-memory collector (designed for proof/test; production would persist)
// ---------------------------------------------------------------------------

const records: BriefBuildMetrics[] = [];

export function recordBriefMetrics(metrics: BriefBuildMetrics): void {
  records.push(metrics);
}

export function resetKpiRecords(): void {
  records.length = 0;
}

export function getKpiReport(): BriefKpiReport {
  if (records.length === 0) {
    return {
      totalBuilds: 0,
      renderSuccessCount: 0,
      renderFailureCount: 0,
      buildLatency: { p50: 0, p95: 0, p99: 0 },
      slowBuckets: { over1s: 0, over10s: 0, over60s: 0 },
      avgSourceMetadataCompletenessRate: 0,
      latestParity: null,
      latestSourceAgeMs: null,
      latestSourcePartition: null,
    };
  }

  const successes = records.filter((r) => r.success);
  const failures = records.filter((r) => !r.success);

  const latencies = records.map((r) => r.buildLatencyMs).sort((a, b) => a - b);

  const totalCompleteness = records.reduce((sum, r) => sum + r.sourceMetadataCompletenessRate, 0);
  const latest = records[records.length - 1];

  return {
    totalBuilds: records.length,
    renderSuccessCount: successes.length,
    renderFailureCount: failures.length,
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
    avgSourceMetadataCompletenessRate: totalCompleteness / records.length,
    latestParity: latest.parity,
    latestSourceAgeMs: latest.sourceAgeMs,
    latestSourcePartition: latest.sourcePartition,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// ---------------------------------------------------------------------------
// Instrumented build+render helper
// ---------------------------------------------------------------------------

import { buildExecutiveBrief } from "./builder.js";
import { renderExecutiveBrief } from "./renderer.js";
import type { BriefSourceFacts, ExecutiveBrief } from "./types.js";

export interface InstrumentedBriefResult {
  brief: ExecutiveBrief;
  rendered: string;
  metrics: BriefBuildMetrics;
}

export function buildAndRenderWithKpi(facts: BriefSourceFacts): InstrumentedBriefResult {
  const buildStart = Date.now();
  let brief: ExecutiveBrief;
  let rendered: string;
  let success = true;

  try {
    brief = buildExecutiveBrief(facts);
  } catch (err) {
    const buildLatencyMs = Date.now() - buildStart;
    const metrics: BriefBuildMetrics = {
      buildLatencyMs,
      renderLatencyMs: 0,
      success: false,
      featureCount: facts.features.length,
      issueCount: 0,
      sourcePartition: facts.sourcePartition,
      sourceAgeMs: Date.now() - new Date(facts.collectedAt).getTime(),
      sourceMetadataCompletenessRate: 0,
      parity: { issuesExpected: 0, issuesActual: 0, tableExpected: 0, tableActual: 0, inMotionExpected: 0, inMotionActual: 0, whatsNextExpected: 0, whatsNextActual: 0 },
    };
    recordBriefMetrics(metrics);
    throw err;
  }

  const buildLatencyMs = Date.now() - buildStart;
  const renderStart = Date.now();

  try {
    rendered = renderExecutiveBrief(brief);
  } catch (err) {
    success = false;
    const renderLatencyMs = Date.now() - renderStart;
    const metrics: BriefBuildMetrics = {
      buildLatencyMs,
      renderLatencyMs,
      success: false,
      featureCount: facts.features.length,
      issueCount: brief.issues.length,
      sourcePartition: brief.sourcePartition,
      sourceAgeMs: brief.sourceAgeMs,
      sourceMetadataCompletenessRate: brief.sourceMetadataCompletenessRate,
      parity: brief.parity,
    };
    recordBriefMetrics(metrics);
    throw err;
  }

  const renderLatencyMs = Date.now() - renderStart;
  const metrics: BriefBuildMetrics = {
    buildLatencyMs,
    renderLatencyMs,
    success,
    featureCount: facts.features.length,
    issueCount: brief.issues.length,
    sourcePartition: brief.sourcePartition,
    sourceAgeMs: brief.sourceAgeMs,
    sourceMetadataCompletenessRate: brief.sourceMetadataCompletenessRate,
    parity: brief.parity,
  };
  recordBriefMetrics(metrics);

  return { brief, rendered, metrics };
}
