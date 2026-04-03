# coo-executive-brief-read-model

## Target Local Folder
C:/ADF/docs/phase1/coo-executive-brief-read-model/README.md

## Feature Goal
Build the first bounded CEO-facing executive brief read model as a pure derived layer, without wiring it into the active COO runtime yet.

## Why This Slice Exists Now
- The CEO-facing executive brief is still missing.
- The active coo-kpi-instrumentation stream owns shared COO route files, so this slice must avoid those files.
- A pure read-model plus fixture proof can be built now and wired later.

## Requested Scope
Create a standalone read-model package that derives a focused executive brief with exactly these sections:
- Issues That Need Your Attention
- On The Table
- In Motion
- What's Next

The slice should:
- read existing saved feature/thread/open-loop shapes as inputs
- define the minimum source facts needed for the brief
- produce a stable derived brief object plus a compact renderer
- include fixtures for:
  - normal in-flight work
  - blocked feature needing CEO attention
  - empty / low-activity state
  - post-completion closeout view
- stay unwired to CLI and controller while the KPI lane is active

## Allowed Edits
- COO/briefing/**
- tests focused on COO/briefing/**
- docs/phase1/coo-executive-brief-read-model/**

## Forbidden Edits
- no COO/controller/cli.ts
- no COO/controller/loop.ts
- no COO/requirements-gathering/live/onion-live.ts
- no shared/telemetry/**
- no components/memory-engine/**
- no queue engine
- no status command work
- no runtime wiring in this slice
- no edits to other slice folders

## Required Deliverables
- a typed executive-brief read model under COO/briefing/**
- a renderer that outputs the 4-section brief from the derived model
- fixture inputs and proof tests
- a short integration note describing how this later wires into COO
- context.md
- completion-summary.md

## Production KPI / Audit Matrix Requirements
Define explicit KPIs for this slice, with authoritative source facts and parity rules:
- exec_brief_build_latency_ms with p50, p95, p99
- slow brief-build buckets over 1s, 10s, and 60s
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
- source truth remains authoritative; the executive brief is a derived read model only
- KPI claims for the brief must be auditable from source facts and derived output
- blocked items must become visible in Issues so leadership is not shown a falsely calm brief
- preserve production/proof isolation semantics for later runtime wiring

## Acceptance Gates
- the read model is derived only from existing truth inputs; it does not become a second source of truth
- the 4 sections always exist in output order
- blocked items are surfaced concretely and do not disappear into generic status text
- the forward-looking frame stays capped and concise
- the output stays business-level rather than an internal state dump
- fixtures prove all required sections and branches
- fixture proof demonstrates how parity mismatches would be detected for each of the 4 sections

## Machine Verification Plan
- run targeted tests for COO/briefing/**
- validate all fixture cases render deterministically
- typecheck any new TypeScript files touched by the slice

## Human Verification Plan
- Required: false
- Reason: this slice intentionally stops before runtime wiring and human-facing CLI exposure

## Non-Goals
- no CLI command
- no startup summary wiring
- no memory-engine persistence changes
- no adaptive personalization logic yet
- no queue or CTO state model

## Scope Claim
This slice owns only:
- COO/briefing/**
- docs/phase1/coo-executive-brief-read-model/**
- tightly scoped tests for the same package

## Execution Route Update
This slice must run through the full governed path:
- implement-plan prepares or reuses the dedicated feature worktree
- implementation runs on the feature branch inside that worktree
- machine verification passes
- review-cycle runs when configured
- human verification runs only if truly required later
- the approved feature-branch commit is handed to merge-queue
- the slice is marked complete only after merge-queue records merge success truthfully

Additional closeout rules:
- do not stop at review-ready or merge-ready
- do not merge directly to main/master from the feature branch
- completion-summary.md must report merge status and local target sync status truthfully
- fixture/test evidence used for approval must remain tied to the feature-branch snapshot reviewed by review-cycle

## Commit Rules
- commit only slice-local changes
- push only the feature-branch changes produced by implement-plan
- do not manually merge to main/master
- final completion is allowed only after merge-queue lands the approved commit and implement-plan marks the slice complete truthfully
