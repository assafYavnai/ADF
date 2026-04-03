# company-table-queue-read-model

## Target Local Folder
C:/ADF/docs/phase1/company-table-queue-read-model/README.md

## Feature Goal
Build a standalone company-level table and queue read model that aggregates Phase 1 work into a coherent management view without wiring it into the live COO runtime yet.

## Why This Slice Exists Now
- Phase 1 still needs a truthful answer to "what is on our table?"
- The live COO executive/status wiring slice will need a stable table model to consume.
- This slice is safe to run in parallel because it stays standalone and read-only over existing truth sources.

## Requested Scope
Create a standalone package, recommended under `COO/table/**`, that derives a normalized company table view from existing truth sources.

This slice must:
- define a stable read-model contract for company table entries
- read from current truth sources when present, including:
  - COO thread/onion state snapshots
  - finalized requirement artifacts
  - CTO-admission artifacts when present
  - implement-plan feature state/index truth when present
- normalize all discovered work into explicit table states
- render a compact management view over the normalized table
- stay standalone and unwired to CLI/controller/runtime surfaces
- degrade gracefully when one or more source families are absent

## Required Normalized States
At minimum support these normalized states:
- `shaping`
- `admission_pending`
- `admitted`
- `in_motion`
- `blocked`
- `next`
- `completed_recently`

If the source truth is ambiguous, preserve that ambiguity explicitly instead of guessing.

## Allowed Edits
- COO/table/**
- docs/phase1/company-table-queue-read-model/**
- tightly scoped tests for COO/table/**
- additive read-only helpers if absolutely needed

## Forbidden Edits
- no COO/controller/**
- no COO/briefing/**
- no COO/cto-admission/**
- no implement-plan changes
- no review-cycle changes
- no merge-queue changes
- no runtime wiring in this slice
- no edits to other slice folders

## Required Deliverables
- typed company table read-model package under `COO/table/**`
- source-adapter layer for existing truth sources
- a normalizer that maps raw truth into the required normalized states
- a compact renderer or summary output for management use
- fixtures and proof tests
- context.md
- completion-summary.md

## Truth Rules
- this slice is derived-only
- it must not mutate source truth
- it must not invent queue/admission certainty that is not present in the raw evidence
- missing-source cases must stay distinguishable from true empty-state cases
- if multiple sources disagree, the output must surface an explicit ambiguity marker or conflict note

## Production KPI / Audit Matrix Requirements
Define explicit KPIs for this slice:
- `table_build_latency_ms` with p50, p95, p99
- slow table-build buckets over 1s, 10s, and 60s
- `table_build_success_count`
- `table_build_failure_count`
- `table_missing_source_count`
- `table_ambiguous_state_count`
- `table_blocked_item_count`
- `table_admission_pending_count`
- `table_in_motion_count`
- `table_completed_recently_count`
- `table_source_freshness_age_ms`
- `table_source_parity_count`
- partition/isolation proof when production and proof inputs coexist

Audit rules:
- parity must be provable between raw source families and normalized table entries
- ambiguity/conflict cases must be countable, not silently flattened
- blocked work must remain visible
- recent completion must stay distinguishable from active motion

## Acceptance Gates
- the read model can build from partial and full source sets
- the required normalized states are supported explicitly
- blocked work surfaces correctly
- ambiguous source cases do not silently resolve themselves
- the package stays standalone and unwired
- proof tests cover mixed-source scenarios, empty-state scenarios, and conflict scenarios

## Machine Verification Plan
- run targeted tests for `COO/table/**`
- validate deterministic rendering/normalization
- validate missing-source handling
- validate ambiguity/conflict handling
- validate KPI counters and freshness metrics

## Human Verification Plan
- Required: false
- Reason: this slice is a standalone artifact package, not a live CEO-facing runtime surface yet

## Non-Goals
- no live COO status command
- no startup summary wiring
- no queue scheduler
- no automatic admission generation
- no downstream execution orchestration changes

## Scope Claim
This slice owns only:
- COO/table/**
- docs/phase1/company-table-queue-read-model/**
- tightly scoped tests for the same package

## Status Update Requirement
During implementation, keep project status fresh:
- update `docs/phase1/company-table-queue-read-model/context.md` when a meaningful design decision is made
- keep `completion-summary.md` truthful and current at closeout
- if your runtime has the normal ADF Brain write path available and approved for project-status notes, write one short status note scoped to this slice; if not, do not fake it and rely on docs plus implement-plan state instead
- do not leave stale placeholder text that claims pending merge/review after those steps are actually finished

## Execution Route Update
This slice must run through the full governed path:
- implement-plan prepares or reuses the dedicated feature worktree
- implementation runs on the feature branch inside that worktree
- machine verification passes
- review-cycle runs when configured
- human verification runs only if truly required later
- the approved feature-branch commit is handed to merge-queue
- the slice is marked complete only after merge-queue records merge success truthfully

## Commit Rules
- commit only slice-local changes
- push only the feature-branch changes produced by implement-plan
- do not manually merge to main or master
- final completion is allowed only after merge-queue lands the approved commit and implement-plan marks the slice complete truthfully
