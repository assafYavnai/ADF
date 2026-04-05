import type { GitStatusWindow } from "../controller/status-window.js";
import type { LiveBriefDiagnostics } from "./live-source-adapter.js";
import type {
  BriefClaimQualification,
  BriefCompletionEvidence,
  BriefFeatureEvidence,
  BriefFeatureSnapshot,
  BriefSourceFacts,
  BriefSourceFamily,
  ExecutiveBrief,
} from "./types.js";
import type {
  GovernedStatusContext,
  GovernanceLandedAssessment,
} from "./status-governance.js";

const RECENT_LANDED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface LiveExecutiveSurface {
  opening: string;
  statusWindow: LiveExecutiveStatusWindowSummary | null;
  statusNotes: string[];
  landed: LiveExecutiveLandedItem[];
  issues: LiveExecutiveSectionItem[];
  onTheTable: LiveExecutiveSectionItem[];
  inMotion: LiveExecutiveSectionItem[];
  whatsNext: LiveExecutiveSectionItem[];
  operationalFooter: LiveExecutiveOperationalFooter | null;
}

export interface LiveExecutiveStatusWindowSummary {
  currentRenderedAt: string;
  previousRenderedAt: string | null;
  previousHeadCommit: string | null;
  currentHeadCommit: string | null;
  verificationLine: string;
  comparisonLine: string;
  notes: string[];
}

export interface LiveExecutiveSectionItem {
  key: string;
  featureId: string | null;
  featureLabel: string;
  summary: string;
  recommendation: string | null;
  evidenceLine: string;
}

export interface LiveExecutiveLandedItem {
  featureId: string;
  featureLabel: string;
  outcome: string;
  timingLine: string;
  reviewLine: string;
  tokenLine: string;
  cooReadLine: string;
  recommendationLine: string | null;
  evidenceLine: string;
}

export interface LiveExecutiveOperationalFooter {
  currentThreadId: string | null;
  activeWorkflow: string | null;
  onionLayer: string | null;
  scopePath: string | null;
  lastStateCommitAt: string | null;
}

export function normalizeLiveExecutiveSurface(
  facts: BriefSourceFacts,
  brief: ExecutiveBrief,
  diagnostics: LiveBriefDiagnostics,
  governance: GovernedStatusContext,
  statusWindow: GitStatusWindow | null,
): LiveExecutiveSurface {
  const featuresById = new Map(facts.features.map((feature) => [feature.id, feature]));

  return {
    opening: buildOpening(facts, brief, diagnostics),
    statusWindow: statusWindow ? {
      currentRenderedAt: statusWindow.currentRenderedAt,
      previousRenderedAt: statusWindow.previousRenderedAt,
      previousHeadCommit: statusWindow.previousHeadCommit,
      currentHeadCommit: statusWindow.currentHeadCommit,
      verificationLine: buildStatusWindowVerificationLine(statusWindow),
      comparisonLine: buildStatusWindowComparisonLine(statusWindow),
      notes: statusWindow.verificationNotes.filter((note) => note.trim().length > 0),
    } : null,
    statusNotes: governance.statusNotes,
    landed: facts.features
      .filter((feature) => isRecentLandedFeature(facts.collectedAt, feature))
      .map((feature) => toLandedItem(feature, governance.landedAssessments.get(feature.id)))
      .sort((left, right) => right.featureLabel.localeCompare(left.featureLabel)),
    issues: dedupeSectionItems([
      ...brief.issues.map((item) => toIssueItem(item, featuresById.get(item.featureId))),
      ...governance.additionalAttention.map((item) => ({
        key: item.key,
        featureId: item.featureId,
        featureLabel: item.featureLabel,
        summary: item.summary,
        recommendation: item.recommendation,
        evidenceLine: item.evidenceLine,
      })),
    ]),
    onTheTable: dedupeSectionItems([
      ...brief.onTheTable.map((item) => toTableItem(item, featuresById.get(item.featureId))),
      ...governance.additionalTable.map((item) => ({
        key: item.key,
        featureId: item.featureId,
        featureLabel: item.featureLabel,
        summary: item.summary,
        recommendation: item.recommendation,
        evidenceLine: item.evidenceLine,
      })),
    ]),
    inMotion: dedupeSectionItems(
      brief.inMotion.map((item) => toMotionItem(item, featuresById.get(item.featureId))),
    ),
    whatsNext: dedupeSectionItems([
      ...brief.whatsNext.map((item) => toNextItem(item, featuresById.get(item.featureId))),
      ...governance.additionalNext.map((item) => ({
        key: item.key,
        featureId: item.featureId,
        featureLabel: item.featureLabel,
        summary: item.summary,
        recommendation: item.recommendation,
        evidenceLine: item.evidenceLine,
      })),
    ]),
    operationalFooter: {
      currentThreadId: governance.currentThread.threadId,
      activeWorkflow: governance.currentThread.activeWorkflow,
      onionLayer: governance.currentThread.onionLayer,
      scopePath: governance.currentThread.scopePath ?? governance.companyScopePath,
      lastStateCommitAt: governance.currentThread.lastStateCommitAt,
    },
  };
}

