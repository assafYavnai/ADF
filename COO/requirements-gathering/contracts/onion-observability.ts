import { z } from "zod";
import { OnionLayer, OpenDecision } from "./onion-state.js";

const SummaryArray = z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]));
const SummaryValue = z.union([z.string(), z.number(), z.boolean(), z.null(), SummaryArray]);

export const OnionOperation = z.enum([
  "onion_reducer",
  "clarification_policy",
  "freeze_check",
  "artifact_deriver",
  "readiness_check",
  "audit_trace_build",
]);
export type OnionOperation = z.infer<typeof OnionOperation>;

export const OnionOperationSummary = z.record(SummaryValue);
export type OnionOperationSummary = z.infer<typeof OnionOperationSummary>;

export const OnionOperationRecord = z.object({
  trace_id: z.string(),
  turn_id: z.string(),
  operation: OnionOperation,
  started_at: z.string().datetime(),
  completed_at: z.string().datetime(),
  duration_ms: z.number().int().nonnegative(),
  success: z.boolean(),
  error_code: z.string().optional(),
  error_message: z.string().optional(),
  input_summary: OnionOperationSummary,
  output_summary: OnionOperationSummary,
});
export type OnionOperationRecord = z.infer<typeof OnionOperationRecord>;

export const OnionLlmCallRecord = z.object({
  trace_id: z.string(),
  turn_id: z.string(),
  provider: z.string(),
  model: z.string(),
  purpose: z.string(),
  latency_ms: z.number().int().nonnegative(),
  tokens_in: z.number().int().nonnegative(),
  tokens_out: z.number().int().nonnegative(),
  estimated_cost_usd: z.number().nonnegative().optional(),
  fallback_used: z.boolean(),
  success: z.boolean(),
});
export type OnionLlmCallRecord = z.infer<typeof OnionLlmCallRecord>;

export const OnionWorkflowAuditTrace = z.object({
  trace_id: z.string(),
  turn_id: z.string(),
  current_layer: OnionLayer,
  workflow_step: z.string(),
  decision_reason: z.string(),
  selected_next_question: z.string().nullable(),
  no_question_reason: z.string().nullable(),
  freeze_blockers: z.array(z.string()),
  open_decisions_snapshot: z.array(OpenDecision),
  artifact_change_summary: z.array(z.string()),
  result_status: z.string(),
});
export type OnionWorkflowAuditTrace = z.infer<typeof OnionWorkflowAuditTrace>;

export const OnionWorkflowAuditTraceBundle = z.object({
  trace_id: z.string(),
  traces: z.array(OnionWorkflowAuditTrace),
});
export type OnionWorkflowAuditTraceBundle = z.infer<typeof OnionWorkflowAuditTraceBundle>;

export const OnionNoLlmCallsPolicy = z.object({
  uses_llm_calls: z.literal(false),
  rationale: z.string(),
});
export type OnionNoLlmCallsPolicy = z.infer<typeof OnionNoLlmCallsPolicy>;

export const NO_LLM_CALLS_POLICY: OnionNoLlmCallsPolicy = {
  uses_llm_calls: false,
  rationale: "The dormant onion lane is fully deterministic and does not perform any LLM calls.",
};

export interface OperationClock {
  mark(): {
    iso: string;
    ms: number;
  };
}

export function createSystemClock(): OperationClock {
  return {
    mark() {
      const ms = Date.now();
      return {
        iso: new Date(ms).toISOString(),
        ms,
      };
    },
  };
}

export function createStepClock(startedAtIso: string, stepMs: number): OperationClock {
  let current = Date.parse(startedAtIso);

  return {
    mark() {
      const mark = {
        iso: new Date(current).toISOString(),
        ms: current,
      };
      current += stepMs;
      return mark;
    },
  };
}

export function runTimedOperation<T>(input: {
  trace_id: string;
  turn_id: string;
  operation: OnionOperation;
  input_summary: OnionOperationSummary;
  clock?: OperationClock;
  execute: () => T;
  summarize_output: (result: T) => OnionOperationSummary;
}): {
  result: T;
  record: OnionOperationRecord;
} {
  const clock = input.clock ?? createSystemClock();
  const started = clock.mark();

  try {
    const result = input.execute();
    const completed = clock.mark();
    return {
      result,
      record: OnionOperationRecord.parse({
        trace_id: input.trace_id,
        turn_id: input.turn_id,
        operation: input.operation,
        started_at: started.iso,
        completed_at: completed.iso,
        duration_ms: completed.ms - started.ms,
        success: true,
        input_summary: input.input_summary,
        output_summary: input.summarize_output(result),
      }),
    };
  } catch (error) {
    const completed = clock.mark();
    const reason = error instanceof Error ? error.message : String(error);
    const record = OnionOperationRecord.parse({
      trace_id: input.trace_id,
      turn_id: input.turn_id,
      operation: input.operation,
      started_at: started.iso,
      completed_at: completed.iso,
      duration_ms: completed.ms - started.ms,
      success: false,
      error_code: "operation_failed",
      error_message: reason,
      input_summary: input.input_summary,
      output_summary: {
        status: "failed",
      },
    });

    throw Object.assign(
      error instanceof Error ? error : new Error(reason),
      { operation_record: record },
    );
  }
}
