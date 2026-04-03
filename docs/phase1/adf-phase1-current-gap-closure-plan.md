# ADF Phase 1 Current Gap Closure Plan

Status: active current gap analysis  
Last updated: 2026-04-03  
Purpose: replace stale next-step thinking with the current implementation gap view aligned to `docs/VISION.md`, `docs/PHASE1_VISION.md`, and `docs/PHASE1_MASTER_PLAN.md`.

## Why This File Exists

The stale part is no longer the Phase 1 mission itself.

The stale part is the old assumption that the next step is still to start from continuity and the onion lane.

That is no longer true.

Those foundations are already materially in place.

This file records what is actually left to close the Phase 1 gap now.

## Source Basis

Primary authority:

- `docs/VISION.md`
- `docs/PHASE1_VISION.md`
- `docs/PHASE1_MASTER_PLAN.md`
- `docs/phase1/adf-phase1-high-level-plan.md`
- `docs/v0/context/phase1-feature-flow-and-executive-briefing-draft.md`

Current implementation reality also considered:

- live COO onion / finalized-requirement lane already integrated
- `implement-plan` now runs worktree-first
- `review-cycle` is part of the governed implementation route
- `merge-queue` now owns approved merge landing and true completion closeout

## Phase 1 Mission Reminder

Phase 1 is not trying to build the full virtual company.

Phase 1 is trying to build a real startup that can:

1. take CEO demand
2. shape it through the COO
3. admit it to development intelligently
4. manage the queue and active work
5. deliver reviewed implementation with durable operational state

## What Is Already Materially Closed

These are no longer the main gap:

### 1. COO continuity foundation

Materially closed enough for Phase 1 progress:

- durable thread/state continuity
- resumed COO route
- governed writes
- telemetry/provenance foundations

### 2. CEO <-> COO onion lane

Materially closed enough for downstream work:

- live onion lane exists behind the explicit feature gate
- explicit freeze exists
- finalized requirement artifact path exists
- real route proof exists

### 3. Minimal governed implementation closeout path

Materially closed enough to stop treating implementation as the main missing unknown:

- `implement-plan` governs feature execution
- worktree-first execution is real
- `review-cycle` is in the route
- `merge-queue` lands approved commits
- feature completion is merge-complete, not just review-complete

## Current Remaining Gaps Against Vision And Master Plan

### Gap A. CEO-facing COO executive briefing is still not live enough

Why it matters:

The COO is supposed to help the CEO understand:

- what needs attention now
- what is on the table
- what is already moving
- what is next

Current reality:

- the onion lane exists
- the implementation lane exists
- but the business-level compression layer for the CEO is still missing or not yet live enough

Required closure:

- executive brief read model
- table summary / current-state compression
- blocked-item visibility
- later startup/status surface wiring

### Gap B. COO -> CTO admission is still the thinnest missing seam

Why it matters:

The master plan says ADF must not only gather requirements; it must also admit work to development intelligently.

Current reality:

- COO can now shape and freeze the requirement meaning
- implementation exists
- but the normalized admission bridge from finalized requirement -> technical admission is still incomplete

Required closure:

- normalized CTO admission packet
- admit / defer / block semantics
- sequencing / dependency hints
- later handoff into the real downstream lane

### Gap C. "What is on our table?" is still underpowered

Why it matters:

The COO must know not only what is active, but also what is shaping, admitted, blocked, waiting, or competing for attention.

Current reality:

- there is partial truth in threads, feature artifacts, and implementation state
- there is not yet a strong company-level table read model that compresses that truth coherently for management use

Required closure:

- table/backlog read model
- admitted vs active vs blocked vs shaping states
- current focus and queue visibility

### Gap D. Parallel implementation safety is still partly manual

Why it matters:

Parallel work is already starting in practice.

Current reality:

- worktrees are now real
- merge closeout is real
- but safe local coordination, scope claims, and overlap blocking are still too manual

Required closure:

- active-runs registry
- scope-lock / overlap guardrails
- clearer same-scope conflict handling

### Gap E. Richer CTO-side preflight is still later, not now

Why it matters:

The fuller feature flow still wants:

- design
n- planning
- setup-analysis
- richer technical queue decisions

Current reality:

- that is still later-company detail for Phase 1
- it should not move ahead of the missing COO briefing + CTO admission seam + table visibility

Required closure:

- defer until the live startup chain is coherent enough end to end

## Current In-Flight Work

These are the right current slices to close the highest-value gaps first:

1. `coo-executive-brief-read-model`
2. `coo-cto-admission-packet-builder`

These directly attack Gap A and Gap B.

## Current Recommended Build Order

### Step 1. Finish and merge the two in-flight slices

Finish and land:

- `coo-executive-brief-read-model`
- `coo-cto-admission-packet-builder`

### Step 2. Wire finalized requirement -> CTO admission handoff

After the packet-builder slice lands, wire the COO freeze/finalized-requirement output into the CTO admission artifact path.

Goal:

- a frozen requirement artifact should be able to move into technical admission without manual reinterpretation

### Step 3. Wire the executive brief into a real COO surface

After the executive-brief slice lands, wire it into the COO-visible startup/status surface.

Goal:

- the CEO can ask what is on our table and get a real compressed answer

### Step 4. Add table / queue state aggregation

Build the minimum company-level state compression that answers:

- shaping
- admitted
- in motion
- blocked
- next

This closes the operational meaning of "what is on our table?"

### Step 5. Add parallel-run safety only as needed

If current live practice still shows collisions or confusion, land:

- active-runs registry
- scope claims
- overlap blocking / manual release

Do this as a small safety slice, not a full scheduler.

### Step 6. Only then expand into richer CTO subphases

After the startup chain is coherent:

- design
- planning
- setup-analysis
- richer priority and dependency handling

## What To Defer

Do not pull these forward yet:

- full virtual company expansion
- non-implementation departments
- deep specialized staffing/worker ecosystems
- heavy queue optimization before real queue visibility exists
- full phase split before the COO/CTO seam is real

## Practical Conclusion

The current Phase 1 bottleneck is no longer "Can ADF do onion requirements?" and it is no longer "Can ADF close a governed implementation route?"

The real current bottleneck is this:

- ADF still needs a stronger business-level COO surface
- ADF still needs a real COO -> CTO admission seam
- ADF still needs a coherent table/queue view

That is the current shortest path for closing the gap between the vision/master plan and the actual working system.

## Stale-File Note

The stale part of `docs/phase1/adf-phase1-high-level-plan.md` is the old "Current Recommended Next Step" wording that still points backward toward continuity/onion-first startup work.

Use this file as the current gap-closure authority until that older next-step wording is updated or archived.
