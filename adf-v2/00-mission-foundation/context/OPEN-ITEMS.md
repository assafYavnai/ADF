# ADF v2 - Open Items

Status: active open-item register  
Scope: `adf-v2/00-mission-foundation/`  
Purpose: preserve open items that surface during mission-foundation work so they are not lost when they fall outside the current active document or decision pass

---

## How To Use This File

This file is the canonical parking and checklist register for mission-foundation open items.

Use it when:
- an important issue is discovered but does not belong inside the current active document
- an issue belongs to a later document and should not be solved yet
- a concept is recognized but not yet frozen
- the next agent needs a clear answer to what is still open

Each item should say:
- current state
- rationale
- target document

For resolved items, the rationale may record the issue the item was tracking rather than restating a still-open problem.

State meanings:
- `open` = still unresolved
- `frozen-upstream-needs-incorporation` = decided elsewhere, but not yet fully reflected in the active document
- `moved` = moved into the active draft for the target document
- `resolved` = fully decided and no longer open

---

## Current Active Task Open Items

### O-001 - Final narrow trust wording for delivery completion

State:
- `resolved`

Rationale:
- resolved in `DELIVERY-COMPLETION-DEFINITION.md` by making the no-leak rule explicit above governed execution while keeping the trust wording narrow

Target document:
- `DELIVERY-COMPLETION-DEFINITION.md`

Notes:
- the final wording must stay narrow and not widen into the full trust model
- it should now reflect:
  - `D-037` justified CEO doubt counts as leaked burden
  - `D-038` scope fidelity is part of delivery-boundary trust

### O-002 - Incorporate already frozen delivery-boundary trust conditions into the completion document

State:
- `resolved`

Why it is open:
- several trust conditions are already frozen in decisions but are not yet fully and clearly reflected in `DELIVERY-COMPLETION-DEFINITION.md`

Target document:
- `DELIVERY-COMPLETION-DEFINITION.md`

Notes:
- this includes, at minimum:
  - no CEO supervision or verification after handoff
  - internal pushback contained before completion is declared
  - queryable and safely resumable state
  - environment isolation and cleanliness
  - scope fidelity
  - absence of justified CEO doubt

### O-003 - Final wording of `complete`

State:
- `resolved`

Why it is open:
- the draft still needs a final approved wording for the exact definition of `complete`

Target document:
- `DELIVERY-COMPLETION-DEFINITION.md`

### O-004 - Naming and framing of truthful non-complete terminal outcomes

State:
- `resolved`

Why it is open:
- the state model direction is now frozen, but the delivery-completion draft does not yet fully reflect it

Target document:
- `DELIVERY-COMPLETION-DEFINITION.md`

Notes:
- top-level terminal states are now:
  - `complete`
  - `blocked`
- `pushback` is a blocked reason, not a top-level state
- blocked reasons are component-specific and are not required to be identical across all components
- blocked may represent either external waiting or an internal failure that prevents truthful completion from the current state

### O-005 - How explicit to be about true terminal return into the production tree

State:
- `resolved`

Why it is open:
- the production-tree rule is now frozen, but the delivery-completion draft does not yet fully reflect it

Target document:
- `DELIVERY-COMPLETION-DEFINITION.md`

Notes:
- completion requires actual return into the production tree

### O-006 - Whether to state certification basis explicitly

State:
- `resolved`

Why it is open:
- it is still unresolved whether the document should say explicitly that CTO certification must rest on governed system truth rather than informal belief or manual reconstruction

Target document:
- `DELIVERY-COMPLETION-DEFINITION.md`

### O-007 - Whether to name `no hidden heroics` explicitly

State:
- `resolved`

Why it is open:
- it is still unresolved whether the delivery boundary should explicitly say completion must not depend on invisible person-specific cleanup, memory, or rescue work

Target document:
- `DELIVERY-COMPLETION-DEFINITION.md`

### O-008 - Whether fire-and-forget should explicitly include queryability, resumability, and error-only upward surfacing

State:
- `resolved`

Why it is open:
- the chat clarified fire-and-forget from the CEO experience, not only from internal route mechanics
- it is still unresolved how explicitly the completion document should say that the route must remain queryable and safely resumable at any point, while only errors, blockers, pushback, or terminal outcomes should surface upward

