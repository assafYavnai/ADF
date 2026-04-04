import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { RequirementArtifact } from "../requirements-gathering/contracts/onion-artifact.js";
import { buildAdmissionPacket } from "./build-packet.js";
import {
  AdmissionKpiState,
  CtoAdmissionThreadState,
  type AdmissionDecisionValue,
  type AdmissionKpiState as AdmissionKpiStateType,
  type AdmissionStatus,
  type CtoAdmissionThreadState as CtoAdmissionThreadStateType,
} from "./live-state.js";
import { renderAdmissionSummary } from "./render-summary.js";
import type {
  CtoAdmissionDecisionTemplate,
  CtoAdmissionRequest,
  FinalizedRequirementArtifact,
  KpiSnapshot,
  PacketBuildOptions,
} from "./types.js";

type AdmissionPartition = "production" | "proof";

const DEFAULT_REPO_ROOT = resolve(import.meta.dirname ?? ".", "../..");
const FEATURE_PHASE_ROOT = join("docs", "phase1");
const REQUEST_FILE_NAME = "cto-admission-request.json";
const DECISION_TEMPLATE_FILE_NAME = "cto-admission-decision.template.json";
const SUMMARY_FILE_NAME = "cto-admission-summary.md";
const REPO_ROOT_MARKERS = [
  "AGENTS.md",
  join("COO", "package.json"),
  join("components", "memory-engine", "package.json"),
] as const;

export interface AdmissionPersistenceReceipt {
  kind: "cto_admission_build" | "cto_admission_artifact_persist" | "cto_admission_decision_update";
  target: "filesystem";
  status: "stored" | "created" | "failed";
  artifact_kind: string;
  action: string;
  scope_path: string | null;
  record_id: string | null;
  duration_ms: number;
  success: boolean;
  message: string;
}

export interface CtoAdmissionHandoffInput {
  projectRoot?: string;
  scopePath: string | null | undefined;
  requirementArtifact: RequirementArtifact;
  finalizedRequirementMemoryId: string | null;
  previousState?: CtoAdmissionThreadStateType | null;
  partition?: AdmissionPartition;
  startedAtMs?: number;
  now?: () => Date;
  builderInputOverrides?: Partial<FinalizedRequirementArtifact>;
  builderOptions?: Omit<PacketBuildOptions, "partition">;
}

export interface CtoAdmissionHandoffResult {
  state: CtoAdmissionThreadStateType;
  receipts: AdmissionPersistenceReceipt[];
  artifacts: {
    request: CtoAdmissionRequest | null;
    decision_template: CtoAdmissionDecisionTemplate | null;
    summary_md: string | null;
  };
}

export interface CtoAdmissionDecisionUpdateInput {
  projectRoot?: string;
  state: CtoAdmissionThreadStateType;
  decision: AdmissionDecisionValue;
  decisionReason: string;
  decidedBy: string;
  now?: () => Date;
}

export interface CtoAdmissionDecisionUpdateResult {
  state: CtoAdmissionThreadStateType;
  receipts: AdmissionPersistenceReceipt[];
  decision_template: CtoAdmissionDecisionTemplate | null;
  summary_md: string | null;
}

export function resetCtoAdmissionThreadState(input: {
  previousState: CtoAdmissionThreadStateType | null | undefined;
  now?: () => Date;
}): CtoAdmissionThreadStateType | null {
  if (!input.previousState) {
    return null;
  }

  const previous = CtoAdmissionThreadState.parse(input.previousState);
  const nowIso = (input.now ?? (() => new Date()))().toISOString();

  return CtoAdmissionThreadState.parse({
    ...previous,
    status: "admission_not_started",
    outcome: null,
    packet_built_at: null,
    decision: null,
    decision_reason: null,
    decided_at: null,
    decided_by: null,
    dependency_blocked: false,
    scope_conflict_detected: false,
    validation_errors: [],
    last_error: null,
    artifact_paths: {
      feature_root: previous.artifact_paths.feature_root,
      request_json: null,
      decision_template_json: null,
      summary_md: null,
    },
    packet_kpi_snapshot: null,
    updated_at: nowIso,
  });
}

