# ADF v2 Reset — Handoff

Status: active narrative bridge for the next session
Audience: next agent / architect / CEO review session

## What happened

A reset-first direction was approved.

Key shift:
- the active reset control pack should live under `adf-v2/reset/`
- the older `adf-v2/00-mission-foundation/` area is now treated as historical context from an earlier v2 attempt, not the active reset pack

## What is now frozen

- v2 is a clean restart
- v1/legacy is reference-only unless explicitly carried over
- active startup ontology is CEO / CTO / DEV
- current CTO code on branch is exploratory, not canonical `main` truth
- Brain/MCP is a likely carry-over substrate
- LangGraph is a probable carry-over candidate
- reset ordering is: top truth -> carry-over classification -> legacy isolation -> active-tree reset

## What was created in repo truth

The following reset control surfaces now exist:
- `adf-v2/README.md`
- `adf-v2/reset/README.md`
- `adf-v2/reset/DECISIONS.md`
- `adf-v2/reset/WORKORDER.md`
- `adf-v2/reset/RESET-PROPOSAL.md`
- `adf-v2/reset/OVERVIEW.md`
- `adf-v2/reset/CURRENT-STATE.md`
- `adf-v2/reset/STATE.md`
- `adf-v2/reset/OPEN-ITEMS.md`
- `adf-v2/reset/PROGRESS-RULES.md`

## What has not been done yet

- top truth files are not yet rewritten
- carry-over classification is not yet frozen
- AGENTS routing is not yet patched
- no archive/delete/reset-run work has started

## What the next session should do

1. decide whether to migrate top-truth files directly or refactor first
2. write the first real versions of:
   - `MISSION-STATEMENT.md`
   - `VISION.md`
   - `PHASE1.md`
3. then scaffold `CARRY-OVER-CLASSIFICATION.md`
4. only after that consider AGENTS wiring and legacy-isolation work

## Important warning

Do not let the existence of older runtime/tooling/docs on `main` override the reset truth now captured here.
Those surfaces remain legacy/reference unless later classified otherwise.
