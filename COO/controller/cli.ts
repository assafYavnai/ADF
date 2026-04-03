import { createInterface, emitKeypressEvents } from "node:readline";
import { resolve, join, dirname } from "node:path";
import { readdir, stat, access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { handleTurn, DEFAULT_CLASSIFIER_PARAMS, DEFAULT_INTELLIGENCE_PARAMS } from "./loop.js";
import type { ControllerConfig } from "./loop.js";
import { emitInvocationTelemetry } from "../../shared/llm-invoker/invoker.js";
import {
  appendPersistedMetrics,
  close as closeTelemetry,
  configureMetadataDefaults,
  configurePersistence,
  configureSink,
  emit,
  replayPersistedMetrics,
} from "../../shared/telemetry/collector.js";
import type { InvocationAttempt, InvocationParams, InvocationResult, InvocationUsageEstimate } from "../../shared/llm-invoker/types.js";
import { createLLMProvenance } from "../../shared/provenance/types.js";
import { MemoryEngineClient } from "./memory-engine-client.js";
import { createSystemProvenance } from "../../shared/provenance/types.js";

let shuttingDown = false;

async function main() {
  const startupStartedAt = Date.now();
  const projectRoot = await resolveProjectRoot(import.meta.dirname ?? ".");
  const args = parseCliArgs(process.argv.slice(2));
  assertProofInvokerIsolation(args);
  const onionEnabled = resolveOnionGate(args);
  const threadsDir = resolveRuntimeDir(process.env.ADF_COO_THREADS_DIR, resolve(projectRoot, "threads"));
  const promptsDir = resolveRuntimeDir(process.env.ADF_COO_PROMPTS_DIR, resolve(projectRoot, "COO/intelligence"));
  const memoryDir = resolveRuntimeDir(process.env.ADF_COO_MEMORY_DIR, resolve(projectRoot, "memory"));
  const telemetryOutboxPath = resolve(memoryDir, "telemetry-outbox.json");
  const cliMode = process.stdin.isTTY ? "interactive" : "scripted";
  const telemetryPartition = args.testProofMode ? "proof" : "production";
  const runtimeTelemetryContext = {
    telemetry_partition: telemetryPartition,
    runtime_entry_surface: "coo_cli",
    proof_mode: Boolean(args.testProofMode),
    cli_mode: cliMode,
    onion_enabled: onionEnabled,
  };
  configurePersistence({
    outboxPath: telemetryOutboxPath,
    shutdownTimeoutMs: 5_000,
  });
  configureMetadataDefaults({
    ...runtimeTelemetryContext,
    cli_mode: cliMode,
    onion_enabled: onionEnabled,
  });
  const config: ControllerConfig = {
    projectRoot,
    threadsDir,
    promptsDir,
    memoryDir,
    classifierParams: DEFAULT_CLASSIFIER_PARAMS,
    intelligenceParams: DEFAULT_INTELLIGENCE_PARAMS,
    enableRequirementsGatheringOnion: onionEnabled,
  };
  const testInvoker = await createTestProofInvokerFromEnv(args);
  if (testInvoker) {
    config.invokeLLM = testInvoker;
  }

  let brainClient: MemoryEngineClient | null = null;
  try {
    const brainConnectStartedAt = Date.now();
    brainClient = await MemoryEngineClient.connect(projectRoot, {
      telemetryContext: runtimeTelemetryContext,
    });
    config.brainSearch = async (query, scopePath, provenance, options) => {
      const results = await brainClient!.searchMemory(query, scopePath, provenance, {
        content_type: options?.contentType,
        content_types: options?.contentTypes,
        trust_levels: options?.trustLevels,
        max_results: options?.maxResults,
        telemetry_context: options?.telemetryContext,
      });
      return results.map((result) => ({
        id: String(result.id ?? ""),
        content_type: String(result.content_type ?? "text"),
        trust_level: String(result.trust_level ?? "working"),
        preview: String(result.preview ?? ""),
        context_priority: String(result.context_priority ?? "p2"),
        score: Number(result.score ?? 0),
      }));
    };
    config.brainCapture = (content, contentType, tags, scopePath, provenance, telemetryContext) =>
      brainClient!.captureMemory(content, contentType, tags, scopePath, provenance, telemetryContext);
    config.brainLogDecision = (title, reasoning, alternatives, scopePath, provenance, contentProvenance, telemetryContext) =>
      brainClient!.logDecision(title, reasoning, alternatives, scopePath, provenance, contentProvenance, telemetryContext);
    config.brainCreateRule = (title, body, tags, scopePath, provenance, telemetryContext) =>
      brainClient!.createRule(title, body, tags, scopePath, provenance, telemetryContext);
    config.brainCreateRequirement = (title, body, tags, scopePath, provenance, telemetryContext) =>
      brainClient!.createRequirement(title, body, tags, scopePath, provenance, telemetryContext);
    config.brainCreateFinalizedRequirementCandidate = (title, body, tags, scopePath, provenance, telemetryContext) =>
      brainClient!.createFinalizedRequirementCandidate(title, body, tags, scopePath, provenance, telemetryContext);
    config.brainManageMemory = (action, memoryId, scopePath, provenance, options) =>
      brainClient!.manageMemory(action, memoryId, scopePath, provenance, options);
    config.brainPublishFinalizedRequirement = (memoryId, scopePath, provenance, options) =>
      brainClient!.publishFinalizedRequirement(memoryId, scopePath, provenance, options);
    configureSink(async (events) => {
      if (!brainClient) return;
      await brainClient.emitMetricsBatch(events);
    }, {
      outboxPath: telemetryOutboxPath,
      shutdownTimeoutMs: 5_000,
    });
    emit({
      provenance: createSystemProvenance("COO/controller/cli/memory-engine-connect"),
      category: "system",
      operation: "memory_engine_connect",
      latency_ms: Date.now() - brainConnectStartedAt,
      success: true,
      metadata: {
        connection_result: "connected",
      },
    });
    const replayStartedAt = Date.now();
    const replayedMetrics = await replayPersistedMetrics();
    emit({
      provenance: createSystemProvenance("COO/controller/cli/telemetry-replay"),
      category: "system",
      operation: "telemetry_replay",
      latency_ms: Date.now() - replayStartedAt,
      success: true,
      metadata: {
        replayed_events: replayedMetrics,
        replay_status: replayedMetrics > 0 ? "replayed" : "empty",
      },
    });
    if (replayedMetrics > 0) {
      console.log(`Recovered ${replayedMetrics} persisted telemetry event(s) from the local outbox.`);
    }
    emit({
      provenance: createSystemProvenance("COO/controller/cli/bootstrap"),
      category: "system",
      operation: "cli_bootstrap",
      latency_ms: Date.now() - startupStartedAt,
      success: true,
      metadata: {
        memory_engine_connected: true,
        replayed_events: replayedMetrics,
        cli_mode: cliMode,
        onion_enabled: onionEnabled,
        proof_mode: Boolean(args.testProofMode),
        configured_scope: args.scopePath ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({
      provenance: createSystemProvenance("COO/controller/cli/memory-engine-connect"),
      category: "system",
      operation: "memory_engine_connect",
      latency_ms: Date.now() - startupStartedAt,
      success: false,
      metadata: {
        connection_result: "failed",
        error_message: message,
        cli_mode: cliMode,
        onion_enabled: onionEnabled,
        proof_mode: Boolean(args.testProofMode),
        configured_scope: args.scopePath ?? null,
      },
    });
    await closeTelemetry({ timeoutMs: 1 }).catch(() => {});
    console.error(`Memory engine MCP connection failed: ${message}`);
    throw err;
  }

  console.log("ADF COO - Interactive CLI");
  console.log("Brain MCP: connected");
  console.log("Type your message, press Enter. Type 'exit' to quit.\n");

  const configuredScope = args.scopePath ?? null;
  const resumeLookupStartedAt = Date.now();
  let threadId = await resolveStartingThreadId(args, config.threadsDir);
  emit({
    provenance: createSystemProvenance("COO/controller/cli/thread-resume-lookup"),
    category: "system",
    operation: "thread_resume_lookup",
    latency_ms: Date.now() - resumeLookupStartedAt,
    success: true,
    metadata: {
      requested_thread_id: args.threadId ?? null,
      resume_last_requested: args.resumeLast,
      resolved_thread_id: threadId,
      recovery_path: args.threadId ? "explicit_resume" : args.resumeLast ? (threadId ? "resume_latest" : "resume_latest_empty") : "new_thread",
    },
  });

  if (configuredScope) {
    console.log(`Scope: ${configuredScope}`);
  } else {
    console.log("Scope: not set (durable memory operations will fail closed)");
  }
  console.log(`Requirements-gathering onion: ${onionEnabled ? "enabled (feature gate)" : "disabled"}`);
  console.log(`LLM invoker: ${args.testProofMode ? "test-proof-mode (guarded)" : "live"}`);
  console.log("Multiline mode: type /multi to start, /send to submit, /cancel to discard.\n");

  if (!process.stdin.isTTY) {
    await runScriptedSession(config, brainClient, threadId, configuredScope, {
      ...runtimeTelemetryContext,
      cli_mode: cliMode,
      configured_scope: configuredScope,
      proof_mode: Boolean(args.testProofMode),
    });
    return;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "CEO> ",
  });

  let isProcessing = false;
  let multilineMode = false;
  const multilineBuffer: string[] = [];
  let spinner: NodeJS.Timeout | null = null;
  let spinnerIndex = 0;
  const spinnerFrames = ["|", "/", "-", "\\"];

  const renderPrompt = (): void => {
    rl.setPrompt(multilineMode ? "... " : "CEO> ");
    rl.prompt();
  };

  const startThinkingIndicator = (): void => {
    if (spinner) {
      return;
    }
    spinnerIndex = 0;
    process.stdout.write("\rCOO> Thinking... |");
    spinner = setInterval(() => {
      spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
      process.stdout.write(`\rCOO> Thinking... ${spinnerFrames[spinnerIndex]}`);
    }, 120);
  };

  const stopThinkingIndicator = (): void => {
    if (!spinner) {
      return;
    }
    clearInterval(spinner);
    spinner = null;
    process.stdout.write("\r" + " ".repeat(40) + "\r");
  };

  const processInput = async (rawInput: string): Promise<void> => {
    const input = rawInput.trim();
    if (!input) {
      return;
    }

    if (input.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    if (input === "/multi") {
      multilineMode = true;
      multilineBuffer.length = 0;
      console.log("\nMultiline mode enabled. Enter your text. Type /send on a new line to submit, or /cancel to discard.\n");
      return;
    }

    if (multilineMode) {
      if (input === "/cancel") {
        multilineMode = false;
        multilineBuffer.length = 0;
        console.log("\nMultiline input discarded.\n");
        return;
      }
      if (input === "/send") {
        const message = multilineBuffer.join("\n").trim();
        multilineMode = false;
        multilineBuffer.length = 0;
        if (!message) {
          console.log("\nNo multiline content to send.\n");
          return;
        }
        await runTurn(message);
        return;
      }

      multilineBuffer.push(rawInput);
      return;
    }

    await runTurn(rawInput);
  };

  const runTurn = async (message: string): Promise<void> => {
    if (isProcessing) {
      return;
    }

    isProcessing = true;
    rl.pause();
    startThinkingIndicator();

    try {
      const result = await handleTurn(threadId, message, config, configuredScope);
      threadId = result.threadId;
      stopThinkingIndicator();
      console.log(`\nCOO> ${result.response}\n`);
      console.log(`[thread: ${threadId}, scope: ${result.thread.scopePath ?? "unset"}, events: ${result.thread.events.length}]\n`);
    } catch (err) {
      stopThinkingIndicator();
      console.error("Error:", err);
    } finally {
      isProcessing = false;
      rl.resume();
    }
  };

  emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
    process.stdin.on("keypress", (_str, key) => {
      if (!multilineMode || !key || !key.shift || key.name !== "return") {
        return;
      }
      rl.write("\n");
    });
  }

  renderPrompt();

  rl.on("line", async (line: string) => {
    if (isProcessing) {
      return;
    }

    await processInput(line);
    renderPrompt();
  });

  rl.on("close", () => {
    stopThinkingIndicator();
    void shutdownCli(brainClient, {
      ...runtimeTelemetryContext,
      cli_mode: cliMode,
      configured_scope: configuredScope,
      proof_mode: Boolean(args.testProofMode),
      shutdown_path: "interactive_close",
    });
  });
}

function resolveRuntimeDir(overridePath: string | undefined, fallbackPath: string): string {
  if (!overridePath) {
    return fallbackPath;
  }
  return resolve(overridePath);
}

function assertProofInvokerIsolation(args: { testProofMode?: boolean }): void {
  const parserUpdatePath = process.env.ADF_COO_TEST_PARSER_UPDATES_FILE?.trim();
  if (parserUpdatePath && !args.testProofMode) {
    throw new Error(
      "ADF_COO_TEST_PARSER_UPDATES_FILE is test-only and requires --test-proof-mode. The standard COO CLI bootstrap will not start with proof-only parser updates configured."
    );
  }
}

async function createTestProofInvokerFromEnv(
  args: { testProofMode?: boolean }
): Promise<ControllerConfig["invokeLLM"] | undefined> {
  const parserUpdatePath = process.env.ADF_COO_TEST_PARSER_UPDATES_FILE?.trim();
  if (!args.testProofMode) {
    return undefined;
  }
  if (!parserUpdatePath) {
    throw new Error("--test-proof-mode requires ADF_COO_TEST_PARSER_UPDATES_FILE to point to deterministic parser updates.");
  }

  const raw = await readFile(resolve(parserUpdatePath), "utf-8");
  const parserUpdates = new Map<string, Record<string, unknown>>(Object.entries(JSON.parse(raw) as Record<string, Record<string, unknown>>));
  let sessionCounter = 0;

  return async (params: InvocationParams): Promise<InvocationResult> => {
    const response = buildTestProofResponse(params, parserUpdates);
    const usage = estimateUsage(params.prompt, response);
    const invocationId = randomUUID();
    const latencyMs = params.source_path.startsWith("COO/classifier/classify/") ? 11 : 23;
    const provenance = createLLMProvenance(
      invocationId,
      params.cli,
      params.model,
      params.reasoning ?? params.effort ?? "default",
      false,
      params.source_path,
    );
    const sessionPersisted = Boolean(params.session?.persist);
    const attempt: InvocationAttempt = {
      provenance,
      latency_ms: latencyMs,
      success: true,
      session_status: sessionPersisted
        ? (params.session?.handle ? "resumed" : "fresh")
        : "none",
      usage,
      telemetry_metadata: params.telemetry_metadata,
    };
    const session = sessionPersisted
      ? {
          handle: {
            provider: params.cli,
            model: params.model,
            session_id: params.session?.handle?.session_id ?? `cli-proof-session-${++sessionCounter}`,
            source: "provider_returned" as const,
          },
          status: params.session?.handle ? "resumed" as const : "fresh" as const,
        }
      : null;

    emitInvocationTelemetry([attempt]);

    return {
      provenance,
      response,
      latency_ms: latencyMs,
      session,
      usage,
      attempts: [attempt],
    };
  };
}

function buildTestProofResponse(
  params: InvocationParams,
  parserUpdates: Map<string, Record<string, unknown>>,
): string {
  if (params.source_path.startsWith("COO/classifier/classify/")) {
    const userMessage = extractClassifierUserMessage(params.prompt);
    const onionEnabled = params.prompt.includes("requirements_gathering_onion_enabled: true");
    return JSON.stringify({
      intent: onionEnabled
        ? "continue requirements gathering"
        : "respond without entering onion while the gate is disabled",
      workflow: onionEnabled ? "requirements_gathering_onion" : "direct_coo_response",
      confidence: 0.99,
      reasoning: onionEnabled
        ? `Route "${userMessage}" into the live requirements onion lane.`
        : "The live requirements onion gate is disabled in this runtime.",
    });
  }

  if (params.source_path.includes("COO/requirements-gathering/live/turn-parser/")) {
    const userMessage = extractTagBlock(params.prompt, "ceo_message");
    const update = parserUpdates.get(userMessage);
    if (!update) {
      throw new Error(`No CLI proof parser stub update exists for message: ${userMessage}`);
    }
    return JSON.stringify(update);
  }

  throw new Error(`Unexpected CLI proof invoke source path: ${params.source_path}`);
}

function extractClassifierUserMessage(prompt: string): string {
  const marker = "User message:\n";
  const start = prompt.lastIndexOf(marker);
  if (start < 0) {
    throw new Error("Classifier prompt did not contain a user message block.");
  }
  const after = prompt.slice(start + marker.length);
  const end = after.indexOf("\n\nRespond with JSON only:");
  return (end >= 0 ? after.slice(0, end) : after).trim();
}

function extractTagBlock(prompt: string, tag: string): string {
  const match = new RegExp(`<${tag}>\\n([\\s\\S]*?)\\n<\\/${tag}>`).exec(prompt);
  if (!match) {
    throw new Error(`Prompt did not contain <${tag}>...</${tag}>.`);
  }
  return match[1].trim();
}

function estimateUsage(prompt: string, response: string): InvocationUsageEstimate {
  const promptChars = prompt.length;
  const responseChars = response.length;
  return {
    prompt_chars: promptChars,
    response_chars: responseChars,
    tokens_in_estimated: Math.max(1, Math.ceil(promptChars / 4)),
    tokens_out_estimated: Math.max(1, Math.ceil(responseChars / 4)),
    estimated_cost_usd: Number((((promptChars + responseChars) / 4) * 0.000005).toFixed(6)),
    token_estimation_basis: "char_heuristic_v1",
    cost_estimation_basis: "cli-proof-stub",
  };
}

function parseCliArgs(argv: string[]): {
  threadId?: string;
  resumeLast: boolean;
  scopePath?: string;
  enableOnion?: boolean;
  testProofMode?: boolean;
} {
  let threadId: string | undefined;
  let resumeLast = false;
  let scopePath: string | undefined;
  let enableOnion: boolean | undefined;
  let testProofMode: boolean | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--thread-id" || arg === "--resume") {
      threadId = argv[i + 1];
      i++;
    } else if (arg === "--resume-last") {
      resumeLast = true;
    } else if (arg === "--scope") {
      scopePath = argv[i + 1];
      i++;
    } else if (arg === "--enable-onion") {
      enableOnion = true;
    } else if (arg === "--disable-onion") {
      enableOnion = false;
    } else if (arg === "--test-proof-mode") {
      testProofMode = true;
    }
  }

  return {
    threadId,
    resumeLast,
    scopePath,
    enableOnion,
    testProofMode,
  };
}

function resolveOnionGate(args: { enableOnion?: boolean }): boolean {
  if (args.enableOnion !== undefined) {
    return args.enableOnion;
  }

  const raw = process.env.ADF_ENABLE_REQUIREMENTS_GATHERING_ONION?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

async function findLatestThreadId(threadsDir: string): Promise<string | null> {
  try {
    const entries = await readdir(threadsDir);
    const candidates = await Promise.all(
      entries
        .filter((name) => name.endsWith(".json"))
        .map(async (name) => {
          const fullPath = join(threadsDir, name);
          const stats = await stat(fullPath);
          return { id: name.replace(/\.json$/, ""), mtimeMs: stats.mtimeMs };
        })
    );

    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return candidates[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function resolveStartingThreadId(
  args: { threadId?: string; resumeLast: boolean },
  threadsDir: string
): Promise<string | null> {
  let threadId: string | null = args.threadId ?? null;
  if (!threadId && args.resumeLast) {
    threadId = await findLatestThreadId(threadsDir);
    if (threadId) {
      console.log(`Resuming latest thread ${threadId}`);
    }
  } else if (threadId) {
    console.log(`Resuming thread ${threadId}`);
  }

  return threadId;
}

async function runScriptedSession(
  config: ControllerConfig,
  brainClient: MemoryEngineClient | null,
  threadId: string | null,
  configuredScope: string | null,
  shutdownMetadata: Record<string, unknown>,
): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  try {
    for await (const line of rl) {
      const input = line.trim();
      if (!input) {
        continue;
      }
      if (input.toLowerCase() === "exit") {
        break;
      }

      try {
        const result = await handleTurn(threadId, input, config, configuredScope);
        threadId = result.threadId;
        console.log(`\nCOO> ${result.response}\n`);
        console.log(`[thread: ${threadId}, scope: ${result.thread.scopePath ?? "unset"}, events: ${result.thread.events.length}]\n`);
      } catch (err) {
        console.error("Error:", err);
      }
    }
  } finally {
    rl.close();
    await shutdownCli(brainClient, {
      ...shutdownMetadata,
      shutdown_path: "scripted_session_end",
    });
  }
}

async function shutdownCli(
  brainClient: MemoryEngineClient | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  const shutdownStartedAt = Date.now();

  try {
    const telemetryClose = await closeTelemetry();
    if (telemetryClose.status === "spooled") {
      console.warn(
        `Telemetry sink stayed unavailable during shutdown. ${telemetryClose.pending_events} event(s) were spooled to ${telemetryClose.outbox_path}.`
      );
    } else if (telemetryClose.status === "timed_out") {
      console.warn(
        `Telemetry shutdown timed out with ${telemetryClose.pending_events} unsaved event(s).`
      );
    }
    const shutdownEvent = {
      provenance: createSystemProvenance("COO/controller/cli/shutdown"),
      category: "system" as const,
      operation: "cli_shutdown",
      latency_ms: Date.now() - shutdownStartedAt,
      success: telemetryClose.status !== "timed_out",
      metadata: {
        ...metadata,
        telemetry_close_status: telemetryClose.status,
        pending_events: telemetryClose.pending_events,
        outbox_path: telemetryClose.outbox_path,
      },
    };
    if (telemetryClose.status === "drained") {
      try {
        await brainClient?.emitMetric(shutdownEvent);
      } catch {
        await appendPersistedMetrics([shutdownEvent]);
      }
    } else {
      await appendPersistedMetrics([shutdownEvent]);
    }
    await brainClient?.close();
    console.log("\nSession ended.");
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Shutdown failed: ${message}`);
    process.exit(1);
  }
}

async function resolveProjectRoot(startPath: string): Promise<string> {
  let current = resolve(startPath);

  while (true) {
    if (await pathExists(join(current, "components", "memory-engine", "package.json"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(
    `Unable to resolve the ADF workspace root from ${startPath}. Expected to find components/memory-engine/package.json in an ancestor directory.`
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
