# ADF Phase 1 High-Level Plan

Date: 2026-03-31
Status: working high-level implementation plan
Purpose: describe the current recommended implementation order for `ADF-phase1`.

## Name

Call the target system:

- `ADF-phase1`

## Mission

Build a fast, reasonable-quality chain from:

- `CEO <-> COO requirements gathering`

to:

- completed feature delivery with finalization and postmortem

## Immediate Strategy

Do not start from the full target chain.

Start with:

1. the requirements-gathering onion lane
2. a minimal implementation lane
3. finalization
4. postmortem

Then expand the implementation lane into the richer target phases.

## Final Target Chain

The desired final chain remains:

1. Requirements
2. Design
3. Planning
4. Setup-Analysis
5. Implementation
6. Finalization
7. Postmortem

But that is the end-state shape, not the first delivery milestone.

## Phase 1A: Small / Fast Vertical Slice

Recommended first operational slice:

1. `CEO <-> COO onion lane`
   - capture and refine feature scope
   - freeze the whole onion with the CEO
   - emit `finalized requirement list`

2. `requirements review/freeze`
   - accept finalized requirements from COO
   - run requirement-list compliance + review
   - either:
     - freeze to `frozen requirement list`
     - or push back to COO

3. `minimal implementation lane`
   - consume frozen requirements
   - implement the feature through a small governed delivery path
   - keep this lane minimal in the first build

4. `finalization`
   - confirm closeout state
   - verify required outputs and readiness
   - emit finalization artifacts

5. `postmortem`
   - preserve evidence
   - summarize what happened
   - extract lessons
   - route next actions

This proves the chain works end to end before Phase 1 expands.

## Phase 1B: Expand The Implementation Lane

After Phase 1A works, split the implementation lane into:

1. Design
2. Planning
3. Setup-Analysis
4. Implementation

That produces the fuller target chain without requiring the first milestone to solve every phase up front.

## Recommended Build Order

### 1. Freeze the onion lane

Build:

- COO onion workflow
- finalized requirement-list artifact
- whole-onion freeze behavior

Primary source:

- `docs/v0/context/requirements-gathering-onion-model.md`

### 2. Freeze the first handoff

Build:

- `finalized requirement list` artifact contract
- handoff package from COO to feature function

### 3. Build requirements review/freeze

Build:

- frozen requirement-list contract
- pushback path back to COO
- review/fix/freeze behavior for the first feature-function phase

### 4. Build a minimal implementation lane

Build:

- one small governed delivery path from frozen requirements to implemented feature
- do not split it yet into all future sub-phases

### 5. Build finalization and postmortem

Build:

- finalization artifacts
- postmortem artifacts
- route back to COO / next owner

### 6. Add KPI / event capture

Track:

- cycle time
- pushbacks
- review rounds
- fix rounds
- runtime failures
- closeout status
- end-to-end time from finalized requirements to postmortem

### 7. Expand implementation into the fuller target chain

Only after the vertical slice works:

- split the implementation lane into design / planning / setup-analysis / implementation

## Shared Components To Design Early

These should be designed with reuse in mind even if not fully built on day 1:

- lifecycle engine
- generic phase runner
- deterministic validator runner
- shared review runtime
- shared fix / self-heal runtime
- KPI / event schema
- evidence / provenance store
- gate / handoff generator

## Review / Learning / Healing Guidance

Current working direction:

- review should exist at every meaningful phase, but the exact review policy may differ by phase
- learning should become structured and preferably background by default once the chain works
- self-healing should be bounded and technical, not a substitute for missing business decisions

These are design directions, not yet frozen detailed contracts.

## What Not To Do First

Do not start by:

- building the full final chain in one shot
- over-specializing per-phase modules
- perfecting heavy review systems before the chain works
- letting bootstrap concerns delay the first end-to-end path

## File Pointers

Main source docs:

- `docs/PHASE1_MASTER_PLAN.md`
- `docs/v0/context/phase1-feature-flow-and-executive-briefing-draft.md`
- `docs/v0/context/requirements-gathering-onion-model.md`

Discussion recovery:

- `docs/phase1/adf-phase1-discussion-record.md`

## Current Recommended Next Step

Start implementation design from:

- the `CEO <-> COO` onion lane

Then immediately design the smallest downstream chain that can consume the finalized requirements and reach:

- finalization
- postmortem

That is the highest-value Phase 1 starting point.
