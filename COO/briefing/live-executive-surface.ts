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
import type { GitStatusWindow } from "../controller/status-window.js";

const RECENT_LANDED_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;
const STALE_SOURCE_AGE_MS = 72 * 60 * 60 * 1_000;

export interface LiveExecutiveSurface {
  opening: string;
  statusWindow: LiveExecutiveStatusWindowSummary | null;
  landed: LiveExecutiveLandedItem[];
  moving: LiveExecutiveMovingItem[];
  standout: string | null;
  attention: LiveExecutiveAttentionItem[];
}

export interface LiveExecutiveStatusWindowSummary {
  currentRenderedAt: string;
  previousRenderedAt: string | null;
  previousHeadCommit: string | null;
  currentHeadCommit: string | null;
  verificationLine: string;
  comparisonLine: string;
  notes: string[];
  redFlagLine: string | null;
}

export interface LiveExecutiveLandedItem {
  featureId: string;
  featureLabel: string;
  outcome: string;
  timingLine: string;
  reviewsLine: string;
  tokenLine: string;
  keyIssueLine: string;
  evidenceLine: string;
  timingDurationMs: number | null;
  timingQualification: BriefClaimQualification;
}

export interface LiveExecutiveMovingItem {
  featureId: string;
  featureLabel: string;
  summary: string;
  evidenceLine: string;
}

export interface LiveExecutiveAttentionItem {
  featureId: string;
  featureLabel: string;
  summary: string;
  recommendation: string;
  evidenceLine: string;
}

interface EvidenceLineOverride {
  qualification?: BriefClaimQualification;
  note?: string;
}

export function normalizeLiveExecutiveSurface(
  facts: BriefSourceFacts,
  brief: ExecutiveBrief,
  diagnostics: LiveBriefDiagnostics,
): LiveExecutiveSurface {
  const featuresById = new Map(facts.features.map((feature) => [feature.id, feature]));
  const landed = facts.features
    .filter(isRecentLandedFeature.bind(null, facts.collectedAt))
    .map((feature) => toLandedItem(feature))
    .sort((left, right) => {
      const rightFeature = featuresById.get(right.featureId);
      const leftFeature = featuresById.get(left.featureId);
      return (rightFeature?.lastActivityAt ?? "").localeCompare(leftFeature?.lastActivityAt ?? "");
    });

  const moving = brief.inMotion
    .map((item) => featuresById.get(item.featureId))
    .filter((feature): feature is BriefFeatureSnapshot => Boolean(feature))
    .map((feature) => ({
      featureId: feature.id,
      featureLabel: feature.label,
      summary: feature.progressSummary,
      evidenceLine: renderEvidenceLine(
        getFeatureEvidence(feature),
        undefined,
        feature.sourceFamilies?.includes("implement_plan")
          ? {
              qualification: "direct_source",
              note: "Execution state comes directly from implement-plan truth.",
            }
          : undefined,
      ),
    }));

  const attention = buildAttentionItems(facts, brief, featuresById);

  return {
    opening: buildOpening(facts, landed, moving, diagnostics),
    statusWindow: null,
    landed,
    moving,
    standout: buildStandout(facts, landed, attention),
    attention,
  };
}

