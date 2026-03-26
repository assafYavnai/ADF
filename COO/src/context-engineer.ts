import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Thread } from "./thread.js";
import { serializeForLLM } from "./thread.js";

/**
 * Context Engineer — assembles per-turn LLM context from all 3 tiers.
 *
 * Tier 1 (Hot):  Thread events — current session state
 * Tier 2 (Warm): File-based routing — AGENTS.md rules, daily residue, prompts
 * Tier 3 (Cold): Brain MCP — durable knowledge (semantic search, decisions, rules)
 */

export interface AssembledContext {
  systemPrompt: string;
  threadContext: string;
  knowledgeContext: string;
  dailyResidue: string;
  totalEstimatedTokens: number;
}

export interface ContextEngineerConfig {
  projectRoot: string;
  promptsDir: string;
  memoryDir: string;
  brainSearch?: (query: string) => Promise<BrainSearchResult[]>;
  maxKnowledgeItems?: number;
}

export interface BrainSearchResult {
  id: string;
  content_type: string;
  preview: string;
  context_priority: string;
  score: number;
}

/**
 * Assemble the full LLM context for a turn.
 *
 * 1. Load the system prompt from prompts/
 * 2. Serialize the thread (Tier 1)
 * 3. Load today's daily residue (Tier 2)
 * 4. Query Brain MCP for relevant knowledge (Tier 3)
 * 5. Combine into a single optimized context
 */
export async function assembleContext(
  thread: Thread,
  userMessage: string,
  config: ContextEngineerConfig
): Promise<AssembledContext> {
  const [systemPrompt, threadContext, dailyResidue, knowledgeContext] =
    await Promise.all([
      loadSystemPrompt(config),
      Promise.resolve(serializeForLLM(thread)),
      loadDailyResidue(config),
      loadKnowledge(userMessage, config),
    ]);

  const totalEstimatedTokens = estimateTokens(
    systemPrompt + threadContext + dailyResidue + knowledgeContext
  );

  return {
    systemPrompt,
    threadContext,
    knowledgeContext,
    dailyResidue,
    totalEstimatedTokens,
  };
}

/**
 * Build the final prompt string from assembled context.
 */
export function buildPrompt(ctx: AssembledContext): string {
  const parts: string[] = [];

  if (ctx.systemPrompt) {
    parts.push(`<system_prompt>\n${ctx.systemPrompt}\n</system_prompt>`);
  }

  if (ctx.knowledgeContext) {
    parts.push(`<knowledge>\n${ctx.knowledgeContext}\n</knowledge>`);
  }

  if (ctx.dailyResidue) {
    parts.push(`<daily_residue>\n${ctx.dailyResidue}\n</daily_residue>`);
  }

  if (ctx.threadContext) {
    parts.push(`<thread>\n${ctx.threadContext}\n</thread>`);
  }

  return parts.join("\n\n");
}

// --- Tier 2: File-based context ---

async function loadSystemPrompt(
  config: ContextEngineerConfig
): Promise<string> {
  try {
    const promptPath = join(config.promptsDir, "coo-system.md");
    return await readFile(promptPath, "utf-8");
  } catch {
    return getDefaultSystemPrompt();
  }
}

async function loadDailyResidue(
  config: ContextEngineerConfig
): Promise<string> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const residuePath = join(config.memoryDir, `${today}.md`);
    return await readFile(residuePath, "utf-8");
  } catch {
    return "";
  }
}

// --- Tier 3: Brain MCP knowledge ---

async function loadKnowledge(
  query: string,
  config: ContextEngineerConfig
): Promise<string> {
  if (!config.brainSearch) return "";

  try {
    const maxItems = config.maxKnowledgeItems ?? 10;
    const results = await config.brainSearch(query);
    const topResults = results.slice(0, maxItems);

    if (topResults.length === 0) return "";

    return topResults
      .map(
        (r) =>
          `<memory_item type="${r.content_type}" priority="${r.context_priority}">\n${r.preview}\n</memory_item>`
      )
      .join("\n\n");
  } catch {
    return "";
  }
}

// --- Utilities ---

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function getDefaultSystemPrompt(): string {
  return `You are the COO of ADF (Adaptive Development Framework).
The user is the CEO. They provide vision, goals, and decisions.
You translate that into executable plans, delegate to specialists, and ensure the CEO's intent survives through every layer of execution.

Report back in CEO language, not technical jargon.
Be concise, direct, and evidence-based.
Push back on decisions that don't make sense — you are not a yes-man.`;
}
