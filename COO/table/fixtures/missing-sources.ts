/**
 * Fixture: Missing sources — some families not provided at all.
 * Tests graceful degradation and missing-source flags.
 */

import type { RawThreadInput, RawImplementPlanInput } from "../source-adapters.js";

// Only threads and plans provided — requirements and admissions are missing (undefined)

export const threads: RawThreadInput[] = [
  {
    id: "thread-only-1",
    status: "active",
    scopePath: "feature-delta",
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-03T08:00:00.000Z",
    workflowState: {
      active_workflow: "requirements_gathering_onion",
      onion: {
        trace_id: "trace-delta",
        lifecycle_status: "active",
        current_layer: "major_parts",
        state: { topic: "Feature Delta", freeze_status: { status: "draft", blockers: [] }, open_decisions: [] },
        finalized_requirement_memory_id: null,
        working_artifact: { approved_snapshot: null },
      },
    },
  },
];

export const plans: RawImplementPlanInput[] = [
  {
    feature_slug: "feature-epsilon",
    phase_number: 1,
    feature_status: "active",
    active_run_status: "implementation_in_progress",
    merge_status: "not_ready",
    last_completed_step: "implementor_started",
    last_error: null,
    created_at: "2026-04-02T10:00:00.000Z",
    updated_at: "2026-04-03T12:00:00.000Z",
    feature_branch: "implement-plan/phase1/feature-epsilon",
  },
];
