import { z } from "zod";
import { createSystemProvenance, type Provenance } from "../../../shared/provenance/types.js";
import { emit } from "../../../shared/telemetry/collector.js";
import { invoke } from "../../../shared/llm-invoker/invoker.js";
import type {
  InvocationAttempt,
  InvocationParams,
  InvocationResult,
  InvocationSessionHandle,
} from "../../../shared/llm-invoker/types.js";
import type { ControllerConfig } from "../../controller/loop.js";
import {
  createEvent,
  type FileSystemThreadStore,
  type Thread,
  type UserInputEvent,
} from "../../controller/thread.js";
import {
  buildWorkingScopeArtifact,
  type RequirementArtifact,
  type WorkingScopeArtifact,
} from "../contracts/onion-artifact.js";
import {
  OnionPersistenceReceipt,
  OnionWorkflowLifecycleStatus,
  OnionWorkflowThreadState,
  type OnionPersistenceReceipt as OnionPersistenceReceiptType,
  type OnionWorkflowLifecycleStatus as OnionWorkflowLifecycleStatusType,
} from "../contracts/onion-live.js";
import {
  OnionLlmCallRecord,
  type OnionLlmCallRecord as OnionLlmCallRecordType,
} from "../contracts/onion-observability.js";
import { OnionTurnUpdate, type OnionTurn } from "../contracts/onion-turn.js";
import { createEmptyOnionState, type OnionState } from "../contracts/onion-state.js";
import { buildAuditTrace } from "../engine/audit-trace.js";
import { deriveRequirementArtifact } from "../engine/artifact-deriver.js";
import { selectNextClarificationQuestion } from "../engine/clarification-policy.js";
import { renderConversationResponse } from "../engine/conversation-renderer.js";
import { deriveConversationState } from "../engine/conversation-state.js";
import { evaluateFreezeReadiness } from "../engine/freeze-check.js";
import { reduceOnionState } from "../engine/onion-reducer.js";
import { evaluateReadiness } from "../engine/readiness-check.js";

const ParserResponse = OnionTurnUpdate;

export interface RequirementsGatheringOnionResult {
  response: string;
  provenance: Provenance;
  latency_ms: number;
  session: InvocationResult["session"];
  state_commit_summary: string;
  open_loops: string[];
}

