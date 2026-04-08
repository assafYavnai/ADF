/**
 * MCP tool definitions for the VPRND-owned setup route.
 */
export const SETUP_TOOL_DEFINITIONS = [
  {
    name: "devteam_setup",
    description:
      "VPRND-owned setup / initialization route for the dev_team department. " +
      "Installs department settings including repo_root and implementation_lanes_root, " +
      "registers internal team placeholders, and transitions the department to initialized state.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo_root: {
          type: "string",
          description: "Absolute path to the repository root.",
        },
        implementation_lanes_root: {
          type: "string",
          description:
            "Absolute path to the directory where implementation lanes (worktrees) will live.",
        },
      },
      required: ["repo_root", "implementation_lanes_root"],
    },
  },
];
