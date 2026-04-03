/**
 * Fixture: Post-completion closeout view
 *
 * Two completed features — one finalized, one pending closeout.
 * The brief should surface the not-yet-finalized one in What's Next.
 */
import type { BriefSourceFacts } from "../types.js";

export const postCompletionCloseoutFacts: BriefSourceFacts = {
  collectedAt: new Date().toISOString(),
  sourcePartition: "proof",
  globalOpenLoops: [],
  features: [
    {
      id: "feat-onboarding",
      label: "User Onboarding Flow",
      status: "completed",
      lastActivityAt: new Date(Date.now() - 172_800_000).toISOString(),
      openLoops: [],
      openDecisions: [],
      currentLayer: null,
      progressSummary: "Delivered and verified in production",
      blockers: [],
      isFinalized: true,
    },
    {
      id: "feat-payments",
      label: "Payment Processing",
      status: "completed",
      lastActivityAt: new Date(Date.now() - 3_600_000).toISOString(),
      openLoops: ["Post-launch monitoring for 48h not yet elapsed"],
      openDecisions: [],
      currentLayer: null,
      progressSummary: "Merged but closeout documentation pending",
      blockers: [],
      isFinalized: false,
    },
  ],
};