export async function handoffFinalizedRequirementToCtoAdmission(
  input: CtoAdmissionHandoffInput,
): Promise<CtoAdmissionHandoffResult> {
  const previousState = input.previousState ? CtoAdmissionThreadState.parse(input.previousState) : null;
  const partition = resolveAdmissionPartition(input.partition);
  const projectRoot = resolveProjectRoot(input.projectRoot);
  const nowFactory = input.now ?? (() => new Date());
  const startedAtMs = input.startedAtMs ?? Date.now();
  const featureSlug = resolveFeatureSlug({
    scopePath: input.scopePath,
    topic: input.requirementArtifact.human_scope.topic,
  });
  const featureRootRelative = toPosixPath(join(FEATURE_PHASE_ROOT, featureSlug));
  const featureRootAbsolute = resolve(projectRoot, featureRootRelative);
  const fallbackArtifactPaths = {
    feature_root: featureRootRelative,
    request_json: null,
    decision_template_json: null,
    summary_md: null,
  };

  try {
    const builderInput = buildLiveAdmissionInput({
      scopePath: input.scopePath,
      requirementArtifact: input.requirementArtifact,
      finalizedRequirementMemoryId: input.finalizedRequirementMemoryId,
      featureSlug,
      overrides: input.builderInputOverrides,
    });
    const buildResult = buildAdmissionPacket(builderInput, {
      partition,
      ...(input.builderOptions ?? {}),
    });
    const buildLatencyMs = Math.max(0, Date.now() - startedAtMs);
    const receipts: AdmissionPersistenceReceipt[] = [
      createReceipt({
        kind: "cto_admission_build",
        status: buildResult.outcome === "build_failed" ? "failed" : "created",
        artifactKind: "cto_admission_packet",
        action: "build",
        scopePath: featureRootRelative,
        recordId: null,
        durationMs: buildResult.build_latency_ms,
        success: buildResult.outcome !== "build_failed",
        message: buildResult.outcome === "build_failed"
          ? formatFailureMessage(buildResult.validation_errors, "CTO admission packet build failed.")
          : `Built CTO admission artifacts for ${builderInput.feature_slug}.`,
      }),
    ];

    if (
      buildResult.outcome === "build_failed"
      || !buildResult.request
      || !buildResult.decision_template
      || !buildResult.summary_md
    ) {
      const state = CtoAdmissionThreadState.parse({
        feature_slug: builderInput.feature_slug,
        requirement_artifact_source: builderInput.requirement_artifact_source,
        finalized_requirement_memory_id: input.finalizedRequirementMemoryId,
        partition,
        status: "admission_build_failed",
        outcome: "build_failed",
        packet_built_at: null,
        decision: null,
        decision_reason: null,
        decided_at: null,
        decided_by: null,
        dependency_blocked: false,
        scope_conflict_detected: false,
        validation_errors: buildResult.validation_errors,
        last_error: formatFailureMessage(buildResult.validation_errors, "CTO admission packet build failed."),
        artifact_paths: fallbackArtifactPaths,
        packet_kpi_snapshot: buildResult.kpi_snapshot,
        kpi: buildNextHandoffKpi(previousState?.kpi, {
          latencyMs: buildLatencyMs,
          partition,
          buildSucceeded: false,
          persistFailed: false,
          finalStatus: "admission_build_failed",
          writeComplete: true,
        }),
        updated_at: nowFactory().toISOString(),
      });
      return {
        state,
        receipts,
        artifacts: {
          request: null,
          decision_template: null,
          summary_md: null,
        },
      };
    }

    const persistedArtifacts = await persistAdmissionArtifacts({
      projectRootAbsolute: projectRoot,
      featureRootAbsolute,
      featureRootRelative,
      partition,
      request: buildResult.request,
      decisionTemplate: buildResult.decision_template,
      summaryMd: buildResult.summary_md,
    });
    receipts.push(...persistedArtifacts.receipts);

    const persistedStatus = persistedArtifacts.success
      ? resolvePersistedAdmissionStatus(buildResult.decision_template)
      : "admission_build_failed";
    const state = CtoAdmissionThreadState.parse({
      feature_slug: buildResult.request.feature_slug,
      requirement_artifact_source: buildResult.request.requirement_artifact_source,
      finalized_requirement_memory_id: input.finalizedRequirementMemoryId,
      partition,
      status: persistedStatus,
      outcome: buildResult.outcome,
      packet_built_at: buildResult.request.packet_built_at,
      decision: buildResult.decision_template.decision,
      decision_reason: buildResult.decision_template.decision_reason,
      decided_at: buildResult.decision_template.decided_at,
      decided_by: buildResult.decision_template.decided_by,
      dependency_blocked: buildResult.decision_template.dependency_blocked,
      scope_conflict_detected: buildResult.decision_template.scope_conflict_detected,
      validation_errors: buildResult.validation_errors,
      last_error: persistedArtifacts.errorMessage,
      artifact_paths: persistedArtifacts.paths,
      packet_kpi_snapshot: buildResult.kpi_snapshot,
      kpi: buildNextHandoffKpi(previousState?.kpi, {
        latencyMs: buildLatencyMs,
        partition,
        buildSucceeded: true,
        persistFailed: !persistedArtifacts.success,
        finalStatus: persistedStatus,
        writeComplete: isStatusWriteComplete({
          status: persistedStatus,
          artifactPaths: persistedArtifacts.paths,
          validationErrors: buildResult.validation_errors,
          lastError: persistedArtifacts.errorMessage,
        }),
      }),
      updated_at: nowFactory().toISOString(),
    });

    return {
      state,
      receipts,
      artifacts: {
        request: buildResult.request,
        decision_template: buildResult.decision_template,
        summary_md: buildResult.summary_md,
      },
    };
  } catch (error) {
    const lastError = error instanceof Error ? error.message : String(error);
    const buildLatencyMs = Math.max(0, Date.now() - startedAtMs);
    const fallbackSource = input.finalizedRequirementMemoryId
      ? `memory://finalized-requirement/${input.finalizedRequirementMemoryId}`
      : `onion-approved-snapshot://${input.requirementArtifact.artifact_id}`;
    const failureState = CtoAdmissionThreadState.parse({
      feature_slug: featureSlug,
      requirement_artifact_source: fallbackSource,
      finalized_requirement_memory_id: input.finalizedRequirementMemoryId,
      partition,
      status: "admission_build_failed",
      outcome: "build_failed",
      packet_built_at: null,
      decision: null,
      decision_reason: null,
      decided_at: null,
      decided_by: null,
      dependency_blocked: false,
      scope_conflict_detected: false,
      validation_errors: [],
      last_error: lastError,
      artifact_paths: fallbackArtifactPaths,
      packet_kpi_snapshot: buildZeroKpiSnapshot(partition),
      kpi: buildNextHandoffKpi(previousState?.kpi, {
        latencyMs: buildLatencyMs,
        partition,
        buildSucceeded: false,
        persistFailed: false,
        finalStatus: "admission_build_failed",
        writeComplete: true,
      }),
      updated_at: nowFactory().toISOString(),
    });

    return {
      state: failureState,
      receipts: [
        createReceipt({
          kind: "cto_admission_build",
          status: "failed",
          artifactKind: "cto_admission_packet",
          action: "build",
          scopePath: featureRootRelative,
          recordId: null,
          durationMs: buildLatencyMs,
          success: false,
          message: lastError,
        }),
      ],
      artifacts: {
        request: null,
        decision_template: null,
        summary_md: null,
      },
    };
  }
}

