import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { invoke } from "../../shared/llm-invoker/invoker.js";
import type { InvocationParams, InvocationResult } from "../../shared/llm-invoker/types.js";
import type { ExecutiveBrief, BriefSourceFacts, BriefFeatureSnapshot } from "./types.js";
import {
  isRecentLandedFeature,
  type LiveExecutiveSurface,
} from "./live-executive-surface.js";
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

interface FocusOptionEvidence {
  title: string;
  recommended: boolean;
  why_now: string | null;
  action_if_approved: string | null;
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
    "- When you mention recent landings, include whether approval before merge is proved when that evidence is available. If a merged landing lacks approval proof, that belongs in issues, not as a normal landing note.",
    "- Approval evidence here means durable pre-merge approval proof such as an approved commit record. Do not call it CEO approval unless the evidence explicitly says CEO approval.",
    "- If a trust or audit note does not require a CEO decision right now, keep it brief and out of the main attention bullets.",
    "The supported live CEO-facing section contract is:",
    "- opening paragraph",
    "- optional `**Delivery snapshot:**`",
    "- optional `**Recent landings:**`",
    "- `## Issues That Need Your Attention`",
    "- `## On The Table`",
    "- `## In Motion`",
    "- recommendation sentence plus final focus options",
    "Use these section headings exactly once in the final status body:",
    "## Issues That Need Your Attention",
    "## On The Table",
    "## In Motion",
    "Do not render a separate `## What's Next` section in the final status body.",
    "Do not render an `Operational context:` block in the final status body.",
    "Before those sections, write a short opening paragraph and then a `**Recent landings:**` block when recent landed work exists.",
    "In `**Recent landings:**`, use flat bullets in this style: `- Feature Name (review status, approval status, optional note)`.",
    "If review was not required, include the short reason why that is acceptable.",
    "If a landing has a suspicious review, approval, or KPI gap, you may still list it in `Recent landings`, but add a short `see issue below` note instead of pretending it is clean.",
    "Do not create a separate numbered list before the final call for action.",
    "If the evidence pack includes clear focus options, end the message with a short natural call for action.",
    "When you provide that final call for action:",
    "- put the COO recommendation as a short sentence immediately before the numbered options",
    "- include the COO recommendation inline, for example `(Recommended)` on the preferred option",
    "- keep the numbered list only at the end",
    "- include a third option that says the CEO can type a different task or priority directly",
    "- prefer exactly 3 options: recommended option, second concrete option, and `Other - type what you need`",
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

  return ensureSupportedLiveStatusBody(stripStatusTitle(invocation.response), options.surface, evidencePack);
}

async function loadStatusPrompt(promptsDir: string): Promise<string> {
  return readFile(join(promptsDir, "prompt.md"), "utf-8");
}

