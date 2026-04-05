import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { invoke } from "../../shared/llm-invoker/invoker.js";
import type { InvocationParams, InvocationResult } from "../../shared/llm-invoker/types.js";
import type { ExecutiveBrief, BriefSourceFacts, BriefFeatureSnapshot } from "./types.js";
import type { LiveExecutiveSurface } from "./live-executive-surface.js";
import type { GovernedStatusContext } from "./status-governance.js";
import type { GitStatusWindow } from "../controller/status-window.js";

export interface StatusRenderAgentOptions {
  projectRoot: string;
  promptsDir: string;
  facts: BriefSourceFacts;
  brief: ExecutiveBrief;
  governance: GovernedStatusContext;
  surface: LiveExecutiveSurface;
  statusWindow: GitStatusWindow | null;
  intelligenceParams: Omit<InvocationParams, "prompt" | "source_path">;
  invokeLLM?: (params: InvocationParams) => Promise<InvocationResult>;
}

export async function renderStatusWithAgent(
  options: StatusRenderAgentOptions,
): Promise<string> {
  const systemPrompt = await loadStatusPrompt(options.promptsDir);
  const evidencePack = buildStatusEvidencePack(options);
  const prompt = [
    "<system_prompt>",
    systemPrompt,
    "</system_prompt>",
    "",
    "<task>",
    "You are preparing the COO /status briefing for the CEO.",
    "Use the status evidence below as the point of truth.",
    "Do not invent facts.",
    "Do not use a rigid canned template or slot-filling phrasing.",
    "Present the company at a high level, as a COO briefing a CEO naturally in chat.",
    "Keep it concise and easy to scan.",
    "You must keep these 4 executive section headings exactly once:",
    "## Issues That Need Your Attention",
    "## On The Table",
    "## In Motion",
    "## What's Next",
    "Before those sections, you may write a short opening paragraph and a short landed/context summary when useful.",
    "Use the evidence pack to distinguish direct truth, derived judgment, fallback, ambiguity, and missing proof.",
    "Do not expose raw JSON, internal ids, schema names, or route internals unless they are necessary to explain a real business-impacting issue.",
    "If the evidence shows a route/control problem, explain it plainly and suggest the concrete fix action, severity, and priority.",
    "Return only the CEO-facing status body. Do not add a title.",
    "</task>",
    "",
    "<status_evidence>",
    JSON.stringify(evidencePack, null, 2),
    "</status_evidence>",
  ].join("\n");

  const invocation = await (options.invokeLLM ?? invoke)({
    ...options.intelligenceParams,
    prompt,
    source_path: "COO/intelligence/status-brief",
    telemetry_metadata: {
      ...(options.intelligenceParams.telemetry_metadata ?? {}),
      status_surface: "coo_live_status_agent_render",
      source_partition: options.facts.sourcePartition,
    },
  });

  return stripStatusTitle(invocation.response);
}

async function loadStatusPrompt(promptsDir: string): Promise<string> {
  return readFile(join(promptsDir, "prompt.md"), "utf-8");
}

