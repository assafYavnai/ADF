import { z } from "zod";
import { randomUUID } from "node:crypto";

/**
 * Provenance — identity and traceability for every operation in ADF.
 *
 * Attached to: DB writes, MCP calls, thread events, telemetry,
 * commits, tool artifacts. No exceptions.
 */

export const Provider = z.enum(["codex", "claude", "gemini", "system"]);
export type Provider = z.infer<typeof Provider>;

export const ProvenanceSchema = z.object({
  invocation_id: z.string().uuid(),
  provider: Provider,
  model: z.string(),
  reasoning: z.string(),
  was_fallback: z.boolean(),
  source_path: z.string(),
  timestamp: z.string().datetime(),
});

export type Provenance = z.infer<typeof ProvenanceSchema>;

/**
 * Sentinel for pre-provenance data (legacy entries, backfills).
 */
export const LEGACY_PROVENANCE: Provenance = {
  invocation_id: "00000000-0000-0000-0000-000000000000",
  provider: "system",
  model: "none",
  reasoning: "none",
  was_fallback: false,
  source_path: "system/pre-provenance",
  timestamp: "2026-03-27T00:00:00.000Z",
};

/**
 * Create provenance for non-LLM operations (deterministic code, system actions).
 */
export function createSystemProvenance(sourcePath: string): Provenance {
  return {
    invocation_id: randomUUID(),
    provider: "system",
    model: "none",
    reasoning: "none",
    was_fallback: false,
    source_path: sourcePath,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create provenance from an LLM invocation result.
 */
export function createLLMProvenance(
  invocationId: string,
  provider: Provider,
  model: string,
  reasoning: string,
  wasFallback: boolean,
  sourcePath: string
): Provenance {
  return {
    invocation_id: invocationId,
    provider,
    model,
    reasoning,
    was_fallback: wasFallback,
    source_path: sourcePath,
    timestamp: new Date().toISOString(),
  };
}
