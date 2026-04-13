# ADF v2 - DEV Role

Status: frozen layer output  
Scope: `adf-v2/00-mission-foundation/`  
Purpose: define the high-level role boundary, responsibilities, and operating rules of DEV as the top-level governed development entity in ADF v2 Phase 1

---

## What This Document Is

This document is the frozen mission-foundation definition of the DEV role in ADF v2 Phase 1.

Its job is to define, at the same high level as the corrected `CEO / CTO / DEV` ontology:
- what DEV is
- what DEV is responsible for
- what remains outside DEV
- what operating rules DEV must obey under CTO governance

Its job is not to define:
- the full workflow model
- the component inventory
- the allowed connection model between components
- the full trust model
- an exhaustive internal recipe for every box inside DEV

Those belong in later artifacts.

---

## Why This Document Exists

The ontology correction pass established that `DEV` is a top-level governed entity, not merely a loose bundle of lower-layer ingredients such as scripts, agents, or durable state.

This document turns that corrected ontology into one explicit frozen role boundary for DEV.

Its job is to make the execution-side role clear enough that later workflow, component, and trust work can be derived from a stable high-level DEV definition rather than from ad hoc execution assumptions.

---

## Role Purpose

DEV is the top-level governed development execution entity under CTO governance.

Its purpose is to take the approved implementation request package handed down by CTO and carry out the development work needed to reach a truthful terminal result.

At this level, DEV is not the top strategic governing layer.
DEV is the governed execution layer that turns the approved package into either:
- a truthful execution outcome for CTO review and possible upward certification
- or a truthful blocked or pushback outcome when completion is not yet safe

---

## Core Responsibility

DEV is responsible for governed development execution against the approved package.

At a high level, that means DEV must:
- execute the requested development work within the approved scope
- preserve fidelity to the meaning of the approved package rather than silently redefining it
- carry the execution-side responsibility for turning that package into a truthful terminal result
- return truthful terminal results rather than optimistic or merely nominal ones
- surface truthful pushback or blocked output when completion is not yet safe

DEV therefore owns execution truth, not top-level intent truth.

---

## CTO Boundary

The CTO boundary around DEV must stay explicit.

The CTO owns:
- shaping CEO-approved intent into the implementation request package
- deciding when the package is complete enough for governed handoff into DEV
- governing DEV as the accountable delivery layer above execution
- certifying final delivery upward

DEV owns:
- carrying out governed development execution against that package
- keeping execution truth visible to CTO
- returning truthful terminal outcomes back to CTO

In simple terms:
- CTO decides what package enters governed execution
- DEV executes that package truthfully
- CTO decides what can be certified upward from DEV's returned execution truth

DEV does not replace CTO as the top accountability layer.

---

## What DEV Owns

At this artifact level, DEV owns:

- governed development execution after CTO handoff
- execution of the approved implementation scope without silent scope drift
- the execution-side responsibility for producing a truthful terminal outcome against the approved package
- truthful return to CTO when execution reaches either a truthful execution outcome for review or a truthful non-complete outcome
- use of lower-layer governed ingredients or capabilities needed for execution without elevating those ingredients into peer top-level entities

This document does not specify the internal workflow, state model, or operational mechanics by which DEV fulfills that responsibility.

---

## What DEV Does Not Own

DEV does not own:

- CEO intent shaping
- top-level mission or product-direction decisions
- executive approval
- the top-level decision that an implementation request package is sufficiently defined for handoff
- final upward certification to the CEO
- redefining the meaning of the request after CTO handoff
- turning lower-layer ingredients into a replacement top-level ontology

DEV may discover that the package is insufficient, unsafe, or contradictory.
When that happens, DEV should return truthful pushback or blocked output through the governed boundary rather than silently rewriting the request.

---

## Operating Rules

At this high level, DEV should be governed by these rules:

### 1. Execute only from an approved package

DEV should enter governed execution only after CTO has handed down an implementation request package that is complete enough for execution.

If DEV determines that the package is still not safely executable, DEV should surface truthful pushback or blocked output rather than improvising hidden requirement changes.

### 2. Preserve scope fidelity

DEV must carry out the approved request faithfully.

That means DEV must not:
- silently narrow the request
- silently widen the request
- silently change what success means

Any needed scope correction should surface truthfully through the governed boundary.

### 3. Keep the role boundary clean

DEV is the execution entity under CTO governance, not a second governing layer and not a direct CEO-facing layer.

That means:
- DEV should not bypass CTO as the governing boundary
- DEV should not silently turn execution concerns into top-level intent changes
- DEV should not depend on hidden upward cleanup to make its return appear acceptable

### 4. Return only truthful terminal outcomes

DEV must not return a nominal success.

DEV should return:
- a result that is truthfully ready for CTO review and possible upward certification
- or a truthful non-complete terminal outcome such as blocked with the relevant reason

If completion is not yet safe, DEV must not behave as if it is.

### 5. Use lower-layer ingredients without collapsing into them

DEV may be assembled from boxed components that use:
- scripts
- agents
- durable state
- approved shared substrate

Those are lower-layer governed ingredients or capabilities.
They are not the DEV role itself.

### 6. Report upward through the governed boundary

DEV's relevant upward relationship is to CTO, not directly to CEO.

DEV should therefore return:
- truthful execution outcomes through the governed boundary
- truthful execution outcomes that CTO can review for possible certification
- truthful pushback or blocked output when it is not

This preserves the top-level boundary that keeps CEO burden high-level and controlled.

---

## Relationship To Lower Layers

DEV is a top-level governed role, not a primitive box.

Later artifacts should define:
- the workflows that DEV participates in
- the component inventory that assembles DEV
- the allowed connection model between those components
- the handoff and return package shapes
- the state and checkpoint mechanics
- the broader trust mechanics that govern those routes

This draft intentionally stays above those layers.

---

## Relationship To Other Mission-Foundation Documents

This draft should be read together with:

- `MISSION-STATEMENT.md` for the Phase 1 mission and top-level entity framing
- `DELIVERY-COMPLETION-DEFINITION.md` for what `complete` means at the delivery boundary
- `context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md` for the thin three-entity ontology
- `CTO-ROLE.md` for the governing role directly above DEV

This draft narrows only the DEV side of that already-established frame.

---

## What This Document Deliberately Leaves For Later

This document deliberately does not yet freeze:

- the exact workflow sequence inside DEV
- the exact handoff and return package shapes
- which boxes assemble DEV
- detailed state, checkpoint, or resumability mechanics
- exact internal verification topology
- trust scoring or trust-threshold mechanics

Those should be derived in later passes after the high-level DEV boundary is accepted.

---

## Current Summary

DEV is the top-level governed development execution entity under CTO governance. DEV owns carrying out the approved implementation request package and returning truthful execution outcomes, but it does not own top-level intent shaping, executive approval, workflow mechanics, or final upward certification. DEV may use lower-layer governed ingredients and boxed components, but it must not collapse back into those ingredients as the ontology itself.
