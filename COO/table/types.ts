/**
 * Company Table & Queue Read Model — Type Definitions
 *
 * Pure derived layer: reads existing truth sources, produces a normalized
 * company-level table of all Phase 1 work. Never writes back to source truth.
 */

// ---------------------------------------------------------------------------
// Normalized table states
// ---------------------------------------------------------------------------

export type TableItemState =
  | "shaping"
  | "admission_pending"
  | "admitted"
  | "in_motion"
  | "blocked"
  | "next"
  | "completed_recently";

// ---------------------------------------------------------------------------
// Source family identifiers
// ---------------------------------------------------------------------------

export type SourceFamily =
  | "thread_onion"
  | "finalized_requirement"
  | "cto_admission"
  | "implement_plan";

// ---------------------------------------------------------------------------
// Source adapter outputs — one per source family
// ---------------------------------------------------------------------------

export interface ThreadOnionSnapshot {
  threadId: string;
  scopePath: string | null;
  threadStatus: "active" | "paused" | "completed";
  lifecycleStatus: string | null;
  currentLayer: string | null;
  traceId: string | null;
  topic: string | null;
  blockers: string[];
  openDecisions: string[];
  hasApprovedSnapshot: boolean;
  hasFinalizedRequirement: boolean;
  lastActivityAt: string;
}

export interface FinalizedRequirementSnapshot {
  featureSlug: string;
  requirementSource: string;
  frozenAt: string;
  businessPriority: "critical" | "high" | "medium" | "low";
  derivationStatus: "ready" | "blocked";
  blockers: string[];
  requirementCount: number;
  boundaryCount: number;
  openDecisionCount: number;
}

export interface CtoAdmissionSnapshot {
  featureSlug: string;
  decision: "admit" | "defer" | "block" | null;
  decisionReason: string | null;
  decidedAt: string | null;
  dependencyBlocked: boolean;
  scopeConflictDetected: boolean;
  packetBuiltAt: string;
  buildOutcome: "admitted" | "deferred" | "blocked" | "build_failed" | null;
}

export interface ImplementPlanSnapshot {
  featureSlug: string;
  phaseNumber: number;
  featureStatus: string;
  activeRunStatus: string;
  mergeStatus: string;
  lastCompletedStep: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  featureBranch: string | null;
}

// ---------------------------------------------------------------------------
// Collected source facts
// ---------------------------------------------------------------------------

export interface SourceAvailability {
  family: SourceFamily;
  available: boolean;
  itemCount: number;
  collectedAt: string;
  freshnessAgeMs: number;
}

export interface TableSourceFacts {
  collectedAt: string;
  sourcePartition: "production" | "proof" | "mixed";
  availability: SourceAvailability[];
  threads: ThreadOnionSnapshot[];
  requirements: FinalizedRequirementSnapshot[];
  admissions: CtoAdmissionSnapshot[];
  plans: ImplementPlanSnapshot[];
}

// ---------------------------------------------------------------------------
// Normalized table entry
// ---------------------------------------------------------------------------

export interface AmbiguityNote {
  field: string;
  sources: string[];
  message: string;
}

export interface TableEntry {
  /** Stable identifier — typically feature slug or thread scope */
  id: string;
  /** Human-readable label */
  label: string;
  /** Normalized state */
  state: TableItemState;
  /** Which source families contributed to this entry */
  contributingSources: SourceFamily[];
  /** Blockers preventing progress */
  blockers: string[];
  /** Open decisions needing resolution */
  openDecisions: string[];
  /** One-line progress note */
  progressNote: string;
  /** ISO-8601 of most recent activity across all sources */
  lastActivityAt: string;
  /** True if state was determined from multiple conflicting signals */
  hasAmbiguity: boolean;
  /** Explicit ambiguity/conflict notes */
  ambiguityNotes: AmbiguityNote[];
  /** True when source data was entirely missing (not the same as empty-state) */
  missingSourceFamilies: SourceFamily[];
}

// ---------------------------------------------------------------------------
// Company table read model — the output
// ---------------------------------------------------------------------------

export interface TableParityCounts {
  /** Total unique items discovered across all sources */
  totalSourceItems: number;
  /** Total items in the normalized table */
  totalTableEntries: number;
  /** Items that appeared in multiple source families */
  multiSourceEntries: number;
  /** Items with ambiguity notes */
  ambiguousEntries: number;
  /** Items with missing source families */
  missingSourceEntries: number;
}

export interface CompanyTable {
  builtAt: string;
  sourcePartition: "production" | "proof" | "mixed";
  sourceAgeMs: number;
  sourceAvailability: SourceAvailability[];

  entries: TableEntry[];

  /** Counts by state for quick summary */
  stateCounts: Record<TableItemState, number>;

  /** Parity between sources and table */
  parity: TableParityCounts;

  /** Source metadata completeness rate (0..1) */
  sourceMetadataCompletenessRate: number;
}

// ---------------------------------------------------------------------------
// KPI types
// ---------------------------------------------------------------------------

export interface TableBuildMetrics {
  buildLatencyMs: number;
  renderLatencyMs: number;
  success: boolean;
  entryCount: number;
  sourcePartition: "production" | "proof" | "mixed";
  sourceAgeMs: number;
  sourceMetadataCompletenessRate: number;
  stateCounts: Record<TableItemState, number>;
  parity: TableParityCounts;
  missingSourceCount: number;
  ambiguousStateCount: number;
  blockedItemCount: number;
  admissionPendingCount: number;
  inMotionCount: number;
  completedRecentlyCount: number;
  sourceFreshnessAgeMs: number;
  sourceParityCount: number;
}

export interface TableKpiReport {
  totalBuilds: number;
  buildSuccessCount: number;
  buildFailureCount: number;
  buildLatency: { p50: number; p95: number; p99: number };
  slowBuckets: { over1s: number; over10s: number; over60s: number };
  latestMissingSourceCount: number;
  latestAmbiguousStateCount: number;
  latestBlockedItemCount: number;
  latestAdmissionPendingCount: number;
  latestInMotionCount: number;
  latestCompletedRecentlyCount: number;
  latestSourceFreshnessAgeMs: number;
  latestSourceParityCount: number;
  latestSourcePartition: "production" | "proof" | "mixed" | null;
}
