/**
 * Fixture: Conflict / ambiguity — sources disagree on the state of an item.
 * Tests that ambiguity is surfaced explicitly rather than silently resolved.
 */

import type { RawThreadInput, RawRequirementInput, RawAdmissionInput, RawImplementPlanInput } from "../source-adapters.js";

// Feature Zeta: thread says active/shaping, but plan says completed.
// This is a real conflict — the table must flag ambiguity.

export const threads: RawThreadInput[] = [
  {
    id: "thread-zeta",
    status: "active",
    scopePath: "feature-zeta",
    createdAt: "2026-03-20T10:00:00.000Z",
    updatedAt: "2026-04-03T10:00:00.000Z",
    workflowState: {
      active_workflow: "requirements_gathering_onion",
      onion: {
        trace_id: "trace-zeta",
        lifecycle_status: "active",
        current_layer: "boundaries",
        state: { topic: "Feature Zeta", freeze_status: { status: "draft", blockers: [] }, open_decisions: [] },
        finalized_requirement_memory_id: null,
        working_artifact: { approved_snapshot: null },
      },
    },
  },
];

export const requirements: RawRequirementInput[] = [];

export const admissions: RawAdmissionInput[] = [
  {
    feature_slug: "feature-zeta",
    decision: "admit",
    decision_reason: "Fast-tracked for Phase 1",
    decided_at: "2026-03-22T10:00:00.000Z",
    dependency_blocked: false,
    scope_conflict_detected: false,
    packet_built_at: "2026-03-21T14:00:00.000Z",
    outcome: "admitted",
  },
];

export const plans: RawImplementPlanInput[] = [
  {
    feature_slug: "feature-zeta",
    phase_number: 1,
    feature_status: "completed",
    active_run_status: "completed",
    merge_status: "merged",
    last_completed_step: "marked_complete",
    last_error: null,
    created_at: "2026-03-22T11:00:00.000Z",
    updated_at: "2026-04-01T09:00:00.000Z",
    feature_branch: "implement-plan/phase1/feature-zeta",
  },
];
