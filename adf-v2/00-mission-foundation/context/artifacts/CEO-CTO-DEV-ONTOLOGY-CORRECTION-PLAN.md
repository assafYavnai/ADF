# Plan - Correct ADF v2 Ontology to `CEO / CTO / DEV` and Realign Mission-Foundation Canon

Status: approved implementation plan  
Scope: `adf-v2/00-mission-foundation/`  
Purpose: provide the execution plan for correcting the mission-foundation top-level ontology and removing the current split truth

---

## Summary

This pass is a mission-foundation ontology correction and durable source-of-truth realignment.

The exact architecture to freeze is:

- the old five-item set `CEO / CTO / Scripts / Agents / Durable state` was being used at the wrong abstraction level as top-level ontology
- the corrected top-level ontology is `CEO / CTO / DEV`
- `CTO` is a top-level entity assembled from boxed components
- `DEV` is a top-level entity assembled from boxed components
- `Scripts / Agents / Durable state` remain below that layer as lower-level governed ingredients or capabilities and are not top-level entities
- this pass does not freeze them as the exhaustive universal internal recipe of every box

This pass must also:

- freeze `DEV` as the canonical high-level name
- rewrite restart and checkpoint truth for contextless next-agent startup
- update the compact mission-foundation decision log so it no longer presents the five-item ontology as current truth
- correct all current canonical ontology wording
- durably persist a full reviewed source inventory in one canonical place
- park `DEV role/rules` as the required next artifact with one primary canonical register and one mirror

---

## Canonical Durable Storage

Create one durable layer-global support artifact as the authoritative reconciliation record:

- `adf-v2/00-mission-foundation/context/ONTOLOGY-RECONCILIATION.md`

This file is the primary durable location for:

- the ontology-correction rationale
- the supersession map
- the full reviewed source inventory
- the status of each affected source (`updated`, `reviewed-no-change`, `superseded`, `historical only`)
- references to the canonical restart/checkpoint docs and parking register updated in the pass

Other files may reference it, but they do not replace it:

- `adf-v2/00-mission-foundation/context/HANDOFF.md`
- `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md`
- `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md`

If a contextless next agent needs to understand what was corrected and which files were reviewed, this is the one canonical place to look.

---

## Evidence And Current Conflict

### Already present in repo

- `adf-v2/00-mission-foundation/MISSION-STATEMENT.md` already says roles and workflows are assemblies built from boxed components.
- `adf-v2/00-mission-foundation/BOXED-COMPONENT-MODEL.md` already says roles and workflows are assembled from boxes and preserves a separate governed substrate/shared-tools exception.
- `adf-v2/00-mission-foundation/context/decisions/decision-014-delivery-definition-as-service-contract.md` and `adf-v2/00-mission-foundation/context/decisions/decision-022-system-owns-the-route-after-handoff.md` already use `CEO -> CTO -> startup development team` at the service boundary.
- `adf-v2/CTO-ROLE.md` and `adf-v2/00-mission-foundation/CTO-CONTEXT-ARCHITECTURE.md` already provide the clearest in-repo precedent for an entity with explicit `role and rules`.

### Current contradiction

Current mission-foundation ontology wording still presents:

- `CEO`
- `CTO`
- `Scripts`
- `Agents`
- `Durable state`

as one peer-level set in:

- `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`
- `adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md`
- `adf-v2/00-mission-foundation/context/decisions/decision-011-core-operating-roles.md`
- `adf-v2/00-mission-foundation/context/HANDOFF.md`
- `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md`
- `adf-v2/00-mission-foundation/context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md`

That is the ontology error being corrected.

---

## Implementation Changes

### 1. Freeze one explicit architecture-reconciliation decision first

Create one new mission-foundation decision that states, without alternatives:

- the old five-item set was being used at the wrong abstraction level as top-level ontology
- the corrected top-level ontology is `CEO / CTO / DEV`
- `CTO` is a top-level entity assembled from boxed components
- `DEV` is a top-level entity assembled from boxed components
- `Scripts / Agents / Durable state` are lower-level governed ingredients or capabilities and are not top-level entities
- this pass does not freeze them as the exhaustive universal internal recipe of every box
- this decision supersedes the top-level reading of:
  - `adf-v2/00-mission-foundation/context/decisions/decision-011-core-operating-roles.md`
  - the corresponding ontology wording in `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`
  - the obsolete ontology wording in `adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md`
  - the obsolete ontology wording in `adf-v2/00-mission-foundation/context/HANDOFF.md`
  - the obsolete ontology wording in `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md`
  - the current five-item draft wording in `adf-v2/00-mission-foundation/context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md`

