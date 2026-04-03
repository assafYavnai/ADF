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
import { handleEmitMetric, handleEmitMetricsBatch, handleQueryMetrics, handleGetCostSummary, handleGetKpiSummary, insertMetricEvents, TELEMETRY_TOOL_DEFINITIONS } from "./tools/telemetry-tools.js";
import { CaptureMemoryInput, SearchMemoryInput, MemoryManageInput, ContextSummaryInput, ListRecentInput } from "./schemas/memory-item.js";
import { ProvenanceSchema, createSystemProvenance, type Provenance } from "./provenance.js";

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
    const callerProvenance = extractToolProvenance(args);
    const telemetryContext = extractToolTelemetryContext(args);

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
            input.limit,
            input.include_legacy
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
            input.offset,
            input.include_legacy
          );
          response = { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          break;
        }
        case "memory_manage": {
          const input = MemoryManageInput.parse(args);
          const receipt = await executeMemoryManageRoute(input, input.provenance);
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
          response = await handleQueryMetrics(args);
          break;
        case "get_cost_summary":
          response = await handleGetCostSummary(args);
          break;
        case "get_kpi_summary":
          response = await handleGetKpiSummary(args);
          break;

        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }

      if (!response) {
        throw new Error(`Tool ${name} produced no response`);
      }

      await emitToolRouteTelemetry(name, callerProvenance, Date.now() - toolStart, true, {
        scope: typeof args.scope === "string" ? args.scope : undefined,
        action: typeof args.action === "string" ? args.action : undefined,
        ...summarizeToolRequest(name, args),
        ...telemetryContext,
        ...summarizeToolResponse(name, response),
      });
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await emitToolRouteTelemetry(name, callerProvenance, Date.now() - toolStart, false, {
        scope: typeof args.scope === "string" ? args.scope : undefined,
        action: typeof args.action === "string" ? args.action : undefined,
        ...summarizeToolRequest(name, args),
        ...telemetryContext,
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
  args: Record<string, unknown>
): Provenance | null {
  const parsed = ProvenanceSchema.safeParse(args.provenance);
  if (parsed.success) {
    return parsed.data;
  }
  return null;
}

function extractToolTelemetryContext(args: Record<string, unknown>): Record<string, unknown> {
  const candidate = args.telemetry_context;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return {};
  }
  return candidate as Record<string, unknown>;
}

function buildMemoryManageReceipt(
  action: "delete" | "archive" | "supersede" | "update_tags" | "update_trust_level" | "publish_finalized_requirement",
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

function actionResultStatus(
  action: "delete" | "archive" | "supersede" | "update_tags" | "update_trust_level" | "publish_finalized_requirement",
): string {
  switch (action) {
    case "delete":
      return "deleted";
    case "archive":
      return "archived";
    case "supersede":
      return "superseded";
    case "update_tags":
      return "tags_updated";
    case "update_trust_level":
      return "trust_level_updated";
    case "publish_finalized_requirement":
      return "published";
  }
}

async function recordMemoryManageTelemetry(
  db: { query: (text: string, params: unknown[]) => Promise<unknown> },
  provenance: Provenance,
  action: "delete" | "archive" | "supersede" | "update_tags" | "update_trust_level" | "publish_finalized_requirement",
  receipt: ReturnType<typeof buildMemoryManageReceipt>,
  telemetryContext: Record<string, unknown>,
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
      metadata: {
        ...receipt,
        ...telemetryContext,
      },
    },
  ]);
}

async function executeMemoryManageRoute(
  input: MemoryManageInput,
  provenance: Provenance
): Promise<ReturnType<typeof buildMemoryManageReceipt>> {
  const scope = await resolveScope(input.scope);

  let receipt = buildMemoryManageReceipt(input.action, input.memory_id, 0, input.reason);
  await withTransaction(async (client) => {
    if (input.action === "supersede") {
      await client.query(`SELECT set_config('project_brain.bypass_lock', 'on', true)`);
    }
    const scopedMutation = buildScopedMutation(input, scope, provenance);
    const result = await client.query(scopedMutation.sql, scopedMutation.params);
    receipt = buildMemoryManageReceipt(input.action, input.memory_id, result.rowCount ?? 0, input.reason);
    await recordMemoryManageTelemetry(client, provenance, input.action, receipt, input.telemetry_context ?? {});
  });

  return receipt;
}

