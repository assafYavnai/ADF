import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { pool, withTransaction } from "./db/connection.js";
import { checkServices, shutdown } from "./services/lifecycle.js";
import { logger } from "./logger.js";
import { captureMemory } from "./services/capture.js";
import { searchMemory } from "./services/search.js";
import { getContextSummary, listRecent } from "./services/context.js";
import { resolveScope } from "./services/scope.js";
import { logDecision, DECISION_TOOL_DEFINITIONS } from "./tools/decision-tools.js";
import { handleGovernance, GOVERNANCE_TOOL_DEFINITIONS } from "./tools/governance-tools.js";
import { MEMORY_TOOL_DEFINITIONS } from "./tools/memory-tools.js";
import { handleEmitMetric, handleEmitMetricsBatch, handleQueryMetrics, handleGetCostSummary, insertMetricEvents, TELEMETRY_TOOL_DEFINITIONS } from "./tools/telemetry-tools.js";
import { CaptureMemoryInput, SearchMemoryInput, MemoryManageInput, ContextSummaryInput, ListRecentInput } from "./schemas/memory-item.js";
import { LEGACY_PROVENANCE } from "./provenance.js";

const server = new Server(
  { name: "ADF Memory Engine", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// --- Tool listing ---

const ALL_TOOLS = [
  ...MEMORY_TOOL_DEFINITIONS,
  ...DECISION_TOOL_DEFINITIONS,
  ...GOVERNANCE_TOOL_DEFINITIONS,
  ...TELEMETRY_TOOL_DEFINITIONS,
];

server.setRequestHandler(
  ListToolsRequestSchema,
  async () => ({ tools: ALL_TOOLS })
);

// --- Tool dispatch ---

server.setRequestHandler(
  CallToolRequestSchema,
  async (request) => {
    const { name, arguments: args = {} } = request.params;
    const toolStart = Date.now();
    const prov = extractToolProvenance(args, `memory-engine/${name}`);

    try {
      let response:
        | { content: Array<{ type: string; text: string }>; isError?: boolean }
        | undefined;

      switch (name) {
        // Memory tools
        case "capture_memory": {
          const input = CaptureMemoryInput.parse(args);
          const result = await captureMemory(input);
          response = { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          break;
        }
        case "search_memory": {
          const input = SearchMemoryInput.parse(args);
          const results = await searchMemory(input);
          response = { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
          break;
        }
        case "get_context_summary": {
          const input = ContextSummaryInput.parse(args);
          const result = await getContextSummary(
            input.scope,
            input.content_type,
            input.limit
          );
          response = { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          break;
        }
        case "list_recent": {
          const input = ListRecentInput.parse(args);
          const result = await listRecent(
            input.scope,
            input.content_type,
            input.limit,
            input.offset
          );
          response = { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          break;
        }
        case "memory_manage": {
          const input = MemoryManageInput.parse(args);
          const receipt = await executeMemoryManageRoute(input, prov);
          response = { content: [{ type: "text", text: JSON.stringify(receipt, null, 2) }] };
          break;
        }

        // Decision tools
        case "log_decision":
          response = await logDecision(args);
          break;

        // Governance tools
        case "rules_manage":
          response = await handleGovernance({ ...args, family: "rule" });
          break;
        case "roles_manage":
          response = await handleGovernance({ ...args, family: "role" });
          break;
        case "requirements_manage":
          response = await handleGovernance({ ...args, family: "requirement" });
          break;
        case "settings_manage":
          response = await handleGovernance({ ...args, family: "setting" });
          break;
        case "findings_manage":
          response = await handleGovernance({ ...args, family: "finding" });
          break;
        case "open_loops_manage":
          response = await handleGovernance({ ...args, family: "open_loop" });
          break;

        // Telemetry tools
        case "emit_metric":
          return handleEmitMetric(args);
        case "emit_metrics_batch":
          return handleEmitMetricsBatch(args);
        case "query_metrics":
          return handleQueryMetrics(args);
        case "get_cost_summary":
          return handleGetCostSummary(args);

        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }

      if (!response) {
        throw new Error(`Tool ${name} produced no response`);
      }

      await emitToolRouteTelemetry(name, prov, Date.now() - toolStart, true, {
        scope: typeof args.scope === "string" ? args.scope : undefined,
        action: typeof args.action === "string" ? args.action : undefined,
      });
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await emitToolRouteTelemetry(name, prov, Date.now() - toolStart, false, {
        scope: typeof args.scope === "string" ? args.scope : undefined,
        action: typeof args.action === "string" ? args.action : undefined,
        error: message,
      });
      logger.error(`Tool ${name} failed:`, message);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// --- Startup ---

async function main() {
  const status = await checkServices();
  logger.info(`Startup check — DB: ${status.db}, Ollama: ${status.ollama}`);

  if (!status.db) {
    logger.warn("Database not reachable — memory engine starting in degraded mode.");
  }
  if (!status.ollama) {
    logger.warn("Ollama not reachable — embeddings will fail until available.");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("ADF Memory Engine MCP server running on stdio.");
}

// --- Graceful shutdown ---

async function handleShutdown() {
  await shutdown();
  process.exit(0);
}

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

main().catch((err) => {
  logger.error("Fatal:", err);
  process.exit(1);
});

function extractToolProvenance(
  args: Record<string, unknown>,
  fallbackSourcePath: string
) {
  const p = args.provenance as Record<string, unknown> | undefined;
  return {
    invocation_id: (p?.invocation_id as string) ?? LEGACY_PROVENANCE.invocation_id,
    provider: (p?.provider as string) ?? "system",
    model: (p?.model as string) ?? "none",
    reasoning: (p?.reasoning as string) ?? "none",
    was_fallback: (p?.was_fallback as boolean) ?? false,
    source_path: (p?.source_path as string) ?? fallbackSourcePath,
  };
}

function buildMemoryManageReceipt(
  action: "delete" | "archive" | "update_tags" | "update_trust_level",
  memoryId: string,
  affectedRows: number,
  reason?: string
) {
  const success = affectedRows > 0;
  return {
    action,
    memory_id: memoryId,
    affected_rows: affectedRows,
    status: success ? actionResultStatus(action) : "not_found",
    success,
    reason: reason ?? null,
  };
}

function actionResultStatus(action: "delete" | "archive" | "update_tags" | "update_trust_level"): string {
  switch (action) {
    case "delete":
      return "deleted";
    case "archive":
      return "archived";
    case "update_tags":
      return "tags_updated";
    case "update_trust_level":
      return "trust_level_updated";
  }
}

async function recordMemoryManageTelemetry(
  db: { query: (text: string, params: unknown[]) => Promise<unknown> },
  provenance: ReturnType<typeof extractToolProvenance>,
  action: "delete" | "archive" | "update_tags" | "update_trust_level",
  receipt: ReturnType<typeof buildMemoryManageReceipt>
): Promise<void> {
  await insertMetricEvents(db, [
    {
      provenance: {
        ...provenance,
        timestamp: new Date().toISOString(),
      },
      category: "memory",
      operation: `memory_manage:${action}`,
      latency_ms: 0,
      success: receipt.success,
      metadata: receipt,
    },
  ]);
}

async function executeMemoryManageRoute(
  input: MemoryManageInput,
  provenance: ReturnType<typeof extractToolProvenance>
): Promise<ReturnType<typeof buildMemoryManageReceipt>> {
  const scope = await resolveScope(input.scope);

  let receipt = buildMemoryManageReceipt(input.action, input.memory_id, 0, input.reason);
  await withTransaction(async (client) => {
    const scopedMutation = buildScopedMutation(input, scope, provenance);
    const result = await client.query(scopedMutation.sql, scopedMutation.params);
    receipt = buildMemoryManageReceipt(input.action, input.memory_id, result.rowCount ?? 0, input.reason);
    await recordMemoryManageTelemetry(client, provenance, input.action, receipt);
  });

  return receipt;
}

function buildScopedMutation(
  input: MemoryManageInput,
  scope: Awaited<ReturnType<typeof resolveScope>>,
  provenance: ReturnType<typeof extractToolProvenance>
): { sql: string; params: unknown[] } {
  const exactScopeFilter = exactScopeFilterSQL(scope);

  switch (input.action) {
    case "delete":
      return {
        sql: `DELETE FROM memory_items WHERE id = $1 AND ${exactScopeFilter.clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 1}`)} RETURNING id`,
        params: [input.memory_id, ...exactScopeFilter.params],
      };
    case "archive":
      return {
        sql: `UPDATE memory_items SET tags = array_append(tags, 'archived'), updated_at = NOW(),
                 invocation_id = $2, provider = $3, model = $4, reasoning = $5, was_fallback = $6, source_path = $7
               WHERE id = $1 AND ${exactScopeFilter.clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 7}`)}
               RETURNING id`,
        params: [
          input.memory_id,
          provenance.invocation_id,
          provenance.provider,
          provenance.model,
          provenance.reasoning,
          provenance.was_fallback,
          provenance.source_path,
          ...exactScopeFilter.params,
        ],
      };
    case "update_tags":
      return {
        sql: `UPDATE memory_items SET tags = $1, updated_at = NOW(),
                 invocation_id = $3, provider = $4, model = $5, reasoning = $6, was_fallback = $7, source_path = $8
               WHERE id = $2 AND ${exactScopeFilter.clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 8}`)}
               RETURNING id`,
        params: [
          input.tags ?? [],
          input.memory_id,
          provenance.invocation_id,
          provenance.provider,
          provenance.model,
          provenance.reasoning,
          provenance.was_fallback,
          provenance.source_path,
          ...exactScopeFilter.params,
        ],
      };
    case "update_trust_level":
      return {
        sql: `UPDATE memory_items SET trust_level = $1, updated_at = NOW(),
                 invocation_id = $3, provider = $4, model = $5, reasoning = $6, was_fallback = $7, source_path = $8
               WHERE id = $2 AND ${exactScopeFilter.clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 8}`)}
               RETURNING id`,
        params: [
          input.trust_level,
          input.memory_id,
          provenance.invocation_id,
          provenance.provider,
          provenance.model,
          provenance.reasoning,
          provenance.was_fallback,
          provenance.source_path,
          ...exactScopeFilter.params,
        ],
      };
  }
}

function exactScopeFilterSQL(
  scope: Awaited<ReturnType<typeof resolveScope>>,
  prefix: string = "memory_items"
): { clause: string; params: Array<string | null> } {
  const columns: Array<keyof typeof scope> = ["org_id", "project_id", "initiative_id", "phase_id", "thread_id"];
  const conditions: string[] = [];
  const params: Array<string | null> = [];

  for (const column of columns) {
    params.push(scope[column] ?? null);
    conditions.push(`${prefix}.${column} IS NOT DISTINCT FROM $${params.length}`);
  }

  return {
    clause: conditions.join(" AND "),
    params,
  };
}

async function emitToolRouteTelemetry(
  toolName: string,
  provenance: ReturnType<typeof extractToolProvenance>,
  latencyMs: number,
  success: boolean,
  metadata: Record<string, unknown>
): Promise<void> {
  if (!shouldEmitToolRouteTelemetry(toolName)) {
    return;
  }

  try {
    await insertMetricEvents(pool, [
      {
        provenance: {
          ...provenance,
          timestamp: new Date().toISOString(),
        },
        category: "memory",
        operation: toolName,
        latency_ms: latencyMs,
        success,
        metadata,
      },
    ]);
  } catch (err) {
    logger.warn(`Telemetry write failed for ${toolName}:`, err);
  }
}

function shouldEmitToolRouteTelemetry(toolName: string): boolean {
  return ![
    "emit_metric",
    "emit_metrics_batch",
    "query_metrics",
    "get_cost_summary",
    "memory_manage",
  ].includes(toolName);
}
