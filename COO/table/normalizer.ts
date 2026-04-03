/**
 * Company Table Normalizer
 *
 * Takes collected source facts and produces a unified CompanyTable.
 * Resolves conflicts between source families with explicit ambiguity markers.
 * Never mutates source data.
 */

import type {
  TableSourceFacts,
  TableEntry,
  TableItemState,
  CompanyTable,
  TableParityCounts,
  AmbiguityNote,
  SourceFamily,
  ThreadOnionSnapshot,
  FinalizedRequirementSnapshot,
  CtoAdmissionSnapshot,
  ImplementPlanSnapshot,
} from "./types.js";

// ---------------------------------------------------------------------------
// Correlation: group sources by feature identity
// ---------------------------------------------------------------------------

interface CorrelatedItem {
  id: string;
  label: string;
  thread: ThreadOnionSnapshot | null;
  requirement: FinalizedRequirementSnapshot | null;
  admission: CtoAdmissionSnapshot | null;
  plan: ImplementPlanSnapshot | null;
}

function correlate(facts: TableSourceFacts): CorrelatedItem[] {
  const map = new Map<string, CorrelatedItem>();

  function ensure(id: string, label: string): CorrelatedItem {
    let item = map.get(id);
    if (!item) {
      item = { id, label, thread: null, requirement: null, admission: null, plan: null };
      map.set(id, item);
    }
    if (label && (!item.label || item.label === id)) {
      item.label = label;
    }
    return item;
  }

  for (const t of facts.threads) {
    const id = t.scopePath ?? t.threadId;
    const label = t.topic ?? t.scopePath ?? t.threadId;
    const item = ensure(id, label);
    item.thread = t;
  }

  for (const r of facts.requirements) {
    const item = ensure(r.featureSlug, r.featureSlug);
    item.requirement = r;
  }

  for (const a of facts.admissions) {
    const item = ensure(a.featureSlug, a.featureSlug);
    item.admission = a;
  }

  for (const p of facts.plans) {
    const item = ensure(p.featureSlug, p.featureSlug);
    item.plan = p;
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// State resolution
// ---------------------------------------------------------------------------

interface StateResolution {
  state: TableItemState;
  hasAmbiguity: boolean;
  ambiguityNotes: AmbiguityNote[];
  progressNote: string;
  blockers: string[];
  openDecisions: string[];
  contributingSources: SourceFamily[];
  missingSourceFamilies: SourceFamily[];
  lastActivityAt: string;
}

function resolveState(item: CorrelatedItem, facts: TableSourceFacts): StateResolution {
  const candidates: Array<{ state: TableItemState; source: SourceFamily; reason: string }> = [];
  const blockers: string[] = [];
  const openDecisions: string[] = [];
  const contributingSources: SourceFamily[] = [];
  const missingSourceFamilies: SourceFamily[] = [];
  const ambiguityNotes: AmbiguityNote[] = [];
  let progressNote = "";
  let lastActivityAt = "";

  // --- Thread / Onion ---
  if (item.thread) {
    contributingSources.push("thread_onion");
    if (item.thread.lastActivityAt > lastActivityAt) lastActivityAt = item.thread.lastActivityAt;
    blockers.push(...item.thread.blockers);
    openDecisions.push(...item.thread.openDecisions);

    const ts = resolveThreadState(item.thread);
    candidates.push({ state: ts.state, source: "thread_onion", reason: ts.reason });
    if (!progressNote) progressNote = ts.progress;
  } else if (isSourceAvailable(facts, "thread_onion")) {
    missingSourceFamilies.push("thread_onion");
  }

  // --- Finalized Requirement ---
  if (item.requirement) {
    contributingSources.push("finalized_requirement");
    if (item.requirement.frozenAt > lastActivityAt) lastActivityAt = item.requirement.frozenAt;
    blockers.push(...item.requirement.blockers);

    if (item.requirement.derivationStatus === "blocked") {
      candidates.push({ state: "blocked", source: "finalized_requirement", reason: "requirement derivation blocked" });
    } else {
      candidates.push({ state: "admission_pending", source: "finalized_requirement", reason: "requirement ready, pending admission" });
    }
  } else if (isSourceAvailable(facts, "finalized_requirement")) {
    // Not all items need a finalized requirement — only flag if the item
    // has progressed past shaping (has thread with approved snapshot or handoff_ready)
    if (item.thread?.hasApprovedSnapshot || item.thread?.hasFinalizedRequirement) {
      missingSourceFamilies.push("finalized_requirement");
    }
  }

  // --- CTO Admission ---
  if (item.admission) {
    contributingSources.push("cto_admission");
    if (item.admission.decidedAt && item.admission.decidedAt > lastActivityAt) {
      lastActivityAt = item.admission.decidedAt;
    }
    if (item.admission.packetBuiltAt > lastActivityAt) {
      lastActivityAt = item.admission.packetBuiltAt;
    }

    if (item.admission.dependencyBlocked) {
      blockers.push("dependency blocked (CTO admission)");
    }
    if (item.admission.scopeConflictDetected) {
      blockers.push("scope conflict detected (CTO admission)");
    }

    const as = resolveAdmissionState(item.admission);
    candidates.push({ state: as.state, source: "cto_admission", reason: as.reason });
    if (!progressNote) progressNote = as.progress;
  } else if (isSourceAvailable(facts, "cto_admission")) {
    // Admission is only expected if there's a finalized requirement
    if (item.requirement) {
      missingSourceFamilies.push("cto_admission");
    }
  }

  // --- Implement Plan ---
  if (item.plan) {
    contributingSources.push("implement_plan");
    if (item.plan.updatedAt > lastActivityAt) lastActivityAt = item.plan.updatedAt;
    if (item.plan.lastError) {
      blockers.push(`implement-plan error: ${item.plan.lastError}`);
    }

    const ps = resolvePlanState(item.plan);
    candidates.push({ state: ps.state, source: "implement_plan", reason: ps.reason });
    if (!progressNote) progressNote = ps.progress;
  } else if (isSourceAvailable(facts, "implement_plan")) {
    // Plans are only expected if admitted
    if (item.admission?.decision === "admit") {
      missingSourceFamilies.push("implement_plan");
    }
  }

  // --- Resolve final state ---
  const uniqueStates = new Set(candidates.map((c) => c.state));

  let finalState: TableItemState;
  if (candidates.length === 0) {
    finalState = "shaping";
    progressNote = progressNote || "No source data — assumed early shaping";
  } else if (uniqueStates.size === 1) {
    finalState = candidates[0].state;
  } else {
    // Multiple sources disagree — use priority resolution but flag ambiguity
    finalState = priorityResolve(candidates.map((c) => c.state), blockers);

    for (const c of candidates) {
      if (c.state !== finalState) {
        ambiguityNotes.push({
          field: "state",
          sources: [c.source],
          message: `${c.source} suggests "${c.state}" (${c.reason}), resolved to "${finalState}"`,
        });
      }
    }
  }

  // Override to blocked if there are unresolved blockers
  if (blockers.length > 0 && finalState !== "blocked") {
    if (finalState !== "completed_recently") {
      ambiguityNotes.push({
        field: "state",
        sources: contributingSources,
        message: `State resolved to "${finalState}" but ${blockers.length} blocker(s) present — overriding to "blocked"`,
      });
      finalState = "blocked";
    }
  }

  if (!progressNote) {
    progressNote = `State: ${finalState}`;
  }

  if (!lastActivityAt) {
    lastActivityAt = facts.collectedAt;
  }

  return {
    state: finalState,
    hasAmbiguity: ambiguityNotes.length > 0,
    ambiguityNotes,
    progressNote,
    blockers,
    openDecisions,
    contributingSources,
    missingSourceFamilies,
    lastActivityAt,
  };
}

function resolveThreadState(t: ThreadOnionSnapshot): { state: TableItemState; reason: string; progress: string } {
  if (t.threadStatus === "completed") {
    return { state: "completed_recently", reason: "thread completed", progress: "Thread completed" };
  }
  if (t.blockers.length > 0) {
    return { state: "blocked", reason: `${t.blockers.length} blocker(s)`, progress: `Blocked: ${t.blockers[0]}` };
  }
  if (t.lifecycleStatus === "handoff_ready") {
    return { state: "admission_pending", reason: "handoff ready", progress: "Requirements frozen, ready for admission" };
  }
  if (t.lifecycleStatus === "approved") {
    return { state: "admission_pending", reason: "onion approved", progress: "Approved, pending admission" };
  }
  if (t.lifecycleStatus === "awaiting_freeze_approval") {
    return { state: "shaping", reason: "awaiting freeze approval", progress: "Awaiting freeze approval" };
  }
  if (t.hasFinalizedRequirement) {
    return { state: "admission_pending", reason: "has finalized requirement", progress: "Requirement finalized" };
  }
  if (t.hasApprovedSnapshot) {
    return { state: "shaping", reason: "approved snapshot, not yet finalized", progress: `Shaping — layer: ${t.currentLayer ?? "unknown"}` };
  }
  if (t.lifecycleStatus === "active" || t.threadStatus === "active") {
    return { state: "shaping", reason: "active thread", progress: `Shaping — layer: ${t.currentLayer ?? "unknown"}` };
  }
  return { state: "shaping", reason: "default thread state", progress: "Early shaping" };
}

function resolveAdmissionState(a: CtoAdmissionSnapshot): { state: TableItemState; reason: string; progress: string } {
  if (a.dependencyBlocked || a.scopeConflictDetected) {
    return { state: "blocked", reason: "admission blocked", progress: "Blocked at admission" };
  }
  if (a.decision === "admit") {
    return { state: "admitted", reason: "CTO admitted", progress: `Admitted${a.decisionReason ? `: ${a.decisionReason}` : ""}` };
  }
  if (a.decision === "defer") {
    return { state: "next", reason: "CTO deferred", progress: `Deferred${a.decisionReason ? `: ${a.decisionReason}` : ""}` };
  }
  if (a.decision === "block") {
    return { state: "blocked", reason: "CTO blocked", progress: `Blocked by CTO${a.decisionReason ? `: ${a.decisionReason}` : ""}` };
  }
  if (a.buildOutcome === "build_failed") {
    return { state: "blocked", reason: "admission build failed", progress: "Admission packet build failed" };
  }
  return { state: "admission_pending", reason: "no CTO decision yet", progress: "Admission pending — no decision" };
}

function resolvePlanState(p: ImplementPlanSnapshot): { state: TableItemState; reason: string; progress: string } {
  if (p.featureStatus === "completed" && p.mergeStatus === "merged") {
    return { state: "completed_recently", reason: "plan completed and merged", progress: "Completed and merged" };
  }
  if (p.featureStatus === "completed") {
    return { state: "completed_recently", reason: "plan completed", progress: `Completed — merge: ${p.mergeStatus}` };
  }
  if (p.featureStatus === "paused") {
    return { state: "blocked", reason: "plan paused", progress: "Implementation paused" };
  }
  if (p.activeRunStatus === "completed") {
    return { state: "completed_recently", reason: "run completed", progress: "Run completed" };
  }
  if (p.activeRunStatus === "merge_ready" || p.mergeStatus === "ready_to_queue" || p.mergeStatus === "in_queue") {
    return { state: "in_motion", reason: `merge status: ${p.mergeStatus}`, progress: `In motion — ${p.activeRunStatus}` };
  }
  if (p.activeRunStatus === "implementation_in_progress" || p.activeRunStatus === "verification_pending") {
    return { state: "in_motion", reason: `run: ${p.activeRunStatus}`, progress: `In motion — ${p.activeRunStatus}` };
  }
  return { state: "in_motion", reason: `plan active: ${p.activeRunStatus}`, progress: `Active — ${p.activeRunStatus}` };
}

// State priority: blocked > in_motion > completed_recently > admitted > admission_pending > next > shaping
const STATE_PRIORITY: TableItemState[] = [
  "blocked",
  "in_motion",
  "completed_recently",
  "admitted",
  "admission_pending",
  "next",
  "shaping",
];

function priorityResolve(states: TableItemState[], blockers: string[]): TableItemState {
  if (blockers.length > 0) return "blocked";
  for (const s of STATE_PRIORITY) {
    if (states.includes(s)) return s;
  }
  return "shaping";
}

function isSourceAvailable(facts: TableSourceFacts, family: SourceFamily): boolean {
  return facts.availability.some((a) => a.family === family && a.available);
}

// ---------------------------------------------------------------------------
// Table builder
// ---------------------------------------------------------------------------

const ALL_STATES: TableItemState[] = [
  "shaping",
  "admission_pending",
  "admitted",
  "in_motion",
  "blocked",
  "next",
  "completed_recently",
];

function initStateCounts(): Record<TableItemState, number> {
  const counts = {} as Record<TableItemState, number>;
  for (const s of ALL_STATES) counts[s] = 0;
  return counts;
}

function hasMetadata(entry: TableEntry): boolean {
  return (
    entry.label.trim().length > 0 &&
    entry.lastActivityAt.trim().length > 0 &&
    entry.progressNote.trim().length > 0
  );
}

export function buildCompanyTable(facts: TableSourceFacts): CompanyTable {
  const builtAt = new Date().toISOString();
  const sourceAgeMs = Date.now() - new Date(facts.collectedAt).getTime();

  const correlated = correlate(facts);
  const entries: TableEntry[] = [];
  const stateCounts = initStateCounts();

  for (const item of correlated) {
    const resolution = resolveState(item, facts);

    entries.push({
      id: item.id,
      label: item.label,
      state: resolution.state,
      contributingSources: resolution.contributingSources,
      blockers: resolution.blockers,
      openDecisions: resolution.openDecisions,
      progressNote: resolution.progressNote,
      lastActivityAt: resolution.lastActivityAt,
      hasAmbiguity: resolution.hasAmbiguity,
      ambiguityNotes: resolution.ambiguityNotes,
      missingSourceFamilies: resolution.missingSourceFamilies,
    });

    stateCounts[resolution.state]++;
  }

  // Sort: blocked first, then in_motion, then by last activity descending
  entries.sort((a, b) => {
    const ap = STATE_PRIORITY.indexOf(a.state);
    const bp = STATE_PRIORITY.indexOf(b.state);
    if (ap !== bp) return ap - bp;
    return b.lastActivityAt.localeCompare(a.lastActivityAt);
  });

  const totalSourceItems =
    facts.threads.length + facts.requirements.length + facts.admissions.length + facts.plans.length;

  const parity: TableParityCounts = {
    totalSourceItems,
    totalTableEntries: entries.length,
    multiSourceEntries: entries.filter((e) => e.contributingSources.length > 1).length,
    ambiguousEntries: entries.filter((e) => e.hasAmbiguity).length,
    missingSourceEntries: entries.filter((e) => e.missingSourceFamilies.length > 0).length,
  };

  const withMetadata = entries.filter(hasMetadata).length;
  const sourceMetadataCompletenessRate = entries.length === 0 ? 1 : withMetadata / entries.length;

  return {
    builtAt,
    sourcePartition: facts.sourcePartition,
    sourceAgeMs,
    sourceAvailability: facts.availability,
    entries,
    stateCounts,
    parity,
    sourceMetadataCompletenessRate,
  };
}