function buildScopedMutation(
  input: MemoryManageInput,
  scope: Awaited<ReturnType<typeof resolveScope>>,
  provenance: Provenance
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
        sql: `UPDATE memory_items
                 SET tags = ARRAY(
                       SELECT DISTINCT tag
                       FROM unnest(array_cat(tags, ARRAY['archived']::text[])) AS tag
                     ),
                     workflow_metadata = COALESCE(workflow_metadata, '{}'::jsonb) || jsonb_build_object(
                       'status', 'archived',
                       'retired_reason', COALESCE($8::text, 'archived'),
                       'retired_at', NOW()::text
                     ),
                     updated_at = NOW(),
                 invocation_id = $2, provider = $3, model = $4, reasoning = $5, was_fallback = $6, source_path = $7
               WHERE id = $1 AND ${exactScopeFilter.clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 8}`)}
               RETURNING id`,
        params: [
          input.memory_id,
          provenance.invocation_id,
          provenance.provider,
          provenance.model,
          provenance.reasoning,
          provenance.was_fallback,
          provenance.source_path,
          input.reason ?? null,
          ...exactScopeFilter.params,
        ],
      };
    case "supersede":
      return {
        sql: `UPDATE memory_items
                 SET tags = ARRAY(
                       SELECT DISTINCT tag
                       FROM unnest(array_cat(tags, ARRAY['superseded']::text[])) AS tag
                     ),
                     workflow_metadata = COALESCE(workflow_metadata, '{}'::jsonb) || jsonb_build_object(
                       'status', 'superseded',
                       'retired_reason', COALESCE($8::text, 'superseded'),
                       'retired_at', NOW()::text
                     ),
                     updated_at = NOW(),
                     invocation_id = $2, provider = $3, model = $4, reasoning = $5, was_fallback = $6, source_path = $7
               WHERE id = $1
                 AND content_type = 'requirement'
                 AND trust_level = 'locked'
                 AND tags @> ARRAY['requirements-gathering', 'finalized-requirement-list', 'coo-owned']::text[]
                 AND ${exactScopeFilter.clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 8}`)}
               RETURNING id`,
        params: [
          input.memory_id,
          provenance.invocation_id,
          provenance.provider,
          provenance.model,
          provenance.reasoning,
          provenance.was_fallback,
          provenance.source_path,
          input.reason ?? null,
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
    case "publish_finalized_requirement":
      return {
        sql: `UPDATE memory_items
                 SET trust_level = 'locked',
                     workflow_metadata = COALESCE(workflow_metadata, '{}'::jsonb) - 'status',
                     updated_at = NOW(),
                     invocation_id = $2, provider = $3, model = $4, reasoning = $5, was_fallback = $6, source_path = $7
               WHERE id = $1
                 AND content_type = 'requirement'
                 AND COALESCE(workflow_metadata->>'status', 'current') = 'pending_finalization'
                 AND tags @> ARRAY['requirements-gathering', 'onion', 'finalized-requirement-list', 'coo-owned']::text[]
                 AND ${exactScopeFilter.clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 7}`)}
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
  callerProvenance: Provenance | null,
  latencyMs: number,
  success: boolean,
  metadata: Record<string, unknown>
): Promise<void> {
  if (!shouldEmitToolRouteTelemetry(toolName)) {
    return;
  }

  try {
    const routeTelemetry = resolveToolRouteTelemetry(toolName, callerProvenance);
    await insertMetricEvents(pool, [
      {
        provenance: {
          ...routeTelemetry.provenance,
          timestamp: new Date().toISOString(),
        },
        category: "memory",
        operation: toolName,
        latency_ms: latencyMs,
        success,
        metadata: {
          ...metadata,
          telemetry_provenance_mode: routeTelemetry.mode,
        },
      },
    ]);
  } catch (err) {
    logger.warn(`Telemetry write failed for ${toolName}:`, err);
  }
}

function resolveToolRouteTelemetry(
  toolName: string,
  callerProvenance: Provenance | null
): { provenance: Provenance; mode: "caller" | "internal" } {
  if (callerProvenance) {
    return {
      provenance: callerProvenance,
      mode: "caller",
    };
  }

  return {
    provenance: createSystemProvenance(`memory-engine/internal/tool-route-telemetry/${toolName}`),
    mode: "internal",
  };
}

