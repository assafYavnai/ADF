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

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

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

  // Global open loops that aren't tied to a feature
  if (globalOpenLoops.length > 0) {
    items.push({
      featureId: "_global",
      featureLabel: "Cross-cutting",
      headline: `${globalOpenLoops.length} unresolved cross-cutting item(s)`,
      details: globalOpenLoops.map((l) => `Open loop: ${l}`),
    });
  }

  return items;
}

function buildOnTheTable(features: BriefFeatureSnapshot[]): BriefTableItem[] {
  const items: BriefTableItem[] = [];

  for (const f of features) {
    if (isCompleted(f) || isBlocked(f)) continue;
    if (!hasOpenDecisions(f)) continue;

    const openCount = f.openDecisions.filter((d) => d.status === "open").length;
    items.push({
      featureId: f.id,
      featureLabel: f.label,
      summary: `${openCount} open decision(s) — ${f.progressSummary}`,
      openDecisionCount: openCount,
    });
  }

  return items;
}

function buildInMotion(features: BriefFeatureSnapshot[]): BriefInMotionItem[] {
  const items: BriefInMotionItem[] = [];

  for (const f of features) {
    if (!isActive(f)) continue;

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
    if (isCompleted(f) && f.isFinalized) continue;
    if (isBlocked(f)) continue;

    let nextAction: string;
    if (isCompleted(f) && !f.isFinalized) {
      nextAction = `Finalize closeout for ${f.label}`;
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

// ---------------------------------------------------------------------------
// Parity computation
// ---------------------------------------------------------------------------

function computeParity(
  features: BriefFeatureSnapshot[],
  globalOpenLoops: string[],
  issues: BriefIssueItem[],
  onTheTable: BriefTableItem[],
  inMotion: BriefInMotionItem[],
  whatsNext: BriefWhatsNextItem[],
): BriefParityCounts {
  const blockedCount = features.filter(isBlocked).length + (globalOpenLoops.length > 0 ? 1 : 0);
  const tableCount = features.filter((f) => !isCompleted(f) && !isBlocked(f) && hasOpenDecisions(f)).length;
  const activeCount = features.filter(isActive).length;
  // whatsNext includes active non-blocked + completed-but-not-finalized
  const nextCount = features.filter((f) => {
    if (isCompleted(f) && f.isFinalized) return false;
    if (isBlocked(f)) return false;
    return true;
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

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildExecutiveBrief(facts: BriefSourceFacts): ExecutiveBrief {
  const builtAt = new Date().toISOString();
  const sourceAgeMs = Date.now() - new Date(facts.collectedAt).getTime();

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
