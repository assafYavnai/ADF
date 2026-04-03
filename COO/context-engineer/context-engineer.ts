import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Thread } from "../controller/thread.js";
import { serializeForLLM } from "../controller/thread.js";
import { createSystemProvenance, type Provenance } from "../../shared/provenance/types.js";

/**
 * Context Engineer — assembles per-turn LLM context from all 3 tiers.
 *
 * Tier 1 (Hot):  Thread events — current session state
 * Tier 2 (Warm): File-based routing — AGENTS.md rules, daily residue, prompts
 * Tier 3 (Cold): Brain MCP — durable knowledge (semantic search, decisions, rules)
 */

export interface AssembledContext {
  systemPrompt: string;
  scopeContext: string;
  threadContext: string;
  knowledgeContext: string;
  dailyResidue: string;
  totalEstimatedTokens: number;
  metrics: ContextAssemblyMetrics;
}

export interface ContextAssemblyMetrics {
  assembly_latency_ms: number;
  knowledge_retrieval_latency_ms: number;
  knowledge_item_count: number;
  scope_warning: string | null;
  retrieval_warning: string | null;
  knowledge_retrieval_failed: boolean;
}

export interface ContextEngineerConfig {
  projectRoot: string;
  promptsDir: string;
  memoryDir: string;
  brainSearch?: (
    query: string,
    scopePath: string,
    provenance: Provenance,
    options?: {
      contentType?: string;
      contentTypes?: string[];
      trustLevels?: string[]; 
      maxResults?: number;
      telemetryContext?: Record<string, unknown>;
    }
  ) => Promise<BrainSearchResult[]>;
  maxKnowledgeItems?: number;
  scopePath?: string | null;
}

export interface BrainSearchResult {
  id: string;
  content_type: string;
  trust_level: string;
  preview: string;
  context_priority: string;
  score: number;
}

const CONTEXT_ENGINEER_BRAIN_ROUTE_STAGE = "context_engineer";
const CONTEXT_ENGINEER_BRAIN_STEP_NAME = "load_knowledge";

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
  const startedAt = Date.now();
  const [systemPrompt, threadContext, dailyResidue, knowledge] =
    await Promise.all([
      loadSystemPrompt(config),
      Promise.resolve(serializeForLLM(thread)),
      loadDailyResidue(config),
      loadKnowledge(userMessage, config, thread),
    ]);
  const scopeContext = buildScopeContext(thread, config);

  const totalEstimatedTokens = estimateTokens(
    systemPrompt + scopeContext + threadContext + dailyResidue + knowledge.text
  );

  return {
    systemPrompt,
    scopeContext,
    threadContext,
    knowledgeContext: knowledge.text,
    dailyResidue,
    totalEstimatedTokens,
    metrics: {
      assembly_latency_ms: Date.now() - startedAt,
      knowledge_retrieval_latency_ms: knowledge.latency_ms,
      knowledge_item_count: knowledge.item_count,
      scope_warning: knowledge.scope_warning,
      retrieval_warning: knowledge.retrieval_warning,
      knowledge_retrieval_failed: knowledge.failed,
    },
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

  if (ctx.scopeContext) {
    parts.push(`<active_scope>\n${ctx.scopeContext}\n</active_scope>`);
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
    return await readFile(join(config.promptsDir, "prompt.md"), "utf-8");
  } catch {
    try {
      return await readFile(join(config.promptsDir, "coo-system.md"), "utf-8");
    } catch {
      return getDefaultSystemPrompt();
    }
  }
}

async function loadDailyResidue(
  config: ContextEngineerConfig
): Promise<string> {
  try {
    const today = getLocalDateStamp(new Date());
    const residuePath = join(config.memoryDir, `${today}.md`);
    return await readFile(residuePath, "utf-8");
  } catch {
    return "";
  }
}

// --- Tier 3: Brain MCP knowledge ---

