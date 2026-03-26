import { pool } from "../db/connection.js";
import type { ScopeLevel } from "../schemas/memory-item.js";

export interface ResolvedScope {
  org_id: string | null;
  project_id: string | null;
  initiative_id: string | null;
  phase_id: string | null;
  thread_id: string | null;
  scope_level: ScopeLevel;
}

const SCOPE_LEVELS: ScopeLevel[] = [
  "organization",
  "project",
  "initiative",
  "phase",
  "thread",
];

export async function resolveScope(
  scopePath: string
): Promise<ResolvedScope> {
  const segments = scopePath.split("/").filter(Boolean);
  if (segments.length < 1 || segments.length > 5) {
    throw new Error(
      `Invalid scope path "${scopePath}": expected 1-5 segments (org/project/initiative/phase/thread)`
    );
  }

  const result: ResolvedScope = {
    org_id: null,
    project_id: null,
    initiative_id: null,
    phase_id: null,
    thread_id: null,
    scope_level: SCOPE_LEVELS[segments.length - 1],
  };

  const tables = [
    "organizations",
    "projects",
    "initiatives",
    "phases",
    "threads",
  ];
  const idFields: (keyof ResolvedScope)[] = [
    "org_id",
    "project_id",
    "initiative_id",
    "phase_id",
    "thread_id",
  ];

  let parentId: string | null = null;

  for (let i = 0; i < segments.length; i++) {
    const slug = segments[i];
    const table = tables[i];
    const parentCol = i === 0 ? null : `${tables[i - 1].slice(0, -1)}_id`;

    let query: string;
    let params: string[];

    if (parentCol && parentId) {
      query = `SELECT id FROM ${table} WHERE slug = $1 AND ${parentCol} = $2`;
      params = [slug, parentId];
    } else {
      query = `SELECT id FROM ${table} WHERE slug = $1`;
      params = [slug];
    }

    const { rows } = await pool.query(query, params);
    if (rows.length === 0) {
      throw new Error(
        `Scope segment "${slug}" not found in ${table}`
      );
    }

    parentId = rows[0].id as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (result as any)[idFields[i]] = parentId;
  }

  return result;
}

export function scopeFilterSQL(
  scope: ResolvedScope,
  prefix: string = "m"
): { clause: string; params: string[] } {
  const conditions: string[] = [];
  const params: string[] = [];
  let paramIndex = 1;

  if (scope.org_id) {
    conditions.push(`${prefix}.org_id = $${paramIndex++}`);
    params.push(scope.org_id);
  }
  if (scope.project_id) {
    conditions.push(`${prefix}.project_id = $${paramIndex++}`);
    params.push(scope.project_id);
  }
  if (scope.initiative_id) {
    conditions.push(`${prefix}.initiative_id = $${paramIndex++}`);
    params.push(scope.initiative_id);
  }
  if (scope.phase_id) {
    conditions.push(`${prefix}.phase_id = $${paramIndex++}`);
    params.push(scope.phase_id);
  }
  if (scope.thread_id) {
    conditions.push(`${prefix}.thread_id = $${paramIndex}`);
    params.push(scope.thread_id);
  }

  return {
    clause: conditions.length > 0 ? conditions.join(" AND ") : "TRUE",
    params,
  };
}
