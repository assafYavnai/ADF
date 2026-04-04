/**
 * Executive Brief Builder
 *
 * Pure derivation: takes BriefSourceFacts, produces ExecutiveBrief.
 * Never mutates source data. Never writes to external systems.
 */

import type {
  BriefSourceFacts,
  BriefFeatureSnapshot,
  ExecutiveBrief,
  BriefIssueItem,
  BriefTableItem,
  BriefInMotionItem,
  BriefWhatsNextItem,
  BriefParityCounts,
} from "./types.js";

const BLOCKED_STATUSES = new Set(["blocked"]);
const ACTIVE_STATUSES = new Set(["active", "awaiting_freeze_approval"]);
const COMPLETED_STATUSES = new Set(["completed", "closed", "approved", "handoff_ready"]);

function isBlocked(f: BriefFeatureSnapshot): boolean {
  return BLOCKED_STATUSES.has(f.status) || f.blockers.length > 0;
}

function isActive(f: BriefFeatureSnapshot): boolean {
  return ACTIVE_STATUSES.has(f.status) && !isBlocked(f);
}

function hasOpenDecisions(f: BriefFeatureSnapshot): boolean {
  return f.openDecisions.some((d) => d.status === "open");
}

function isOnTheTableCandidate(f: BriefFeatureSnapshot): boolean {
  if (isCompleted(f) || isBlocked(f)) return false;

  if (f.briefingState === "shaping" || f.briefingState === "admission_pending") {
    return true;
  }

  return hasOpenDecisions(f);
}

function isInMotionCandidate(f: BriefFeatureSnapshot): boolean {
  if (isBlocked(f)) return false;

  if (f.briefingState) {
    return f.briefingState === "implementation_active";
  }

  return isActive(f);
}

function isCompleted(f: BriefFeatureSnapshot): boolean {
  return COMPLETED_STATUSES.has(f.status);
}

function hasMetadata(f: BriefFeatureSnapshot): boolean {
  return (
    f.label.trim().length > 0 &&
    f.lastActivityAt.trim().length > 0 &&
    f.progressSummary.trim().length > 0
  );
}

function buildIssues(
  features: BriefFeatureSnapshot[],
  globalOpenLoops: string[],
): BriefIssueItem[] {
  const items: BriefIssueItem[] = [];

  for (const f of features) {
    if (!isBlocked(f)) continue;

    const details: string[] = [];
    for (const b of f.blockers) {
      details.push(`Blocker: ${b}`);
    }
    for (const loop of f.openLoops) {
      details.push(`Open loop: ${loop}`);
    }
    for (const d of f.openDecisions.filter((od) => od.status === "open")) {
      details.push(`Decision needed: ${d.question} (impact: ${d.impact})`);
    }

    items.push({
      featureId: f.id,
      featureLabel: f.label,
      headline: f.blockers[0] ?? `${f.label} is blocked`,
      details,
    });
  }

  if (globalOpenLoops.length > 0) {
    items.push({
      featureId: "_global",
      featureLabel: "Cross-cutting",
      headline: `${globalOpenLoops.length} unresolved cross-cutting item(s)`,
      details: globalOpenLoops.map((loop) => `Open loop: ${loop}`),
    });
  }

  return items;
}

function buildOnTheTable(features: BriefFeatureSnapshot[]): BriefTableItem[] {
  const items: BriefTableItem[] = [];

  for (const f of features) {
    if (!isOnTheTableCandidate(f)) continue;

    const openCount = f.openDecisions.filter((d) => d.status === "open").length;
    let summary = f.progressSummary;

    if (openCount > 0) {
      summary = `${openCount} open decision(s) - ${f.progressSummary}`;
    } else if (f.briefingState === "admission_pending") {
      summary = `Awaiting decision - ${f.progressSummary}`;
    } else if (f.briefingState === "shaping") {
      summary = `Shaping - ${f.progressSummary}`;
    }

    items.push({
      featureId: f.id,
      featureLabel: f.label,
      summary,
      openDecisionCount: openCount,
    });
  }

  return items;
}

