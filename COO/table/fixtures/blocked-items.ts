/**
 * Fixture: Blocked items — items blocked from multiple source families.
 * Tests that blocked work surfaces correctly and remains visible.
 */

import type { RawThreadInput, RawRequirementInput, RawAdmissionInput, RawImplementPlanInput } from "../source-adapters.js";

export const threads: RawThreadInput[] = [
  {
    id: "thread-blocked-freeze",
    status: "active",
    scopePath: "feature-eta",
    createdAt: "2026-03-15T10:00:00.000Z",
    updatedAt: "2026-04-02T16:00:00.000Z",
    workflowState: {
      active_workflow: "requirements_gathering_onion",
      onion: {
        trace_id: "trace-eta",
        lifecycle_status: "blocked",
        current_layer: "whole_onion_freeze",
        state: {
          topic: "Feature Eta",
          freeze_status: { status: "blocked", blockers: ["Legal review required", "API dependency unresolved"] },
          open_decisions: [{ question: "Which compliance framework?" }],
        },
        finalized_requirement_memory_id: null,
        working_artifact: { approved_snapshot: null },
      },
    },
  },
];

export const requirements: RawRequirementInput[] = [
  {
    feature_slug: "feature-theta",
    requirement_artifact_source: "onion-trace-theta",
    frozen_at: "2026-03-28T10:00:00.000Z",
    business_priority: "high",
    requirement_items: [{ id: "r1" }],
    explicit_boundaries: [],
    open_business_decisions: [],
    derivation_status: "blocked",
    blockers: ["External API not yet available"],
  },
];

export const admissions: RawAdmissionInput[] = [
  {
    feature_slug: "feature-iota",
    decision: "block",
    decision_reason: "Scope conflict with feature-kappa",
    decided_at: "2026-04-01T10:00:00.000Z",
    dependency_blocked: true,
    scope_conflict_detected: true,
    packet_built_at: "2026-03-30T14:00:00.000Z",
    outcome: "blocked",
  },
];

export const plans: RawImplementPlanInput[] = [
  {
    feature_slug: "feature-kappa",
    phase_number: 1,
    feature_status: "paused",
    active_run_status: "implementation_in_progress",
    merge_status: "not_ready",
    last_completed_step: "implementor_started",
    last_error: "Build failure in COO/kappa module",
    created_at: "2026-03-25T10:00:00.000Z",
    updated_at: "2026-04-02T18:00:00.000Z",
    feature_branch: "implement-plan/phase1/feature-kappa",
  },
];
