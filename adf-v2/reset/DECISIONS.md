# ADF v2 Reset - Decision Log

Status: active append-only log for frozen reset decisions
Purpose: preserve durable decisions inside the repo so new agents and sessions do not reconstruct them from chat memory

---

## D-001 - Reset control pack location

Frozen decision:
- the reset control pack lives under `adf-v2/reset/`

Why:
- the scope is larger than a narrow mission-foundation pack
- repo root still mixes legacy/v1 and older v2 attempts
- `adf-v2/reset/` makes the active restart boundary explicit
- it avoids accidental reuse of legacy truth during the reset

Rejected alternatives:
- keep the active pack under `adf-v2/00-mission-foundation/`
- move the active pack directly to repo root during reset

Implication:
- `adf-v2/reset/` is the canonical restart control surface during the reset
- `adf-v2/00-mission-foundation/` remains historical context from an earlier v2 attempt unless re-adopted later

---

## D-002 - v2 reset framing

Frozen decision:
- v2 is a clean restart
- legacy/v1 code is reference-only unless explicitly carried over

Why:
- the repo currently contains accumulated architecture drift, partial experiments, and older truth surfaces
- the reset must start from explicit v2 truth, not inferred inheritance from existing code or docs

Implication:
- existing repo code and docs are not automatically canonical for v2
- every carry-over must be classified deliberately

---

## D-003 - Active startup ontology for v2

Frozen decision:
- active high-level startup ontology is CEO / CTO / DEV

Why:
- that is the approved top-level model for the restart
- broader company abstractions are premature for the current phase

Implication:
- v2 top truth must be written around CEO / CTO / DEV
- older COO-centered framing on `main` must not be treated as active v2 truth by default

---

## D-004 - Current CTO status

Frozen decision:
- current CTO code is exploratory branch work, not canonical `main` truth

Why:
- the reset must distinguish branch experimentation from mainline truth

Implication:
- documentation must state this explicitly
- agents must not infer that current runtime or tooling surfaces on `main` represent approved CTO architecture

---

## D-005 - Likely and probable carry-over

Frozen decision:
- MCP Brain is a likely carry-over substrate
- LangGraph is a probable carry-over candidate
- other legacy surfaces remain undecided unless classified explicitly

Why:
- some substrate work may survive the reset as-is or close to as-is
- the reset should preserve useful infrastructure without inheriting whole legacy architecture blindly

Implication:
- a carry-over classification ledger is required before archive or delete work begins

---

## D-006 - Reset sequencing

Frozen decision:
- the reset proceeds in this order:
  1. rewrite top truth
  2. classify carry-over from legacy/v1
  3. isolate or archive legacy from active truth
  4. run active-tree reset and cleanup

Why:
- destructive cleanup before top-truth freeze would recreate drift and ambiguity

Implication:
- no archive, delete, or reset run should begin before top truth and carry-over classification exist in repo truth

---

## D-007 - Repo-resident context requirement

Frozen decision:
- the reset must be carried by repo-resident context, not only by chat history

Why:
- new sessions and new agents must be able to resume accurately without reconstructing intent from memory

Implication:
- `STATE.md`, `OPEN-ITEMS.md`, `DECISIONS.md`, `HANDOFF.md`, and `NEXT-STEP-HANDOFF.md` are required reset control files
- frozen decisions live here, not only in conversation history

---

## D-008 - AGENTS routing target

Frozen decision:
- `AGENTS.md` must route agents to the reset control pack first

Why:
- the bootstrap surface must force new agents to consume active v2 reset truth before reading older repo surfaces

Implication:
- AGENTS routing is part of the reset work
- older visible repo surfaces must not be assumed to be active v2 truth by default

---

## D-009 - Step 1 migration method

Frozen decision:
- migrate top truth directly into the reset pack first
- do that as reset-native rewrites, not verbatim carry-over
- refine those reset-native files in place after they become the active source of truth

Why:
- Step 1 was blocked because the reset pack existed but the top-truth files were only scaffolds
- the older documents contain useful intent, but they also carry conflicting ontology and legacy framing
- direct-first rewrite stops drift faster than refactoring old documents before migration

Rejected alternatives:
- refactor legacy or older v2 files first and only migrate later
- wait for full carry-over classification before writing top truth

Implication:
- old docs are source material only
- `adf-v2/reset/MISSION-STATEMENT.md`, `VISION.md`, and `PHASE1.md` become the active top truth now
- refinement continues inside the reset pack instead of in legacy files

---

## D-010 - Infrastructure placement in top truth

Frozen decision:
- Brain/MCP, LangGraph, scripts, memory, and similar infrastructure are support substrate, not the top-level business ontology

Why:
- the startup ontology must stay CEO / CTO / DEV
- infrastructure may carry over, but it should not redefine what the startup is
- this prevents older scripts, agents, and durable-state framing from silently reasserting itself as top truth

Rejected alternatives:
- treat scripts, agents, or durable state as co-equal top-level ontology
- omit infrastructure entirely from the top truth

Implication:
- top-truth docs may mention infrastructure as enabling support
- carry-over classification can evaluate infrastructure without promoting it to the startup's public identity

---

## D-011 - AGENTS patch timing

Frozen decision:
- patch `AGENTS.md` immediately after Step 1 top truth is written

Why:
- routing drift was still possible while `AGENTS.md` pointed new agents only at the old bootstrap path
- the router fix is non-destructive and reduces the chance of legacy interpretation during Step 2
- waiting for later isolation work would keep the reset pack dependent on human memory

Rejected alternative:
- wait for full Step 3 legacy-isolation work before patching AGENTS

Implication:
- AGENTS routing is a protective reset entrypoint patch, not evidence that broader legacy isolation is already complete
