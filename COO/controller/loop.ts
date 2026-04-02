import {
  createEvent,
  FileSystemThreadStore,
  consecutiveErrors,
  getLatestSessionHandles,
  type Thread,
  type ThreadEvent,
} from "./thread.js";
import {
  assembleContext,
  buildPrompt,
  type ContextEngineerConfig,
  type BrainSearchResult,
} from "../context-engineer/context-engineer.js";
import {
  buildClassifierPrompt,
  parseClassifierResponse,
  type ClassifierOutput,
} from "../classifier/classifier.js";
import { invoke } from "../../shared/llm-invoker/invoker.js";
import { createSystemProvenance, type Provenance } from "../../shared/provenance/types.js";
import { emit, hasConfiguredSink } from "../../shared/telemetry/collector.js";
import type { InvocationParams, InvocationResult } from "../../shared/llm-invoker/types.js";
import { handleRequirementsGatheringOnion } from "../requirements-gathering/live/onion-live.js";

/**
 * COO Controller Loop — the stateless reducer.
 */

export interface ControllerConfig {
  projectRoot: string;
  threadsDir: string;
  promptsDir: string;
  memoryDir: string;
  classifierParams: Omit<InvocationParams, "prompt" | "source_path">;
  intelligenceParams: Omit<InvocationParams, "prompt" | "source_path">;
  brainSearch?: (
    query: string,
    scopePath: string,
    provenance: Provenance,
    options?: {
      contentType?: string;
      contentTypes?: string[];
      trustLevels?: string[];
      maxResults?: number;
    }
  ) => Promise<BrainSearchResult[]>;
  brainCapture?: (content: string, contentType: string, tags: string[], scopePath: string, provenance: Provenance) => Promise<Record<string, unknown>>;
  brainLogDecision?: (
    title: string,
    reasoning: string,
    alternatives: unknown[],
    scopePath: string,
    provenance: Provenance,
    contentProvenance?: Provenance
  ) => Promise<Record<string, unknown>>;
  brainCreateRule?: (title: string, body: string, tags: string[], scopePath: string, provenance: Provenance) => Promise<Record<string, unknown>>;
  brainCreateRequirement?: (
    title: string,
    body: Record<string, unknown>,
    tags: string[],
    scopePath: string,
    provenance: Provenance
  ) => Promise<Record<string, unknown>>;
  brainManageMemory?: (
    action: "delete" | "archive" | "update_tags" | "update_trust_level",
    memoryId: string,
    scopePath: string,
    provenance: Provenance,
    options?: {
      tags?: string[];
      trust_level?: "working" | "reviewed" | "locked";
      reason?: string;
    }
  ) => Promise<Record<string, unknown>>;
  enableRequirementsGatheringOnion?: boolean;
  invokeLLM?: (params: InvocationParams) => Promise<InvocationResult>;
  maxConsecutiveErrors?: number;
}

export const DEFAULT_CLASSIFIER_PARAMS: Omit<InvocationParams, "prompt" | "source_path"> = {
  cli: "codex",
  model: "gpt-5.3-codex-spark",
  reasoning: "medium",
  sandbox: "read-only",
  timeout_ms: 60_000,
  fallback: { cli: "claude", model: "haiku", effort: "medium", bypass: false },
};

export const DEFAULT_INTELLIGENCE_PARAMS: Omit<InvocationParams, "prompt" | "source_path"> = {
  cli: "codex",
  model: "gpt-5.4",
  reasoning: "xhigh",
  bypass: true,
  timeout_ms: 120_000,
  fallback: { cli: "claude", model: "opus", effort: "max", bypass: true },
};

