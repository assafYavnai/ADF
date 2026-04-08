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
  kind: "action" | "details";
}

interface ExecutiveDecisionIssue {
  key: string;
  title: string;
  problem: string;
  evidence_bridge: string;
  fix: string | null;
  urgency: string | null;
  severity: string | null;
  priority: string | null;
  affected_count: number;
  affected_feature_labels: string[];
}

interface ExecutiveParkedItem {
  title: string;
  summary: string;
}

interface ExecutiveBriefingEvidence {
  bottom_line: string;
  delivery_health: string[];
  decision_issues: ExecutiveDecisionIssue[];
  parked_waiting: ExecutiveParkedItem[];
  recommendation: string | null;
  focus_options: FocusOptionEvidence[];
  active_motion_count: number;
}

interface StatusEvidenceContext {
  facts: BriefSourceFacts;
  brief: ExecutiveBrief;
  governance: GovernedStatusContext;
  surface: LiveExecutiveSurface;
  statusWindow: GitStatusWindow | null;
}

export interface SupportedLiveStatusBodyParity {
  issuesExpected: number;
  issuesActual: number;
  tableExpected: number;
  tableActual: number;
  inMotionExpected: number;
  inMotionActual: number;
  nextExpected: number;
  nextActual: number;
  recentLandingsExpected: number;
  recentLandingsActual: number;
}

