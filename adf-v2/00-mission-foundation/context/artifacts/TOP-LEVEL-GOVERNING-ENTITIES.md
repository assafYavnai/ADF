# ADF v2 - Top-Level Governing Entities

Status: first-draft working artifact  
Scope: `adf-v2/00-mission-foundation/`  
Purpose: define the thin top-level governing entities and their high-level boundaries for ADF v2 Phase 1

---

## What This Document Is

This document is a first draft.

It is the current working draft for the thin top-level governing-entity definition that mission-foundation still needed after the mission, delivery, obligations, and box-model documents were shaped.

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

Those belong in later artifacts.

---

## Why This Document Exists

ADF v2 is intentionally starting thin.

The system should not restart from a broad virtual-company model.
It should first make explicit the minimum top-level governing structure the Phase 1 startup model depends on.

This draft exists to freeze that top-level structure before later work defines:
- how work moves
- what boxes are required
- how those boxes connect
- how trust behaves across the real structure

---

## Upstream Truth This Draft Carries

This draft does not invent a new role set.
It turns already approved mission-foundation direction into one thin explicit top-level-entity definition.

In particular, it carries the already established direction that ADF v2 Phase 1 is built around:
- CEO
- CTO
- Scripts
- Agents
- Durable state

It also carries the already established direction that:
- the CEO remains at vision, priorities, and approval
- the CTO is the governing layer between the CEO and execution
- scripts own governance truth, control logic, and lifecycle enforcement
- agents do reasoning-based execution rather than lifecycle ownership
- durable state preserves memory, audit, checkpoint, and truth continuity

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
3. **Scripts**
4. **Agents**
5. **Durable state**

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

The CTO is the governing layer between the CEO and the execution system.

At this level, the CTO owns:
- shaping CEO intent into a clear implementation request package
- architecture and sequencing at the high level
- admission into governed execution
- governing the lower-layer execution chain
- truthful upward certification and reporting

The CTO does not exist as a passive messenger.
The CTO is the accountability layer that makes delegation trustworthy.

The CTO boundary exists so execution problems, pushback, verification, and repair do not leak upward as CEO burden unless a real executive decision is needed.

---

## 3. Scripts

Scripts are the deterministic governance entity inside the execution system.

At this level, scripts own:
- lifecycle enforcement
- control logic
- state transitions
- deterministic route behavior
- governed context gathering and stable control-plane truth

Scripts do not own:
- open-ended reasoning
- executive intent shaping
- human-meaning judgment as a substitute for CTO

The script boundary exists so governance truth is explicit, inspectable, and repeatable rather than dependent on prompt-only discipline.

---

## 4. Agents

Agents are the reasoning-based execution entity inside the execution system.

At this level, agents own:
- bounded reasoning work
- generation, analysis, and implementation work where reasoning is required
- carrying out governed execution within the contracts and controls set above them

Agents do not own:
- lifecycle truth
- top-level governance truth
- self-certification upward to the CEO

The agent boundary exists so the system can use strong reasoning where needed without letting reasoning replace governance.

---

## 5. Durable State

Durable state is the system truth-continuity entity.

At this level, durable state owns:
- persisted memory
- audit history
- checkpoint truth
- recoverable continuity across time, interruption, and handoff

Durable state does not own:
- executive intent
- governance decisions by itself
- reasoning execution by itself

The durable-state boundary exists so the system does not depend on personal memory, hidden chat context, or manual reconstruction.

---

## High-Level Boundary Model

The top-level boundary model for Phase 1 is:

- **CEO** sits above the governed delivery system and decides what should happen at the highest level.
- **CTO** translates that intent into a governed request and is the top accountability layer for truthful delivery.
- **Scripts**, **Agents**, and **Durable state** sit inside the execution system under CTO governance, each with a different role.

At a high level:
- **Scripts** govern
- **Agents** reason and execute
- **Durable state** preserves truth over time

None of those three replaces the CTO.
None of those three should push the CEO back into internal route operation.

---

## Relationship Summary

The intended top-level relationship is:

- the **CEO** governs direction
- the **CTO** governs delivery
- **Scripts** govern deterministic execution mechanics
- **Agents** perform reasoning-based execution work
- **Durable state** preserves continuity and audit truth across the whole system

This is a governing-entity model, not yet a workflow diagram.

That means this draft intentionally does not yet define:
- the exact route order between entities
- which workflows are linear versus branching
- which boxes assemble into each role or route
- how trust attaches to the later workflow graph

---

## What This Structure Must Make True

This top-level structure exists to make these Phase 1 truths possible:

- the CEO can stay at vision, priorities, and approval level
- the CTO can shape, govern, and certify truthfully upward
- governance truth is deterministic rather than hidden in ad hoc reasoning
- reasoning work can happen where needed without owning lifecycle truth
- system memory and audit truth survive interruption and handoff
- later workflows and box assemblies can be derived from a stable top-level frame

---

## What This Draft Deliberately Leaves For Later

This draft deliberately leaves these later questions open:

- the workflow model
- the component inventory derived from the workflows
- the allowed connection model between components
- the full trust model and its mechanics
- the exact final promoted filename and final shape of this document

Those should be resolved in later passes or at freeze time, not by widening this document prematurely.

---

## Current Draft Summary

ADF v2 Phase 1 uses a thin top-level governing structure with five entities: CEO, CTO, Scripts, Agents, and Durable state. The CEO governs direction, the CTO governs delivery, and Scripts, Agents, and Durable state form the internal execution system under CTO governance with distinct responsibilities for deterministic control, reasoning-based work, and durable truth continuity.
