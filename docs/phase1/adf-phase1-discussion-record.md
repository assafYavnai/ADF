# ADF Phase 1 Discussion Record

Date: 2026-03-31
Status: working discussion record for context recovery
Purpose: capture the current Phase 1 direction discussed with the user, including what should be treated as working direction versus informative but non-binding viewpoints.

## What Phase 1 Is Trying To Do

The immediate goal is:

- build a fast, reasonable-quality full chain from `CEO <-> COO` requirements shaping to completed feature delivery
- preserve enough governance, evidence, and review to keep quality acceptable
- avoid turning every phase into an expensive, heavyweight precondition

This is a simplification from the more module-heavy direction that had started to emerge.

## Two Main Lanes

The current working model is:

1. `requirements gathering`
   - `CEO <-> COO`
   - human-facing onion model
   - ends with the `finalized requirement list`

2. `implementation lane`
   - starts from the `finalized requirement list`
   - ends with completed feature delivery, finalization, and postmortem

Important boundary:

- requirements gathering remains a COO-owned pre-function activity
- the feature function begins only after the finalized requirement-list handoff

This stays aligned with:

- `docs/PHASE1_MASTER_PLAN.md`
- `docs/v0/context/phase1-feature-flow-and-executive-briefing-draft.md`

## Desired Final Target Chain

The final target chain is:

1. Requirements
2. Design
3. Planning
4. Setup-Analysis
5. Implementation
6. Finalization
7. Postmortem

Each phase is expected to use review/fix and freeze/handoff discipline.

However, that full target chain is the destination, not the first implementation milestone.

## Small / Fast Start Principle

The current agreed direction is to start small, simple, and fast.

That means:

- do not implement the full final target chain all at once
- do not over-optimize specialized modules before the basic chain works
- bootstrap deferrals are acceptable if they preserve the path to a working chain

The first milestone should prove:

- requirements can be shaped and frozen
- the implementation lane can consume frozen requirements
- the chain can reach finalization and postmortem

## Why The Earlier Direction Looked Wrong

Recent sandbox experiments showed that heavy rules-imposition/review layers can become too expensive as a universal default.

The current interpretation is:

- strong review still matters
- but a universally heavy rules gate before every small change is probably the wrong default architecture
- Phase 1 should focus first on making the chain work
- improvement can come after live KPI evidence exists

Supporting evidence:

- `docs/v0/context/2026-03-31-grouped-shrinking-readiness-live-001.md`
- `docs/v0/context/2026-03-31-grouped-shrinking-safety-layer-live-001.md`

These docs are evidence about review-cost tradeoffs, not the primary Phase 1 design contract.

## First-Principles Direction

The strongest current design principles are:

- artifacts, not freeform conversation state, should move through the feature function
- deterministic scripts should own:
  - gating
  - validation
  - persistence
  - routing
  - retry budgets
  - runtime recovery
- agents should own:
  - reasoning
  - artifact drafting
  - revision
  - analysis
  - postmortem interpretation
- learning should become structured and preferably background by default
- self-healing should be bounded to technical/runtime recovery, not business guessing
- CEO-facing executive reporting should be derived from machine state, not become the machine state

## Non-Binding But Useful Viewpoint

One useful non-binding viewpoint from the recent discussion:

- do not start by building seven separate workflows
- build one lifecycle engine, one generic phase runner, one shared review system, and one shared learning/fix system
- then express requirements, design, planning, setup-analysis, implementation, finalization, and postmortem as phase configurations

This was treated as an informative perspective, not as a frozen requirement.

Current disposition:

- directionally useful
- not yet frozen as implementation detail

## Shared Components Already Visible

The shared pieces that appear reusable even now are:

- lifecycle engine
- generic phase runner
- gate generator
- handoff generator
- deterministic validator runner
- shared review runtime
- shared fix / self-heal runtime
- learning event schema / processor
- KPI / event schema
- evidence / provenance store
- workspace / execution governance

## What Is Frozen Enough Right Now

The following points are strong enough to use for ongoing design:

- Phase 1 starts from the finalized requirement-list handoff
- requirements gathering is owned by the COO and uses the onion model
- the final target chain includes:
  - requirements
  - design
  - planning
  - setup-analysis
  - implementation
  - finalization
  - postmortem
- the first implementation should be smaller than the final target chain
- the initial goal is a fast, reasonable-quality end-to-end chain, not perfect specialized modules

## What Is Still Open

Still open:

- exact phase contracts
- exact review policy by phase
- exact learning promotion path
- exact self-heal policy
- exact generic phase-runner interface
- how much of the target chain should be split in the first shippable milestone

## Recommended Next Reading

After this file, read:

- [adf-phase1-high-level-plan.md](./adf-phase1-high-level-plan.md)

That file captures the current recommended build order.
