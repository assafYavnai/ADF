# ADF v2 - Next-Step Handoff

Status: active restart handoff  
Scope: `adf-v2/00-mission-foundation/`  
Purpose: let the next agent resume the mission-foundation work from the current real state, without reconstructing this session from chat

---

## Current Checkpoint

Checkpoint date:
- `2026-04-12`

Last agent reference:
- `cf84254d-33c9-41d1-a6de-e811dc1fc286`

Current branch state:
- the trust-model draft is committed
- trust decisions `D-027` through `D-036` are committed
- `DELIVERY-COMPLETION-DEFINITION.md` is now approved for freeze and promoted to the layer root
- delivery-boundary trust decisions `D-037` and `D-038` now exist
- `context/OPEN-ITEMS.md` now exists as the canonical parking and checklist file for mission-foundation open items
- later delivery-boundary decisions `D-039` through `D-046` are committed
- decision `D-047` records the freeze approval and promotion of `DELIVERY-COMPLETION-DEFINITION.md`

Current main task:
- continue mission foundation from the next unresolved canonical outputs after delivery completion freeze

Current task boundary:
- only the narrow delivery-boundary meaning of trust belongs inside `DELIVERY-COMPLETION-DEFINITION.md`
- the broader trust-model questions remain parked in `context/artifacts/TRUST-MODEL.md`
- anything important that falls outside the active document should be parked in `context/OPEN-ITEMS.md`

Current decision boundary:
- frozen:
  - the mission-foundation decisions under `context/decisions/`
  - the rule that `DELIVERY-COMPLETION-DEFINITION.md` should consume only boundary trust
- drafted only:
  - `context/artifacts/TRUST-MODEL.md`
  - `context/OPEN-ITEMS.md`
- still open:
  - the unresolved broader trust-model questions parked in `TRUST-MODEL.md`
  - the parked later-document items in `OPEN-ITEMS.md`

Immediate next unresolved question:
- which next canonical mission-foundation document should be frozen after delivery completion

Do-not-repeat rules for the next agent:
- do not treat `context/artifacts/TRUST-MODEL.md` as frozen canon
- do not widen `DELIVERY-COMPLETION-DEFINITION.md` into the full trust model
- do not reopen already frozen trust decisions unless the CEO explicitly reopens them
- do not lose the open trust questions parked in `TRUST-MODEL.md`
- do not lose the out-of-scope open items parked in `OPEN-ITEMS.md`

CEO protocol reminder:
- stay minimal, decision-shaped, and do not freeze new content without explicit approval

---

## Current Strategic Direction

### Repo decision

- `adf-v2/` lives in the same repo as legacy ADF
- legacy ADF is reference only for v2, not source of truth
- v2 is intended to become the new architectural source of truth

### High-level v2 direction

ADF v2 is being reframed around:
- boxed, self-contained components
- contract-based interaction
- defined failure and pushback behavior
- reusable role/workflow assemblies built from those components
- a thin startup model rather than a broad virtual-company model

### Operating model agreed so far

Core operating roles for v2 Phase 1:
- CEO
- CTO
- Scripts
- Agents
- Durable state

No separate foundational COO layer was chosen for v2 Phase 1.
No separate foundational PM layer was chosen for v2 Phase 1.

---

## Reading Order For The Next Agent

Read in this order:

1. `adf-v2/LAYER-LIFECYCLE.md`
2. `adf-v2/00-mission-foundation/context/HANDOFF.md`
3. `adf-v2/00-mission-foundation/V1-PAIN-POINT-AND-V2-FORK-RATIONALE.md`
4. `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`
5. `adf-v2/00-mission-foundation/context/DECISIONS.md`
6. `adf-v2/00-mission-foundation/CTO-REQUIREMENT-GATHERING-FINDINGS.md`
7. `adf-v2/00-mission-foundation/CTO-CONTEXT-ARCHITECTURE.md`
8. `adf-v2/CEO-AGENT-WORKING-PROTOCOL.md`
9. `adf-v2/CTO-ROLE.md`
10. `adf-v2/00-mission-foundation/context/artifacts/TRUST-MODEL.md`
11. `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md`
12. `adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md`
13. individual decision files under `adf-v2/00-mission-foundation/context/decisions/` only if needed

Reading intent:
- items `1` through `9` define the current governing frame
- `TRUST-MODEL.md` is the broader trust draft and must not be treated as frozen canon
- `OPEN-ITEMS.md` is the canonical parking and checklist register for unresolved items
- `DELIVERY-COMPLETION-DEFINITION.md` is the frozen canonical delivery-completion definition for this layer

---

## Files In This Area

### Main files

- `adf-v2/LAYER-LIFECYCLE.md`
- `adf-v2/CEO-AGENT-WORKING-PROTOCOL.md`
- `adf-v2/CTO-ROLE.md`
- `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`
- `adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md`
- `adf-v2/00-mission-foundation/V1-PAIN-POINT-AND-V2-FORK-RATIONALE.md`
- `adf-v2/00-mission-foundation/CTO-REQUIREMENT-GATHERING-FINDINGS.md`
- `adf-v2/00-mission-foundation/CTO-CONTEXT-ARCHITECTURE.md`

### Context support files

- `adf-v2/00-mission-foundation/context/HANDOFF.md`
- `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md`
- `adf-v2/00-mission-foundation/context/DECISIONS.md`
- `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md`

### Draft artifacts

- `adf-v2/00-mission-foundation/context/artifacts/TRUST-MODEL.md`
- `adf-v2/00-mission-foundation/context/artifacts/README.md`

### Decision files

- all frozen decision files under `adf-v2/00-mission-foundation/context/decisions/`
- this includes trust decisions `D-027` through `D-036`

---

## What Was Actually Frozen

The key frozen strategic conclusions already accepted are:

- v2 must be boxed and contract-based
- roles and workflows should be treated as assemblies built from components
- the startup model is the focus of Phase 1
- trust is a core system concept
- the full trust model is separate from delivery completion
- delivery completion should consume only boundary trust

---

## What The Next Session Should Do

The next session should not restart from first principles.
It should continue from the current drafts and frozen decisions.

### Immediate next step

Use the now-frozen `DELIVERY-COMPLETION-DEFINITION.md` as canonical mission-foundation truth and continue to the next layer outputs that still remain draft.

### After that

Then continue with:
- `SYSTEM-OBLIGATIONS.md`
- `BOXED-COMPONENT-MODEL.md`
- `ROLE-MODEL.md`
- `WORKFLOW-MODEL.md`

---

## Important Boundaries For The Next Agent

Do not do these yet:
- broad architecture design for all of v2
- detailed schemas too early
- detailed implementation planning for every subsystem
- recreating legacy ADF compatibility behavior
- later-company roles and departments
- full trust-governance mechanics inside the delivery-completion document

Do keep doing these:
- keep docs thin at the right level
- freeze one decision at a time
- record frozen decisions in `context/decisions/`
- keep drafts in `context/artifacts/`
- separate mission vs scope vs spec vs plan
- treat the current requirement-gathering method as part of the reusable v2 foundation

---

## One-Sentence Restart Summary

ADF v2 mission foundation is active, `DELIVERY-COMPLETION-DEFINITION.md` is now frozen layer canon, trust is still split between frozen boundary decisions and the broader draft trust model, and the next agent should continue the remaining foundation outputs without reopening the frozen delivery definition.