export interface SupportedLiveStatusBodyAssessment {
  visibility: SupportedLiveStatusBodyParity;
  violations: string[];
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
    "Present the company at a high level, as a COO briefing a CEO naturally in chat.",
    "Keep it concise, human, and easy to scan.",
    "Use the synthesized `executive_briefing` evidence as the primary display contract. Treat the raw issue arrays as supporting detail, not the default surface.",
    "Use exactly these heading lines once each in this order:",
    "**Bottom line**",
    "**Delivery health**",
    "**Issues that need a decision**",
    "**Parked / waiting**",
    "**Recommendation**",
    "Formatting rules:",
    "- Keep the main body to roughly one screen.",
    "- Do not list every landed feature in the main brief.",
    "- Under `**Issues that need a decision**`, show at most 2 systemic issues.",
    "- For each issue, keep to: numbered headline, one problem sentence, one evidence-bridge sentence, and one fix sentence.",
    "- Use the counts from the evidence pack to explain why an issue matters now.",
    "- If a handoff exists, say that it is prepared, but do not print the internal handoff id.",
    "- Use `---` between major issue blocks when more than one issue is shown.",
    "- Keep technical route names out of the prose unless they are required to explain business impact.",
    "- The default brief is aggregate-first. Detail belongs behind the focus options, not in the main body.",
    "Focus-option rules:",
    "- Put the recommendation sentence inside the `**Recommendation**` section before any numbered list.",
    "- If there are at least 2 supported focus options, render them as the final numbered list.",
    "- Include the recommended action first and mark it `(Recommended)`.",
    "- Include `Show detailed breakdown` when the evidence pack says more detail is available.",
    "- End the numbered list with `Other - type what you need`.",
    "- Do not render the old sections `## Issues That Need Your Attention`, `## On The Table`, `## In Motion`, `**Recent landings:**`, or `**Delivery snapshot:**`.",
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
  options: StatusEvidenceContext,
): Record<string, unknown> {
  const { facts, brief, governance, statusWindow, surface } = options;
  const landedFeatures = facts.features
    .filter((feature) => isRecentLandedFeature(facts.collectedAt, feature))
    .filter((feature) => feature.completion)
    .map((feature) => toLandedEvidence(feature, governance));
  const companyPerformance = buildCompanyPerformance(landedFeatures);
  const recentLandingsCompact = buildRecentLandingSummaries(landedFeatures);
  const groupedAttention = buildGovernanceCards(governance.additionalAttention, governance);
  const issueCards = buildIssueCards(surface, groupedAttention);
  const groupedTable = buildGovernanceCards(governance.additionalTable, governance);
  const groupedNext = buildNextCards(brief, governance);
  const tableCards = buildTableCards(brief, groupedTable);
  const executiveBriefing = buildExecutiveBriefing({
    brief,
    statusWindow,
    companyPerformance,
    issueCards,
    tableCards,
    nextCards: groupedNext,
  });
  const focusOptions = executiveBriefing.focus_options;

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
      current_worktree_feature_slugs: statusWindow.currentWorktreeFeatureSlugs,
      visibility_gap_sources: statusWindow.visibilityGapSources,
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
    company_performance: companyPerformance,
    landed_recently: landedFeatures,
    recent_landings_compact: recentLandingsCompact,
    executive_briefing: executiveBriefing,
    supported_live_contract: {
      required_sections: [
        "**Bottom line**",
        "**Delivery health**",
        "**Issues that need a decision**",
        "**Parked / waiting**",
        "**Recommendation**",
      ],
      forbidden_sections: [
        "## Issues That Need Your Attention",
        "## On The Table",
        "## In Motion",
        "**Recent landings:**",
        "**Delivery snapshot:**",
      ],
      final_focus_options_required: focusOptions.length >= 2,
      expected_focus_option_count: focusOptions.length >= 2 ? focusOptions.length + 1 : 0,
    },
    executive_sections: {
      issues: issueCards,
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
      attention: issueCards,
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

function buildExecutiveBriefing(input: {
  brief: ExecutiveBrief;
  statusWindow: GitStatusWindow | null;
  companyPerformance: Record<string, unknown>;
  issueCards: Array<Record<string, unknown>>;
  tableCards: Array<Record<string, unknown>>;
  nextCards: Array<Record<string, unknown>>;
}): ExecutiveBriefingEvidence {
  const executiveIssueCards = groupIssueCardsForExecutive(input.issueCards, input.companyPerformance, input.statusWindow);
  const rankedIssueCards = [...executiveIssueCards].sort((left, right) =>
    executiveIssueScore(right, input.companyPerformance, input.statusWindow)
      - executiveIssueScore(left, input.companyPerformance, input.statusWindow));
  const initial = renderExecutiveBriefingSections(rankedIssueCards, input);
  const missingCurrentWorktreeVisibility = collectMissingCurrentWorktreeVisibility(
    input.statusWindow,
    initial.decisionIssues,
    initial.parkedWaiting,
    initial.focusOptions,
  );
  if (missingCurrentWorktreeVisibility.length === 0) {
    return {
      bottom_line: buildExecutiveBottomLine(input.companyPerformance, input.brief.inMotion.length, initial.decisionIssues.length),
      delivery_health: buildExecutiveDeliveryHealth(input.companyPerformance),
      decision_issues: initial.decisionIssues,
      parked_waiting: initial.parkedWaiting,
      recommendation: buildExecutiveRecommendation(initial.decisionIssues),
      focus_options: initial.focusOptions,
      active_motion_count: input.brief.inMotion.length,
    };
  }

  const visibilityIssue = buildCurrentWorktreeVisibilityIssueCard(missingCurrentWorktreeVisibility);
  const rerankedIssueCards = [visibilityIssue, ...rankedIssueCards]
    .sort((left, right) =>
      executiveIssueScore(right, input.companyPerformance, input.statusWindow)
        - executiveIssueScore(left, input.companyPerformance, input.statusWindow));
  const rerendered = renderExecutiveBriefingSections(rerankedIssueCards, input);

  return {
    bottom_line: buildExecutiveBottomLine(input.companyPerformance, input.brief.inMotion.length, rerendered.decisionIssues.length),
    delivery_health: buildExecutiveDeliveryHealth(input.companyPerformance),
    decision_issues: rerendered.decisionIssues,
    parked_waiting: rerendered.parkedWaiting,
    recommendation: buildExecutiveRecommendation(rerendered.decisionIssues),
    focus_options: rerendered.focusOptions,
    active_motion_count: input.brief.inMotion.length,
  };
}

function renderExecutiveBriefingSections(
  rankedIssueCards: Array<Record<string, unknown>>,
  input: {
    brief: ExecutiveBrief;
    statusWindow: GitStatusWindow | null;
    companyPerformance: Record<string, unknown>;
    tableCards: Array<Record<string, unknown>>;
    nextCards: Array<Record<string, unknown>>;
  },
): {
  decisionIssues: ExecutiveDecisionIssue[];
  parkedWaiting: ExecutiveParkedItem[];
  focusOptions: FocusOptionEvidence[];
} {
  const decisionIssues = rankedIssueCards
    .slice(0, 2)
    .map((item) => toExecutiveDecisionIssue(item, input.companyPerformance, input.statusWindow));
  const decisionKeys = new Set(decisionIssues.map((item) => item.key));
  const parkedWaiting = buildExecutiveParkedItems(
    rankedIssueCards.filter((item) => !decisionKeys.has(executiveIssueKey(item))),
    input.tableCards,
    input.nextCards,
    decisionIssues,
  );
  const focusOptions = buildExecutiveFocusOptions(decisionIssues, input.tableCards, input.nextCards, parkedWaiting, input.companyPerformance);
  return { decisionIssues, parkedWaiting, focusOptions };
}

function collectMissingCurrentWorktreeVisibility(
  statusWindow: GitStatusWindow | null,
  decisionIssues: ExecutiveDecisionIssue[],
  parkedWaiting: ExecutiveParkedItem[],
  focusOptions: FocusOptionEvidence[],
): string[] {
  const currentWorktreeFeatureSlugs = statusWindow?.currentWorktreeFeatureSlugs ?? [];
  if (currentWorktreeFeatureSlugs.length === 0) {
    return [];
  }

  const visibleText = normalizeForEvidenceMatch([
    ...decisionIssues.flatMap((item) => [item.title, item.problem, item.evidence_bridge]),
    ...parkedWaiting.flatMap((item) => [item.title, item.summary]),
    ...focusOptions.flatMap((item) => [item.title, item.why_now, item.action_if_approved]),
  ].map((value) => String(value ?? "")).join(" "));

  return currentWorktreeFeatureSlugs.filter((slug) => {
    const humanized = humanizeFeatureSlug(slug);
    return !visibleText.includes(normalizeForEvidenceMatch(humanized))
      && !visibleText.includes(normalizeForEvidenceMatch(slug));
  });
}

function buildCurrentWorktreeVisibilityIssueCard(
  missingFeatureSlugs: string[],
): Record<string, unknown> {
  const affectedFeatureLabels = missingFeatureSlugs.map((slug) => humanizeFeatureSlug(slug));
  const affectedSummary = affectedFeatureLabels.length === 1
    ? affectedFeatureLabels[0]
    : affectedFeatureLabels.join(", ");

  return {
    title: `Current work on ${affectedSummary} is missing from the current COO surface.`,
    affected_feature_labels: affectedFeatureLabels,
    classification: "confirmed",
    evidence: affectedFeatureLabels.length === 1
      ? `The active implement-plan worktree for ${affectedSummary} is present, but the final COO brief still does not visibly carry it.`
      : "Active implement-plan worktree slices are present, but the final COO brief still does not visibly carry them.",
    why: "Recent work is not consistently making it into the COO reporting surface, so this brief can miss live context.",
    impact: "If active work drops out of COO context, leadership can act on an incomplete company picture.",
    system_fix: "Wire the missing active slice into the COO surface before relying on this update for prioritization.",
    severity: "high",
    priority: "now",
    route_chain: [
      "The current implement-plan worktree carries active slice context.",
      "The final CEO brief still does not visibly carry that slice.",
      "Surface visibility must be repaired before the brief can be treated as complete.",
    ],
    recommendation: "Wire the missing active slice into the COO surface before relying on this update for prioritization.",
    implicated_subjects: ["route:coo-status"],
    representative_handoff: null,
    affected_count: affectedFeatureLabels.length,
  };
}

function executiveIssueScore(
  item: Record<string, unknown>,
  companyPerformance: Record<string, unknown>,
  statusWindow: GitStatusWindow | null,
): number {
  const severity = String(item.severity ?? "").trim();
  const priority = String(item.priority ?? "").trim();
  const affectedCount = Number(item.affected_count ?? 1);
  const classification = classifyExecutiveIssue(item, companyPerformance, statusWindow);

  let score = affectedCount * 5;
  switch (severity) {
    case "high":
      score += 200;
      break;
    case "medium":
      score += 120;
      break;
    case "low":
      score += 60;
      break;
    default:
      break;
  }

  switch (priority) {
    case "now":
      score += 40;
      break;
    case "this_week":
      score += 20;
      break;
    case "next":
      score += 10;
      break;
    default:
      break;
  }

  if (Boolean(item.representative_handoff)) {
    score += 15;
  }
  if (classification === "status_coverage_gap") {
    score += 200;
  }
  if (classification === "kpi_gap") {
    score += 70;
  }

  return score;
}

function toExecutiveDecisionIssue(
  item: Record<string, unknown>,
  companyPerformance: Record<string, unknown>,
  statusWindow: GitStatusWindow | null,
): ExecutiveDecisionIssue {
  return {
    key: executiveIssueKey(item),
    title: deriveExecutiveIssueTitle(item, companyPerformance, statusWindow),
    problem: deriveExecutiveIssueProblem(item, companyPerformance, statusWindow),
    evidence_bridge: deriveExecutiveEvidenceBridge(item, companyPerformance, statusWindow),
    fix: deriveExecutiveFix(item),
    urgency: formatExecutiveUrgency(item),
    severity: firstNonEmptyString([item.severity]),
    priority: firstNonEmptyString([item.priority]),
    affected_count: Number(item.affected_count ?? 1),
    affected_feature_labels: asArray(item.affected_feature_labels).map((entry) => String(entry)).filter(Boolean),
  };
}

function buildExecutiveBottomLine(
  companyPerformance: Record<string, unknown>,
  activeMotionCount: number,
  decisionIssueCount: number,
): string {
  const recentCount = Number(companyPerformance.recent_landed_count ?? 0);
  const parts: string[] = [];

  if (recentCount > 0) {
    parts.push(`${recentCount} feature${recentCount === 1 ? "" : "s"} shipped in the recent window.`);
  }

  parts.push(
    activeMotionCount === 0
      ? "Nothing is actively executing right now."
      : `${activeMotionCount} item${activeMotionCount === 1 ? " is" : "s are"} actively executing right now.`,
  );

  if (decisionIssueCount === 0) {
    parts.push("No systemic issue needs your decision right now.");
  } else if (decisionIssueCount === 1) {
    parts.push("One systemic issue needs your decision before we move forward.");
  } else {
    parts.push(`${decisionIssueCount} systemic issues need your decision before we move forward.`);
  }

  return parts.join(" ");
}

function buildExecutiveDeliveryHealth(
  companyPerformance: Record<string, unknown>,
): string[] {
  const reviewGovernance = asRecord(companyPerformance.review_governance);
  const mergeApproval = asRecord(companyPerformance.merge_approval);
  const costVisibility = asRecord(companyPerformance.cost_visibility);
  const recentCount = Number(companyPerformance.recent_landed_count ?? 0);
  const reviewEvidenced = Number(reviewGovernance.evidenced_count ?? 0);
  const reviewLegacy = Number(reviewGovernance.acceptable_legacy_count ?? 0);
  const approvalProved = Number(mergeApproval.proved_count ?? 0);
  const approvalGaps = Number(mergeApproval.suspicious_gap_count ?? 0);
  const suspiciousCostGaps = Number(costVisibility.suspicious_gap_count ?? 0);
  const historicalCostGaps = Number(costVisibility.acceptable_legacy_gap_count ?? 0);
  const lines: string[] = [];

  if (recentCount > 0) {
    lines.push(`${recentCount} feature${recentCount === 1 ? "" : "s"} landed in the recent window.`);
  }
  if (reviewEvidenced > 0 || reviewLegacy > 0) {
    lines.push(`${reviewEvidenced} of ${recentCount || reviewEvidenced} have full review-cycle evidence${reviewLegacy > 0 ? `; ${reviewLegacy} more are acceptable legacy items` : ""}.`);
  }
  if (approvalProved > 0 || approvalGaps > 0) {
    const total = recentCount || approvalProved + approvalGaps;
    lines.push(`${approvalProved} of ${total} have proved pre-merge approval on record${approvalGaps > 0 ? `; ${approvalGaps} still need stronger approval proof` : ""}.`);
  }
  if (suspiciousCostGaps > 0) {
    lines.push(`${suspiciousCostGaps} of ${recentCount || suspiciousCostGaps} landed features are missing durable KPI cost totals; the work shipped, but the receipts did not.`);
  } else if (historicalCostGaps > 0) {
    lines.push(`${historicalCostGaps} cost-data gaps are historical or explicitly acceptable legacy items.`);
  } else {
    lines.push("The work looks solid; the remaining questions are about route quality, not delivery quality.");
  }

  return lines;
}

function buildExecutiveParkedItems(
  remainingIssueCards: Array<Record<string, unknown>>,
  tableCards: Array<Record<string, unknown>>,
  nextCards: Array<Record<string, unknown>>,
  decisionIssues: ExecutiveDecisionIssue[],
): ExecutiveParkedItem[] {
  const items: ExecutiveParkedItem[] = [];
  const seen = new Set(decisionIssues.map((item) => item.title.toLowerCase()));

  for (const rawItem of nextCards) {
    const title = firstNonEmptyString([rawItem.title, rawItem.feature_label]);
    if (!title) {
      continue;
    }
    const key = title.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({
      title,
      summary: stripInternalRouteText(firstNonEmptyString([rawItem.reason, rawItem.summary, rawItem.action]) ?? "Awaiting follow-up."),
    });
  }

  for (const rawItem of tableCards) {
    const title = firstNonEmptyString([rawItem.title, rawItem.feature_label]);
    if (!title) {
      continue;
    }
    const key = title.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({
      title,
      summary: stripInternalRouteText(firstNonEmptyString([rawItem.reason, rawItem.summary, rawItem.action]) ?? "Awaiting follow-up."),
    });
  }

  for (const rawItem of remainingIssueCards) {
    const title = deriveExecutiveIssueTitle(rawItem, {}, null);
    const key = title.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({
      title,
      summary: firstNonEmptyString([
        deriveExecutiveEvidenceBridge(rawItem, {}, null),
        stripInternalRouteText(firstNonEmptyString([rawItem.reason, rawItem.summary, rawItem.why]) ?? ""),
      ]) ?? "Details are available on request.",
    });
  }

  return items.slice(0, 4);
}

function groupIssueCardsForExecutive(
  issueCards: Array<Record<string, unknown>>,
  companyPerformance: Record<string, unknown>,
  statusWindow: GitStatusWindow | null,
): Array<Record<string, unknown>> {
  const grouped = new Map<string, Record<string, unknown>>();

  for (const item of issueCards) {
    const key = deriveExecutiveIssueTitle(item, companyPerformance, statusWindow).toLowerCase();
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...item });
      continue;
    }

    const preferred = executiveIssueScore(existing, companyPerformance, statusWindow) >= executiveIssueScore(item, companyPerformance, statusWindow)
      ? existing
      : item;
    const mergedLabels = uniqueStrings([
      ...asArray(existing.affected_feature_labels).map((entry) => String(entry)).filter(Boolean),
      ...asArray(item.affected_feature_labels).map((entry) => String(entry)).filter(Boolean),
    ]);
    const merged: Record<string, unknown> = {
      ...preferred,
      affected_feature_labels: mergedLabels,
      affected_count: mergedLabels.length > 0
        ? mergedLabels.length
        : Math.max(Number(existing.affected_count ?? 1), Number(item.affected_count ?? 1)),
      representative_handoff: existing.representative_handoff ?? item.representative_handoff ?? null,
      why: firstNonEmptyString([preferred.why, existing.why, item.why]),
      impact: firstNonEmptyString([preferred.impact, existing.impact, item.impact]),
      system_fix: chooseLongerString(
        firstNonEmptyString([existing.system_fix, existing.action, existing.recommendation]),
        firstNonEmptyString([item.system_fix, item.action, item.recommendation]),
      ),
      recommendation: chooseLongerString(
        firstNonEmptyString([existing.recommendation, existing.system_fix, existing.action]),
        firstNonEmptyString([item.recommendation, item.system_fix, item.action]),
      ),
      evidence: chooseLongerString(firstNonEmptyString([existing.evidence]), firstNonEmptyString([item.evidence])),
    };
    grouped.set(key, merged);
  }

  return [...grouped.values()];
}

