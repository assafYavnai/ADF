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
  InvocationAttempt,
  InvocationAttemptSessionStatus,
  InvocationParams,
  InvocationResult,
  InvocationSessionHandle,
  InvocationSessionResult,
  InvocationUsageEstimate,
} from "./types.js";

const CHARS_PER_ESTIMATED_TOKEN = 4;

const MODEL_COST_ESTIMATES: Array<{
  provider: "codex" | "claude" | "gemini";
  match: RegExp;
  input_per_1k_usd: number;
  output_per_1k_usd: number;
  basis: string;
}> = [
  {
    provider: "codex",
    match: /gpt-5\.4/i,
    input_per_1k_usd: 0.005,
    output_per_1k_usd: 0.015,
    basis: "configured_model_rate_v1",
  },
  {
    provider: "claude",
    match: /sonnet/i,
    input_per_1k_usd: 0.003,
    output_per_1k_usd: 0.015,
    basis: "configured_model_rate_v1",
  },
  {
    provider: "gemini",
    match: /gemini/i,
    input_per_1k_usd: 0.0015,
    output_per_1k_usd: 0.006,
    basis: "configured_model_rate_v1",
  },
];

class InvocationFailureError extends Error {
  readonly attempts: InvocationAttempt[];

  constructor(message: string, attempts: InvocationAttempt[]) {
    super(message);
    this.name = "InvocationFailureError";
    this.attempts = attempts;
  }
}

interface InternalCLIAttempt {
  latency_ms: number;
  success: boolean;
  session_status: InvocationAttemptSessionStatus;
  response_text?: string;
  error_message?: string;
}

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
  const primaryStart = Date.now();

  try {
    const cliResult = await callCLI(params, invocationId);
    const attempts = cliResult.attempts.map((attempt) =>
      buildInvocationAttempt({
        invocationId,
        provider: params.cli,
        model: params.model,
        reasoning: params.reasoning ?? params.effort ?? "default",
        wasFallback: false,
        sourcePath: params.source_path,
        prompt: params.prompt,
        attempt,
      })
    );
    const finalAttempt = attempts[attempts.length - 1];
    if (!finalAttempt) {
      throw new Error("LLM invocation completed without any recorded attempt");
    }

    return {
      provenance: finalAttempt.provenance,
      response: cliResult.response,
      latency_ms: attempts.reduce((sum, attempt) => sum + attempt.latency_ms, 0),
      session: cliResult.session,
      usage: finalAttempt.usage,
      attempts,
    };
  } catch (primaryErr) {
    const primaryAttempts = extractInvocationAttempts(primaryErr);
    if (!params.fallback) {
      throw wrapInvocationFailure(
        primaryErr,
        primaryAttempts.length > 0
          ? primaryAttempts
          : [buildFailedInvocationAttempt({
              invocationId,
              provider: params.cli,
              model: params.model,
              reasoning: params.reasoning ?? params.effort ?? "default",
              wasFallback: false,
              sourcePath: params.source_path,
              sessionStatus: inferRequestedSessionStatus(params),
              latencyMs: Date.now() - primaryStart,
            }, primaryErr)],
      );
    }

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
      const fallbackAttempts = cliResult.attempts.map((attempt) =>
        buildInvocationAttempt({
          invocationId: fallbackId,
          provider: params.fallback!.cli,
          model: params.fallback!.model,
          reasoning: params.fallback!.reasoning ?? params.fallback!.effort ?? "default",
          wasFallback: true,
          sourcePath: params.source_path,
          prompt: params.prompt,
          attempt,
        })
      );
      const attempts = [...primaryAttempts, ...fallbackAttempts];
      const finalAttempt = attempts[attempts.length - 1];
      if (!finalAttempt) {
        throw new Error("Fallback LLM invocation completed without any recorded attempt");
      }

      return {
        provenance: finalAttempt.provenance,
        response: cliResult.response,
        latency_ms: attempts.reduce((sum, attempt) => sum + attempt.latency_ms, 0),
        session: cliResult.session,
        usage: finalAttempt.usage,
        attempts,
      };
    } catch (fallbackErr) {
      const primaryMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      const fallbackAttempts = extractInvocationAttempts(fallbackErr);
      throw new InvocationFailureError(
        `Both primary (${params.cli}/${params.model}) and fallback (${params.fallback.cli}/${params.fallback.model}) failed.\n` +
          `Primary: ${primaryMsg}\nFallback: ${fallbackMsg}`,
        [
          ...primaryAttempts,
          ...(fallbackAttempts.length > 0
            ? fallbackAttempts
            : [buildFailedInvocationAttempt({
                invocationId: fallbackId,
                provider: params.fallback.cli,
                model: params.fallback.model,
                reasoning: params.fallback.reasoning ?? params.fallback.effort ?? "default",
                wasFallback: true,
                sourcePath: params.source_path,
                sessionStatus: inferRequestedSessionStatus({
                  ...params,
                  cli: params.fallback.cli,
                  model: params.fallback.model,
                  reasoning: params.fallback.reasoning,
                  effort: params.fallback.effort,
                  session: undefined,
                }),
                latencyMs: Date.now() - fallbackStart,
              }, fallbackErr)]),
        ]
      );
    }
  }
}