Target document:
- `DELIVERY-COMPLETION-DEFINITION.md`

### O-009 - Whether required human testing should be named explicitly as part of trustworthy approval readiness

State:
- `resolved`

Why it is open:
- this item tracked whether the delivery-completion wording should name required human testing explicitly before upward `complete` certification

Target document:
- `DELIVERY-COMPLETION-DEFINITION.md`

### O-010 - Whether the completion document should state that the CEO need not understand the internal route

State:
- `resolved`

Why it is open:
- the chat clarified that the CEO should care about the returned result and whether it is safe to rely on, not about the internal implementation mechanics
- it is still unresolved whether that should be stated directly inside the delivery-completion framing or left implicit in the role/protocol docs

Target document:
- `DELIVERY-COMPLETION-DEFINITION.md`

### O-011 - Resolve sibling-doc status wording mismatch before freezing the top-level governing-entity document

State:
- `resolved`

Why it is open:
- resolved by aligning `SYSTEM-OBLIGATIONS.md` and `BOXED-COMPONENT-MODEL.md` to their frozen promoted status and recording that correction in `context/ONTOLOGY-RECONCILIATION.md`

Target document:
- `SYSTEM-OBLIGATIONS.md`
- `BOXED-COMPONENT-MODEL.md`

### O-012 - DEV role or rules is the required next artifact after ontology correction

State:
- `resolved`

Why it is open:
- the ontology correction pass has closed the top-level ontology question cleanly enough that the next required mission-foundation artifact is now DEV role or rules
- resolved by approving, freezing, and promoting `DEV-ROLE.md` to the layer root as a canonical mission-foundation output
- the DEV role boundary is no longer draft-only startup truth

Target document:
- `DEV-ROLE.md`

Notes:
- keep the artifact at the same high level as the corrected `CEO / CTO / DEV` ontology
- define DEV's accountability boundary under CTO governance
- do not freeze an exhaustive internal recipe for every box

### O-013 - Review and tighten the DEV role draft before freeze-read

State:
- `resolved`

Why it is open:
- resolved by the review, tightening, approval, freeze-read, and promotion pass that produced the frozen `DEV-ROLE.md` layer output

Target document:
- `DEV-ROLE.md`

Notes:
- keep the artifact at the same high level as the corrected `CEO / CTO / DEV` ontology
- do not widen the review into workflow topology, component inventory, or full trust mechanics
- if gaps remain, tighten the DEV boundary rather than expanding the artifact downward

### O-014 - Workflow model is the required next artifact after DEV role promotion

State:
- `open`

Why it is open:
- the promoted `DEV-ROLE.md` now fixes the top-level execution boundary cleanly enough that the next required mission-foundation artifact is the workflow model
- `context/OPEN-ITEMS.md` is the primary canonical register for that next artifact until its working draft exists
- `context/NEXT-STEP-HANDOFF.md` must mirror this requirement

Target document:
- `next WORKFLOW-MODEL artifact`

Notes:
- derive workflows from the now-frozen `CEO / CTO / DEV` boundary and the promoted `DEV-ROLE.md`
- keep the first workflow pass above detailed component implementation
- use the parked DEV out-of-scope items below as explicit carry-forward inputs where relevant

---

## Broader Trust-Model Open Items

### O-101 - Canonical definition of `trust` and `trust level`

State:
- `open`

Why it is open:
- the trust draft has working definitions, but the final frozen wording is not yet approved

Target document:
- `context/artifacts/TRUST-MODEL.md`

### O-102 - Distinction between edge trust, box trust, and any later workflow or chain trust

State:
- `open`

Why it is open:
- the model direction exists, but the exact canonical distinctions are not yet frozen

Target document:
- `context/artifacts/TRUST-MODEL.md`

### O-103 - Trust ownership and visibility rules

State:
- `open`

Why it is open:
- who assesses whom, who can see what, and what goes upward versus stays internal is not yet fully frozen

Target document:
- `context/artifacts/TRUST-MODEL.md`

### O-104 - Aggregation rule details

State:
- `open`

Why it is open:
- `weakest critical edge` is directionally frozen, but the exact rule still needs definition

Target document:
- `context/artifacts/TRUST-MODEL.md`

Notes:
- still open:
  - what counts as a critical edge
  - whether aggregation is per active workflow or per box overall
  - whether inactive edges matter