function buildExecutiveFocusOptions(
  decisionIssues: ExecutiveDecisionIssue[],
  tableCards: Array<Record<string, unknown>>,
  nextCards: Array<Record<string, unknown>>,
  parkedWaiting: ExecutiveParkedItem[],
  companyPerformance: Record<string, unknown>,
): FocusOptionEvidence[] {
  const options: FocusOptionEvidence[] = [];
  const seen = new Set<string>();

  const pushOption = (option: FocusOptionEvidence): void => {
    const key = option.title.toLowerCase();
    if (key.length === 0 || seen.has(key)) {
      return;
    }
    seen.add(key);
    options.push(option);
  };

  if (decisionIssues[0]) {
    pushOption({
      title: decisionIssues[0].title,
      recommended: true,
      why_now: decisionIssues[0].evidence_bridge,
      action_if_approved: decisionIssues[0].fix,
      kind: "action",
    });
  }

  if (decisionIssues[1]) {
    pushOption({
      title: decisionIssues[1].title,
      recommended: false,
      why_now: decisionIssues[1].evidence_bridge,
      action_if_approved: decisionIssues[1].fix,
      kind: "action",
    });
  } else {
    const fallback = [...nextCards, ...tableCards].find((item) => {
      const title = String(item.title ?? item.feature_label ?? "").trim();
      if (title.length === 0 || seen.has(title.toLowerCase())) {
        return false;
      }
      const executiveTitle = deriveExecutiveIssueTitle(item, companyPerformance, null).toLowerCase();
      return !seen.has(executiveTitle);
    });

    if (fallback) {
      pushOption({
        title: String(fallback.title ?? fallback.feature_label ?? "").trim(),
        recommended: false,
        why_now: firstNonEmptyString([fallback.reason, fallback.summary]),
        action_if_approved: firstNonEmptyString([fallback.action, fallback.system_fix, fallback.recommendation]),
        kind: "action",
      });
    }
  }

  const recentCount = Number(companyPerformance.recent_landed_count ?? 0);
  const hiddenDetailAvailable = parkedWaiting.length > 0 || recentCount > 0;
  if (hiddenDetailAvailable) {
    pushOption({
      title: "Show detailed breakdown",
      recommended: false,
      why_now: "Open the landing-by-landing and evidence-level detail behind this brief.",
      action_if_approved: "Review the detailed breakdown before deciding.",
      kind: "details",
    });
  }

  return options.slice(0, 3);
}