function buildStatusEvidencePack(
  options: StatusRenderAgentOptions,
): Record<string, unknown> {
  const { facts, brief, governance, statusWindow } = options;
  const landedFeatures = facts.features
    .filter((feature) => isRecentLandedFeature(facts.collectedAt, feature))
    .filter((feature) => feature.completion)
    .map((feature) => toLandedEvidence(feature, governance));
  const recentLandingsCompact = buildRecentLandingSummaries(landedFeatures);
  const groupedAttention = buildGovernanceCards(governance.additionalAttention, governance);
  const groupedTable = buildGovernanceCards(governance.additionalTable, governance);
  const groupedNext = buildNextCards(brief, governance);
  const focusOptions = buildFocusOptions(groupedAttention, groupedNext);

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
    recent_landings_compact: recentLandingsCompact,
    supported_live_contract: {
      required_sections: [
        "## Issues That Need Your Attention",
        "## On The Table",
        "## In Motion",
      ],
      forbidden_sections: [
        "## What's Next",
        "Operational context:",
      ],
      final_focus_options_required: focusOptions.length > 0,
      expected_focus_option_count: focusOptions.length > 0 ? 3 : 0,
    },
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
    focus_options: focusOptions,
    coo_recommendation: focusOptions.find((item) => Boolean(item.recommended)) ?? null,
    coo_recommendation_summary: buildRecommendationSummary(focusOptions),
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
  let approvalProvedCount = 0;
  let approvalGapCount = 0;
  let suspiciousCostGapCount = 0;
  let acceptableLegacyCostGapCount = 0;
  let durableTokenCostCount = 0;

  for (const landed of landedFeatures) {
    const assessment = asRecord(landed.governance_assessment);
    const reviewLine = String(assessment.review_assessment ?? "");
    const approvalLine = String(assessment.approval_assessment ?? "");
    const tokenLine = String(assessment.token_assessment ?? "");

    if (/review governance is evidenced/i.test(reviewLine)) {
      reviewEvidencedCount += 1;
    } else if (/acceptable/i.test(reviewLine) || /predate/i.test(reviewLine)) {
      reviewLegacyAcceptedCount += 1;
    }

    if (/approved commit is recorded/i.test(approvalLine)) {
      approvalProvedCount += 1;
    } else if (/does not prove which approved commit|missing durable proof/i.test(approvalLine)) {
      approvalGapCount += 1;
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
    merge_approval: {
      proved_count: approvalProvedCount,
      suspicious_gap_count: approvalGapCount,
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

function ensureSupportedLiveStatusBody(
  body: string,
  surface: LiveExecutiveSurface,
  evidencePack: Record<string, unknown>,
): string {
  const violations = collectSupportedLiveStatusViolations(body, evidencePack);
  if (violations.length === 0) {
    return body.trim();
  }

  return renderDeterministicSupportedStatus(surface, evidencePack);
}

function buildRecentLandingSummaries(
  landedFeatures: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return landedFeatures.map((landed) => {
    const featureLabel = String(landed.feature_label ?? "Feature");
    const assessment = asRecord(landed.governance_assessment);
    const classification = String(assessment.classification ?? "confirmed");
    const primaryConcern = String(assessment.primary_concern ?? "");
    const reviewSummary = summarizeReviewStatus(String(assessment.review_assessment ?? ""));
    const approvalSummary = summarizeApprovalStatus(String(assessment.approval_assessment ?? ""));
    const landingNotes = summarizeLandingNotes(
      classification,
      primaryConcern,
      String(assessment.token_assessment ?? ""),
    );

    return {
      feature_label: featureLabel,
      review_status: reviewSummary,
      approval_status: approvalSummary,
      landing_note: landingNotes,
      compact_line: [reviewSummary, approvalSummary, landingNotes].filter(Boolean).join(", "),
      suspicious: classification === "suspicious" || classification === "contradicted",
    };
  });
}

function summarizeReviewStatus(reviewLine: string): string {
  const reviewCycleMatch = reviewLine.match(/Review check:\s*(\d+)\s+completed review cycles?/i);
  if (reviewCycleMatch) {
    const count = Number(reviewCycleMatch[1]);
    return count === 1 ? "1 review cycle" : `${count} review cycles`;
  }

  if (/review-cycle was not required/i.test(reviewLine)) {
    return "no review required - route timing accepted";
  }

  if (/predate the enforced review-governance route/i.test(reviewLine)) {
    return "no review required - landed before review governance";
  }

  if (/review governance should have applied/i.test(reviewLine)) {
    return "required review missing - see issue below";
  }

  if (/does not prove review governance/i.test(reviewLine)) {
    return "review proof incomplete - see issue below";
  }

  return "review status unclear";
}

function summarizeApprovalStatus(approvalLine: string): string {
  if (/approved commit is recorded/i.test(approvalLine)) {
    return "approval before merge proved";
  }

  if (/does not prove which approved commit/i.test(approvalLine)) {
    return "approval proof missing - see issue below";
  }

  return "approval status not proved";
}

function summarizeLandingNotes(
  classification: string,
  primaryConcern: string,
  tokenLine: string,
): string | null {
  if (classification === "suspicious" && primaryConcern === "kpi") {
    return "cost data missing - see issue below";
  }

  if (/rollout slice itself/i.test(tokenLine)) {
    return "cost telemetry gap is acceptable on the KPI rollout slice itself";
  }

  if (/predates the KPI capture rollout/i.test(tokenLine)) {
    return "cost data gap is historical";
  }

  return null;
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

function buildRecommendationSummary(
  focusOptions: Array<Record<string, unknown>>,
): string | null {
  const recommended = focusOptions.find((item) => Boolean(item.recommended));
  if (!recommended) {
    return null;
  }
  const title = String(recommended.title ?? "the recommended item");
  const whyNow = String(recommended.why_now ?? "").trim();
  return whyNow.length > 0
    ? `My recommendation is to focus on ${title} first because ${lowercaseFirst(whyNow)}`
    : `My recommendation is to focus on ${title} first.`;
}

function collectSupportedLiveStatusViolations(
  body: string,
  evidencePack: Record<string, unknown>,
): string[] {
  const violations: string[] = [];
  const normalized = body.replace(/\r\n/g, "\n").trim();
  const requiredHeadings = [
    "## Issues That Need Your Attention",
    "## On The Table",
    "## In Motion",
  ];

  for (const heading of requiredHeadings) {
    if (!normalized.includes(heading)) {
      violations.push(`missing:${heading}`);
    }
  }

  if (/\n## What's Next\b/.test(`\n${normalized}`)) {
    violations.push("forbidden:## What's Next");
  }

  if (/\nOperational context:\s*/i.test(`\n${normalized}`)) {
    violations.push("forbidden:Operational context");
  }

  const recentLandings = asArray(evidencePack.recent_landings_compact);
  if (recentLandings.length > 0 && !normalized.includes("**Recent landings:**")) {
    violations.push("missing:recent-landings");
  }

  const focusOptions = asFocusOptions(evidencePack.focus_options);
  if (focusOptions.length > 0) {
    for (const optionNumber of [1, 2, 3]) {
      if (!new RegExp(`(^|\\n)${optionNumber}\\.\\s`, "m").test(normalized)) {
        violations.push(`missing:focus-option-${optionNumber}`);
      }
    }
  }

  return violations;
}

function renderDeterministicSupportedStatus(
  surface: LiveExecutiveSurface,
  evidencePack: Record<string, unknown>,
): string {
  const lines: string[] = [surface.opening];
  const deliverySnapshot = renderDeliverySnapshot(evidencePack.company_performance);

  if (deliverySnapshot) {
    lines.push("");
    lines.push(`**Delivery snapshot:** ${deliverySnapshot}`);
  }

  const recentLandings = asArray(evidencePack.recent_landings_compact)
    .map((entry) => asRecord(entry))
    .filter((entry) => String(entry.feature_label ?? "").trim().length > 0);
  if (recentLandings.length > 0) {
    lines.push("");
    lines.push("**Recent landings:**");
    for (const item of recentLandings) {
      const featureLabel = String(item.feature_label ?? "Feature");
      const compactLine = String(item.compact_line ?? "").trim();
      lines.push(compactLine.length > 0
        ? `- ${featureLabel} (${compactLine})`
        : `- ${featureLabel}`);
    }
  }

  renderEvidenceSection(
    lines,
    "Issues That Need Your Attention",
    asArray(evidencePack.executive_sections && asRecord(evidencePack.executive_sections).issues),
    "No current blocked item or contradiction requires direct CEO attention.",
  );
  renderEvidenceSection(
    lines,
    "On The Table",
    asArray(evidencePack.executive_sections && asRecord(evidencePack.executive_sections).on_the_table),
    "No unresolved shaping, governance, or decision item is currently on the table.",
  );
  renderEvidenceSection(
    lines,
    "In Motion",
    asArray(evidencePack.executive_sections && asRecord(evidencePack.executive_sections).in_motion),
    "Nothing actively in flight right now.",
  );

  const recommendation = String(evidencePack.coo_recommendation_summary ?? "").trim();
  const focusOptions = asFocusOptions(evidencePack.focus_options);
  if (recommendation.length > 0 || focusOptions.length > 0) {
    lines.push("");
    if (recommendation.length > 0) {
      lines.push(recommendation);
    }
    if (focusOptions.length > 0) {
      lines.push("");
      lines.push("Where would you like to focus?");
      lines.push("");
      for (const [index, option] of focusOptions.entries()) {
        const title = option.title || `Option ${index + 1}`;
        const suffix = option.recommended ? " (Recommended)" : "";
        const whyNow = option.action_if_approved
          ? ` - ${option.action_if_approved}`
          : option.why_now
            ? ` - ${option.why_now}`
            : "";
        lines.push(`${index + 1}. **${title}**${suffix}${whyNow}`);
      }
      lines.push(`${focusOptions.length + 1}. **Other** - type what you need`);
    }
  }

  return lines.join("\n").trim();
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
      approval_assessment: assessment.approvalAssessmentLine,
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

function renderDeliverySnapshot(companyPerformance: unknown): string | null {
  const record = asRecord(companyPerformance);
  const recentCount = Number(record.recent_landed_count ?? 0);
  const reviewGovernance = asRecord(record.review_governance);
  const mergeApproval = asRecord(record.merge_approval);
  const costVisibility = asRecord(record.cost_visibility);
  const parts: string[] = [];

  if (recentCount > 0) {
    parts.push(`${recentCount} feature${recentCount === 1 ? "" : "s"} landed recently.`);
  }

  const reviewEvidencedCount = Number(reviewGovernance.evidenced_count ?? 0);
  const reviewLegacyCount = Number(reviewGovernance.acceptable_legacy_count ?? 0);
  if (reviewEvidencedCount > 0 || reviewLegacyCount > 0) {
    parts.push(`${reviewEvidencedCount} have evidenced review governance, ${reviewLegacyCount} are acceptable legacy.`);
  }

  const approvalProvedCount = Number(mergeApproval.proved_count ?? 0);
  if (approvalProvedCount > 0) {
    parts.push(`${approvalProvedCount} have proved pre-merge approval on record.`);
  }

  const auditabilityRead = String(record.auditability_read ?? "").trim();
  if (auditabilityRead.length > 0) {
    parts.push(auditabilityRead);
  } else {
    const suspiciousCostGapCount = Number(costVisibility.suspicious_gap_count ?? 0);
    if (suspiciousCostGapCount > 0) {
      parts.push(`${suspiciousCostGapCount} suspicious cost-visibility gap${suspiciousCostGapCount === 1 ? "" : "s"} need follow-up.`);
    }
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

function renderEvidenceSection(
  lines: string[],
  heading: string,
  rawItems: unknown[],
  emptyLine: string,
): void {
  lines.push("");
  lines.push(`## ${heading}`);
  if (rawItems.length === 0) {
    lines.push(emptyLine);
    return;
  }

  for (const rawItem of rawItems) {
    const item = asRecord(rawItem);
    const title = String(item.title ?? item.feature_label ?? "Item").trim();
    const affected = asArray(item.affected_feature_labels).map((entry) => String(entry)).filter(Boolean);
    const titleLine = affected.length > 0 && !affected.includes(title)
      ? `${title} (${affected.join(", ")}):`
      : `${title}:`;
    lines.push(`- ${titleLine}`);

    const summary = firstNonEmptyString([
      item.summary,
      item.reason,
      item.progress_summary,
    ]);
    if (summary) {
      lines.push(`  ${summary}`);
    }

    const why = firstNonEmptyString([item.why]);
    if (why) {
      lines.push(`  Why: ${why}`);
    }
    const impact = firstNonEmptyString([item.impact]);
    if (impact) {
      lines.push(`  Impact: ${impact}`);
    }
    const fix = firstNonEmptyString([item.system_fix, item.action, item.recommendation]);
    if (fix) {
      lines.push(`  Fix: ${fix}`);
    }

    const priorityParts = [item.severity, item.priority]
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean);
    if (priorityParts.length > 0) {
      lines.push(`  Priority: ${priorityParts.join(" / ")}.`);
    }

    const evidence = firstNonEmptyString([item.evidence]);
    if (evidence) {
      lines.push(`  Evidence: ${evidence}`);
    }
  }
}

function stripStatusTitle(value: string): string {
  return value
    .replace(/^# COO Executive Status\s*/i, "")
    .trim();
}

function lowercaseFirst(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asFocusOptions(value: unknown): FocusOptionEvidence[] {
  return asArray(value)
    .map((entry) => asRecord(entry))
    .map((entry) => ({
      title: String(entry.title ?? "").trim(),
      recommended: Boolean(entry.recommended),
      why_now: typeof entry.why_now === "string" ? entry.why_now : null,
      action_if_approved: typeof entry.action_if_approved === "string" ? entry.action_if_approved : null,
    }))
    .filter((entry) => entry.title.length > 0);
}

function firstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text.length > 0) {
      return text;
    }
  }
  return null;
}