export async function handleTurn(
  threadId: string | null,
  userMessage: string,
  config: ControllerConfig,
  requestedScopePath: string | null = null
): Promise<{ threadId: string; response: string; thread: Thread }> {
  if (!hasConfiguredSink()) {
    throw new Error("COO controller telemetry sink is not configured. Use the supported CLI/runtime bootstrap before handling turns.");
  }

  const turnStart = Date.now();
  const store = new FileSystemThreadStore(config.threadsDir);
  const controllerProv = createSystemProvenance("COO/controller/handle-turn");

  let thread: Thread;
  if (threadId) {
    thread = await store.get(threadId);
    if (requestedScopePath && thread.scopePath && requestedScopePath !== thread.scopePath) {
      throw new Error(`Thread scope mismatch: thread is scoped to "${thread.scopePath}", but "${requestedScopePath}" was requested.`);
    }
    if (!thread.scopePath && requestedScopePath) {
      thread.scopePath = requestedScopePath;
      await store.update(thread);
    }
  } else {
    thread = await store.create(requestedScopePath);
  }

  const maxErrors = config.maxConsecutiveErrors ?? 3;
  const errorStreak = consecutiveErrors(thread);
  if (errorStreak >= maxErrors) {
    thread.events.push(createEvent("user_input", { message: userMessage }, controllerProv));
    const escalation = `I've hit ${maxErrors} consecutive errors. Escalating to you for guidance.`;
    thread.events.push(createEvent("coo_response", { message: escalation }, controllerProv));
    await store.update(thread);
    return { threadId: thread.id, response: escalation, thread };
  }

  thread.events.push(createEvent("user_input", { message: userMessage }, controllerProv));
  thread.status = "active";
  await store.update(thread);

  if (
    thread.workflowState.active_workflow === "requirements_gathering_onion"
    && !config.enableRequirementsGatheringOnion
  ) {
    const response =
      "This thread is already in requirements-gathering onion mode, but the live onion feature gate is disabled. Re-run with --enable-onion or set ADF_ENABLE_REQUIREMENTS_GATHERING_ONION=1 to continue it truthfully.";
    thread.events.push(createEvent("error", {
      source: "controller",
      message: response,
      recoverable: true,
      attemptNumber: 1,
    }, controllerProv));
    thread.events.push(createEvent("coo_response", { message: response }, controllerProv));
    thread.events.push(createEvent("state_commit", {
      summary: "Blocked turn because the active onion workflow gate is disabled.",
      openLoops: [response],
      decisions: collectDecisionSummaries(thread),
      sessionHandles: getLatestSessionHandles(thread),
    }, controllerProv));
    await store.update(thread);

    emit({
      provenance: controllerProv,
      category: "turn",
      operation: "handle_turn",
      latency_ms: Date.now() - turnStart,
      success: false,
      metadata: {
        workflow: "requirements_gathering_onion",
        thread_id: thread.id,
        scope_path: thread.scopePath,
        gate_status: "disabled",
      },
    });

    return { threadId: thread.id, response, thread };
  }

  let classifierMs = 0;
  let intelligenceMs = 0;

  try {
    const sessionHandles = getLatestSessionHandles(thread);

    // Step 1: Classify intent
    const recentEvents = thread.events.slice(-5);
    const recentContext = [
      summarizeWorkflowRoutingContext(thread),
      ...recentEvents.map((event) => summarizeEventForClassifier(event)),
    ]
      .filter((value): value is string => Boolean(value))
      .join("\n");

    const classifierPrompt = buildClassifierPrompt(userMessage, recentContext, {
      onionEnabled: config.enableRequirementsGatheringOnion,
      currentWorkflow: thread.workflowState.active_workflow,
    });
    const classifierResult = await callLlm(config, {
      ...config.classifierParams,
      prompt: classifierPrompt,
      source_path: `COO/classifier/classify/${thread.id}`,
      session: {
        persist: true,
        handle: compatibleSessionHandle(
          sessionHandles.classifier,
          config.classifierParams.cli,
          config.classifierParams.model
        ),
      },
    });
    classifierMs = classifierResult.latency_ms;

    const classification = parseClassifierResponse(classifierResult.response);

    thread.events.push(
      createEvent("classifier_result", {
        intent: classification.intent,
        confidence: classification.confidence,
        workflow: classification.workflow,
        reasoning: classification.reasoning,
      }, classifierResult.provenance)
    );
    await store.update(thread);

    // Step 2: Execute workflow
    let response: string;
    let intelligenceProv: Provenance = controllerProv;
    let intelligenceSession = sessionHandles.intelligence ?? null;
    let stateCommitSummary: string | null = null;
    let openLoops: string[] | null = null;

    switch (classification.workflow) {
      case "memory_operation": {
        const memoryResult = await handleMemoryOperation(
          classification,
          userMessage,
          thread,
          store,
          config,
          classifierResult.provenance,
          compatibleSessionHandle(
            sessionHandles.intelligence,
            config.intelligenceParams.cli,
            config.intelligenceParams.model
          ),
          thread.scopePath
        );
        response = memoryResult.response;
        intelligenceSession = memoryResult.intelligenceSession ?? intelligenceSession;
        break;
      }

      case "clarification":
        response = await handleClarification(classification, thread, controllerProv);
        break;

      case "requirements_gathering_onion": {
        if (!config.enableRequirementsGatheringOnion) {
          response =
            "Requirements-gathering onion is disabled for this runtime. Re-run with --enable-onion or set ADF_ENABLE_REQUIREMENTS_GATHERING_ONION=1 before entering the live onion lane.";
          intelligenceProv = controllerProv;
          openLoops = [response];
          stateCommitSummary = "Rejected onion routing because the feature gate is disabled.";
          break;
        }

        const onionResult = await handleRequirementsGatheringOnion({
          userMessage,
          thread,
          store,
          config,
          sessionHandle: compatibleSessionHandle(
            sessionHandles.intelligence,
            config.intelligenceParams.cli,
            config.intelligenceParams.model
          ),
        });
        response = onionResult.response;
        intelligenceProv = onionResult.provenance;
        intelligenceMs = onionResult.latency_ms;
        intelligenceSession = onionResult.session?.handle ?? intelligenceSession;
        stateCommitSummary = onionResult.state_commit_summary;
        openLoops = onionResult.open_loops;
        break;
      }

      case "direct_coo_response":
      case "pushback":
      default: {
        const cooResult = await handleCooResponse(
          userMessage,
          thread,
          config,
          compatibleSessionHandle(
            sessionHandles.intelligence,
            config.intelligenceParams.cli,
            config.intelligenceParams.model
          ),
          thread.scopePath
        );
        response = cooResult.response;
        intelligenceProv = cooResult.provenance;
        intelligenceMs = cooResult.latency_ms;
        intelligenceSession = cooResult.session?.handle ?? intelligenceSession;
        break;
      }
    }

    // Step 3: Append response and commit
    thread.events.push(createEvent("coo_response", { message: response }, intelligenceProv));
    thread.events.push(createEvent("state_commit", {
      summary: stateCommitSummary ?? buildStateCommitSummary(classification.workflow, response),
      openLoops: openLoops ?? buildOpenLoops(classification.workflow, response),
      decisions: collectDecisionSummaries(thread),
      sessionHandles: {
        classifier: classifierResult.session?.handle ?? sessionHandles.classifier ?? null,
        intelligence: intelligenceSession,
      },
    }, controllerProv));
    await store.update(thread);

    // Emit turn telemetry
    emit({
      provenance: controllerProv,
      category: "turn",
      operation: "handle_turn",
      latency_ms: Date.now() - turnStart,
      success: true,
      classifier_ms: classifierMs,
      intelligence_ms: intelligenceMs,
      context_ms: 0,
      total_events: thread.events.length,
      metadata: {
        workflow: classification.workflow,
        thread_id: thread.id,
        scope_path: thread.scopePath,
        active_workflow: thread.workflowState.active_workflow,
      },
    });

    return { threadId: thread.id, response, thread };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    thread.events.push(
      createEvent("error", {
        source: "controller",
        message: errorMessage,
        recoverable: true,
        attemptNumber: 1,
      }, controllerProv)
    );
    await store.update(thread);

    emit({
      provenance: controllerProv,
      category: "turn",
      operation: "handle_turn",
      latency_ms: Date.now() - turnStart,
      success: false,
      metadata: {
        thread_id: thread.id,
        scope_path: thread.scopePath,
        active_workflow: thread.workflowState.active_workflow,
      },
    });

    return { threadId: thread.id, response: `An error occurred: ${errorMessage}`, thread };
  }
}

