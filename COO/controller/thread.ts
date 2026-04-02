import { z } from "zod";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { ProvenanceSchema, createSystemProvenance, type Provenance } from "../../shared/provenance/types.js";
import type { InvocationSessionHandle } from "../../shared/llm-invoker/types.js";
import { WorkflowName } from "./workflow-contract.js";
import {
  OnionTurnResultRecord,
  OnionWorkflowThreadState,
} from "../requirements-gathering/contracts/onion-live.js";

// --- Base event fields (shared by all events) ---

const BaseEvent = z.object({
  timestamp: z.string().datetime(),
  id: z.string().uuid(),
  provenance: ProvenanceSchema,
});

const InvocationSessionHandleSchema = z.object({
  provider: z.enum(["codex", "claude", "gemini"]),
  model: z.string().optional(),
  session_id: z.string(),
  source: z.enum(["provider_returned", "caller_assigned", "manual_recovery"]),
});

export type ThreadSessionHandle = InvocationSessionHandle;

export interface ThreadSessionHandles {
  classifier?: ThreadSessionHandle | null;
  intelligence?: ThreadSessionHandle | null;
}

// --- Event Types ---

export const UserInputEvent = BaseEvent.extend({
  type: z.literal("user_input"),
  data: z.object({
    message: z.string(),
  }),
});

export const ClassifierResultEvent = BaseEvent.extend({
  type: z.literal("classifier_result"),
  data: z.object({
    intent: z.string(),
    confidence: z.number().min(0).max(1),
    workflow: WorkflowName,
    reasoning: z.string().optional(),
  }),
});

export const CooResponseEvent = BaseEvent.extend({
  type: z.literal("coo_response"),
  data: z.object({
    message: z.string(),
    model: z.string().optional(),
    tokensUsed: z.number().optional(),
  }),
});

export const ErrorEvent = BaseEvent.extend({
  type: z.literal("error"),
  data: z.object({
    source: z.string(),
    message: z.string(),
    recoverable: z.boolean(),
    attemptNumber: z.number().optional().default(1),
  }),
});

export const HumanRequestEvent = BaseEvent.extend({
  type: z.literal("human_request"),
  data: z.object({
    question: z.string(),
    context: z.string().optional(),
    urgency: z.enum(["low", "medium", "high"]).optional().default("medium"),
    responseFormat: z.enum(["free_text", "yes_no", "multiple_choice"]).optional().default("free_text"),
    options: z.array(z.string()).optional(),
  }),
});

export const StateCommitEvent = BaseEvent.extend({
  type: z.literal("state_commit"),
  data: z.object({
    summary: z.string(),
    openLoops: z.array(z.string()).default([]),
    decisions: z.array(z.string()).default([]),
    sessionHandles: z
      .object({
        classifier: InvocationSessionHandleSchema.nullish(),
        intelligence: InvocationSessionHandleSchema.nullish(),
      })
      .optional(),
  }),
});

export const MemoryOperationEvent = BaseEvent.extend({
  type: z.literal("memory_operation"),
  data: z.object({
    operation: z.enum(["capture", "search", "log_decision", "make_rule", "load_context", "archive"]),
    operationId: z.string().uuid().optional(),
    input: z.record(z.unknown()),
    result: z.unknown().optional(),
    success: z.boolean().optional(),
  }),
});

export const OnionTurnResultEvent = BaseEvent.extend({
  type: z.literal("onion_turn_result"),
  data: OnionTurnResultRecord,
});

// --- Union Event Type ---

export const ThreadEvent = z.discriminatedUnion("type", [
  UserInputEvent,
  ClassifierResultEvent,
  CooResponseEvent,
  ErrorEvent,
  HumanRequestEvent,
  StateCommitEvent,
  MemoryOperationEvent,
  OnionTurnResultEvent,
]);

