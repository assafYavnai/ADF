import { emit } from "../../shared/telemetry/collector.js";
import { createSystemProvenance } from "../../shared/provenance/types.js";
import { buildExecutiveBrief } from "../briefing/builder.js";
import {
  normalizeLiveExecutiveSurface,
  type LiveExecutiveSurface,
} from "../briefing/live-executive-surface.js";
import {
  assessSupportedLiveStatusBody,
  renderDeterministicStatusBriefing,
  renderStatusWithAgent,
} from "../briefing/status-render-agent.js";
import {
  loadLiveBriefSourceFacts,
  type LiveBriefDiagnostics,
} from "../briefing/live-source-adapter.js";
import type { ExecutiveBrief, BriefSourceFacts } from "../briefing/types.js";
import {
  type LiveStatusBrainClient,
  prepareGovernedStatusContext,
  type GovernedStatusContext,
} from "../briefing/status-governance.js";
import { FileSystemThreadStore, type FileSystemThreadStore as FileSystemThreadStoreType } from "./thread.js";
import {
  inspectGitStatusWindow as inspectGitStatusWindowDefault,
  loadStatusUpdateAnchor as loadStatusUpdateAnchorDefault,
  saveStatusUpdateAnchor as saveStatusUpdateAnchorDefault,
  type GitStatusWindow,
  type GitStatusWindowOptions,
  type StatusUpdateAnchor,
} from "./status-window.js";
import type { InvocationParams, InvocationResult } from "../../shared/llm-invoker/types.js";

export interface LiveExecutiveStatusOptions {
  projectRoot: string;
  threadsDir: string;
  brainClient?: LiveStatusBrainClient | null;
  sourcePartition?: "production" | "proof" | "mixed";
  telemetryContext?: Record<string, unknown>;
  now?: Date;
  statusScopePath?: string | null;
  currentThreadId?: string | null;
  promptsDir?: string;
  intelligenceParams?: Omit<InvocationParams, "prompt" | "source_path">;
  invokeLLM?: (params: InvocationParams) => Promise<InvocationResult>;
  threadStore?: Pick<FileSystemThreadStoreType, "list" | "get">;
  loadStatusUpdateAnchor?: (projectRoot: string) => Promise<StatusUpdateAnchor | null>;
  inspectGitStatusWindow?: (options: GitStatusWindowOptions) => Promise<GitStatusWindow>;
  saveStatusUpdateAnchor?: (projectRoot: string, anchor: StatusUpdateAnchor) => Promise<void>;
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
  governance: GovernedStatusContext;
  surface: LiveExecutiveSurface;
  statusWindow: GitStatusWindow | null;
  rendered: string;
  output: string;
  diagnostics: LiveBriefDiagnostics;
  metrics: LiveExecutiveStatusMetrics;
}