function shouldEmitToolRouteTelemetry(toolName: string): boolean {
  return ![
    "emit_metric",
    "emit_metrics_batch",
    "memory_manage",
  ].includes(toolName);
}

function summarizeToolRequest(
  toolName: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  switch (toolName) {
    case "query_metrics":
      return {
        requested_category: typeof args.category === "string" ? args.category : null,
        requested_operation: typeof args.operation === "string" ? args.operation : null,
        requested_source_path: typeof args.source_path === "string" ? args.source_path : null,
        requested_telemetry_partition: typeof args.telemetry_partition === "string" ? args.telemetry_partition : null,
        requested_workflow: typeof args.workflow === "string" ? args.workflow : null,
        requested_limit: typeof args.limit === "number" ? args.limit : null,
        requested_thread_filter: typeof args.thread_id === "string",
        requested_trace_filter: typeof args.trace_id === "string",
      };
    case "get_cost_summary":
    case "get_kpi_summary":
      return {
        requested_source_path: typeof args.source_path === "string" ? args.source_path : null,
        requested_telemetry_partition: typeof args.telemetry_partition === "string" ? args.telemetry_partition : null,
        requested_workflow: typeof args.workflow === "string" ? args.workflow : null,
        requested_thread_filter: typeof args.thread_id === "string",
        requested_trace_filter: typeof args.trace_id === "string",
        requested_since: typeof args.since === "string" ? args.since : null,
        requested_until: typeof args.until === "string" ? args.until : null,
      };
    default:
      return {};
  }
}

function summarizeToolResponse(
  toolName: string,
  response: { content: Array<{ type: string; text: string }>; isError?: boolean },
): Record<string, unknown> {
  const text = response.content.find((item) => item.type === "text" && typeof item.text === "string")?.text?.trim();
  if (!text) {
    return {};
  }

  try {
    const parsed = JSON.parse(text);
    switch (toolName) {
      case "search_memory":
        return Array.isArray(parsed)
          ? {
              result_count: parsed.length,
              result_ids: parsed.slice(0, 5).map((item) => item?.id ?? null),
            }
          : {};
      case "get_context_summary":
      case "list_recent":
        return {
          result_count: Array.isArray(parsed?.items) ? parsed.items.length : parsed?.total ?? 0,
          total: parsed?.total ?? null,
          has_more: parsed?.has_more ?? null,
        };
      case "query_metrics":
        return {
          result_count: Array.isArray(parsed) ? parsed.length : 0,
        };
      case "get_cost_summary":
        return {
          result_count: Array.isArray(parsed?.breakdown) ? parsed.breakdown.length : 0,
          total_calls: parsed?.totals?.total_calls ?? null,
          total_cost_usd: parsed?.totals?.total_cost_usd ?? null,
        };
      case "get_kpi_summary":
        return {
          workflow_count: Array.isArray(parsed?.workflow_breakdown) ? parsed.workflow_breakdown.length : 0,
          kpi_usage_rows: Array.isArray(parsed?.kpi_api_usage?.by_operation) ? parsed.kpi_api_usage.by_operation.length : 0,
          frozen_trace_count: parsed?.requirements_gathering?.frozen_trace_count ?? null,
        };
      case "memory_manage":
        return {
          receipt_status: parsed?.status ?? null,
          affected_rows: parsed?.affected_rows ?? null,
          memory_id: parsed?.memory_id ?? null,
        };
      case "log_decision":
        return {
          status: parsed?.status ?? null,
          decision_id: parsed?.decision_id ?? null,
          memory_id: parsed?.memory_id ?? null,
        };
      case "requirements_manage":
      case "rules_manage":
      case "roles_manage":
      case "settings_manage":
      case "findings_manage":
      case "open_loops_manage":
        return Array.isArray(parsed)
          ? {
              result_count: parsed.length,
              result_ids: parsed.slice(0, 5).map((item) => item?.id ?? null),
            }
          : {
              status: parsed?.status ?? null,
              record_id: parsed?.id ?? null,
            };
      default:
        return {};
    }
  } catch {
    return {};
  }
}