function buildExecutiveRecommendation(
  decisionIssues: ExecutiveDecisionIssue[],
): string | null {
  if (decisionIssues.length === 0) {
    return "No new escalation is stronger than the work already on the table.";
  }

  const [firstIssue, secondIssue] = decisionIssues;
  if (!secondIssue) {
    return `Fix ${lowercaseFirst(firstIssue.title)} first. ${buildRecommendationReason(firstIssue)}`;
  }

  return `Fix ${lowercaseFirst(firstIssue.title)} first, then ${lowercaseFirst(secondIssue.title)}. ${buildRecommendationReason(firstIssue)}`;
}

function buildRecommendationReason(issue: ExecutiveDecisionIssue): string {
  switch (classifyExecutiveIssue(issue as unknown as Record<string, unknown>, {}, null)) {
    case "status_coverage_gap":
      return "Until the COO surface sees current work truthfully, every other priority call can be based on an incomplete picture.";
    case "kpi_gap":
      return "Until durable cost receipts survive closeout, we cannot fully audit what recent delivery cost us.";
    case "missing_source":
      return "Until the missing source family becomes readable, the related conclusions stay provisional.";
    default:
      return "It is the highest-leverage route risk in the current brief.";
  }
}

function executiveIssueKey(item: Record<string, unknown>): string {
  return [
    normalizeForEvidenceMatch(firstNonEmptyString([item.title, item.feature_label]) ?? ""),
    normalizeForEvidenceMatch(firstNonEmptyString([item.why, item.summary]) ?? ""),
    normalizeForEvidenceMatch(firstNonEmptyString([item.system_fix, item.action, item.recommendation]) ?? ""),
  ].join("|");
}

