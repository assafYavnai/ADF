1. Implementation Objective

Build the standalone company-level table and queue read model under COO/table/** from four truth source families, with normalized state resolution, explicit ambiguity handling, compact rendering, and full KPI instrumentation.

2. Exact Slice Scope

- COO/table/types.ts, source-adapters.ts, normalizer.ts, renderer.ts, kpi.ts, index.ts
- COO/table/fixtures/ (5 fixture files)
- COO/table/company-table.test.ts
- COO/tsconfig.json (additive: table/**/* to includes)
- docs/phase1/company-table-queue-read-model/**

3. Inputs / Authorities Read

- docs/phase1/company-table-queue-read-model/README.md — feature plan
- docs/phase1/company-table-queue-read-model/context.md — constraints and design decisions
- COO/controller/thread.ts — Thread type contracts
- COO/requirements-gathering/contracts/onion-artifact.ts — requirement artifact contracts
- COO/cto-admission/types.ts — admission type contracts
- COO/briefing/types.ts — pattern reference for derived read model
- COO/briefing/kpi.ts — pattern reference for KPI instrumentation

4. Required Deliverables

- Typed company table read-model package under COO/table/**
- Source-adapter layer for 4 source families
- Normalizer with conflict/ambiguity detection
- Compact text renderer
- KPI instrumentation with all 12+ required counters
- 5 fixture sets and proof tests
- Feature docs and completion summary

5. Forbidden Edits

- COO/controller/**
- COO/briefing/**
- COO/cto-admission/**
- implement-plan, review-cycle, merge-queue skill code
- Runtime wiring
- Other slice folders

6. Integrity-Verified Assumptions Only

- Source families are read-only — adapters never write back
- Missing-source vs empty-state must be distinguishable
- Ambiguity from multiple sources must be surfaced explicitly
- Blocked items must always be visible
- Recent completion must be distinct from active motion
- The package is standalone — no live runtime wiring in this slice

7. Explicit Non-Goals

- No live COO status command
- No startup summary wiring
- No queue scheduler
- No automatic admission generation
- No downstream execution orchestration changes

8. Proof / Verification Expectations

Machine Verification Plan:
- npm.cmd run build from C:/ADF/COO
- npx.cmd tsx --test COO/table/company-table.test.ts
- Validate deterministic rendering/normalization
- Validate missing-source handling
- Validate ambiguity/conflict handling
- Validate KPI counters and freshness metrics

Human Verification Plan:
- Required: false
- Reason: standalone artifact package, not a live runtime surface

9. Required Artifact Updates

- docs/phase1/company-table-queue-read-model/context.md
- docs/phase1/company-table-queue-read-model/completion-summary.md
- docs/phase1/company-table-queue-read-model/implement-plan-state.json

10. Closeout Rules

- Human testing is not required for this slice
- Review-cycle runs when post_send_to_review is configured
- Post-human-approval sanity pass is not applicable
- Final completion happens only after merge-queue records merge success truthfully
- Do not mark the feature completed until merge-queue lands the approved commit
