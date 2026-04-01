import { LEGACY_PROVENANCE } from "./provenance.js";

export const LEGACY_INVOCATION_ID = LEGACY_PROVENANCE.invocation_id;
export const LEGACY_SOURCE_PATH = LEGACY_PROVENANCE.source_path;

export function modernRowClause(alias: string): string {
  return `(${alias}.invocation_id <> '${LEGACY_INVOCATION_ID}'::uuid AND COALESCE(${alias}.source_path, '') <> '${LEGACY_SOURCE_PATH}')`;
}

export function modernMemoryEvidenceClause(
  memoryAlias: string,
  decisionAlias?: string
): string {
  const memoryModern = modernRowClause(memoryAlias);
  if (!decisionAlias) {
    return memoryModern;
  }

  const decisionModern = `(${decisionAlias}.invocation_id <> '${LEGACY_INVOCATION_ID}'::uuid AND COALESCE(${decisionAlias}.source_path, '') <> '${LEGACY_SOURCE_PATH}' AND COALESCE(${decisionAlias}.derivation_mode, 'legacy_unknown') <> 'legacy_unknown')`;
  return `(${memoryModern} AND (${memoryAlias}.content_type <> 'decision' OR (${decisionAlias}.id IS NOT NULL AND ${decisionModern})))`;
}

export function isLegacyWrite(invocationId: string, sourcePath: string | null | undefined): boolean {
  return invocationId === LEGACY_INVOCATION_ID || sourcePath === LEGACY_SOURCE_PATH;
}
