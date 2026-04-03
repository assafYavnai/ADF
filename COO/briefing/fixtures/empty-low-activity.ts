/**
 * Fixture: Empty / low-activity state
 *
 * No active features, no open loops, no blockers.
 * The brief should still render all 4 sections with appropriate empty-state text.
 */
import type { BriefSourceFacts } from "../types.js";

export const emptyLowActivityFacts: BriefSourceFacts = {
  collectedAt: new Date().toISOString(),
  sourcePartition: "proof",
  globalOpenLoops: [],
  features: [],
};
