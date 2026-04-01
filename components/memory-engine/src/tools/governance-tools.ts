import { pool } from "../db/connection.js";
import { GovernanceManageInput } from "../schemas/governance.js";
import { resolveScope, scopeFilterSQL } from "../services/scope.js";
import type { Provenance } from "../provenance.js";
import { modernMemoryEvidenceClause } from "../evidence-policy.js";

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
      return createGovernance(input, input.provenance!);
    case "search":
      return searchGovernance(input);
    default:
      throw new Error(`Action "${input.action}" not yet implemented for governance.`);
  }
}

async function listGovernance(input: GovernanceManageInput) {
  if (!input.scope) throw new Error(`governance list for ${input.family} requires explicit scope`);
  let query = `
    SELECT m.id, m.content, m.content_type, m.trust_level, m.tags, m.created_at
    FROM memory_items m
    WHERE m.content_type = $1
  `;
  const params: (string | string[])[] = [input.family];
  const scope = await resolveScope(input.scope);
  const filter = scopeFilterSQL(scope, "m");
  query += ` AND ${filter.clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 1}`)}`;
  params.push(...filter.params);
  if (!input.include_legacy) {
    query += ` AND ${modernMemoryEvidenceClause("m")}`;
  }

  query += " ORDER BY created_at DESC LIMIT 50";
  const { rows } = await pool.query(query, params);
  return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
}

async function getGovernance(input: GovernanceManageInput) {
  if (!input.id) throw new Error("id required for get action");
  if (!input.scope) throw new Error(`governance get for ${input.family} requires explicit scope`);
  let query = "SELECT * FROM memory_items m WHERE m.id = $1 AND m.content_type = $2";
  const params: string[] = [input.id, input.family];
  const scope = await resolveScope(input.scope);
  const filter = scopeFilterSQL(scope, "m");
  query += ` AND ${filter.clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 2}`)}`;
  params.push(...filter.params);
  if (!input.include_legacy) {
    query += ` AND ${modernMemoryEvidenceClause("m")}`;
  }

  const { rows } = await pool.query(query, params);
  if (rows.length === 0) throw new Error(`Item ${input.id} not found`);
  return { content: [{ type: "text", text: JSON.stringify(rows[0], null, 2) }] };
}

async function createGovernance(input: GovernanceManageInput, prov: Provenance) {
  if (!input.title) throw new Error("title required for create");
  if (!input.scope) throw new Error(`governance create for ${input.family} requires explicit scope`);
  const { randomUUID } = await import("node:crypto");
  const id = randomUUID();
  const content = { text: input.title, ...input.body };
  const scope = await resolveScope(input.scope);

  await pool.query(
    `INSERT INTO memory_items (
       id, content, content_type, trust_level, scope_level,
       org_id, project_id, initiative_id, phase_id, thread_id,
       tags, context_priority, compression_policy,
       invocation_id, provider, model, reasoning, was_fallback, source_path
     )
     VALUES (
       $1, $2, $3, 'working', $4,
       $5, $6, $7, $8, $9,
       $10, 'p0', 'full',
       $11, $12, $13, $14, $15, $16
     )`,
    [
     id,
     JSON.stringify(content),
     input.family,
     scope.scope_level,
     scope.org_id,
     scope.project_id,
     scope.initiative_id,
     scope.phase_id,
     scope.thread_id,
     input.tags ?? [],
     prov.invocation_id, prov.provider, prov.model, prov.reasoning,
     prov.was_fallback, prov.source_path]
  );

  return { content: [{ type: "text", text: JSON.stringify({ id, status: "created" }, null, 2) }] };
}

async function searchGovernance(input: GovernanceManageInput) {
  if (!input.query) throw new Error("query required for search");
  if (!input.scope) throw new Error(`governance search for ${input.family} requires explicit scope`);
  let query = `SELECT m.id, m.content, m.content_type, m.trust_level, m.tags, m.created_at
     FROM memory_items m
     WHERE m.content_type = $1
       AND to_tsvector('english', COALESCE(m.content->>'text', '')) @@ plainto_tsquery('english', $2)`;
  const params: string[] = [input.family, input.query];
  const scope = await resolveScope(input.scope);
  const filter = scopeFilterSQL(scope, "m");
  query += ` AND ${filter.clause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 2}`)}`;
  params.push(...filter.params);
  if (!input.include_legacy) {
    query += ` AND ${modernMemoryEvidenceClause("m")}`;
  }

  query += " ORDER BY created_at DESC LIMIT 20";
  const { rows } = await pool.query(query, params);
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
      action: { type: "string", enum: ["list", "get", "create", "search"] },
      id: { type: "string", format: "uuid" },
      scope: { type: "string" },
      title: { type: "string" },
      body: { type: "object" },
      status: { type: "string" },
      query: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      include_legacy: { type: "boolean", default: false },
      provenance: { type: "object", description: "Provenance object from caller" },
    },
    required: ["action", "scope"],
    allOf: [
      {
        if: {
          properties: {
            action: { const: "create" },
          },
        },
        then: {
          required: ["title", "provenance"],
        },
      },
      {
        if: {
          properties: {
            action: { const: "get" },
          },
        },
        then: {
          required: ["id"],
        },
      },
      {
        if: {
          properties: {
            action: { const: "search" },
          },
        },
        then: {
          required: ["query"],
        },
      },
    ],
  };
}
