1. Implementation Objective

Build a standalone company-level table and queue read model under COO/table/** that aggregates Phase 1 work from four source families (thread/onion, finalized requirement, CTO admission, implement-plan) into a normalized management view with explicit ambiguity handling, without wiring into the live COO runtime.

2. Slice Scope

- Typed company table read-model package under COO/table/**
- Source-adapter layer for thread/onion state, finalized requirements, CTO admission artifacts, and implement-plan feature state
- Normalizer that correlates sources and maps raw truth into 7 normalized states (shaping, admission_pending, admitted, in_motion, blocked, next, completed_recently)
- Compact text renderer for management view
- KPI instrumentation with latency percentiles, slow buckets, all required counters, and partition isolation
- Fixtures covering full lifecycle, empty sources, missing sources, conflict/ambiguity, and blocked items
- Proof tests for all scenarios
- Feature docs under docs/phase1/company-table-queue-read-model/**

3. Required Deliverables

- COO/table/types.ts — typed interfaces
- COO/table/source-adapters.ts — 4 source family adapters + fact collector
- COO/table/normalizer.ts — correlator + state resolver with ambiguity detection
- COO/table/renderer.ts — compact text management view
- COO/table/kpi.ts — instrumented build/render with all required KPI counters
- COO/table/index.ts — public API barrel export
- COO/table/fixtures/ — 5 fixture files
- COO/table/company-table.test.ts — proof tests
- COO/tsconfig.json — add table/**/* to includes
- docs/phase1/company-table-queue-read-model/completion-summary.md
- docs/phase1/company-table-queue-read-model/context.md

4. Allowed Edits

- COO/table/**
- COO/tsconfig.json (additive only: add table/**/* to includes)
- docs/phase1/company-table-queue-read-model/**

5. Forbidden Edits

- COO/controller/**
- COO/briefing/**
- COO/cto-admission/**
- implement-plan skill code
- review-cycle skill code
- merge-queue skill code
- runtime wiring in this slice
- other slice folders under docs/phase1/

6. Acceptance Gates

- The read model builds from partial and full source sets
- All 7 normalized states are supported explicitly
- Blocked work surfaces correctly and is sorted first
- Ambiguous source cases surface explicit ambiguityNotes rather than silently resolving
- Missing-source cases are distinguishable from true empty-state cases
- The package stays standalone and unwired
- Proof tests cover mixed-source, empty-state, missing-source, conflict, and blocked scenarios
- KPI counters and freshness metrics are proven

KPI Applicability: required

KPI Route / Touched Path: COO/table/** — standalone table build + render path, no live runtime route

KPI Raw-Truth Source: In-memory KPI collector in COO/table/kpi.ts, recording TableBuildMetrics per build cycle

KPI Coverage / Proof:
- table_build_latency_ms with p50/p95/p99
- slow table-build buckets over 1s/10s/60s
- table_build_success_count / table_build_failure_count
- table_missing_source_count
- table_ambiguous_state_count
- table_blocked_item_count
- table_admission_pending_count / table_in_motion_count / table_completed_recently_count
- table_source_freshness_age_ms / table_source_parity_count
- partition isolation proof

KPI Production / Proof Partition: Source partition tag (production/proof/mixed) carried through from input to output and recorded in KPI metrics. Partition isolation proven in tests.

Machine Verification Plan
- npm.cmd run build from C:/ADF/COO
- npx.cmd tsx --test COO/table/company-table.test.ts
- Validate deterministic rendering/normalization
- Validate missing-source handling
- Validate ambiguity/conflict handling
- Validate KPI counters and freshness metrics

Human Verification Plan
- Required: false
- Reason: this slice is a standalone artifact package, not a live CEO-facing runtime surface yet

7. Observability / Audit

- KPI truth is derived from in-memory collector records, verifiable through getKpiReport()
- Parity is provable between raw source item counts and normalized table entry counts
- Ambiguity/conflict cases are countable via parity.ambiguousEntries and per-entry hasAmbiguity flag
- Blocked work is always visible via stateCounts.blocked and entry sort order
- Recent completion is distinguishable from active motion via separate state values
- Source freshness is tracked per source family via availability.freshnessAgeMs
- Worktree and merge state are tracked in implement-plan-state.json
- Review-cycle status: not configured for this slice
- Machine verification status: build and 35 tests passing

8. Dependencies / Constraints

- Preserve existing type contracts from COO/controller/thread.ts, COO/requirements-gathering/contracts/, COO/cto-admission/types.ts
- Source adapters read from provided data only — no filesystem reads in the package
- The package must remain unwired to any live COO runtime surface in this slice

9. Non-Goals

- No live COO status command
- No startup summary wiring
- No queue scheduler
- No automatic admission generation
- No downstream execution orchestration changes
- No dashboard or UI
- No COO/controller, COO/briefing, or COO/cto-admission changes

10. Source Authorities

- docs/phase1/company-table-queue-read-model/README.md
- docs/phase1/company-table-queue-read-model/context.md
- COO/controller/thread.ts (Thread type contracts)
- COO/requirements-gathering/contracts/onion-artifact.ts (RequirementArtifact contracts)
- COO/cto-admission/types.ts (admission type contracts)
- COO/briefing/types.ts (pattern reference for derived read model)
- COO/briefing/kpi.ts (pattern reference for KPI instrumentation)
