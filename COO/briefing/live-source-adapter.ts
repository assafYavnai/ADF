import { constants } from "node:fs";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { FileSystemThreadStore, getLatestStateCommit, type Thread } from "../controller/thread.js";
import { createSystemProvenance, type Provenance } from "../../shared/provenance/types.js";
import type {
  BriefFeatureSnapshot,
  BriefOpenDecision,
  BriefSourceAvailability,
  BriefSourceFacts,
  BriefSourceFamily,
} from "./types.js";

export interface BriefRequirementReader {
  getRequirement(
    memoryId: string,
    scope: string,
    provenance: Provenance,
    options?: {
      include_legacy?: boolean;
      telemetry_context?: Record<string, unknown>;
    },
  ): Promise<Record<string, unknown>>;
}

export interface LiveBriefSourceFactsOptions {
  projectRoot: string;
  threadsDir: string;
  brainClient?: BriefRequirementReader | null;
  sourcePartition?: "production" | "proof" | "mixed";
  now?: Date;
  threadStore?: Pick<FileSystemThreadStore, "list" | "get">;
}

export interface LiveBriefDiagnostics {
  availability: BriefSourceAvailability[];
  unavailableFamilies: BriefSourceFamily[];
  degradationNotes: string[];
  missingSourceCount: number;
  sourceFreshnessAgeMs: number;
}

export interface LiveBriefSourceFactsResult {
  facts: BriefSourceFacts;
  diagnostics: LiveBriefDiagnostics;
}

interface ThreadSignal {
  id: string;
  label: string;
  scopePath: string | null;
  status: BriefFeatureSnapshot["status"];
  currentLayer: string | null;
  blockers: string[];
  openLoops: string[];
  openDecisions: BriefOpenDecision[];
  progressSummary: string;
  lastActivityAt: string;
  hasApprovedSnapshot: boolean;
  hasFinalizedRequirement: boolean;
  finalizedRequirementMemoryId: string | null;
}

interface RequirementSignal {
  id: string;
  label: string;
  summary: string;
  blockers: string[];
  openDecisions: BriefOpenDecision[];
  derivationStatus: "ready" | "blocked";
  lastActivityAt: string;
}

interface AdmissionSignal {
  id: string;
  decision: "admit" | "defer" | "block" | null;
  decisionReason: string | null;
  dependencyBlocked: boolean;
  scopeConflictDetected: boolean;
  packetBuiltAt: string;
  decidedAt: string | null;
}

interface PlanSignal {
  id: string;
  featureStatus: string;
  activeRunStatus: string;
  mergeStatus: string;
  lastCompletedStep: string;
  lastError: string | null;
  updatedAt: string;
  featureBranch: string | null;
}

interface FamilyLoadResult<T> {
  available: boolean;
  items: T[];
  notes: string[];
}

interface CorrelatedBriefItem {
  id: string;
  label: string;
  thread: ThreadSignal | null;
  requirement: RequirementSignal | null;
  admission: AdmissionSignal | null;
  plan: PlanSignal | null;
}

const PLAN_IN_MOTION_STATUSES = new Set([
  "implementation_in_progress",
  "verification_pending",
  "review_cycle_pending",
  "review_requested",
  "review_in_progress",
  "human_verification_pending",
  "merge_ready",
  "ready_to_queue",
  "in_queue",
  "queued",
]);

const PLAN_READY_TO_START_STATUSES = new Set([
  "context_ready",
  "prepared",
  "ready_to_start",
]);