function classifyExecutiveIssue(
  item: Record<string, unknown>,
  companyPerformance: Record<string, unknown>,
  statusWindow: GitStatusWindow | null,
): "kpi_gap" | "status_coverage_gap" | "missing_source" | "review_gap" | "generic" {
  const combined = normalizeForEvidenceMatch([
    item.title,
    item.summary,
    item.why,
    item.impact,
    item.system_fix,
    item.recommendation,
    item.evidence,
  ].map((value) => String(value ?? "")).join(" "));

  if (
    combined.includes("current coo surface")
    || combined.includes("status coverage")
    || combined.includes("recent git activity")
  ) {
    return "status_coverage_gap";
  }

  if (
    combined.includes("token totals")
    || combined.includes("kpi")
    || combined.includes("cost data")
    || combined.includes("closeout route")
  ) {
    return "kpi_gap";
  }

  if (combined.includes("missing source") || combined.includes("fallback evidence")) {
    return "missing_source";
  }

  if (combined.includes("review proof") || combined.includes("review governance")) {
    return "review_gap";
  }

  return "generic";
}

function deriveExecutiveIssueTitle(
  item: Record<string, unknown>,
  companyPerformance: Record<string, unknown>,
  statusWindow: GitStatusWindow | null,
): string {
  switch (classifyExecutiveIssue(item, companyPerformance, statusWindow)) {
    case "kpi_gap":
      return "Cost auditability gap";
    case "status_coverage_gap":
      return "COO dashboard blind spot";
    case "missing_source":
      return "Source truth gap";
    case "review_gap":
      return "Review evidence gap";
    default:
      return stripTrailingPunctuation(firstNonEmptyString([item.title, item.feature_label]) ?? "Decision item");
  }
}

function deriveExecutiveIssueProblem(
  item: Record<string, unknown>,
  companyPerformance: Record<string, unknown>,
  statusWindow: GitStatusWindow | null,
): string {
  switch (classifyExecutiveIssue(item, companyPerformance, statusWindow)) {
    case "kpi_gap":
      return "Our closeout route is dropping delivery cost totals after work ships, so we proved the work landed but cannot fully audit what it cost.";
    case "status_coverage_gap":
      return "Recent work is not consistently making it into the COO reporting surface, so this brief can miss live context.";
    case "missing_source":
      return "Part of the COO brief is running on fallback evidence because one source family is unreadable.";
    case "review_gap":
      return "Some landed work still lacks complete review evidence, so the audit trail is weaker than it should be.";
    default:
      return stripInternalRouteText(firstNonEmptyString([item.summary, item.why, item.title]) ?? "This item needs follow-up.");
  }
}

function deriveExecutiveEvidenceBridge(
  item: Record<string, unknown>,
  companyPerformance: Record<string, unknown>,
  statusWindow: GitStatusWindow | null,
): string {
  const classification = classifyExecutiveIssue(item, companyPerformance, statusWindow);
  const affectedCount = Number(item.affected_count ?? 1);
  const recentCount = Number(companyPerformance.recent_landed_count ?? 0);

  if (classification === "kpi_gap") {
    const suspiciousCostGaps = Number(asRecord(companyPerformance.cost_visibility).suspicious_gap_count ?? affectedCount);
    if (suspiciousCostGaps > 0 && recentCount > 0) {
      return `${suspiciousCostGaps} of ${recentCount} recent landings are missing durable KPI totals.`;
    }
  }

  if (classification === "status_coverage_gap" && statusWindow?.droppedFeatureSlugs.length) {
    const droppedCount = statusWindow.droppedFeatureSlugs.length;
    const sources = new Set(statusWindow.visibilityGapSources ?? []);
    if (sources.has("current_worktree") && sources.has("recent_git")) {
      return `${droppedCount} slice${droppedCount === 1 ? "" : "s"} with current or recent activity are absent from the current COO surface.`;
    }
    if (sources.has("current_worktree")) {
      return `${droppedCount} active worktree slice${droppedCount === 1 ? "" : "s"} are absent from the current COO surface.`;
    }
    return `${droppedCount} recently changed slice${droppedCount === 1 ? "" : "s"} are absent from the current COO surface.`;
  }

  if (classification === "missing_source") {
    return "At least one source family is unreadable, so related conclusions remain provisional.";
  }

  if (affectedCount > 1 && recentCount > 0) {
    return `${affectedCount} of ${recentCount} current items roll up under this same root cause.`;
  }

  const fallback = stripInternalRouteText(firstNonEmptyString([item.evidence]) ?? "");
  return fallback.length > 0
    ? fallback
    : "The current evidence supports this conclusion, but details are available on request.";
}

function deriveExecutiveFix(item: Record<string, unknown>): string | null {
  const rawFix = stripInternalRouteText(firstNonEmptyString([item.system_fix, item.action, item.recommendation]) ?? "");
  if (!rawFix) {
    return null;
  }
  return Boolean(item.representative_handoff) && !/handoff is prepared/i.test(rawFix)
    ? `${rawFix} Handoff is prepared and ready to execute on approval.`
    : rawFix;
}

function formatExecutiveUrgency(item: Record<string, unknown>): string | null {
  const severity = String(item.severity ?? "").trim();
  const priority = String(item.priority ?? "").trim();
  const affectedCount = Number(item.affected_count ?? 0);
  const parts: string[] = [];

  if (severity.length > 0) {
    parts.push(severity.toUpperCase());
  }
  if (priority.length > 0) {
    parts.push(priority === "now" ? "immediate" : priority.replace(/_/g, " "));
  }
  if (affectedCount > 1) {
    parts.push(`affects ${affectedCount} items`);
  }

  return parts.length > 0 ? parts.join(" - ") : null;
}

function stripInternalRouteText(text: string): string {
  return text
    .replace(/Ready handoff:\s*handoff:[^\s.]+\.?/gi, "")
    .replace(/COO handoff is already prepared as\s*handoff:[^\s.]+/gi, "Handoff is prepared")
    .replace(/handoff:[^\s)]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}