export function renderLiveExecutiveSurface(surface: LiveExecutiveSurface): string {
  const lines: string[] = [surface.opening];

  if (surface.statusWindow) {
    lines.push("");
    lines.push("Status window:");
    lines.push(`- This COO update: ${formatStatusTimestamp(surface.statusWindow.currentRenderedAt)}${surface.statusWindow.currentHeadCommit ? ` (${shortCommit(surface.statusWindow.currentHeadCommit)})` : ""}`);
    lines.push(`- Previous COO update: ${surface.statusWindow.previousRenderedAt ? formatStatusTimestamp(surface.statusWindow.previousRenderedAt) : "none recorded yet"}${surface.statusWindow.previousHeadCommit ? ` (${shortCommit(surface.statusWindow.previousHeadCommit)})` : ""}`);
    lines.push(`- Coverage check: ${surface.statusWindow.verificationLine}`);
    lines.push(`- Git comparison: ${surface.statusWindow.comparisonLine}`);
    for (const note of surface.statusWindow.notes) {
      lines.push(`- Note: ${note}`);
    }
  }

  if (surface.statusNotes.length > 0) {
    lines.push("");
    lines.push("Status notes:");
    for (const note of surface.statusNotes) {
      lines.push(`- ${note}`);
    }
  }

  lines.push("");
  lines.push("What landed recently:");
  if (surface.landed.length === 0) {
    lines.push("No recent landed work is visible in the current evidence.");
  } else {
    for (const [index, item] of surface.landed.entries()) {
      lines.push(`${index + 1}. **${item.featureLabel}** - ${item.outcome}`);
      lines.push(`   ${item.timingLine}`);
      lines.push(`   ${item.reviewLine}`);
      lines.push(`   ${item.tokenLine}`);
      lines.push(`   ${item.cooReadLine}`);
      if (item.recommendationLine) {
        lines.push(`   ${item.recommendationLine}`);
      }
      lines.push(`   ${item.evidenceLine}`);
    }
  }

  renderSection(lines, "Issues That Need Your Attention", surface.issues, "No current blocked item or contradiction requires direct CEO attention.");
  renderSection(lines, "On The Table", surface.onTheTable, "No unresolved shaping, governance, or decision item is currently on the table.");
  renderSection(lines, "In Motion", surface.inMotion, "No feature is currently in active motion.");
  renderSection(lines, "What's Next", surface.whatsNext, "No concrete next move is currently stronger than the work already on the table.");

  if (surface.operationalFooter) {
    lines.push("");
    lines.push("Operational context:");
    lines.push(`- Current thread ID: ${surface.operationalFooter.currentThreadId ?? "none"}`);
    lines.push(`- Active workflow: ${surface.operationalFooter.activeWorkflow ?? "none"}`);
    lines.push(`- Onion layer: ${surface.operationalFooter.onionLayer ?? "none"}`);
    lines.push(`- Scope path: ${surface.operationalFooter.scopePath ?? "none"}`);
    lines.push(`- Last state commit: ${surface.operationalFooter.lastStateCommitAt ? formatStatusTimestamp(surface.operationalFooter.lastStateCommitAt) : "none"}`);
  }

  return lines.join("\n");
}

function buildOpening(
  facts: BriefSourceFacts,
  brief: ExecutiveBrief,
  diagnostics: LiveBriefDiagnostics,
): string {
  const parts: string[] = [];

  if (brief.issues.length === 0) {
    parts.push("Overall, nothing is blocked right now.");
  } else if (brief.issues.length === 1) {
    parts.push("Overall, one item needs attention right now.");
  } else {
    parts.push(`Overall, ${brief.issues.length} items need attention right now.`);
  }

  if (brief.inMotion.length === 0) {
    parts.push("The company is not actively moving work right now.");
  } else if (brief.inMotion.length === 1) {
    parts.push("One item is actively moving.");
  } else {
    parts.push(`${brief.inMotion.length} items are actively moving.`);
  }

  const landedCount = facts.features.filter((feature) => isRecentLandedFeature(facts.collectedAt, feature)).length;
  if (landedCount > 0) {
    parts.push(`${landedCount} recent item${landedCount === 1 ? "" : "s"} landed.`);
  }

  if (diagnostics.unavailableFamilies.length > 0) {
    parts.push(`Some source truth is missing (${diagnostics.unavailableFamilies.map(humanizeSourceFamily).join(", ")}), so affected conclusions stay explicitly qualified.`);
  }

  return parts.join(" ");
}

