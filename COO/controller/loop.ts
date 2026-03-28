import { resolve } from "node:path";
import {
  createThread,
  createEvent,
  FileSystemThreadStore,
  consecutiveErrors,
  isAwaitingHuman,
  lastEvent,
  type Thread,
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
import { emit } from "../../shared/telemetry/collector.js";
import type { InvocationParams, InvocationResult } from "../../shared/llm-invoker/types.js";

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
  brainSearch?: (query: string, provenance: Provenance) => Promise<BrainSearchResult[]>;
  brainCapture?: (content: string, contentType: string, tags: string[], provenance: Provenance) => Promise<unknown>;
  brainLogDecision?: (title: string, reasoning: string, alternatives: unknown[], provenance: Provenance) => Promise<unknown>;
  brainCreateRule?: (title: string, body: string, tags: string[], provenance: Provenance) => Promise<unknown>;
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
  config: ControllerConfig
): Promise<{ threadId: string; response: string; thread: Thread }> {
  const turnStart = Date.now();
  const store = new FileSystemThreadStore(config.threadsDir);
  const controllerProv = createSystemProvenance("COO/controller/handle-turn");

  let thread: Thread;
  if (threadId) {
    thread = await store.get(threadId);
  } else {
    thread = await store.create();
  }

  thread.events.push(createEvent("user_input", { message: userMessage }, controllerProv));

  const maxErrors = config.maxConsecutiveErrors ?? 3;
  if (consecutiveErrors(thread) >= maxErrors) {
    const escalation = `I've hit ${maxErrors} consecutive errors. Escalating to you for guidance.`;
    thread.events.push(createEvent("coo_response", { message: escalation }, controllerProv));
    await store.update(thread);
    return { threadId: thread.id, response: escalation, thread };
  }

  let classifierMs = 0;
  let intelligenceMs = 0;

  try {
    // Step 1: Classify intent
    const recentEvents = thread.events.slice(-5);
    const recentContext = recentEvents
      .map((e) => `[${e.type}] ${JSON.stringify(e.data).slice(0, 200)}`)
      .join("\n");

    const classifierPrompt = buildClassifierPrompt(userMessage, recentContext);
    const classifierResult = await invoke({
      ...config.classifierParams,
      prompt: classifierPrompt,
      source_path: "COO/classifier/classify",
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

    // Step 2: Execute workflow
    let response: string;
    let intelligenceProv: Provenance = controllerProv;

    switch (classification.workflow) {
      case "memory_operation":
        response = await handleMemoryOperation(
          classification, userMessage, thread, config, classifierResult.provenance
        );
        break;

      case "tool_path":
        response = "Tool path workflow not yet implemented. Classified as tool invocation but no tool dispatcher exists yet.";
        break;

      case "specialist_path":
        response = "Specialist path workflow not yet implemented. Classified as specialist delegation but no specialist dispatcher exists yet.";
        break;

      case "direct_coo_response":
      case "pushback":
      default: {
        const cooResult = await handleCooResponse(userMessage, thread, config);
        response = cooResult.response;
        intelligenceProv = cooResult.provenance;
        intelligenceMs = cooResult.latency_ms;
        break;
      }

      case "clarification":
        response = await handleClarification(classification, thread, controllerProv);
        break;
    }

    // Step 3: Append response and commit
    thread.events.push(createEvent("coo_response", { message: response }, intelligenceProv));
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
    });

    return { threadId: thread.id, response: `An error occurred: ${errorMessage}`, thread };
  }
}

// --- Workflow Handlers ---

async function handleMemoryOperation(
  classification: ClassifierOutput,
  userMessage: string,
  thread: Thread,
  config: ControllerConfig,
  classifierProv: Provenance
): Promise<string> {
  switch (classification.tool) {
    case "memory_capture": {
      if (!config.brainCapture) return "Memory engine not connected.";
      thread.events.push(createEvent("memory_operation", {
        operation: "capture", input: { content: userMessage },
      }, classifierProv));
      await config.brainCapture(userMessage, "text", [], classifierProv);
      return "Saved to memory.";
    }
    case "decision_log": {
      if (!config.brainLogDecision) return "Memory engine not connected.";
      const extractResult = await invoke({
        ...config.intelligenceParams,
        prompt: `Extract a structured decision from this message. Return JSON with: title, reasoning, alternatives (array of {option, pros, cons, rejected_reason}).\n\nMessage: ${userMessage}\n\nJSON:`,
        source_path: "COO/intelligence/extract-decision",
      });
      try {
        const decision = JSON.parse(extractResult.response.replace(/```json?\n?/g, "").replace(/```/g, ""));
        thread.events.push(createEvent("memory_operation", {
          operation: "log_decision", input: decision,
        }, extractResult.provenance));
        await config.brainLogDecision(decision.title, decision.reasoning, decision.alternatives ?? [], extractResult.provenance);
        return `Decision logged: ${decision.title}`;
      } catch {
        return "Could not parse decision structure. Please rephrase.";
      }
    }
    case "rule_create": {
      if (!config.brainCreateRule) return "Memory engine not connected.";
      thread.events.push(createEvent("memory_operation", {
        operation: "make_rule", input: { content: userMessage },
      }, classifierProv));
      await config.brainCreateRule(userMessage, userMessage, ["rule"], classifierProv);
      return "Rule created.";
    }
    case "memory_search":
    case "context_load": {
      if (!config.brainSearch) return "Memory engine not connected.";
      thread.events.push(createEvent("memory_operation", {
        operation: "search", input: { query: userMessage },
      }, classifierProv));
      const results = await config.brainSearch(userMessage, classifierProv);
      if (results.length === 0) return "No relevant memories found.";
      const summary = results.slice(0, 5)
        .map((r, i) => `${i + 1}. [${r.content_type}] ${r.preview}`)
        .join("\n");
      return `Found ${results.length} relevant memories:\n\n${summary}`;
    }
    default:
      return "Unknown memory operation.";
  }
}

async function handleCooResponse(
  userMessage: string,
  thread: Thread,
  config: ControllerConfig
): Promise<InvocationResult> {
  const contextConfig: ContextEngineerConfig = {
    projectRoot: config.projectRoot,
    promptsDir: config.promptsDir,
    memoryDir: config.memoryDir,
    brainSearch: config.brainSearch,
  };

  const ctx = await assembleContext(thread, userMessage, contextConfig);
  const prompt = buildPrompt(ctx) + `\n\n<user_message>\n${userMessage}\n</user_message>`;

  return invoke({
    ...config.intelligenceParams,
    prompt,
    source_path: "COO/intelligence/respond",
  });
}

async function handleClarification(
  classification: ClassifierOutput,
  thread: Thread,
  provenance: Provenance
): Promise<string> {
  const question = classification.reasoning ?? "Could you clarify what you'd like me to do?";
  thread.events.push(createEvent("human_request", {
    question, urgency: "medium", responseFormat: "free_text",
  }, provenance));
  return question;
}