function stripTrailingPunctuation(text: string): string {
  return text.replace(/[.:]+$/g, "").trim();
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

export function assessSupportedLiveStatusBody(
  body: string,
  context: StatusEvidenceContext,
): SupportedLiveStatusBodyAssessment {
  const evidencePack = buildStatusEvidencePack(context);
  return assessSupportedLiveStatusBodyAgainstEvidence(body, evidencePack);
}

export function renderDeterministicStatusBriefing(
  context: StatusEvidenceContext,
): string {
  const evidencePack = buildStatusEvidencePack(context);
  return renderDeterministicSupportedStatus(context.surface, evidencePack);
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
      (existing as Record<string, unknown>).affected_count = ((existing.affected_count as number) ?? 1) + 1;
      if (!existing.representative_handoff && tracked?.readyHandoff) {
        (existing as Record<string, unknown>).representative_handoff = {
          id: tracked.readyHandoff.id,
          task_summary: tracked.readyHandoff.taskSummary,
          status: tracked.readyHandoff.status,
        };
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
      representative_handoff: tracked?.readyHandoff
        ? {
            id: tracked.readyHandoff.id,
            task_summary: tracked.readyHandoff.taskSummary,
            status: tracked.readyHandoff.status,
          }
        : null,
      affected_count: 1,
    });
  }

  return [...grouped.values()];
}

function buildIssueCards(
  surface: LiveExecutiveSurface,
  groupedAttention: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const grouped = new Map<string, Record<string, unknown>>();

  for (const card of groupedAttention) {
    grouped.set(buildIssueCardKey(card), { ...card });
  }

  for (const item of surface.issues) {
    const card = {
      title: item.summary,
      affected_feature_labels: item.featureLabel ? [item.featureLabel] : [],
      classification: "confirmed",
      evidence: item.evidenceLine,
      why: null,
      impact: null,
      system_fix: item.recommendation,
      severity: item.severity,
      priority: item.priority,
      route_chain: [],
      recommendation: item.recommendation,
      implicated_subjects: [],
      representative_handoff: null,
      affected_count: 1,
    };

    const key = buildIssueCardKey(card);
    const existing = grouped.get(key);
    if (existing) {
      const affectedLabels = asArray(existing.affected_feature_labels).map((entry) => String(entry)).filter(Boolean);
      for (const label of asArray(card.affected_feature_labels).map((entry) => String(entry)).filter(Boolean)) {
        if (!affectedLabels.includes(label)) {
          affectedLabels.push(label);
        }
      }
      existing.affected_feature_labels = affectedLabels;
      existing.affected_count = Number(existing.affected_count ?? 1) + 1;
      if (!existing.system_fix && card.system_fix) {
        existing.system_fix = card.system_fix;
      }
      if (!existing.impact && card.impact) {
        existing.impact = card.impact;
      }
      continue;
    }
    grouped.set(key, card);
  }

  return [...grouped.values()];
}

function buildIssueCardKey(card: Record<string, unknown>): string {
  const title = String(card.title ?? "").trim();
  const why = String(card.why ?? card.summary ?? "").trim();
  const fix = String(card.system_fix ?? card.action ?? card.recommendation ?? "").trim();
  return [
    normalizeForEvidenceMatch(title),
    normalizeForEvidenceMatch(why),
    normalizeForEvidenceMatch(fix),
  ].join("|");
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
      representative_handoff: item.representative_handoff ?? null,
    }));

  const tableNextCards = brief.whatsNext.map((item) => ({
    title: item.featureLabel,
    reason: item.nextAction,
    recommended: false,
    action: item.nextAction,
    affected_feature_labels: [item.featureLabel],
    representative_handoff: null,
  }));

  return [...urgentIssueCards, ...tableNextCards];
}

function buildTableCards(
  brief: ExecutiveBrief,
  groupedTable: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return [
    ...groupedTable,
    ...brief.onTheTable.map((item) => ({
      title: item.featureLabel,
      reason: item.summary,
      recommended: false,
      action: item.summary,
      affected_feature_labels: [item.featureLabel],
      representative_handoff: null,
      affected_count: 1,
    })),
  ];
}

function buildFocusOptions(
  attentionCards: Array<Record<string, unknown>>,
  tableCards: Array<Record<string, unknown>>,
  nextCards: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const options: Array<Record<string, unknown>> = [];
  const seenTitles = new Set<string>();

  const pushOption = (
    item: Record<string, unknown>,
    recommended: boolean,
  ): void => {
    const title = String(item.title ?? "").trim();
    if (title.length === 0 || seenTitles.has(title)) {
      return;
    }
    seenTitles.add(title);
    options.push({
      title,
      recommended,
      why_now: item.reason ?? item.impact ?? item.why ?? item.recommendation ?? null,
      action_if_approved: item.action ?? item.system_fix ?? item.recommendation ?? null,
    });
  };

  for (const item of attentionCards) {
    const hasHandoff = Boolean(item.representative_handoff);
    if (String(item.priority ?? "") !== "now" || !hasHandoff) {
      continue;
    }
    pushOption(item, options.length === 0);
  }

  for (const item of nextCards) {
    if (options.length >= 2) {
      break;
    }
    if (Boolean(item.recommended)) {
      continue;
    }
    pushOption(item, options.length === 0);
  }

  for (const item of tableCards) {
    if (options.length >= 2) {
      break;
    }
    pushOption(item, options.length === 0);
  }

  const concreteOptions = options.slice(0, 2);
  if (concreteOptions.length < 2) {
    return [];
  }

  return concreteOptions.map((item, index) => ({
    ...item,
    recommended: index === 0,
  }));
}

function buildRecommendationSummary(
  focusOptions: FocusOptionEvidence[],
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
  const violations = assessSupportedLiveStatusBodyAgainstEvidence(body, evidencePack).violations;
  return [...new Set(violations)];
}