function buildStatusEvidencePack(
  options: StatusRenderAgentOptions,
): Record<string, unknown> {
  const { facts, brief, governance, statusWindow } = options;
  const featuresById = new Map(facts.features.map((feature) => [feature.id, feature]));
  const landedFeatures = facts.features
    .filter((feature) => feature.completion)
    .map((feature) => toLandedEvidence(feature, governance));

  return {
    company: {
      collected_at: facts.collectedAt,
      source_partition: facts.sourcePartition,
      source_freshness_age_ms: facts.sourceFreshnessAgeMs,
      missing_source_families: facts.missingSourceFamilies,
      active_scope_path: governance.companyScopePath,
    },
    status_window: statusWindow ? {
      current_rendered_at: statusWindow.currentRenderedAt,
      previous_rendered_at: statusWindow.previousRenderedAt,
      previous_head_commit: statusWindow.previousHeadCommit,
      current_head_commit: statusWindow.currentHeadCommit,
      verification_basis: statusWindow.verificationBasis,
      git_available: statusWindow.gitAvailable,
      commits_since_previous: statusWindow.commitsSincePrevious,
      changed_feature_slugs: statusWindow.changedFeatureSlugs,
      dropped_feature_slugs: statusWindow.droppedFeatureSlugs,
      red_flag: statusWindow.redFlag,
      verification_notes: statusWindow.verificationNotes,
    } : null,
    deep_audit: governance.deepAudit ? {
      trigger: governance.deepAudit.trigger,
      scope: governance.deepAudit.scope,
      targeted_feature_ids: governance.deepAudit.targetedFeatureIds,
      justified: governance.deepAudit.justified,
      sensitivity_assessment: governance.deepAudit.sensitivityAssessment,
      finding_count: governance.deepAudit.findingCount,
      note: governance.deepAudit.note,
    } : null,
    status_notes: governance.statusNotes,
    landed_recently: landedFeatures,
    executive_sections: {
      issues: brief.issues.map((item) => ({
        feature_id: item.featureId,
        feature_label: item.featureLabel,
        headline: item.headline,
        details: item.details,
        feature_evidence: featuresById.get(item.featureId)?.evidence ?? null,
      })),
      on_the_table: brief.onTheTable.map((item) => ({
        feature_id: item.featureId,
        feature_label: item.featureLabel,
        summary: item.summary,
        evidence: featuresById.get(item.featureId)?.evidence ?? null,
      })),
      in_motion: brief.inMotion.map((item) => ({
        feature_id: item.featureId,
        feature_label: item.featureLabel,
        progress_summary: item.progressSummary,
        evidence: featuresById.get(item.featureId)?.evidence ?? null,
      })),
      whats_next: brief.whatsNext.map((item) => ({
        feature_id: item.featureId,
        feature_label: item.featureLabel,
        next_action: item.nextAction,
        evidence: featuresById.get(item.featureId)?.evidence ?? null,
      })),
    },
    tracked_findings: {
      attention: governance.additionalAttention.map((item) => ({
        feature_id: item.featureId,
        feature_label: item.featureLabel,
        classification: item.classification,
        summary: item.summary,
        recommendation: item.recommendation,
        evidence: item.evidenceLine,
        implicated_subjects: item.implicatedSubjects,
        ready_handoff: governance.operatingState.trackedIssues[item.key]?.readyHandoff ?? null,
      })),
      table: governance.additionalTable.map((item) => ({
        feature_id: item.featureId,
        feature_label: item.featureLabel,
        classification: item.classification,
        summary: item.summary,
        recommendation: item.recommendation,
        evidence: item.evidenceLine,
        implicated_subjects: item.implicatedSubjects,
        ready_handoff: governance.operatingState.trackedIssues[item.key]?.readyHandoff ?? null,
      })),
      next: governance.additionalNext.map((item) => ({
        feature_id: item.featureId,
        feature_label: item.featureLabel,
        classification: item.classification,
        summary: item.summary,
        recommendation: item.recommendation,
        evidence: item.evidenceLine,
        implicated_subjects: item.implicatedSubjects,
        ready_handoff: governance.operatingState.trackedIssues[item.key]?.readyHandoff ?? null,
      })),
    },
    current_thread_context: {
      thread_id: governance.currentThread.threadId,
      active_workflow: governance.currentThread.activeWorkflow,
      onion_layer: governance.currentThread.onionLayer,
      scope_path: governance.currentThread.scopePath,
      last_state_commit_at: governance.currentThread.lastStateCommitAt,
    },
    rendered_fallback_surface: options.surface,
  };
}

function toLandedEvidence(
  feature: BriefFeatureSnapshot,
  governance: GovernedStatusContext,
): Record<string, unknown> {
  const assessment = governance.landedAssessments.get(feature.id);
  return {
    feature_id: feature.id,
    feature_label: feature.label,
    status: feature.status,
    last_activity_at: feature.lastActivityAt,
    missing_source_families: feature.missingSourceFamilies,
    evidence: feature.evidence ?? null,
    completion: feature.completion ? {
      completed_at: feature.completion.completedAt,
      merged_at: feature.completion.mergedAt,
      review_cycles: feature.completion.reviewCycles,
      token_cost_tokens: feature.completion.tokenCostTokens,
      timing: feature.completion.timing,
      key_issue: feature.completion.keyIssue,
      key_issue_count: feature.completion.keyIssueCount,
      completion_summary: feature.completion.completionSummary,
    } : null,
    governance_assessment: assessment ? {
      classification: assessment.classification,
      primary_concern: assessment.primaryConcern,
      review_assessment: assessment.reviewAssessmentLine,
      token_assessment: assessment.tokenAssessmentLine,
      timing_assessment: assessment.timingAssessmentLine,
      coo_read_fallback: assessment.cooReadLine,
      recommendation_fallback: assessment.recommendation,
      implicated_subjects: assessment.implicatedSubjects,
    } : null,
  };
}

function stripStatusTitle(value: string): string {
  return value
    .replace(/^# COO Executive Status\s*/i, "")
    .trim();
}
