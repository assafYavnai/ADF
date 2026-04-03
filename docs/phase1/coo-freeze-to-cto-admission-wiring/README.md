# coo-freeze-to-cto-admission-wiring

## Target Local Folder
C:/ADF/docs/phase1/coo-freeze-to-cto-admission-wiring/README.md

## Feature Goal
Wire the live COO finalized-requirement freeze path into the existing `COO/cto-admission/**` package so the COO can produce a real persisted CTO-admission handoff artifact without manual reinterpretation.

## Why This Slice Exists Now
- The standalone CTO-admission packet builder is merged, but it is still not wired into the live freeze path.
- The COO can already shape and freeze requirements, but the next seam into technical admission is still manual.
- The status/executive surface will need this admission truth in order to answer "what is on our table?" honestly.

## Requested Scope
Build the live handoff seam from finalized requirement freeze into CTO-admission artifacts.

This slice must:
- consume the real finalized requirement artifact produced by the live COO onion/freeze path
- invoke the existing CTO-admission packet builder with live source data
- persist the generated artifacts under the deterministic feature root:
  - `docs/phase1/feature-slug/cto-admission-request.json`
  - `docs/phase1/feature-slug/cto-admission-decision.template.json`
  - `docs/phase1/feature-slug/cto-admission-summary.md`
- persist artifact paths and admission lifecycle facts into durable COO-owned state
- make admission-build failures visible and non-silent
- distinguish clearly between:
  - packet built successfully
  - admission still pending decision
  - admitted
  - deferred
  - blocked
  - build failed

Important truth rule:
- `packet builder outcome=admitted` is not enough to mean final CTO admission is complete unless the persisted decision state is explicit.
- if the generated decision template still has `decision=null`, the live state must be `admission_pending_decision`, not `admitted`.

## Allowed Edits
- COO/cto-admission/**
- COO/requirements-gathering/live/**
- COO/requirements-gathering/contracts/**
- COO/controller/** only where the live freeze path must call the admission seam
- docs/phase1/coo-freeze-to-cto-admission-wiring/**
- tightly scoped tests for the above

## Forbidden Edits
- no implement-plan changes
- no review-cycle changes
- no merge-queue changes
- no unrelated COO classifier redesign
- no broad Brain redesign
- no queue engine or scheduler buildout
- no edits to other slice folders

## Required Deliverables
- a live finalized-requirement to CTO-admission adapter/wiring path
- deterministic admission artifact persistence under the feature root
- explicit persisted admission status model
- a minimal decision-update path for setting explicit `admit`, `defer`, or `block`
- proof tests for build-failed, pending-decision, blocked, deferred, and admitted paths
- context.md
- completion-summary.md

## Recommended State Vocabulary
Use explicit persisted values instead of vague status text:
- `admission_not_started`
- `admission_build_failed`
- `admission_pending_decision`
- `admission_admitted`
- `admission_deferred`
- `admission_blocked`

If the repo already has a close-enough vocabulary, extend conservatively instead of creating a parallel state model.

## Production KPI / Audit Matrix Requirements
Define explicit KPIs for this slice:
- `finalized_requirement_to_admission_latency_ms` with p50, p95, p99
- slow handoff buckets over 1s, 10s, and 60s
- `finalized_requirement_handoff_count`
- `admission_artifact_build_success_count`
- `admission_artifact_build_failed_count`
- `admission_pending_decision_count`
- `admission_admitted_count`
- `admission_deferred_count`
- `admission_blocked_count`
- `admission_artifact_persist_failure_count`
- `requirement_to_admission_artifact_parity_count`
- `admission_status_write_completeness_rate`
- partition/isolation proof when production and proof inputs coexist

## Acceptance Gates
- the live freeze path invokes the admission builder without manual data rewriting
- the three admission artifacts are written under the deterministic feature root
- persisted state records artifact paths and explicit admission status truthfully
- `decision=null` is surfaced as `admission_pending_decision`, not as admitted
- build failures create visible evidence and do not silently disappear
- tests prove build-failed, pending-decision, blocked, deferred, and admitted paths

## Machine Verification Plan
- run targeted tests for the new live wiring path and CTO-admission integration
- validate generated JSON artifacts parse cleanly
- validate artifact-path persistence under the correct feature root
- validate state transitions for all admission outcomes

## Human Verification Plan
- Required: false
- Reason: this slice creates a live technical handoff seam, not a new human-facing UI surface

## Non-Goals
- no full CTO queue manager
- no automatic downstream implement-plan spawn
- no technical priority engine
- no full design/planning/setup-analysis subphase buildout
- no CEO-facing status surface in this slice

## Scope Claim
This slice owns only:
- COO/cto-admission/**
- the minimum live freeze-path wiring needed to call it
- docs/phase1/coo-freeze-to-cto-admission-wiring/**
- tightly scoped tests for the same path

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