export async function updateCtoAdmissionDecision(
  input: CtoAdmissionDecisionUpdateInput,
): Promise<CtoAdmissionDecisionUpdateResult> {
  const projectRoot = resolveProjectRoot(input.projectRoot);
  const previousState = CtoAdmissionThreadState.parse(input.state);
  const nowFactory = input.now ?? (() => new Date());
  const nowIso = nowFactory().toISOString();
  const receiptsBase = {
    kind: "cto_admission_decision_update" as const,
    artifactKind: "cto_admission_decision_template",
    action: "update_explicit_decision",
    scopePath: previousState.artifact_paths.feature_root,
    recordId: previousState.artifact_paths.decision_template_json,
  };

  try {
    if (!previousState.artifact_paths.request_json) {
      throw new Error("Cannot update CTO admission decision because the request artifact path is missing.");
    }
    if (!previousState.artifact_paths.decision_template_json) {
      throw new Error("Cannot update CTO admission decision because the decision template path is missing.");
    }
    if (!previousState.artifact_paths.summary_md) {
      throw new Error("Cannot update CTO admission decision because the summary artifact path is missing.");
    }

    const requestPath = resolve(projectRoot, previousState.artifact_paths.request_json);
    const decisionTemplatePath = resolve(projectRoot, previousState.artifact_paths.decision_template_json);
    const summaryPath = resolve(projectRoot, previousState.artifact_paths.summary_md);
    const request = await readJsonFile<CtoAdmissionRequest>(requestPath, "CTO admission request");
    const currentDecisionTemplate = await readJsonFile<CtoAdmissionDecisionTemplate>(
      decisionTemplatePath,
      "CTO admission decision template",
    );
    const nextDecisionTemplate: CtoAdmissionDecisionTemplate = {
      ...currentDecisionTemplate,
      decision: input.decision,
      decision_reason: input.decisionReason,
      decided_by: input.decidedBy,
      decided_at: nowIso,
    };
    const summaryMd = renderAdmissionSummary(
      request,
      nextDecisionTemplate,
      previousState.packet_kpi_snapshot ?? buildZeroKpiSnapshot(previousState.partition),
    );

    await writeFile(decisionTemplatePath, toJson(nextDecisionTemplate), "utf-8");
    await writeFile(summaryPath, summaryMd, "utf-8");

    const nextStatus = mapDecisionToStatus(input.decision);
    const nextState = CtoAdmissionThreadState.parse({
      ...previousState,
      status: nextStatus,
      decision: input.decision,
      decision_reason: input.decisionReason,
      decided_at: nowIso,
      decided_by: input.decidedBy,
      last_error: null,
      kpi: buildNextDecisionKpi(previousState.kpi, {
        previousStatus: previousState.status,
        nextStatus,
        writeComplete: true,
      }),
      updated_at: nowIso,
    });

    return {
      state: nextState,
      receipts: [
        createReceipt({
          kind: receiptsBase.kind,
          status: "stored",
          artifactKind: receiptsBase.artifactKind,
          action: receiptsBase.action,
          scopePath: receiptsBase.scopePath,
          recordId: receiptsBase.recordId,
          durationMs: 0,
          success: true,
          message: `Updated CTO admission decision to ${input.decision}.`,
        }),
      ],
      decision_template: nextDecisionTemplate,
      summary_md: summaryMd,
    };
  } catch (error) {
    const lastError = error instanceof Error ? error.message : String(error);
    const nextState = CtoAdmissionThreadState.parse({
      ...previousState,
      last_error: lastError,
      kpi: buildNextDecisionKpi(previousState.kpi, {
        previousStatus: previousState.status,
        nextStatus: previousState.status,
        writeComplete: false,
      }),
      updated_at: nowIso,
    });
    return {
      state: nextState,
      receipts: [
        createReceipt({
          kind: receiptsBase.kind,
          status: "failed",
          artifactKind: receiptsBase.artifactKind,
          action: receiptsBase.action,
          scopePath: receiptsBase.scopePath,
          recordId: receiptsBase.recordId,
          durationMs: 0,
          success: false,
          message: lastError,
        }),
      ],
      decision_template: null,
      summary_md: null,
    };
  }
}

