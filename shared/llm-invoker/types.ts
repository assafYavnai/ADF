import { z } from "zod";
import { ProvenanceSchema } from "../provenance/types.js";

export const LLMProvider = z.enum(["codex", "claude", "gemini"]);
export type LLMProvider = z.infer<typeof LLMProvider>;

export const InvocationParams = z.object({
  cli: LLMProvider,
  model: z.string(),
  reasoning: z.string().optional(),
  effort: z.string().optional(),
  sandbox: z.string().optional(),
  bypass: z.boolean().optional(),
  timeout_ms: z.number().optional(),
  prompt: z.string(),
  source_path: z.string(),
  fallback: z
    .object({
      cli: LLMProvider,
      model: z.string(),
      reasoning: z.string().optional(),
      effort: z.string().optional(),
      bypass: z.boolean().optional(),
      timeout_ms: z.number().optional(),
    })
    .optional(),
});

export type InvocationParams = z.infer<typeof InvocationParams>;

export const InvocationResult = z.object({
  provenance: ProvenanceSchema,
  response: z.string(),
  latency_ms: z.number(),
});

export type InvocationResult = z.infer<typeof InvocationResult>;
