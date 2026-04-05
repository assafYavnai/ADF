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
    "Keep it concise, human, and easy to scan.",
    "Formatting rules:",
    "- Use Markdown cleanly.",
    "- Keep paragraphs to 1-2 sentences.",
    "- When listing landed work, issues, or next moves, use bullet lists instead of dense prose.",
    "- Put the title of each landed item or issue on its own line.",
    "- For a material issue, prefer this shape: bullet title ending with `:`, then short continuation lines such as `Why:`, `Impact:`, `Fix:`, `Priority:` when the evidence supports them.",
    "- Do not bury the root cause in the middle of a long sentence.",
    "- If an issue is already investigated and handoff-ready, say what the root problem is and what fix can start immediately if approved.",
    "- If the evidence pack includes a route_chain, compress it into a short plain-language explanation of where the failure starts and how it reaches the CEO-facing symptom.",
    "- If the evidence pack includes company performance or KPI auditability counts, summarize them briefly near the top in CEO language.",
    "- If a trust or audit note does not require a CEO decision right now, keep it brief and out of the main attention bullets.",
    "You must keep these 4 executive section headings exactly once:",
    "## Issues That Need Your Attention",
    "## On The Table",
    "## In Motion",
    "## What's Next",
    "Before those sections, you may write a short opening paragraph and a short landed/context summary when useful.",
    "Inside `## What's Next`, order items by urgency and business importance, not by source-file order.",
    "If the evidence pack includes clear focus options, end the message with a short natural call for action and up to 2 numbered options.",
    "Use the evidence pack to distinguish direct truth, derived judgment, fallback, ambiguity, and missing proof.",
    "Do not expose raw JSON, internal ids, schema names, or route internals unless they are necessary to explain a real business-impacting issue.",
    "If the evidence shows a route/control problem, explain it plainly and suggest the concrete fix action, impact, severity, and priority.",
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
  const landedFeatures = facts.features
    .filter((feature) => feature.completion)
    .map((feature) => toLandedEvidence(feature, governance));
  const groupedAttention = buildGovernanceCards(governance.additionalAttention, governance);
  const groupedTable = buildGovernanceCards(governance.additionalTable, governance);
  const groupedNext = buildNextCards(brief, governance);

  return {
    company: {
      collected_at: facts.collectedAt,
      source_partition: facts.sourcePartition,
      source_freshness_age_ms: facts.sourceFreshnessAgeMs,
      missing_source_families: (facts.sourceAvailability ?? [])
        .filter((entry) => !entry.available)
        .map((entry) => entry.family),
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
    company_performance: buildCompanyPerformance(landedFeatures),
    landed_recently: landedFeatures,
    executive_sections: {
      issues: groupedAttention,
      on_the_table: [
        ...groupedTable,
        ...brief.onTheTable.map((item) => ({
          feature_id: item.featureId,
          feature_label: item.featureLabel,
          summary: item.summary,
        })),
      ],
      in_motion: brief.inMotion.map((item) => ({
        feature_id: item.featureId,
        feature_label: item.featureLabel,
        progress_summary: item.progressSummary,
        evidence: facts.features.find((feature) => feature.id === item.featureId)?.evidence ?? null,
      })),
      whats_next: groupedNext,
    },
    tracked_findings: {
      attention: groupedAttention,
      table: groupedTable,
      next: groupedNext,
    },
    focus_options: buildFocusOptions(groupedAttention, groupedNext),
    current_thread_context: {
      thread_id: governance.currentThread.threadId,
      active_workflow: governance.currentThread.activeWorkflow,
      onion_layer: governance.currentThread.onionLayer,
      scope_path: governance.currentThread.scopePath,
      last_state_commit_at: governance.currentThread.lastStateCommitAt,
    },
  };
}

function buildCompanyPerformance(
  landedFeatures: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const recentCount = landedFeatures.length;
  let reviewEvidencedCount = 0;
  let reviewLegacyAcceptedCount = 0;
  let suspiciousCostGapCount = 0;
  let acceptableLegacyCostGapCount = 0;
  let durableTokenCostCount = 0;

  for (const landed of landedFeatures) {
    const assessment = asRecord(landed.governance_assessment);
    const reviewLine = String(assessment.review_assessment ?? "");
    const tokenLine = String(assessment.token_assessment ?? "");

    if (/review governance is evidenced/i.test(reviewLine)) {
      reviewEvidencedCount += 1;
    } else if (/acceptable/i.test(reviewLine) || /predate/i.test(reviewLine)) {
      reviewLegacyAcceptedCount += 1;
    }

    if (/recorded at/i.test(tokenLine)) {
      durableTokenCostCount += 1;
    } else if (/acceptable legacy|predates the KPI capture rollout|rollout slice itself/i.test(tokenLine)) {
      acceptableLegacyCostGapCount += 1;
    } else if (/KPI capture was already live/i.test(tokenLine)) {
      suspiciousCostGapCount += 1;
    }
  }

  return {
    recent_landed_count: recentCount,
    review_governance: {
      evidenced_count: reviewEvidencedCount,
      acceptable_legacy_count: reviewLegacyAcceptedCount,
    },
    cost_visibility: {
      durable_token_totals_recorded_count: durableTokenCostCount,
      acceptable_legacy_gap_count: acceptableLegacyCostGapCount,
      suspicious_gap_count: suspiciousCostGapCount,
    },
    auditability_read: suspiciousCostGapCount > 0
      ? "Delivery confidence is mostly strong, but company cost auditability is incomplete because durable token totals are missing on recent post-rollout work."
      : "Recent delivery auditability looks stable from the available review and KPI evidence.",
  };
}

