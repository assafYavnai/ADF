import { emit } from "../../shared/telemetry/collector.js";
import { createSystemProvenance } from "../../shared/provenance/types.js";
import { buildExecutiveBrief } from "../briefing/builder.js";
import {
  loadLiveBriefSourceFacts,
  type BriefRequirementReader,
  type LiveBriefDiagnostics,
} from "../briefing/live-source-adapter.js";
import { renderExecutiveBrief } from "../briefing/renderer.js";
import type { ExecutiveBrief, BriefSourceFacts } from "../briefing/types.js";
import type { FileSystemThreadStore } from "./thread.js";

export interface LiveExecutiveStatusOptions {
  projectRoot: string;
  threadsDir: string;
  brainClient?: BriefRequirementReader | null;
  sourcePartition?: "production" | "proof" | "mixed";
  telemetryContext?: Record<string, unknown>;
  now?: Date;
  threadStore?: Pick<FileSystemThreadStore, "list" | "get">;
}

export interface LiveExecutiveStatusMetrics {
  invocationLatencyMs: number;
  buildLatencyMs: number;
  renderLatencyMs: number;
  sourceFreshnessAgeMs: number;
  missingSourceCount: number;
}

export interface LiveExecutiveStatusResult {
  facts: BriefSourceFacts;
  brief: ExecutiveBrief;
  rendered: string;
  output: string;
  diagnostics: LiveBriefDiagnostics;
  metrics: LiveExecutiveStatusMetrics;
}

export async function buildLiveExecutiveStatus(
  options: LiveExecutiveStatusOptions,
): Promise<LiveExecutiveStatusResult> {
  const invocationStartedAt = Date.now();
  emitStatusMetric("live_status_invocation_count", 0, true, {
    count: 1,
    source_partition: options.sourcePartition ?? "production",
    ...options.telemetryContext,
  });

  const { facts, diagnostics } = await loadLiveBriefSourceFacts({
    projectRoot: options.projectRoot,
    threadsDir: options.threadsDir,
    brainClient: options.brainClient ?? null,
    sourcePartition: options.sourcePartition,
    now: options.now,
    threadStore: options.threadStore,
  });

  const buildStartedAt = Date.now();
  let brief: ExecutiveBrief;
  try {
    brief = buildExecutiveBrief(facts);
  } catch (error) {
    const buildLatencyMs = Date.now() - buildStartedAt;
    emitBuildMetrics(buildLatencyMs, false, facts, diagnostics, options.telemetryContext);
    emitStatusMetric("live_exec_brief_render_failure_count", 0, false, {
      count: 1,
      source_partition: facts.sourcePartition,
      error_message: formatError(error),
      ...options.telemetryContext,
    });
    throw error;
  }
  const buildLatencyMs = Date.now() - buildStartedAt;

  const renderStartedAt = Date.now();
  let rendered: string;
  let output: string;
  try {
    rendered = renderExecutiveBrief(brief);
    output = renderLiveExecutiveStatusOutput(rendered, diagnostics, facts);
  } catch (error) {
    const renderLatencyMs = Date.now() - renderStartedAt;
    emitBuildMetrics(buildLatencyMs, true, facts, diagnostics, options.telemetryContext);
    emitStatusMetric("live_exec_brief_render_failure_count", renderLatencyMs, false, {
      count: 1,
      source_partition: facts.sourcePartition,
      error_message: formatError(error),
      ...options.telemetryContext,
    });
    throw error;
  }
  const renderLatencyMs = Date.now() - renderStartedAt;
  const invocationLatencyMs = Date.now() - invocationStartedAt;

  emitBuildMetrics(buildLatencyMs, true, facts, diagnostics, options.telemetryContext);
  emitStatusMetric("live_exec_brief_render_success_count", renderLatencyMs, true, {
    count: 1,
    source_partition: facts.sourcePartition,
    issue_count: brief.issues.length,
    table_count: brief.onTheTable.length,
    in_motion_count: brief.inMotion.length,
    next_count: brief.whatsNext.length,
    ...options.telemetryContext,
  });
  emitStatusMetric("live_source_adapter_missing_source_count", 0, true, {
    count: diagnostics.missingSourceCount,
    unavailable_family_count: diagnostics.unavailableFamilies.length,
    unavailable_families: diagnostics.unavailableFamilies,
    source_partition: facts.sourcePartition,
    ...options.telemetryContext,
  });
  emitParityMetric("issues_visibility_parity_count", brief.parity.issuesExpected, brief.parity.issuesActual, facts.sourcePartition, options.telemetryContext);
  emitParityMetric("table_visibility_parity_count", brief.parity.tableExpected, brief.parity.tableActual, facts.sourcePartition, options.telemetryContext);
  emitParityMetric("in_motion_visibility_parity_count", brief.parity.inMotionExpected, brief.parity.inMotionActual, facts.sourcePartition, options.telemetryContext);
  emitParityMetric("next_visibility_parity_count", brief.parity.whatsNextExpected, brief.parity.whatsNextActual, facts.sourcePartition, options.telemetryContext);
  emitStatusMetric("live_source_freshness_age_ms", diagnostics.sourceFreshnessAgeMs, true, {
    count: 1,
    source_partition: facts.sourcePartition,
    ...options.telemetryContext,
  });

  return {
    facts,
    brief,
    rendered,
    output,
    diagnostics,
    metrics: {
      invocationLatencyMs,
      buildLatencyMs,
      renderLatencyMs,
      sourceFreshnessAgeMs: diagnostics.sourceFreshnessAgeMs,
      missingSourceCount: diagnostics.missingSourceCount,
    },
  };
}