function renderSection(
  lines: string[],
  heading: string,
  items: LiveExecutiveSectionItem[],
  emptyLine: string,
): void {
  lines.push("");
  lines.push(`## ${heading}`);
  if (items.length === 0) {
    lines.push(emptyLine);
    return;
  }

  for (const item of items) {
    lines.push(`- **${item.featureLabel}**: ${item.summary}`);
    if (item.recommendation) {
      lines.push(`  Recommendation: ${item.recommendation}`);
    }
    lines.push(`  ${item.evidenceLine}`);
  }
}

function toIssueItem(
  item: ExecutiveBrief["issues"][number],
  feature: BriefFeatureSnapshot | undefined,
): LiveExecutiveSectionItem {
  return {
    key: `issue:${item.featureId}:${item.headline}`,
    featureId: item.featureId,
    featureLabel: item.featureLabel,
    summary: item.headline,
    recommendation: feature?.nextAction ?? firstDetailRecommendation(item.details),
    evidenceLine: renderEvidenceLine(
      feature?.evidence,
      "The blocker comes directly from live COO thread/onion truth.",
      "direct_source",
    ),
  };
}

function toTableItem(
  item: ExecutiveBrief["onTheTable"][number],
  feature: BriefFeatureSnapshot | undefined,
): LiveExecutiveSectionItem {
  return {
    key: `table:${item.featureId}:${item.summary}`,
    featureId: item.featureId,
    featureLabel: item.featureLabel,
    summary: item.summary,
    recommendation: feature?.nextAction ?? "Resolve the open decision before moving forward.",
    evidenceLine: renderEvidenceLine(feature?.evidence),
  };
}

function toMotionItem(
  item: ExecutiveBrief["inMotion"][number],
  feature: BriefFeatureSnapshot | undefined,
): LiveExecutiveSectionItem {
  return {
    key: `motion:${item.featureId}:${item.progressSummary}`,
    featureId: item.featureId,
    featureLabel: item.featureLabel,
    summary: item.progressSummary,
    recommendation: null,
    evidenceLine: renderEvidenceLine(feature?.evidence),
  };
}

function toNextItem(
  item: ExecutiveBrief["whatsNext"][number],
  feature: BriefFeatureSnapshot | undefined,
): LiveExecutiveSectionItem {
  return {
    key: `next:${item.featureId}:${item.nextAction}`,
    featureId: item.featureId,
    featureLabel: item.featureLabel,
    summary: item.nextAction,
    recommendation: null,
    evidenceLine: renderEvidenceLine(feature?.evidence),
  };
}

function toLandedItem(
  feature: BriefFeatureSnapshot,
  assessment: GovernanceLandedAssessment | undefined,
): LiveExecutiveLandedItem {
  const completion = feature.completion;
  return {
    featureId: feature.id,
    featureLabel: feature.label,
    outcome: completion?.mergedAt ? "completed and merged" : "completed and awaiting final closeout truth",
    timingLine: renderTimingLine(completion),
    reviewLine: assessment?.reviewAssessmentLine ?? "Review check: unavailable.",
    tokenLine: assessment?.tokenAssessmentLine ?? "KPI check: token cost is unavailable.",
    cooReadLine: assessment?.cooReadLine ?? "COO read: landed evidence is incomplete.",
    recommendationLine: assessment?.recommendation ? `Recommendation: ${assessment.recommendation}` : null,
    evidenceLine: renderEvidenceLine(feature.evidence),
  };
}

function dedupeSectionItems(items: LiveExecutiveSectionItem[]): LiveExecutiveSectionItem[] {
  const seen = new Set<string>();
  const deduped: LiveExecutiveSectionItem[] = [];
  for (const item of items) {
    const dedupeKey = item.featureId ? `feature:${item.featureId}` : item.key;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    deduped.push(item);
  }
  return deduped;
}