export async function loadLiveBriefSourceFacts(
  options: LiveBriefSourceFactsOptions,
): Promise<LiveBriefSourceFactsResult> {
  const now = options.now ?? new Date();
  const collectedAt = now.toISOString();
  const threadStore = options.threadStore ?? new FileSystemThreadStore(options.threadsDir);

  const threadLoad = await loadThreadSignals(threadStore);
  const requirementLoad = await loadRequirementSignals(threadLoad.items, options.brainClient ?? null);
  const admissionLoad = await loadAdmissionSignals(options.projectRoot, collectedAt);
  const planLoad = await loadImplementPlanSignals(options.projectRoot);

  const availability = [
    buildAvailability("thread_onion", threadLoad, collectedAt, now),
    buildAvailability("finalized_requirement", requirementLoad, collectedAt, now),
    buildAvailability("cto_admission", admissionLoad, collectedAt, now),
    buildAvailability("implement_plan", planLoad, collectedAt, now),
  ];

  const features = correlateSources({
    threads: threadLoad.items,
    requirements: requirementLoad.items,
    admissions: admissionLoad.items,
    plans: planLoad.items,
    availability,
    fallbackCollectedAt: collectedAt,
  });

  const unavailableFamilies = availability
    .filter((entry) => !entry.available)
    .map((entry) => entry.family);
  const itemMissingSourceCount = features.reduce(
    (sum, feature) => sum + (feature.missingSourceFamilies?.length ?? 0),
    0,
  );
  const sourceFreshnessAgeMs = computeSourceFreshnessAgeMs(features, availability, collectedAt, now);
  const degradationNotes = buildDegradationNotes(
    unavailableFamilies,
    [...threadLoad.notes, ...requirementLoad.notes, ...admissionLoad.notes, ...planLoad.notes],
  );

  return {
    facts: {
      collectedAt,
      features,
      globalOpenLoops: collectGlobalOpenLoops(threadLoad.items),
      sourcePartition: options.sourcePartition ?? "production",
      sourceAvailability: availability,
      sourceFreshnessAgeMs,
    },
    diagnostics: {
      availability,
      unavailableFamilies,
      degradationNotes,
      missingSourceCount: unavailableFamilies.length + itemMissingSourceCount,
      sourceFreshnessAgeMs,
    },
  };
}

async function loadThreadSignals(
  threadStore: Pick<FileSystemThreadStore, "list" | "get">,
): Promise<FamilyLoadResult<ThreadSignal>> {
  let threadIds: string[];
  try {
    threadIds = await threadStore.list();
  } catch (error) {
    return {
      available: false,
      items: [],
      notes: [`COO thread state could not be read: ${formatError(error)}`],
    };
  }

  const settled = await Promise.allSettled(threadIds.map((threadId) => threadStore.get(threadId)));
  const items: ThreadSignal[] = [];
  const notes: string[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      items.push(adaptThread(result.value));
      continue;
    }

    notes.push(`A COO thread could not be loaded and was skipped: ${formatError(result.reason)}`);
  }

  return {
    available: true,
    items,
    notes,
  };
}

async function loadRequirementSignals(
  threads: ThreadSignal[],
  brainClient: BriefRequirementReader | null,
): Promise<FamilyLoadResult<RequirementSignal>> {
  const targets = threads.filter(
    (thread) => typeof thread.finalizedRequirementMemoryId === "string" && thread.finalizedRequirementMemoryId.length > 0 && thread.scopePath,
  );

  if (!brainClient) {
    return {
      available: false,
      items: [],
      notes: targets.length > 0
        ? ["Finalized requirement truth is unavailable because the Brain read path is not available."]
        : [],
    };
  }

  const settled = await Promise.allSettled(
    targets.map(async (target) => {
      const record = await brainClient.getRequirement(
        target.finalizedRequirementMemoryId!,
        target.scopePath!,
        createSystemProvenance(`COO/briefing/live-source-adapter/get-requirement/${target.id}`),
        {
          include_legacy: false,
          telemetry_context: {
            executive_status_surface: "live_exec_brief",
            executive_status_feature_id: target.id,
          },
        },
      );
      return adaptRequirementRecord(record, target);
    }),
  );

  const items: RequirementSignal[] = [];
  const notes: string[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      items.push(result.value);
      continue;
    }

    notes.push(`A finalized requirement artifact could not be read and was skipped: ${formatError(result.reason)}`);
  }

  return {
    available: true,
    items,
    notes,
  };
}

