# ADF v2 Reset Control Pack

Status: active control pack for the approved v2 reset
Audience: new agents, new sessions, handoff readers, CEO/CTO planning work

## Purpose

This folder exists to stop drift during the v2 restart.

It is the canonical pack for:
- the approved reset proposal
- current repo reality
- frozen reset decisions
- active work order
- handoff and resume context
- progress/update discipline

## What this pack is for

This pack is **not** the implementation itself.
It is the control surface that keeps implementation, cleanup, migration, and planning aligned.

## Current governing direction

The active direction is:
- v2 is a clean restart
- v1/legacy code is reference-only unless explicitly carried over
- active high-level startup ontology is **CEO / CTO / DEV**
- Brain/MCP is a likely carry-over substrate
- LangGraph is a probable carry-over candidate
- top truth must be rewritten before destructive cleanup begins

## Read order

1. `STATE.md`
2. `DECISIONS.md`
3. `WORKORDER.md`
4. `OPEN-ITEMS.md`
5. `CURRENT-STATE.md`
6. `RESET-PROPOSAL.md`
7. `PROGRESS-RULES.md`
8. `HANDOFF.md`
9. `NEXT-STEP-HANDOFF.md`

## File map

- `MISSION-STATEMENT.md` — thin executive charter for v2 reset truth
- `VISION.md` — broader direction and long-range intent
- `PHASE1.md` — current startup phase definition for v2
- `RESET-PROPOSAL.md` — proposal, rationale, context, and approved reset path
- `CARRY-OVER-CLASSIFICATION.md` — migration ledger for legacy/v1 surfaces
- `WORKORDER.md` — active 4-step reset work order
- `STATE.md` — current operational truth
- `OPEN-ITEMS.md` — unresolved questions only
- `DECISIONS.md` — append-only frozen decisions
- `CURRENT-STATE.md` — factual repo/program snapshot
- `OVERVIEW.md` — quick orientation for new readers
- `PROGRESS-RULES.md` — commit/update/handoff discipline
- `HANDOFF.md` — broader narrative bridge
- `NEXT-STEP-HANDOFF.md` — exact next-task baton pass

## Legacy boundary

Nothing outside this pack should be treated as active v2 truth unless:
- it is explicitly referenced here, or
- a frozen decision in `DECISIONS.md` says otherwise.