export function applyGitStatusWindowToSurface(
  surface: LiveExecutiveSurface,
  statusWindow: GitStatusWindow | null,
): LiveExecutiveSurface {
  if (!statusWindow) {
    return surface;
  }

  const summary: LiveExecutiveStatusWindowSummary = {
    currentRenderedAt: statusWindow.currentRenderedAt,
    previousRenderedAt: statusWindow.previousRenderedAt,
    previousHeadCommit: statusWindow.previousHeadCommit,
    currentHeadCommit: statusWindow.currentHeadCommit,
    verificationLine: buildStatusWindowVerificationLine(statusWindow),
    comparisonLine: buildStatusWindowComparisonLine(statusWindow),
    notes: statusWindow.verificationNotes.filter((note) => !isRedundantStatusWindowNote(note)),
    redFlagLine: statusWindow.redFlag
      ? `Red flag: git shows recent work on ${humanizeFeatureSlugList(statusWindow.droppedFeatureSlugs)}, but that work is not represented in this COO update. That suggests context was dropped while gathering this status.`
      : null,
  };

  const next: LiveExecutiveSurface = {
    ...surface,
    statusWindow: summary,
    attention: [...surface.attention],
    standout: surface.standout,
  };

  if (summary.redFlagLine) {
    next.standout = summary.redFlagLine;
    next.attention = [
      {
        featureId: "_status_window",
        featureLabel: "Status coverage",
        summary: `Recent git activity on ${humanizeFeatureSlugList(statusWindow.droppedFeatureSlugs)} is missing from the current COO status.`,
        recommendation: "Review the missing slice context before relying on this update for prioritization.",
        evidenceLine: "Evidence: derived from sources; fresh; high confidence. This coverage check comes from git commit history since the previous COO status update.",
      },
      ...next.attention,
    ].slice(0, 3);
  }

  return next;
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
    if (surface.statusWindow.redFlagLine) {
      lines.push(`- ${surface.statusWindow.redFlagLine}`);
    }
  }

  lines.push("");
  lines.push("What landed:");

  if (surface.landed.length === 0) {
    lines.push("No recent landed work is visible in the current evidence.");
  } else {
    for (const [index, item] of surface.landed.entries()) {
      lines.push(`${index + 1}. **${item.featureLabel}** - ${item.outcome}`);
      lines.push(`   ${item.timingLine}`);
      lines.push(`   ${item.reviewsLine}`);
      lines.push(`   ${item.tokenLine}`);
      lines.push(`   ${item.keyIssueLine}`);
      lines.push(`   ${item.evidenceLine}`);
    }
  }

  if (surface.moving.length > 0) {
    lines.push("");
    lines.push("What is moving:");
    for (const item of surface.moving) {
      lines.push(`- **${item.featureLabel}** - ${item.summary}`);
      lines.push(`  ${item.evidenceLine}`);
    }
  }

  if (surface.standout) {
    lines.push("");
    lines.push("What stands out:");
    lines.push(`- ${surface.standout}`);
  }

  lines.push("");
  lines.push("What needs your attention now:");
  if (surface.attention.length === 0) {
    lines.push("Nothing urgent is blocked right now, and no live decision is waiting in the current evidence.");
  } else {
    for (const [index, item] of surface.attention.entries()) {
      lines.push(`${index + 1}. **${item.featureLabel}** - ${item.summary}`);
      lines.push(`   Recommendation: ${item.recommendation}`);
      lines.push(`   ${item.evidenceLine}`);
    }
  }

  return lines.join("\n");
}

function buildOpening(
  facts: BriefSourceFacts,
  landed: LiveExecutiveLandedItem[],
  moving: LiveExecutiveMovingItem[],
  diagnostics: LiveBriefDiagnostics,
): string {
  const blockedCount = facts.features.filter((feature) => feature.status === "blocked" || feature.blockers.length > 0).length;
  const parts: string[] = [];

  if (blockedCount === 0) {
    parts.push("Overall, nothing is blocked right now.");
  } else if (blockedCount === 1) {
    parts.push("Overall, one item is blocked and needs attention.");
  } else {
    parts.push(`Overall, ${blockedCount} items are blocked and need attention.`);
  }

  if (moving.length === 0) {
    parts.push("Nothing active is in flight.");
  } else if (moving.length === 1) {
    parts.push("One item is actively moving.");
  } else {
    parts.push(`${moving.length} items are actively moving.`);
  }

  if (landed.length > 0) {
    parts.push(`${landed.length} recent item${landed.length === 1 ? "" : "s"} landed.`);
  }

  if (diagnostics.unavailableFamilies.length > 0) {
    parts.push(`Some source truth is missing (${diagnostics.unavailableFamilies.map(humanizeSourceFamily).join(", ")}), so affected claims are marked as fallback or unavailable.`);
  } else if ((facts.sourceFreshnessAgeMs ?? 0) > STALE_SOURCE_AGE_MS) {
    parts.push(`Some of this view is stale (${formatAge(facts.sourceFreshnessAgeMs ?? null)} since the newest source update), so confidence is reduced.`);
  }

  return parts.join(" ");
}

