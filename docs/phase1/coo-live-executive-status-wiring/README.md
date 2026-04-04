# coo-live-executive-status-wiring

## Target Local Folder
C:/ADF/docs/phase1/coo-live-executive-status-wiring/README.md

## Feature Goal
Wire the merged `COO/briefing/**` executive-brief read model into the live COO runtime so the CEO can get a real business-level status surface that answers what needs attention, what is on the table, what is moving, and what is next.

## Why This Slice Exists Now
- The executive-brief package is merged, but it is still not wired into the active COO runtime, CLI, or controller.
- Phase 1 still lacks a strong live answer to "what is on our table?"
- The user should be able to ask for live COO status without receiving an internal-state dump.

## Requested Scope
Build the live executive/status surface around the merged briefing package.

This slice must:
- create a live source-facts adapter that reads current COO state into `BriefSourceFacts`
- consume at least these source families when present:
  - active COO threads / onion state
  - finalized requirement artifacts
  - CTO-admission artifacts when present
  - implement-plan feature truth when present
- render the 4 briefing sections from live data:
  - Issues That Need Your Attention
  - On The Table
  - In Motion
  - What's Next
- expose the live brief through the COO surface:
  - startup summary and/or status command, following existing CLI conventions
- keep the briefing layer derived-only; do not write back into source truth
- degrade gracefully when one source family is missing, instead of failing the whole status surface

## Allowed Edits
- COO/briefing/**
- COO/controller/** where the live status surface must be wired
- COO/requirements-gathering/** only for read-shape helpers or additive adapters
- docs/phase1/coo-live-executive-status-wiring/**
- tightly scoped tests for the above

## Forbidden Edits
- no implement-plan changes
- no review-cycle changes
- no merge-queue changes
- no queue scheduler buildout
- no unrelated onion-behavior redesign
- no broad memory-engine redesign
- no edits to other slice folders

## Required Deliverables
- a live `BriefSourceFacts` adapter for the COO runtime
- a real status/startup surface that renders the executive brief from live state
- graceful handling of partial/missing sources
- proof tests for the 4-section live rendering path
- context.md
- completion-summary.md

## Status Surface Rules
- the output must stay business-level, not a raw state dump
- blocked items must appear in `Issues That Need Your Attention`
- `On The Table` must include unresolved work that is shaping or awaiting decision
- `In Motion` must reflect active live work
- `What's Next` must stay concise and forward-looking
- if CTO-admission artifacts are not present yet, the surface must still render shaping and implementation truth cleanly

## Production KPI / Audit Matrix Requirements
Define explicit KPIs for this slice:
- `live_exec_brief_build_latency_ms` with p50, p95, p99
- slow status-build buckets over 1s, 10s, and 60s
- `live_exec_brief_render_success_count`
- `live_exec_brief_render_failure_count`
- `live_status_invocation_count`
- `live_source_adapter_missing_source_count`
- `issues_visibility_parity_count`
- `table_visibility_parity_count`
- `in_motion_visibility_parity_count`
- `next_visibility_parity_count`
- `live_source_freshness_age_ms`
- partition/isolation proof when production and proof inputs coexist

Audit rules:
- the executive brief remains derived-only
- parity mismatches must be visible and countable
- missing-source cases must remain distinguishable from empty-state cases
- the live status surface must not silently drop blocked or attention-worthy items

## Acceptance Gates
- KPI Applicability: required
- KPI Route / Touched Path: `CLI/startup summary/status surface -> COO/controller live status wiring -> COO/briefing live source-facts adapter -> executive brief renderer -> KPI emission`
- KPI Raw-Truth Source: shared telemetry rows emitted by the real COO CLI/status path for production and proof partitions, plus deterministic proof tests for source adaptation/render parity
- KPI Coverage / Proof:
  - prove the live status surface through the real COO CLI/status entry surface and its startup/status rendering path
  - prove full-source, partial-source, and empty-source rendering
  - prove parity counters, missing-source counters, latency buckets, and freshness age reporting
  - prove production/proof isolation when proof inputs coexist with production inputs
- KPI Production / Proof Partition:
  - production invocations must emit production-partition telemetry
  - proof and test invocations must emit proof-partition telemetry
  - rollups and closeout evidence must keep proof truth distinguishable from production truth
- KPI Non-Applicability Rationale: not applicable because KPI instrumentation is required for this live CEO-facing status surface
- KPI Exception Owner: none
- KPI Exception Expiry: none
- KPI Exception Production Status: none
- KPI Compensating Control: none
- the COO runtime can render the executive brief from live data
- the 4 sections always appear in the correct order
- the status surface stays business-level and concise
- blocked items surface concretely in `Issues`
- missing source families degrade gracefully instead of crashing the surface
- tests prove rendering across mixed live-state scenarios

## Machine Verification Plan
- run targeted tests for live source adaptation and status rendering
- validate that the surface works with full sources, partial sources, and empty sources
- validate parity counters and freshness metrics
- validate that no source mutation occurs during brief generation

## Human Verification Plan
- Required: true
- Reason: this slice creates a real CEO-facing runtime surface and should be checked for usefulness and readability
- IMPLEMENTATION COMPLETE AND READY FOR YOUR TESTING
- Executive summary of implemented behavior:
  - the COO startup/status surface renders a live 4-section executive brief derived from active threads, finalized requirements, CTO-admission truth when present, and implement-plan truth when present
  - missing source families degrade gracefully and remain visibly distinguishable from truly empty-state results
- IMPLEMENTATION IS READY FOR TESTING
- Exact testing sequence:
  - launch the COO through the normal CLI path
  - inspect the startup summary and the status command output
  - confirm the four sections appear in this order: `Issues That Need Your Attention`, `On The Table`, `In Motion`, `What's Next`
  - confirm blocked work appears in `Issues`, unresolved shaping or awaiting-decision work appears in `On The Table`, active live work appears in `In Motion`, and the forward-looking concise items appear in `What's Next`
  - confirm the output stays business-level and does not dump raw state objects
  - confirm missing CTO-admission inputs do not break the surface and that shaping/implementation truth still renders cleanly
- Expected results:
  - the surface is readable, concise, and useful for CEO triage
  - the surface remains stable when some source families are missing
  - the output reflects live runtime truth instead of static fixtures
- Evidence to report back:
  - whether the brief was understandable and decision-useful
  - any section that felt misleading, noisy, or incomplete
  - whether any blocked item, table item, live work item, or next-step item was missing or misplaced
- Response contract:
  - `APPROVED`
  - `REJECTED: <comments>`
- IMPLEMENTATION COMPLETE AND READY FOR YOUR TESTING

## Non-Goals
- no full queue manager
- no CTO admission generation in this slice
- no downstream implementation orchestration changes
- no adaptive personalization engine beyond what is minimally needed for the live surface

## Scope Claim
This slice owns only:
- COO/briefing/**
- the minimum controller/runtime wiring needed for a real live status surface
- docs/phase1/coo-live-executive-status-wiring/**
- tightly scoped tests for the same path

## Execution Route Update
This slice must run through the full governed path:
- implement-plan prepares or reuses the dedicated feature worktree
- implementation runs on the feature branch inside that worktree
- machine verification passes
- review-cycle runs when configured
- human verification runs because this is a real CEO-facing surface
- the approved feature-branch commit is handed to merge-queue
- the slice is marked complete only after merge-queue records merge success truthfully

## Commit Rules
- commit only slice-local changes
- push only the feature-branch changes produced by implement-plan
- do not manually merge to main or master
- final completion is allowed only after merge-queue lands the approved commit and implement-plan marks the slice complete truthfully
