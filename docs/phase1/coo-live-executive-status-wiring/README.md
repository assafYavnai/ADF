# coo-live-executive-status-wiring

## Target Local Folder
C:/ADF/docs/phase1/coo-live-executive-status-wiring/README.md

## Feature Goal
Turn the standalone `COO/briefing/**` and `COO/table/**` read models into one live CEO-facing COO status surface so the runtime can answer:

- what needs attention
- what is on the table
- what is moving
- what is next

without dumping raw state or requiring the user to understand internal workflow artifacts.

## Why This Slice Exists Now

- `COO/briefing/**` is merged but still not wired into the live COO runtime.
- `COO/table/**` exists as a standalone table package, but it is not yet the live runtime answer.
- Phase 1 still does not have a trustworthy live status surface for leadership use.
- This slice intentionally absorbs the runtime gap between the active `coo-live-executive-status-wiring` and `company-table-queue-read-model` streams so execution can happen in one bounded implementation path.

## Requested Scope
Build the live COO status surface around the merged briefing and table packages.

This slice must:

- create a live source-facts adapter that reads current COO/runtime truth into `BriefSourceFacts`
- consume the merged `COO/table/**` package as the live "On The Table" substrate rather than reimplementing a second queue model
- read at least these source families when present:
  - active COO threads and onion state
  - finalized requirement artifacts
  - CTO-admission artifacts when present
  - implement-plan feature truth when present
- render the 4 briefing sections from live data:
  - Issues That Need Your Attention
  - On The Table
  - In Motion
  - What's Next
- expose the live surface through the COO runtime via startup summary and/or a status command, following existing CLI conventions
- keep the briefing and table layers derived-only
- degrade gracefully when one or more source families are missing instead of failing the whole status surface

## Allowed Edits

- `COO/briefing/**`
- `COO/table/**` only for additive wiring helpers, exports, or KPI alignment needed by the live surface
- `COO/controller/**` where the live status surface must be wired
- `COO/requirements-gathering/**` only for read-shape helpers or additive adapters
- `docs/phase1/coo-live-executive-status-wiring/**`
- tightly scoped tests for the above

## Forbidden Edits

- no implement-plan changes
- no review-cycle changes
- no merge-queue changes
- no queue scheduler buildout
- no second table model or queue model
- no unrelated onion-behavior redesign
- no broad memory-engine redesign
- no edits to other slice folders

## Required Deliverables

- a live `BriefSourceFacts` adapter for the COO runtime
- runtime wiring that consumes the existing `COO/table/**` package instead of duplicating it
- a real startup/status surface that renders the executive brief from live state
- graceful handling of partial and missing source families
- proof tests for the 4-section live rendering path and derived-only behavior
- context.md
- completion-summary.md

## Status Surface Rules

- the output must stay business-level, not a raw state dump
- blocked items must appear in `Issues That Need Your Attention`
- `On The Table` must be driven by the normalized company table, not handwritten controller logic
- `In Motion` must reflect active live work
- `What's Next` must stay concise and forward-looking
- if CTO-admission artifacts are not present yet, the surface must still render shaping and implementation truth cleanly
- missing-source cases must remain visibly different from genuine empty-state cases

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
- the table package remains derived-only
- parity mismatches must be visible and countable
- missing-source cases must remain distinguishable from empty-state cases
- the live status surface must not silently drop blocked or attention-worthy items

## Acceptance Gates

- the COO runtime can render the executive brief from live data
- the runtime uses `COO/table/**` as the live table substrate instead of rebuilding that logic in the controller
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
- validate that the status surface consumes normalized table truth instead of duplicating table logic in the controller

## Human Verification Plan

- Required: true
- Reason: this slice creates a real CEO-facing runtime surface and should be checked for usefulness and readability

## Non-Goals

- no full queue manager
- no CTO-admission generation in this slice
- no downstream implementation orchestration changes
- no adaptive personalization engine beyond what is minimally needed for the live surface
- no duplicate standalone table package

## Scope Claim
This slice owns only:

- `COO/briefing/**`
- additive live-surface wiring over `COO/table/**`
- the minimum controller/runtime wiring needed for a real live status surface
- `docs/phase1/coo-live-executive-status-wiring/**`
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
