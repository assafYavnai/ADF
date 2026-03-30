import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { runManagedProcess } from "./managed-process.js";
// Use Windows user temp, not MSYS2 /tmp which may not be accessible to child processes
const TEMP_DIR = process.env.USERPROFILE
  ? `${process.env.USERPROFILE}\\AppData\\Local\\Temp`
  : process.env.TEMP ?? process.env.TMP ?? ".";
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
        params.cli,
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
          params.fallback.cli,
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
  const tmpFile = join(TEMP_DIR, `adf-codex-${invocationId}.txt`);
  // Bug 1 fix: Codex stdin does NOT reliably deliver full prompts on Windows.
  // Write the prompt to a temp file and pass it as a CLI argument via shell variable.
  const promptFile = join(TEMP_DIR, `adf-codex-prompt-${invocationId}.txt`);

  try {
    await writeFile(promptFile, params.prompt, "utf-8");

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

    // Pass prompt via temp file loaded into shell variable (Codex stdin is unreliable on Windows)
    const escapedPromptPath = promptFile.replace(/\\/g, "/");
    // Build the full shell command: read prompt from file, pass as last positional arg
    const codexArgs = args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(" ");
    const shellCmd = `PROMPT=$(cat "${escapedPromptPath}") && codex ${codexArgs} "$PROMPT"`;

    await runManagedProcess({
      command: "bash",
      args: ["-c", shellCmd],
      timeoutMs: params.timeout_ms ?? 120_000,
      label: "codex",
      env: { ...process.env },
    });

    const result = await readFile(tmpFile, "utf-8");
    return result.trim();
  } finally {
    await unlink(tmpFile).catch(() => {});
    await unlink(promptFile).catch(() => {});
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

  args.push("--no-session-persistence");

  // Pipe prompt via stdin to avoid shell argument length limits
  const result = await runManagedProcess({
    command: "claude",
    args,
    timeoutMs: params.timeout_ms ?? 120_000,
    label: "claude",
    env: { ...process.env },
    shell: true, // Required: Windows .cmd resolution (prompt piped via stdin, not in args)
    stdinText: params.prompt,
  });
  return result.stdout;
}

async function callGemini(params: InvocationParams): Promise<string> {
  const args = ["--model", params.model, "--output-format", "json"];

  if (params.bypass) {
    args.push("--approval-mode", "yolo");
  }

  // Pipe prompt via stdin to avoid shell injection (B-1 fix)
  const result = await runManagedProcess({
    command: "gemini",
    args,
    timeoutMs: params.timeout_ms ?? 120_000,
    label: "gemini",
    env: { ...process.env },
    shell: true, // Required: Windows .cmd resolution (prompt piped via stdin, not in args)
    stdinText: params.prompt,
  });
  return result.stdout;
}