function buildLiveAdmissionInput(input: {
  scopePath: string | null | undefined;
  requirementArtifact: RequirementArtifact;
  finalizedRequirementMemoryId: string | null;
  featureSlug: string;
  overrides?: Partial<FinalizedRequirementArtifact>;
}): FinalizedRequirementArtifact {
  const requirementSource = input.finalizedRequirementMemoryId
    ? `memory://finalized-requirement/${input.finalizedRequirementMemoryId}`
    : `onion-approved-snapshot://${input.requirementArtifact.artifact_id}`;

  return {
    feature_slug: input.featureSlug,
    requirement_artifact_source: requirementSource,
    business_priority: "medium",
    claimed_scope_paths: input.scopePath ? [input.scopePath] : [`feature:${input.featureSlug}`],
    non_goals: input.requirementArtifact.explicit_boundaries
      .filter((boundary) => boundary.kind === "non_goal")
      .map((boundary) => boundary.statement),
    boundaries: input.requirementArtifact.explicit_boundaries.map((boundary) => boundary.statement),
    sequencing_hint: "any",
    dependency_notes: [...input.requirementArtifact.blockers],
    conflict_notes: input.requirementArtifact.open_business_decisions.map(
      (decision) => `Open business decision: ${decision.question}`,
    ),
    suggested_execution_mode: deriveExecutionMode(input.requirementArtifact),
    requirement_summary: buildRequirementSummary(input.requirementArtifact),
    frozen_at: input.requirementArtifact.human_scope.approved_at,
    ...(input.overrides ?? {}),
  };
}

