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
} from "./context-engineer.js";
import {
  buildClassifierPrompt,
  parseClassifierResponse,
  type ClassifierOutput,
} from "./classifier.js";
import { TOOL_REGISTRY } from "./tools.js";

/**
 * COO Controller Loop — the stateless reducer.
 *
 * Each turn:
 * 1. Load thread state
 * 2. Classify intent (bounded LLM call)
 * 3. Assemble context (all 3 tiers)
 * 4. Execute workflow (COO response / tool call / memory op)
 * 5. Validate and commit state
 * 6. Return response
 *
 * The loop does NOT maintain internal state between turns.
 * Continuity comes from the thread + memory engine.
 */

export interface ControllerConfig {
  projectRoot: string;
  threadsDir: string;
  promptsDir: string;
  memoryDir: string;
  classifierCall: (prompt: string) => Promise<string>;
  cooCall: (prompt: string) => Promise<string>;
  brainSearch?: (query: string) => Promise<BrainSearchResult[]>;
  brainCapture?: (content: string, contentType: string, tags: string[]) => Promise<unknown>;
  brainLogDecision?: (title: string, reasoning: string, alternatives: unknown[]) => Promise<unknown>;
  brainCreateRule?: (title: string, body: string, tags: string[]) => Promise<unknown>;
  maxConsecutiveErrors?: number;
}

export async function handleTurn(
  threadId: string | null,
  userMessage: string,
  config: ControllerConfig
): Promise<{ threadId: string; response: string; thread: Thread }> {
  const store = new FileSystemThreadStore(config.threadsDir);

  // Load or create thread
  let thread: Thread;
  if (threadId) {
    thread = await store.get(threadId);
  } else {
    thread = await store.create();
  }

  // Append user input
  thread.events.push(createEvent("user_input", { message: userMessage }));

  // Check consecutive errors
  const maxErrors = config.maxConsecutiveErrors ?? 3;
  if (consecutiveErrors(thread) >= maxErrors) {
    const escalation = `I've hit ${maxErrors} consecutive errors. Escalating to you for guidance.`;
    thread.events.push(createEvent("coo_response", { message: escalation }));
    await store.update(thread);
    return { threadId: thread.id, response: escalation, thread };
  }

  try {
    // Step 1: Classify intent
    const recentEvents = thread.events.slice(-5);
    const recentContext = recentEvents
      .map((e) => `[${e.type}] ${JSON.stringify(e.data).slice(0, 200)}`)
      .join("\n");

    const classifierPrompt = buildClassifierPrompt(userMessage, recentContext);
    const classifierRaw = await config.classifierCall(classifierPrompt);
    const classification = parseClassifierResponse(classifierRaw);

    thread.events.push(
      createEvent("classifier_result", {
        intent: classification.intent,
        confidence: classification.confidence,
        workflow: classification.workflow,
        reasoning: classification.reasoning,
      })
    );

    // Step 2: Execute workflow
    let response: string;

    switch (classification.workflow) {
      case "memory_operation":
        response = await handleMemoryOperation(
          classification,
          userMessage,
          thread,
          config
        );
        break;

      case "direct_coo_response":
      case "pushback":
      default:
        response = await handleCooResponse(
          userMessage,
          thread,
          config
        );
        break;

      case "clarification":
        response = await handleClarification(classification, thread);
        break;
    }

    // Step 3: Append response and commit
    thread.events.push(createEvent("coo_response", { message: response }));
    await store.update(thread);

    return { threadId: thread.id, response, thread };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    thread.events.push(
      createEvent("error", {
        source: "controller",
        message: errorMessage,
        recoverable: true,
        attemptNumber: 1,
      })
    );
    await store.update(thread);

    return {
      threadId: thread.id,
      response: `An error occurred: ${errorMessage}`,
      thread,
    };
  }
}

// --- Workflow Handlers ---

async function handleMemoryOperation(
  classification: ClassifierOutput,
  userMessage: string,
  thread: Thread,
  config: ControllerConfig
): Promise<string> {
  const tool = classification.tool;

  switch (tool) {
    case "memory_capture": {
      if (!config.brainCapture) return "Memory engine not connected.";
      thread.events.push(
        createEvent("memory_operation", {
          operation: "capture",
          input: { content: userMessage },
        })
      );
      await config.brainCapture(userMessage, "text", []);
      return "Saved to memory.";
    }

    case "decision_log": {
      if (!config.brainLogDecision) return "Memory engine not connected.";
      // Use COO to extract decision structure
      const extractPrompt = `Extract a structured decision from this message. Return JSON with: title, reasoning, alternatives (array of {option, pros, cons, rejected_reason}).

Message: ${userMessage}

JSON:`;
      const extracted = await config.cooCall(extractPrompt);
      try {
        const decision = JSON.parse(extracted.replace(/```json?\n?/g, "").replace(/```/g, ""));
        thread.events.push(
          createEvent("memory_operation", {
            operation: "log_decision",
            input: decision,
          })
        );
        await config.brainLogDecision(
          decision.title,
          decision.reasoning,
          decision.alternatives ?? []
        );
        return `Decision logged: ${decision.title}`;
      } catch {
        return "Could not parse decision structure. Please rephrase.";
      }
    }

    case "rule_create": {
      if (!config.brainCreateRule) return "Memory engine not connected.";
      thread.events.push(
        createEvent("memory_operation", {
          operation: "make_rule",
          input: { content: userMessage },
        })
      );
      await config.brainCreateRule(userMessage, userMessage, ["rule"]);
      return "Rule created.";
    }

    case "memory_search":
    case "context_load": {
      if (!config.brainSearch) return "Memory engine not connected.";
      thread.events.push(
        createEvent("memory_operation", {
          operation: "search",
          input: { query: userMessage },
        })
      );
      const results = await config.brainSearch(userMessage);
      if (results.length === 0) return "No relevant memories found.";
      const summary = results
        .slice(0, 5)
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
): Promise<string> {
  const contextConfig: ContextEngineerConfig = {
    projectRoot: config.projectRoot,
    promptsDir: config.promptsDir,
    memoryDir: config.memoryDir,
    brainSearch: config.brainSearch,
  };

  const ctx = await assembleContext(thread, userMessage, contextConfig);
  const prompt = buildPrompt(ctx);
  return config.cooCall(prompt + `\n\n<user_message>\n${userMessage}\n</user_message>`);
}

async function handleClarification(
  classification: ClassifierOutput,
  thread: Thread
): Promise<string> {
  thread.events.push(
    createEvent("human_request", {
      question: classification.reasoning ?? "Could you clarify what you'd like me to do?",
      urgency: "medium",
      responseFormat: "free_text",
    })
  );
  return classification.reasoning ?? "Could you clarify what you'd like me to do?";
}
