import { z } from "zod";
import { ProvenanceSchema } from "../provenance/types.js";

export const MetricCategory = z.enum(["llm", "memory", "tool", "turn", "system"]);
export type MetricCategory = z.infer<typeof MetricCategory>;

export const BaseMetric = z.object({
  provenance: ProvenanceSchema,
  category: MetricCategory,
  operation: z.string(),
  latency_ms: z.number(),
  success: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
});

export const LLMMetric = BaseMetric.extend({
  category: z.literal("llm"),
  tokens_in: z.number().optional(),
  tokens_out: z.number().optional(),
  estimated_cost_usd: z.number().optional(),
});

export const MemoryMetric = BaseMetric.extend({
  category: z.literal("memory"),
  results_count: z.number().optional(),
  embedding_generated: z.boolean().optional(),
});

export const ToolMetric = BaseMetric.extend({
  category: z.literal("tool"),
  board_rounds: z.number().optional(),
  participants: z.number().optional(),
  budget_consumed: z.number().optional(),
});

export const TurnMetric = BaseMetric.extend({
  category: z.literal("turn"),
  classifier_ms: z.number().optional(),
  intelligence_ms: z.number().optional(),
  context_ms: z.number().optional(),
  total_events: z.number().optional(),
});

export const SystemMetric = BaseMetric.extend({
  category: z.literal("system"),
});

export const MetricEvent = z.discriminatedUnion("category", [
  LLMMetric,
  MemoryMetric,
  ToolMetric,
  TurnMetric,
  SystemMetric,
]);

export type MetricEvent = z.infer<typeof MetricEvent>;
export type LLMMetric = z.infer<typeof LLMMetric>;
export type MemoryMetric = z.infer<typeof MemoryMetric>;
export type ToolMetric = z.infer<typeof ToolMetric>;
export type TurnMetric = z.infer<typeof TurnMetric>;
export type SystemMetric = z.infer<typeof SystemMetric>;
