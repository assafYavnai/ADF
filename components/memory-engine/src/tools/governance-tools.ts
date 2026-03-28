import { pool } from "../db/connection.js";
import { GovernanceManageInput } from "../schemas/governance.js";
import { resolveScope, scopeFilterSQL, type ResolvedScope } from "../services/scope.js";
import { LEGACY_PROVENANCE, type Provenance } from "../provenance.js";

function extractProvenance(args: Record<string, unknown>): Provenance {
  const p = args.provenance as Record<string, unknown> | undefined;
  if (!p) return { ...LEGACY_PROVENANCE, source_path: `memory-engine/governance/unknown` };
  return {
    invocation_id: (p.invocation_id as string) ?? LEGACY_PROVENANCE.invocation_id,
    provider: (p.provider as Provenance["provider"]) ?? "system",
    model: (p.model as string) ?? "none",
    reasoning: (p.reasoning as string) ?? "none",
    was_fallback: (p.was_fallback as boolean) ?? false,
    source_path: (p.source_path as string) ?? "memory-engine/governance/unknown",
    timestamp: (p.timestamp as string) ?? new Date().toISOString(),
  };
}

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
  const prov = extractProvenance(args);

  switch (input.action) {
    case "list":
      return listGovernance(input);
    case "get":
      return getGovernance(input);
    case "create":
      return createGovernance(input, prov);
    case "search":
      return searchGovernance(input);
    default:
      throw new Error(`Action "${input.action}" not yet implemented for governance.`);
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

async function createGovernance(input: GovernanceManageInput, prov: Provenance) {
  if (!input.title) throw new Error("title required for create");
  const { randomUUID } = await import("node:crypto");
  const id = randomUUID();
  const content = { text: input.title, ...input.body };
  const scope = input.scope ? await resolveScope(input.scope) : await getDefaultOrganizationScope();

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

async function getDefaultOrganizationScope(): Promise<ResolvedScope> {
  const { rows } = await pool.query(
    "SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1"
  );

  if (rows.length === 0) {
    throw new Error("No organization scope available. Seed an organization or pass scope explicitly.");
  }

  return {
    org_id: rows[0].id as string,
    project_id: null,
    initiative_id: null,
    phase_id: null,
    thread_id: null,
    scope_level: "organization",
  };
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
      provenance: { type: "object", description: "Provenance object from caller" },
    },
    required: ["action"],
  };
}
