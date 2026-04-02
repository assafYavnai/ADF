import { z } from "zod";
/**
 * Provenance — identity and traceability for every operation in ADF.
 *
 * Attached to: DB writes, MCP calls, thread events, telemetry,
 * commits, tool artifacts. No exceptions.
 */
export declare const Provider: z.ZodEnum<["codex", "claude", "gemini", "openai", "system"]>;
export type Provider = z.infer<typeof Provider>;
export declare const ProvenanceSchema: z.ZodObject<{
    invocation_id: z.ZodString;
    provider: z.ZodEnum<["codex", "claude", "gemini", "openai", "system"]>;
    model: z.ZodString;
    reasoning: z.ZodString;
    was_fallback: z.ZodBoolean;
    source_path: z.ZodString;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    invocation_id: string;
    provider: "codex" | "claude" | "gemini" | "openai" | "system";
    model: string;
    reasoning: string;
    was_fallback: boolean;
    source_path: string;
    timestamp: string;
}, {
    invocation_id: string;
    provider: "codex" | "claude" | "gemini" | "openai" | "system";
    model: string;
    reasoning: string;
    was_fallback: boolean;
    source_path: string;
    timestamp: string;
}>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
/**
 * Sentinel for pre-provenance data (legacy entries, backfills).
 */
export declare const LEGACY_PROVENANCE: Provenance;
/**
 * Create provenance for non-LLM operations (deterministic code, system actions).
 */
export declare function createSystemProvenance(sourcePath: string): Provenance;
/**
 * Create provenance from an LLM invocation result.
 */
export declare function createLLMProvenance(invocationId: string, provider: string, model: string, reasoning: string, wasFallback: boolean, sourcePath: string): Provenance;
//# sourceMappingURL=types.d.ts.map