### 2. Freeze DEV naming as a dedicated decision in the same pass

Create one explicit naming decision whose only job is terminology correction.

It must say:

- canonical high-level term is `DEV`
- `startup development team` is historical wording
- where historical wording remains for traceability, it must be marked historical or superseded rather than left as ambiguous current canon

This decision must be referenced by:

- `adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md`
- `adf-v2/00-mission-foundation/context/ONTOLOGY-RECONCILIATION.md`
- any reviewed frozen decision that retains the old wording for traceability

### 3. Use two different governance paths for touched artifacts

Do not use one reopen rule for everything.

#### Case A: frozen/promoted artifacts

For any frozen or promoted artifact touched by this correction:

- explicitly mark it as reopened or superseded for ontology correction
- update linked decision trail in the same pass
- verify no frozen or promoted artifact still presents the obsolete top-level ontology afterward

This applies at minimum to:

- `adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md`
- any frozen decision files whose wording is now wrong at the ontology layer

#### Case B: working artifacts

For any working artifact touched by this correction:

- edit and realign it directly
- do not describe it as reopened or superseded unless its status is being deliberately changed

This applies at minimum to:

- `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`
- `adf-v2/00-mission-foundation/context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md`
- `adf-v2/00-mission-foundation/context/HANDOFF.md`
- `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md`
- `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md`
- `adf-v2/00-mission-foundation/context/DECISIONS.md`

### 4. Correct the mission statement at the ontology level

Update `adf-v2/00-mission-foundation/MISSION-STATEMENT.md` so that:

- the old `Core operating roles` framing is explicitly retired as the current top-level ontology framing
- the corresponding top-level section becomes an entity-level section, not a peer role-set section
- the canonical top-level set becomes:
  - `CEO`
  - `CTO`
  - `DEV`
- the document explicitly says:
  - `CTO` is a top-level entity assembled from boxed components
  - `DEV` is a top-level entity assembled from boxed components
  - `Scripts / Agents / Durable state` remain below that layer
- the existing `roles and workflows are assemblies built from components` statement remains
- the document no longer elevates `Scripts / Agents / Durable state` to top-level entity status

### 5. Correct delivery completion to the proper service boundary

Update `adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md` so that:

- the service boundary becomes `CEO -> CTO -> DEV`
- the document no longer defines its canonical mission-foundation set as `CEO / CTO / Scripts / Agents / Durable state`
- internal lower-layer ingredients remain below the service boundary
- all existing completion semantics remain intact unless they depend on the obsolete ontology

Because this file is already a frozen layer output, treat the edit as explicit reopen or supersede work with linked decision updates in the same pass.

### 6. Keep the current top-level artifact filename in this pass

Do not rename `adf-v2/00-mission-foundation/context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md` during this correction pass.

Reason:

- the rename is not necessary to fix the ontology
- sibling docs already refer to a later `thin top-level governing-entity document`
- avoiding rename churn keeps this pass bounded

Rewrite `adf-v2/00-mission-foundation/context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md` so that it:

- defines only `CEO`, `CTO`, and `DEV`
- defines their high-level boundaries
- explicitly says:
  - `CTO` is a top-level entity assembled from boxed components
  - `DEV` is a top-level entity assembled from boxed components
  - `Scripts / Agents / Durable state` are not top-level entities and remain below that layer
- avoids freezing any stronger lower-level box recipe
- avoids workflow topology, trust mechanics, and deep component internals

### 7. Rewrite restart and checkpoint truth explicitly

Update `adf-v2/00-mission-foundation/context/HANDOFF.md` and `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md` with a dedicated semantic rewrite, not just incidental alignment.

Required changes in both docs:

- rewrite the current ontology to `CEO / CTO / DEV`
- explicitly demote `Scripts / Agents / Durable state` below the ontology layer
- update `current task` wording so it refers to reviewing or freezing the corrected three-entity ontology
- update `next unresolved question` wording so it no longer points a future agent at the rejected five-item model
- add explicit references to `adf-v2/00-mission-foundation/context/ONTOLOGY-RECONCILIATION.md`
- where DEV role/rules is referenced as the next artifact, point to `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md` as the primary canonical register