export async function handleRequirementsGatheringOnion(input: {
  userMessage: string;
  thread: Thread;
  store: FileSystemThreadStore;
  config: Pick<
    ControllerConfig,
    | "intelligenceParams"
    | "invokeLLM"
    | "brainCreateFinalizedRequirementCandidate"
    | "brainManageMemory"
    | "brainPublishFinalizedRequirement"
  >;
  sessionHandle?: InvocationSessionHandle;
}): Promise<RequirementsGatheringOnionResult> {
  const onionStartedAt = Date.now();
  const responseProvenance = createSystemProvenance("COO/requirements-gathering/live/respond");
  const latestUserEvent = getLatestUserEvent(input.thread);
  if (!latestUserEvent) {
    throw new Error("requirements-gathering onion requires a latest user_input event");
  }

  const previousWorkflowState = input.thread.workflowState.onion;
  const traceId = previousWorkflowState?.trace_id ?? `onion::${input.thread.id}`;
  const previousState = previousWorkflowState?.state ?? createEmptyOnionState();
  const previousWorkingArtifact = previousWorkflowState?.working_artifact ?? buildWorkingScopeArtifact(previousState);
  const priorClarification = selectNextClarificationQuestion({
    trace_id: traceId,
    turn_id: latestUserEvent.id,
    state: previousState,
  });

  const llmSourcePath = `COO/requirements-gathering/live/turn-parser/${traceId}/${latestUserEvent.id}`;
  let parserLatencyMs = 0;
  let parserSession: InvocationResult["session"] = null;
  const llmCalls: OnionLlmCallRecordType[] = [];

  let update = OnionTurnUpdate.parse({});
  try {
    const parserResult = await invokeLlm(input.config, {
      ...input.config.intelligenceParams,
      prompt: buildOnionTurnParserPrompt({
        userMessage: input.userMessage,
        currentWorkflowState: previousWorkflowState,
        workingArtifact: previousWorkingArtifact,
        currentLayer: priorClarification.selection.current_layer,
        currentQuestion: priorClarification.selection.next_question?.question ?? null,
      }),
      source_path: llmSourcePath,
      session: {
        persist: true,
        handle: input.sessionHandle,
      },
      telemetry_metadata: {
        thread_id: input.thread.id,
        scope_path: input.thread.scopePath,
        workflow: "requirements_gathering_onion",
        active_workflow: input.thread.workflowState.active_workflow,
        route_stage: "onion_turn_parse",
        trace_id: traceId,
        turn_id: latestUserEvent.id,
        current_layer: priorClarification.selection.current_layer,
      },
    });
    parserLatencyMs = parserResult.latency_ms;
    parserSession = parserResult.session;
    llmCalls.push(buildLlmCallRecordFromResult(traceId, latestUserEvent.id, "onion_turn_parse", parserResult));
    update = parseOnionTurnUpdate(parserResult.response);
  } catch (error) {
    return handleParseFailure({
      traceId,
      latestUserEvent,
      input,
      previousWorkflowState,
      previousState,
      previousWorkingArtifact,
      priorClarification,
      llmCalls: [
        ...llmCalls,
        ...toArray(buildLlmCallRecordFromFailure(traceId, latestUserEvent.id, "onion_turn_parse", error)),
      ],
      responseProvenance,
      parserSession,
      totalLatencyMs: Date.now() - onionStartedAt,
    });
  }

  const onionTurn = buildOnionTurn(latestUserEvent, input.userMessage, update);
  const reduced = reduceOnionState({
    trace_id: traceId,
    turn: onionTurn,
    previous_state: previousState,
  });
  const clarification = selectNextClarificationQuestion({
    trace_id: traceId,
    turn_id: latestUserEvent.id,
    state: reduced.state,
  });
  const freeze = evaluateFreezeReadiness({
    trace_id: traceId,
    turn_id: latestUserEvent.id,
    state: reduced.state,
  });
  const derivation = deriveRequirementArtifact({
    trace_id: traceId,
    turn_id: latestUserEvent.id,
    state: reduced.state,
  });
  const readiness = evaluateReadiness({
    trace_id: traceId,
    turn_id: latestUserEvent.id,
    state: reduced.state,
    derivation,
  });
  const audit = buildAuditTrace({
    trace_id: traceId,
    turn: onionTurn,
    state: reduced.state,
    artifact_change_summary: reduced.artifact_change_summary,
    clarification: clarification.selection,
    freeze: freeze.result,
    readiness,
  });

  emitOperationTelemetry([
    reduced.record,
    clarification.record,
    freeze.record,
    derivation.record,
    readiness.record,
    audit.record,
  ], traceId);

  const persistence = await persistOnionArtifacts({
    traceId,
    turnId: latestUserEvent.id,
    threadId: input.thread.id,
    scopePath: input.thread.scopePath,
    previousWorkflowState,
    reducedState: reduced.state,
    requirementArtifact: derivation.artifact,
    readinessStatus: readiness.status,
    config: input.config,
  });
  const turnLatencyMs = Date.now() - onionStartedAt;
  const llmTotals = summarizeLlmCalls(llmCalls);
  const layerMetrics = summarizeLayerMetrics({
    thread: input.thread,
    currentLayer: audit.trace.current_layer,
    currentTurnLatencyMs: turnLatencyMs,
    clarificationQuestion: clarification.selection.next_question?.question ?? null,
    freezeBlockerCount: audit.trace.freeze_blockers.length,
    openDecisionCount: audit.trace.open_decisions_snapshot.filter((decision) => decision.status !== "resolved").length,
  });

  const lifecycleStatus = buildLifecycleStatus({
    freezeStatus: reduced.state.freeze_status.status,
    readinessStatus: readiness.status,
    persistenceFailures: persistence.receipts.some((receipt) => !receipt.success),
    finalizedRequirementMemoryId: persistence.finalizedRequirementMemoryId,
  });
  const stateCommitSummary = buildStateCommitSummary({
    lifecycleStatus,
    finalizedRequirementMemoryId: persistence.finalizedRequirementMemoryId,
    persistenceFailures: persistence.receipts.filter((receipt) => !receipt.success),
  });
  const openLoops = buildOpenLoops({
    clarificationQuestion: clarification.selection.next_question?.question ?? null,
    freezeRequest: freeze.result.freeze_request?.approval_question ?? null,
    persistenceFailures: persistence.receipts.filter((receipt) => !receipt.success),
  });
  const threadWorkflowState = OnionWorkflowThreadState.parse({
    trace_id: traceId,
    last_turn_id: latestUserEvent.id,
    lifecycle_status: lifecycleStatus,
    current_layer: audit.trace.current_layer,
    selected_next_question: audit.trace.selected_next_question,
    no_question_reason: audit.trace.no_question_reason,
    state: reduced.state,
    working_artifact: reduced.working_artifact,
    requirement_artifact: derivation.artifact,
    finalized_requirement_memory_id: persistence.finalizedRequirementMemoryId,
    latest_audit_trace: audit.trace,
    latest_llm_calls: llmCalls,
    latest_persistence_receipts: [
      ...persistence.receipts,
      OnionPersistenceReceipt.parse({
        kind: "thread_workflow_state",
        target: "thread",
        status: "stored",
        artifact_kind: "working_scope",
        action: "persist",
        scope_path: input.thread.scopePath,
        duration_ms: 0,
        success: true,
        message: "Thread workflow state persisted for the live onion turn.",
      }),
    ],
  });

  input.thread.workflowState = {
    active_workflow: lifecycleStatus === "handoff_ready" ? null : "requirements_gathering_onion",
    onion: threadWorkflowState,
  };

  input.thread.events.push(createEvent("onion_turn_result", {
    trace_id: traceId,
    turn_id: latestUserEvent.id,
    lifecycle_status: lifecycleStatus,
    current_layer: audit.trace.current_layer,
    turn_latency_ms: turnLatencyMs,
    parser_latency_ms: parserLatencyMs,
    llm_totals: llmTotals,
    layer_metrics: layerMetrics,
    state: reduced.state,
    working_artifact: reduced.working_artifact,
    requirement_artifact: derivation.artifact,
    finalized_requirement_memory_id: persistence.finalizedRequirementMemoryId,
    workflow_trace: audit.trace,
    operation_records: [
      reduced.record,
      clarification.record,
      freeze.record,
      derivation.record,
      readiness.record,
      audit.record,
    ],
    llm_calls: llmCalls,
    persistence_receipts: threadWorkflowState.latest_persistence_receipts,
    state_commit_summary: stateCommitSummary,
    open_loops: openLoops,
  }, responseProvenance));
  await input.store.update(input.thread);
  emitOnionTurnTelemetry({
    traceId,
    threadId: input.thread.id,
    turnId: latestUserEvent.id,
    scopePath: input.thread.scopePath,
    lifecycleStatus,
    currentLayer: audit.trace.current_layer,
    selectedNextQuestion: audit.trace.selected_next_question,
    turnLatencyMs,
    parserLatencyMs,
    llmTotals,
    layerMetrics,
    freezeBlockerCount: layerMetrics.freeze_blocker_count,
    openDecisionCount: layerMetrics.open_decision_count,
    persistence,
    clarificationQuestion: clarification.selection.next_question?.question ?? null,
    freezeRequest: freeze.result.freeze_request?.approval_question ?? null,
    reopenedScope: Boolean(previousWorkflowState?.finalized_requirement_memory_id && reduced.state.freeze_status.status !== "approved"),
  });

  return {
    response: buildCeoResponse({
      lifecycleStatus,
      state: reduced.state,
      stateCommitSummary,
      clarificationQuestion: clarification.selection.next_question?.question ?? null,
      freezeRequest: freeze.result.freeze_request?.approval_question ?? null,
      finalizedRequirementMemoryId: persistence.finalizedRequirementMemoryId,
      persistenceFailures: persistence.receipts.filter((receipt) => !receipt.success),
    }),
    provenance: responseProvenance,
    latency_ms: turnLatencyMs,
    session: parserSession,
    state_commit_summary: stateCommitSummary,
    open_loops: openLoops,
  };
}

