# ADF v2 Reset — Decision Log

Status: active append-only log for frozen reset decisions
Purpose: preserve durable decisions inside the repo so new agents/sessions do not reconstruct them from chat memory

---

## D-001 — Reset control pack location

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

## D-002 — v2 reset framing

Frozen decision:
- v2 is a clean restart
- legacy/v1 code is reference-only unless explicitly carried over

Why:
- the repo currently contains accumulated architecture drift, partial experiments, and older truth surfaces
- the reset must start from explicit v2 truth, not inferred inheritance from existing code/docs

Implication:
- existing repo code/docs are not automatically canonical for v2
- every carry-over must be classified deliberately

---

## D-003 — Active startup ontology for v2

Frozen decision:
- active high-level startup ontology is **CEO / CTO / DEV**

Why:
- that is the approved top-level model for the restart
- broader company abstractions are premature for the current reset phase

Implication:
- v2 top truth must be rewritten around CEO / CTO / DEV
- older COO-centered framing on `main` must not be treated as active v2 truth by default

---

## D-004 — Current CTO status

Frozen decision:
- current CTO code is a trial to test whether CTO is defined enough for implementation
- the answer is partially
- that CTO work is on a branch and is not canonical `main` truth

Why:
- the reset must distinguish branch experimentation from mainline truth

Implication:
- documentation must state this explicitly
- agents must not infer that current `main` runtime/tooling surfaces represent approved CTO architecture

---

## D-005 — Likely and possible carry-over

Frozen decision:
- MCP Brain is a likely carry-over substrate
- LangGraph is a probable carry-over candidate
- other legacy surfaces remain undecided unless classified explicitly

Why:
- some substrate work may survive the reset as-is or close to as-is
- the reset should preserve useful infrastructure without inheriting whole legacy architecture blindly

Implication:
- a carry-over classification ledger is required before archive/delete work begins

---

## D-006 — Reset sequencing

Frozen decision:
- the reset proceeds in this order:
  1. rewrite top truth (`MISSION-STATEMENT`, `VISION`, `PHASE1`)
  2. classify carry-over from legacy/v1
  3. isolate/archive legacy from active truth
  4. run active-tree reset and cleanup

Why:
- destructive cleanup before top-truth freeze would recreate drift and ambiguity

Implication:
- no archive/delete/reset run should begin before top truth and carry-over classification exist in repo truth

---

## D-007 — Repo-resident context requirement

Frozen decision:
- the reset must be carried by repo-resident context, not only by chat history

Why:
- new sessions and new agents must be able to resume accurately without reconstructing intent from memory

Implication:
- `STATE.md`, `OPEN-ITEMS.md`, `DECISIONS.md`, `HANDOFF.md`, and `NEXT-STEP-HANDOFF.md` are required reset control files
- frozen decisions live here, not only in conversation history

---

## D-008 — AGENTS routing target

Frozen decision:
- `AGENTS.md` should eventually route agents to the reset control pack first

Why:
- the current bootstrap/router surface does not yet force a new agent to consume active v2 reset truth before reading legacy surfaces

Implication:
- AGENTS wiring is part of the reset work order
- until patched, agents should manually begin at `adf-v2/README.md` and `adf-v2/reset/README.md`