async function loadAdmissionSignals(
  projectRoot: string,
  collectedAt: string,
): Promise<FamilyLoadResult<AdmissionSignal>> {
  const phaseRoot = resolve(projectRoot, "docs", "phase1");
  if (!await pathExists(phaseRoot)) {
    return {
      available: false,
      items: [],
      notes: [],
    };
  }

  const entries = await readdir(phaseRoot, { withFileTypes: true });
  const items: AdmissionSignal[] = [];
  const notes: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const featureRoot = join(phaseRoot, entry.name);
    const requestPath = join(featureRoot, "cto-admission-request.json");
    const decisionPath = join(featureRoot, "cto-admission-decision.template.json");
    const hasRequest = await pathExists(requestPath);
    const hasDecision = await pathExists(decisionPath);
    if (!hasRequest && !hasDecision) continue;

    try {
      const request = hasRequest ? await parseJsonFile<Record<string, unknown>>(requestPath) : null;
      const decision = hasDecision ? await parseJsonFile<Record<string, unknown>>(decisionPath) : null;
      const featureId = normalizeFeatureId(
        asNonEmptyString(decision?.feature_slug)
          ?? asNonEmptyString(request?.feature_slug)
          ?? entry.name,
      );

      items.push({
        id: featureId,
        decision: normalizeAdmissionDecision(asNonEmptyString(decision?.decision)),
        decisionReason: asNonEmptyString(decision?.decision_reason),
        dependencyBlocked: asBoolean(decision?.dependency_blocked),
        scopeConflictDetected: asBoolean(decision?.scope_conflict_detected),
        packetBuiltAt: asNonEmptyString(request?.packet_built_at) ?? collectedAt,
        decidedAt: asNonEmptyString(decision?.decided_at),
      });
    } catch (error) {
      notes.push(`A CTO admission artifact could not be parsed and was skipped: ${formatError(error)}`);
    }
  }

  return {
    available: items.length > 0,
    items,
    notes,
  };
}

async function loadImplementPlanSignals(projectRoot: string): Promise<FamilyLoadResult<PlanSignal>> {
  const featuresIndexPath = await resolveAncestorFile(projectRoot, [".codex", "implement-plan", "features-index.json"]);
  if (!featuresIndexPath) {
    return {
      available: false,
      items: [],
      notes: ["Implement-plan feature truth is unavailable in this checkout."],
    };
  }

  try {
    const payload = await parseJsonFile<Record<string, unknown>>(featuresIndexPath);
    const features = asRecord(payload.features);
    const items = Object.values(features).flatMap((entry) => {
      const plan = asRecord(entry);
      const featureSlug = asNonEmptyString(plan.feature_slug);
      if (!featureSlug) return [];

      return [{
        id: normalizeFeatureId(featureSlug),
        featureStatus: asNonEmptyString(plan.feature_status) ?? "active",
        activeRunStatus: asNonEmptyString(plan.active_run_status) ?? "unknown",
        mergeStatus: asNonEmptyString(plan.merge_status) ?? "unknown",
        lastCompletedStep: asNonEmptyString(plan.last_completed_step) ?? "unknown",
        lastError: asNonEmptyString(plan.last_error),
        updatedAt: asNonEmptyString(plan.updated_at) ?? new Date().toISOString(),
        featureBranch: asNonEmptyString(plan.feature_branch),
      }];
    });

    return {
      available: true,
      items,
      notes: [],
    };
  } catch (error) {
    return {
      available: false,
      items: [],
      notes: [`Implement-plan feature truth could not be parsed: ${formatError(error)}`],
    };
  }
}

