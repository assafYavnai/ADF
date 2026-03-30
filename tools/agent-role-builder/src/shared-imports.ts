/**
 * Local re-exports from shared/ to avoid cross-package import issues.
 * These mirror the shared/ types for use within agent-role-builder.
 */

import { z } from "zod";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
const TEMP_DIR = process.env.USERPROFILE
  ? `${process.env.USERPROFILE}\\AppData\\Local\\Temp`
  : process.env.TEMP ?? process.env.TMP ?? ".";
import { randomUUID } from "node:crypto";

// --- Provenance ---

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

export function createLLMProvenance(
  invocationId: string, provider: string, model: string,
  reasoning: string, wasFallback: boolean, sourcePath: string
): Provenance {
  return {
    invocation_id: invocationId, provider: Provider.parse(provider), model, reasoning,
    was_fallback: wasFallback, source_path: sourcePath,
    timestamp: new Date().toISOString(),
  };
}

// --- LLM Invoker ---

export interface InvocationParams {
  cli: "codex" | "claude" | "gemini";
  model: string;
  reasoning?: string;
  effort?: string;
  sandbox?: string;
  bypass?: boolean;
  timeout_ms?: number;
  prompt: string;
  source_path: string;
  fallback?: {
    cli: "codex" | "claude" | "gemini";
    model: string;
    reasoning?: string;
    effort?: string;
    bypass?: boolean;
    timeout_ms?: number;
  };
}

export interface InvocationResult {
  provenance: Provenance;
  response: string;
  latency_ms: number;
}

export async function invoke(params: InvocationParams): Promise<InvocationResult> {
  const invocationId = randomUUID();
  const start = Date.now();
  const primaryProvenance = createLLMProvenance(
    invocationId,
    params.cli,
    params.model,
    params.reasoning ?? params.effort ?? "default",
    false,
    params.source_path
  );

  try {
    const response = await callCLI(params, invocationId);
    const latency_ms = Date.now() - start;
    emit({
      provenance: primaryProvenance,
      category: "llm",
      operation: `invoke-${params.cli}`,
      latency_ms,
      success: true,
      metadata: {
        source_path: params.source_path,
        fallback_triggered: false,
      },
    });
    return {
      provenance: primaryProvenance,
      response,
      latency_ms,
    };
  } catch (primaryErr) {
    emit({
      provenance: primaryProvenance,
      category: "llm",
      operation: `invoke-${params.cli}`,
      latency_ms: Date.now() - start,
      success: false,
      metadata: {
        source_path: params.source_path,
        fallback_triggered: Boolean(params.fallback),
        error: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
      },
    });
    if (!params.fallback) throw primaryErr;
    const fallbackId = randomUUID();
    const fbStart = Date.now();
    const fallbackProvenance = createLLMProvenance(
      fallbackId,
      params.fallback.cli,
      params.fallback.model,
      params.fallback.reasoning ?? params.fallback.effort ?? "default",
      true,
      params.source_path
    );
    try {
      const fbParams: InvocationParams = {
        cli: params.fallback.cli, model: params.fallback.model,
        reasoning: params.fallback.reasoning, effort: params.fallback.effort,
        bypass: params.fallback.bypass, timeout_ms: params.fallback.timeout_ms ?? params.timeout_ms,
        prompt: params.prompt, source_path: params.source_path,
      };
      const response = await callCLI(fbParams, fallbackId);
      const latency_ms = Date.now() - fbStart;
      console.warn(
        `[invoker] Fallback triggered: primary=${params.cli}/${params.model} fallback=${params.fallback.cli}/${params.fallback.model} source=${params.source_path}`
      );
      emit({
        provenance: fallbackProvenance,
        category: "llm",
        operation: `invoke-${params.fallback.cli}`,
        latency_ms,
        success: true,
        metadata: {
          source_path: params.source_path,
          fallback_triggered: true,
          warning_level: "warning",
          primary_provider: params.cli,
          primary_model: params.model,
          fallback_provider: params.fallback.cli,
          fallback_model: params.fallback.model,
        },
      });
      return {
        provenance: fallbackProvenance,
        response,
        latency_ms,
      };
    } catch (fbErr) {
      emit({
        provenance: fallbackProvenance,
        category: "llm",
        operation: `invoke-${params.fallback.cli}`,
        latency_ms: Date.now() - fbStart,
        success: false,
        metadata: {
          source_path: params.source_path,
          fallback_triggered: true,
          warning_level: "warning",
          error: fbErr instanceof Error ? fbErr.message : String(fbErr),
        },
      });
      throw new Error(`Both primary and fallback failed.`);
    }
  }
}

