import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createLLMProvenance } from "../provenance/types.js";
import type { MetricEvent } from "../telemetry/types.js";
import { invoke } from "./invoker.js";
import {
  buildInvocationTelemetryEvent,
} from "./invoker.js";

type FakeCliInvocation = {
  provider: string;
  args: string[];
  outputPath: string | null;
  stdinLength: number;
  stdinPreview: string;
};

async function createFakeLLMEnvironment(): Promise<{
  invocationLogPath: string;
  restore: () => Promise<void>;
}> {
  const binDir = await mkdtemp(join(tmpdir(), "adf-fake-llm-"));
  const invocationLogPath = join(binDir, "invocation-log.jsonl");

const shimScript = `
const { appendFileSync, readFileSync, writeFileSync } = require("fs");

const provider = process.argv[2];
const args = process.argv.slice(3);
const logPath = process.env.ADF_FAKE_LLM_LOG_PATH;

if (!logPath) {
  process.stderr.write("missing ADF_FAKE_LLM_LOG_PATH\\n");
  process.exit(1);
}

const stdinText = readFileSync(0, "utf8");
const stdinLength = stdinText.length;
const stdinPreview = stdinText.slice(0, 120);

const indexArg = args.indexOf("-o");
const outputPath =
  indexArg >= 0 && args[indexArg + 1]
    ? args[indexArg + 1]
    : args.includes("--output-last-message")
      ? args[args.indexOf("--output-last-message") + 1]
      : null;

appendFileSync(logPath, JSON.stringify({
  provider,
  args,
  outputPath,
  stdinLength,
  stdinPreview,
}) + "\\n");

if (process.env.ADF_FAKE_LLM_SCENARIO === "codex-primary-fail" && provider === "codex") {
  process.stderr.write("simulated codex primary failure\\n");
  process.exit(1);
}

if (provider === "codex") {
  const response = process.env.ADF_FAKE_CODEX_RESPONSE ?? "codex-response";
  if (outputPath) {
    writeFileSync(outputPath, response);
  }
  process.exit(0);
}

if (provider === "claude") {
  const response = process.env.ADF_FAKE_CLAUDE_RESPONSE ?? "claude-response";
  process.stdout.write(response);
  process.exit(0);
}

process.stderr.write("unsupported provider: " + provider + "\\n");
process.exit(1);
`.trim();

  const previousPath = process.env.PATH;
  const previousLogPath = process.env.ADF_FAKE_LLM_LOG_PATH;
  const previousCodexOutput = process.env.ADF_FAKE_CODEX_RESPONSE;
  const previousClaudeOutput = process.env.ADF_FAKE_CLAUDE_RESPONSE;
  const previousScenario = process.env.ADF_FAKE_LLM_SCENARIO;

  if (process.platform === "win32") {
    const quotedNodeExecutable = `"${process.execPath.replaceAll("\"", "\"\"")}"`;
    await writeFile(join(binDir, "llm-fake-cli.cjs"), shimScript);
    await writeFile(
      join(binDir, "codex.cmd"),
      `@${quotedNodeExecutable} "%~dp0llm-fake-cli.cjs" codex %*`
    );
    await writeFile(
      join(binDir, "claude.cmd"),
      `@${quotedNodeExecutable} "%~dp0llm-fake-cli.cjs" claude %*`
    );
  } else {
    const nodeExecutable = process.execPath;
    await writeFile(join(binDir, "llm-fake-cli.cjs"), shimScript);
    await writeFile(
      join(binDir, "codex"),
      `#!/usr/bin/env sh\n"${nodeExecutable}" "$(dirname "$0")/llm-fake-cli.cjs" codex "$@"\n`
    );
    await writeFile(
      join(binDir, "claude"),
      `#!/usr/bin/env sh\n"${nodeExecutable}" "$(dirname "$0")/llm-fake-cli.cjs" claude "$@"\n`
    );
    await chmod(join(binDir, "codex"), 0o755);
    await chmod(join(binDir, "claude"), 0o755);
  }

  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  const basePath = `${systemRoot}\\System32`;
  const nodeExecutableDir = dirname(process.execPath);
  process.env.PATH = process.platform === "win32"
    ? `${binDir};${nodeExecutableDir};${basePath}`
    : `${binDir}:${previousPath ?? ""}`;
  process.env.ADF_FAKE_LLM_LOG_PATH = invocationLogPath;

  return {
    invocationLogPath,
    restore: async () => {
      process.env.PATH = previousPath ?? "";
      if (previousLogPath === undefined) {
        delete process.env.ADF_FAKE_LLM_LOG_PATH;
      } else {
        process.env.ADF_FAKE_LLM_LOG_PATH = previousLogPath;
      }
      if (previousCodexOutput === undefined) {
        delete process.env.ADF_FAKE_CODEX_RESPONSE;
      } else {
        process.env.ADF_FAKE_CODEX_RESPONSE = previousCodexOutput;
      }
      if (previousClaudeOutput === undefined) {
        delete process.env.ADF_FAKE_CLAUDE_RESPONSE;
      } else {
        process.env.ADF_FAKE_CLAUDE_RESPONSE = previousClaudeOutput;
      }
      if (previousScenario === undefined) {
        delete process.env.ADF_FAKE_LLM_SCENARIO;
      } else {
        process.env.ADF_FAKE_LLM_SCENARIO = previousScenario;
      }
      await rm(binDir, { recursive: true, force: true });
    },
  };
}

async function readInvocationLog(path: string): Promise<FakeCliInvocation[]> {
  const raw = await readFile(path, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FakeCliInvocation);
}