function correlateSources(input: {
  threads: ThreadSignal[];
  requirements: RequirementSignal[];
  admissions: AdmissionSignal[];
  plans: PlanSignal[];
  availability: BriefSourceAvailability[];
  fallbackCollectedAt: string;
}): BriefFeatureSnapshot[] {
  const correlated = new Map<string, CorrelatedBriefItem>();

  const ensure = (id: string, label: string): CorrelatedBriefItem => {
    const normalizedId = normalizeFeatureId(id);
    let item = correlated.get(normalizedId);
    if (!item) {
      item = {
        id: normalizedId,
        label: label.trim() || humanizeFeatureId(normalizedId),
        thread: null,
        requirement: null,
        admission: null,
        plan: null,
      };
      correlated.set(normalizedId, item);
    }
    if (label.trim().length > 0 && item.label === humanizeFeatureId(normalizedId)) {
      item.label = label;
    }
    return item;
  };

  for (const thread of input.threads) {
    const item = ensure(thread.id, thread.label);
    item.thread = thread;
  }

  for (const requirement of input.requirements) {
    const item = ensure(requirement.id, requirement.label);
    item.requirement = requirement;
  }

  for (const admission of input.admissions) {
    const item = ensure(admission.id, humanizeFeatureId(admission.id));
    item.admission = admission;
  }

  for (const plan of input.plans) {
    const item = ensure(plan.id, humanizeFeatureId(plan.id));
    item.plan = plan;
  }

  return Array.from(correlated.values())
    .map((item) => toBriefFeatureSnapshot(item, input.availability, input.fallbackCollectedAt))
    .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt));
}

function toBriefFeatureSnapshot(
  item: CorrelatedBriefItem,
  availability: BriefSourceAvailability[],
  fallbackCollectedAt: string,
): BriefFeatureSnapshot {
  const blockers = uniqueStrings([
    ...(item.thread?.blockers ?? []),
    ...(item.requirement?.blockers ?? []),
    ...(item.plan?.lastError ? [item.plan.lastError] : []),
    ...(item.admission?.dependencyBlocked ? ["Dependency blocked in CTO admission."] : []),
    ...(item.admission?.scopeConflictDetected ? ["Scope conflict detected in CTO admission."] : []),
  ]);

  const openDecisions = dedupeOpenDecisions([
    ...(item.thread?.openDecisions ?? []),
    ...(item.requirement?.openDecisions ?? []),
  ]);

  const sourceFamilies = listPresentSourceFamilies(item);
  const missingSourceFamilies = resolveMissingSourceFamilies(item, availability);
  const status = resolveStatus(item, blockers);
  const briefingState = resolveBriefingState(item, status);
  const progressSummary = resolveProgressSummary(item, blockers, briefingState);
  const nextAction = resolveNextAction(item, briefingState, openDecisions);
  const lastActivityAt = maxIsoTimestamp([
    item.thread?.lastActivityAt ?? null,
    item.requirement?.lastActivityAt ?? null,
    item.admission?.decidedAt ?? null,
    item.admission?.packetBuiltAt ?? null,
    item.plan?.updatedAt ?? null,
  ]) ?? fallbackCollectedAt;

  return {
    id: item.id,
    label: item.label,
    status,
    lastActivityAt,
    openLoops: item.thread?.openLoops ?? [],
    openDecisions,
    currentLayer: item.thread?.currentLayer ?? null,
    progressSummary,
    blockers,
    isFinalized: isFinalized(item),
    briefingState,
    nextAction,
    sourceFamilies,
    missingSourceFamilies,
  };
}

function resolveStatus(
  item: CorrelatedBriefItem,
  blockers: string[],
): BriefFeatureSnapshot["status"] {
  if (blockers.length > 0 || item.admission?.decision === "block") {
    return "blocked";
  }

  if (item.plan) {
    if (isPlanCompleted(item.plan)) {
      return "completed";
    }
    if (isPlanInMotion(item.plan)) {
      return "active";
    }
  }

  if (item.admission?.decision === "admit") {
    return "approved";
  }

  if (item.thread) {
    return item.thread.status;
  }

  if (item.requirement?.derivationStatus === "blocked") {
    return "blocked";
  }

  if (item.requirement) {
    return "handoff_ready";
  }

  return "active";
}

