import { z } from "zod";
import { ProvenanceSchema } from "../provenance.js";
import { Provider } from "../provenance.js";

export const DecisionAlternative = z.object({
  option: z.string(),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  rejected_reason: z.string().optional(),
});
export type DecisionAlternative = z.infer<typeof DecisionAlternative>;

export const DecisionReasoningState = z.enum([
  "current",
  "legacy_recovered",
  "legacy_unrecoverable",
]);
export type DecisionReasoningState = z.infer<typeof DecisionReasoningState>;

export const LogDecisionInput = z.object({
  title: z.string(),
  reasoning: z.string(),
  alternatives_considered: z.array(DecisionAlternative).default([]),
  scope: z.string(),
  tags: z.array(z.string()).default([]),
  decided_by: z.string().optional(),
  provenance: ProvenanceSchema.optional(),
  content_provenance: ProvenanceSchema.optional(),
});
export type LogDecisionInput = z.infer<typeof LogDecisionInput>;

export const DecisionDerivationMode = z.enum([
  "direct_input",
  "llm_extracted",
  "legacy_unknown",
]);
export type DecisionDerivationMode = z.infer<typeof DecisionDerivationMode>;

export const DecisionSchema = z.object({
  id: z.string().uuid(),
  memory_item_id: z.string().uuid(),
  title: z.string(),
  reasoning: z.string(),
  provenance_reasoning: z.string(),
  derivation_mode: DecisionDerivationMode,
  content_invocation_id: z.string().uuid().nullable(),
  content_provider: Provider.nullable(),
  content_model: z.string().nullable(),
  content_reasoning: z.string().nullable(),
  content_was_fallback: z.boolean().nullable(),
  content_source_path: z.string().nullable(),
  alternatives_considered: z.array(DecisionAlternative),
  decided_by: z.string().uuid().nullable(),
  status: z.string(),
  invocation_id: z.string().uuid(),
  provider: Provider,
  model: z.string(),
  was_fallback: z.boolean(),
  source_path: z.string(),
  reasoning_state: DecisionReasoningState,
  created_at: z.coerce.date(),
});
export type Decision = z.infer<typeof DecisionSchema>;