function inferRequestedSessionStatus(params: InvocationParams): InvocationAttemptSessionStatus {
  if (!params.session?.persist) {
    return "none";
  }
  return params.session.handle ? "resumed" : "fresh";
}

function buildInvocationAttempt(params: {
  invocationId: string;
  provider: "codex" | "claude" | "gemini";
  model: string;
  reasoning: string;
  wasFallback: boolean;
  sourcePath: string;
  prompt: string;
  attempt: InternalCLIAttempt;
}): InvocationAttempt {
  return {
    provenance: createLLMProvenance(
      params.invocationId,
      params.provider,
      params.model,
      params.reasoning,
      params.wasFallback,
      params.sourcePath
    ),
    latency_ms: params.attempt.latency_ms,
    success: params.attempt.success,
    session_status: params.attempt.session_status,
    error_message: params.attempt.error_message,
    usage: params.attempt.success && params.attempt.response_text !== undefined
      ? estimateInvocationUsage(params.provider, params.model, params.prompt, params.attempt.response_text)
      : undefined,
  };
}

function buildFailedInvocationAttempt(
  params: {
    invocationId: string;
    provider: "codex" | "claude" | "gemini";
    model: string;
    reasoning: string;
    wasFallback: boolean;
    sourcePath: string;
    sessionStatus: InvocationAttemptSessionStatus;
    latencyMs: number;
  },
  error: unknown
): InvocationAttempt {
  return {
    provenance: createLLMProvenance(
      params.invocationId,
      params.provider,
      params.model,
      params.reasoning,
      params.wasFallback,
      params.sourcePath
    ),
    latency_ms: params.latencyMs,
    success: false,
    session_status: params.sessionStatus,
    error_message: error instanceof Error ? error.message : String(error),
  };
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

function wrapInvocationFailure(error: unknown, attempts: InvocationAttempt[]): InvocationFailureError {
  if (error instanceof InvocationFailureError) {
    return error;
  }
  return new InvocationFailureError(error instanceof Error ? error.message : String(error), attempts);
}

function estimateInvocationUsage(
  provider: "codex" | "claude" | "gemini",
  model: string,
  prompt: string,
  response: string
): InvocationUsageEstimate {
  const promptChars = prompt.length;
  const responseChars = response.length;
  const tokensIn = Math.max(1, Math.ceil(promptChars / CHARS_PER_ESTIMATED_TOKEN));
  const tokensOut = Math.max(1, Math.ceil(responseChars / CHARS_PER_ESTIMATED_TOKEN));
  const matchedRate = MODEL_COST_ESTIMATES.find((entry) => entry.provider === provider && entry.match.test(model));
  const estimatedCostUsd = matchedRate
    ? Number((((tokensIn / 1000) * matchedRate.input_per_1k_usd) + ((tokensOut / 1000) * matchedRate.output_per_1k_usd)).toFixed(6))
    : undefined;

  return {
    prompt_chars: promptChars,
    response_chars: responseChars,
    tokens_in_estimated: tokensIn,
    tokens_out_estimated: tokensOut,
    estimated_cost_usd: estimatedCostUsd,
    token_estimation_basis: "char_heuristic_v1",
    cost_estimation_basis: matchedRate?.basis,
  };
}

// --- CLI-specific dispatch ---

interface CLIResult {
  response: string;
  session: InvocationSessionResult | null;
  attempts: InternalCLIAttempt[];
}

async function callCLI(params: InvocationParams, invocationId: string): Promise<CLIResult> {
  switch (params.cli) {
    case "codex":
      return callCodex(params, invocationId);
    case "claude":
      return callClaude(params, invocationId);
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
    const attempts: InternalCLIAttempt[] = [];
    let codexResult: CLIResult | null = null;

    if (sessionRequest?.persist && sessionHandle) {
      const resumedStart = Date.now();
      try {
        codexResult = await runCodexWithSession(params, promptFile, tmpFile, "resumed", sessionHandle);
        attempts.push({
          latency_ms: Date.now() - resumedStart,
          success: true,
          session_status: "resumed",
          response_text: codexResult.response,
        });
      } catch (error) {
        attempts.push({
          latency_ms: Date.now() - resumedStart,
          success: false,
          session_status: "resumed",
          error_message: error instanceof Error ? error.message : String(error),
        });
        if (!shouldRetryWithFreshSession("codex", error)) {
          throw new InvocationFailureError(
            error instanceof Error ? error.message : String(error),
            attempts.map((attempt) => buildInvocationAttempt({
              invocationId,
              provider: "codex",
              model: params.model,
              reasoning: params.reasoning ?? params.effort ?? "default",
              wasFallback: false,
              sourcePath: params.source_path,
              prompt: params.prompt,
              attempt,
            }))
          );
        }
        const replacedStart = Date.now();
        codexResult = await runCodexWithSession(params, promptFile, tmpFile, "replaced");
        attempts.push({
          latency_ms: Date.now() - replacedStart,
          success: true,
          session_status: "replaced",
          response_text: codexResult.response,
        });
      }
    } else if (sessionRequest?.persist) {
      const freshStart = Date.now();
      codexResult = await runCodexWithSession(params, promptFile, tmpFile, "fresh");
      attempts.push({
        latency_ms: Date.now() - freshStart,
        success: true,
        session_status: "fresh",
        response_text: codexResult.response,
      });
    } else {
      const noSessionStart = Date.now();
      codexResult = await runCodexWithoutSession(params, promptFile, tmpFile);
      attempts.push({
        latency_ms: Date.now() - noSessionStart,
        success: true,
        session_status: "none",
        response_text: codexResult.response,
      });
    }

    return {
      response: codexResult.response,
      session: codexResult.session,
      attempts,
    };
  } finally {
    await unlink(tmpFile).catch(() => {});
    await unlink(promptFile).catch(() => {});
  }
}

async function callClaude(params: InvocationParams, invocationId: string): Promise<CLIResult> {
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
    const resumedStart = Date.now();
    try {
      const resumedResult = await runClaudeWithSession(params, args, "resumed", sessionHandle);
      return {
        response: resumedResult.response,
        session: resumedResult.session,
        attempts: [{
          latency_ms: Date.now() - resumedStart,
          success: true,
          session_status: "resumed",
          response_text: resumedResult.response,
        }],
      };
    } catch (error) {
      const attempts: InternalCLIAttempt[] = [{
        latency_ms: Date.now() - resumedStart,
        success: false,
        session_status: "resumed",
        error_message: error instanceof Error ? error.message : String(error),
      }];
      if (!shouldRetryWithFreshSession("claude", error)) {
        throw new InvocationFailureError(
          error instanceof Error ? error.message : String(error),
          attempts.map((attempt) => buildInvocationAttempt({
            invocationId,
            provider: "claude",
            model: params.model,
            reasoning: params.reasoning ?? params.effort ?? "default",
            wasFallback: false,
            sourcePath: params.source_path,
            prompt: params.prompt,
            attempt,
          }))
        );
      }
      const replacedStart = Date.now();
      const replacedResult = await runClaudeWithSession(params, args, "replaced");
      attempts.push({
        latency_ms: Date.now() - replacedStart,
        success: true,
        session_status: "replaced",
        response_text: replacedResult.response,
      });
      return {
        response: replacedResult.response,
        session: replacedResult.session,
        attempts,
      };
    }
  }

  if (sessionRequest?.persist) {
    const freshStart = Date.now();
    const freshResult = await runClaudeWithSession(params, args, "fresh");
    return {
      response: freshResult.response,
      session: freshResult.session,
      attempts: [{
        latency_ms: Date.now() - freshStart,
        success: true,
        session_status: "fresh",
        response_text: freshResult.response,
      }],
    };
  }

  args.push("--no-session-persistence");

  const noSessionStart = Date.now();
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
    attempts: [{
      latency_ms: Date.now() - noSessionStart,
      success: true,
      session_status: "none",
      response_text: result.stdout,
    }],
  };
}

async function callGemini(params: InvocationParams): Promise<CLIResult> {
  const args = ["--model", params.model, "--output-format", "json"];

  if (params.bypass) {
    args.push("--approval-mode", "yolo");
  }

  // Pipe prompt via stdin to avoid shell injection (B-1 fix)
  const noSessionStart = Date.now();
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
    attempts: [{
      latency_ms: Date.now() - noSessionStart,
      success: true,
      session_status: "none",
      response_text: result.stdout,
    }],
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
    attempts: [],
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
    attempts: [],
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
    attempts: [],
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