### O-105 - Threshold bands and required actions

State:
- `open`

Why it is open:
- the draft contains suggested thresholds, but the mandatory action model is not yet frozen
- this includes how verification depth changes by trust level, including low-trust verification intensity

Target document:
- `context/artifacts/TRUST-MODEL.md`

### O-106 - Principled trust signal model

State:
- `open`

Why it is open:
- examples exist for what raises and lowers trust, but a short frozen rule set does not yet exist

Target document:
- `context/artifacts/TRUST-MODEL.md`

### O-107 - Governance mechanics for trust

State:
- `open`

Why it is open:
- the high-level mechanics for how trust is recorded, compared, updated, decayed, and audited are still unresolved

Target document:
- `context/artifacts/TRUST-MODEL.md`

### O-108 - Maturity path for self-healing and self-improvement

State:
- `open`

Why it is open:
- the intended long-term direction is frozen, but the maturity model is not yet defined

Target document:
- `context/artifacts/TRUST-MODEL.md`

---

## Later-Document Open Items

### O-201 - Operational enforcement mechanics for trust

State:
- `open`

Why it is open:
- these mechanics should not be solved inside mission-foundation trust wording, but they must not be lost

Target document:
- `SYSTEM-OBLIGATIONS.md`

Notes:
- examples:
  - audit pipelines
  - runtime truth plumbing
  - enforcement behavior when trust degrades

### O-202 - Component reporting shape for trust-bearing boxes

State:
- `resolved`

Why it is open:
- resolved in `BOXED-COMPONENT-MODEL.md` by giving boxes explicit logical structural surfaces for reporting, audit, checkpoint, scope-fidelity, trust attachment, and governed verification/certification evidence

Target document:
- `BOXED-COMPONENT-MODEL.md`

### O-203 - Role-boundary trust visibility and escalation shape

State:
- `open`

Why it is open:
- some trust visibility and escalation questions depend on role boundaries and should be solved where the role model is explicit

Target document:
- `TBD after workflow and component inventory sequencing is re-decided`

### O-204 - Concrete workflow topology for trust edges

State:
- `open`

Why it is open:
- trust is edge-based in a workflow graph, but the actual workflow topology belongs in the workflow model rather than the mission-foundation trust draft

Target document:
- `WORKFLOW-MODEL.md`

### O-205 - Exact filename and final shape of the thin top-level governing-entity document

State:
- `open`

Why it is open:
- a first working draft now exists at `context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md`, but the final promoted filename and final freeze shape are not yet approved
- the current task is still the governing meaning, not only the presentation choice

Target document:
- `context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md`

### O-206 - DEV/CTO handoff and return package shapes

State:
- `open`

Why it is open:
- promoted `DEV-ROLE.md` intentionally stayed above exact package-shape definition
- the CTO/DEV boundary is now frozen at role level, but the exact handoff and return package shape still needs later definition

Target document:
- `WORKFLOW-MODEL.md`

Notes:
- define the package shape without reopening the promoted DEV role boundary
- keep `complete` ownership with CTO certification rather than drifting it downward into DEV

### O-207 - DEV component assembly derived from workflows

State:
- `open`

Why it is open:
- promoted `DEV-ROLE.md` intentionally did not freeze which boxes assemble DEV
- that assembly should be derived after workflow definition rather than guessed inside the role document

Target document:
- `COMPONENT-INVENTORY.md`

Notes:
- derive the assembly from the workflow model, not directly from role prose

### O-208 - DEV state, checkpoint, and resumability mechanics

State:
- `open`

Why it is open:
- promoted `DEV-ROLE.md` intentionally left state, checkpoint, and resumability mechanics out of scope
- those mechanics must be defined later without being reconstructed from scattered wording

Target document:
- `WORKFLOW-MODEL.md`

Notes:
- keep role-boundary meaning separate from workflow-state mechanics
- align later with the existing system-obligation truth on queryability and resumability

### O-209 - DEV internal verification topology

State:
- `open`

Why it is open:
- promoted `DEV-ROLE.md` intentionally did not freeze the internal verification topology inside DEV
- later workflow and component work must still define where verification sits strongly enough to support truthful CTO certification

Target document:
- `WORKFLOW-MODEL.md`

Notes:
- define the topology below the promoted role boundary rather than reopening the role artifact itself