function resolveBriefingState(
  item: CorrelatedBriefItem,
  status: BriefFeatureSnapshot["status"],
): BriefFeatureSnapshot["briefingState"] {
  if (item.plan) {
    if (isPlanCompleted(item.plan)) {
      return "closeout";
    }
    if (isPlanInMotion(item.plan)) {
      return "implementation_active";
    }
    if (isPlanReadyToStart(item.plan)) {
      return "ready_to_start";
    }
  }

  if (item.admission) {
    if (item.admission.decision === "admit") {
      return "ready_to_start";
    }
    if (item.admission.decision === "defer") {
      return "shaping";
    }
    return "admission_pending";
  }

  if (item.requirement) {
    return "admission_pending";
  }

  if (status === "completed") {
    return "closeout";
  }

  return "shaping";
}

function resolveProgressSummary(
  item: CorrelatedBriefItem,
  blockers: string[],
  briefingState: BriefFeatureSnapshot["briefingState"],
): string {
  if (blockers.length > 0) {
    return blockers[0];
  }

  if (item.plan) {
    if (isPlanCompleted(item.plan)) {
      return item.plan.mergeStatus === "merged"
        ? "Implementation completed and merged."
        : "Implementation completed and waiting for final closeout.";
    }
    if (isPlanInMotion(item.plan)) {
      return `Implementation is moving through ${humanizeStatus(item.plan.activeRunStatus)}.`;
    }
    if (isPlanReadyToStart(item.plan)) {
      return "Implementation context is ready and waiting to start.";
    }
  }

  if (item.admission) {
    if (item.admission.decision === "admit") {
      return "CTO admission is approved and ready for implementation.";
    }
    if (item.admission.decision === "defer") {
      return item.admission.decisionReason?.trim() || "CTO admission was deferred for later work.";
    }
    return "The finalized requirement is waiting on a CTO admission decision.";
  }

  if (item.requirement) {
    return item.requirement.summary;
  }

  if (item.thread) {
    if (briefingState === "admission_pending") {
      return "Requirements are frozen and ready for technical admission.";
    }
    return item.thread.progressSummary;
  }

  return "Live work is active.";
}

function resolveNextAction(
  item: CorrelatedBriefItem,
  briefingState: BriefFeatureSnapshot["briefingState"],
  openDecisions: BriefOpenDecision[],
): string | null {
  if (item.plan) {
    if (isPlanCompleted(item.plan) && item.plan.mergeStatus !== "merged") {
      return "Queue the approved implementation for merge.";
    }
    if (item.plan.activeRunStatus === "verification_pending") {
      return "Clear verification and review so the implementation can land.";
    }
    if (item.plan.activeRunStatus === "merge_ready" || item.plan.mergeStatus === "ready_to_queue") {
      return "Land the approved implementation.";
    }
    if (isPlanInMotion(item.plan)) {
      return "Keep the implementation moving through the current execution step.";
    }
    if (isPlanReadyToStart(item.plan)) {
      return "Kick off implementation against the prepared feature branch.";
    }
  }

  if (item.admission) {
    if (item.admission.decision === "admit") {
      return "Start implementation against the admitted scope.";
    }
    if (item.admission.decision === "defer") {
      return item.admission.decisionReason?.trim() || "Decide when to bring the deferred scope back.";
    }
    return "Record the CTO admission decision.";
  }

  if (item.requirement) {
    return "Review the finalized requirement for technical admission.";
  }

  if (openDecisions.length > 0) {
    return `Resolve: ${openDecisions[0].question}`;
  }

  if (briefingState === "shaping" && item.thread?.currentLayer) {
    return `Continue ${item.thread.currentLayer} shaping.`;
  }

  return null;
}

