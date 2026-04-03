/**
 * Fixture: Full lifecycle — all source families present, multiple items at different stages.
 */

import type { RawThreadInput, RawRequirementInput, RawAdmissionInput, RawImplementPlanInput } from "../source-adapters.js";

const now = new Date().toISOString();

export const threads: RawThreadInput[] = [
  {
    id: "thread-shaping-1",
    status: "active",
    scopePath: "feature-alpha",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-04-02T14:00:00.000Z",
    workflowState: {
      active_workflow: "requirements_gathering_onion",
      onion: {
        trace_id: "trace-alpha",
        lifecycle_status: "active",
        current_layer: "goal",
        state: { topic: "Feature Alpha", freeze_status: { status: "draft", blockers: [] }, open_decisions: [{ question: "Which API to use?" }] },
        finalized_requirement_memory_id: null,
        working_artifact: { approved_snapshot: null },
      },
    },
  },
  {
    id: "thread-frozen-1",
    status: "active",
    scopePath: "feature-beta",
    createdAt: "2026-03-10T10:00:00.000Z",
    updatedAt: "2026-04-01T12:00:00.000Z",
    workflowState: {
      active_workflow: "requirements_gathering_onion",
      onion: {
        trace_id: "trace-beta",
        lifecycle_status: "handoff_ready",
        current_layer: "whole_onion_freeze",
        state: { topic: "Feature Beta", freeze_status: { status: "approved", blockers: [] }, open_decisions: [] },
        finalized_requirement_memory_id: "mem-beta-123",
        working_artifact: { approved_snapshot: { approved_turn_id: "turn-99" } },
      },
    },
  },
  {
    id: "thread-completed-1",
    status: "completed",
    scopePath: "feature-gamma",
    createdAt: "2026-02-15T10:00:00.000Z",
    updatedAt: "2026-03-28T09:00:00.000Z",
    workflowState: {
      active_workflow: null,
      onion: {
        trace_id: "trace-gamma",
        lifecycle_status: "handoff_ready",
        current_layer: null,
        state: { topic: "Feature Gamma", freeze_status: { status: "approved", blockers: [] }, open_decisions: [] },
        finalized_requirement_memory_id: "mem-gamma-456",
        working_artifact: { approved_snapshot: { approved_turn_id: "turn-50" } },
      },
    },
  },
];

export const requirements: RawRequirementInput[] = [
  {
    feature_slug: "feature-beta",
    requirement_artifact_source: "onion-trace-beta",
    frozen_at: "2026-04-01T12:00:00.000Z",
    business_priority: "high",
    requirement_items: [{ id: "r1" }, { id: "r2" }, { id: "r3" }],
    explicit_boundaries: [{ text: "no UI" }],
    open_business_decisions: [],
    derivation_status: "ready",
    blockers: [],
  },
  {
    feature_slug: "feature-gamma",
    requirement_artifact_source: "onion-trace-gamma",
    frozen_at: "2026-03-25T10:00:00.000Z",
    business_priority: "critical",
    requirement_items: [{ id: "r1" }, { id: "r2" }],
    explicit_boundaries: [],
    open_business_decisions: [],
    derivation_status: "ready",
    blockers: [],
  },
];

export const admissions: RawAdmissionInput[] = [
  {
    feature_slug: "feature-gamma",
    decision: "admit",
    decision_reason: "Critical feature for Phase 1",
    decided_at: "2026-03-26T10:00:00.000Z",
    dependency_blocked: false,
    scope_conflict_detected: false,
    packet_built_at: "2026-03-25T11:00:00.000Z",
    outcome: "admitted",
  },
];

export const plans: RawImplementPlanInput[] = [
  {
    feature_slug: "feature-gamma",
    phase_number: 1,
    feature_status: "completed",
    active_run_status: "completed",
    merge_status: "merged",
    last_completed_step: "marked_complete",
    last_error: null,
    created_at: "2026-03-26T11:00:00.000Z",
    updated_at: "2026-03-28T09:00:00.000Z",
    feature_branch: "implement-plan/phase1/feature-gamma",
  },
];