function assessSupportedLiveStatusBodyAgainstEvidence(
  body: string,
  evidencePack: Record<string, unknown>,
): SupportedLiveStatusBodyAssessment {
  const violations: string[] = [];
  const normalized = body.replace(/\r\n/g, "\n").trim();
  const requiredHeadings = [
    "**Bottom line**",
    "**Delivery health**",
    "**Issues that need a decision**",
    "**Parked / waiting**",
    "**Recommendation**",
  ];
  const headingPositions = new Map<string, number[]>();

  for (const heading of requiredHeadings) {
    const positions = collectExactLineMatches(normalized, heading);
    headingPositions.set(heading, positions);
    if (positions.length === 0) {
      violations.push(`missing:${heading}`);
    }
    if (positions.length > 1) {
      violations.push(`duplicate:${heading}`);
    }
  }

  for (const forbiddenSection of asArray(asRecord(evidencePack.supported_live_contract).forbidden_sections).map((entry) => String(entry))) {
    if (forbiddenSection.length > 0 && normalized.includes(forbiddenSection)) {
      violations.push(`forbidden:${forbiddenSection}`);
    }
  }

  const requiredHeadingIndexes = requiredHeadings
    .map((heading) => headingPositions.get(heading)?.[0] ?? -1);
  const hasAllRequiredHeadings = requiredHeadingIndexes.every((index) => index >= 0);
  if (hasAllRequiredHeadings) {
    for (let index = 1; index < requiredHeadingIndexes.length; index += 1) {
      if (requiredHeadingIndexes[index] <= requiredHeadingIndexes[index - 1]) {
        violations.push("misordered:required-headings");
        break;
      }
    }
  }

  const focusOptions = asFocusOptions(evidencePack.focus_options);
  const focusPromptMatches = collectExactLineMatches(normalized, "Where would you like to focus?");
  const numberedOptionLines = normalized.split("\n").filter((line) => /^\d+\.\s/.test(line.trim()));
  const numberedOptionValues = numberedOptionLines.map((line) => Number(line.trim().match(/^(\d+)\./)?.[1] ?? NaN));
  if (focusOptions.length >= 2) {
    if (focusPromptMatches.length !== 1) {
      violations.push("invalid:focus-prompt");
    }

    if (numberedOptionValues.length !== focusOptions.length + 1) {
      violations.push("invalid:focus-option-count");
    } else {
      for (const [index, value] of numberedOptionValues.entries()) {
        if (value !== index + 1) {
          violations.push("invalid:focus-option-order");
          break;
        }
      }
      if (!/\*\*Other\*\*/.test(numberedOptionLines.at(-1) ?? "")) {
        violations.push("invalid:focus-option-other");
      }
    }
  } else if (focusPromptMatches.length > 0 || numberedOptionValues.length > 0) {
    violations.push("unexpected:focus-options");
  }

  const visibility = collectSupportedLiveStatusParity(normalized, evidencePack, headingPositions, requiredHeadings);
  if (visibility.issuesActual !== visibility.issuesExpected) {
    violations.push("parity:issues");
  }
  if (visibility.tableActual !== visibility.tableExpected) {
    violations.push("parity:on-the-table");
  }
  if (visibility.inMotionActual !== visibility.inMotionExpected) {
    violations.push("parity:in-motion");
  }
  if (visibility.nextActual !== visibility.nextExpected) {
    violations.push("parity:focus-options");
  }
  if (visibility.recentLandingsActual !== visibility.recentLandingsExpected) {
    violations.push("parity:recent-landings");
  }

  return {
    visibility,
    violations: [...new Set(violations)],
  };
}

function collectExactLineMatches(text: string, line: string): number[] {
  const matches = [...text.matchAll(new RegExp(`^${escapeRegExp(line)}$`, "gm"))];
  return matches
    .map((match) => match.index)
    .filter((index): index is number => typeof index === "number");
}

function collectSupportedLiveStatusParity(
  normalized: string,
  evidencePack: Record<string, unknown>,
  headingPositions: Map<string, number[]>,
  requiredHeadings: string[],
): SupportedLiveStatusBodyParity {
  const sections = splitSupportedLiveSections(normalized, headingPositions, requiredHeadings);
  const executiveBriefing = asRecord(evidencePack.executive_briefing);
  const focusOptions = asFocusOptions(evidencePack.focus_options);
  const recommendation = String(executiveBriefing.recommendation ?? "").trim();
  const activeMotionCount = Number(executiveBriefing.active_motion_count ?? 0);

  return {
    issuesExpected: asArray(executiveBriefing.decision_issues).length,
    issuesActual: sections
      ? countVisibleExecutiveIssues(sections.issues, asArray(executiveBriefing.decision_issues))
      : 0,
    tableExpected: asArray(executiveBriefing.parked_waiting).length,
    tableActual: sections
      ? countVisibleParkedItems(sections.parked, asArray(executiveBriefing.parked_waiting))
      : 0,
    inMotionExpected: 1,
    inMotionActual: sections ? countVisibleMotionSummary(sections.bottomLine, activeMotionCount) : 0,
    nextExpected: focusOptions.length,
    nextActual: countVisibleFocusOptions(normalized, focusOptions, recommendation),
    recentLandingsExpected: 0,
    recentLandingsActual: 0,
  };
}

function splitSupportedLiveSections(
  normalized: string,
  headingPositions: Map<string, number[]>,
  requiredHeadings: string[],
): { bottomLine: string; delivery: string; issues: string; parked: string; recommendation: string } | null {
  const indexes = requiredHeadings
    .map((heading) => headingPositions.get(heading)?.[0] ?? -1);

  if (indexes.some((index) => index < 0)) {
    return null;
  }

  const [bottomStart, deliveryStart, issuesStart, parkedStart, recommendationStart] = indexes;
  const bottomBodyStart = bottomStart + requiredHeadings[0].length;
  const deliveryBodyStart = deliveryStart + requiredHeadings[1].length;
  const issuesBodyStart = issuesStart + requiredHeadings[2].length;
  const parkedBodyStart = parkedStart + requiredHeadings[3].length;
  const recommendationBodyStart = recommendationStart + requiredHeadings[4].length;

  return {
    bottomLine: normalized.slice(bottomBodyStart, deliveryStart),
    delivery: normalized.slice(deliveryBodyStart, issuesStart),
    issues: normalized.slice(issuesBodyStart, parkedStart),
    parked: normalized.slice(parkedBodyStart, recommendationStart),
    recommendation: normalized.slice(recommendationBodyStart),
  };
}

