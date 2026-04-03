/**
 * Company Table Renderer
 *
 * Produces a compact text management view from a CompanyTable.
 * Deterministic output for a given input.
 */

import type { CompanyTable, TableEntry, TableItemState } from "./types.js";

const STATE_LABELS: Record<TableItemState, string> = {
  blocked: "BLOCKED",
  in_motion: "IN MOTION",
  completed_recently: "COMPLETED",
  admitted: "ADMITTED",
  admission_pending: "PENDING ADMISSION",
  next: "NEXT",
  shaping: "SHAPING",
};

const SECTION_ORDER: TableItemState[] = [
  "blocked",
  "in_motion",
  "admitted",
  "admission_pending",
  "next",
  "shaping",
  "completed_recently",
];

export function renderCompanyTable(table: CompanyTable): string {
  const lines: string[] = [];

  lines.push("# Company Table");
  lines.push(`Built: ${table.builtAt} | Partition: ${table.sourcePartition} | Source age: ${table.sourceAgeMs}ms`);
  lines.push("");

  // Summary counts
  lines.push("## Summary");
  for (const state of SECTION_ORDER) {
    const count = table.stateCounts[state];
    if (count > 0) {
      lines.push(`  ${STATE_LABELS[state]}: ${count}`);
    }
  }
  lines.push(`  Total: ${table.entries.length}`);
  lines.push("");

  // Source availability
  lines.push("## Sources");
  for (const src of table.sourceAvailability) {
    const status = src.available ? `${src.itemCount} item(s)` : "not available";
    lines.push(`  ${src.family}: ${status}`);
  }
  lines.push("");

  // Sections by state
  for (const state of SECTION_ORDER) {
    const items = table.entries.filter((e) => e.state === state);
    if (items.length === 0) continue;

    lines.push(`## ${STATE_LABELS[state]}`);
    for (const entry of items) {
      lines.push(renderEntry(entry));
    }
    lines.push("");
  }

  // Parity
  lines.push("## Parity");
  lines.push(`  Source items: ${table.parity.totalSourceItems} -> Table entries: ${table.parity.totalTableEntries}`);
  lines.push(`  Multi-source: ${table.parity.multiSourceEntries} | Ambiguous: ${table.parity.ambiguousEntries} | Missing sources: ${table.parity.missingSourceEntries}`);
  lines.push(`  Metadata completeness: ${(table.sourceMetadataCompletenessRate * 100).toFixed(1)}%`);
  lines.push("");

  return lines.join("\n");
}

function renderEntry(entry: TableEntry): string {
  const parts: string[] = [];
  parts.push(`  [${entry.id}] ${entry.label}`);
  parts.push(`    ${entry.progressNote}`);
  parts.push(`    Sources: ${entry.contributingSources.join(", ") || "none"}`);

  if (entry.blockers.length > 0) {
    for (const b of entry.blockers) {
      parts.push(`    ! ${b}`);
    }
  }

  if (entry.openDecisions.length > 0) {
    for (const d of entry.openDecisions) {
      parts.push(`    ? ${d}`);
    }
  }

  if (entry.hasAmbiguity) {
    for (const note of entry.ambiguityNotes) {
      parts.push(`    ~ ${note.message}`);
    }
  }

  if (entry.missingSourceFamilies.length > 0) {
    parts.push(`    (missing: ${entry.missingSourceFamilies.join(", ")})`);
  }

  return parts.join("\n");
}
