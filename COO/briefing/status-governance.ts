import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createSystemProvenance, type Provenance } from "../../shared/provenance/types.js";
import { getLatestStateCommit, type FileSystemThreadStore } from "../controller/thread.js";
import type { GitStatusWindow } from "../controller/status-window.js";
import type { LiveBriefDiagnostics } from "./live-source-adapter.js";
import type {
  BriefCompletionEvidence,
  BriefFeatureSnapshot,
  BriefSourceFacts,
} from "./types.js";

export interface LiveStatusBrainClient {
  getRequirement(
    memoryId: string,
    scope: string,
    provenance: Provenance,
    options?: {
      include_legacy?: boolean;
      telemetry_context?: Record<string, unknown>;
    },
  ): Promise<Record<string, unknown>>;
  searchMemory(
    query: string,
    scope: string,
    provenance: Provenance,
    options?: {
      content_type?: string;
      content_types?: string[];
      trust_levels?: string[];
      max_results?: number;
      include_legacy?: boolean;
      telemetry_context?: Record<string, unknown>;
    },
  ): Promise<Array<Record<string, unknown>>>;
  captureMemory(
    content: string | Record<string, unknown>,
    contentType: string,
    tags: string[],
    scope: string,
    provenance: Provenance,
    telemetryContext?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  logDecision(
    title: string,
    reasoning: string,
    alternatives: unknown[],
    scope: string,
    provenance: Provenance,
    contentProvenance?: Provenance,
    telemetryContext?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  createRule(
    title: string,
    body: string,
    tags: string[],
    scope: string,
    provenance: Provenance,
    telemetryContext?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}

export class BrainHardStopError extends Error {
  readonly code = "BRAIN_HARD_STOP";

  constructor(
    message: string,
    readonly immediateFix: string,
  ) {
    super(message);
    this.name = "BrainHardStopError";
  }
}

export type GovernanceClassification =
  | "confirmed"
  | "acceptable_legacy_gap"
  | "suspicious"
  | "contradicted"
  | "missing_not_provable";

export interface GovernanceLandedAssessment {
  featureId: string;
  featureLabel: string;
  classification: GovernanceClassification;
  reviewAssessmentLine: string;
  tokenAssessmentLine: string;
  timingAssessmentLine: string | null;
  cooReadLine: string;
  recommendation: string | null;
  implicatedSubjects: string[];
}

export interface GovernanceItem {
  key: string;
  featureId: string | null;
  featureLabel: string;
  summary: string;
  recommendation: string;
  evidenceLine: string;
  classification: GovernanceClassification;
  implicatedSubjects: string[];
}

export interface CurrentThreadContext {
  threadId: string | null;
  activeWorkflow: string | null;
  onionLayer: string | null;
  scopePath: string | null;
  lastStateCommitAt: string | null;
}

export interface DeepAuditSummary {
  ran: boolean;
  trigger: "first_run" | "git_red_flag" | "suspicious_finding" | "stale_pressure" | "trust_transition";
  scope: "company" | "targeted";
  targetedFeatureIds: string[];
  findingCount: number;
  justified: boolean;
  sensitivityAssessment: "adequate" | "too_strict" | "too_loose";
  note: string;
  brainWriteCount: number;
}

export interface TrustMaterialNote {
  subjectId: string;
  summary: string;
  recommendation: string;
  evidenceLine: string;
  severity: "attention" | "table" | "next";
}

export interface GovernedStatusContext {
  companyScopePath: string;
  statusNotes: string[];
  landedAssessments: Map<string, GovernanceLandedAssessment>;
  additionalAttention: GovernanceItem[];
  additionalTable: GovernanceItem[];
  additionalNext: GovernanceItem[];
  deepAudit: DeepAuditSummary | null;
  trustNotes: TrustMaterialNote[];
  currentThread: CurrentThreadContext;
  operatingState: CooOperatingState;
}

interface StatusGovernanceOptions {
  projectRoot: string;
  facts: BriefSourceFacts;
  diagnostics: LiveBriefDiagnostics;
  statusWindow: GitStatusWindow | null;
  brainClient: LiveStatusBrainClient | null;
  statusScopePath: string | null;
  currentThreadId: string | null;
  threadStore: Pick<FileSystemThreadStore, "get">;
  now: Date;
  telemetryContext?: Record<string, unknown>;
}

interface GovernanceMilestones {
  reviewGateSince: string | null;
  kpiGateSince: string | null;
  notes: string[];
}

interface GovernanceThresholds {
  suspiciousFindingThreshold: number;
  ambiguityThreshold: number;
  stalePressureDays: number;
  companyEscalationThreshold: number;
  fullTrustScore: number;
  trustedScore: number;
  guardedScore: number;
}

type TrustSubjectKind = "worker" | "component" | "route";
type TrustSubjectStateName = "guarded" | "normal" | "trusted" | "proposal_pending" | "full_trust";

interface TrustSubjectState {
  id: string;
  kind: TrustSubjectKind;
  label: string;
  score: number;
  state: TrustSubjectStateName;
  lastEvidenceAt: string;
  lastAuditAt: string | null;
  lastChangedAt: string;
  reason: string;
  pendingProposalAt: string | null;
  pendingProposalReason: string | null;
}

interface TrackedIssueState {
  key: string;
  featureId: string | null;
  featureLabel: string;
  classification: GovernanceClassification;
  summary: string;
  recommendation: string;
  evidenceLine: string;
  implicatedSubjects: string[];
  brainFindingId: string | null;
  brainOpenLoopId: string | null;
  status: "open" | "monitoring";
  firstSeenAt: string;
  lastSeenAt: string;
}

interface TriggerTuningChange {
  changed: boolean;
  note: string | null;
}

interface CooOperatingState {
  schemaVersion: 1;
  baselineEstablishedAt: string;
  lastDeepAuditAt: string | null;
  lastDeepAuditTrigger: DeepAuditSummary["trigger"] | null;
  lastDeepAuditScope: DeepAuditSummary["scope"] | null;
  lastDeepAuditJustified: boolean | null;
  lastSensitivityAssessment: DeepAuditSummary["sensitivityAssessment"] | null;
  deepAuditCounter: number;
  unjustifiedAuditStreak: number;
  triggerConfig: GovernanceThresholds;
  trustSubjects: Record<string, TrustSubjectState>;
  trackedIssues: Record<string, TrackedIssueState>;
  rebasedRuleRecordedAt: string | null;
  lastTuningChangeAt: string | null;
  lastTuningChangeNote: string | null;
}

interface FeatureGovernanceEvidence {
  closeoutFinishedAt: string | null;
  implementorModel: string | null;
  implementorRuntime: string | null;
  implementorAccessMode: string | null;
}

interface DraftFinding {
  key: string;
  featureId: string | null;
  featureLabel: string;
  summary: string;
  recommendation: string;
  evidenceLine: string;
  classification: GovernanceClassification;
  implicatedSubjects: string[];
  severity: "attention" | "table";
}

interface PersistTrackedIssueResult {
  state: TrackedIssueState;
  persistedNewRecord: number;
}

interface TrustUpdateResult {
  brainWriteCount: number;
  materialNotes: TrustMaterialNote[];
}

const OPERATING_STATE_SCHEMA_VERSION = 1;
const DEFAULT_THRESHOLDS: GovernanceThresholds = {
  suspiciousFindingThreshold: 1,
  ambiguityThreshold: 2,
  stalePressureDays: 14,
  companyEscalationThreshold: 2,
  fullTrustScore: 85,
  trustedScore: 70,
  guardedScore: 40,
};
const REVIEW_GATE_SLUG = "implement-plan-verification-and-approval-flow";
const KPI_GATE_SLUG = "implement-plan-review-cycle-kpi-enforcement";

export async function prepareGovernedStatusContext(
  options: StatusGovernanceOptions,
): Promise<GovernedStatusContext> {
  const companyScopePath = resolveCompanyScopePath(options.statusScopePath);
  if (!options.brainClient) {
    throw new BrainHardStopError(
      "Brain durable memory is unavailable, so the COO cannot build a trustworthy company status.",
      "Repair the memory-engine MCP route and rerun `/status` once Brain reconnects.",
    );
  }
  if (!companyScopePath) {
    throw new BrainHardStopError(
      "The COO does not have a scope path for Brain-backed continuity.",
      "Start the COO with `--scope` or `--scope-path` before requesting `/status`.",
    );
  }

  const currentThread = await loadCurrentThreadContext(
    options.currentThreadId,
    options.threadStore,
    options.statusScopePath,
  );
  const milestones = await loadGovernanceMilestones(options.projectRoot);
  const operatingState = await loadOperatingState(options.projectRoot, options.now);

  await ensureRebasedRule(
    options.brainClient,
    companyScopePath,
    operatingState,
    options.telemetryContext,
  );

  const landedAssessments = new Map<string, GovernanceLandedAssessment>();
  const draftFindings: DraftFinding[] = [];

  for (const feature of options.facts.features.filter((candidate) => candidate.completion)) {
    const assessment = await assessLandedFeature(
      options.projectRoot,
      feature,
      milestones,
      options.now,
    );
    landedAssessments.set(feature.id, assessment);
    const finding = toDraftFinding(assessment);
    if (finding) {
      draftFindings.push(finding);
    }
  }

  for (const feature of options.facts.features) {
    const contradictionFinding = buildContradictionFinding(feature);
    if (contradictionFinding) {
      draftFindings.push(contradictionFinding);
    }
  }

  if (options.statusWindow?.redFlag) {
    draftFindings.push({
      key: `git-red-flag:${options.statusWindow.droppedFeatureSlugs.join(",")}`,
      featureId: null,
      featureLabel: "Status coverage",
      summary: `Recent git activity on ${humanizeFeatureSlugList(options.statusWindow.droppedFeatureSlugs)} is missing from the current COO surface.`,
      recommendation: "Check the missing slice context before relying on this COO update for prioritization.",
      evidenceLine: "Evidence: direct workspace reality; fresh; high confidence. This coverage warning comes from git commits since the previous COO status update.",
      classification: "contradicted",
      implicatedSubjects: ["route:coo-status"],
      severity: "attention",
    });
  }

  const deepAuditDecision = decideDeepAudit(
    operatingState,
    draftFindings,
    options.statusWindow,
    options.now,
  );

  let brainWriteCount = 0;
  if (deepAuditDecision) {
    brainWriteCount += await recordDeepAudit(
      options.brainClient,
      companyScopePath,
      deepAuditDecision,
      draftFindings,
      options.telemetryContext,
    );
  }

  const trustContext = await updateTrustState(
    options.brainClient,
    companyScopePath,
    operatingState,
    landedAssessments,
    draftFindings,
    options.now,
    Boolean(deepAuditDecision),
    options.telemetryContext,
  );
  brainWriteCount += trustContext.brainWriteCount;

  const persistedIssues: GovernanceItem[] = [];
  for (const finding of draftFindings) {
    const tracked = await persistTrackedIssue(
      options.brainClient,
      companyScopePath,
      operatingState,
      finding,
      options.now,
      options.telemetryContext,
    );
    brainWriteCount += tracked.persistedNewRecord;
    persistedIssues.push(toGovernanceItem(tracked.state));
  }

  let tuningNote: string | null = null;
  if (deepAuditDecision) {
    operatingState.lastDeepAuditAt = options.now.toISOString();
    operatingState.lastDeepAuditTrigger = deepAuditDecision.trigger;
    operatingState.lastDeepAuditScope = deepAuditDecision.scope;
    operatingState.lastDeepAuditJustified = deepAuditDecision.justified;
    operatingState.lastSensitivityAssessment = deepAuditDecision.sensitivityAssessment;
    operatingState.deepAuditCounter += 1;
    operatingState.unjustifiedAuditStreak = deepAuditDecision.justified
      ? 0
      : operatingState.unjustifiedAuditStreak + 1;
    const tuning = maybeRetuneTriggerSensitivity(operatingState, options.now);
    tuningNote = tuning.note;
    if (tuning.changed && tuning.note) {
      brainWriteCount += await recordTriggerTuningChange(
        options.brainClient,
        companyScopePath,
        tuning.note,
        options.telemetryContext,
      );
    }
  }

  await saveOperatingState(options.projectRoot, operatingState);

  const deepAuditSummary = deepAuditDecision
    ? {
        ...deepAuditDecision,
        findingCount: draftFindings.length,
        brainWriteCount,
        note: deepAuditDecision.scope === "company"
          ? "A company-wide deep audit ran before this COO update was issued."
          : `A targeted deep audit ran for ${humanizeFeatureSlugList(deepAuditDecision.targetedFeatureIds)} before this COO update was issued.`,
      }
    : null;

  const materialAttentionTrustItems = trustContext.materialNotes
    .filter((item) => item.severity === "attention")
    .map(toTrustGovernanceItem);
  const materialTableTrustItems = trustContext.materialNotes
    .filter((item) => item.severity === "table")
    .map(toTrustGovernanceItem);
  const materialNextTrustItems = trustContext.materialNotes
    .filter((item) => item.severity === "next")
    .map(toTrustGovernanceItem);

  return {
    companyScopePath,
    statusNotes: buildStatusNotes(
      options.facts,
      options.diagnostics,
      deepAuditSummary,
      milestones,
      trustContext.materialNotes,
      tuningNote,
    ),
    landedAssessments,
    additionalAttention: [
      ...materialAttentionTrustItems,
      ...persistedIssues.filter((item) => item.classification === "suspicious" || item.classification === "contradicted"),
    ],
    additionalTable: [
      ...materialTableTrustItems,
      ...persistedIssues.filter((item) => item.classification === "acceptable_legacy_gap" || item.classification === "missing_not_provable"),
    ],
    additionalNext: materialNextTrustItems,
    deepAudit: deepAuditSummary,
    trustNotes: trustContext.materialNotes,
    currentThread,
    operatingState,
  };
}

function resolveCompanyScopePath(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

async function loadCurrentThreadContext(
  currentThreadId: string | null,
  threadStore: Pick<FileSystemThreadStore, "get">,
  fallbackScopePath: string | null,
): Promise<CurrentThreadContext> {
  if (!currentThreadId) {
    return {
      threadId: null,
      activeWorkflow: null,
      onionLayer: null,
      scopePath: fallbackScopePath,
      lastStateCommitAt: null,
    };
  }

  try {
    const thread = await threadStore.get(currentThreadId);
    return {
      threadId: thread.id,
      activeWorkflow: thread.workflowState.active_workflow,
      onionLayer: thread.workflowState.onion?.current_layer ?? null,
      scopePath: thread.scopePath ?? fallbackScopePath,
      lastStateCommitAt: getLatestStateCommit(thread)?.timestamp ?? null,
    };
  } catch {
    return {
      threadId: currentThreadId,
      activeWorkflow: null,
      onionLayer: null,
      scopePath: fallbackScopePath,
      lastStateCommitAt: null,
    };
  }
}

async function loadGovernanceMilestones(projectRoot: string): Promise<GovernanceMilestones> {
  const reviewGateSince = await loadFeatureCloseoutTimestamp(projectRoot, REVIEW_GATE_SLUG);
  const kpiGateSince = await loadFeatureCloseoutTimestamp(projectRoot, KPI_GATE_SLUG);
  const notes: string[] = [];

  if (reviewGateSince) {
    notes.push(`Review-cycle enforcement is treated as governed from ${reviewGateSince}.`);
  }
  if (kpiGateSince) {
    notes.push(`KPI enforcement is treated as governed from ${kpiGateSince}.`);
  }

  return {
    reviewGateSince,
    kpiGateSince,
    notes,
  };
}

async function loadFeatureCloseoutTimestamp(projectRoot: string, featureSlug: string): Promise<string | null> {
  const statePath = resolve(projectRoot, "docs", "phase1", featureSlug, "implement-plan-state.json");
  if (!await pathExists(statePath)) {
    return null;
  }

  try {
    const record = asRecord(await parseJsonFile<Record<string, unknown>>(statePath));
    const timestamps = asRecord(record.run_timestamps);
    return asNonEmptyString(timestamps.closeout_finished_at)
      ?? asNonEmptyString(record.updated_at)
      ?? null;
  } catch {
    return null;
  }
}

async function loadOperatingState(projectRoot: string, now: Date): Promise<CooOperatingState> {
  const statePath = resolveOperatingStatePath(projectRoot);
  if (!await pathExists(statePath)) {
    return createDefaultOperatingState(now);
  }

  try {
    const parsed = asRecord(await parseJsonFile<Record<string, unknown>>(statePath));
    const thresholds = asRecord(parsed.triggerConfig);
    return {
      schemaVersion: OPERATING_STATE_SCHEMA_VERSION,
      baselineEstablishedAt: asNonEmptyString(parsed.baselineEstablishedAt) ?? now.toISOString(),
      lastDeepAuditAt: asNonEmptyString(parsed.lastDeepAuditAt),
      lastDeepAuditTrigger: normalizeAuditTrigger(asNonEmptyString(parsed.lastDeepAuditTrigger)),
      lastDeepAuditScope: normalizeAuditScope(asNonEmptyString(parsed.lastDeepAuditScope)),
      lastDeepAuditJustified: typeof parsed.lastDeepAuditJustified === "boolean" ? parsed.lastDeepAuditJustified : null,
      lastSensitivityAssessment: normalizeSensitivity(asNonEmptyString(parsed.lastSensitivityAssessment)),
      deepAuditCounter: asNumber(parsed.deepAuditCounter) ?? 0,
      unjustifiedAuditStreak: asNumber(parsed.unjustifiedAuditStreak) ?? 0,
      triggerConfig: {
        suspiciousFindingThreshold: asNumber(thresholds.suspiciousFindingThreshold) ?? DEFAULT_THRESHOLDS.suspiciousFindingThreshold,
        ambiguityThreshold: asNumber(thresholds.ambiguityThreshold) ?? DEFAULT_THRESHOLDS.ambiguityThreshold,
        stalePressureDays: asNumber(thresholds.stalePressureDays) ?? DEFAULT_THRESHOLDS.stalePressureDays,
        companyEscalationThreshold: asNumber(thresholds.companyEscalationThreshold) ?? DEFAULT_THRESHOLDS.companyEscalationThreshold,
        fullTrustScore: asNumber(thresholds.fullTrustScore) ?? DEFAULT_THRESHOLDS.fullTrustScore,
        trustedScore: asNumber(thresholds.trustedScore) ?? DEFAULT_THRESHOLDS.trustedScore,
        guardedScore: asNumber(thresholds.guardedScore) ?? DEFAULT_THRESHOLDS.guardedScore,
      },
      trustSubjects: asTrustSubjects(asRecord(parsed.trustSubjects), now),
      trackedIssues: asTrackedIssues(asRecord(parsed.trackedIssues), now),
      rebasedRuleRecordedAt: asNonEmptyString(parsed.rebasedRuleRecordedAt),
      lastTuningChangeAt: asNonEmptyString(parsed.lastTuningChangeAt),
      lastTuningChangeNote: asNonEmptyString(parsed.lastTuningChangeNote),
    };
  } catch {
    return createDefaultOperatingState(now);
  }
}

function createDefaultOperatingState(now: Date): CooOperatingState {
  return {
    schemaVersion: OPERATING_STATE_SCHEMA_VERSION,
    baselineEstablishedAt: now.toISOString(),
    lastDeepAuditAt: null,
    lastDeepAuditTrigger: null,
    lastDeepAuditScope: null,
    lastDeepAuditJustified: null,
    lastSensitivityAssessment: null,
    deepAuditCounter: 0,
    unjustifiedAuditStreak: 0,
    triggerConfig: { ...DEFAULT_THRESHOLDS },
    trustSubjects: {},
    trackedIssues: {},
    rebasedRuleRecordedAt: null,
    lastTuningChangeAt: null,
    lastTuningChangeNote: null,
  };
}

function asTrustSubjects(
  value: Record<string, unknown>,
  now: Date,
): Record<string, TrustSubjectState> {
  const entries: Record<string, TrustSubjectState> = {};
  for (const [key, raw] of Object.entries(value)) {
    const record = asRecord(raw);
    const score = clampScore(asNumber(record.score) ?? 50);
    entries[key] = {
      id: key,
      kind: normalizeTrustKind(asNonEmptyString(record.kind)),
      label: asNonEmptyString(record.label) ?? humanizeTrustSubject(key),
      score,
      state: normalizeTrustState(asNonEmptyString(record.state), score),
      lastEvidenceAt: asNonEmptyString(record.lastEvidenceAt) ?? now.toISOString(),
      lastAuditAt: asNonEmptyString(record.lastAuditAt),
      lastChangedAt: asNonEmptyString(record.lastChangedAt) ?? now.toISOString(),
      reason: asNonEmptyString(record.reason) ?? "Trust state loaded from local derived continuity.",
      pendingProposalAt: asNonEmptyString(record.pendingProposalAt),
      pendingProposalReason: asNonEmptyString(record.pendingProposalReason),
    };
  }
  return entries;
}

function asTrackedIssues(
  value: Record<string, unknown>,
  now: Date,
): Record<string, TrackedIssueState> {
  const entries: Record<string, TrackedIssueState> = {};
  for (const [key, raw] of Object.entries(value)) {
    const record = asRecord(raw);
    entries[key] = {
      key,
      featureId: asNonEmptyString(record.featureId),
      featureLabel: asNonEmptyString(record.featureLabel) ?? "Company issue",
      classification: normalizeClassification(asNonEmptyString(record.classification)),
      summary: asNonEmptyString(record.summary) ?? "Tracked COO issue.",
      recommendation: asNonEmptyString(record.recommendation) ?? "Review the tracked issue.",
      evidenceLine: asNonEmptyString(record.evidenceLine) ?? "Evidence: derived from sources; freshness unknown; medium confidence.",
      implicatedSubjects: normalizeStringArray(record.implicatedSubjects),
      brainFindingId: asNonEmptyString(record.brainFindingId),
      brainOpenLoopId: asNonEmptyString(record.brainOpenLoopId),
      status: asNonEmptyString(record.status) === "monitoring" ? "monitoring" : "open",
      firstSeenAt: asNonEmptyString(record.firstSeenAt) ?? now.toISOString(),
      lastSeenAt: asNonEmptyString(record.lastSeenAt) ?? now.toISOString(),
    };
  }
  return entries;
}

async function ensureRebasedRule(
  brainClient: LiveStatusBrainClient,
  scope: string,
  operatingState: CooOperatingState,
  telemetryContext?: Record<string, unknown>,
): Promise<void> {
  if (operatingState.rebasedRuleRecordedAt) {
    return;
  }

  try {
    const existing = await brainClient.searchMemory(
      "Phase 1 COO evidence-first operating rule",
      scope,
      createSystemProvenance("COO/briefing/status-governance/search-rule"),
      {
        content_type: "rule",
        max_results: 5,
        telemetry_context: telemetryContext,
      },
    );

    if (existing.some((record) => containsText(record, "Phase 1 COO evidence-first operating rule"))) {
      operatingState.rebasedRuleRecordedAt = new Date().toISOString();
      return;
    }

    await brainClient.createRule(
      "Phase 1 COO evidence-first operating rule",
      [
        "The COO must gather evidence from workspace reality, canonical lifecycle artifacts, Brain, and supporting docs before briefing the CEO.",
        "The COO must cross-check suspicious surfaced facts instead of merely repeating them.",
        "The COO must investigate anomalies before surfacing them upward.",
        "The COO must maintain derived trust and tracked issue continuity while staying bounded in authority.",
        "If Brain is unavailable, the COO must hard stop and refuse to issue status, trust, or audit judgments.",
      ].join("\n"),
      ["coo", "phase1", "rebased-status", "evidence-first"],
      scope,
      createSystemProvenance("COO/briefing/status-governance/create-rule"),
      telemetryContext,
    );
    operatingState.rebasedRuleRecordedAt = new Date().toISOString();
  } catch (error) {
    throw new BrainHardStopError(
      `Brain durable memory is connected but the COO could not record its rebased operating rule: ${formatError(error)}`,
      "Repair the Brain write path before trusting COO status, trust, or audit output.",
    );
  }
}

async function assessLandedFeature(
  projectRoot: string,
  feature: BriefFeatureSnapshot,
  milestones: GovernanceMilestones,
  _now: Date,
): Promise<GovernanceLandedAssessment> {
  const completion = feature.completion!;
  const governanceEvidence = await loadFeatureGovernanceEvidence(projectRoot, feature.id);
  const featureCompletedAt = completion.mergedAt ?? governanceEvidence.closeoutFinishedAt ?? feature.lastActivityAt;
  const reviewGateApplies = isoTimestampOnOrAfter(featureCompletedAt, milestones.reviewGateSince);
  const kpiGateApplies = isoTimestampOnOrAfter(featureCompletedAt, milestones.kpiGateSince);

  const reviewEvaluation = classifyReviewEvidence(
    completion,
    reviewGateApplies,
    governanceEvidence,
  );
  const tokenEvaluation = classifyTokenEvidence(
    completion,
    kpiGateApplies,
    governanceEvidence,
  );
  const timingEvaluation = classifyTimingEvidence(completion);

  return {
    featureId: feature.id,
    featureLabel: feature.label,
    classification: pickWorstClassification([
      reviewEvaluation.classification,
      tokenEvaluation.classification,
      timingEvaluation.classification,
    ]),
    reviewAssessmentLine: reviewEvaluation.line,
    tokenAssessmentLine: tokenEvaluation.line,
    timingAssessmentLine: timingEvaluation.line,
    cooReadLine: buildCooReadLine(
      pickWorstClassification([
        reviewEvaluation.classification,
        tokenEvaluation.classification,
        timingEvaluation.classification,
      ]),
      feature.label,
    ),
    recommendation: firstMeaningfulText(
      reviewEvaluation.recommendation,
      tokenEvaluation.recommendation,
      timingEvaluation.recommendation,
    ),
    implicatedSubjects: uniqueStrings([
      ...reviewEvaluation.implicatedSubjects,
      ...tokenEvaluation.implicatedSubjects,
      ...timingEvaluation.implicatedSubjects,
    ]),
  };
}

function classifyReviewEvidence(
  completion: BriefCompletionEvidence,
  reviewGateApplies: boolean,
  governanceEvidence: FeatureGovernanceEvidence,
): {
  classification: GovernanceClassification;
  line: string;
  recommendation: string | null;
  implicatedSubjects: string[];
} {
  const reviewValue = completion.reviewCycles.value;
  const note = completion.reviewCycles.note;
  const subjects = ["route:review-cycle"];
  const workerSubject = buildWorkerSubject(governanceEvidence);
  if (workerSubject) {
    subjects.push(workerSubject);
  }

  if (reviewValue !== null && reviewValue > 0) {
    return {
      classification: "confirmed",
      line: reviewValue === 1
        ? "Review check: 1 completed review cycle is recorded, so review governance is evidenced for this landing."
        : `Review check: ${reviewValue} completed review cycles are recorded, so review governance is evidenced for this landing.`,
      recommendation: null,
      implicatedSubjects: subjects,
    };
  }

  if (reviewValue === 0) {
    if (!reviewGateApplies || /not invoked/i.test(note)) {
      return {
        classification: "acceptable_legacy_gap",
        line: "Review check: 0 review cycles are recorded, and the slice evidence says review-cycle was not required for this landing. That looks acceptable for the route timing rather than a current failure.",
        recommendation: null,
        implicatedSubjects: subjects,
      };
    }

    return {
      classification: "suspicious",
      line: "Review check: 0 review cycles are recorded even though review governance should have applied by the time this feature landed.",
      recommendation: "Investigate the review-cycle route for this slice before trusting the closeout quality.",
      implicatedSubjects: subjects,
    };
  }

  if (reviewGateApplies) {
    return {
      classification: "missing_not_provable",
      line: `Review check: the slice does not prove review governance for this landing. ${note}`,
      recommendation: "Check why review-cycle truth is missing for this landed item.",
      implicatedSubjects: subjects,
    };
  }

  return {
    classification: "acceptable_legacy_gap",
    line: "Review check: review-cycle proof is missing, but this feature appears to predate the enforced review-governance route.",
    recommendation: null,
    implicatedSubjects: subjects,
  };
}

function classifyTokenEvidence(
  completion: BriefCompletionEvidence,
  kpiGateApplies: boolean,
  governanceEvidence: FeatureGovernanceEvidence,
): {
  classification: GovernanceClassification;
  line: string;
  recommendation: string | null;
  implicatedSubjects: string[];
} {
  const subjects = ["component:kpi-telemetry", "route:implement-plan"];
  const workerSubject = buildWorkerSubject(governanceEvidence);
  if (workerSubject) {
    subjects.push(workerSubject);
  }

  if (completion.tokenCostTokens.value !== null) {
    return {
      classification: "confirmed",
      line: `KPI check: token cost is recorded at ${completion.tokenCostTokens.value.toLocaleString("en-US")} tokens.`,
      recommendation: null,
      implicatedSubjects: subjects,
    };
  }

  if (kpiGateApplies) {
    return {
      classification: "suspicious",
      line: "KPI check: token cost is unavailable even though KPI enforcement should have applied by the time this feature landed.",
      recommendation: "Check the KPI/telemetry route for this feature closeout before trusting cost coverage.",
      implicatedSubjects: subjects,
    };
  }

  return {
    classification: "acceptable_legacy_gap",
    line: "KPI check: token cost is unavailable, but this landing appears to predate the enforced KPI route.",
    recommendation: null,
    implicatedSubjects: subjects,
  };
}

function classifyTimingEvidence(
  completion: BriefCompletionEvidence,
): {
  classification: GovernanceClassification;
  line: string | null;
  recommendation: string | null;
  implicatedSubjects: string[];
} {
  if (completion.timing.durationMs === null) {
    return {
      classification: "missing_not_provable",
      line: `Timing check: ${completion.timing.note}`,
      recommendation: "Do not treat this landing as duration-proven until closeout timing improves.",
      implicatedSubjects: ["route:implement-plan"],
    };
  }

  if (completion.timing.kind === "elapsed_lifecycle" || completion.timing.qualification === "ambiguous") {
    return {
      classification: "missing_not_provable",
      line: `Timing check: the route only proves about ${formatDuration(completion.timing.durationMs)} of elapsed lifecycle time. Active implementation time remains unknown.`,
      recommendation: null,
      implicatedSubjects: ["route:implement-plan"],
    };
  }

  return {
    classification: "confirmed",
    line: `Timing check: the route has specific timing evidence for about ${formatDuration(completion.timing.durationMs)} of active work.`,
    recommendation: null,
    implicatedSubjects: ["route:implement-plan"],
  };
}

function buildCooReadLine(
  classification: GovernanceClassification,
  featureLabel: string,
): string {
  switch (classification) {
    case "confirmed":
      return `COO read: ${featureLabel} lands with enough route evidence to trust the closeout at face value.`;
    case "acceptable_legacy_gap":
      return "COO read: the missing governance detail looks like acceptable route timing or legacy shape, not a live process failure.";
    case "missing_not_provable":
      return "COO read: the landing is only partly provable from current evidence, so treat it as informational rather than fully audited.";
    case "suspicious":
      return "COO read: this looks like a route-quality problem, not just a reporting gap.";
    case "contradicted":
      return "COO read: the route evidence contradicts itself, so this landing should not be trusted without follow-up.";
    default:
      return `COO read: status evidence for ${featureLabel} is incomplete.`;
  }
}

function pickWorstClassification(
  classifications: GovernanceClassification[],
): GovernanceClassification {
  const priority = (classification: GovernanceClassification): number => {
    switch (classification) {
      case "contradicted":
        return 5;
      case "suspicious":
        return 4;
      case "missing_not_provable":
        return 3;
      case "acceptable_legacy_gap":
        return 2;
      case "confirmed":
      default:
        return 1;
    }
  };

  return classifications.reduce<GovernanceClassification>(
    (worst, current) => priority(current) > priority(worst) ? current : worst,
    "confirmed",
  );
}

function toDraftFinding(assessment: GovernanceLandedAssessment): DraftFinding | null {
  if (assessment.classification === "confirmed") {
    return null;
  }

  return {
    key: `landed:${assessment.featureId}:${assessment.classification}`,
    featureId: assessment.featureId,
    featureLabel: assessment.featureLabel,
    summary: assessment.cooReadLine.replace(/^COO read:\s*/i, ""),
    recommendation: assessment.recommendation ?? "Review the landed-route evidence before relying on this closeout.",
    evidenceLine: `Evidence: derived from sources; fresh; ${
      assessment.classification === "suspicious" || assessment.classification === "contradicted" ? "high" : "medium"
    } confidence. ${assessment.reviewAssessmentLine}${assessment.tokenAssessmentLine ? ` ${assessment.tokenAssessmentLine}` : ""}${assessment.timingAssessmentLine ? ` ${assessment.timingAssessmentLine}` : ""}`,
    classification: assessment.classification,
    implicatedSubjects: assessment.implicatedSubjects,
    severity: assessment.classification === "suspicious" || assessment.classification === "contradicted"
      ? "attention"
      : "table",
  };
}

function buildContradictionFinding(feature: BriefFeatureSnapshot): DraftFinding | null {
  if (feature.status === "blocked" && feature.blockers.length === 0) {
    return {
      key: `contradiction:${feature.id}:blocked-without-blocker`,
      featureId: feature.id,
      featureLabel: feature.label,
      summary: "The feature is classified as blocked, but no concrete blocker is present in source truth.",
      recommendation: "Inspect the route that marked this feature blocked before treating it as a real blocker.",
      evidenceLine: "Evidence: derived from sources; fresh; medium confidence. The surfaced status and blocker payload disagree.",
      classification: "contradicted",
      implicatedSubjects: ["route:coo-status"],
      severity: "attention",
    };
  }

  if (feature.evidence?.qualification === "ambiguous") {
    return {
      key: `ambiguity:${feature.id}`,
      featureId: feature.id,
      featureLabel: feature.label,
      summary: "The current COO view had to resolve conflicting source evidence for this item.",
      recommendation: "Treat this item carefully until the underlying source disagreement is resolved.",
      evidenceLine: `Evidence: ambiguous; ${feature.evidence.freshness}; ${feature.evidence.confidence} confidence. ${feature.evidence.notes.join(" ")}`,
      classification: "missing_not_provable",
      implicatedSubjects: ["route:coo-status"],
      severity: "table",
    };
  }

  if ((feature.missingSourceFamilies?.length ?? 0) > 0 && feature.nextAction) {
    return {
      key: `missing-source:${feature.id}`,
      featureId: feature.id,
      featureLabel: feature.label,
      summary: `This item is being carried with fallback evidence because ${humanizeFeatureSlugList(feature.missingSourceFamilies ?? [])} is missing.`,
      recommendation: "Treat the current conclusion as provisional until the missing source family becomes readable.",
      evidenceLine: `Evidence: fallback because a source is missing; ${feature.evidence?.freshness ?? "unknown freshness"}; ${feature.evidence?.confidence ?? "medium"} confidence.`,
      classification: "missing_not_provable",
      implicatedSubjects: ["route:coo-status"],
      severity: "table",
    };
  }

  return null;
}

function decideDeepAudit(
  operatingState: CooOperatingState,
  draftFindings: DraftFinding[],
  statusWindow: GitStatusWindow | null,
  now: Date,
): Omit<DeepAuditSummary, "findingCount" | "brainWriteCount" | "note" | "ran"> | null {
  if (!operatingState.lastDeepAuditAt) {
    return {
      trigger: "first_run",
      scope: "company",
      targetedFeatureIds: uniqueStrings(draftFindings.map((finding) => finding.featureId).filter(Boolean)),
      justified: true,
      sensitivityAssessment: "adequate",
    };
  }

  const suspiciousOrWorse = draftFindings.filter((finding) =>
    finding.classification === "suspicious" || finding.classification === "contradicted");
  const distinctFeatureIds = uniqueStrings(suspiciousOrWorse.map((finding) => finding.featureId).filter(Boolean));

  if (statusWindow?.redFlag) {
    return {
      trigger: "git_red_flag",
      scope: statusWindow.droppedFeatureSlugs.length >= operatingState.triggerConfig.companyEscalationThreshold
        ? "company"
        : "targeted",
      targetedFeatureIds: statusWindow.droppedFeatureSlugs,
      justified: true,
      sensitivityAssessment: "adequate",
    };
  }

  if (suspiciousOrWorse.length >= operatingState.triggerConfig.suspiciousFindingThreshold) {
    return {
      trigger: "suspicious_finding",
      scope: distinctFeatureIds.length >= operatingState.triggerConfig.companyEscalationThreshold
        ? "company"
        : "targeted",
      targetedFeatureIds: distinctFeatureIds,
      justified: true,
      sensitivityAssessment: distinctFeatureIds.length === 0 ? "too_loose" : "adequate",
    };
  }

  const daysSinceLastAudit = daysBetween(operatingState.lastDeepAuditAt, now.toISOString());
  if (daysSinceLastAudit >= operatingState.triggerConfig.stalePressureDays) {
    return {
      trigger: "stale_pressure",
      scope: "targeted",
      targetedFeatureIds: uniqueStrings(draftFindings.map((finding) => finding.featureId).filter(Boolean)).slice(0, 3),
      justified: draftFindings.length > 0,
      sensitivityAssessment: draftFindings.length === 0 ? "too_strict" : "adequate",
    };
  }

  return null;
}

async function recordDeepAudit(
  brainClient: LiveStatusBrainClient,
  scope: string,
  deepAudit: Omit<DeepAuditSummary, "findingCount" | "brainWriteCount" | "note" | "ran">,
  findings: DraftFinding[],
  telemetryContext?: Record<string, unknown>,
): Promise<number> {
  try {
    await brainClient.captureMemory(
      {
        title: "COO deep audit",
        trigger: deepAudit.trigger,
        scope: deepAudit.scope,
        targeted_feature_ids: deepAudit.targetedFeatureIds,
        justified: deepAudit.justified,
        sensitivity_assessment: deepAudit.sensitivityAssessment,
        findings: findings.map((finding) => ({
          key: finding.key,
          feature_id: finding.featureId,
          classification: finding.classification,
          summary: finding.summary,
          implicated_subjects: finding.implicatedSubjects,
        })),
      },
      "finding",
      ["coo", "phase1", "deep-audit", deepAudit.trigger, deepAudit.scope],
      scope,
      createSystemProvenance("COO/briefing/status-governance/deep-audit"),
      telemetryContext,
    );
    return 1;
  } catch (error) {
    throw new BrainHardStopError(
      `The COO could not write deep-audit findings to Brain: ${formatError(error)}`,
      "Repair the Brain write path before relying on COO audit conclusions.",
    );
  }
}

async function updateTrustState(
  brainClient: LiveStatusBrainClient,
  scope: string,
  operatingState: CooOperatingState,
  landedAssessments: Map<string, GovernanceLandedAssessment>,
  draftFindings: DraftFinding[],
  now: Date,
  deepAuditRan: boolean,
  telemetryContext?: Record<string, unknown>,
): Promise<TrustUpdateResult> {
  let brainWriteCount = 0;
  const materialNotes: TrustMaterialNote[] = [];
  const touched = new Set<string>();

  for (const assessment of landedAssessments.values()) {
    const subjectIds = assessment.implicatedSubjects.length > 0
      ? assessment.implicatedSubjects
      : ["route:implement-plan"];

    for (const subjectId of subjectIds) {
      touched.add(subjectId);
      const subject = ensureTrustSubject(operatingState, subjectId, now);
      const previousState = subject.state;
      const previousScore = subject.score;

      subject.score = clampScore(subject.score + trustDeltaForClassification(assessment.classification));
      subject.lastEvidenceAt = now.toISOString();
      if (deepAuditRan) {
        subject.lastAuditAt = now.toISOString();
      }
      subject.reason = assessment.cooReadLine;
      subject.state = computeTrustState(subject.score, operatingState.triggerConfig);
      if (subject.state !== previousState || subject.score !== previousScore) {
        subject.lastChangedAt = now.toISOString();
      }
    }
  }

  for (const finding of draftFindings) {
    const subjectIds = finding.implicatedSubjects.length > 0
      ? finding.implicatedSubjects
      : ["route:coo-status"];

    for (const subjectId of subjectIds) {
      touched.add(subjectId);
      const subject = ensureTrustSubject(operatingState, subjectId, now);
      const previousState = subject.state;
      const previousScore = subject.score;

      subject.score = clampScore(subject.score + trustDeltaForClassification(finding.classification));
      subject.lastEvidenceAt = now.toISOString();
      if (deepAuditRan) {
        subject.lastAuditAt = now.toISOString();
      }
      subject.reason = finding.summary;
      subject.state = computeTrustState(subject.score, operatingState.triggerConfig);
      if (subject.state !== previousState || subject.score !== previousScore) {
        subject.lastChangedAt = now.toISOString();
      }

      if (subject.state === "guarded" && previousState !== "guarded") {
        materialNotes.push({
          subjectId,
          summary: `${subject.label} dropped to guarded trust after credible drift or route failure evidence.`,
          recommendation: "Increase cross-checking and treat new claims from this subject with extra suspicion until a fresh deep audit clears it.",
          evidenceLine: "Evidence: derived from sources; fresh; high confidence. Trust was downgraded because current evidence disagreed with expected route truth.",
          severity: "attention",
        });
        brainWriteCount += await recordTrustChange(
          brainClient,
          scope,
          subject,
          "downgrade",
          telemetryContext,
        );
      }
    }
  }

  for (const subjectId of Object.keys(operatingState.trustSubjects)) {
    if (touched.has(subjectId)) {
      continue;
    }
    const subject = operatingState.trustSubjects[subjectId];
    if (daysBetween(subject.lastEvidenceAt, now.toISOString()) >= operatingState.triggerConfig.stalePressureDays) {
      subject.score = clampScore(subject.score - 5);
      const nextState = computeTrustState(subject.score, operatingState.triggerConfig);
      if (nextState !== subject.state) {
        subject.state = nextState;
        subject.lastChangedAt = now.toISOString();
      }
      subject.reason = "Trust softened under staleness pressure because the subject has not been revalidated recently.";
    }
  }

  if (deepAuditRan) {
    for (const subject of Object.values(operatingState.trustSubjects)) {
      if (subject.score >= operatingState.triggerConfig.fullTrustScore
        && subject.state !== "full_trust"
        && subject.state !== "proposal_pending"
      ) {
        subject.state = "proposal_pending";
        subject.pendingProposalAt = now.toISOString();
        subject.pendingProposalReason = "A fresh deep audit found repeated evidence agreement for this subject.";
        subject.lastChangedAt = now.toISOString();
        materialNotes.push({
          subjectId: subject.id,
          summary: `Full trust can now be proposed for ${subject.label}.`,
          recommendation: `Review the evidence for ${subject.label} and decide whether you object to a full-trust upgrade.`,
          evidenceLine: "Evidence: derived from sources; fresh; high confidence. A fresh deep audit found repeated agreement between reported truth and direct evidence for this subject.",
          severity: "next",
        });
        brainWriteCount += await recordTrustChange(
          brainClient,
          scope,
          subject,
          "proposal",
          telemetryContext,
        );
      }
    }
  }

  return {
    brainWriteCount,
    materialNotes,
  };
}

async function recordTrustChange(
  brainClient: LiveStatusBrainClient,
  scope: string,
  subject: TrustSubjectState,
  changeKind: "downgrade" | "proposal",
  telemetryContext?: Record<string, unknown>,
): Promise<number> {
  try {
    await brainClient.captureMemory(
      {
        subject_id: subject.id,
        subject_label: subject.label,
        subject_kind: subject.kind,
        trust_score: subject.score,
        trust_state: subject.state,
        reason: subject.reason,
        pending_proposal_at: subject.pendingProposalAt,
        pending_proposal_reason: subject.pendingProposalReason,
      },
      "finding",
      ["coo", "phase1", "trust", changeKind],
      scope,
      createSystemProvenance(`COO/briefing/status-governance/trust-${changeKind}`),
      telemetryContext,
    );
    return 1;
  } catch (error) {
    throw new BrainHardStopError(
      `The COO could not write trust-change evidence to Brain: ${formatError(error)}`,
      "Repair the Brain write path before trusting COO trust judgments.",
    );
  }
}

async function persistTrackedIssue(
  brainClient: LiveStatusBrainClient,
  scope: string,
  operatingState: CooOperatingState,
  finding: DraftFinding,
  now: Date,
  telemetryContext?: Record<string, unknown>,
): Promise<PersistTrackedIssueResult> {
  const existing = operatingState.trackedIssues[finding.key];
  if (existing) {
    existing.lastSeenAt = now.toISOString();
    existing.summary = finding.summary;
    existing.recommendation = finding.recommendation;
    existing.evidenceLine = finding.evidenceLine;
    existing.classification = finding.classification;
    existing.implicatedSubjects = finding.implicatedSubjects;
    return {
      state: existing,
      persistedNewRecord: 0,
    };
  }

  let brainFindingId: string | null = null;
  try {
    const response = await brainClient.captureMemory(
      {
        feature_id: finding.featureId,
        feature_label: finding.featureLabel,
        classification: finding.classification,
        summary: finding.summary,
        recommendation: finding.recommendation,
        implicated_subjects: finding.implicatedSubjects,
      },
      "finding",
      ["coo", "phase1", "tracked-issue", finding.classification],
      scope,
      createSystemProvenance("COO/briefing/status-governance/tracked-issue"),
      telemetryContext,
    );
    brainFindingId = asNonEmptyString(response.id) ?? null;
  } catch (error) {
    throw new BrainHardStopError(
      `The COO could not write a tracked issue to Brain: ${formatError(error)}`,
      "Repair the Brain write path before trusting COO issue tracking.",
    );
  }

  const state: TrackedIssueState = {
    key: finding.key,
    featureId: finding.featureId,
    featureLabel: finding.featureLabel,
    classification: finding.classification,
    summary: finding.summary,
    recommendation: finding.recommendation,
    evidenceLine: finding.evidenceLine,
    implicatedSubjects: finding.implicatedSubjects,
    brainFindingId,
    brainOpenLoopId: null,
    status: "open",
    firstSeenAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
  };
  operatingState.trackedIssues[finding.key] = state;
  return {
    state,
    persistedNewRecord: 1,
  };
}

function toGovernanceItem(issue: TrackedIssueState): GovernanceItem {
  return {
    key: issue.key,
    featureId: issue.featureId,
    featureLabel: issue.featureLabel,
    summary: issue.summary,
    recommendation: issue.recommendation,
    evidenceLine: issue.evidenceLine,
    classification: issue.classification,
    implicatedSubjects: issue.implicatedSubjects,
  };
}

function toTrustGovernanceItem(note: TrustMaterialNote): GovernanceItem {
  return {
    key: note.subjectId,
    featureId: null,
    featureLabel: humanizeTrustSubject(note.subjectId),
    summary: note.summary,
    recommendation: note.recommendation,
    evidenceLine: note.evidenceLine,
    classification: "confirmed",
    implicatedSubjects: [note.subjectId],
  };
}

function buildStatusNotes(
  facts: BriefSourceFacts,
  diagnostics: LiveBriefDiagnostics,
  deepAudit: DeepAuditSummary | null,
  milestones: GovernanceMilestones,
  trustNotes: TrustMaterialNote[],
  tuningNote: string | null,
): string[] {
  const notes: string[] = [];

  if (deepAudit) {
    notes.push(deepAudit.note);
    notes.push(`Deep audit trigger: ${humanizeAuditTrigger(deepAudit.trigger)}. Scope: ${deepAudit.scope}. Finding count: ${deepAudit.findingCount}.`);
    if (!deepAudit.justified) {
      notes.push("The deep-audit trigger may have been too strict for this run, so sensitivity should be watched.");
    }
  }

  if (diagnostics.unavailableFamilies.length > 0) {
    notes.push(`Missing source families remain visible: ${diagnostics.unavailableFamilies.map(humanizeSourceFamily).join(", ")}.`);
  }

  if ((facts.sourceFreshnessAgeMs ?? 0) > 72 * 60 * 60 * 1000) {
    notes.push(`The freshest source truth is already ${formatAge(facts.sourceFreshnessAgeMs ?? null)} old, so confidence is reduced.`);
  }

  if (tuningNote) {
    notes.push(tuningNote);
  }

  for (const milestoneNote of milestones.notes) {
    notes.push(milestoneNote);
  }

  for (const trustNote of trustNotes.filter((note) => note.severity !== "next")) {
    notes.push(trustNote.summary);
  }

  return uniqueStrings(notes);
}

function maybeRetuneTriggerSensitivity(
  operatingState: CooOperatingState,
  now: Date,
): TriggerTuningChange {
  if (operatingState.unjustifiedAuditStreak < 2) {
    return { changed: false, note: null };
  }

  if (operatingState.triggerConfig.companyEscalationThreshold >= 4) {
    return { changed: false, note: null };
  }

  operatingState.triggerConfig.companyEscalationThreshold += 1;
  operatingState.unjustifiedAuditStreak = 0;
  operatingState.lastTuningChangeAt = now.toISOString();
  operatingState.lastTuningChangeNote = `Audit sensitivity was loosened by raising the company-wide escalation threshold to ${operatingState.triggerConfig.companyEscalationThreshold} after repeated unjustified broad audits.`;
  return {
    changed: true,
    note: operatingState.lastTuningChangeNote,
  };
}

async function recordTriggerTuningChange(
  brainClient: LiveStatusBrainClient,
  scope: string,
  note: string,
  telemetryContext?: Record<string, unknown>,
): Promise<number> {
  try {
    await brainClient.captureMemory(
      { note },
      "convention",
      ["coo", "phase1", "trigger-tuning"],
      scope,
      createSystemProvenance("COO/briefing/status-governance/trigger-tuning"),
      telemetryContext,
    );
    return 1;
  } catch (error) {
    throw new BrainHardStopError(
      `The COO could not write trigger-tuning evidence to Brain: ${formatError(error)}`,
      "Repair the Brain write path before trusting COO trigger tuning.",
    );
  }
}

async function saveOperatingState(projectRoot: string, state: CooOperatingState): Promise<void> {
  const statePath = resolveOperatingStatePath(projectRoot);
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

function resolveOperatingStatePath(projectRoot: string): string {
  return resolve(projectRoot, ".codex", "runtime", "coo-operating-state.json");
}

async function loadFeatureGovernanceEvidence(
  projectRoot: string,
  featureId: string,
): Promise<FeatureGovernanceEvidence> {
  const featureRoot = resolve(projectRoot, "docs", "phase1", featureId);
  const statePath = join(featureRoot, "implement-plan-state.json");
  if (!await pathExists(statePath)) {
    return {
      closeoutFinishedAt: null,
      implementorModel: null,
      implementorRuntime: null,
      implementorAccessMode: null,
    };
  }

  try {
    const record = asRecord(await parseJsonFile<Record<string, unknown>>(statePath));
    const timestamps = asRecord(record.run_timestamps);
    return {
      closeoutFinishedAt: asNonEmptyString(timestamps.closeout_finished_at) ?? asNonEmptyString(record.updated_at),
      implementorModel: asNonEmptyString(record.implementor_model),
      implementorRuntime: asNonEmptyString(record.implementor_execution_runtime),
      implementorAccessMode: asNonEmptyString(record.implementor_execution_access_mode),
    };
  } catch {
    return {
      closeoutFinishedAt: null,
      implementorModel: null,
      implementorRuntime: null,
      implementorAccessMode: null,
    };
  }
}

function buildWorkerSubject(evidence: FeatureGovernanceEvidence): string | null {
  const model = evidence.implementorModel?.trim();
  if (!model) {
    return null;
  }
  return `worker:${model.toLowerCase()}`;
}

function ensureTrustSubject(
  operatingState: CooOperatingState,
  subjectId: string,
  now: Date,
): TrustSubjectState {
  const existing = operatingState.trustSubjects[subjectId];
  if (existing) {
    return existing;
  }

  const state: TrustSubjectState = {
    id: subjectId,
    kind: normalizeTrustKind(subjectId.split(":")[0] as string | null),
    label: humanizeTrustSubject(subjectId),
    score: 50,
    state: "normal",
    lastEvidenceAt: now.toISOString(),
    lastAuditAt: null,
    lastChangedAt: now.toISOString(),
    reason: "New trust subject created from live COO evidence.",
    pendingProposalAt: null,
    pendingProposalReason: null,
  };
  operatingState.trustSubjects[subjectId] = state;
  return state;
}

function computeTrustState(
  score: number,
  thresholds: GovernanceThresholds,
): TrustSubjectStateName {
  if (score >= thresholds.trustedScore) {
    return "trusted";
  }
  if (score <= thresholds.guardedScore) {
    return "guarded";
  }
  return "normal";
}

function normalizeClassification(value: string | null): GovernanceClassification {
  switch (value) {
    case "acceptable_legacy_gap":
    case "suspicious":
    case "contradicted":
    case "missing_not_provable":
    case "confirmed":
      return value;
    default:
      return "confirmed";
  }
}

function normalizeAuditTrigger(value: string | null): DeepAuditSummary["trigger"] | null {
  switch (value) {
    case "first_run":
    case "git_red_flag":
    case "suspicious_finding":
    case "stale_pressure":
    case "trust_transition":
      return value;
    default:
      return null;
  }
}

function normalizeAuditScope(value: string | null): DeepAuditSummary["scope"] | null {
  return value === "company" || value === "targeted" ? value : null;
}

function normalizeSensitivity(
  value: string | null,
): DeepAuditSummary["sensitivityAssessment"] | null {
  return value === "adequate" || value === "too_loose" || value === "too_strict"
    ? value
    : null;
}

function normalizeTrustKind(value: string | null): TrustSubjectKind {
  switch (value) {
    case "worker":
    case "component":
    case "route":
      return value;
    default:
      return "route";
  }
}

function normalizeTrustState(
  value: string | null,
  score: number,
): TrustSubjectStateName {
  switch (value) {
    case "guarded":
    case "normal":
    case "trusted":
    case "proposal_pending":
    case "full_trust":
      return value;
    default:
      return score >= DEFAULT_THRESHOLDS.trustedScore ? "trusted"
        : score <= DEFAULT_THRESHOLDS.guardedScore ? "guarded"
        : "normal";
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function containsText(record: Record<string, unknown>, text: string): boolean {
  try {
    return JSON.stringify(record).toLowerCase().includes(text.toLowerCase());
  } catch {
    return false;
  }
}

function humanizeAuditTrigger(trigger: DeepAuditSummary["trigger"]): string {
  switch (trigger) {
    case "first_run":
      return "first run with no prior baseline";
    case "git_red_flag":
      return "git coverage contradiction";
    case "suspicious_finding":
      return "suspicious current finding";
    case "stale_pressure":
      return "staleness pressure";
    case "trust_transition":
      return "trust transition";
    default:
      return trigger;
  }
}

function humanizeSourceFamily(value: string): string {
  if (value === "cto_admission" || value.toLowerCase() === "cto admission") {
    return "CTO Admission";
  }
  return value
    .split(/[\\/_-]+/)
    .filter((part) => part.trim().length > 0)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "cto") return "CTO";
      if (lower === "coo") return "COO";
      if (lower === "kpi") return "KPI";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function humanizeFeatureSlugList(values: string[]): string {
  return values.map((value) => humanizeSourceFamily(value)).join(", ");
}

function humanizeTrustSubject(subjectId: string): string {
  const [kind, ...rest] = subjectId.split(":");
  const label = rest.join(":");
  return `${kind.charAt(0).toUpperCase() + kind.slice(1)} ${humanizeSourceFamily(label || subjectId)}`.trim();
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

function daysBetween(from: string | null, to: string): number {
  if (!from) {
    return Number.POSITIVE_INFINITY;
  }
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000)));
}

function isoTimestampOnOrAfter(value: string | null, threshold: string | null): boolean {
  if (!value || !threshold) {
    return false;
  }
  const valueMs = Date.parse(value);
  const thresholdMs = Date.parse(threshold);
  if (Number.isNaN(valueMs) || Number.isNaN(thresholdMs)) {
    return false;
  }
  return valueMs >= thresholdMs;
}

function trustDeltaForClassification(classification: GovernanceClassification): number {
  switch (classification) {
    case "confirmed":
      return 6;
    case "acceptable_legacy_gap":
      return 1;
    case "missing_not_provable":
      return -6;
    case "suspicious":
      return -18;
    case "contradicted":
      return -28;
    default:
      return 0;
  }
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
      .map((entry) => typeof entry === "string" ? entry.trim() : "")
      .filter((entry) => entry.length > 0)
    : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
