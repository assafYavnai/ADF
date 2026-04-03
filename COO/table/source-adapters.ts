/**
 * Company Table Source Adapters
 *
 * Each adapter reads from one source family and produces a normalized snapshot.
 * Adapters are pure functions over provided data — they never read files or
 * mutate source truth.
 */

import type {
  ThreadOnionSnapshot,
  FinalizedRequirementSnapshot,
  CtoAdmissionSnapshot,
  ImplementPlanSnapshot,
  SourceAvailability,
  SourceFamily,
  TableSourceFacts,
} from "./types.js";

// ---------------------------------------------------------------------------
// Thread / Onion adapter
// ---------------------------------------------------------------------------

export interface RawThreadInput {
  id: string;
  status: string;
  scopePath: string | null;
  createdAt: string;
  updatedAt: string;
  workflowState: {
    active_workflow: string | null;
    onion?: {
      trace_id?: string | null;
      lifecycle_status?: string | null;
      current_layer?: string | null;
      state?: {
        topic?: string | null;
        freeze_status?: { status?: string; blockers?: string[] } | null;
        open_decisions?: Array<{ question: string }> | null;
      } | null;
      requirement_artifact?: { requirement_items?: unknown[] } | null;
      finalized_requirement_memory_id?: string | null;
      working_artifact?: {
        approved_snapshot?: unknown | null;
      } | null;
    } | null;
  };
}

export function adaptThreads(raw: RawThreadInput[]): ThreadOnionSnapshot[] {
  return raw.map((t) => {
    const onion = t.workflowState.onion;
    const freezeBlockers = onion?.state?.freeze_status?.blockers ?? [];
    const openDecisions = (onion?.state?.open_decisions ?? [])
      .map((d) => d.question);

    return {
      threadId: t.id,
      scopePath: t.scopePath,
      threadStatus: normalizeThreadStatus(t.status),
      lifecycleStatus: onion?.lifecycle_status ?? null,
      currentLayer: onion?.current_layer ?? null,
      traceId: onion?.trace_id ?? null,
      topic: onion?.state?.topic ?? null,
      blockers: freezeBlockers,
      openDecisions,
      hasApprovedSnapshot: !!(onion?.working_artifact?.approved_snapshot),
      hasFinalizedRequirement: !!(onion?.finalized_requirement_memory_id),
      lastActivityAt: t.updatedAt,
    };
  });
}

function normalizeThreadStatus(raw: string): "active" | "paused" | "completed" {
  if (raw === "active" || raw === "paused" || raw === "completed") return raw;
  return "active";
}

// ---------------------------------------------------------------------------
// Finalized Requirement adapter
// ---------------------------------------------------------------------------

export interface RawRequirementInput {
  feature_slug: string;
  requirement_artifact_source: string;
  frozen_at: string;
  business_priority: string;
  claimed_scope_paths?: string[];
  non_goals?: string[];
  boundaries?: string[];
  requirement_summary?: string;
  requirement_items?: unknown[];
  explicit_boundaries?: unknown[];
  open_business_decisions?: unknown[];
  derivation_status?: string;
  blockers?: string[];
}

export function adaptRequirements(raw: RawRequirementInput[]): FinalizedRequirementSnapshot[] {
  return raw.map((r) => ({
    featureSlug: r.feature_slug,
    requirementSource: r.requirement_artifact_source,
    frozenAt: r.frozen_at,
    businessPriority: normalizeBusinessPriority(r.business_priority),
    derivationStatus: r.derivation_status === "blocked" ? "blocked" : "ready",
    blockers: r.blockers ?? [],
    requirementCount: Array.isArray(r.requirement_items) ? r.requirement_items.length : 0,
    boundaryCount: Array.isArray(r.explicit_boundaries) ? r.explicit_boundaries.length : 0,
    openDecisionCount: Array.isArray(r.open_business_decisions) ? r.open_business_decisions.length : 0,
  }));
}