async function handleParseFailure(input: {
  traceId: string;
  latestUserEvent: UserInputEvent;
  previousWorkflowState: Thread["workflowState"]["onion"];
  previousState: OnionState;
  previousWorkingArtifact: WorkingScopeArtifact;
  priorClarification: ReturnType<typeof selectNextClarificationQuestion>;
  llmCalls: OnionLlmCallRecordType[];
  responseProvenance: Provenance;
  parserSession: InvocationResult["session"];
  totalLatencyMs: number;
  input: {
    thread: Thread;
    store: FileSystemThreadStore;
    userMessage: string;
  };
}): Promise<RequirementsGatheringOnionResult> {
  const freeze = evaluateFreezeReadiness({
    trace_id: input.traceId,
    turn_id: input.latestUserEvent.id,
    state: input.previousState,
  });
  const fallbackTurn = buildOnionTurn(input.latestUserEvent, input.input.userMessage, OnionTurnUpdate.parse({}));
  const audit = buildAuditTrace({
    trace_id: input.traceId,
    turn: fallbackTurn,
    state: input.previousState,
    artifact_change_summary: ["No scope changes were applied."],
    clarification: input.priorClarification.selection,
    freeze: freeze.result,
  });

  emitOperationTelemetry([
    input.priorClarification.record,
    freeze.record,
    audit.record,
  ], input.traceId);

  const persistenceReceipts = [
    OnionPersistenceReceipt.parse({
      kind: "thread_workflow_state",
      target: "thread",
      status: "stored",
      artifact_kind: "working_scope",
      action: "persist_no_change",
      scope_path: input.input.thread.scopePath,
      duration_ms: 0,
      success: true,
      message: "Thread workflow state persisted without changing the onion state because turn parsing failed closed.",
    }),
  ];
  const llmTotals = summarizeLlmCalls(input.llmCalls);
  const layerMetrics = summarizeLayerMetrics({
    thread: input.input.thread,
    currentLayer: input.priorClarification.selection.current_layer,
    currentTurnLatencyMs: input.totalLatencyMs,
    clarificationQuestion: input.priorClarification.selection.next_question?.question ?? null,
    freezeBlockerCount: audit.trace.freeze_blockers.length,
    openDecisionCount: audit.trace.open_decisions_snapshot.filter((decision) => decision.status !== "resolved").length,
  });

  input.input.thread.workflowState = {
    active_workflow: "requirements_gathering_onion",
    onion: OnionWorkflowThreadState.parse({
      trace_id: input.traceId,
      last_turn_id: input.latestUserEvent.id,
      lifecycle_status: "active",
      current_layer: input.priorClarification.selection.current_layer,
      selected_next_question: input.priorClarification.selection.next_question?.question ?? null,
      no_question_reason: input.priorClarification.selection.no_question_reason,
      state: input.previousState,
      working_artifact: input.previousWorkingArtifact,
      requirement_artifact: input.previousWorkflowState?.requirement_artifact ?? null,
      finalized_requirement_memory_id: input.previousWorkflowState?.finalized_requirement_memory_id ?? null,
      latest_audit_trace: audit.trace,
      latest_llm_calls: input.llmCalls,
      latest_persistence_receipts: persistenceReceipts,
    }),
  };
  input.input.thread.events.push(createEvent("onion_turn_result", {
    trace_id: input.traceId,
    turn_id: input.latestUserEvent.id,
    lifecycle_status: "active",
    current_layer: input.priorClarification.selection.current_layer,
    turn_latency_ms: input.totalLatencyMs,
    parser_latency_ms: 0,
    llm_totals: llmTotals,
    layer_metrics: layerMetrics,
    state: input.previousState,
    working_artifact: input.previousWorkingArtifact,
    requirement_artifact: input.previousWorkflowState?.requirement_artifact ?? null,
    finalized_requirement_memory_id: input.previousWorkflowState?.finalized_requirement_memory_id ?? null,
    workflow_trace: audit.trace,
    operation_records: [
      input.priorClarification.record,
      freeze.record,
      audit.record,
    ],
    llm_calls: input.llmCalls,
    persistence_receipts: persistenceReceipts,
    state_commit_summary: "Requirements-gathering onion needs a clearer answer before the scope can move forward.",
    open_loops: [
      input.priorClarification.selection.next_question?.question
        ?? "Please restate the missing business meaning in plain terms so I can continue the onion truthfully.",
    ],
  }, input.responseProvenance));
  await input.input.store.update(input.input.thread);
  emitOnionTurnTelemetry({
    traceId: input.traceId,
    threadId: input.input.thread.id,
    turnId: input.latestUserEvent.id,
    scopePath: input.input.thread.scopePath,
    lifecycleStatus: "active",
    currentLayer: input.priorClarification.selection.current_layer,
    selectedNextQuestion: input.priorClarification.selection.next_question?.question ?? null,
    turnLatencyMs: input.totalLatencyMs,
    parserLatencyMs: 0,
    llmTotals,
    layerMetrics,
    freezeBlockerCount: layerMetrics.freeze_blocker_count,
    openDecisionCount: layerMetrics.open_decision_count,
    persistence: {
      finalizedRequirementMemoryId: input.previousWorkflowState?.finalized_requirement_memory_id ?? null,
      receipts: persistenceReceipts,
      telemetry: {
        finalized_requirement_create_ms: 0,
        finalized_requirement_lock_ms: 0,
        provisional_retire_ms: 0,
        supersede_ms: 0,
      },
    },
    clarificationQuestion: input.priorClarification.selection.next_question?.question ?? null,
    freezeRequest: freeze.result.freeze_request?.approval_question ?? null,
    reopenedScope: false,
    success: false,
    resultStatus: "parse_failed_closed",
  });

  const response = [
    "I could not safely map that message into the current requirements state without guessing.",
    input.priorClarification.selection.next_question?.question
      ?? "Please restate the missing business meaning in plain terms.",
  ].join("\n\n");

  return {
    response,
    provenance: input.responseProvenance,
    latency_ms: input.totalLatencyMs,
    session: input.parserSession,
    state_commit_summary: "Requirements-gathering onion needs a clearer answer before the scope can move forward.",
    open_loops: [
      input.priorClarification.selection.next_question?.question
        ?? "Please restate the missing business meaning in plain terms.",
    ],
  };
}

