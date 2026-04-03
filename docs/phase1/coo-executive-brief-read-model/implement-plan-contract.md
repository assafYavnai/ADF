# 1. Implementation Objective

Build a standalone CEO-facing executive brief read model under COO/briefing/** that derives a 4-section brief (Issues That Need Your Attention, On The Table, In Motion, What's Next) from existing source truth inputs, with full KPI instrumentation and fixture proof, without wiring into the active COO runtime.

# 2. Slice Scope

- COO/briefing/types.ts — typed read model interfaces
- COO/briefing/builder.ts — brief builder that derives the read model from source inputs
- COO/briefing/renderer.ts — compact renderer producing the 4-section output
- COO/briefing/kpi.ts — KPI instrumentation for brief build/render
- COO/briefing/fixtures/ — fixture inputs for all required test cases
- COO/briefing/executive-brief.test.ts — proof tests
- COO/briefing/INTEGRATION.md — integration note for future runtime wiring
- docs/phase1/coo-executive-brief-read-model/** — plan and closeout artifacts

# 3. Required Deliverables

- Typed executive-brief read model under COO/briefing/**
- A renderer that outputs the 4-section brief from the derived model
- Fixture inputs and proof tests for: normal in-flight, blocked attention-needed, empty/low-activity, post-completion closeout
- KPI instrumentation with all 10+ metrics defined in the plan
- A short integration note (INTEGRATION.md)
- context.md and completion-summary.md

# 4. Allowed Edits

- COO/briefing/**
- tests focused on COO/briefing/**
- docs/phase1/coo-executive-brief-read-model/**

# 5. Forbidden Edits

- COO/controller/cli.ts
- COO/controller/loop.ts
- COO/requirements-gathering/live/onion-live.ts
- shared/telemetry/**
- components/memory-engine/**
- queue engine files
- status command files
- any other slice folders

# 6. Acceptance Gates

## Machine Verification Plan
- Run targeted tests for COO/briefing/**
- Validate all fixture cases render deterministically
- Typecheck any new TypeScript files touched by the slice

## Human Verification Plan
- Required: false
- Reason: this slice intentionally stops before runtime wiring and human-facing CLI exposure

# 7. Observability / Audit

KPI metrics to implement and evidence:
- exec_brief_build_latency_ms with p50/p95/p99
- slow brief-build buckets over 1s/10s/60s
- exec_brief_render_success_count
- exec_brief_render_failure_count
- brief_source_metadata_completeness_rate
- issues_visibility_parity_count
- table_parity_count
- in_motion_parity_count
- next_step_parity_count
- stale_source_age_ms or equivalent freshness indicator
- partition/isolation proof when production and proof inputs coexist

Audit rules:
- Source truth remains authoritative; the brief is derived only
- KPI claims must be auditable from source facts and derived output
- Blocked items must surface in Issues section
- Production/proof isolation semantics preserved

Visibility:
- Machine verification status: via test pass/fail
- Review-cycle status: tracked in implement-plan-state.json
- Merge status: tracked in implement-plan-state.json
- Worktree state: tracked in implement-plan-state.json

# 8. Dependencies / Constraints

- Read-only dependency on existing Thread, StateCommitEvent, OnionWorkflowThreadState, OnionState shapes
- Must not import from or modify shared/telemetry — uses its own local KPI instrumentation
- Must not wire into COO runtime while KPI lane is active

# 9. Non-Goals

- No CLI command
- No startup summary wiring
- No memory-engine persistence changes
- No adaptive personalization logic
- No queue or CTO state model

# 10. Source Authorities

- C:/ADF/docs/phase1/coo-executive-brief-read-model/README.md (approved plan)
- C:/ADF/docs/phase1/coo-executive-brief-read-model/context.md (slice context)
- C:/ADF/COO/controller/thread.ts (Thread, event types)
- C:/ADF/COO/requirements-gathering/contracts/onion-state.ts (OnionState, OpenDecision)
- C:/ADF/COO/requirements-gathering/contracts/onion-live.ts (OnionWorkflowThreadState, lifecycle status)