async function callCLI(params: InvocationParams, invocationId: string): Promise<string> {
  switch (params.cli) {
    case "codex": return callCodex(params, invocationId);
    case "claude": return callClaude(params);
    case "gemini": return callGemini(params);
    default: throw new Error(`Unknown CLI: ${params.cli}`);
  }
}

async function callCodex(params: InvocationParams, id: string): Promise<string> {
  const tmpFile = join(TEMP_DIR, `adf-codex-${id}.txt`);
  const promptFile = join(TEMP_DIR, `adf-codex-prompt-${id}.txt`);
  try {
    // Keep this critical Windows prompt-delivery path aligned with shared/llm-invoker/invoker.ts.
    // Codex stdin has regressed repeatedly in copied invoker code.
    await writeFile(promptFile, params.prompt, "utf-8");

    const args = ["exec", "-m", params.model];
    if (params.reasoning) args.push("-c", `model_reasoning_effort="${params.reasoning}"`);
    if (params.sandbox) args.push("-s", params.sandbox);
    if (params.bypass) args.push("--dangerously-bypass-approvals-and-sandbox");
    args.push("-o", tmpFile, "--ephemeral", "--skip-git-repo-check");
    const { spawn } = await import("node:child_process");

    const escapedPromptPath = promptFile.replace(/\\/g, "/");
    const codexArgs = args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(" ");
    const shellCmd = `PROMPT=$(cat "${escapedPromptPath}") && codex ${codexArgs} "$PROMPT"`;

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("bash", ["-c", shellCmd], {
        timeout: params.timeout_ms ?? 120_000,
        env: { ...process.env },
      });
      let stderr = "";
      proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
      proc.on("close", (code: number | null) => {
        if (code !== 0) reject(new Error(`codex failed (exit ${code}): ${stderr}`));
        else resolve();
      });
      proc.on("error", (err: Error) => reject(new Error(`codex failed: ${err.message}`)));
    });
    return (await readFile(tmpFile, "utf-8")).trim();
  } finally {
    await unlink(tmpFile).catch(() => {});
    await unlink(promptFile).catch(() => {});
  }
}

async function callClaude(params: InvocationParams): Promise<string> {
  const args = ["--print", "--model", params.model];
  if (params.effort) args.push("--effort", params.effort);
  if (params.bypass) args.push("--dangerously-skip-permissions");
  args.push("--no-session-persistence");

  const { spawn } = await import("node:child_process");
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", args, {
      shell: true,   // Required: Windows .cmd resolution (prompt piped via stdin, not in args)
      timeout: params.timeout_ms ?? 120_000,
      env: { ...process.env },
    });
    let stdout = "", stderr = "";
    proc.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code: number | null) => {
      if (code !== 0) reject(new Error(`claude failed (exit ${code}): ${stderr}`));
      else resolve(stdout.trim());
    });
    proc.on("error", (err: Error) => reject(new Error(`claude failed: ${err.message}`)));
    proc.stdin?.write(params.prompt);
    proc.stdin?.end();
  });
}

async function callGemini(params: InvocationParams): Promise<string> {
  const args = ["--model", params.model, "--output-format", "json"];
  if (params.bypass) args.push("--approval-mode", "yolo");

  const { spawn } = await import("node:child_process");
  return new Promise((resolve, reject) => {
    const proc = spawn("gemini", args, {
      shell: true,   // Required: Windows .cmd resolution (prompt piped via stdin, not in args)
      timeout: params.timeout_ms ?? 120_000,
      env: { ...process.env },
    });
    let stdout = "", stderr = "";
    proc.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code: number | null) => {
      if (code !== 0) reject(new Error(`gemini failed (exit ${code}): ${stderr}`));
      else resolve(stdout.trim());
    });
    proc.on("error", (err: Error) => reject(new Error(`gemini failed: ${err.message}`)));
    proc.stdin?.write(params.prompt);
    proc.stdin?.end();
  });
}

// --- Telemetry ---

const telemetryBuffer: TelemetryEvent[] = [];
export interface TelemetryEvent {
  provenance: Provenance;
  category: "llm" | "memory" | "tool" | "turn" | "system";
  operation: string;
  latency_ms: number;
  success: boolean;
  board_rounds?: number;
  participants?: number;
  tokens_in?: number;
  tokens_out?: number;
  estimated_cost_usd?: number;
  metadata?: Record<string, unknown>;
}

export function emit(event: TelemetryEvent): void {
  telemetryBuffer.push(event);
  // In standalone mode, telemetry accumulates in buffer.
  // When integrated with memory engine, this gets replaced with the real sink.
}

export function getTelemetryBuffer(): TelemetryEvent[] {
  return [...telemetryBuffer];
}

export function clearTelemetryBuffer(): void {
  telemetryBuffer.length = 0;
}