async function persistAdmissionArtifacts(input: {
  projectRootAbsolute: string;
  featureRootAbsolute: string;
  featureRootRelative: string;
  partition: AdmissionPartition;
  request: CtoAdmissionRequest;
  decisionTemplate: CtoAdmissionDecisionTemplate;
  summaryMd: string;
}): Promise<{
  success: boolean;
  paths: {
    feature_root: string;
    request_json: string | null;
    decision_template_json: string | null;
    summary_md: string | null;
  };
  receipts: AdmissionPersistenceReceipt[];
  errorMessage: string | null;
}> {
  const paths = {
    feature_root: input.featureRootRelative,
    request_json: null as string | null,
    decision_template_json: null as string | null,
    summary_md: null as string | null,
  };
  const receipts: AdmissionPersistenceReceipt[] = [];
  const errors: string[] = [];

  const proofIsolationMessage = await validateProofArtifactIsolation({
    projectRootAbsolute: input.projectRootAbsolute,
    partition: input.partition,
  });
  if (proofIsolationMessage) {
    return {
      success: false,
      paths,
      receipts: [
        createReceipt({
          kind: "cto_admission_artifact_persist",
          status: "failed",
          artifactKind: "cto_admission_feature_root",
          action: "enforce_proof_root_isolation",
          scopePath: input.featureRootRelative,
          recordId: input.featureRootRelative,
          durationMs: 0,
          success: false,
          message: proofIsolationMessage,
        }),
      ],
      errorMessage: proofIsolationMessage,
    };
  }

  const featureRootCreateStartedAt = Date.now();
  try {
    await mkdir(input.featureRootAbsolute, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      paths,
      receipts: [
        createReceipt({
          kind: "cto_admission_artifact_persist",
          status: "failed",
          artifactKind: "cto_admission_feature_root",
          action: "mkdir_feature_root",
          scopePath: input.featureRootRelative,
          recordId: input.featureRootRelative,
          durationMs: Date.now() - featureRootCreateStartedAt,
          success: false,
          message,
        }),
      ],
      errorMessage: message,
    };
  }

  const requestRelativePath = toPosixPath(join(input.featureRootRelative, REQUEST_FILE_NAME));
  const decisionTemplateRelativePath = toPosixPath(join(input.featureRootRelative, DECISION_TEMPLATE_FILE_NAME));
  const summaryRelativePath = toPosixPath(join(input.featureRootRelative, SUMMARY_FILE_NAME));

  const requestPersisted = await writeArtifact({
    absolutePath: resolve(input.featureRootAbsolute, REQUEST_FILE_NAME),
    relativePath: requestRelativePath,
    contents: toJson(input.request),
    artifactKind: "cto_admission_request",
  });
  receipts.push(requestPersisted.receipt);
  if (requestPersisted.success) {
    paths.request_json = requestPersisted.relativePath;
  } else {
    errors.push(requestPersisted.receipt.message);
  }

  const decisionTemplatePersisted = await writeArtifact({
    absolutePath: resolve(input.featureRootAbsolute, DECISION_TEMPLATE_FILE_NAME),
    relativePath: decisionTemplateRelativePath,
    contents: toJson(input.decisionTemplate),
    artifactKind: "cto_admission_decision_template",
  });
  receipts.push(decisionTemplatePersisted.receipt);
  if (decisionTemplatePersisted.success) {
    paths.decision_template_json = decisionTemplatePersisted.relativePath;
  } else {
    errors.push(decisionTemplatePersisted.receipt.message);
  }

  const summaryPersisted = await writeArtifact({
    absolutePath: resolve(input.featureRootAbsolute, SUMMARY_FILE_NAME),
    relativePath: summaryRelativePath,
    contents: input.summaryMd,
    artifactKind: "cto_admission_summary",
  });
  receipts.push(summaryPersisted.receipt);
  if (summaryPersisted.success) {
    paths.summary_md = summaryPersisted.relativePath;
  } else {
    errors.push(summaryPersisted.receipt.message);
  }

  return {
    success: errors.length === 0,
    paths,
    receipts,
    errorMessage: errors.length > 0 ? errors.join(" | ") : null,
  };
}