### 8. Keep lower-level composition wording intentionally non-exhaustive

If any current doc in this pass needs to mention lower-level composition, use only non-exhaustive wording such as:

- boxes may be assembled from governed ingredients such as scripts, agents, durable state, and approved shared substrate or interfaces as applicable

Do not freeze:

- `every boxed component is built from Scripts, Agents, and Durable state`

unless that stronger claim is intentionally added to the box model in a separate dedicated pass.

### 9. Update the compact decision log explicitly

Update `adf-v2/00-mission-foundation/context/DECISIONS.md` with explicit content outcomes, not just inventory coverage.

Required changes:

- append the new ontology reconciliation decision
- append the new DEV naming decision
- explicitly note that the top-level reading of `adf-v2/00-mission-foundation/context/decisions/decision-011-core-operating-roles.md` is superseded at the ontology layer
- ensure the compact log no longer presents the five-item ontology as current truth

This file is part of the concise authoritative summary layer for future agents, so leaving it unchanged would preserve split truth even if the detailed decision files are correct.

### 10. Build and persist the full source inventory in the reconciliation artifact

The ontology correction must create a durable full inventory in:

- `adf-v2/00-mission-foundation/context/ONTOLOGY-RECONCILIATION.md`

Mandatory inventory or review set must include:

- `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`
- `adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md`
- `adf-v2/00-mission-foundation/BOXED-COMPONENT-MODEL.md`
- `adf-v2/00-mission-foundation/SYSTEM-OBLIGATIONS.md`
- `adf-v2/00-mission-foundation/context/HANDOFF.md`
- `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md`
- `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md`
- `adf-v2/00-mission-foundation/context/DECISIONS.md`
- `adf-v2/00-mission-foundation/context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md`
- `adf-v2/00-mission-foundation/context/decisions/decision-011-core-operating-roles.md`
- `adf-v2/00-mission-foundation/context/decisions/decision-014-delivery-definition-as-service-contract.md`
- `adf-v2/00-mission-foundation/context/decisions/decision-022-system-owns-the-route-after-handoff.md`
- the new ontology reconciliation decision
- the new DEV naming decision
- `adf-v2/CTO-ROLE.md`
- `adf-v2/00-mission-foundation/CTO-CONTEXT-ARCHITECTURE.md`

Each file must be marked as one of:

- `updated`
- `reviewed-no-change`
- `superseded`
- `historical only`

Required handling for `adf-v2/00-mission-foundation/context/decisions/decision-014-delivery-definition-as-service-contract.md` and `adf-v2/00-mission-foundation/context/decisions/decision-022-system-owns-the-route-after-handoff.md`:

- either update them
- or mark them `reviewed-no-change` with explicit naming-supersession reference
- or mark them `historical only`

Default for this plan:

- keep them frozen as `reviewed-no-change`
- explicitly reference the new DEV naming decision

Required handling for support docs:

- `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md` must be marked `updated`
- `adf-v2/00-mission-foundation/context/DECISIONS.md` must be marked `updated`
- both must be referenced from `adf-v2/00-mission-foundation/context/ONTOLOGY-RECONCILIATION.md`

### 11. Decouple DEV role/rules from ontology completion, but park it canonically

Do not make full `DEV-ROLE.md` creation a blocker for this pass.

Add one hard acceptance rule:

- the ontology correction pass is not complete until DEV role/rules is recorded as the required next artifact

Primary canonical register:

- `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md`

Required mirror or reference:

- `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md`

Required outcome:

- `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md` is the authoritative parking register for the DEV role/rules next artifact
- `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md` mirrors that requirement and points back to `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md`
- `adf-v2/00-mission-foundation/context/ONTOLOGY-RECONCILIATION.md` references both and records that `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md` is the primary source if drift appears

Optional:

- create a placeholder artifact only if needed
- but placeholder creation is not required for this pass

---

## Reviewer Clarification Prompt

Use this prompt only if a reviewer challenges why the plan is shaped this way rather than asking for more or lower-level work in the same pass:

> Review this plan as a two-checkpoint ontology-correction flow. Checkpoint 1 only saves and publishes the approved correction plan plus a decision explaining why the pass exists. Checkpoint 2 performs the ontology correction itself. The implementation intentionally freezes only the top-level ontology (`CEO / CTO / DEV`), the DEV naming correction, the assembly bridge that `CTO` and `DEV` are built from boxed components, the restart/checkpoint rewrite, the compact decision-log correction, and the durable reconciliation inventory. It intentionally does not widen into full DEV role implementation or a universal internal recipe for every box. Review whether any current canonical file could still present the rejected five-item ontology after these two checkpoints.

