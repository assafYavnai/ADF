import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { pool } from "./db/connection.js";
import { checkServices, shutdown } from "./services/lifecycle.js";
import { logger } from "./logger.js";
import { captureMemory } from "./services/capture.js";
import { searchMemory } from "./services/search.js";
import { getContextSummary, listRecent } from "./services/context.js";
import { logDecision, DECISION_TOOL_DEFINITIONS } from "./tools/decision-tools.js";
import { handleGovernance, GOVERNANCE_TOOL_DEFINITIONS } from "./tools/governance-tools.js";
import { MEMORY_TOOL_DEFINITIONS } from "./tools/memory-tools.js";
import { handleEmitMetric, handleQueryMetrics, handleGetCostSummary, TELEMETRY_TOOL_DEFINITIONS } from "./tools/telemetry-tools.js";
import { CaptureMemoryInput, SearchMemoryInput, MemoryManageInput } from "./schemas/memory-item.js";
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

    try {
      switch (name) {
        // Memory tools
        case "capture_memory": {
          const input = CaptureMemoryInput.parse(args);
          const result = await captureMemory(input);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "search_memory": {
          const input = SearchMemoryInput.parse(args);
          const results = await searchMemory(input);
          return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
        }
        case "get_context_summary": {
          const result = await getContextSummary(
            args.scope as string | undefined,
            args.content_type as string | undefined,
            (args.limit as number) ?? 50
          );
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "list_recent": {
          const result = await listRecent(
            args.scope as string | undefined,
            args.content_type as string | undefined,
            (args.limit as number) ?? 20,
            (args.offset as number) ?? 0
          );
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "memory_manage": {
          const input = MemoryManageInput.parse(args);
          const { pool: db } = await import("./db/connection.js");
          const p = args.provenance as Record<string, unknown> | undefined;
          const srcPath = (p?.source_path as string) ?? "memory-engine/manage/unknown";
          const invId = (p?.invocation_id as string) ?? LEGACY_PROVENANCE.invocation_id;
          const prvdr = (p?.provider as string) ?? "system";
          const mdl = (p?.model as string) ?? "none";
          const rsn = (p?.reasoning as string) ?? "none";
          const wasFb = (p?.was_fallback as boolean) ?? false;
          switch (input.action) {
            case "delete":
              await db.query("DELETE FROM memory_embeddings WHERE memory_item_id = $1", [input.memory_id]);
              await db.query("DELETE FROM decisions WHERE memory_item_id = $1", [input.memory_id]);
              await db.query("DELETE FROM memory_items WHERE id = $1", [input.memory_id]);
              return { content: [{ type: "text", text: `Deleted ${input.memory_id}` }] };
            case "archive":
              await db.query(
                `UPDATE memory_items SET tags = array_append(tags, 'archived'), updated_at = NOW(),
                 invocation_id = $2, provider = $3, model = $4, reasoning = $5, was_fallback = $6, source_path = $7 WHERE id = $1`,
                [input.memory_id, invId, prvdr, mdl, rsn, wasFb, srcPath]
              );
              return { content: [{ type: "text", text: `Archived ${input.memory_id}` }] };
            case "update_tags":
              await db.query(
                `UPDATE memory_items SET tags = $1, updated_at = NOW(),
                 invocation_id = $3, provider = $4, model = $5, reasoning = $6, was_fallback = $7, source_path = $8 WHERE id = $2`,
                [input.tags, input.memory_id, invId, prvdr, mdl, rsn, wasFb, srcPath]);
              return { content: [{ type: "text", text: `Tags updated` }] };
            case "update_trust_level":
              await db.query(
                `UPDATE memory_items SET trust_level = $1, updated_at = NOW(),
                 invocation_id = $3, provider = $4, model = $5, reasoning = $6, was_fallback = $7, source_path = $8 WHERE id = $2`,
                [input.trust_level, input.memory_id, invId, prvdr, mdl, rsn, wasFb, srcPath]);
              return { content: [{ type: "text", text: `Trust level -> ${input.trust_level}` }] };
          }
          break;
        }

        // Decision tools
        case "log_decision":
          return logDecision(args);

        // Governance tools
        case "rules_manage":
          return handleGovernance({ ...args, family: "rule" });
        case "roles_manage":
          return handleGovernance({ ...args, family: "role" });
        case "requirements_manage":
          return handleGovernance({ ...args, family: "requirement" });
        case "settings_manage":
          return handleGovernance({ ...args, family: "setting" });
        case "findings_manage":
          return handleGovernance({ ...args, family: "finding" });
        case "open_loops_manage":
          return handleGovernance({ ...args, family: "open_loop" });

        // Telemetry tools
        case "emit_metric":
          return handleEmitMetric(args);
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
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
