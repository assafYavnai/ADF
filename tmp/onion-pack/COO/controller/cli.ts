import { createInterface } from "node:readline";
import { resolve, join, dirname } from "node:path";
import { readdir, stat, access } from "node:fs/promises";
import { constants } from "node:fs";
import { handleTurn, DEFAULT_CLASSIFIER_PARAMS, DEFAULT_INTELLIGENCE_PARAMS } from "./loop.js";
import type { ControllerConfig } from "./loop.js";
import { close as closeTelemetry, configureSink, replayPersistedMetrics } from "../../shared/telemetry/collector.js";
import { MemoryEngineClient } from "./memory-engine-client.js";

let shuttingDown = false;

async function main() {
  const projectRoot = await resolveProjectRoot(import.meta.dirname ?? ".");
  const args = parseCliArgs(process.argv.slice(2));
  const config: ControllerConfig = {
    projectRoot,
    threadsDir: resolve(projectRoot, "threads"),
    promptsDir: resolve(projectRoot, "COO/intelligence"),
    memoryDir: resolve(projectRoot, "memory"),
    classifierParams: DEFAULT_CLASSIFIER_PARAMS,
    intelligenceParams: DEFAULT_INTELLIGENCE_PARAMS,
  };

  let brainClient: MemoryEngineClient | null = null;
  try {
    brainClient = await MemoryEngineClient.connect(projectRoot);
    const telemetryOutboxPath = resolve(projectRoot, "memory", "telemetry-outbox.json");
    config.brainSearch = async (query, scopePath, provenance, options) => {
      const results = await brainClient!.searchMemory(query, scopePath, provenance, {
        content_type: options?.contentType,
        content_types: options?.contentTypes,
        trust_levels: options?.trustLevels,
        max_results: options?.maxResults,
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
    config.brainCapture = (content, contentType, tags, scopePath, provenance) =>
      brainClient!.captureMemory(content, contentType, tags, scopePath, provenance);
    config.brainLogDecision = (title, reasoning, alternatives, scopePath, provenance, contentProvenance) =>
      brainClient!.logDecision(title, reasoning, alternatives, scopePath, provenance, contentProvenance);
    config.brainCreateRule = (title, body, tags, scopePath, provenance) =>
      brainClient!.createRule(title, body, tags, scopePath, provenance);
    configureSink(async (events) => {
      if (!brainClient) return;
      await brainClient.emitMetricsBatch(events);
    }, {
      outboxPath: telemetryOutboxPath,
      shutdownTimeoutMs: 5_000,
    });
    const replayedMetrics = await replayPersistedMetrics();
    if (replayedMetrics > 0) {
      console.log(`Recovered ${replayedMetrics} persisted telemetry event(s) from the local outbox.`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Memory engine MCP connection failed: ${message}`);
    throw err;
  }

  console.log("ADF COO - Interactive CLI");
  console.log("Brain MCP: connected");
  console.log("Type your message, press Enter. Type 'exit' to quit.\n");

  const configuredScope = args.scopePath ?? null;
  let threadId = await resolveStartingThreadId(args, config.threadsDir);

  if (configuredScope) {
    console.log(`Scope: ${configuredScope}`);
  } else {
    console.log("Scope: not set (durable memory operations will fail closed)");
  }

  if (!process.stdin.isTTY) {
    await runScriptedSession(config, brainClient, threadId, configuredScope);
    return;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "CEO> ",
  });

  rl.prompt();

  rl.on("line", async (line: string) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }
    if (input.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    try {
      const result = await handleTurn(threadId, input, config, configuredScope);
      threadId = result.threadId;
      console.log(`\nCOO> ${result.response}\n`);
      console.log(`[thread: ${threadId}, scope: ${result.thread.scopePath ?? "unset"}, events: ${result.thread.events.length}]\n`);
    } catch (err) {
      console.error("Error:", err);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    void shutdownCli(brainClient);
  });
}

function parseCliArgs(argv: string[]): { threadId?: string; resumeLast: boolean; scopePath?: string } {
  let threadId: string | undefined;
  let resumeLast = false;
  let scopePath: string | undefined;

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
    }
  }

  return {
    threadId,
    resumeLast,
    scopePath,
  };
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
  configuredScope: string | null
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
    await shutdownCli(brainClient);
  }
}

async function shutdownCli(brainClient: MemoryEngineClient | null): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

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
