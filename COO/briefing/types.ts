/**
 * Executive Brief Read Model — Type Definitions
 *
 * Pure derived layer: reads source facts, produces a CEO-facing brief.
 * Never writes back to source truth.
 */

// ---------------------------------------------------------------------------
// Source fact inputs — the minimum data the brief builder needs
// ---------------------------------------------------------------------------

export interface BriefFeatureSnapshot {
  /** Stable identifier for the feature stream */
  id: string;
  /** Human-readable label (e.g. topic from onion state) */
  label: string;
  /** Current lifecycle status */
  status: "active" | "blocked" | "completed" | "closed" | "awaiting_freeze_approval" | "approved" | "handoff_ready";
  /** ISO-8601 timestamp of last meaningful activity */
  lastActivityAt: string;
  /** Open loops / unresolved items surfaced during work */
  openLoops: string[];
  /** Open decisions that still need resolution */
  openDecisions: BriefOpenDecision[];
  /** Current working layer in requirements flow (if applicable) */
  currentLayer: string | null;
  /** One-line progress summary */
  progressSummary: string;
  /** Blockers preventing progress */
  blockers: string[];
  /** Whether this feature has been finalized / handed off */
  isFinalized: boolean;
  /** Live executive-state classification when the source adapter can infer it */
  briefingState?: "shaping" | "admission_pending" | "ready_to_start" | "implementation_active" | "closeout";
  /** Source-derived next action when the live adapter can provide one */
  nextAction?: string | null;
  /** Source families that contributed to this feature snapshot */
  sourceFamilies?: BriefSourceFamily[];
  /** Expected families that were missing while building this snapshot */
  missingSourceFamilies?: BriefSourceFamily[];
}

export interface BriefOpenDecision {
  question: string;
  impact: string;
  status: "open" | "resolved";
}

export interface BriefSourceFacts {
  /** When these facts were collected (ISO-8601) */
  collectedAt: string;
  /** All feature snapshots, in any order */
  features: BriefFeatureSnapshot[];
  /** Global open loops not tied to a specific feature */
  globalOpenLoops: string[];
  /** Source system identifier for isolation/partition proof */
  sourcePartition: "production" | "proof" | "mixed";
  /** Per-family source availability for graceful-degradation proof */
  sourceAvailability?: BriefSourceAvailability[];
  /** Age of the freshest underlying source truth, in ms */
  sourceFreshnessAgeMs?: number;
}

export type BriefSourceFamily =
  | "thread_onion"
  | "finalized_requirement"
  | "cto_admission"
  | "implement_plan";

export interface BriefSourceAvailability {
  family: BriefSourceFamily;
  available: boolean;
  itemCount: number;
  collectedAt: string;
  freshnessAgeMs: number;
}

// ---------------------------------------------------------------------------
// Derived executive brief — the output read model
// ---------------------------------------------------------------------------

export interface BriefIssueItem {
  featureId: string;
  featureLabel: string;
  headline: string;
  details: string[];
}

export interface BriefTableItem {
  featureId: string;
  featureLabel: string;
  summary: string;
  openDecisionCount: number;
}

export interface BriefInMotionItem {
  featureId: string;
  featureLabel: string;
  currentLayer: string | null;
  progressSummary: string;
}

export interface BriefWhatsNextItem {
  featureId: string;
  featureLabel: string;
  nextAction: string;
}

export interface ExecutiveBrief {
  /** When the brief was built (ISO-8601) */
  builtAt: string;
  /** Source partition for isolation proof */
  sourcePartition: "production" | "proof" | "mixed";
  /** Age of source facts in ms at the time of build */
  sourceAgeMs: number;

  issues: BriefIssueItem[];
  onTheTable: BriefTableItem[];
  inMotion: BriefInMotionItem[];
  whatsNext: BriefWhatsNextItem[];

  /** Parity counts — must match source fact counts for audit */
  parity: BriefParityCounts;
  /** Metadata completeness — fraction of features with full metadata */
  sourceMetadataCompletenessRate: number;
}

export interface BriefParityCounts {
  /** Total blocked features in source that should appear in Issues */
  issuesExpected: number;
  issuesActual: number;
  /** Features with open decisions that should appear On The Table */
  tableExpected: number;
  tableActual: number;
  /** Active in-progress features that should appear In Motion */
  inMotionExpected: number;
  inMotionActual: number;
  /** Features with a clear next action that should appear in What's Next */
  whatsNextExpected: number;
  whatsNextActual: number;
}

// ---------------------------------------------------------------------------
// KPI types
// ---------------------------------------------------------------------------

export interface BriefBuildMetrics {
  buildLatencyMs: number;
  renderLatencyMs: number;
  success: boolean;
  featureCount: number;
  issueCount: number;
  sourcePartition: "production" | "proof" | "mixed";
  sourceAgeMs: number;
  sourceMetadataCompletenessRate: number;
  parity: BriefParityCounts;
}