function buildAttentionItems(
  facts: BriefSourceFacts,
  brief: ExecutiveBrief,
  featuresById: Map<string, BriefFeatureSnapshot>,
): LiveExecutiveAttentionItem[] {
  const items: LiveExecutiveAttentionItem[] = [];
  const seen = new Set<string>();

  for (const issue of brief.issues) {
    if (issue.featureId === "_global") continue;
    const feature = featuresById.get(issue.featureId);
    if (!feature || seen.has(feature.id)) continue;
    seen.add(feature.id);
    items.push({
      featureId: feature.id,
      featureLabel: feature.label,
      summary: issue.headline,
      recommendation: feature.nextAction ?? firstDetailRecommendation(issue.details) ?? "Resolve the blocker before work resumes.",
      evidenceLine: renderEvidenceLine(getFeatureEvidence(feature), undefined, {
        qualification: "direct_source",
        note: "The blocker comes directly from live COO thread/onion truth.",
      }),
    });
  }

  for (const item of brief.onTheTable) {
    const feature = featuresById.get(item.featureId);
    if (!feature || seen.has(feature.id)) continue;
    seen.add(feature.id);
    items.push({
      featureId: feature.id,
      featureLabel: feature.label,
      summary: item.summary,
      recommendation: feature.nextAction ?? "Resolve the open decision before moving forward.",
      evidenceLine: renderEvidenceLine(
        getFeatureEvidence(feature),
        undefined,
        feature.missingSourceFamilies?.includes("cto_admission")
          ? {
              qualification: "fallback_missing_source",
              note: "This conclusion falls back to thread and finalized requirement truth because CTO admission truth is missing.",
            }
          : undefined,
      ),
    });
  }

  if (items.length === 0) {
    for (const item of brief.whatsNext) {
      const feature = featuresById.get(item.featureId);
      if (!feature || seen.has(feature.id)) continue;
      seen.add(feature.id);
      items.push({
        featureId: feature.id,
        featureLabel: feature.label,
        summary: feature.progressSummary,
        recommendation: item.nextAction,
        evidenceLine: renderEvidenceLine(getFeatureEvidence(feature)),
      });
    }
  }

  return items.slice(0, 3);
}

function buildStandout(
  facts: BriefSourceFacts,
  landed: LiveExecutiveLandedItem[],
  attention: LiveExecutiveAttentionItem[],
): string | null {
  const timed = landed
    .filter((item) => item.timingDurationMs !== null)
    .sort((left, right) => (right.timingDurationMs ?? 0) - (left.timingDurationMs ?? 0));

  if (timed.length >= 2) {
    const longest = timed[0];
    const next = timed[1];
    if ((longest.timingDurationMs ?? 0) >= 3 * Math.max(1, next.timingDurationMs ?? 0)) {
      return `${longest.featureLabel} shows about ${formatDuration(longest.timingDurationMs)} of elapsed lifecycle time while the other recent landed work was much shorter. The current evidence does not separate waiting, review, merge, or active build time, so the reason for that gap is unknown here.`;
    }
  }

  const lowConfidenceAttention = attention.find((item) => {
    const feature = facts.features.find((candidate) => candidate.id === item.featureId);
    return getFeatureEvidence(feature).confidence === "low";
  });
  if (lowConfidenceAttention) {
    const feature = facts.features.find((candidate) => candidate.id === lowConfidenceAttention.featureId);
    return `${lowConfidenceAttention.featureLabel} is being surfaced with reduced confidence because ${getFeatureEvidence(feature).notes[0] ?? "the source truth is incomplete."}`;
  }

  return null;
}