async function loadKnowledge(
  query: string,
  config: ContextEngineerConfig,
  thread: Thread,
): Promise<{
  text: string;
  latency_ms: number;
  item_count: number;
  scope_warning: string | null;
  retrieval_warning: string | null;
  failed: boolean;
}> {
  if (!config.brainSearch) {
    return {
      text: "",
      latency_ms: 0,
      item_count: 0,
      scope_warning: null,
      retrieval_warning: "brain_search_unavailable",
      failed: false,
    };
  }
  if (!config.scopePath) {
    return {
      text: `<memory_retrieval_warning>Scoped COO memory is disabled because this conversation has no scope.</memory_retrieval_warning>`,
      latency_ms: 0,
      item_count: 0,
      scope_warning: "missing_scope",
      retrieval_warning: "missing_scope",
      failed: false,
    };
  }

  const startedAt = Date.now();
  try {
    const maxItems = config.maxKnowledgeItems ?? 10;
    const results = await config.brainSearch(
      query,
      config.scopePath,
      createSystemProvenance(`COO/context-engineer/load-knowledge/${thread.id}`),
      {
        contentTypes: [
          "decision",
          "requirement",
          "convention",
        "rule",
        "role",
        "setting",
        "finding",
        "open_loop",
      ],
      trustLevels: ["reviewed", "locked"],
      maxResults: maxItems,
      telemetryContext: {
        thread_id: thread.id,
        scope_path: config.scopePath,
        workflow: thread.workflowState.active_workflow ?? "direct_coo_response",
        route_stage: CONTEXT_ENGINEER_BRAIN_ROUTE_STAGE,
        step_name: CONTEXT_ENGINEER_BRAIN_STEP_NAME,
      },
      }
    );
    const latencyMs = Date.now() - startedAt;
    const topResults = results
      .filter((result) => isInjectableKnowledge(result))
      .slice(0, maxItems);

    if (topResults.length === 0) {
      return {
        text: "",
        latency_ms: latencyMs,
        item_count: 0,
        scope_warning: null,
        retrieval_warning: null,
        failed: false,
      };
    }

    return {
      text: topResults
        .map(
          (r) =>
            `<memory_item type="${r.content_type}" trust="${r.trust_level}" priority="${r.context_priority}">\n${r.preview}\n</memory_item>`
        )
        .join("\n\n"),
      latency_ms: latencyMs,
      item_count: topResults.length,
      scope_warning: null,
      retrieval_warning: null,
      failed: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      text: `<memory_retrieval_warning>Brain search failed: ${message}</memory_retrieval_warning>`,
      latency_ms: Date.now() - startedAt,
      item_count: 0,
      scope_warning: null,
      retrieval_warning: message,
      failed: true,
    };
  }
}

// --- Utilities ---

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function getLocalDateStamp(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isInjectableKnowledge(result: BrainSearchResult): boolean {
  if (result.trust_level !== "reviewed" && result.trust_level !== "locked") {
    return false;
  }

  return [
    "decision",
    "requirement",
    "convention",
    "rule",
    "role",
    "setting",
    "finding",
    "open_loop",
  ].includes(result.content_type);
}

function buildScopeContext(thread: Thread, config: ContextEngineerConfig): string {
  const effectiveScope = thread.scopePath ?? config.scopePath ?? null;
  if (!effectiveScope) {
    return "No Brain scope path has been set for this thread yet. Durable memory operations must fail closed until a scope is provided.";
  }

  return [
    `Brain scope path for this thread: ${effectiveScope}`,
    `Workspace root: ${config.projectRoot}`,
    "If the CEO asks about operational scope, answer with the Brain scope path above unless they explicitly ask about filesystem/workspace location.",
  ].join("\n");
}

function getDefaultSystemPrompt(): string {
  return `You are the COO of ADF (Adaptive Development Framework).
The user is the CEO. They provide vision, goals, and decisions.
You translate that into executable plans, delegate to specialists, and ensure the CEO's intent survives through every layer of execution.

Report back in CEO language, not technical jargon.
Be concise, direct, and evidence-based.
Push back on decisions that don't make sense — you are not a yes-man.`;
}
