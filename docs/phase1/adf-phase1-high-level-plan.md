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

1. the `ADF continuity foundation`
2. the requirements-gathering onion lane
3. requirement-list artifact creation
4. a minimal implementation lane
5. finalization
6. postmortem

Then expand the implementation lane into the richer target phases.

Current COO gate:

- the COO runtime now supports the real onion lane behind the explicit feature gate `ADF_ENABLE_REQUIREMENTS_GATHERING_ONION` / `--enable-onion`
- the live route persists thread-owned onion state, explicit freeze approval, governed finalized requirement artifacts, and durable telemetry/audit evidence
- the remaining expansion work is downstream of onion integration, not pre-onion runtime closure

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

1. `ADF continuity foundation`
   - complete the ADF-adapted 12-factor + memory continuity model
   - make discussions, decisions, requirement fragments, open loops, and prompts restorable
   - validate interruption and recovery

2. `CEO <-> COO onion lane`
   - capture and refine feature scope
   - freeze the whole onion with the CEO
   - rely on the continuity foundation so the lane can recover naturally

3. `requirement-list artifact creation`
   - emit a draft requirement list
   - revise it when needed
   - reach a finalized requirement list

4. `requirements review/freeze`
   - accept finalized requirements from COO
   - run requirement-list compliance + review
   - either:
     - freeze to `frozen requirement list`
     - or push back to COO

5. `minimal implementation lane`
   - consume frozen requirements
   - implement the feature through a small governed delivery path
   - keep this lane minimal in the first build

6. `finalization`
   - confirm closeout state
   - verify required outputs and readiness
   - emit finalization artifacts

7. `postmortem`
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

### 1. Build the ADF continuity foundation

Build:

- thread/event continuity
- Brain-backed durable capture and recall
- daily residue
- prompt routing and context recovery
- interruption/resume behavior
- provenance on writes and recoverable state transitions

Important framing:

- this means the ADF-adapted continuity design from `docs/v0/memory_stack_strategy.md`
- it does not mean copying every legacy memory-stack mechanism literally

### 2. Operate the onion lane

Build:

- COO onion workflow
- whole-onion freeze behavior
- live controller routing, persistence, telemetry, and recovery behavior behind the explicit feature gate

Primary source:

- `docs/v0/context/requirements-gathering-onion-model.md`

### 3. Build the first requirement artifact

Build:

- draft requirement-list artifact
- `finalized requirement list` artifact contract
- revise/finalize behavior
- recovery from interruption without loss

### 4. Freeze the first handoff

Build:

- handoff package from COO to feature function

### 5. Build requirements review/freeze

Build:

- frozen requirement-list contract
- pushback path back to COO
- review/fix/freeze behavior for the first feature-function phase

### 6. Build a minimal implementation lane

Build:

- one small governed delivery path from frozen requirements to implemented feature
- do not split it yet into all future sub-phases

### 7. Build finalization and postmortem

Build:

- finalization artifacts
- postmortem artifacts
- route back to COO / next owner

### 8. Add KPI / event capture

Track:

- cycle time
- pushbacks
- review rounds
- fix rounds
- runtime failures
- closeout status
- end-to-end time from finalized requirements to postmortem

### 9. Expand implementation into the fuller target chain

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

- the `ADF continuity foundation`
- then the live `CEO <-> COO` onion lane and its governed requirement artifact flow

The first milestone is complete when:

1. nothing important is lost
2. COO conversation feels natural enough
3. a requirement-list artifact can be created

Then continue into:

- broader downstream consumption of the finalized requirement artifact
- requirement-list finalization
- the smallest downstream chain that can consume the finalized requirements and reach finalization and postmortem