async function writeArtifact(input: {
  absolutePath: string;
  relativePath: string;
  contents: string;
  artifactKind: string;
}): Promise<{
  success: boolean;
  relativePath: string;
  receipt: AdmissionPersistenceReceipt;
}> {
  const startedAt = Date.now();
  try {
    await writeFile(input.absolutePath, input.contents, "utf-8");
    return {
      success: true,
      relativePath: input.relativePath,
      receipt: createReceipt({
        kind: "cto_admission_artifact_persist",
        status: "stored",
        artifactKind: input.artifactKind,
        action: "persist",
        scopePath: input.relativePath,
        recordId: input.relativePath,
        durationMs: Date.now() - startedAt,
        success: true,
        message: `Persisted ${input.relativePath}.`,
      }),
    };
  } catch (error) {
    return {
      success: false,
      relativePath: input.relativePath,
      receipt: createReceipt({
        kind: "cto_admission_artifact_persist",
        status: "failed",
        artifactKind: input.artifactKind,
        action: "persist",
        scopePath: input.relativePath,
        recordId: input.relativePath,
        durationMs: Date.now() - startedAt,
        success: false,
        message: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}

function buildRequirementSummary(artifact: RequirementArtifact): string {
  const majorParts = artifact.human_scope.major_parts.map((part) => part.label);
  const lines = [
    `Topic: ${artifact.human_scope.topic}`,
    `Goal: ${artifact.human_scope.goal}`,
    `Expected result: ${artifact.human_scope.expected_result}`,
    `Success view: ${artifact.human_scope.success_view}`,
    `Major parts: ${majorParts.length > 0 ? majorParts.join(", ") : "none explicitly listed"}`,
    "Requirement items:",
    ...artifact.requirement_items.map((item) => `- ${item.title}: ${item.detail}`),
  ];

  return lines.join("\n");
}

function deriveExecutionMode(
  artifact: RequirementArtifact,
): FinalizedRequirementArtifact["suggested_execution_mode"] {
  if (artifact.derivation_status === "blocked" || artifact.blockers.length > 0) {
    return "dependency-blocked";
  }
  if (artifact.human_scope.major_parts.length > 1) {
    return "safe-parallel";
  }
  return "sequential";
}

function resolvePersistedAdmissionStatus(
  decisionTemplate: CtoAdmissionDecisionTemplate,
): AdmissionStatus {
  if (decisionTemplate.decision === null) {
    return "admission_pending_decision";
  }
  return mapDecisionToStatus(decisionTemplate.decision);
}

function mapDecisionToStatus(decision: AdmissionDecisionValue): AdmissionStatus {
  switch (decision) {
    case "admit":
      return "admission_admitted";
    case "defer":
      return "admission_deferred";
    case "block":
      return "admission_blocked";
  }
}

function buildNextHandoffKpi(
  previousKpi: AdmissionKpiStateType | null | undefined,
  input: {
    latencyMs: number;
    partition: AdmissionPartition;
    buildSucceeded: boolean;
    persistFailed: boolean;
    finalStatus: AdmissionStatus;
    writeComplete: boolean;
  },
): AdmissionKpiStateType {
  const current = AdmissionKpiState.parse(previousKpi ?? {});
  const nextLatency = updateLatencySummary(
    current.finalized_requirement_to_admission_latency_ms.samples_ms,
    input.latencyMs,
  );
  const writeAttemptCount = current.admission_status_write_attempt_count + 1;
  const writeCompleteCount = current.admission_status_write_complete_count + (input.writeComplete ? 1 : 0);

  return AdmissionKpiState.parse({
    ...current,
    finalized_requirement_to_admission_latency_ms: nextLatency,
    finalized_requirement_handoff_count: current.finalized_requirement_handoff_count + 1,
    admission_artifact_build_success_count: current.admission_artifact_build_success_count + (input.buildSucceeded ? 1 : 0),
    admission_artifact_build_failed_count: current.admission_artifact_build_failed_count + (input.buildSucceeded ? 0 : 1),
    admission_pending_decision_count: current.admission_pending_decision_count
      + (input.finalStatus === "admission_pending_decision" ? 1 : 0),
    admission_admitted_count: current.admission_admitted_count
      + (input.finalStatus === "admission_admitted" ? 1 : 0),
    admission_deferred_count: current.admission_deferred_count
      + (input.finalStatus === "admission_deferred" ? 1 : 0),
    admission_blocked_count: current.admission_blocked_count
      + (input.finalStatus === "admission_blocked" ? 1 : 0),
    admission_artifact_persist_failure_count: current.admission_artifact_persist_failure_count
      + (input.persistFailed ? 1 : 0),
    requirement_to_admission_artifact_parity_count: current.requirement_to_admission_artifact_parity_count
      + (input.buildSucceeded && !input.persistFailed ? 1 : 0),
    admission_status_write_attempt_count: writeAttemptCount,
    admission_status_write_complete_count: writeCompleteCount,
    admission_status_write_completeness_rate: writeAttemptCount > 0
      ? Number((writeCompleteCount / writeAttemptCount).toFixed(4))
      : 0,
    production_handoff_count: current.production_handoff_count + (input.partition === "production" ? 1 : 0),
    proof_handoff_count: current.proof_handoff_count + (input.partition === "proof" ? 1 : 0),
  });
}

function buildNextDecisionKpi(
  previousKpi: AdmissionKpiStateType,
  input: {
    previousStatus: AdmissionStatus;
    nextStatus: AdmissionStatus;
    writeComplete: boolean;
  },
): AdmissionKpiStateType {
  const current = AdmissionKpiState.parse(previousKpi);
  const writeAttemptCount = current.admission_status_write_attempt_count + 1;
  const writeCompleteCount = current.admission_status_write_complete_count + (input.writeComplete ? 1 : 0);

  return AdmissionKpiState.parse({
    ...current,
    admission_pending_decision_count: current.admission_pending_decision_count
      + (input.previousStatus !== input.nextStatus && input.nextStatus === "admission_pending_decision" ? 1 : 0),
    admission_admitted_count: current.admission_admitted_count
      + (input.previousStatus !== input.nextStatus && input.nextStatus === "admission_admitted" ? 1 : 0),
    admission_deferred_count: current.admission_deferred_count
      + (input.previousStatus !== input.nextStatus && input.nextStatus === "admission_deferred" ? 1 : 0),
    admission_blocked_count: current.admission_blocked_count
      + (input.previousStatus !== input.nextStatus && input.nextStatus === "admission_blocked" ? 1 : 0),
    admission_status_write_attempt_count: writeAttemptCount,
    admission_status_write_complete_count: writeCompleteCount,
    admission_status_write_completeness_rate: writeAttemptCount > 0
      ? Number((writeCompleteCount / writeAttemptCount).toFixed(4))
      : 0,
  });
}

function updateLatencySummary(samples: number[], latencyMs: number): AdmissionKpiStateType["finalized_requirement_to_admission_latency_ms"] {
  const nextSamples = [...samples, Math.max(0, Math.round(latencyMs))];
  const sortedSamples = [...nextSamples].sort((left, right) => left - right);
  const last = nextSamples.at(-1) ?? 0;

  return {
    samples_ms: nextSamples,
    last_ms: last,
    p50_ms: percentile(sortedSamples, 0.5),
    p95_ms: percentile(sortedSamples, 0.95),
    p99_ms: percentile(sortedSamples, 0.99),
    over_1s_count: nextSamples.filter((sample) => sample > 1_000).length,
    over_10s_count: nextSamples.filter((sample) => sample > 10_000).length,
    over_60s_count: nextSamples.filter((sample) => sample > 60_000).length,
  };
}

function percentile(sortedSamples: number[], quantile: number): number {
  if (sortedSamples.length === 0) {
    return 0;
  }
  const index = Math.max(0, Math.ceil(sortedSamples.length * quantile) - 1);
  return sortedSamples[index] ?? sortedSamples[sortedSamples.length - 1] ?? 0;
}

function buildZeroKpiSnapshot(partition: AdmissionPartition): KpiSnapshot {
  return {
    admission_packet_build_latency_ms: 0,
    admission_packets_built_count: 0,
    admission_packets_admitted_count: 0,
    admission_packets_deferred_count: 0,
    admission_packets_blocked_count: 0,
    missing_required_input_count: 0,
    dependency_blocked_count: 0,
    scope_conflict_detected_count: 0,
    admission_source_metadata_completeness_rate: 0,
    requirement_to_packet_parity_count: 0,
    partition,
  };
}

function isStatusWriteComplete(input: {
  status: AdmissionStatus;
  artifactPaths: {
    request_json: string | null;
    decision_template_json: string | null;
    summary_md: string | null;
  };
  validationErrors: string[];
  lastError: string | null;
}): boolean {
  if (input.status === "admission_build_failed") {
    return input.validationErrors.length > 0 || Boolean(input.lastError);
  }
  return Boolean(
    input.artifactPaths.request_json
      && input.artifactPaths.decision_template_json
      && input.artifactPaths.summary_md,
  );
}

function createReceipt(input: {
  kind: AdmissionPersistenceReceipt["kind"];
  status: AdmissionPersistenceReceipt["status"];
  artifactKind: string;
  action: string;
  scopePath: string | null;
  recordId: string | null;
  durationMs: number;
  success: boolean;
  message: string;
}): AdmissionPersistenceReceipt {
  return {
    kind: input.kind,
    target: "filesystem",
    status: input.status,
    artifact_kind: input.artifactKind,
    action: input.action,
    scope_path: input.scopePath,
    record_id: input.recordId,
    duration_ms: Math.max(0, Math.round(input.durationMs)),
    success: input.success,
    message: input.message,
  };
}

async function readJsonFile<T>(absolutePath: string, label: string): Promise<T> {
  const raw = await readFile(absolutePath, "utf-8");
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(
      `${label} at ${absolutePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function resolveProjectRoot(projectRoot?: string): string {
  return resolve(projectRoot ?? DEFAULT_REPO_ROOT);
}

function resolveAdmissionPartition(partition?: AdmissionPartition): AdmissionPartition {
  if (partition) {
    return partition;
  }
  return process.env.ADF_COO_TEST_PARSER_UPDATES_FILE?.trim() ? "proof" : "production";
}

function resolveFeatureSlug(input: {
  scopePath: string | null | undefined;
  topic: string;
}): string {
  const scopeDerivedSlug = resolveFeatureSlugFromScopePath(input.scopePath);
  if (scopeDerivedSlug) {
    return scopeDerivedSlug;
  }
  return slugifyFeatureSlug(input.topic);
}

function resolveFeatureSlugFromScopePath(scopePath: string | null | undefined): string | null {
  if (!scopePath) {
    return null;
  }
  const segments = scopePath
    .split(/[\\/]+/g)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const candidate = segments.at(-1);
  if (!candidate) {
    return null;
  }
  if (/^[a-z0-9._-]+$/i.test(candidate)) {
    return candidate.toLowerCase();
  }
  const slug = slugifyFeatureSlug(candidate);
  return slug.length > 0 ? slug : null;
}

function slugifyFeatureSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "untitled-feature";
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function formatFailureMessage(messages: string[], fallback: string): string {
  return messages.length > 0 ? messages.join(" | ") : fallback;
}

async function validateProofArtifactIsolation(input: {
  projectRootAbsolute: string;
  partition: AdmissionPartition;
}): Promise<string | null> {
  if (input.partition !== "proof") {
    return null;
  }
  const isCheckoutRoot = await looksLikeAdfCheckoutRoot(input.projectRootAbsolute);
  if (!isCheckoutRoot) {
    return null;
  }
  return "Proof CTO admission persistence requires an isolated temp project root and cannot write into a real ADF checkout or worktree root.";
}

async function looksLikeAdfCheckoutRoot(projectRootAbsolute: string): Promise<boolean> {
  const markerChecks = await Promise.all(
    REPO_ROOT_MARKERS.map(async (relativePath) => pathExists(resolve(projectRootAbsolute, relativePath))),
  );
  return markerChecks.every(Boolean);
}

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}