function buildInMotion(features: BriefFeatureSnapshot[]): BriefInMotionItem[] {
  const items: BriefInMotionItem[] = [];

  for (const f of features) {
    if (!isInMotionCandidate(f)) continue;

    items.push({
      featureId: f.id,
      featureLabel: f.label,
      currentLayer: f.currentLayer,
      progressSummary: f.progressSummary,
    });
  }

  return items;
}

function buildWhatsNext(features: BriefFeatureSnapshot[]): BriefWhatsNextItem[] {
  const items: BriefWhatsNextItem[] = [];

  for (const f of features) {
    if (!isWhatsNextCandidate(f)) continue;

    let nextAction: string;
    if (typeof f.nextAction === "string" && f.nextAction.trim().length > 0) {
      nextAction = f.nextAction.trim();
    } else if (isCompleted(f) && !f.isFinalized) {
      nextAction = `Finalize closeout for ${f.label}`;
    } else if (f.briefingState === "ready_to_start") {
      nextAction = `Start implementation for ${f.label}`;
    } else if (f.briefingState === "admission_pending") {
      nextAction = `Decide whether to admit ${f.label}`;
    } else if (f.openDecisions.some((d) => d.status === "open")) {
      const firstOpen = f.openDecisions.find((d) => d.status === "open")!;
      nextAction = `Resolve: ${firstOpen.question}`;
    } else if (f.currentLayer) {
      nextAction = `Continue ${f.currentLayer} layer`;
    } else {
      nextAction = f.progressSummary || "Continue work";
    }

    items.push({
      featureId: f.id,
      featureLabel: f.label,
      nextAction,
    });
  }

  return items;
}

function isWhatsNextCandidate(f: BriefFeatureSnapshot): boolean {
  if (isCompleted(f) && f.isFinalized) return false;
  if (isBlocked(f)) return false;

  if (!f.briefingState) {
    return true;
  }

  if (f.briefingState === "ready_to_start" || f.briefingState === "closeout") {
    return true;
  }

  if (f.briefingState !== "implementation_active") {
    return false;
  }

  const nextAction = typeof f.nextAction === "string" ? f.nextAction.trim() : "";
  return nextAction.length > 0
    && nextAction !== "Keep the implementation moving through the current execution step."
    && nextAction !== "Live work is active.";
}

function computeParity(
  features: BriefFeatureSnapshot[],
  globalOpenLoops: string[],
  issues: BriefIssueItem[],
  onTheTable: BriefTableItem[],
  inMotion: BriefInMotionItem[],
  whatsNext: BriefWhatsNextItem[],
): BriefParityCounts {
  const blockedCount = features.filter(isBlocked).length + (globalOpenLoops.length > 0 ? 1 : 0);
  const tableCount = features.filter(isOnTheTableCandidate).length;
  const activeCount = features.filter(isInMotionCandidate).length;
  const nextCount = features.filter((f) => {
    return isWhatsNextCandidate(f);
  }).length;

  return {
    issuesExpected: blockedCount,
    issuesActual: issues.length,
    tableExpected: tableCount,
    tableActual: onTheTable.length,
    inMotionExpected: activeCount,
    inMotionActual: inMotion.length,
    whatsNextExpected: nextCount,
    whatsNextActual: whatsNext.length,
  };
}

export function buildExecutiveBrief(facts: BriefSourceFacts): ExecutiveBrief {
  const builtAt = new Date().toISOString();
  const sourceAgeMs = facts.sourceFreshnessAgeMs ?? (Date.now() - new Date(facts.collectedAt).getTime());

  const issues = buildIssues(facts.features, facts.globalOpenLoops);
  const onTheTable = buildOnTheTable(facts.features);
  const inMotion = buildInMotion(facts.features);
  const whatsNext = buildWhatsNext(facts.features);

  const parity = computeParity(
    facts.features,
    facts.globalOpenLoops,
    issues,
    onTheTable,
    inMotion,
    whatsNext,
  );

  const featuresWithMetadata = facts.features.filter(hasMetadata).length;
  const sourceMetadataCompletenessRate =
    facts.features.length === 0 ? 1 : featuresWithMetadata / facts.features.length;

  return {
    builtAt,
    sourcePartition: facts.sourcePartition,
    sourceAgeMs,
    issues,
    onTheTable,
    inMotion,
    whatsNext,
    parity,
    sourceMetadataCompletenessRate,
  };
}
