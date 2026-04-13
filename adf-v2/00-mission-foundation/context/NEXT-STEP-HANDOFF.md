# ADF v2 - Next-Step Handoff

Status: active checkpoint companion  
Scope: `adf-v2/00-mission-foundation/`  
Purpose: provide a thin checkpoint companion to `HANDOFF.md` without replacing its canonical startup authority

---

## Current Checkpoint

Canonical startup authority:
- `adf-v2/00-mission-foundation/context/HANDOFF.md`

This file is only the thin checkpoint companion.
It must stay aligned to `HANDOFF.md` and must not replace the broader-work frame stored there.

Checkpoint date:
- `2026-04-13`

Current branch state:
- the ontology correction plan approved by `D-068` has now been implemented in current mission-foundation canon
- the current top-level ontology is `CEO / CTO / DEV`
- `MISSION-STATEMENT.md` now uses `Top-level entities` framing instead of the obsolete five-item ontology framing
- `DELIVERY-COMPLETION-DEFINITION.md` now uses the `CEO -> CTO -> DEV` service boundary and has been reopened and re-frozen in place for ontology correction
- `SYSTEM-OBLIGATIONS.md` and `BOXED-COMPONENT-MODEL.md` now have headers aligned to their frozen promoted state
- `context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md` now carries the corrected three-entity ontology draft
- `context/ONTOLOGY-RECONCILIATION.md` now exists as the canonical reconciliation record and reviewed source inventory
- `context/OPEN-ITEMS.md` is now the primary canonical register for the next DEV role or rules artifact

Current main task:
- define the DEV role or rules artifact as the next required mission-foundation output

Current task boundary:
- keep the task at the same high level as the corrected ontology
- define DEV's accountability boundary under CTO governance
- do not widen into workflow topology, component inventory, or an exhaustive internal recipe for every box
- keep broader trust-model questions parked in `context/artifacts/TRUST-MODEL.md`

Current decision boundary:
- frozen:
  - the corrected top-level ontology is `CEO / CTO / DEV`
  - `CTO` and `DEV` are top-level entities assembled from boxed components
  - scripts, agents, durable state, and approved shared substrate remain lower-level governed ingredients or capabilities
  - `DELIVERY-COMPLETION-DEFINITION.md` is again frozen after ontology correction
- drafted only:
  - `context/artifacts/TRUST-MODEL.md`
  - `context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md`
  - `context/OPEN-ITEMS.md`
- still open:
  - the DEV role or rules artifact
  - the final freeze shape and promoted filename of the current top-level governing-entity draft
  - the broader trust-model questions parked in `TRUST-MODEL.md`

Immediate next unresolved question:
- what high-level DEV role boundary and rules must be frozen next so later workflow and component work can be derived without collapsing DEV back into lower-layer ingredients

Do-not-repeat rules for the next agent:
- do not revive the obsolete five-item top-level ontology
- do not treat lower-layer governed ingredients as peer top-level entities
- do not treat `context/artifacts/TRUST-MODEL.md` as frozen canon
- do not widen `DELIVERY-COMPLETION-DEFINITION.md` into the full trust model
- do not lose that `OPEN-ITEMS.md` is the primary canonical register for the next DEV role or rules artifact

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
- reusable role and workflow assemblies built from those components
- a thin startup model rather than a broad virtual-company model

### Operating model agreed so far

Top-level entities for v2 Phase 1:
- CEO
- CTO
- DEV

Below that top-level ontology:
- scripts
- agents
- durable state
- approved shared substrate

Those are governed ingredients or capabilities, not peer top-level entities.

---

## Reading Order For The Next Agent

Read in this order:

1. `adf-v2/LAYER-LIFECYCLE.md`
2. `adf-v2/00-mission-foundation/context/HANDOFF.md`
3. `adf-v2/00-mission-foundation/context/ONTOLOGY-RECONCILIATION.md`
4. `adf-v2/00-mission-foundation/V1-PAIN-POINT-AND-V2-FORK-RATIONALE.md`
5. `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`
6. `adf-v2/00-mission-foundation/context/DECISIONS.md`
7. `adf-v2/00-mission-foundation/CTO-CONTEXT-ARCHITECTURE.md`
8. `adf-v2/CEO-AGENT-WORKING-PROTOCOL.md`
9. `adf-v2/CTO-CEO-WORKING-MODE.md`
10. `adf-v2/CTO-ROLE.md`
11. `adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md`
12. `adf-v2/00-mission-foundation/SYSTEM-OBLIGATIONS.md`
13. `adf-v2/00-mission-foundation/BOXED-COMPONENT-MODEL.md`
14. `adf-v2/00-mission-foundation/context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md`
15. `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md`
16. `adf-v2/00-mission-foundation/context/artifacts/TRUST-MODEL.md`
17. individual decision files under `adf-v2/00-mission-foundation/context/decisions/` only if needed

Reading intent:
- items `1` through `10` define the corrected governing frame
- `ONTOLOGY-RECONCILIATION.md` is the canonical record of what changed and what remains historical only
- `DELIVERY-COMPLETION-DEFINITION.md`, `SYSTEM-OBLIGATIONS.md`, and `BOXED-COMPONENT-MODEL.md` are frozen canonical layer outputs
- `TOP-LEVEL-GOVERNING-ENTITIES.md` is the corrected ontology draft
- `OPEN-ITEMS.md` is the primary canonical register for the next DEV role or rules artifact

---

## One-Sentence Restart Summary

ADF v2 mission foundation is active, the ontology correction pass has moved current canon to `CEO / CTO / DEV`, the reconciliation inventory now lives in `context/ONTOLOGY-RECONCILIATION.md`, and the next agent should define the DEV role or rules artifact using `OPEN-ITEMS.md` as the primary canonical register rather than reopening the old five-entity ontology.
