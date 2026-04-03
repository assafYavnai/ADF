/**
 * Fixture: Blocked feature needing CEO attention
 *
 * One actively blocked feature, one healthy active feature, one global open loop.
 */
import type { BriefSourceFacts } from "../types.js";

export const blockedAttentionFacts: BriefSourceFacts = {
  collectedAt: new Date().toISOString(),
  sourcePartition: "proof",
  globalOpenLoops: ["Budget approval for Q3 infrastructure expansion"],
  features: [
    {
      id: "feat-auth-rewrite",
      label: "Auth Middleware Rewrite",
      status: "blocked",
      lastActivityAt: new Date(Date.now() - 86_400_000).toISOString(),
      openLoops: [
        "Legal review of session token storage policy",
        "Waiting for compliance team sign-off",
      ],
      openDecisions: [
        {
          question: "Store tokens server-side or in encrypted cookies?",
          impact: "Affects compliance posture and performance characteristics",
          status: "open",
        },
        {
          question: "Migrate existing sessions or force re-auth?",
          impact: "User disruption vs. security risk during transition",
          status: "open",
        },
      ],
      currentLayer: "boundaries",
      progressSummary: "Blocked on legal/compliance review",
      blockers: [
        "Legal review pending — cannot proceed without compliance approval",
        "Security team capacity unavailable until next sprint",
      ],
      isFinalized: false,
    },
    {
      id: "feat-dashboard",
      label: "Executive Dashboard",
      status: "active",
      lastActivityAt: new Date(Date.now() - 1_800_000).toISOString(),
      openLoops: [],
      openDecisions: [],
      currentLayer: "experience_ui",
      progressSummary: "Designing UI wireframes for executive dashboard",
      blockers: [],
      isFinalized: false,
    },
  ],
};