async function persistOnionArtifacts(input: {
  traceId: string;
  turnId: string;
  threadId: string;
  scopePath: string | null | undefined;
  previousWorkflowState: Thread["workflowState"]["onion"];
  reducedState: OnionState;
  requirementArtifact: RequirementArtifact | null;
  readinessStatus: "ready" | "blocked";
  config: Pick<
    ControllerConfig,
    "brainCreateFinalizedRequirementCandidate" | "brainManageMemory" | "brainPublishFinalizedRequirement"
  >;
}): Promise<{
  finalizedRequirementMemoryId: string | null;
  receipts: OnionPersistenceReceiptType[];
  telemetry: {
    finalized_requirement_create_ms: number;
    finalized_requirement_lock_ms: number;
    provisional_retire_ms: number;
    supersede_ms: number;
  };
}> {
  const receipts: OnionPersistenceReceiptType[] = [];
  let finalizedRequirementMemoryId = input.previousWorkflowState?.finalized_requirement_memory_id ?? null;
  const telemetry = {
    finalized_requirement_create_ms: 0,
    finalized_requirement_lock_ms: 0,
    provisional_retire_ms: 0,
    supersede_ms: 0,
  };

  if (
    input.previousWorkflowState?.finalized_requirement_memory_id
    && input.reducedState.freeze_status.status !== "approved"
  ) {
    if (!input.scopePath || !input.config.brainManageMemory) {
      receipts.push(OnionPersistenceReceipt.parse({
        kind: "superseded_requirement_retire",
        target: "memory_engine",
        status: "failed",
        artifact_kind: "requirement_list",
        action: "supersede",
        scope_path: input.scopePath ?? null,
        record_id: input.previousWorkflowState.finalized_requirement_memory_id,
        duration_ms: 0,
        success: false,
        message: "Could not retire the previously finalized requirement artifact after the scope reopened.",
      }));
      finalizedRequirementMemoryId = null;
    } else {
      const supersedeStartedAt = Date.now();
      try {
        const retireReceipt = await input.config.brainManageMemory(
          "supersede",
          input.previousWorkflowState.finalized_requirement_memory_id,
          input.scopePath,
          createSystemProvenance(`COO/requirements-gathering/live/supersede-finalized-requirement/${input.traceId}/${input.turnId}`),
          {
            reason: "Superseded by a reopened requirements onion scope.",
            telemetry_context: buildBrainTelemetryContext(input),
          },
        );
        assertSuccessfulMemoryManageMutation(
          retireReceipt,
          "Could not retire the previously finalized requirement artifact after the scope reopened.",
        );
        receipts.push(OnionPersistenceReceipt.parse({
          kind: "superseded_requirement_retire",
          target: "memory_engine",
          status: "superseded",
          artifact_kind: "requirement_list",
          action: "supersede",
          scope_path: input.scopePath,
          record_id: input.previousWorkflowState.finalized_requirement_memory_id,
          duration_ms: Date.now() - supersedeStartedAt,
          success: true,
          message: "Retired the previously finalized requirement artifact because the scope reopened.",
        }));
        telemetry.supersede_ms = Date.now() - supersedeStartedAt;
        finalizedRequirementMemoryId = null;
      } catch (error) {
        telemetry.supersede_ms = Date.now() - supersedeStartedAt;
        receipts.push(OnionPersistenceReceipt.parse({
          kind: "superseded_requirement_retire",
          target: "memory_engine",
          status: "failed",
          artifact_kind: "requirement_list",
          action: "supersede",
          scope_path: input.scopePath,
          record_id: input.previousWorkflowState.finalized_requirement_memory_id,
          duration_ms: telemetry.supersede_ms,
          success: false,
          message: error instanceof Error ? error.message : String(error),
        }));
        finalizedRequirementMemoryId = null;
      }
    }
  }

  if (
    input.reducedState.freeze_status.status !== "approved"
    || input.readinessStatus !== "ready"
    || !input.requirementArtifact
  ) {
    return {
      finalizedRequirementMemoryId,
      receipts,
      telemetry,
    };
  }

  if (!input.scopePath) {
    receipts.push(OnionPersistenceReceipt.parse({
      kind: "finalized_requirement_create",
      target: "memory_engine",
      status: "failed",
      artifact_kind: "requirement_list",
      action: "create",
      scope_path: null,
      duration_ms: 0,
      success: false,
      message: "Cannot persist the finalized requirement artifact without an explicit scope.",
    }));
    return {
      finalizedRequirementMemoryId: null,
      receipts,
      telemetry,
    };
  }

  if (!input.config.brainCreateFinalizedRequirementCandidate) {
    receipts.push(OnionPersistenceReceipt.parse({
      kind: "finalized_requirement_create",
      target: "memory_engine",
      status: "failed",
      artifact_kind: "requirement_list",
      action: "create",
      scope_path: input.scopePath,
      duration_ms: 0,
      success: false,
      message: "The governed requirement persistence route is not connected.",
    }));
    return {
      finalizedRequirementMemoryId: null,
      receipts,
      telemetry,
    };
  }

  if (!input.config.brainPublishFinalizedRequirement) {
    receipts.push(OnionPersistenceReceipt.parse({
      kind: "finalized_requirement_create",
      target: "memory_engine",
      status: "skipped",
      artifact_kind: "requirement_list",
      action: "create",
      scope_path: input.scopePath,
      duration_ms: 0,
      success: false,
      message: "Skipped finalized requirement creation because the memory-manage route is not connected, so the artifact cannot be locked truthfully.",
    }));
    return {
      finalizedRequirementMemoryId: null,
      receipts,
      telemetry,
    };
  }

  if (!input.config.brainManageMemory) {
    receipts.push(OnionPersistenceReceipt.parse({
      kind: "finalized_requirement_create",
      target: "memory_engine",
      status: "skipped",
      artifact_kind: "requirement_list",
      action: "create",
      scope_path: input.scopePath,
      duration_ms: 0,
      success: false,
      message: "Skipped finalized requirement creation because the memory-manage route is not connected, so failed publish cleanup would not be truthful.",
    }));
    return {
      finalizedRequirementMemoryId: null,
      receipts,
      telemetry,
    };
  }

  let provisionalFinalizedRequirementMemoryId: string | null = null;
  const createStartedAt = Date.now();
  try {
    const createReceipt = await input.config.brainCreateFinalizedRequirementCandidate(
      `Finalized requirements: ${input.requirementArtifact.human_scope.topic}`,
      {
        artifact_kind: input.requirementArtifact.artifact_kind,
        trace_id: input.traceId,
        source_approval_turn_id: input.requirementArtifact.source_approval_turn_id,
        artifact: input.requirementArtifact,
      },
      ["requirements-gathering", "onion", "finalized-requirement-list", "coo-owned"],
      input.scopePath,
      createSystemProvenance(`COO/requirements-gathering/live/finalized-requirement-create/${input.traceId}/${input.turnId}`),
      buildBrainTelemetryContext(input),
    );
    provisionalFinalizedRequirementMemoryId = typeof createReceipt.id === "string" ? createReceipt.id : null;
    telemetry.finalized_requirement_create_ms = Date.now() - createStartedAt;
    receipts.push(OnionPersistenceReceipt.parse({
      kind: "finalized_requirement_create",
      target: "memory_engine",
      status: provisionalFinalizedRequirementMemoryId ? "created" : "failed",
      artifact_kind: "requirement_list",
      action: "create",
      scope_path: input.scopePath,
      record_id: provisionalFinalizedRequirementMemoryId,
      duration_ms: telemetry.finalized_requirement_create_ms,
      success: Boolean(provisionalFinalizedRequirementMemoryId),
      message: provisionalFinalizedRequirementMemoryId
        ? "Persisted the finalized requirement artifact through the governed requirements surface."
        : "The governed requirements surface did not return an artifact id.",
    }));
  } catch (error) {
    telemetry.finalized_requirement_create_ms = Date.now() - createStartedAt;
    receipts.push(OnionPersistenceReceipt.parse({
      kind: "finalized_requirement_create",
      target: "memory_engine",
      status: "failed",
      artifact_kind: "requirement_list",
      action: "create",
      scope_path: input.scopePath,
      duration_ms: telemetry.finalized_requirement_create_ms,
      success: false,
      message: error instanceof Error ? error.message : String(error),
    }));
    return {
      finalizedRequirementMemoryId: null,
      receipts,
      telemetry,
    };
  }

  if (!provisionalFinalizedRequirementMemoryId) {
    return {
      finalizedRequirementMemoryId: null,
      receipts,
      telemetry,
    };
  }

  const lockStartedAt = Date.now();
  try {
    const lockReceipt = await input.config.brainPublishFinalizedRequirement(
      provisionalFinalizedRequirementMemoryId,
      input.scopePath,
      createSystemProvenance(`COO/requirements-gathering/live/finalized-requirement-lock/${input.traceId}/${input.turnId}`),
      {
        reason: "Approved requirements artifact must become durable COO-owned truth for downstream use.",
        telemetry_context: buildBrainTelemetryContext(input),
      },
    );
    assertSuccessfulMemoryManageMutation(
      lockReceipt,
      "The memory-manage route did not lock the finalized requirement artifact.",
    );
    receipts.push(OnionPersistenceReceipt.parse({
      kind: "finalized_requirement_lock",
      target: "memory_engine",
      status: "locked",
      artifact_kind: "requirement_list",
      action: "publish_finalized_requirement",
      scope_path: input.scopePath,
      record_id: provisionalFinalizedRequirementMemoryId,
      duration_ms: Date.now() - lockStartedAt,
      success: true,
      message: "Locked the finalized requirement artifact after approved freeze.",
    }));
    telemetry.finalized_requirement_lock_ms = Date.now() - lockStartedAt;
    finalizedRequirementMemoryId = provisionalFinalizedRequirementMemoryId;
  } catch (error) {
    telemetry.finalized_requirement_lock_ms = Date.now() - lockStartedAt;
    receipts.push(OnionPersistenceReceipt.parse({
      kind: "finalized_requirement_lock",
      target: "memory_engine",
      status: "failed",
      artifact_kind: "requirement_list",
      action: "publish_finalized_requirement",
      scope_path: input.scopePath,
      record_id: provisionalFinalizedRequirementMemoryId,
      duration_ms: telemetry.finalized_requirement_lock_ms,
      success: false,
      message: error instanceof Error ? error.message : String(error),
    }));
    const provisionalRetire = await retireProvisionalFinalizedRequirement({
      traceId: input.traceId,
      turnId: input.turnId,
      threadId: input.threadId,
      scopePath: input.scopePath,
      memoryId: provisionalFinalizedRequirementMemoryId,
      brainManageMemory: input.config.brainManageMemory,
    });
    telemetry.provisional_retire_ms = provisionalRetire.duration_ms;
    receipts.push(provisionalRetire);
    finalizedRequirementMemoryId = null;
  }

  return {
    finalizedRequirementMemoryId,
    receipts,
    telemetry,
  };
}