function buildStatusWindowVerificationLine(statusWindow: GitStatusWindow): string {
  switch (statusWindow.verificationBasis) {
    case "previous_head_commit":
      return "derived from git commit history between the previous recorded HEAD and the current HEAD.";
    case "previous_rendered_at":
      return "derived from git commit timestamps since the previous COO status update.";
    case "baseline_not_established":
      return "unavailable until this run establishes the first comparison baseline.";
    case "unavailable":
    default:
      return "unavailable because git history could not be read in this runtime.";
  }
}

function buildStatusWindowComparisonLine(statusWindow: GitStatusWindow): string {
  if (!statusWindow.gitAvailable) {
    return "unavailable because git history could not be read.";
  }
  if (!statusWindow.previousRenderedAt) {
    return "no comparison yet because there was no previous recorded COO update.";
  }
  if (statusWindow.commitsSincePrevious === 0) {
    return "0 commits since the previous COO update.";
  }
  return `${statusWindow.commitsSincePrevious} commit(s) checked since the previous COO update.`;
}

function renderTimingLine(completion: BriefCompletionEvidence | null | undefined): string {
  if (!completion) {
    return "Timing: unavailable.";
  }

  if (completion.timing.durationMs === null) {
    return `Timing: unavailable. ${completion.timing.note}`;
  }

  if (completion.timing.kind === "elapsed_lifecycle" || completion.timing.qualification === "ambiguous") {
    return `Timing: about ${formatDuration(completion.timing.durationMs)} of elapsed lifecycle time. Active implementation time is unknown.`;
  }

  return `Timing: about ${formatDuration(completion.timing.durationMs)} of active work.`;
}

function renderEvidenceLine(
  evidence: BriefFeatureEvidence | undefined,
  overrideNote?: string,
  overrideQualification?: BriefClaimQualification,
): string {
  if (!evidence) {
    return "Evidence: unavailable; unknown freshness; low confidence. Evidence metadata is unavailable for this item.";
  }

  const qualification = overrideQualification ?? evidence.qualification;
  const freshness = evidence.freshness === "unknown"
    ? "unknown freshness"
    : evidence.freshness === "stale"
      ? `stale (${formatAge(evidence.freshnessAgeMs)} old)`
      : "fresh";
  return `Evidence: ${humanizeQualification(qualification)}; ${freshness}; ${evidence.confidence} confidence. ${overrideNote ?? evidence.notes[0] ?? "Source evidence was available."}`;
}

function firstDetailRecommendation(details: string[]): string | null {
  const decision = details.find((detail) => detail.startsWith("Decision needed: "));
  if (decision) {
    return decision.replace("Decision needed: ", "").replace(/\s+\(impact:.*\)$/, "");
  }
  return null;
}

function isRecentLandedFeature(collectedAt: string, feature: BriefFeatureSnapshot): boolean {
  if (!feature.completion) {
    return false;
  }
  const collectedAtMs = Date.parse(collectedAt);
  const lastActivityMs = Date.parse(feature.lastActivityAt);
  if (Number.isNaN(collectedAtMs) || Number.isNaN(lastActivityMs)) {
    return true;
  }
  return collectedAtMs - lastActivityMs <= RECENT_LANDED_WINDOW_MS;
}

function humanizeQualification(qualification: BriefClaimQualification): string {
  switch (qualification) {
    case "direct_source":
      return "direct source";
    case "derived_from_sources":
      return "derived from sources";
    case "fallback_missing_source":
      return "fallback because a source is missing";
    case "ambiguous":
      return "ambiguous";
    case "unavailable":
      return "unavailable";
    default:
      return qualification;
  }
}

function humanizeSourceFamily(family: BriefSourceFamily): string {
  switch (family) {
    case "thread_onion":
      return "live COO thread/onion truth";
    case "finalized_requirement":
      return "finalized requirement truth";
    case "cto_admission":
      return "CTO admission truth";
    case "implement_plan":
      return "implement-plan truth";
    default:
      return family;
  }
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return "unknown duration";
  }
  const totalMinutes = Math.max(1, Math.round(durationMs / 60000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

function formatAge(ageMs: number | null): string {
  if (ageMs === null) {
    return "unknown age";
  }
  if (ageMs < 60000) {
    return `${Math.max(1, Math.round(ageMs / 1000))}s`;
  }
  if (ageMs < 60 * 60 * 1000) {
    return `${Math.round(ageMs / 60000)}m`;
  }
  if (ageMs < 24 * 60 * 60 * 1000) {
    return `${Math.round(ageMs / (60 * 60 * 1000))}h`;
  }
  return `${Math.round(ageMs / (24 * 60 * 60 * 1000))}d`;
}

function formatStatusTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().replace(".000Z", "Z").replace("T", " ");
}

function shortCommit(value: string): string {
  return value.slice(0, 7);
}