// --- Workflow Handlers ---

async function handleMemoryOperation(
  classification: ClassifierOutput,
  userMessage: string,
  thread: Thread,
  store: FileSystemThreadStore,
  config: ControllerConfig,
  _classifierProv: Provenance,
  sessionHandle: import("../../shared/llm-invoker/types.js").InvocationSessionHandle | undefined,
  scopePath: string | null
): Promise<{ response: string; intelligenceSession?: import("../../shared/llm-invoker/types.js").InvocationSessionHandle }> {
  const operation = normalizeMemoryOperation(classification.tool);
  const operationProv = createSystemProvenance(`COO/controller/memory-operation/${operation}`);
  const operationId = createMemoryOperationId();

  switch (classification.tool) {
    case "memory_capture": {
      if (!config.brainCapture) return { response: "Memory engine not connected." };
      if (!scopePath) {
        return handleMissingScope(thread, store, operation, operationId, { content: userMessage }, operationProv);
      }

      thread.events.push(createEvent("memory_operation", {
        operation: "capture",
        operationId,
        input: { content: userMessage, scope: scopePath },
      }, operationProv));
      await store.update(thread);

      try {
        const result = await config.brainCapture(userMessage, "text", [], scopePath, operationProv);
        thread.events.push(createEvent("memory_operation", {
          operation: "capture",
          operationId,
          input: { content: userMessage, scope: scopePath },
          result,
          success: true,
        }, operationProv));
        await store.update(thread);
        return { response: describeCaptureResult(result) };
      } catch (err) {
        return handleMemoryOperationFailure(thread, store, operation, operationId, { content: userMessage, scope: scopePath }, err, operationProv);
      }
    }
    case "decision_log": {
      if (!config.brainLogDecision) return { response: "Memory engine not connected." };
      if (!scopePath) {
        return handleMissingScope(thread, store, operation, operationId, { content: userMessage }, operationProv);
      }

      const extractResult = await callLlm(config, {
        ...config.intelligenceParams,
        prompt: `Extract a structured decision from this message. Return JSON with: title, reasoning, alternatives (array of {option, pros, cons, rejected_reason}).\n\nMessage: ${userMessage}\n\nJSON:`,
        source_path: "COO/intelligence/extract-decision",
        session: {
          persist: true,
          handle: sessionHandle,
        },
      });

      let decision: { title: string; reasoning: string; alternatives?: unknown[] };
      try {
        decision = JSON.parse(extractResult.response.replace(/```json?\n?/g, "").replace(/```/g, ""));
      } catch {
        return {
          response: "Could not parse decision structure. Please rephrase.",
          intelligenceSession: extractResult.session?.handle ?? sessionHandle,
        };
      }

      const contentProvenance = extractResult.provenance;
      thread.events.push(createEvent("memory_operation", {
        operation: "log_decision",
        operationId,
        input: {
          ...decision,
          scope: scopePath,
          content_provenance: contentProvenance,
        },
      }, contentProvenance));
      await store.update(thread);

      try {
        const result = await config.brainLogDecision(
          decision.title,
          decision.reasoning,
          decision.alternatives ?? [],
          scopePath,
          operationProv,
          contentProvenance
        );
        thread.events.push(createEvent("memory_operation", {
          operation: "log_decision",
          operationId,
          input: {
            ...decision,
            scope: scopePath,
            content_provenance: contentProvenance,
          },
          result: {
            ...result,
            content_provenance: contentProvenance,
            write_provenance: operationProv,
          },
          success: true,
        }, operationProv));
        await store.update(thread);
        return {
          response: describeDecisionResult(decision.title, result),
          intelligenceSession: extractResult.session?.handle ?? sessionHandle,
        };
      } catch (err) {
        const failure = await handleMemoryOperationFailure(
          thread,
          store,
          operation,
          operationId,
          {
            ...decision,
            scope: scopePath,
            content_provenance: contentProvenance,
          },
          err,
          operationProv
        );
        return {
          response: failure.response,
          intelligenceSession: extractResult.session?.handle ?? sessionHandle,
        };
      }
    }
    case "rule_create": {
      if (!config.brainCreateRule) return { response: "Memory engine not connected." };
      if (!scopePath) {
        return handleMissingScope(thread, store, operation, operationId, { content: userMessage }, operationProv);
      }

      thread.events.push(createEvent("memory_operation", {
        operation: "make_rule",
        operationId,
        input: { content: userMessage, scope: scopePath },
      }, operationProv));
      await store.update(thread);

      try {
        const result = await config.brainCreateRule(userMessage, userMessage, ["rule"], scopePath, operationProv);
        thread.events.push(createEvent("memory_operation", {
          operation: "make_rule",
          operationId,
          input: { content: userMessage, scope: scopePath },
          result,
          success: true,
        }, operationProv));
        await store.update(thread);
        return { response: describeGovernanceCreateResult("Rule", result) };
      } catch (err) {
        return handleMemoryOperationFailure(thread, store, operation, operationId, { content: userMessage, scope: scopePath }, err, operationProv);
      }
    }
    case "memory_search":
    case "context_load": {
      if (!config.brainSearch) return { response: "Memory engine not connected." };
      if (!scopePath) {
        return handleMissingScope(thread, store, operation, operationId, { query: userMessage }, operationProv);
      }

      thread.events.push(createEvent("memory_operation", {
        operation: classification.tool === "context_load" ? "load_context" : "search",
        operationId,
        input: { query: userMessage, scope: scopePath },
      }, operationProv));
      await store.update(thread);

      try {
        const results = await config.brainSearch(
          userMessage,
          scopePath,
          operationProv,
          inferExplicitSearchOptions(userMessage, classification.tool)
        );
        thread.events.push(createEvent("memory_operation", {
          operation: classification.tool === "context_load" ? "load_context" : "search",
          operationId,
          input: { query: userMessage, scope: scopePath },
          result: {
            count: results.length,
            items: results.slice(0, 5).map((result) => ({
              id: result.id,
              content_type: result.content_type,
              trust_level: result.trust_level,
              context_priority: result.context_priority,
              score: result.score,
            })),
          },
          success: true,
        }, operationProv));
        await store.update(thread);
        if (results.length === 0) return { response: "No scoped memories found." };
        const summary = results.slice(0, 5)
          .map((r, i) => `${i + 1}. [${r.content_type}/${r.trust_level}] ${r.preview}`)
          .join("\n");
        return { response: `Found ${results.length} scoped memories:\n\n${summary}` };
      } catch (err) {
        return handleMemoryOperationFailure(thread, store, operation, operationId, { query: userMessage, scope: scopePath }, err, operationProv);
      }
    }
    default:
      return { response: "Unknown memory operation." };
  }
}

