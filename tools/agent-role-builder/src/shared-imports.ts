/**
 * Local re-exports from shared/ to avoid cross-package import issues.
 * These mirror the shared/ types for use within agent-role-builder.
 */

import { z } from "zod";
import { execFile } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
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
  invocationId: string, provider: Provider, model: string,
  reasoning: string, wasFallback: boolean, sourcePath: string
): Provenance {
  return {
    invocation_id: invocationId, provider, model, reasoning,
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

  try {
    const response = await callCLI(params, invocationId);
    return {
      provenance: createLLMProvenance(invocationId, params.cli as Provider, params.model,
        params.reasoning ?? params.effort ?? "default", false, params.source_path),
      response,
      latency_ms: Date.now() - start,
    };
  } catch (primaryErr) {
    if (!params.fallback) throw primaryErr;
    const fallbackId = randomUUID();
    const fbStart = Date.now();
    try {
      const fbParams: InvocationParams = {
        cli: params.fallback.cli, model: params.fallback.model,
        reasoning: params.fallback.reasoning, effort: params.fallback.effort,
        bypass: params.fallback.bypass, timeout_ms: params.fallback.timeout_ms ?? params.timeout_ms,
        prompt: params.prompt, source_path: params.source_path,
      };
      const response = await callCLI(fbParams, fallbackId);
      return {
        provenance: createLLMProvenance(fallbackId, params.fallback.cli as Provider,
          params.fallback.model, params.fallback.reasoning ?? params.fallback.effort ?? "default",
          true, params.source_path),
        response,
        latency_ms: Date.now() - fbStart,
      };
    } catch (fbErr) {
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
  try {
    const args = ["exec", "-m", params.model];
    if (params.reasoning) args.push("-c", `model_reasoning_effort="${params.reasoning}"`);
    if (params.sandbox) args.push("-s", params.sandbox);
    if (params.bypass) args.push("--dangerously-bypass-approvals-and-sandbox");
    args.push("-o", tmpFile, "--ephemeral", "--skip-git-repo-check");

    const { spawn } = await import("node:child_process");
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("codex", args, {
        timeout: params.timeout_ms ?? 120_000,
        shell: true, env: { ...process.env },
      });
      let stderr = "";
      proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
      proc.on("close", (code: number | null) => {
        if (code !== 0) reject(new Error(`codex failed (exit ${code}): ${stderr}`));
        else resolve();
      });
      proc.on("error", (err: Error) => reject(new Error(`codex failed: ${err.message}`)));
      proc.stdin?.write(params.prompt);
      proc.stdin?.end();
    });
    return (await readFile(tmpFile, "utf-8")).trim();
  } finally { await unlink(tmpFile).catch(() => {}); }
}

async function callClaude(params: InvocationParams): Promise<string> {
  const args = ["--print", "--model", params.model];
  if (params.effort) args.push("--effort", params.effort);
  if (params.bypass) args.push("--dangerously-skip-permissions");
  args.push("--no-session-persistence");

  const { spawn } = await import("node:child_process");
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", args, {
      timeout: params.timeout_ms ?? 120_000,
      shell: true, env: { ...process.env },
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
  args.push(params.prompt);
  return (await execPromise("gemini", args, params.timeout_ms ?? 120_000)).trim();
}

function execPromise(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024,
      shell: true, env: { ...process.env },
    }, (err, stdout, stderr) => {
      if (err) { reject(new Error(`${command} failed: ${err.message}${stderr ? `\n${stderr}` : ""}`)); return; }
      resolve(stdout);
    });
  });
}

// --- Telemetry ---

const telemetryBuffer: TelemetryEvent[] = [];
export interface TelemetryEvent {
  provenance: Provenance;
  category: string;
  operation: string;
  latency_ms: number;
  success: boolean;
  board_rounds?: number;
  participants?: number;
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
