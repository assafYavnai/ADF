import { execFile } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createLLMProvenance, type Provenance, type Provider } from "../provenance/types.js";
import type { InvocationParams, InvocationResult } from "./types.js";

/**
 * Generic LLM CLI Invoker.
 *
 * Takes invocation params → builds CLI-specific args → spawns process →
 * captures output → assigns provenance → handles fallback.
 *
 * Every caller must pass source_path to identify themselves.
 */
export async function invoke(params: InvocationParams): Promise<InvocationResult> {
  const invocationId = randomUUID();
  const start = Date.now();

  try {
    const response = await callCLI(params, invocationId);
    const latency_ms = Date.now() - start;

    return {
      provenance: createLLMProvenance(
        invocationId,
        params.cli as Provider,
        params.model,
        params.reasoning ?? params.effort ?? "default",
        false,
        params.source_path
      ),
      response,
      latency_ms,
    };
  } catch (primaryErr) {
    if (!params.fallback) throw primaryErr;

    const fallbackId = randomUUID();
    const fallbackStart = Date.now();

    try {
      const fallbackParams: InvocationParams = {
        cli: params.fallback.cli,
        model: params.fallback.model,
        reasoning: params.fallback.reasoning,
        effort: params.fallback.effort,
        bypass: params.fallback.bypass ?? false,
        timeout_ms: params.fallback.timeout_ms ?? params.timeout_ms ?? 120_000,
        prompt: params.prompt,
        source_path: params.source_path,
      };

      const response = await callCLI(fallbackParams, fallbackId);
      const latency_ms = Date.now() - fallbackStart;

      return {
        provenance: createLLMProvenance(
          fallbackId,
          params.fallback.cli as Provider,
          params.fallback.model,
          params.fallback.reasoning ?? params.fallback.effort ?? "default",
          true,
          params.source_path
        ),
        response,
        latency_ms,
      };
    } catch (fallbackErr) {
      const primaryMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      throw new Error(
        `Both primary (${params.cli}/${params.model}) and fallback (${params.fallback.cli}/${params.fallback.model}) failed.\n` +
          `Primary: ${primaryMsg}\nFallback: ${fallbackMsg}`
      );
    }
  }
}

// --- CLI-specific dispatch ---

async function callCLI(params: InvocationParams, invocationId: string): Promise<string> {
  switch (params.cli) {
    case "codex":
      return callCodex(params, invocationId);
    case "claude":
      return callClaude(params);
    case "gemini":
      return callGemini(params);
    default:
      throw new Error(`Unknown CLI provider: ${params.cli}`);
  }
}

async function callCodex(params: InvocationParams, invocationId: string): Promise<string> {
  const tmpFile = join(tmpdir(), `adf-codex-${invocationId}.txt`);

  try {
    const args = ["exec", "-m", params.model];

    if (params.reasoning) {
      args.push("-c", `model_reasoning_effort="${params.reasoning}"`);
    }
    if (params.sandbox) {
      args.push("-s", params.sandbox);
    }
    if (params.bypass) {
      args.push("--dangerously-bypass-approvals-and-sandbox");
    }

    args.push("-o", tmpFile, "--ephemeral", "--skip-git-repo-check");
    args.push(params.prompt);

    await execPromise("codex", args, params.timeout_ms ?? 120_000);

    const result = await readFile(tmpFile, "utf-8");
    return result.trim();
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

async function callClaude(params: InvocationParams): Promise<string> {
  const args = ["--print", "--model", params.model];

  if (params.effort) {
    args.push("--effort", params.effort);
  }
  if (params.bypass) {
    args.push("--dangerously-skip-permissions");
  }

  args.push("--prompt", params.prompt);

  const result = await execPromise("claude", args, params.timeout_ms ?? 120_000);
  return result.trim();
}

async function callGemini(params: InvocationParams): Promise<string> {
  const args = ["--model", params.model, "--output-format", "json"];

  if (params.bypass) {
    args.push("--approval-mode", "yolo");
  }

  args.push(params.prompt);

  const result = await execPromise("gemini", args, params.timeout_ms ?? 120_000);
  return result.trim();
}

// --- Shared exec helper ---

function execPromise(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(
            new Error(`${command} failed: ${err.message}${stderr ? `\nstderr: ${stderr}` : ""}`)
          );
          return;
        }
        resolve(stdout);
      }
    );
  });
}
