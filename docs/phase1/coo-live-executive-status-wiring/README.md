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
