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

export const InvocationAttemptSessionStatus = z.enum(["none", "fresh", "resumed", "replaced"]);
export type InvocationAttemptSessionStatus = z.infer<typeof InvocationAttemptSessionStatus>;

export const InvocationUsageEstimate = z.object({
  prompt_chars: z.number(),
  response_chars: z.number(),
  tokens_in_estimated: z.number(),
  tokens_out_estimated: z.number(),
  estimated_cost_usd: z.number().optional(),
  token_estimation_basis: z.literal("char_heuristic_v1"),
  cost_estimation_basis: z.string().optional(),
});
export type InvocationUsageEstimate = z.infer<typeof InvocationUsageEstimate>;

export const InvocationAttempt = z.object({
  provenance: ProvenanceSchema,
  latency_ms: z.number(),
  success: z.boolean(),
  session_status: InvocationAttemptSessionStatus,
  error_message: z.string().optional(),
  usage: InvocationUsageEstimate.optional(),
});
export type InvocationAttempt = z.infer<typeof InvocationAttempt>;

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
  usage: InvocationUsageEstimate.optional(),
  attempts: z.array(InvocationAttempt),
});

export type InvocationResult = z.infer<typeof InvocationResult>;
