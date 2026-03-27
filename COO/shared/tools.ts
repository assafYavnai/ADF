import { z } from "zod";

/**
 * Tool Registry — defines all tools available to the COO controller.
 * Tools are Zod-typed structured outputs that the classifier/COO can emit.
 * The controller dispatches them deterministically.
 */

// --- Tool Schema Definitions ---

export const MemoryCaptureTool = z.object({
  tool: z.literal("memory_capture"),
  content: z.string(),
  content_type: z.enum(["text", "decision", "lesson", "convention", "requirement", "note", "context", "intent"]).default("text"),
  tags: z.array(z.string()).default([]),
});

export const MemorySearchTool = z.object({
  tool: z.literal("memory_search"),
  query: z.string(),
  content_type: z.enum(["text", "decision", "lesson", "convention", "requirement", "note", "context", "intent"]).optional(),
});

export const DecisionLogTool = z.object({
  tool: z.literal("decision_log"),
  title: z.string(),
  reasoning: z.string(),
  alternatives: z.array(z.object({
    option: z.string(),
    pros: z.array(z.string()).default([]),
    cons: z.array(z.string()).default([]),
    rejected_reason: z.string().optional(),
  })).default([]),
});

export const RuleCreateTool = z.object({
  tool: z.literal("rule_create"),
  title: z.string(),
  body: z.string(),
  tags: z.array(z.string()).default([]),
});

export const ContextLoadTool = z.object({
  tool: z.literal("context_load"),
  query: z.string(),
  max_items: z.number().default(10),
});

export const DirectResponseTool = z.object({
  tool: z.literal("direct_response"),
  message: z.string(),
});

export const ClarificationTool = z.object({
  tool: z.literal("clarification"),
  question: z.string(),
  context: z.string().optional(),
});

// --- Union type for all tools ---

export const ToolCall = z.discriminatedUnion("tool", [
  MemoryCaptureTool,
  MemorySearchTool,
  DecisionLogTool,
  RuleCreateTool,
  ContextLoadTool,
  DirectResponseTool,
  ClarificationTool,
]);

export type ToolCall = z.infer<typeof ToolCall>;

// --- Tool Registry ---

export interface ToolDefinition {
  name: string;
  description: string;
  examples: string[];
}

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    name: "memory_capture",
    description: "Save something to durable memory (thought, lesson, convention, note)",
    examples: [
      "Remember this",
      "Save this to memory",
      "Note that we decided...",
      "Save this convention",
    ],
  },
  {
    name: "memory_search",
    description: "Search durable memory for past knowledge, decisions, conventions",
    examples: [
      "What did we decide about...",
      "Do we have a rule for...",
      "Find our convention on...",
      "Load context about...",
    ],
  },
  {
    name: "decision_log",
    description: "Log a structured decision with reasoning and alternatives",
    examples: [
      "Save this decision",
      "Log that we decided to...",
      "Record this decision with alternatives",
    ],
  },
  {
    name: "rule_create",
    description: "Create a new rule in the memory engine",
    examples: [
      "Make this a rule",
      "From now on, always...",
      "New rule:",
    ],
  },
  {
    name: "context_load",
    description: "Load relevant context from memory engine before responding",
    examples: [
      "Load context from memory",
      "What do we know about...",
      "Refresh my context on...",
    ],
  },
  {
    name: "direct_response",
    description: "Respond directly to the CEO without tool use",
    examples: [],
  },
  {
    name: "clarification",
    description: "Ask the CEO for clarification before proceeding",
    examples: [
      "I need more details on...",
      "Can you clarify...",
    ],
  },
];