function resolveMissingSourceFamilies(
  item: CorrelatedBriefItem,
  availability: BriefSourceAvailability[],
): BriefSourceFamily[] {
  const missing = new Set<BriefSourceFamily>();
  const isAvailable = (family: BriefSourceFamily) => availability.some((entry) => entry.family === family && entry.available);

  if (item.thread && (item.thread.hasFinalizedRequirement || item.thread.status === "handoff_ready") && !item.requirement) {
    missing.add("finalized_requirement");
  }

  if (
    item.requirement
    && !item.admission
    && (item.thread?.blockers.length ?? 0) === 0
    && item.requirement.blockers.length === 0
  ) {
    missing.add("cto_admission");
  }

  if (item.admission?.decision === "admit" && !item.plan) {
    missing.add("implement_plan");
  }

  if (!item.thread && (item.requirement || item.plan) && isAvailable("thread_onion")) {
    missing.add("thread_onion");
  }

  return Array.from(missing).filter((family) => isAvailable(family));
}

function isFinalized(item: CorrelatedBriefItem): boolean {
  if (!item.plan) return false;
  return item.plan.mergeStatus === "merged" || (item.plan.featureStatus === "completed" && item.plan.activeRunStatus === "completed");
}

function listPresentSourceFamilies(item: CorrelatedBriefItem): BriefSourceFamily[] {
  const families: BriefSourceFamily[] = [];
  if (item.thread) families.push("thread_onion");
  if (item.requirement) families.push("finalized_requirement");
  if (item.admission) families.push("cto_admission");
  if (item.plan) families.push("implement_plan");
  return families;
}

function collectGlobalOpenLoops(threads: ThreadSignal[]): string[] {
  return uniqueStrings(
    threads
      .filter((thread) => !thread.scopePath)
      .flatMap((thread) => thread.openLoops),
  );
}

function buildAvailability<T>(
  family: BriefSourceFamily,
  load: FamilyLoadResult<T>,
  collectedAt: string,
  now: Date,
): BriefSourceAvailability {
  const freshestItemTimestamp = maxIsoTimestamp(load.items.map((item) => extractItemTimestamp(item)).filter((value): value is string => Boolean(value)));
  const freshnessAnchor = freshestItemTimestamp ?? collectedAt;
  return {
    family,
    available: load.available,
    itemCount: load.items.length,
    collectedAt,
    freshnessAgeMs: Math.max(0, now.getTime() - new Date(freshnessAnchor).getTime()),
  };
}

function computeSourceFreshnessAgeMs(
  features: BriefFeatureSnapshot[],
  availability: BriefSourceAvailability[],
  collectedAt: string,
  now: Date,
): number {
  const latestFeatureTimestamp = maxIsoTimestamp(features.map((feature) => feature.lastActivityAt));
  const latestAvailabilityTimestamp = maxIsoTimestamp(availability.map((entry) => entry.itemCount > 0 ? entry.collectedAt : null));
  const freshnessAnchor = latestFeatureTimestamp ?? latestAvailabilityTimestamp ?? collectedAt;
  return Math.max(0, now.getTime() - new Date(freshnessAnchor).getTime());
}

function buildDegradationNotes(
  unavailableFamilies: BriefSourceFamily[],
  rawNotes: string[],
): string[] {
  const notes: string[] = [];

  if (unavailableFamilies.includes("cto_admission")) {
    notes.push("CTO admission truth is not available yet, so this brief is using the shaping and implementation sources that are live.");
  }
  if (unavailableFamilies.includes("finalized_requirement")) {
    notes.push("Finalized requirement truth is unavailable, so admission-readiness details may be understated.");
  }
  if (unavailableFamilies.includes("implement_plan")) {
    notes.push("Implement-plan truth is unavailable, so active implementation coverage may be understated.");
  }
  if (unavailableFamilies.includes("thread_onion")) {
    notes.push("Active COO thread truth is unavailable, so shaping coverage may be understated.");
  }
  if (rawNotes.length > 0) {
    notes.push("Some live status inputs could not be read cleanly, so the remaining source truth is being used.");
  }

  return uniqueStrings(notes);
}

