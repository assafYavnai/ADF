import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { healthCheck, pool } from "./db/connection.js";
import { logger } from "./logger.js";
import { captureMemory } from "./services/capture.js";
import { searchMemory } from "./services/search.js";
import { getContextSummary, listRecent } from "./services/context.js";
import { logDecision, DECISION_TOOL_DEFINITIONS } from "./tools/decision-tools.js";
import { handleGovernance, GOVERNANCE_TOOL_DEFINITIONS } from "./tools/governance-tools.js";
import { MEMORY_TOOL_DEFINITIONS } from "./tools/memory-tools.js";
import { CaptureMemoryInput, SearchMemoryInput, MemoryManageInput } from "./schemas/memory-item.js";

const server = new Server(
  { name: "ADF Memory Engine", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// --- Tool listing ---

const ALL_TOOLS = [
  ...MEMORY_TOOL_DEFINITIONS,
  ...DECISION_TOOL_DEFINITIONS,
  ...GOVERNANCE_TOOL_DEFINITIONS,
];

server.setRequestHandler(
  { method: "tools/list" } as never,
  async () => ({ tools: ALL_TOOLS })
);

// --- Tool dispatch ---

server.setRequestHandler(
  { method: "tools/call" } as never,
  async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
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
          switch (input.action) {
            case "delete":
              await db.query("DELETE FROM memory_embeddings WHERE memory_item_id = $1", [input.memory_id]);
              await db.query("DELETE FROM decisions WHERE memory_item_id = $1", [input.memory_id]);
              await db.query("DELETE FROM memory_items WHERE id = $1", [input.memory_id]);
              return { content: [{ type: "text", text: `Deleted ${input.memory_id}` }] };
            case "archive":
              await db.query(
                "UPDATE memory_items SET tags = array_append(tags, 'archived'), updated_at = NOW() WHERE id = $1",
                [input.memory_id]
              );
              return { content: [{ type: "text", text: `Archived ${input.memory_id}` }] };
            case "update_tags":
              await db.query("UPDATE memory_items SET tags = $1, updated_at = NOW() WHERE id = $2", [input.tags, input.memory_id]);
              return { content: [{ type: "text", text: `Tags updated` }] };
            case "update_trust_level":
              await db.query("UPDATE memory_items SET trust_level = $1, updated_at = NOW() WHERE id = $2", [input.trust_level, input.memory_id]);
              return { content: [{ type: "text", text: `Trust level → ${input.trust_level}` }] };
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
  const dbOk = await healthCheck();
  if (!dbOk) {
    logger.warn("Database not reachable — memory engine starting in degraded mode.");
  } else {
    logger.info("Database connected.");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("ADF Memory Engine MCP server running on stdio.");
}

// --- Graceful shutdown ---

process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  await pool.end();
  process.exit(0);
});

main().catch((err) => {
  logger.error("Fatal:", err);
  process.exit(1);
});