function countVisibleExecutiveIssues(
  sectionText: string,
  rawItems: unknown[],
): number {
  const normalizedSection = normalizeForEvidenceMatch(sectionText);

  return rawItems.reduce<number>((count, rawItem) => {
    const item = asRecord(rawItem);
    const title = firstNonEmptyString([item.title]);
    if (!title || !normalizedSection.includes(normalizeForEvidenceMatch(title))) {
      return count;
    }

    return count + 1;
  }, 0);
}

function countVisibleParkedItems(
  sectionText: string,
  rawItems: unknown[],
): number {
  const normalizedSection = normalizeForEvidenceMatch(sectionText);

  return rawItems.reduce<number>((count, rawItem) => {
    const item = asRecord(rawItem);
    const title = firstNonEmptyString([item.title]);
    return title && normalizedSection.includes(normalizeForEvidenceMatch(title))
      ? count + 1
      : count;
  }, 0);
}

function countVisibleMotionSummary(
  sectionText: string,
  activeMotionCount: number,
): number {
  const normalizedSection = normalizeForEvidenceMatch(sectionText);
  const expectedLine = activeMotionCount === 0
    ? "Nothing is actively executing right now."
    : `${activeMotionCount} item${activeMotionCount === 1 ? " is" : "s are"} actively executing right now.`;
  return normalizedSection.includes(normalizeForEvidenceMatch(expectedLine)) ? 1 : 0;
}

function countVisibleFocusOptions(
  normalized: string,
  focusOptions: FocusOptionEvidence[],
  recommendation: string,
): number {
  const focusPromptIndex = normalized.indexOf("Where would you like to focus?");
  const recommendationRegion = focusPromptIndex >= 0
    ? normalized.slice(0, focusPromptIndex)
    : normalized;
  const optionLines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s/.test(line));
  const normalizedOptions = optionLines.map((line) => normalizeForEvidenceMatch(line));

  const optionCount = focusOptions.reduce<number>((count, option) => {
    if (option.title.length === 0) {
      return count;
    }
    return normalizedOptions.some((line) => line.includes(normalizeForEvidenceMatch(option.title)))
      ? count + 1
      : count;
  }, 0);

  const recommended = focusOptions.find((option) => option.recommended);
  if (!recommended || recommendation.trim().length === 0) {
    return optionCount;
  }

  const recommendationPresent = normalizeForEvidenceMatch(recommendationRegion)
    .includes(normalizeForEvidenceMatch(recommended.title));
  return recommendationPresent ? optionCount : Math.max(0, optionCount - 1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function renderDeterministicSupportedStatus(
  _surface: LiveExecutiveSurface,
  evidencePack: Record<string, unknown>,
): string {
  const executiveBriefing = asRecord(evidencePack.executive_briefing);
  const deliveryHealth = asArray(executiveBriefing.delivery_health).map((entry) => String(entry)).filter(Boolean);
  const decisionIssues = asArray(executiveBriefing.decision_issues).map((entry) => asRecord(entry));
  const parkedWaiting = asArray(executiveBriefing.parked_waiting).map((entry) => asRecord(entry));
  const recommendation = String(executiveBriefing.recommendation ?? "").trim();
  const focusOptions = asFocusOptions(evidencePack.focus_options);
  const lines: string[] = [];

  lines.push("**Bottom line**");
  lines.push("");
  lines.push(String(executiveBriefing.bottom_line ?? "No current company summary is available."));

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("**Delivery health**");
  lines.push("");
  if (deliveryHealth.length === 0) {
    lines.push("- No aggregate delivery health summary is available.");
  } else {
    for (const line of deliveryHealth) {
      lines.push(`- ${line}`);
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("**Issues that need a decision**");
  lines.push("");
  if (decisionIssues.length === 0) {
    lines.push("No systemic issue needs your decision right now.");
  } else {
    for (const [index, rawIssue] of decisionIssues.entries()) {
      const issue = asRecord(rawIssue);
      const title = String(issue.title ?? `Issue ${index + 1}`);
      const urgency = String(issue.urgency ?? "").trim();
      lines.push(`${index + 1}. ${title}${urgency.length > 0 ? ` (${urgency})` : ""}`);
      lines.push("");
      lines.push(String(issue.problem ?? "This issue needs follow-up."));
      lines.push(`Evidence: ${String(issue.evidence_bridge ?? "Details are available on request.")}`);
      if (String(issue.fix ?? "").trim().length > 0) {
        lines.push(`Fix: ${String(issue.fix).trim()}`);
      }
      if (index < decisionIssues.length - 1) {
        lines.push("");
        lines.push("---");
        lines.push("");
      }
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("**Parked / waiting**");
  lines.push("");
  if (parkedWaiting.length === 0) {
    lines.push("- Nothing material is parked or waiting right now.");
  } else {
    for (const rawItem of parkedWaiting) {
      const item = asRecord(rawItem);
      const title = String(item.title ?? "Item").trim();
      const summary = String(item.summary ?? "").trim();
      lines.push(summary.length > 0
        ? `- ${title} - ${summary}`
        : `- ${title}`);
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("**Recommendation**");
  lines.push("");
  lines.push(recommendation.length > 0
    ? recommendation
    : "No stronger recommendation is supported than the work already on the table.");
  if (focusOptions.length >= 2) {
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

function humanizeFeatureSlug(value: string): string {
  return value
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/[-_]+/g, " "))
    .join(" / ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeForEvidenceMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lowercaseFirst(value: string): string {
  if (!value) {
    return value;
  }
  if (/^[A-Z]{2}/.test(value)) {
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
    .map((entry): FocusOptionEvidence => ({
      title: String(entry.title ?? "").trim(),
      recommended: Boolean(entry.recommended),
      why_now: typeof entry.why_now === "string" ? entry.why_now : null,
      action_if_approved: typeof entry.action_if_approved === "string" ? entry.action_if_approved : null,
      kind: entry.kind === "details" ? "details" : "action",
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

function chooseLongerString(left: string | null, right: string | null): string | null {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return right.length > left.length ? right : left;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