function adaptThread(thread: Thread): ThreadSignal {
  const onion = thread.workflowState.onion;
  const latestCommit = getLatestStateCommit(thread);
  const approvedSnapshot = onion?.state.approved_snapshot;
  const openDecisionSource: Array<{ question: string; impact: string; status: "open" | "resolved" }> =
    approvedSnapshot?.open_decisions ?? onion?.state.open_decisions ?? [];
  const blockers = uniqueStrings(onion?.state.freeze_status.blockers ?? []);
  const label = firstMeaningfulText(
    approvedSnapshot?.topic,
    onion?.state.topic,
    thread.scopePath,
  ) ?? "Active COO work";

  return {
    id: normalizeFeatureId(thread.scopePath ?? thread.id),
    label: label.trim(),
    scopePath: thread.scopePath ?? null,
    status: normalizeThreadStatus(thread, blockers),
    currentLayer: onion?.current_layer ?? null,
    blockers,
    openLoops: latestCommit?.data.openLoops ?? [],
    openDecisions: openDecisionSource.map((decision) => ({
      question: asNonEmptyString(decision.question) ?? "Open decision",
      impact: asNonEmptyString(decision.impact) ?? "business scope",
      status: decision.status === "resolved" ? "resolved" : "open",
    })),
    progressSummary: describeThreadProgress(thread, latestCommit?.data.summary ?? null),
    lastActivityAt: thread.updatedAt,
    hasApprovedSnapshot: Boolean(approvedSnapshot),
    hasFinalizedRequirement: Boolean(onion?.finalized_requirement_memory_id),
    finalizedRequirementMemoryId: onion?.finalized_requirement_memory_id ?? null,
  };
}

function normalizeThreadStatus(
  thread: Thread,
  blockers: string[],
): BriefFeatureSnapshot["status"] {
  const lifecycleStatus = thread.workflowState.onion?.lifecycle_status;
  if (blockers.length > 0 || lifecycleStatus === "blocked") {
    return "blocked";
  }
  if (lifecycleStatus === "awaiting_freeze_approval") {
    return "awaiting_freeze_approval";
  }
  if (lifecycleStatus === "approved") {
    return "approved";
  }
  if (lifecycleStatus === "handoff_ready") {
    return "handoff_ready";
  }
  if (thread.status === "completed") {
    return "completed";
  }
  return "active";
}

function describeThreadProgress(thread: Thread, latestCommitSummary: string | null): string {
  const onion = thread.workflowState.onion;
  if (onion) {
    if (onion.state.freeze_status.blockers.length > 0) {
      return onion.state.freeze_status.blockers[0];
    }
    if (onion.lifecycle_status === "handoff_ready" || onion.lifecycle_status === "approved") {
      return "Requirements are frozen and ready for technical admission.";
    }
    if (onion.lifecycle_status === "awaiting_freeze_approval") {
      return "Scope is waiting for explicit freeze approval.";
    }
    if (onion.current_layer) {
      return `Shaping is active in ${onion.current_layer}.`;
    }
  }

  const trimmedSummary = latestCommitSummary?.trim();
  if (trimmedSummary) {
    return trimSentence(trimmedSummary);
  }

  return thread.status === "completed"
    ? "The COO thread has completed its latest work."
    : "The COO is actively shaping this work.";
}

function adaptRequirementRecord(
  record: Record<string, unknown>,
  target: ThreadSignal,
): RequirementSignal {
  const content = normalizeContent(record.content);
  const humanScope = asRecord(content.human_scope);
  const featureId = normalizeFeatureId(asNonEmptyString(content.feature_slug) ?? target.id);
  const openDecisionSource = asArray(content.open_business_decisions).length > 0
    ? asArray(content.open_business_decisions)
    : asArray(humanScope.open_decisions);

  return {
    id: featureId,
    label: humanizeFeatureId(featureId),
    summary: firstMeaningfulText(
      asNonEmptyString(content.requirement_summary),
      asNonEmptyString(content.text),
      asNonEmptyString(humanScope.goal),
      "Finalized requirement is ready for admission.",
    ) ?? "Finalized requirement is ready for admission.",
    blockers: normalizeStringArray(content.blockers),
    openDecisions: openDecisionSource.map((decision) => {
      const recordDecision = asRecord(decision);
      return {
        question: asNonEmptyString(recordDecision.question) ?? "Open decision",
        impact: asNonEmptyString(recordDecision.impact) ?? "business scope",
        status: asNonEmptyString(recordDecision.status) === "resolved" ? "resolved" : "open",
      };
    }),
    derivationStatus: asNonEmptyString(content.derivation_status) === "blocked" ? "blocked" : "ready",
    lastActivityAt: firstMeaningfulText(
      asNonEmptyString(record.updated_at),
      asNonEmptyString(record.created_at),
      asNonEmptyString(content.source_frozen_at),
      target.lastActivityAt,
    ) ?? target.lastActivityAt,
  };
}

