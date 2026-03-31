import test from "node:test";
import assert from "node:assert/strict";
import { parseLeaderOutput } from "./engine.js";
import type { ReviewRuntimeConfig } from "./types.js";

const runtimeConfig: ReviewRuntimeConfig = {
  sharedContract: {
    reviewer_output: {
      verdicts: ["approved", "conditional", "reject"],
      severity_levels: ["blocking", "major", "minor", "suggestion"],
      required_sections: ["verdict", "conceptual_groups", "residual_risks", "strengths"],
      conceptual_groups: {
        required_fields: ["id", "summary", "severity", "findings", "redesign_guidance"],
        finding_required_fields: ["id", "description", "source_section"],
      },
      fix_decisions: {
        required_when_fix_items_map_present: false,
        identity_fields: ["finding_id", "finding_group_id"],
        allowed_decisions: ["accept_fix", "reject_fix", "accept_rejection", "reject_rejection"],
      },
    },
    leader_output: {
      allowed_statuses: ["frozen", "frozen_with_conditions", "pushback", "blocked", "resume_required"],
      required_fields: ["status", "rationale", "unresolved", "improvements_applied", "arbitration_used", "arbitration_rationale"],
      arbitration_rule: "Arbitration is minor-only.",
    },
  },
  componentPrompt: {},
  componentContract: {},
};

test("parseLeaderOutput accepts frozen_with_conditions without arbitration when no leader arbitration was used", () => {
  const parsed = parseLeaderOutput(JSON.stringify({
    status: "frozen_with_conditions",
    rationale: "A reviewer remains conditional with non-blocking recommendations only.",
    unresolved: [],
    improvements_applied: ["Aligned the blocked-path self-check predicate."],
    arbitration_used: false,
    arbitration_rationale: null,
  }), { config: runtimeConfig });

  assert.equal(parsed.status, "frozen_with_conditions");
  assert.equal(parsed.arbitration_used, false);
  assert.equal(parsed.arbitration_rationale, null);
});

test("parseLeaderOutput rejects arbitration evidence on statuses other than frozen_with_conditions", () => {
  assert.throws(
    () => parseLeaderOutput(JSON.stringify({
      status: "frozen",
      rationale: "Everything is approved.",
      unresolved: [],
      improvements_applied: [],
      arbitration_used: true,
      arbitration_rationale: "Leader arbitration should not be needed for a clean freeze.",
    }), { config: runtimeConfig }),
    /only legal for frozen_with_conditions/i
  );
});