export type ThreadEvent = z.infer<typeof ThreadEvent>;
export type UserInputEvent = z.infer<typeof UserInputEvent>;
export type ClassifierResultEvent = z.infer<typeof ClassifierResultEvent>;
export type CooResponseEvent = z.infer<typeof CooResponseEvent>;
export type ErrorEvent = z.infer<typeof ErrorEvent>;
export type HumanRequestEvent = z.infer<typeof HumanRequestEvent>;
export type StateCommitEvent = z.infer<typeof StateCommitEvent>;
export type MemoryOperationEvent = z.infer<typeof MemoryOperationEvent>;
export type OnionTurnResultEvent = z.infer<typeof OnionTurnResultEvent>;

// --- Thread ---

export const ThreadWorkflowStateSchema = z.object({
  active_workflow: WorkflowName.nullable().default(null),
  onion: OnionWorkflowThreadState.nullable().default(null),
});
export type ThreadWorkflowState = z.infer<typeof ThreadWorkflowStateSchema>;

export const ThreadSchema = z.object({
  id: z.string().uuid(),
  events: z.array(ThreadEvent),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: z.enum(["active", "paused", "completed"]).default("active"),
  scopePath: z.string().nullable().optional().default(null),
  workflowState: ThreadWorkflowStateSchema.default({
    active_workflow: null,
    onion: null,
  }),
});

export type Thread = z.infer<typeof ThreadSchema>;

// --- Event Factory ---

export function createEvent<T extends ThreadEvent["type"]>(
  type: T,
  data: Extract<ThreadEvent, { type: T }>["data"],
  provenance?: Provenance
): Extract<ThreadEvent, { type: T }> {
  return {
    type,
    data,
    timestamp: new Date().toISOString(),
    id: randomUUID(),
    provenance: provenance ?? createSystemProvenance(`COO/controller/create-event/${type}`),
  } as Extract<ThreadEvent, { type: T }>;
}

// --- Thread Factory ---

export function createThread(scopePath: string | null = null): Thread {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    events: [],
    createdAt: now,
    updatedAt: now,
    status: "active",
    scopePath,
    workflowState: {
      active_workflow: null,
      onion: null,
    },
  };
}

// --- Serialization ---

export function serializeForLLM(thread: Thread): string {
  const parts: string[] = [];
  const lastCommitIndex = findLastStateCommitIndex(thread);
  const workflowSummary = serializeWorkflowState(thread);

  if (workflowSummary) {
    parts.push(`<workflow_state>\n${workflowSummary}\n</workflow_state>`);
  }

  if (lastCommitIndex >= 0) {
    const commit = thread.events[lastCommitIndex];
    parts.push(`<thread_checkpoint>\n${serializeEvent(commit)}\n</thread_checkpoint>`);
  }

  const recentStart = Math.max(lastCommitIndex + 1, thread.events.length - 12);
  const recentEvents = thread.events.slice(recentStart);
  if (recentEvents.length > 0) {
    const recentPayload = recentEvents.map((event) => serializeEvent(event)).join("\n\n");
    parts.push(`<recent_events>\n${recentPayload}\n</recent_events>`);
  }

  if (parts.length === 0) {
    return "";
  }

  return parts.join("\n\n");
}

// --- Thread State Queries ---

export function lastEvent(thread: Thread): ThreadEvent | undefined {
  return thread.events[thread.events.length - 1];
}

export function getLatestStateCommit(thread: Thread): StateCommitEvent | undefined {
  for (let i = thread.events.length - 1; i >= 0; i--) {
    const event = thread.events[i];
    if (event.type === "state_commit") {
      return event;
    }
  }
  return undefined;
}

export function getLatestSessionHandles(thread: Thread): ThreadSessionHandles {
  const commit = getLatestStateCommit(thread);
  return commit?.data.sessionHandles ?? {};
}

export function isAwaitingHuman(thread: Thread): boolean {
  const last = lastEvent(thread);
  return last?.type === "human_request";
}