function buildStatusWindowVerificationLine(statusWindow: GitStatusWindow): string {
  switch (statusWindow.verificationBasis) {
    case "previous_head_commit":
      return `derived from git commit history between the previous recorded HEAD and the current HEAD.`;
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

function toLandedItem(feature: BriefFeatureSnapshot): LiveExecutiveLandedItem {
  const completion = feature.completion;
  const timing = renderTimingLine(completion);
  const reviews = renderReviewLine(completion);
  const token = renderTokenLine(completion);
  const keyIssue = renderKeyIssueLine(completion);

  return {
    featureId: feature.id,
    featureLabel: feature.label,
    outcome: completion?.mergedAt
      ? "completed and merged"
      : "completed and awaiting final closeout truth",
    timingLine: timing,
    reviewsLine: reviews,
    tokenLine: token,
    keyIssueLine: keyIssue,
    evidenceLine: renderEvidenceLine(
      getFeatureEvidence(feature),
      completion,
      completion && (completion.reviewCycles.value !== null || completion.keyIssue.value !== null)
        ? {
            qualification: "derived_from_sources",
            note: "This landed summary is derived from implement-plan closeout plus any recorded review artifacts.",
          }
        : undefined,
    ),
    timingDurationMs: completion?.timing.durationMs ?? null,
    timingQualification: completion?.timing.qualification ?? "unavailable",
  };
}

function renderTimingLine(completion: BriefCompletionEvidence | null | undefined): string {
  if (!completion) {
    return "Timing: unavailable.";
  }

  if (completion.timing.durationMs === null) {
    return `Timing: unavailable. ${completion.timing.note}`;
  }

  if (completion.timing.kind === "elapsed_lifecycle") {
    return `Timing: about ${formatDuration(completion.timing.durationMs)} of elapsed lifecycle time. Active work time is unknown.`;
  }

  return `Timing: about ${formatDuration(completion.timing.durationMs)}. ${completion.timing.note}`;
}

function renderReviewLine(completion: BriefCompletionEvidence | null | undefined): string {
  if (!completion) {
    return "Reviews: unavailable.";
  }

  if (completion.reviewCycles.value === null) {
    return "Reviews: unavailable.";
  }

  return completion.reviewCycles.value === 1
    ? "Reviews: 1 completed review cycle is recorded."
    : `Reviews: ${completion.reviewCycles.value} completed review cycles are recorded.`;
}

function renderTokenLine(completion: BriefCompletionEvidence | null | undefined): string {
  if (!completion || completion.tokenCostTokens.value === null) {
    return "Token cost: unavailable.";
  }
  return `Token cost: ${completion.tokenCostTokens.value.toLocaleString("en-US")} tokens.`;
}

function renderKeyIssueLine(completion: BriefCompletionEvidence | null | undefined): string {
  if (!completion) {
    return "Key issue: unavailable.";
  }

  if (completion.keyIssue.value === null) {
    return "Key issue: unavailable.";
  }

  if (completion.keyIssue.value.startsWith("No implementation-quality issue is recorded")) {
    return "Key issue: none recorded in current closeout truth.";
  }

  return `Key issue: ${completion.keyIssue.value}`;
}

function renderEvidenceLine(
  evidence: BriefFeatureEvidence,
  completion?: BriefCompletionEvidence | null,
  override?: EvidenceLineOverride,
): string {
  const qualification = override?.qualification ?? evidence.qualification;
  const freshness = evidence.freshness === "unknown"
    ? "unknown freshness"
    : evidence.freshness === "stale"
      ? `stale (${formatAge(evidence.freshnessAgeMs)} old)`
      : "fresh";
  const noteParts = [override?.note ?? evidence.notes[0]];

  if (completion?.timing.qualification === "ambiguous") {
    noteParts.push(completion.timing.note);
  }

  return `Evidence: ${humanizeQualification(qualification)}; ${freshness}; ${evidence.confidence} confidence. ${noteParts.filter(Boolean).join(" ")}`.trim();
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

function getFeatureEvidence(feature: BriefFeatureSnapshot | undefined): BriefFeatureEvidence {
  if (feature?.evidence) {
    return feature.evidence;
  }

  return {
    qualification: "unavailable",
    confidence: "low",
    freshnessAgeMs: null,
    freshness: "unknown",
    sourceFamilies: feature?.sourceFamilies ?? [],
    missingSourceFamilies: feature?.missingSourceFamilies ?? [],
    notes: ["Evidence metadata is unavailable for this item."],
  };
}

function firstDetailRecommendation(details: string[]): string | null {
  const decision = details.find((detail) => detail.startsWith("Decision needed: "));
  if (decision) {
    return decision.replace("Decision needed: ", "").replace(/\s+\(impact:.*\)$/, "");
  }
  return null;
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

  const totalMinutes = Math.max(1, Math.round(durationMs / 60_000));
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
  if (ageMs < 60_000) {
    return `${Math.max(1, Math.round(ageMs / 1_000))}s`;
  }
  if (ageMs < 60 * 60 * 1_000) {
    return `${Math.round(ageMs / 60_000)}m`;
  }
  if (ageMs < 24 * 60 * 60 * 1_000) {
    return `${Math.round(ageMs / (60 * 60 * 1_000))}h`;
  }
  return `${Math.round(ageMs / (24 * 60 * 60 * 1_000))}d`;
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

function humanizeFeatureSlugList(slugs: string[]): string {
  return slugs.map((slug) => humanizeFeatureId(slug)).join(", ");
}

function humanizeFeatureId(value: string): string {
  return value
    .split(/[\/_-]+/)
    .filter((part) => part.trim().length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isRedundantStatusWindowNote(note: string): boolean {
  return note.startsWith("Red flag:")
    || note.startsWith("Git checked ")
    || note.startsWith("Git shows no new commits")
    || note.startsWith("No previous COO status update is recorded yet")
    || note.startsWith("Git history could not be read for this comparison window");
}
