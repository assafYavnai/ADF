import { z } from "zod";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { ProvenanceSchema, createSystemProvenance, type Provenance } from "../../shared/provenance/types.js";

// --- Base event fields (shared by all events) ---

const BaseEvent = z.object({
  timestamp: z.string().datetime(),
  id: z.string().uuid(),
  provenance: ProvenanceSchema,
});

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
    workflow: z.enum([
      "direct_coo_response",
      "tool_path",
      "specialist_path",
      "clarification",
      "pushback",
      "memory_operation",
    ]),
    reasoning: z.string().optional(),
  }),
});

export const ToolCallEvent = BaseEvent.extend({
  type: z.literal("tool_call"),
  data: z.object({
    tool: z.string(),
    parameters: z.record(z.unknown()),
    requiresApproval: z.boolean().default(false),
  }),
});

export const ToolResultEvent = BaseEvent.extend({
  type: z.literal("tool_result"),
  data: z.object({
    tool: z.string(),
    result: z.unknown(),
    success: z.boolean(),
    durationMs: z.number().optional(),
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
  }),
});

export const MemoryOperationEvent = BaseEvent.extend({
  type: z.literal("memory_operation"),
  data: z.object({
    operation: z.enum(["capture", "search", "log_decision", "make_rule", "load_context", "archive"]),
    input: z.record(z.unknown()),
    result: z.unknown().optional(),
    success: z.boolean().optional(),
  }),
});

// --- Union Event Type ---

export const ThreadEvent = z.discriminatedUnion("type", [
  UserInputEvent,
  ClassifierResultEvent,
  ToolCallEvent,
  ToolResultEvent,
  CooResponseEvent,
  ErrorEvent,
  HumanRequestEvent,
  StateCommitEvent,
  MemoryOperationEvent,
]);

export type ThreadEvent = z.infer<typeof ThreadEvent>;
export type UserInputEvent = z.infer<typeof UserInputEvent>;
export type ClassifierResultEvent = z.infer<typeof ClassifierResultEvent>;
export type ToolCallEvent = z.infer<typeof ToolCallEvent>;
export type ToolResultEvent = z.infer<typeof ToolResultEvent>;
export type CooResponseEvent = z.infer<typeof CooResponseEvent>;
export type ErrorEvent = z.infer<typeof ErrorEvent>;
export type HumanRequestEvent = z.infer<typeof HumanRequestEvent>;
export type StateCommitEvent = z.infer<typeof StateCommitEvent>;
export type MemoryOperationEvent = z.infer<typeof MemoryOperationEvent>;

// --- Thread ---

export const ThreadSchema = z.object({
  id: z.string().uuid(),
  events: z.array(ThreadEvent),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: z.enum(["active", "paused", "completed"]).default("active"),
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

export function createThread(): Thread {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    events: [],
    createdAt: now,
    updatedAt: now,
    status: "active",
  };
}

// --- Serialization ---

export function serializeForLLM(thread: Thread): string {
  const parts: string[] = [];

  for (const event of thread.events) {
    const data =
      typeof event.data === "string"
        ? event.data
        : JSON.stringify(event.data, null, 2);

    parts.push(`<${event.type}>\n${data}\n</${event.type}>`);
  }

  return parts.join("\n\n");
}

// --- Thread State Queries ---

export function lastEvent(thread: Thread): ThreadEvent | undefined {
  return thread.events[thread.events.length - 1];
}

export function isAwaitingHuman(thread: Thread): boolean {
  const last = lastEvent(thread);
  return last?.type === "human_request";
}

export function isAwaitingApproval(thread: Thread): boolean {
  const last = lastEvent(thread);
  return last?.type === "tool_call" && last.data.requiresApproval === true;
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

// --- File System Thread Store ---

export interface ThreadStore {
  create(): Promise<Thread>;
  get(id: string): Promise<Thread>;
  update(thread: Thread): Promise<void>;
  list(): Promise<string[]>;
}

export class FileSystemThreadStore implements ThreadStore {
  constructor(private threadsDir: string) {}

  async create(): Promise<Thread> {
    await mkdir(this.threadsDir, { recursive: true });
    const thread = createThread();
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