async function handleCooResponse(
  userMessage: string,
  thread: Thread,
  config: ControllerConfig,
  sessionHandle?: import("../../shared/llm-invoker/types.js").InvocationSessionHandle,
  scopePath: string | null = null
): Promise<InvocationResult> {
  const contextConfig: ContextEngineerConfig = {
    projectRoot: config.projectRoot,
    promptsDir: config.promptsDir,
    memoryDir: config.memoryDir,
    brainSearch: config.brainSearch,
    scopePath,
  };

  const ctx = await assembleContext(thread, userMessage, contextConfig);
  const prompt = buildPrompt(ctx) + `\n\n<user_message>\n${userMessage}\n</user_message>`;

  return callLlm(config, {
    ...config.intelligenceParams,
    prompt,
    source_path: "COO/intelligence/respond",
    session: {
      persist: true,
      handle: sessionHandle,
    },
  });
}

async function handleClarification(
  classification: ClassifierOutput,
  thread: Thread,
  provenance: Provenance
): Promise<string> {
  const question = classification.reasoning ?? "Could you clarify what you'd like me to do?";
  thread.status = "paused";
  thread.events.push(createEvent("human_request", {
    question, urgency: "medium", responseFormat: "free_text",
  }, provenance));
  return question;
}

function normalizeMemoryOperation(tool: string | undefined): "capture" | "search" | "log_decision" | "make_rule" | "load_context" | "archive" {
  switch (tool) {
    case "memory_capture":
      return "capture";
    case "decision_log":
      return "log_decision";
    case "rule_create":
      return "make_rule";
    case "context_load":
      return "load_context";
    case "memory_search":
    default:
      return "search";
  }
}