test("buildInvocationTelemetryEvent captures llm attempt metadata and usage", () => {
  const attempt = {
    provenance: createLLMProvenance(
      "019d45c5-0000-4000-8000-000000000001",
      "codex",
      "gpt-5.4",
      "medium",
      false,
      "shared/llm-invoker/test"
    ),
    latency_ms: 123,
    success: true,
    session_status: "resumed",
    telemetry_metadata: {
      thread_id: "thread-123",
      workflow: "direct_coo_response",
    },
    usage: {
      prompt_chars: 100,
      response_chars: 40,
      tokens_in_estimated: 25,
      tokens_out_estimated: 10,
      estimated_cost_usd: 0.0003,
      token_estimation_basis: "char_heuristic_v1",
      cost_estimation_basis: "configured_model_rate_v1",
    },
  } satisfies Parameters<typeof buildInvocationTelemetryEvent>[0];

  const directEvent = buildInvocationTelemetryEvent(attempt, 1, 2) as Extract<MetricEvent, { category: "llm" }>;
  assert.equal(directEvent.category, "llm");
  assert.equal(directEvent.operation, "invoke_attempt");
  assert.equal(directEvent.success, true);
  assert.equal(directEvent.tokens_in, 25);
  assert.equal(directEvent.tokens_out, 10);
  assert.equal(directEvent.estimated_cost_usd, 0.0003);
  assert.equal((directEvent.metadata as Record<string, unknown>).attempt_index, 1);
  assert.equal((directEvent.metadata as Record<string, unknown>).attempt_count, 2);
  assert.equal((directEvent.metadata as Record<string, unknown>).session_status, "resumed");
  assert.equal((directEvent.metadata as Record<string, unknown>).thread_id, "thread-123");
  assert.equal((directEvent.metadata as Record<string, unknown>).workflow, "direct_coo_response");

  const failedAttempt = {
    provenance: createLLMProvenance(
      "019d45c5-0000-4000-8000-000000000002",
      "claude",
      "sonnet-4.5",
      "high",
      true,
      "shared/llm-invoker/test"
    ),
    latency_ms: 456,
    success: false,
    session_status: "replaced",
    error_message: "model timed out",
    usage: {
      prompt_chars: 160,
      response_chars: 0,
      tokens_in_estimated: 40,
      tokens_out_estimated: 0,
      estimated_cost_usd: 0.00012,
      token_estimation_basis: "char_heuristic_v1",
      cost_estimation_basis: "configured_model_rate_v1",
    },
  } satisfies Parameters<typeof buildInvocationTelemetryEvent>[0];

  const failedEvent = buildInvocationTelemetryEvent(failedAttempt, 2, 2) as Extract<MetricEvent, { category: "llm" }>;
  assert.equal(failedEvent.success, false);
  assert.equal(failedEvent.tokens_in, 40);
  assert.equal(failedEvent.tokens_out, 0);
  assert.equal((failedEvent.metadata as Record<string, unknown>).attempt_index, 2);
  assert.equal((failedEvent.metadata as Record<string, unknown>).attempt_count, 2);
  assert.equal((failedEvent.metadata as Record<string, unknown>).session_status, "replaced");
  assert.equal((failedEvent.metadata as Record<string, unknown>).error_message, "model timed out");
});

test("runCodex transport sends primary prompt through stdin instead of argv", { concurrency: false }, async () => {
  const { invocationLogPath, restore } = await createFakeLLMEnvironment();
  const longPrompt = `reopened status evidence pack: ${"x".repeat(8192)}`;
  process.env.ADF_FAKE_CODEX_RESPONSE = "codex-response-ok";

  try {
    const result = await invoke({
      cli: "codex",
      model: "gpt-5.4",
      prompt: longPrompt,
      source_path: "shared/llm-invoker/invoker.test.ts",
      timeout_ms: 5_000,
    });

    const entries = await readInvocationLog(invocationLogPath);
    assert.equal(entries.length, 1);
    assert.equal(result.response, "codex-response-ok");
    assert.equal(entries[0]?.provider, "codex");
    assert.equal(entries[0]?.args.includes("-"), true);
    assert.equal(entries[0]?.args.includes(longPrompt), false);
    assert.equal(entries[0]?.stdinLength, longPrompt.length);
    assert.equal(entries[0]?.stdinPreview.includes("reopened status evidence pack"), true);
  } finally {
    await restore();
  }
});

test("failed primary codex launches falls through to successful claude fallback", { concurrency: false }, async () => {
  const { invocationLogPath, restore } = await createFakeLLMEnvironment();
  const prompt = `primary launch failure regression ${"z".repeat(2048)}`;
  process.env.ADF_FAKE_LLM_SCENARIO = "codex-primary-fail";
  process.env.ADF_FAKE_CLAUDE_RESPONSE = "claude-fallback-response";

  try {
    const result = await invoke({
      cli: "codex",
      model: "gpt-5.4",
      prompt,
      source_path: "shared/llm-invoker/invoker.test.ts",
      timeout_ms: 5_000,
      fallback: {
        cli: "claude",
        model: "opus",
      },
    });

    const entries = await readInvocationLog(invocationLogPath);
    assert.equal(entries.length, 2);
    assert.equal(entries[0]?.provider, "codex");
    assert.equal(entries[1]?.provider, "claude");
    assert.equal(entries[0]?.args.includes(prompt), false);
    assert.equal(entries[1]?.args.includes(prompt), false);
    assert.equal(entries[0]?.stdinLength, prompt.length);
    assert.equal(entries[1]?.stdinLength, prompt.length);
    assert.equal(entries[1]?.stdinPreview.length > 0, true);
    assert.equal(result.response, "claude-fallback-response");
    assert.equal(result.attempts.length >= 1, true);
    assert.equal(result.attempts[result.attempts.length - 1]?.provenance.provider, "claude");
    assert.equal(result.attempts[result.attempts.length - 1]?.success, true);
  } finally {
    await restore();
  }
});
