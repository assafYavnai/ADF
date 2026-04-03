/**
 * Executive Brief Renderer
 *
 * Takes a derived ExecutiveBrief and produces a compact, business-level
 * text output with exactly 4 sections in fixed order.
 */

import type { ExecutiveBrief } from "./types.js";

export function renderExecutiveBrief(brief: ExecutiveBrief): string {
  const sections: string[] = [];

  // --- Section 1: Issues That Need Your Attention ---
  sections.push("## Issues That Need Your Attention");
  if (brief.issues.length === 0) {
    sections.push("No blocked items or issues requiring attention.");
  } else {
    for (const issue of brief.issues) {
      sections.push(`\n### ${issue.featureLabel}`);
      sections.push(`**${issue.headline}**`);
      for (const detail of issue.details) {
        sections.push(`- ${detail}`);
      }
    }
  }

  // --- Section 2: On The Table ---
  sections.push("\n## On The Table");
  if (brief.onTheTable.length === 0) {
    sections.push("No open decisions pending.");
  } else {
    for (const item of brief.onTheTable) {
      sections.push(`- **${item.featureLabel}**: ${item.summary}`);
    }
  }

  // --- Section 3: In Motion ---
  sections.push("\n## In Motion");
  if (brief.inMotion.length === 0) {
    sections.push("No features actively in progress.");
  } else {
    for (const item of brief.inMotion) {
      const layer = item.currentLayer ? ` (${item.currentLayer})` : "";
      sections.push(`- **${item.featureLabel}**${layer}: ${item.progressSummary}`);
    }
  }

  // --- Section 4: What's Next ---
  sections.push("\n## What's Next");
  if (brief.whatsNext.length === 0) {
    sections.push("No pending next actions.");
  } else {
    for (const item of brief.whatsNext) {
      sections.push(`- **${item.featureLabel}**: ${item.nextAction}`);
    }
  }

  return sections.join("\n");
}
