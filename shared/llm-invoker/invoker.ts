import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { runManagedProcess } from "./managed-process.js";
import {
  buildInvocationSessionResult,
  createClaudeFreshSessionHandle,
  extractCodexThreadIdFromJsonOutput,
  parseClaudePrintJson,
  shouldRetryWithFreshSession,
} from "./session.js";
// Use Windows user temp, not MSYS2 /tmp which may not be accessible to child processes
const TEMP_DIR = process.env.USERPROFILE
  ? `${process.env.USERPROFILE}\\AppData\\Local\\Temp`
  : process.env.TEMP ?? process.env.TMP ?? ".";
import { randomUUID } from "node:crypto";
import { createLLMProvenance } from "../provenance/types.js";
import type {
  InvocationParams,
  InvocationResult,
  InvocationSessionHandle,
  InvocationSessionResult,
} from "./types.js";

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
    const cliResult = await callCLI(params, invocationId);
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
      response: cliResult.response,
      latency_ms,
      session: cliResult.session,
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

      const cliResult = await callCLI(fallbackParams, fallbackId);
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
        response: cliResult.response,
        latency_ms,
        session: cliResult.session,
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

interface CLIResult {
  response: string;
  session: InvocationSessionResult | null;
}

async function callCLI(params: InvocationParams, invocationId: string): Promise<CLIResult> {
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

async function callCodex(params: InvocationParams, invocationId: string): Promise<CLIResult> {
  const tmpFile = join(TEMP_DIR, `adf-codex-${invocationId}.txt`);
  // Bug 1 fix: Codex stdin does NOT reliably deliver full prompts on Windows.
  // Write the prompt to a temp file and pass it as a CLI argument via shell variable.
  const promptFile = join(TEMP_DIR, `adf-codex-prompt-${invocationId}.txt`);

  try {
    await writeFile(promptFile, params.prompt, "utf-8");

    const sessionRequest = params.session;
    const sessionHandle = selectCompatibleSessionHandle(sessionRequest?.handle, "codex", params.model);
    let codexResult: CLIResult | null = null;

    if (sessionRequest?.persist && sessionHandle) {
      try {
        codexResult = await runCodexWithSession(params, promptFile, tmpFile, "resumed", sessionHandle);
      } catch (error) {
        if (!shouldRetryWithFreshSession("codex", error)) {
          throw error;
        }
        codexResult = await runCodexWithSession(params, promptFile, tmpFile, "replaced");
      }
    } else if (sessionRequest?.persist) {
      codexResult = await runCodexWithSession(params, promptFile, tmpFile, "fresh");
    } else {
      codexResult = await runCodexWithoutSession(params, promptFile, tmpFile);
    }

    return codexResult;
  } finally {
    await unlink(tmpFile).catch(() => {});
    await unlink(promptFile).catch(() => {});
  }
}

async function callClaude(params: InvocationParams): Promise<CLIResult> {
  const args = ["--print", "--model", params.model];

  if (params.effort) {
    args.push("--effort", params.effort);
  }
  if (params.bypass) {
    args.push("--dangerously-skip-permissions");
  }

  const sessionRequest = params.session;
  const sessionHandle = selectCompatibleSessionHandle(sessionRequest?.handle, "claude", params.model);

  if (sessionRequest?.persist && sessionHandle) {
    try {
      return await runClaudeWithSession(params, args, "resumed", sessionHandle);
    } catch (error) {
      if (!shouldRetryWithFreshSession("claude", error)) {
        throw error;
      }
      return await runClaudeWithSession(params, args, "replaced");
    }
  }

  if (sessionRequest?.persist) {
    return await runClaudeWithSession(params, args, "fresh");
  }

  args.push("--no-session-persistence");

  const result = await runManagedProcess({
    command: "claude",
    args,
    timeoutMs: params.timeout_ms ?? 120_000,
    label: "claude",
    env: { ...process.env },
    shell: true, // Required: Windows .cmd resolution (prompt piped via stdin, not in args)
    stdinText: params.prompt,
  });
  return {
    response: result.stdout,
    session: null,
  };
}

async function callGemini(params: InvocationParams): Promise<CLIResult> {
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
  return {
    response: result.stdout,
    session: null,
  };
}

async function runCodexWithoutSession(
  params: InvocationParams,
  promptFile: string,
  tmpFile: string
): Promise<CLIResult> {
  const args = buildCodexArgs(params, tmpFile, false);

  await runCodexShellCommand(params, promptFile, args);

  const result = await readFile(tmpFile, "utf-8");
  return {
    response: result.trim(),
    session: null,
  };
}

async function runCodexWithSession(
  params: InvocationParams,
  promptFile: string,
  tmpFile: string,
  mode: "fresh" | "resumed" | "replaced",
  handle?: InvocationSessionHandle
): Promise<CLIResult> {
  const args = buildCodexArgs(params, tmpFile, true, handle?.session_id);
  const processResult = await runCodexShellCommand(params, promptFile, args);
  const response = (await readFile(tmpFile, "utf-8")).trim();
  const threadId = extractCodexThreadIdFromJsonOutput(processResult.stdout);
  if (!threadId) {
    throw new Error("codex session persistence enabled but no thread_id was returned in JSON output");
  }

  return {
    response,
    session: buildInvocationSessionResult(
      {
        provider: "codex",
        model: params.model,
        session_id: threadId,
        source: "provider_returned",
      },
      mode
    ),
  };
}

async function runCodexShellCommand(
  params: InvocationParams,
  promptFile: string,
  args: string[]
) {
  const escapedPromptPath = promptFile.replace(/\\/g, "/");
  const codexArgs = args.map((arg) => `"${arg.replace(/"/g, '\\"')}"`).join(" ");
  const shellCmd = `PROMPT=$(cat "${escapedPromptPath}") && codex ${codexArgs} "$PROMPT"`;

  return await runManagedProcess({
    command: "bash",
    args: ["-c", shellCmd],
    timeoutMs: params.timeout_ms ?? 120_000,
    label: "codex",
    env: { ...process.env },
  });
}

function buildCodexArgs(
  params: InvocationParams,
  tmpFile: string,
  persistentSession: boolean,
  resumeSessionId?: string
): string[] {
  const args = resumeSessionId ? ["exec", "resume", resumeSessionId] : ["exec"];

  args.push("-m", params.model);

  if (params.reasoning) {
    args.push("-c", `model_reasoning_effort="${params.reasoning}"`);
  }
  if (params.sandbox) {
    args.push("-s", params.sandbox);
  }
  if (params.bypass) {
    args.push("--dangerously-bypass-approvals-and-sandbox");
  }

  args.push("-o", tmpFile, "--skip-git-repo-check");
  if (persistentSession) {
    args.push("--json");
  } else {
    args.push("--ephemeral");
  }

  return args;
}

async function runClaudeWithSession(
  params: InvocationParams,
  baseArgs: string[],
  mode: "fresh" | "resumed" | "replaced",
  handle?: InvocationSessionHandle
): Promise<CLIResult> {
  const effectiveHandle = handle ?? createClaudeFreshSessionHandle(params.model);
  const args = [...baseArgs, "--output-format", "json"];
  if (handle) {
    args.push("--resume", handle.session_id);
  } else {
    args.push("--session-id", effectiveHandle.session_id);
  }

  const result = await runManagedProcess({
    command: "claude",
    args,
    timeoutMs: params.timeout_ms ?? 120_000,
    label: "claude",
    env: { ...process.env },
    shell: true,
    stdinText: params.prompt,
  });
  const parsed = parseClaudePrintJson(result.stdout);
  if (!parsed.sessionId) {
    throw new Error("claude session persistence enabled but no session_id was returned in JSON output");
  }

  return {
    response: parsed.response,
    session: buildInvocationSessionResult(
      {
        provider: "claude",
        model: params.model,
        session_id: parsed.sessionId,
        source: handle ? handle.source : effectiveHandle.source,
      },
      mode
    ),
  };
}

function selectCompatibleSessionHandle(
  handle: InvocationSessionHandle | null | undefined,
  provider: "codex" | "claude" | "gemini",
  model: string
): InvocationSessionHandle | null {
  if (!handle) {
    return null;
  }
  if (handle.provider !== provider) {
    throw new Error(`Invocation session handle provider mismatch: expected ${provider}, got ${handle.provider}`);
  }
  if (handle.model && handle.model !== model) {
    throw new Error(`Invocation session handle model mismatch: expected ${model}, got ${handle.model}`);
  }
  return handle;
}
