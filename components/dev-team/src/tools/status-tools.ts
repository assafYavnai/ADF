/**
 * MCP tool definitions for the dev_team department status / progress surface.
 */
export const STATUS_TOOL_DEFINITIONS = [
  {
    name: "devteam_status",
    description:
      "Returns a truthful snapshot of the dev_team department bootstrap state, " +
      "including settings, team ownership baseline, active lane visibility " +
      "with gate-specific rejection/approval-hold/resume status, " +
      "and audit identity policy. Use this to inspect whether the department " +
      "is initialized, whether any lanes are held at a gate, and whether " +
      "the department is ready for later implementation slices.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];