export function renderLiveExecutiveStatusOutput(
  renderedBrief: string,
  diagnostics: LiveBriefDiagnostics,
  facts?: BriefSourceFacts,
): string {
  const lines = ["# COO Executive Status"];
  const statusNotes = [
    ...diagnostics.degradationNotes,
    ...buildRecentCompletionNotes(facts),
  ];

  if (statusNotes.length > 0) {
    lines.push("");
    lines.push("Status notes:");
    for (const note of statusNotes) {
      lines.push(`- ${note}`);
    }
  }

  lines.push("");
  lines.push(renderedBrief);

  return lines.join("\n");
}

function buildRecentCompletionNotes(facts?: BriefSourceFacts): string[] {
  if (!facts) {
    return [];
  }

  const collectedAtMs = Date.parse(facts.collectedAt);
  if (Number.isNaN(collectedAtMs)) {
    return [];
  }

  return facts.features
    .filter((feature) => feature.isFinalized || feature.briefingState === "closeout")
    .filter((feature) => {
      const activityMs = Date.parse(feature.lastActivityAt);
      if (Number.isNaN(activityMs)) {
        return false;
      }
      return collectedAtMs - activityMs <= 7 * 24 * 60 * 60 * 1_000;
    })
    .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt))
    .slice(0, 3)
    .map((feature) => `Recently finished: ${feature.label} - ${describeRecentCompletion(feature)}`);
}

function describeRecentCompletion(feature: BriefSourceFacts["features"][number]): string {
  if (feature.isFinalized) {
    return "completed and merged";
  }
  return "completed and awaiting final closeout";
}

function emitBuildMetrics(
  buildLatencyMs: number,
  success: boolean,
  facts: BriefSourceFacts,
  diagnostics: LiveBriefDiagnostics,
  telemetryContext?: Record<string, unknown>,
): void {
  emitStatusMetric("live_exec_brief_build_latency_ms", buildLatencyMs, success, {
    count: 1,
    feature_count: facts.features.length,
    source_partition: facts.sourcePartition,
    source_freshness_age_ms: diagnostics.sourceFreshnessAgeMs,
    missing_source_count: diagnostics.missingSourceCount,
    over_1s: buildLatencyMs > 1_000 ? 1 : 0,
    over_10s: buildLatencyMs > 10_000 ? 1 : 0,
    over_60s: buildLatencyMs > 60_000 ? 1 : 0,
    ...telemetryContext,
  });
}

function emitParityMetric(
  operation: string,
  expected: number,
  actual: number,
  sourcePartition: "production" | "proof" | "mixed",
  telemetryContext?: Record<string, unknown>,
): void {
  emitStatusMetric(operation, 0, expected === actual, {
    count: actual,
    expected,
    actual,
    parity_match: expected === actual,
    source_partition: sourcePartition,
    ...telemetryContext,
  });
}

function emitStatusMetric(
  operation: string,
  latencyMs: number,
  success: boolean,
  metadata: Record<string, unknown>,
): void {
  emit({
    provenance: createSystemProvenance(`COO/controller/executive-status/${operation}`),
    category: "system",
    operation,
    latency_ms: latencyMs,
    success,
    metadata,
  });
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
