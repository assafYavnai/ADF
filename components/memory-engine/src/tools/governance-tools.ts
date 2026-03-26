import { pool } from "../db/connection.js";
import { GovernanceManageInput } from "../schemas/governance.js";
import { resolveScope, scopeFilterSQL } from "../services/scope.js";

const FAMILY_TABLE: Record<string, string> = {
  rule: "memory_items",
  role: "memory_items",
  requirement: "memory_items",
  setting: "memory_items",
  finding: "memory_items",
  open_loop: "memory_items",
  artifact_ref: "memory_items",
};

export async function handleGovernance(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const input = GovernanceManageInput.parse(args);

  switch (input.action) {
    case "list":
      return listGovernance(input);
    case "get":
      return getGovernance(input);
    case "create":
      return createGovernance(input);
    case "search":
      return searchGovernance(input);
    default:
      return {
        content: [{ type: "text", text: `Action "${input.action}" not yet implemented for governance.` }],
      };
  }
}

async function listGovernance(input: GovernanceManageInput) {
  let query = `
    SELECT id, content, content_type, trust_level, tags, created_at
    FROM memory_items
    WHERE content_type = $1
  `;
  const params: (string | string[])[] = [input.family];

  if (input.scope) {
    const scope = await resolveScope(input.scope);
    const filter = scopeFilterSQL(scope, "memory_items");
    query += ` AND ${filter.clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 1}`)}`;
    params.push(...filter.params);
  }

  query += " ORDER BY created_at DESC LIMIT 50";
  const { rows } = await pool.query(query, params);
  return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
}

async function getGovernance(input: GovernanceManageInput) {
  if (!input.id) throw new Error("id required for get action");
  const { rows } = await pool.query("SELECT * FROM memory_items WHERE id = $1", [input.id]);
  if (rows.length === 0) throw new Error(`Item ${input.id} not found`);
  return { content: [{ type: "text", text: JSON.stringify(rows[0], null, 2) }] };
}

async function createGovernance(input: GovernanceManageInput) {
  if (!input.title) throw new Error("title required for create");
  const { randomUUID } = await import("node:crypto");
  const id = randomUUID();
  const content = { text: input.title, ...input.body };

  await pool.query(
    `INSERT INTO memory_items (id, content, content_type, trust_level, scope_level, tags, context_priority, compression_policy)
     VALUES ($1, $2, $3, 'working', 'organization', $4, 'p0', 'full')`,
    [id, JSON.stringify(content), input.family, input.tags ?? []]
  );

  return { content: [{ type: "text", text: JSON.stringify({ id, status: "created" }, null, 2) }] };
}

async function searchGovernance(input: GovernanceManageInput) {
  if (!input.query) throw new Error("query required for search");
  const { rows } = await pool.query(
    `SELECT id, content, content_type, trust_level, tags, created_at
     FROM memory_items
     WHERE content_type = $1
       AND to_tsvector('english', COALESCE(content->>'text', '')) @@ plainto_tsquery('english', $2)
     ORDER BY created_at DESC LIMIT 20`,
    [input.family, input.query]
  );
  return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
}

export const GOVERNANCE_TOOL_DEFINITIONS = [
  {
    name: "rules_manage",
    description: "Manage rules: list, get, create, search",
    inputSchema: governanceSchema("rule"),
  },
  {
    name: "roles_manage",
    description: "Manage roles: list, get, create, search",
    inputSchema: governanceSchema("role"),
  },
  {
    name: "requirements_manage",
    description: "Manage requirements: list, get, create, search",
    inputSchema: governanceSchema("requirement"),
  },
  {
    name: "settings_manage",
    description: "Manage settings: list, get, create, search",
    inputSchema: governanceSchema("setting"),
  },
  {
    name: "findings_manage",
    description: "Manage findings: list, get, create, search",
    inputSchema: governanceSchema("finding"),
  },
  {
    name: "open_loops_manage",
    description: "Manage open loops/tasks: list, get, create, search",
    inputSchema: governanceSchema("open_loop"),
  },
];

function governanceSchema(family: string) {
  return {
    type: "object" as const,
    properties: {
      action: { type: "string", enum: ["list", "get", "create", "update", "transition", "search"] },
      id: { type: "string", format: "uuid" },
      scope: { type: "string" },
      title: { type: "string" },
      body: { type: "object" },
      status: { type: "string" },
      query: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["action"],
  };
}