function normalizeBusinessPriority(raw: string): "critical" | "high" | "medium" | "low" {
  if (raw === "critical" || raw === "high" || raw === "medium" || raw === "low") return raw;
  return "medium";
}

// ---------------------------------------------------------------------------
// CTO Admission adapter
// ---------------------------------------------------------------------------

export interface RawAdmissionInput {
  feature_slug: string;
  decision?: string | null;
  decision_reason?: string | null;
  decided_at?: string | null;
  dependency_blocked?: boolean;
  scope_conflict_detected?: boolean;
  packet_built_at?: string;
  outcome?: string | null;
}

export function adaptAdmissions(raw: RawAdmissionInput[]): CtoAdmissionSnapshot[] {
  return raw.map((a) => ({
    featureSlug: a.feature_slug,
    decision: normalizeAdmissionDecision(a.decision),
    decisionReason: a.decision_reason ?? null,
    decidedAt: a.decided_at ?? null,
    dependencyBlocked: a.dependency_blocked ?? false,
    scopeConflictDetected: a.scope_conflict_detected ?? false,
    packetBuiltAt: a.packet_built_at ?? new Date().toISOString(),
    buildOutcome: normalizeBuildOutcome(a.outcome),
  }));
}

function normalizeAdmissionDecision(raw: string | null | undefined): "admit" | "defer" | "block" | null {
  if (raw === "admit" || raw === "defer" || raw === "block") return raw;
  return null;
}

function normalizeBuildOutcome(raw: string | null | undefined): "admitted" | "deferred" | "blocked" | "build_failed" | null {
  if (raw === "admitted" || raw === "deferred" || raw === "blocked" || raw === "build_failed") return raw;
  return null;
}

// ---------------------------------------------------------------------------
// Implement-Plan adapter
// ---------------------------------------------------------------------------

export interface RawImplementPlanInput {
  feature_slug: string;
  phase_number: number;
  feature_status: string;
  active_run_status: string;
  merge_status?: string;
  last_completed_step?: string;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
  feature_branch?: string | null;
}

export function adaptImplementPlans(raw: RawImplementPlanInput[]): ImplementPlanSnapshot[] {
  return raw.map((p) => ({
    featureSlug: p.feature_slug,
    phaseNumber: p.phase_number,
    featureStatus: p.feature_status,
    activeRunStatus: p.active_run_status,
    mergeStatus: p.merge_status ?? "unknown",
    lastCompletedStep: p.last_completed_step ?? "unknown",
    lastError: p.last_error ?? null,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    featureBranch: p.feature_branch ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Fact collector
// ---------------------------------------------------------------------------

export function collectSourceFacts(input: {
  threads?: RawThreadInput[];
  requirements?: RawRequirementInput[];
  admissions?: RawAdmissionInput[];
  plans?: RawImplementPlanInput[];
  sourcePartition?: "production" | "proof" | "mixed";
}): TableSourceFacts {
  const now = new Date().toISOString();
  const nowMs = Date.now();

  const threads = input.threads ? adaptThreads(input.threads) : [];
  const requirements = input.requirements ? adaptRequirements(input.requirements) : [];
  const admissions = input.admissions ? adaptAdmissions(input.admissions) : [];
  const plans = input.plans ? adaptImplementPlans(input.plans) : [];

  function buildAvailability(family: SourceFamily, available: boolean, count: number): SourceAvailability {
    return {
      family,
      available,
      itemCount: count,
      collectedAt: now,
      freshnessAgeMs: 0,
    };
  }

  const availability: SourceAvailability[] = [
    buildAvailability("thread_onion", !!input.threads, threads.length),
    buildAvailability("finalized_requirement", !!input.requirements, requirements.length),
    buildAvailability("cto_admission", !!input.admissions, admissions.length),
    buildAvailability("implement_plan", !!input.plans, plans.length),
  ];

  return {
    collectedAt: now,
    sourcePartition: input.sourcePartition ?? "production",
    availability,
    threads,
    requirements,
    admissions,
    plans,
  };
}
