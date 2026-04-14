# ADF v2 Phase 1

Status: first-pass phase definition
Last updated: 2026-04-14
Purpose: define what Phase 1 means during the v2 reset and restart

## What Phase 1 is

Phase 1 is the reset-and-restart foundation for ADF v2.
It creates the minimum trustworthy startup frame so later implementation and cleanup happen under explicit repo truth instead of inherited drift.

This phase treats CEO / CTO / DEV as the active startup ontology and works outward from that frame to decide what legacy surfaces carry over, what stays reference-only, and what can be cleaned up later.

## What is included now

- real top-truth documents for mission, vision, and Phase 1
- frozen reset decisions and aligned state/handoff surfaces
- carry-over classification for major legacy and v1 surfaces
- reset-first routing for new agents and sessions
- the minimum architectural framing needed to decide what cleanup may happen next

## What is explicitly deferred

- destructive cleanup, archive, or delete work
- broad implementation of the future runtime
- full architecture specs for every internal surface
- wider company layers beyond CEO / CTO / DEV
- automatic promotion of branch work or legacy tooling into canonical v2 truth

## What done enough means for this phase

Phase 1 is done enough when:
- the reset pack is the clear source of truth
- the top-truth docs are coherent enough to guide the repo
- major carry-over surfaces have a classification, reason, and action
- new agents no longer default into legacy interpretation
- cleanup planning can begin without reopening the basic v2 framing

## What must exist before cleanup moves forward

Before Step 3 or Step 4 work begins, the repo must have:
- an internally consistent `MISSION-STATEMENT.md`, `VISION.md`, and `PHASE1.md`
- a substantive `CARRY-OVER-CLASSIFICATION.md` covering the main legacy surfaces
- updated routing that sends agents to reset truth first
- aligned `DECISIONS.md`, `STATE.md`, `OPEN-ITEMS.md`, `HANDOFF.md`, and `NEXT-STEP-HANDOFF.md`
- a frozen decision basis for any archive or delete action