export function consecutiveErrors(thread: Thread): number {
  let count = 0;
  for (let i = thread.events.length - 1; i >= 0; i--) {
    if (thread.events[i].type === "error") {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function findLastStateCommitIndex(thread: Thread): number {
  for (let i = thread.events.length - 1; i >= 0; i--) {
    if (thread.events[i].type === "state_commit") {
      return i;
    }
  }
  return -1;
}

function serializeEvent(event: ThreadEvent): string {
  if (event.type === "onion_turn_result") {
    return serializeOnionTurnResult(event);
  }

  const data =
    typeof event.data === "string"
      ? event.data
      : JSON.stringify(event.data, null, 2);

  return `<${event.type}>\n${data}\n</${event.type}>`;
}

function serializeWorkflowState(thread: Thread): string {
  const onion = thread.workflowState.onion;
  if (thread.workflowState.active_workflow !== "requirements_gathering_onion" || !onion) {
    return "";
  }

  const lines = [
    `Active workflow: requirements_gathering_onion`,
    `Lifecycle status: ${onion.lifecycle_status}`,
    `Current layer: ${onion.current_layer}`,
    ...onion.working_artifact.scope_summary,
  ];

  if (onion.selected_next_question) {
    lines.push(`Next question: ${onion.selected_next_question}`);
  } else if (onion.no_question_reason) {
    lines.push(`No next question: ${onion.no_question_reason}`);
  }

  if (onion.finalized_requirement_memory_id) {
    lines.push(`Finalized requirement memory id: ${onion.finalized_requirement_memory_id}`);
  }

  return lines.join("\n");
}

function serializeOnionTurnResult(event: OnionTurnResultEvent): string {
  const lines = [
    `trace_id: ${event.data.trace_id}`,
    `turn_id: ${event.data.turn_id}`,
    `lifecycle_status: ${event.data.lifecycle_status}`,
    `current_layer: ${event.data.current_layer}`,
    `state_commit_summary: ${event.data.state_commit_summary}`,
  ];

  if (event.data.workflow_trace.selected_next_question) {
    lines.push(`selected_next_question: ${event.data.workflow_trace.selected_next_question}`);
  } else if (event.data.workflow_trace.no_question_reason) {
    lines.push(`no_question_reason: ${event.data.workflow_trace.no_question_reason}`);
  }

  if (event.data.finalized_requirement_memory_id) {
    lines.push(`finalized_requirement_memory_id: ${event.data.finalized_requirement_memory_id}`);
  }

  return `<onion_turn_result>\n${lines.join("\n")}\n</onion_turn_result>`;
}

// --- File System Thread Store ---

export interface ThreadStore {
  create(scopePath?: string | null): Promise<Thread>;
  get(id: string): Promise<Thread>;
  update(thread: Thread): Promise<void>;
  list(): Promise<string[]>;
}

export class FileSystemThreadStore implements ThreadStore {
  constructor(private threadsDir: string) {}

  async create(scopePath: string | null = null): Promise<Thread> {
    await mkdir(this.threadsDir, { recursive: true });
    const thread = createThread(scopePath);
    await this.update(thread);
    return thread;
  }

  async get(id: string): Promise<Thread> {
    const filePath = join(this.threadsDir, `${id}.json`);
    const raw = await readFile(filePath, "utf-8");
    return ThreadSchema.parse(JSON.parse(raw));
  }

  async update(thread: Thread): Promise<void> {
    await mkdir(this.threadsDir, { recursive: true });
    thread.updatedAt = new Date().toISOString();

    const jsonPath = join(this.threadsDir, `${thread.id}.json`);
    await writeFile(jsonPath, JSON.stringify(thread, null, 2), "utf-8");

    const txtPath = join(this.threadsDir, `${thread.id}.txt`);
    await writeFile(txtPath, serializeForLLM(thread), "utf-8");
  }

  async list(): Promise<string[]> {
    const files = await readdir(this.threadsDir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  }
}
