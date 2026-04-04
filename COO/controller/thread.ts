import { z } from "zod";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { ProvenanceSchema, createSystemProvenance, type Provenance } from "../../shared/provenance/types.js";
import type { InvocationSessionHandle } from "../../shared/llm-invoker/types.js";
import { emit, hasConfiguredSink } from "../../shared/telemetry/collector.js";
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
  if (!onion) {
    return "";
  }

  const ownership = thread.workflowState.active_workflow === "requirements_gathering_onion"
    ? "active"
    : "persisted";
  const approvedScope = onion.state.approved_snapshot;
  const topic = firstMeaningfulText(approvedScope?.topic, onion.state.topic);
  const goal = firstMeaningfulText(approvedScope?.goal, onion.state.goal);
  const expectedResult = firstMeaningfulText(approvedScope?.expected_result, onion.state.expected_result);
  const successView = firstMeaningfulText(approvedScope?.success_view, onion.state.success_view);
  const majorParts = (approvedScope?.major_parts ?? onion.state.major_parts)
    .map((part) => part.label)
    .filter((label) => label.trim().length > 0);
  const openDecisionCount = (approvedScope?.open_decisions ?? onion.state.open_decisions)
    .filter((decision) => decision.status !== "resolved")
    .length;

  const lines = [
    `Workflow owner: requirements_gathering_onion (${ownership})`,
    `Lifecycle status: ${onion.lifecycle_status}`,
    `Current layer: ${onion.current_layer}`,
    `Freeze status: ${onion.state.freeze_status.status}`,
    `Topic: ${topic ?? "missing"}`,
    `Goal: ${goal ?? "missing"}`,
    `Expected result: ${expectedResult ?? "missing"}`,
    `Success view: ${successView ?? "missing"}`,
    `Major parts: ${majorParts.length > 0 ? majorParts.join(", ") : "missing"}`,
    `Open decisions remaining: ${openDecisionCount}`,
  ];

  if (onion.selected_next_question) {
    lines.push(`Next question: ${onion.selected_next_question}`);
  } else if (onion.no_question_reason) {
    lines.push(`No next question: ${onion.no_question_reason}`);
  }

  if (onion.finalized_requirement_memory_id) {
    lines.push(`Finalized requirement memory id: ${onion.finalized_requirement_memory_id}`);
  }

  if (onion.cto_admission) {
    lines.push(`CTO admission status: ${onion.cto_admission.status}`);
    lines.push(`CTO admission outcome: ${onion.cto_admission.outcome ?? "none"}`);
    lines.push(`CTO admission decision: ${onion.cto_admission.decision ?? "pending"}`);
    if (onion.cto_admission.artifact_paths.request_json) {
      lines.push(`CTO admission request path: ${onion.cto_admission.artifact_paths.request_json}`);
    }
    if (onion.cto_admission.artifact_paths.decision_template_json) {
      lines.push(`CTO admission decision path: ${onion.cto_admission.artifact_paths.decision_template_json}`);
    }
    if (onion.cto_admission.artifact_paths.summary_md) {
      lines.push(`CTO admission summary path: ${onion.cto_admission.artifact_paths.summary_md}`);
    }
  }

  if (approvedScope) {
    lines.push(`Approved snapshot turn id: ${approvedScope.approved_turn_id}`);
    lines.push(`Approved snapshot time: ${approvedScope.approved_at}`);
  }

  lines.push(...onion.working_artifact.scope_summary);

  return lines.join("\n");
}

function firstMeaningfulText(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
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

  if (event.data.cto_admission) {
    lines.push(`cto_admission_status: ${event.data.cto_admission.status}`);
    lines.push(`cto_admission_decision: ${event.data.cto_admission.decision ?? "pending"}`);
    lines.push(`cto_admission_outcome: ${event.data.cto_admission.outcome ?? "none"}`);
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
    const startedAt = Date.now();
    await mkdir(this.threadsDir, { recursive: true });
    const thread = createThread(scopePath);
    try {
      await this.update(thread);
      emitThreadStoreMetric("thread_create", Date.now() - startedAt, true, {
        thread_id: thread.id,
        scope_path: scopePath,
      });
    } catch (error) {
      emitThreadStoreMetric("thread_create", Date.now() - startedAt, false, {
        thread_id: thread.id,
        scope_path: scopePath,
        error_message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
    return thread;
  }

  async get(id: string): Promise<Thread> {
    const filePath = join(this.threadsDir, `${id}.json`);
    const startedAt = Date.now();
    try {
      const raw = await readFile(filePath, "utf-8");
      const thread = ThreadSchema.parse(JSON.parse(raw));
      emitThreadStoreMetric("thread_load", Date.now() - startedAt, true, {
        thread_id: thread.id,
        scope_path: thread.scopePath,
        event_count: thread.events.length,
      });
      return thread;
    } catch (error) {
      emitThreadStoreMetric("thread_load", Date.now() - startedAt, false, {
        requested_thread_id: id,
        error_message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async update(thread: Thread): Promise<void> {
    const startedAt = Date.now();
    await mkdir(this.threadsDir, { recursive: true });
    thread.updatedAt = new Date().toISOString();

    const jsonPath = join(this.threadsDir, `${thread.id}.json`);
    const txtPath = join(this.threadsDir, `${thread.id}.txt`);
    try {
      await writeFile(jsonPath, JSON.stringify(thread, null, 2), "utf-8");
      await writeFile(txtPath, serializeForLLM(thread), "utf-8");
      emitThreadStoreMetric("thread_save", Date.now() - startedAt, true, {
        thread_id: thread.id,
        scope_path: thread.scopePath,
        event_count: thread.events.length,
      });
    } catch (error) {
      emitThreadStoreMetric("thread_save", Date.now() - startedAt, false, {
        thread_id: thread.id,
        scope_path: thread.scopePath,
        event_count: thread.events.length,
        error_message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async list(): Promise<string[]> {
    const files = await readdir(this.threadsDir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  }
}

function emitThreadStoreMetric(
  operation: "thread_create" | "thread_load" | "thread_save",
  latencyMs: number,
  success: boolean,
  metadata: Record<string, unknown>,
): void {
  if (!hasConfiguredSink()) {
    return;
  }

  emit({
    provenance: createSystemProvenance(`COO/controller/thread/${operation}`),
    category: "system",
    operation,
    latency_ms: latencyMs,
    success,
    metadata,
  });
}