function buildGovernanceCards(
  items: GovernedStatusContext["additionalAttention"] | GovernedStatusContext["additionalTable"] | GovernedStatusContext["additionalNext"],
  governance: GovernedStatusContext,
): Array<Record<string, unknown>> {
  const grouped = new Map<string, Record<string, unknown>>();

  for (const item of items) {
    const tracked = governance.operatingState.trackedIssues[item.key];
    const groupKey = [
      item.summary,
      item.rootCause ?? "",
      item.systemFix ?? "",
      item.businessImpact ?? "",
      item.businessSeverity ?? "",
      item.businessPriority ?? "",
      item.routeChain.join(" > "),
    ].join("|");

    const existing = grouped.get(groupKey);
    if (existing) {
      const affectedLabels = existing.affected_feature_labels as string[];
      if (item.featureLabel && !affectedLabels.includes(item.featureLabel)) {
        affectedLabels.push(item.featureLabel);
      }
      if (tracked?.readyHandoff) {
        const readyHandoffs = existing.ready_handoffs as Array<Record<string, unknown>>;
        if (!readyHandoffs.some((handoff) => handoff.id === tracked.readyHandoff.id)) {
          readyHandoffs.push({
            id: tracked.readyHandoff.id,
            task_summary: tracked.readyHandoff.taskSummary,
            status: tracked.readyHandoff.status,
          });
        }
      }
      continue;
    }

    grouped.set(groupKey, {
      title: item.summary,
      affected_feature_labels: item.featureLabel ? [item.featureLabel] : [],
      classification: item.classification,
      evidence: item.evidenceLine,
      why: item.rootCause,
      impact: item.businessImpact,
      system_fix: item.systemFix,
      severity: item.businessSeverity,
      priority: item.businessPriority,
      route_chain: item.routeChain,
      recommendation: item.recommendation,
      implicated_subjects: item.implicatedSubjects,
      ready_handoffs: tracked?.readyHandoff
        ? [{
            id: tracked.readyHandoff.id,
            task_summary: tracked.readyHandoff.taskSummary,
            status: tracked.readyHandoff.status,
          }]
        : [],
    });
  }

  return [...grouped.values()];
}

function buildNextCards(
  brief: ExecutiveBrief,
  governance: GovernedStatusContext,
): Array<Record<string, unknown>> {
  const urgentIssueCards = buildGovernanceCards(governance.additionalAttention, governance)
    .filter((item) => String(item.priority ?? "") === "now")
    .map((item) => ({
      title: item.title,
      reason: item.impact ?? item.why ?? item.recommendation,
      recommended: true,
      action: item.system_fix ?? item.recommendation,
      affected_feature_labels: item.affected_feature_labels,
      ready_handoffs: item.ready_handoffs,
    }));

  const tableNextCards = brief.whatsNext.map((item) => ({
    title: item.featureLabel,
    reason: item.nextAction,
    recommended: false,
    action: item.nextAction,
    affected_feature_labels: [item.featureLabel],
    ready_handoffs: [],
  }));

  return [...urgentIssueCards, ...tableNextCards];
}

function buildFocusOptions(
  attentionCards: Array<Record<string, unknown>>,
  nextCards: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const options: Array<Record<string, unknown>> = [];

  for (const item of attentionCards) {
    const readyHandoffs = asArray(item.ready_handoffs);
    if (String(item.priority ?? "") !== "now" || readyHandoffs.length === 0) {
      continue;
    }
    options.push({
      title: item.title,
      recommended: true,
      why_now: item.impact ?? item.why ?? item.recommendation ?? null,
      action_if_approved: item.system_fix ?? item.recommendation ?? null,
    });
  }

  for (const item of nextCards) {
    if (options.length >= 2) {
      break;
    }
    if (Boolean(item.recommended)) {
      continue;
    }
    options.push({
      title: item.title,
      recommended: options.length === 0,
      why_now: item.reason ?? null,
      action_if_approved: item.action ?? null,
    });
  }

  return options.slice(0, 2);
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
      merged_at: feature.completion.mergedAt,
      review_cycles: feature.completion.reviewCycles,
      token_cost_tokens: feature.completion.tokenCostTokens,
      timing: feature.completion.timing,
      key_issue: feature.completion.keyIssue,
    } : null,
    governance_assessment: assessment ? {
      classification: assessment.classification,
      primary_concern: assessment.primaryConcern,
      review_assessment: assessment.reviewAssessmentLine,
      token_assessment: assessment.tokenAssessmentLine,
      timing_assessment: assessment.timingAssessmentLine,
      coo_read_fallback: assessment.cooReadLine,
      recommendation_fallback: assessment.recommendation,
      business_impact: assessment.businessImpact,
      business_severity: assessment.businessSeverity,
      business_priority: assessment.businessPriority,
      route_chain: assessment.routeChain,
      implicated_subjects: assessment.implicatedSubjects,
    } : null,
  };
}

function stripStatusTitle(value: string): string {
  return value
    .replace(/^# COO Executive Status\s*/i, "")
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