function isPlanInMotion(plan: PlanSignal): boolean {
  return PLAN_IN_MOTION_STATUSES.has(plan.activeRunStatus);
}

function isPlanReadyToStart(plan: PlanSignal): boolean {
  return PLAN_READY_TO_START_STATUSES.has(plan.activeRunStatus);
}

function isPlanCompleted(plan: PlanSignal): boolean {
  return plan.mergeStatus === "merged"
    || plan.activeRunStatus === "completed"
    || (plan.featureStatus === "completed" && plan.activeRunStatus !== "implementation_in_progress");
}

function normalizeAdmissionDecision(
  value: string | null,
): AdmissionSignal["decision"] {
  if (value === "admit" || value === "defer" || value === "block") {
    return value;
  }
  return null;
}

function normalizeContent(input: unknown): Record<string, unknown> {
  if (typeof input === "string") {
    try {
      return JSON.parse(input) as Record<string, unknown>;
    } catch {
      return { text: input };
    }
  }
  return asRecord(input);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const deduped = new Set<string>();
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed.length > 0) {
      deduped.add(trimmed);
    }
  }
  return Array.from(deduped);
}

function dedupeOpenDecisions(decisions: BriefOpenDecision[]): BriefOpenDecision[] {
  const seen = new Set<string>();
  const deduped: BriefOpenDecision[] = [];
  for (const decision of decisions) {
    const key = `${decision.question}::${decision.impact}::${decision.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(decision);
  }
  return deduped;
}

function humanizeFeatureId(value: string): string {
  const words = value
    .split(/[\/_-]+/)
    .filter((part) => part.trim().length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  return words.join(" ");
}

function humanizeStatus(value: string): string {
  return value
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeFeatureId(value: string): string {
  return value.replace(/\\/g, "/").trim();
}

function normalizeStringArray(value: unknown): string[] {
  return asArray(value)
    .map((entry) => typeof entry === "string" ? entry.trim() : "")
    .filter((entry) => entry.length > 0);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function firstMeaningfulText(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}

function trimSentence(value: string): string {
  const firstSentenceMatch = value.match(/^[\s\S]*?[.!?](?:\s|$)/);
  const sentence = firstSentenceMatch ? firstSentenceMatch[0] : value;
  return sentence.trim();
}

function extractItemTimestamp(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  return firstMeaningfulText(
    asNonEmptyString(record.lastActivityAt),
    asNonEmptyString(record.updatedAt),
    asNonEmptyString(record.packetBuiltAt),
    asNonEmptyString(record.decidedAt),
  );
}

function maxIsoTimestamp(values: Array<string | null | undefined>): string | null {
  const timestamps = values
    .map((value) => {
      if (typeof value !== "string" || value.trim().length === 0) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : value;
    })
    .filter((value): value is string => Boolean(value));

  if (timestamps.length === 0) return null;

  return timestamps.sort((left, right) => right.localeCompare(left))[0];
}

async function resolveAncestorFile(startPath: string, relativeParts: string[]): Promise<string | null> {
  let current = resolve(startPath);

  while (true) {
    const candidate = join(current, ...relativeParts);
    if (await pathExists(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

async function parseJsonFile<T>(path: string): Promise<T> {
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as T;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
