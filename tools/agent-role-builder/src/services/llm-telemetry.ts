import { randomUUID } from "node:crypto";
import { createLLMProvenance, emit } from "../shared-imports.js";
import type { InvocationResult } from "../shared-imports.js";

type InvocationAttempt = InvocationResult["attempts"][number];
type InvocationUsageEstimate = NonNullable<InvocationResult["usage"]>;

interface InvocationTelemetryContext {
  engine: string;
  stage: string;
  role?: string;
  round?: number;
  reviewMode?: string;
  slotKey?: string;
  metadata?: Record<string, unknown>;
}

interface FailureFallback {
  provider: "codex" | "claude" | "gemini";
  model: string;
  reasoning: string;
  sourcePath: string;
  wasFallback?: boolean;
  sessionStatus?: "none" | "fresh" | "resumed" | "replaced";
  errorMessage: string;
}

export function emitInvocationResultTelemetry(
  result: InvocationResult,
  context: InvocationTelemetryContext
): void {
  emitInvocationAttemptsTelemetry(result.attempts, context);
}

export function emitInvocationFailureTelemetry(
  error: unknown,
  context: InvocationTelemetryContext,
  fallback: FailureFallback
): void {
  const attempts = extractInvocationAttempts(error);
  if (attempts.length > 0) {
    emitInvocationAttemptsTelemetry(attempts, context);
    return;
  }

  const syntheticAttempt: InvocationAttempt = {
    provenance: createLLMProvenance(
      randomUUID(),
      fallback.provider,
      fallback.model,
      fallback.reasoning,
      fallback.wasFallback ?? false,
      fallback.sourcePath
    ),
    latency_ms: 0,
    success: false,
    session_status: fallback.sessionStatus ?? "none",
    error_message: fallback.errorMessage,
  };
  emitInvocationAttemptsTelemetry([syntheticAttempt], context);
}

function emitInvocationAttemptsTelemetry(
  attempts: InvocationAttempt[],
  context: InvocationTelemetryContext
): void {
  attempts.forEach((attempt, index) => {
    emit({
      provenance: attempt.provenance,
      category: "llm",
      operation: "llm-invocation",
      latency_ms: attempt.latency_ms,
      success: attempt.success,
      tokens_in: attempt.usage?.tokens_in_estimated,
      tokens_out: attempt.usage?.tokens_out_estimated,
      estimated_cost_usd: attempt.usage?.estimated_cost_usd,
      metadata: {
        engine: context.engine,
        stage: context.stage,
        role: context.role ?? null,
        round: context.round ?? null,
        review_mode: context.reviewMode ?? null,
        slot_key: context.slotKey ?? null,
        attempt_index: index,
        session_status: attempt.session_status,
        error_message: attempt.error_message ?? null,
        prompt_chars: attempt.usage?.prompt_chars ?? null,
        response_chars: attempt.usage?.response_chars ?? null,
        token_estimation_basis: attempt.usage?.token_estimation_basis ?? null,
        cost_estimation_basis: attempt.usage?.cost_estimation_basis ?? null,
        ...context.metadata,
      },
    });
  });
}

function extractInvocationAttempts(error: unknown): InvocationAttempt[] {
  if (
    error
    && typeof error === "object"
    && "attempts" in error
    && Array.isArray((error as { attempts?: unknown[] }).attempts)
  ) {
    return (error as { attempts: InvocationAttempt[] }).attempts;
  }
  return [];
}

export function summarizeUsage(usage: InvocationUsageEstimate | undefined): Record<string, number | string | null> {
  return {
    tokens_in_estimated: usage?.tokens_in_estimated ?? 0,
    tokens_out_estimated: usage?.tokens_out_estimated ?? 0,
    estimated_cost_usd: usage?.estimated_cost_usd ?? null,
    prompt_chars: usage?.prompt_chars ?? 0,
    response_chars: usage?.response_chars ?? 0,
    token_estimation_basis: usage?.token_estimation_basis ?? "char_heuristic_v1",
    cost_estimation_basis: usage?.cost_estimation_basis ?? null,
  };
}