function createMemoryOperationId(): string {
  return createSystemProvenance("COO/controller/memory-operation/id").invocation_id;
}

async function handleMissingScope(
  thread: Thread,
  store: FileSystemThreadStore,
  operation: "capture" | "search" | "log_decision" | "make_rule" | "load_context" | "archive",
  operationId: string,
  input: Record<string, unknown>,
  provenance: Provenance
): Promise<{ response: string }> {
  const response = "Memory scope is not set for this conversation yet. Start or resume the thread with --scope <org/project/...> before using durable memory operations.";
  thread.events.push(createEvent("memory_operation", {
    operation,
    operationId,
    input,
    result: { error: "missing_scope", code: "missing_scope" },
    success: false,
  }, provenance));
  await store.update(thread);
  return { response };
}

async function handleMemoryOperationFailure(
  thread: Thread,
  store: FileSystemThreadStore,
  operation: "capture" | "search" | "log_decision" | "make_rule" | "load_context" | "archive",
  operationId: string,
  input: Record<string, unknown>,
  error: unknown,
  provenance: Provenance
): Promise<{ response: string }> {
  const message = error instanceof Error ? error.message : String(error);
  thread.events.push(createEvent("memory_operation", {
    operation,
    operationId,
    input,
    result: { error: message },
    success: false,
  }, provenance));
  await store.update(thread);
  return { response: `Memory operation failed: ${message}` };
}

function describeCaptureResult(result: Record<string, unknown>): string {
  const status = typeof result.status === "string" ? result.status : "created";
  const id = typeof result.id === "string" ? result.id : "unknown";
  switch (status) {
    case "duplicate_exact":
      return `Already in memory as exact duplicate (${id}).`;
    case "duplicate_semantic":
      return `Already in memory as semantic duplicate (${id}).`;
    default:
      return `Saved to memory (${id}).`;
  }
}