---

## Validation And Review Checklist

A contextless reviewer must be able to verify all of the following:

### A. Planning checkpoint exists and was published

- the plan file exists at `adf-v2/00-mission-foundation/context/artifacts/CEO-CTO-DEV-ONTOLOGY-CORRECTION-PLAN.md`
- D-068 exists and links to the plan file
- `adf-v2/00-mission-foundation/context/DECISIONS.md` includes D-068

### B. One exact ontology correction was frozen

The new reconciliation decision states exactly:

- old five-item set was wrong at the top-level ontology layer
- corrected top-level ontology is `CEO / CTO / DEV`
- `CTO` is assembled from boxed components
- `DEV` is assembled from boxed components
- `Scripts / Agents / Durable state` are lower-level ingredients or capabilities and not top-level entities

### C. DEV naming was frozen explicitly

The new naming decision states exactly:

- canonical high-level term is `DEV`
- `startup development team` is historical wording
- any retained old wording is clearly marked historical or superseded

### D. Compact decision truth is corrected

`adf-v2/00-mission-foundation/context/DECISIONS.md` must:

- include D-068
- include the ontology reconciliation decision
- include the DEV naming decision
- explicitly state that the top-level reading of D-011 is superseded
- no longer present the five-item ontology as current truth

### E. Full durable inventory exists in one canonical place

`adf-v2/00-mission-foundation/context/ONTOLOGY-RECONCILIATION.md` exists and contains the full reviewed source inventory, status labels, and supersession map.

### F. Exactly one top-level ontology remains in current canon

Current canonical truth must show only:

- `CEO`
- `CTO`
- `DEV`

No current canonical source may present:

- `Scripts`
- `Agents`
- `Durable state`

as peers of `CEO / CTO`.

### G. Assembly bridge is explicit in current canon

Both of these docs must explicitly state:

- `CTO` is a top-level entity assembled from boxed components
- `DEV` is a top-level entity assembled from boxed components
- `Scripts / Agents / Durable state` remain below that layer

Required docs:

- `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`
- `adf-v2/00-mission-foundation/context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md`

### H. Restart truth is explicitly corrected

Both restart and checkpoint docs must:

- use `CEO / CTO / DEV`
- demote `Scripts / Agents / Durable state` below the ontology layer
- point a future agent at the corrected three-entity ontology
- reference `adf-v2/00-mission-foundation/context/ONTOLOGY-RECONCILIATION.md`

Required docs:

- `adf-v2/00-mission-foundation/context/HANDOFF.md`
- `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md`

### I. Delivery boundary is corrected

`adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md` must use:

- `CEO -> CTO -> DEV`

and keep lower-level implementation ingredients below that service boundary.

### J. Decision-014 and decision-022 were explicitly reviewed

Both of these appear in the inventory:

- `adf-v2/00-mission-foundation/context/decisions/decision-014-delivery-definition-as-service-contract.md`
- `adf-v2/00-mission-foundation/context/decisions/decision-022-system-owns-the-route-after-handoff.md`

Each is marked:

- `updated`
- or `reviewed-no-change` with explicit naming-supersession reference
- or `historical only`

### K. DEV role/rules is durably parked with one primary source

The implementation pass is not complete unless:

- `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md` records DEV role/rules as the required next artifact
- `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md` mirrors that requirement and points to `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md`
- the docs make clear that `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md` is the primary canonical register and `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md` is the required mirror

---

## Assumptions And Defaults

- treat the user's clarification in this thread as the new architecture authority
- freeze `DEV` as the canonical high-level term in the naming decision
- treat `startup development team` as historical wording after the implementation checkpoint
- keep the current `adf-v2/00-mission-foundation/context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md` filename unchanged in this pass
- keep lower-level composition wording non-exhaustive
- do not require full `DEV-ROLE.md` creation for ontology-correction completion
- require the authoritative reviewed source inventory to live in `adf-v2/00-mission-foundation/context/ONTOLOGY-RECONCILIATION.md`
- require DEV role/rules to be parked in `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md` as primary canonical register and mirrored in `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md`
