import {
  CURRENT_EVIDENCE_FORMAT_VERSION,
  LEGACY_EVIDENCE_MARKER,
  LEGACY_PROVENANCE,
} from "./provenance.js";

export const LEGACY_INVOCATION_ID = LEGACY_PROVENANCE.invocation_id;
export const LEGACY_SOURCE_PATH = LEGACY_PROVENANCE.source_path;
export const CURRENT_EVIDENCE_STATUS = "current";
export const LEGACY_EVIDENCE_STATUS = "legacy_archived";

export function currentEvidenceClause(alias: string): string {
  return `(${alias}.evidence_format_version = ${CURRENT_EVIDENCE_FORMAT_VERSION} AND COALESCE(${alias}.evidence_lifecycle_status, '${CURRENT_EVIDENCE_STATUS}') = '${CURRENT_EVIDENCE_STATUS}' AND ${alias}.legacy_marker IS NULL)`;
}

export function modernMemoryEvidenceClause(
  memoryAlias: string,
  decisionAlias?: string
): string {
  const memoryModern = currentEvidenceClause(memoryAlias);
  if (!decisionAlias) {
    return memoryModern;
  }

  const decisionModern = `(${currentEvidenceClause(decisionAlias)} AND COALESCE(${decisionAlias}.derivation_mode, 'legacy_unknown') <> 'legacy_unknown')`;
  return `(${memoryModern} AND (${memoryAlias}.content_type <> 'decision' OR (${decisionAlias}.id IS NOT NULL AND ${decisionModern})))`;
}

export function isLegacyWrite(invocationId: string, sourcePath: string | null | undefined): boolean {
  return invocationId === LEGACY_INVOCATION_ID || sourcePath === LEGACY_SOURCE_PATH;
}

export function isLegacyEvidenceRow(
  evidenceLifecycleStatus: string | null | undefined,
  legacyMarker: string | null | undefined
): boolean {
  return evidenceLifecycleStatus === LEGACY_EVIDENCE_STATUS || legacyMarker === LEGACY_EVIDENCE_MARKER;
}
