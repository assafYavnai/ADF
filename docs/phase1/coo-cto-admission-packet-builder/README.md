# coo-cto-admission-packet-builder

## Target Local Folder
C:/ADF/docs/phase1/coo-cto-admission-packet-builder/README.md

## Feature Goal
Build the first bounded COO -> CTO admission packet builder as an ad-hoc bridge that converts a finalized requirement artifact into a normalized CTO admission request without wiring it into the live COO route yet.

## Why This Slice Exists Now
- The COO -> CTO seam is the biggest missing layer.
- We can build the packet builder now without touching active COO route files.
- This gives a manual but governed bridge into later implement-plan runs.

## Requested Scope
Create a standalone packet-builder package that:
- reads a finalized requirement artifact from a feature folder
- validates the minimum inputs required by the shared contract pack
- writes:
  - cto-admission-request.json
  - cto-admission-decision.template.json
  - cto-admission-summary.md
- includes explicit fields for:
  - feature slug
  - requirement artifact source
  - business priority
  - claimed scope paths
  - non-goals / boundaries
  - sequencing hint
  - dependency/conflict notes
  - suggested execution mode: sequential / safe-parallel / dependency-blocked
- stays manual in this slice; no auto-queueing and no runtime handoff into implement-plan yet

## Allowed Edits
- COO/cto-admission/**
- tests focused on COO/cto-admission/**
- docs/phase1/coo-cto-admission-packet-builder/**

## Forbidden Edits
- no COO/controller/cli.ts
- no COO/controller/loop.ts
- no COO/requirements-gathering/live/onion-live.ts
- no implement-plan changes
- no queue engine
- no automatic wiring into the live freeze path
- no changes to active KPI-owned surfaces
- no edits to other slice folders

## Required Deliverables
- packet-builder code under COO/cto-admission/**
- request / decision / summary artifact generation
- fixture tests proving happy-path, blocked, and missing-input behavior
- context.md
- completion-summary.md

## Production KPI / Audit Matrix Requirements
Define explicit KPIs for this slice, with authoritative source artifacts and parity rules:
- admission_packet_build_latency_ms with p50, p95, p99
- slow packet-build buckets over 1s, 10s, and 60s
- admission_packets_built_count
- admission_packets_admitted_count
- admission_packets_deferred_count
- admission_packets_blocked_count
- missing_required_input_count
- dependency_blocked_count
- scope_conflict_detected_count
- admission_source_metadata_completeness_rate
- requirement_to_packet_parity_count
- partition/isolation proof when production and proof inputs coexist

Audit rules:
- the finalized requirement artifact remains the authoritative source; the admission packet is a derived governed handoff artifact
- KPI claims for admission must be auditable from the finalized requirement input plus the generated packet and decision artifacts
- make it obvious whether a packet was not built because inputs were missing versus because it was built and later blocked/deferred
- preserve raw-vs-derived parity semantics and production/proof isolation where relevant

## Acceptance Gates
- the packet builder fails clearly when required finalized-input fields are missing
- the request packet matches the shared contract pack field names exactly
- the decision template makes admit / defer / block explicit
- the output is bounded and does not invent technical facts not present in the input set
- the package can be used manually from a worktree without extra COO runtime wiring
- fixture proof covers admitted, deferred, blocked, and malformed-input paths
- fixture proof demonstrates how missing required input, conflict detection, and dependency-blocked outcomes are counted and audited

## Machine Verification Plan
- run targeted tests for COO/cto-admission/**
- validate generated JSON files parse cleanly
- validate fixture cases for admitted, deferred, blocked, and malformed-input paths

## Human Verification Plan
- Required: false
- Reason: this slice creates a manual technical bridge artifact, not a new human-facing route

## Non-Goals
- no live freeze-path integration
- no queue ownership engine
- no priority arbitration engine
- no auto-spawn into implement-plan
- no review-cycle redesign

## Scope Claim
This slice owns only:
- COO/cto-admission/**
- docs/phase1/coo-cto-admission-packet-builder/**
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
- generated admission artifacts must match the approved feature-branch snapshot that is ultimately merged

## Commit Rules
- commit only slice-local changes
- push only the feature-branch changes produced by implement-plan
- do not manually merge to main/master
- final completion is allowed only after merge-queue lands the approved commit and implement-plan marks the slice complete truthfully