export async function buildLiveExecutiveStatus(
  options: LiveExecutiveStatusOptions,
): Promise<LiveExecutiveStatusResult> {
  const invocationStartedAt = Date.now();
  const threadStore = options.threadStore ?? new FileSystemThreadStore(options.threadsDir);
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
    threadStore,
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
  let surface: LiveExecutiveSurface;
  let governance!: GovernedStatusContext;
  let statusWindow: GitStatusWindow | null = null;
  let rendered: string;
  let output: string;
  let acceptedBodyParity = {
    issuesExpected: brief.parity.issuesExpected,
    issuesActual: brief.parity.issuesActual,
    tableExpected: brief.parity.tableExpected,
    tableActual: brief.parity.tableActual,
    inMotionExpected: brief.parity.inMotionExpected,
    inMotionActual: brief.parity.inMotionActual,
    nextExpected: brief.parity.whatsNextExpected,
    nextActual: brief.parity.whatsNextActual,
    recentLandingsExpected: 0,
    recentLandingsActual: 0,
  };
  try {
    statusWindow = await resolveStatusWindow(options, facts, brief);
    governance = await prepareGovernedStatusContext({
      projectRoot: options.projectRoot,
      facts,
      diagnostics,
      statusWindow,
      brainClient: options.brainClient ?? null,
      statusScopePath: options.statusScopePath ?? null,
      currentThreadId: options.currentThreadId ?? null,
      threadStore,
      now: options.now ?? new Date(),
      telemetryContext: options.telemetryContext,
    });
    surface = normalizeLiveExecutiveSurface(facts, brief, diagnostics, governance, statusWindow);
    rendered = options.promptsDir && options.intelligenceParams
      ? await renderStatusWithAgent({
        projectRoot: options.projectRoot,
        promptsDir: options.promptsDir,
        facts,
        brief,
        governance,
        surface,
        statusWindow,
        intelligenceParams: options.intelligenceParams,
        invokeLLM: options.invokeLLM,
      })
      : renderDeterministicStatusBriefing({
        facts,
        brief,
        governance,
        surface,
        statusWindow,
      });
    if (options.promptsDir && options.intelligenceParams) {
      acceptedBodyParity = assessSupportedLiveStatusBody(rendered, {
        facts,
        brief,
        governance,
        surface,
        statusWindow,
      }).visibility;
    }
    output = renderLiveExecutiveStatusOutput(rendered);
    await persistStatusWindowAnchor(options, facts, statusWindow);
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
    git_commits_since_previous_status: statusWindow?.commitsSincePrevious ?? 0,
    git_context_red_flag: statusWindow?.redFlag ?? false,
    ...options.telemetryContext,
  });
  emitStatusMetric("live_source_adapter_missing_source_count", 0, true, {
    count: diagnostics.missingSourceCount,
    unavailable_family_count: diagnostics.unavailableFamilies.length,
    unavailable_families: diagnostics.unavailableFamilies,
    source_partition: facts.sourcePartition,
    ...options.telemetryContext,
  });
  emitParityMetric("issues_visibility_parity_count", acceptedBodyParity.issuesExpected, acceptedBodyParity.issuesActual, facts.sourcePartition, options.telemetryContext);
  emitParityMetric("table_visibility_parity_count", acceptedBodyParity.tableExpected, acceptedBodyParity.tableActual, facts.sourcePartition, options.telemetryContext);
  emitParityMetric("in_motion_visibility_parity_count", acceptedBodyParity.inMotionExpected, acceptedBodyParity.inMotionActual, facts.sourcePartition, options.telemetryContext);
  emitParityMetric("next_visibility_parity_count", acceptedBodyParity.nextExpected, acceptedBodyParity.nextActual, facts.sourcePartition, options.telemetryContext);
  emitStatusMetric("live_source_freshness_age_ms", diagnostics.sourceFreshnessAgeMs, true, {
    count: 1,
    source_partition: facts.sourcePartition,
    ...options.telemetryContext,
  });

  return {
    facts,
    brief,
    governance,
    surface,
    statusWindow,
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
): string {
  return ["# COO Executive Status", "", renderedBrief].join("\n");
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

function collectSurfacedFeatureIds(
  facts: BriefSourceFacts,
  brief: ExecutiveBrief,
): string[] {
  return Array.from(new Set([
    ...facts.features.filter((feature) => feature.completion).map((feature) => feature.id),
    ...brief.issues.map((item) => item.featureId),
    ...brief.onTheTable.map((item) => item.featureId),
    ...brief.inMotion.map((item) => item.featureId),
    ...brief.whatsNext.map((item) => item.featureId),
  ]));
}

async function resolveStatusWindow(
  options: LiveExecutiveStatusOptions,
  facts: BriefSourceFacts,
  brief: ExecutiveBrief,
): Promise<GitStatusWindow | null> {
  const loadStatusUpdateAnchor = options.loadStatusUpdateAnchor ?? loadStatusUpdateAnchorDefault;
  const inspectGitStatusWindow = options.inspectGitStatusWindow ?? inspectGitStatusWindowDefault;

  try {
    const previousAnchor = await loadStatusUpdateAnchor(options.projectRoot);
    return await inspectGitStatusWindow({
      projectRoot: options.projectRoot,
      currentRenderedAt: facts.collectedAt,
      previousAnchor,
      surfacedFeatureIds: collectSurfacedFeatureIds(facts, brief),
    });
  } catch {
    return {
      currentRenderedAt: facts.collectedAt,
      previousRenderedAt: null,
      previousHeadCommit: null,
      currentHeadCommit: null,
      verificationBasis: "unavailable",
      gitAvailable: false,
      commitsSincePrevious: 0,
      changedFeatureSlugs: [],
      droppedFeatureSlugs: [],
      currentWorktreeFeatureSlugs: [],
      visibilityGapSources: [],
      verificationNotes: ["Git-backed status-window verification is unavailable in this runtime, so context-drop checks could not run."],
      redFlag: false,
    };
  }
}

async function persistStatusWindowAnchor(
  options: LiveExecutiveStatusOptions,
  facts: BriefSourceFacts,
  statusWindow: GitStatusWindow | null,
): Promise<void> {
  const saveStatusUpdateAnchor = options.saveStatusUpdateAnchor ?? saveStatusUpdateAnchorDefault;
  await saveStatusUpdateAnchor(options.projectRoot, {
    renderedAt: facts.collectedAt,
    headCommit: statusWindow?.currentHeadCommit ?? null,
  });
}
