import { z } from "zod";
import { ProvenanceSchema } from "../provenance/types.js";

export const LLMProvider = z.enum(["codex", "claude", "gemini"]);
export type LLMProvider = z.infer<typeof LLMProvider>;

export const InvocationSessionSource = z.enum([
  "provider_returned",
  "caller_assigned",
  "manual_recovery",
]);
export type InvocationSessionSource = z.infer<typeof InvocationSessionSource>;

export const InvocationSessionHandle = z.object({
  provider: LLMProvider,
  model: z.string().optional(),
  session_id: z.string(),
  source: InvocationSessionSource,
});
export type InvocationSessionHandle = z.infer<typeof InvocationSessionHandle>;

export const InvocationSessionRequest = z.object({
  persist: z.boolean().default(false),
  handle: InvocationSessionHandle.nullish(),
});
export type InvocationSessionRequest = z.infer<typeof InvocationSessionRequest>;

export const InvocationSessionResult = z.object({
  handle: InvocationSessionHandle,
  status: z.enum(["fresh", "resumed", "replaced"]),
});
export type InvocationSessionResult = z.infer<typeof InvocationSessionResult>;

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
  session: InvocationSessionRequest.optional(),
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
  session: InvocationSessionResult.nullable().optional(),
});

export type InvocationResult = z.infer<typeof InvocationResult>;
