import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SetupInput } from "./schemas/setup.js";
import { setupDepartment } from "./services/setup.js";
import { getDepartmentStatus } from "./services/status.js";
import { setStateDir } from "./services/state.js";
import { SETUP_TOOL_DEFINITIONS } from "./tools/setup-tools.js";
import { STATUS_TOOL_DEFINITIONS } from "./tools/status-tools.js";

// --- State directory initialization ---
// Default to a .dev-team-state directory next to the component root.
// Can be overridden via DEV_TEAM_STATE_DIR environment variable.
const stateDir =
  process.env["DEV_TEAM_STATE_DIR"] ||
  new URL("../../.dev-team-state", import.meta.url).pathname.replace(
    /^\//,
    ""
  );
setStateDir(stateDir);

// --- Server setup ---

const server = new Server(
  { name: "ADF dev_team Department", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// --- Tool listing ---

const ALL_TOOLS = [...SETUP_TOOL_DEFINITIONS, ...STATUS_TOOL_DEFINITIONS];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS,
}));

// --- Tool dispatch ---

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case "devteam_setup": {
      const input = SetupInput.parse(args);
      const result = await setupDepartment(input);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "devteam_status": {
      const result = await getDepartmentStatus();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    default:
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Unknown tool: ${name}`,
              available_tools: ALL_TOOLS.map((t) => t.name),
            }),
          },
        ],
        isError: true,
      };
  }
});

// --- Transport ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("dev_team server fatal error:", err);
  process.exit(1);
});

// --- Graceful shutdown ---

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
