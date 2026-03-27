import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { handleTurn, DEFAULT_CLASSIFIER_PARAMS, DEFAULT_INTELLIGENCE_PARAMS } from "./loop.js";
import type { ControllerConfig } from "./loop.js";
import { configureSink, createPgSink, flush } from "../../shared/telemetry/collector.js";

/**
 * COO CLI — REPL entry point for end-to-end testing.
 *
 * Creates a thread, loops: read user input -> handleTurn -> print response.
 * Demonstrates full flow: input -> classify -> context -> COO response -> thread commit.
 */

const PROJECT_ROOT = resolve(import.meta.dirname ?? ".", "../..");
const THREADS_DIR = resolve(PROJECT_ROOT, "threads");
const PROMPTS_DIR = resolve(PROJECT_ROOT, "COO/intelligence");
const MEMORY_DIR = resolve(PROJECT_ROOT, "memory");

const config: ControllerConfig = {
  projectRoot: PROJECT_ROOT,
  threadsDir: THREADS_DIR,
  promptsDir: PROMPTS_DIR,
  memoryDir: MEMORY_DIR,
  classifierParams: DEFAULT_CLASSIFIER_PARAMS,
  intelligenceParams: DEFAULT_INTELLIGENCE_PARAMS,
  // Brain integrations left disconnected for now — connect when memory engine is live
};

async function main() {
  console.log("ADF COO — Interactive CLI");
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
    if (!input) { rl.prompt(); return; }
    if (input.toLowerCase() === "exit") {
      await flush();
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
