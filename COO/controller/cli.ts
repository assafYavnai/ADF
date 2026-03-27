import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { handleTurn, DEFAULT_CLASSIFIER_PARAMS, DEFAULT_INTELLIGENCE_PARAMS } from "./loop.js";
import type { ControllerConfig } from "./loop.js";
import { flush } from "../../shared/telemetry/collector.js";
import { MemoryEngineClient } from "./memory-engine-client.js";

const PROJECT_ROOT = resolve(import.meta.dirname ?? ".", "../..");
const THREADS_DIR = resolve(PROJECT_ROOT, "threads");
const PROMPTS_DIR = resolve(PROJECT_ROOT, "COO/intelligence");
const MEMORY_DIR = resolve(PROJECT_ROOT, "memory");

async function main() {
  const config: ControllerConfig = {
    projectRoot: PROJECT_ROOT,
    threadsDir: THREADS_DIR,
    promptsDir: PROMPTS_DIR,
    memoryDir: MEMORY_DIR,
    classifierParams: DEFAULT_CLASSIFIER_PARAMS,
    intelligenceParams: DEFAULT_INTELLIGENCE_PARAMS,
  };

  let brainClient: MemoryEngineClient | null = null;
  try {
    brainClient = await MemoryEngineClient.connect(PROJECT_ROOT);
    config.brainSearch = async (query, provenance) => {
      const results = await brainClient!.searchMemory(query, provenance);
      return results.map((result) => ({
        id: String(result.id ?? ""),
        content_type: String(result.content_type ?? "text"),
        preview: String(result.preview ?? ""),
        context_priority: String(result.context_priority ?? "p2"),
        score: Number(result.score ?? 0),
      }));
    };
    config.brainCapture = (content, contentType, tags, provenance) =>
      brainClient!.captureMemory(content, contentType, tags, provenance);
    config.brainLogDecision = (title, reasoning, alternatives, provenance) =>
      brainClient!.logDecision(title, reasoning, alternatives, provenance);
    config.brainCreateRule = (title, body, tags, provenance) =>
      brainClient!.createRule(title, body, tags, provenance);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Memory engine MCP connection failed: ${message}`);
    throw err;
  }

  console.log("ADF COO - Interactive CLI");
  console.log("Brain MCP: connected");
  console.log("Type your message, press Enter. Type 'exit' to quit.\n");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "CEO> ",
  });

  let threadId: string | null = null;
  rl.prompt();

  rl.on("line", async (line: string) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }
    if (input.toLowerCase() === "exit") {
      await flush();
      await brainClient?.close();
      rl.close();
      return;
    }

    try {
      const result = await handleTurn(threadId, input, config);
      threadId = result.threadId;
      console.log(`\nCOO> ${result.response}\n`);
      console.log(`[thread: ${threadId}, events: ${result.thread.events.length}]\n`);
    } catch (err) {
      console.error("Error:", err);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nSession ended.");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
