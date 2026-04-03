/**
 * Fixture: Normal in-flight work
 *
 * Two active features, one with open decisions, no blockers.
 */
import type { BriefSourceFacts } from "../types.js";

export const normalInFlightFacts: BriefSourceFacts = {
  collectedAt: new Date().toISOString(),
  sourcePartition: "proof",
  globalOpenLoops: [],
  features: [
    {
      id: "feat-shipping-calc",
      label: "Shipping Calculator",
      status: "active",
      lastActivityAt: new Date(Date.now() - 3_600_000).toISOString(),
      openLoops: ["Confirm carrier rate tables"],
      openDecisions: [
        {
          question: "Which carriers to support in v1?",
          impact: "Determines API surface and partner contracts",
          status: "open",
        },
      ],
      currentLayer: "major_parts",
      progressSummary: "Defining major parts for shipping calculation engine",
      blockers: [],
      isFinalized: false,
    },
    {
      id: "feat-invoice-gen",
      label: "Invoice Generation",
      status: "active",
      lastActivityAt: new Date(Date.now() - 7_200_000).toISOString(),
      openLoops: [],
      openDecisions: [],
      currentLayer: "goal",
      progressSummary: "Clarifying goal layer with stakeholder input",
      blockers: [],
      isFinalized: false,
    },
  ],
};