function assertSuccessfulMemoryManageMutation(
  receipt: Record<string, unknown>,
  failurePrefix: string,
): void {
  const success = receipt.success === true;
  const status = typeof receipt.status === "string" ? receipt.status : "unknown";
  const affectedRows = typeof receipt.affected_rows === "number" ? receipt.affected_rows : 0;
  if (success && affectedRows > 0) {
    return;
  }

  const reason = typeof receipt.reason === "string" && receipt.reason.trim().length > 0
    ? receipt.reason.trim()
    : null;
  const detail = [`status=${status}`, `affected_rows=${affectedRows}`];
  if (reason) {
    detail.push(`reason=${reason}`);
  }
  throw new Error(`${failurePrefix} (${detail.join(", ")})`);
}

function buildBrainTelemetryContext(input: {
  traceId: string;
  turnId: string;
  threadId: string;
  scopePath: string | null | undefined;
}): Record<string, unknown> {
  return {
    trace_id: input.traceId,
    turn_id: input.turnId,
    thread_id: input.threadId,
    scope_path: input.scopePath ?? null,
    workflow: "requirements_gathering_onion",
  };
}

async function retireProvisionalFinalizedRequirement(input: {
  traceId: string;
  turnId: string;
  threadId: string;
  scopePath: string;
  memoryId: string;
  brainManageMemory: NonNullable<ControllerConfig["brainManageMemory"]>;
}): Promise<OnionPersistenceReceiptType> {
  const startedAt = Date.now();
  try {
    const retireReceipt = await input.brainManageMemory(
      "archive",
      input.memoryId,
      input.scopePath,
      createSystemProvenance(`COO/requirements-gathering/live/finalized-requirement-retire/${input.traceId}/${input.turnId}`),
      {
        reason: "Retire provisional finalized requirement after durable lock failure.",
        telemetry_context: buildBrainTelemetryContext(input),
      },
    );
    assertSuccessfulMemoryManageMutation(
      retireReceipt,
      "Could not retire the provisional finalized requirement artifact after the durable lock step failed.",
    );
    return OnionPersistenceReceipt.parse({
      kind: "provisional_finalized_requirement_retire",
      target: "memory_engine",
      status: "archived",
      artifact_kind: "requirement_list",
      action: "archive",
      scope_path: input.scopePath,
      record_id: input.memoryId,
      duration_ms: Date.now() - startedAt,
      success: true,
      message: "Retired the provisional finalized requirement artifact after the durable lock step failed.",
    });
  } catch (error) {
    return OnionPersistenceReceipt.parse({
      kind: "provisional_finalized_requirement_retire",
      target: "memory_engine",
      status: "failed",
      artifact_kind: "requirement_list",
      action: "archive",
      scope_path: input.scopePath,
      record_id: input.memoryId,
      duration_ms: Date.now() - startedAt,
      success: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function buildOnionTurn(userEvent: UserInputEvent, userMessage: string, update: z.infer<typeof OnionTurnUpdate>): OnionTurn {
  return {
    turn_id: userEvent.id,
    timestamp: userEvent.timestamp,
    actor: "ceo",
    summary: clipSummary(userMessage),
    update,
  };
}

function buildOnionTurnParserPrompt(input: {
  userMessage: string;
  currentWorkflowState: Thread["workflowState"]["onion"];
  workingArtifact: ReturnType<typeof buildWorkingScopeArtifact>;
  currentLayer: string;
  currentQuestion: string | null;
}): string {
  const majorParts = input.currentWorkflowState?.state.major_parts ?? [];
  const openDecisions = input.currentWorkflowState?.state.open_decisions ?? [];

  return `You convert one CEO message into a structured requirements-gathering onion update.
Return JSON only. The JSON must match this shape:
{
  "topic"?: string,
  "goal"?: string,
  "expected_result"?: string,
  "success_view"?: string,
  "major_parts"?: [{ "id": string, "label": string, "summary"?: string, "order"?: number }],
  "part_clarifications"?: [{ "part_id": string, "detail": string, "questions_answered"?: string[] }],
  "experience_ui"?: {
    "relevant"?: boolean | null,
    "summary"?: string,
    "preview_status"?: "not_needed" | "needed" | "preview_proposed" | "preview_approved",
    "preview_artifact"?: string,
    "approval_notes"?: string
  },
  "boundaries"?: [{ "id": string, "kind": "constraint" | "non_goal" | "assumption", "statement": string }],
  "open_decisions"?: [{ "id": string, "question": string, "impact": string, "status": "open" | "resolved", "resolution"?: string }],
  "resolve_open_decisions"?: [{ "id": string, "resolution": string }],
  "freeze_response"?: { "action": "approve" | "reject", "note"?: string }
}

Rules:
- Capture only business meaning that is explicit in the CEO message.
- Do not infer missing product decisions.
- Preserve the CEO's wording as closely as possible.
- If the CEO approves freezing the whole onion, set freeze_response.action = "approve".
- If the CEO rejects or corrects the freeze request, set freeze_response.action = "reject".
- If the CEO resolves an existing open decision, prefer resolve_open_decisions with the existing id.
- For new ids, create stable snake_case ids from the visible phrase.
- It is acceptable to return {} when the message does not safely add scope truth.

Current onion layer:
${input.currentLayer}

Current business question:
${input.currentQuestion ?? "none"}

Current working scope:
${input.workingArtifact.scope_summary.join("\n")}

Known major parts:
${majorParts.length > 0 ? majorParts.map((part) => `- ${part.id}: ${part.label}`).join("\n") : "- none yet"}

Known open decisions:
${openDecisions.length > 0 ? openDecisions.map((decision) => `- ${decision.id}: ${decision.question} (${decision.status})`).join("\n") : "- none"}

<ceo_message>
${input.userMessage}
</ceo_message>

JSON only:`;
}

function parseOnionTurnUpdate(raw: string): z.infer<typeof OnionTurnUpdate> {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return ParserResponse.parse(JSON.parse(cleaned));
}

function buildLifecycleStatus(input: {
  freezeStatus: "draft" | "ready_to_request" | "approved" | "blocked";
  readinessStatus: "ready" | "blocked";
  persistenceFailures: boolean;
  finalizedRequirementMemoryId: string | null;
}): OnionWorkflowLifecycleStatusType {
  if (input.persistenceFailures) {
    return "blocked";
  }
  if (input.readinessStatus === "ready" && input.finalizedRequirementMemoryId) {
    return "handoff_ready";
  }
  if (input.freezeStatus === "approved") {
    return "approved";
  }
  if (input.freezeStatus === "ready_to_request") {
    return "awaiting_freeze_approval";
  }
  return "active";
}

function buildStateCommitSummary(input: {
  lifecycleStatus: OnionWorkflowLifecycleStatusType;
  finalizedRequirementMemoryId: string | null;
  persistenceFailures: OnionPersistenceReceiptType[];
}): string {
  if (input.persistenceFailures.length > 0) {
    return "Requirements-gathering onion froze the human scope, but durable artifact persistence is blocked and handoff is not truthful yet.";
  }
  if (input.lifecycleStatus === "handoff_ready") {
    return `Requirements-gathering onion is frozen and the finalized requirement artifact is durably stored as ${input.finalizedRequirementMemoryId}.`;
  }
  if (input.lifecycleStatus === "awaiting_freeze_approval") {
    return "Requirements-gathering onion is ready for explicit whole-onion freeze approval.";
  }
  if (input.lifecycleStatus === "approved") {
    return "Requirements-gathering onion has explicit freeze approval.";
  }
  return "Requirements-gathering onion advanced without silently freezing.";
}

function buildOpenLoops(input: {
  clarificationQuestion: string | null;
  freezeRequest: string | null;
  persistenceFailures: OnionPersistenceReceiptType[];
}): string[] {
  if (input.persistenceFailures.length > 0) {
    return input.persistenceFailures.map((receipt) => receipt.message);
  }
  if (input.freezeRequest) {
    return [input.freezeRequest];
  }
  if (input.clarificationQuestion) {
    return [input.clarificationQuestion];
  }
  return [];
}

function buildCeoResponse(input: {
  lifecycleStatus: OnionWorkflowLifecycleStatusType;
  state: OnionState;
  stateCommitSummary: string;
  clarificationQuestion: string | null;
  freezeRequest: string | null;
  finalizedRequirementMemoryId: string | null;
  persistenceFailures: OnionPersistenceReceiptType[];
}): string {
  return renderConversationResponse(deriveConversationState({
    lifecycleStatus: input.lifecycleStatus,
    state: input.state,
    clarificationQuestion: input.clarificationQuestion,
    freezeRequest: input.freezeRequest,
    finalizedRequirementMemoryId: input.finalizedRequirementMemoryId,
    persistenceFailures: input.persistenceFailures,
    stateCommitSummary: input.stateCommitSummary,
  }));
}

function buildLlmCallRecordFromResult(
  traceId: string,
  turnId: string,
  purpose: string,
  result: InvocationResult,
): OnionLlmCallRecordType {
  return OnionLlmCallRecord.parse({
    trace_id: traceId,
    turn_id: turnId,
    provider: result.provenance.provider,
    model: result.provenance.model,
    purpose,
    latency_ms: Math.max(0, Math.round(result.latency_ms)),
    tokens_in: result.usage?.tokens_in_estimated ?? 0,
    tokens_out: result.usage?.tokens_out_estimated ?? 0,
    estimated_cost_usd: result.usage?.estimated_cost_usd,
    fallback_used: result.provenance.was_fallback,
    success: true,
  });
}

function buildLlmCallRecordFromFailure(
  traceId: string,
  turnId: string,
  purpose: string,
  error: unknown,
): OnionLlmCallRecordType | null {
  const attempts = extractAttempts(error);
  const lastAttempt = attempts.at(-1);
  if (!lastAttempt) {
    return null;
  }

  return OnionLlmCallRecord.parse({
    trace_id: traceId,
    turn_id: turnId,
    provider: lastAttempt.provenance.provider,
    model: lastAttempt.provenance.model,
    purpose,
    latency_ms: Math.max(0, Math.round(lastAttempt.latency_ms)),
    tokens_in: lastAttempt.usage?.tokens_in_estimated ?? 0,
    tokens_out: lastAttempt.usage?.tokens_out_estimated ?? 0,
    estimated_cost_usd: lastAttempt.usage?.estimated_cost_usd,
    fallback_used: lastAttempt.provenance.was_fallback,
    success: false,
  });
}

function extractAttempts(error: unknown): InvocationAttempt[] {
  if (
    error
    && typeof error === "object"
    && "attempts" in error
    && Array.isArray((error as { attempts?: unknown[] }).attempts)
  ) {
    return (error as { attempts: InvocationAttempt[] }).attempts;
  }
  return [];
}

function emitOperationTelemetry(
  records: Array<{
    trace_id: string;
    turn_id: string;
    operation: string;
    duration_ms: number;
    success: boolean;
    input_summary: Record<string, unknown>;
    output_summary: Record<string, unknown>;
    error_code?: string;
    error_message?: string;
  }>,
  traceId: string,
): void {
  records.forEach((record) => {
    emit({
      provenance: createSystemProvenance(`COO/requirements-gathering/live/${record.operation}/${traceId}`),
      category: "system",
      operation: record.operation,
      latency_ms: record.duration_ms,
      success: record.success,
      metadata: {
        trace_id: record.trace_id,
        turn_id: record.turn_id,
        route_stage: "requirements_gathering_onion",
        input_summary: record.input_summary,
        output_summary: record.output_summary,
        error_code: record.error_code ?? null,
        error_message: record.error_message ?? null,
      },
    });
  });
}

function summarizeLlmCalls(llmCalls: OnionLlmCallRecordType[]): {
  tokens_in: number;
  tokens_out: number;
  estimated_cost_usd: number | null;
} {
  let estimatedCostUsd = 0;
  let hasCost = false;

  for (const call of llmCalls) {
    if (typeof call.estimated_cost_usd === "number") {
      estimatedCostUsd += call.estimated_cost_usd;
      hasCost = true;
    }
  }

  return {
    tokens_in: llmCalls.reduce((sum, call) => sum + call.tokens_in, 0),
    tokens_out: llmCalls.reduce((sum, call) => sum + call.tokens_out, 0),
    estimated_cost_usd: hasCost ? Number(estimatedCostUsd.toFixed(6)) : null,
  };
}

function summarizeLayerMetrics(input: {
  thread: Thread;
  currentLayer: string;
  currentTurnLatencyMs: number;
  clarificationQuestion: string | null;
  freezeBlockerCount: number;
  openDecisionCount: number;
}): {
  turns_in_current_layer: number;
  time_in_current_layer_ms: number;
  clarification_turn_count_total: number;
  freeze_blocker_count: number;
  open_decision_count: number;
} {
  const priorOnionResults = input.thread.events.filter((event) => event.type === "onion_turn_result");
  const priorSameLayer = priorOnionResults.filter((event) => event.data.current_layer === input.currentLayer);
  const priorTimeInLayerMs = priorSameLayer.reduce((sum, event) => sum + (event.data.turn_latency_ms ?? 0), 0);
  const priorClarificationCount = priorOnionResults.reduce((sum, event) => (
    event.data.workflow_trace.selected_next_question ? sum + 1 : sum
  ), 0);

  return {
    turns_in_current_layer: priorSameLayer.length + 1,
    time_in_current_layer_ms: priorTimeInLayerMs + input.currentTurnLatencyMs,
    clarification_turn_count_total: priorClarificationCount + (input.clarificationQuestion ? 1 : 0),
    freeze_blocker_count: input.freezeBlockerCount,
    open_decision_count: input.openDecisionCount,
  };
}

function emitOnionTurnTelemetry(input: {
  traceId: string;
  threadId: string;
  turnId: string;
  scopePath: string | null | undefined;
  lifecycleStatus: OnionWorkflowLifecycleStatusType;
  currentLayer: string;
  selectedNextQuestion: string | null;
  turnLatencyMs: number;
  parserLatencyMs: number;
  llmTotals: {
    tokens_in: number;
    tokens_out: number;
    estimated_cost_usd: number | null;
  };
  layerMetrics: {
    turns_in_current_layer: number;
    time_in_current_layer_ms: number;
    clarification_turn_count_total: number;
    freeze_blocker_count: number;
    open_decision_count: number;
  };
  freezeBlockerCount: number;
  openDecisionCount: number;
  persistence: {
    finalizedRequirementMemoryId: string | null;
    receipts: OnionPersistenceReceiptType[];
    telemetry: {
      finalized_requirement_create_ms: number;
      finalized_requirement_lock_ms: number;
      provisional_retire_ms: number;
      supersede_ms: number;
    };
  };
  clarificationQuestion: string | null;
  freezeRequest: string | null;
  reopenedScope: boolean;
  success?: boolean;
  resultStatus?: string;
}): void {
  emit({
    provenance: createSystemProvenance(`COO/requirements-gathering/live/onion-turn/${input.traceId}/${input.turnId}`),
    category: "turn",
    operation: "onion_turn",
    latency_ms: input.turnLatencyMs,
    success: input.success ?? true,
    metadata: {
      thread_id: input.threadId,
      scope_path: input.scopePath ?? null,
      workflow: "requirements_gathering_onion",
      trace_id: input.traceId,
      turn_id: input.turnId,
      route_stage: "requirements_gathering_onion",
      current_layer: input.currentLayer,
      next_layer: input.selectedNextQuestion ? input.currentLayer : null,
      selected_next_question: input.selectedNextQuestion,
      lifecycle_status: input.lifecycleStatus,
      result_status: input.resultStatus ?? input.lifecycleStatus,
      parser_latency_ms: input.parserLatencyMs,
      llm_tokens_in: input.llmTotals.tokens_in,
      llm_tokens_out: input.llmTotals.tokens_out,
      llm_estimated_cost_usd: input.llmTotals.estimated_cost_usd,
      turns_in_current_layer: input.layerMetrics.turns_in_current_layer,
      time_in_current_layer_ms: input.layerMetrics.time_in_current_layer_ms,
      clarification_turn_count_total: input.layerMetrics.clarification_turn_count_total,
      clarification_requested: Boolean(input.clarificationQuestion),
      freeze_request_present: Boolean(input.freezeRequest),
      freeze_blocker_count: input.freezeBlockerCount,
      open_decision_count: input.openDecisionCount,
      finalized_requirement_memory_id: input.persistence.finalizedRequirementMemoryId,
      finalized_requirement_create_ms: input.persistence.telemetry.finalized_requirement_create_ms,
      finalized_requirement_lock_ms: input.persistence.telemetry.finalized_requirement_lock_ms,
      provisional_retire_ms: input.persistence.telemetry.provisional_retire_ms,
      supersede_ms: input.persistence.telemetry.supersede_ms,
      persistence_failure_count: input.persistence.receipts.filter((receipt) => !receipt.success).length,
      persistence_receipt_kinds: input.persistence.receipts.map((receipt) => receipt.kind),
      reopened_scope: input.reopenedScope,
    },
  });
}

function clipSummary(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length <= 180) {
    return trimmed;
  }
  return `${trimmed.slice(0, 177)}...`;
}

function getLatestUserEvent(thread: Thread): UserInputEvent | null {
  for (let index = thread.events.length - 1; index >= 0; index -= 1) {
    const event = thread.events[index];
    if (event.type === "user_input") {
      return event;
    }
  }
  return null;
}

function invokeLlm(
  config: Pick<ControllerConfig, "intelligenceParams" | "invokeLLM">,
  params: InvocationParams,
): Promise<InvocationResult> {
  return (config.invokeLLM ?? invoke)(params);
}

function toArray<T>(value: T | null): T[] {
  return value ? [value] : [];
}
