# ADF v2 - Top-Level Governing Entities

Status: first-draft working artifact  
Scope: `adf-v2/00-mission-foundation/`  
Purpose: define the corrected thin top-level governing entities and their high-level boundaries for ADF v2 Phase 1

---

## What This Document Is

This document is a first draft.

It is the current working draft for the corrected thin top-level governing-entity definition that mission-foundation needs after the ontology correction pass.

Its job is to define, at a high level:
- who exists at the top in Phase 1
- what each top-level entity is responsible for
- where the high-level boundaries sit between those entities

Its job is not to define:
- the detailed workflow model
- the component inventory
- the allowed connection model between components
- the full trust model
- lower-level schemas, file layout, or implementation policy
- an exhaustive internal recipe for every box

Those belong in later artifacts.

---

## Why This Document Exists

ADF v2 is intentionally starting thin.

The system should not restart from a broad virtual-company model.
It should first make explicit the minimum top-level governing structure the Phase 1 startup model depends on.

This draft exists to hold the corrected top-level ontology before later work defines:
- DEV role and rules
- how work moves
- what boxes are required
- how those boxes connect
- how trust behaves across the real structure

---

## Upstream Truth This Draft Carries

This draft does not invent a new ontology.
It turns already approved mission-foundation direction into one thin explicit top-level-entity definition.

In particular, it carries the corrected direction that:
- the old five-item set `CEO / CTO / Scripts / Agents / Durable state` was being used at the wrong abstraction level as top-level ontology
- the corrected top-level ontology is `CEO / CTO / DEV`
- `CTO` is a top-level entity assembled from boxed components
- `DEV` is a top-level entity assembled from boxed components
- `Scripts / Agents / Durable state` remain below that layer as lower-level governed ingredients or capabilities

This draft does not freeze those lower-level ingredients as an exhaustive universal recipe for every box.

---

## Document Boundary

This document defines the top-level governing entities and their boundaries.

It does define:
- the top-level entity set
- the high-level accountability boundary of each entity
- the high-level relationship between those entities

It does not define:
- the route sequence between them
- the exact handoff packages between them
- the lower-level box assemblies that implement them
- the trust mechanics across those later routes

In simple terms:
- this document says who exists at the top
- later documents will say how work moves through that structure

---

## Top-Level Governing Entities

ADF v2 Phase 1 uses this thin top-level governing entity set:

1. **CEO**
2. **CTO**
3. **DEV**

This is the minimum top-level structure for the startup model.

No separate foundational COO layer is included in Phase 1.
No separate foundational PM layer is included in Phase 1.

---

## 1. CEO

The CEO is the top external decision authority for the system.

At this level, the CEO owns:
- vision
- priorities
- approval
- high-level governing intent

The CEO does not own:
- internal route governance
- implementation coordination
- review or repair mechanics
- hidden cleanup after handoff

The CEO boundary exists so the system can be used as a real delivery service rather than as a workflow the CEO must manually operate.

---

## 2. CTO

The CTO is the top-level governing delivery entity between the CEO and DEV.

At this level, the CTO owns:
- shaping CEO intent into a clear implementation request package
- architecture and sequencing at the high level
- admission into governed execution
- governing the lower-layer execution chain
- truthful upward certification and reporting

The CTO is assembled from boxed components.
The CTO does not exist as a passive messenger.
The CTO is the accountability layer that makes delegation trustworthy.

The CTO boundary exists so execution problems, pushback, verification, and repair do not leak upward as CEO burden unless a real executive decision is needed.

---

## 3. DEV

DEV is the top-level governed development entity under CTO governance.

At this level, DEV owns:
- carrying out governed development execution against the approved package
- returning truthful terminal results
- surfacing truthful pushback or blocked output when completion is not yet safe
- using the lower-layer governed ingredients and capabilities needed for execution without elevating those ingredients into peer top-level entities

DEV is assembled from boxed components.
DEV does not own:
- CEO intent shaping
- top-level governance truth
- upward executive approval
- replacing the CTO as the top accountability layer

The DEV boundary exists so the implementation system has one top-level execution entity that can be governed cleanly without collapsing the ontology into lower-layer ingredients.

---

## Lower-Layer Governed Ingredients

Below the top-level ontology, governed ingredients and capabilities may include things such as:
- scripts
- agents
- durable state
- approved shared substrate or interfaces

Those may participate inside boxed components and higher-level assemblies as applicable.
They are not top-level peer entities in the mission-foundation ontology.

This wording is intentionally non-exhaustive.
This document does not freeze a stronger claim such as every box always using the same exact internal recipe.

---

## High-Level Boundary Model

The top-level boundary model for Phase 1 is:

- **CEO** sits above the governed delivery system and decides what should happen at the highest level.
- **CTO** translates that intent into a governed request and is the top accountability layer for truthful delivery.
- **DEV** carries out governed development execution under CTO governance and returns truthful results or truthful pushback.

At a high level:
- **CEO** governs direction
- **CTO** governs delivery
- **DEV** executes governed development work

Lower-layer governed ingredients may sit inside CTO and DEV assemblies, but they do not replace those top-level entity boundaries.

---

## Relationship Summary

The intended top-level relationship is:

- the **CEO** governs direction
- the **CTO** governs delivery
- **DEV** performs governed development execution under CTO governance

This is a governing-entity model, not yet a workflow diagram.

That means this draft intentionally does not yet define:
- the exact route order inside DEV
- which workflows are linear versus branching
- which boxes assemble into each role or route
- how trust attaches to the later workflow graph

---

## What This Structure Must Make True

This top-level structure exists to make these Phase 1 truths possible:

- the CEO can stay at vision, priorities, and approval level
- the CTO can shape, govern, and certify truthfully upward
- DEV can execute under governance without leaking hidden burden upward
- governance truth remains explicit rather than hidden in ad hoc reasoning
- later workflows and box assemblies can be derived from a stable top-level frame

---

## What This Draft Deliberately Leaves For Later

This draft deliberately leaves these later questions open:

- review and later freeze-read of the DEV role draft at the next artifact level
- the workflow model
- the component inventory derived from the workflows
- the allowed connection model between components
- the full trust model and its mechanics
- the exact final promoted filename and final freeze shape of this document

Those should be resolved in later passes or at freeze time, not by widening this document prematurely.

---

## Current Draft Summary

ADF v2 Phase 1 uses a thin top-level governing structure with 3 entities: CEO, CTO, and DEV. CTO and DEV are top-level entities assembled from boxed components, while lower-level governed ingredients such as scripts, agents, durable state, and approved shared substrate remain below that ontology layer rather than standing as peer top-level entities.
