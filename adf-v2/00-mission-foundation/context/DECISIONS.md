# ADF v2 Mission Foundation — Decision Log

Status: active working log for frozen decisions made while defining `adf-v2/00-mission-foundation/`
Purpose: give the next agent a compact, append-only record of what was decided without forcing them to reconstruct the conversation

---

## Decision D-001 — First mission document name

Frozen decision:
- `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`

Why:
- clearer than `VISION.md`
- does not compete with the root ADF vision documents
- more explicit for restart and handoff use

Rejected alternatives:
- `VISION.md`
- `FOUNDATION.md`

---

## Decision D-002 — Mission document style

Frozen decision:
- keep `MISSION-STATEMENT.md` **thin**

Why:
- `context/HANDOFF.md` already carries the wider context and session rationale
- the mission document should be an executive charter, not a strategy dump
- architecture, migration, and control-plane detail belong in later documents

Implication:
- mission statement stays short and decisive
- supporting context lives in separate files under the same foundation area

---

## Decision D-003 — Mission document structure

Frozen decision:
`MISSION-STATEMENT.md` will use this structure:

1. Identity
2. Core promise
3. Phase 1 mission
4. Phase 1 scope
5. Phase 1 out of scope
6. Core operating roles
7. Success test

Why:
- adds explicit scope, not only out-of-scope
- keeps the document useful for fast executive review
- prevents architecture and implementation detail from leaking into the mission charter

---

## Working rule from this point forward

For the remainder of the `00-mission-foundation` work:
- every frozen decision should be recorded here
- `context/HANDOFF.md` remains the broad session bridge and restart pack
- `DECISIONS.md` remains the concise authoritative log of frozen choices

---

## Decision D-025 — CTO role/rules sit above the context layers

Frozen decision:
- CTO context includes a governing `Layer 0` for role and rules above the 3 working context layers

Why:
- the context layers explain what CTO is holding, not how CTO must behave
- this keeps the operating contract separate from the active work context

---

## Decision D-026 — CTO context uses system graph, task subgraph, issue stack

Frozen decision:
- below `Layer 0`, the working model is:
  1. system graph
  2. current task subgraph
  3. current issue stack

Why:
- the system layer needs relationship awareness
- the task layer is the focused slice of that system context
- the issue layer is temporary and FILO