function describeDecisionResult(title: string, result: Record<string, unknown>): string {
  const decisionId = typeof result.decision_id === "string" ? result.decision_id : "unknown";
  return `Decision logged: ${title} (${decisionId}).`;
}

function describeGovernanceCreateResult(label: string, result: Record<string, unknown>): string {
  const id = typeof result.id === "string" ? result.id : "unknown";
  return `${label} created (${id}).`;
}

function buildStateCommitSummary(workflow: string, response: string): string {
  const clippedResponse = response.length > 180 ? `${response.slice(0, 180)}...` : response;
  return `Completed turn via ${workflow}. Response: ${clippedResponse}`;
}

function buildOpenLoops(workflow: string, response: string): string[] {
  if (workflow === "clarification") {
    return [response];
  }
  if (workflow === "pushback") {
    return ["CEO clarification or decision needed before proceeding."];
  }
  return [];
}

function inferExplicitSearchOptions(
  userMessage: string,
  tool: string | undefined
): {
  contentTypes?: string[];
  maxResults?: number;
} | undefined {
  if (tool === "context_load") {
    return {
      contentTypes: [
        "decision",
        "requirement",
        "convention",
        "rule",
        "role",
        "setting",
        "finding",
        "open_loop",
      ],
      maxResults: 10,
    };
  }

  if (/\bdecision(s)?\b|\bdecide(d|s)?\b/i.test(userMessage)) {
    return { contentTypes: ["decision"], maxResults: 10 };
  }
  if (/\bopen loop(s)?\b|\bfollow[- ]?up(s)?\b|\btodo(s)?\b/i.test(userMessage)) {
    return { contentTypes: ["open_loop"], maxResults: 10 };
  }
  if (/\brule(s)?\b|\bpolicy\b/i.test(userMessage)) {
    return { contentTypes: ["rule"], maxResults: 10 };
  }
  if (/\brequirement(s)?\b|\bspec(s)?\b/i.test(userMessage)) {
    return { contentTypes: ["requirement"], maxResults: 10 };
  }

  return undefined;
}

function collectDecisionSummaries(thread: Thread): string[] {
  const decisions = thread.events
    .map((event) => {
      if (
        event.type !== "memory_operation"
        || event.data.operation !== "log_decision"
        || event.data.success !== true
      ) {
        return null;
      }
      const input = event.data.input as Record<string, unknown>;
      return typeof input.title === "string" ? input.title : null;
    })
    .filter((value): value is string => Boolean(value));

  return decisions.slice(-5);
}

function summarizeWorkflowRoutingContext(thread: Thread): string | null {
  const onion = thread.workflowState.onion;
  if (thread.workflowState.active_workflow !== "requirements_gathering_onion" || !onion) {
    return null;
  }

  return [
    "[workflow]",
    "active_workflow=requirements_gathering_onion",
    `lifecycle_status=${onion.lifecycle_status}`,
    `current_layer=${onion.current_layer}`,
    `selected_next_question=${onion.selected_next_question ?? "none"}`,
  ].join(" ");
}

function summarizeEventForClassifier(event: ThreadEvent): string {
  if (event.type === "onion_turn_result") {
    return [
      `[${event.type}]`,
      `lifecycle_status=${event.data.lifecycle_status}`,
      `current_layer=${event.data.current_layer}`,
      `selected_next_question=${event.data.workflow_trace.selected_next_question ?? "none"}`,
      `result_status=${event.data.workflow_trace.result_status}`,
    ].join(" ");
  }

  return `[${event.type}] ${JSON.stringify(event.data).slice(0, 200)}`;
}

function compatibleSessionHandle(
  handle: import("../../shared/llm-invoker/types.js").InvocationSessionHandle | null | undefined,
  provider: import("../../shared/llm-invoker/types.js").InvocationSessionHandle["provider"],
  model: string
): import("../../shared/llm-invoker/types.js").InvocationSessionHandle | undefined {
  if (!handle) {
    return undefined;
  }
  if (handle.provider !== provider) {
    return undefined;
  }
  if (handle.model && handle.model !== model) {
    return undefined;
  }
  return handle;
}

function callLlm(
  config: ControllerConfig,
  params: InvocationParams
): Promise<InvocationResult> {
  return (config.invokeLLM ?? invoke)(params);
}
