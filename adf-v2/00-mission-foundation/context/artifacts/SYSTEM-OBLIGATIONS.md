# ADF v2 - System Obligations

Status: first-draft working artifact  
Scope: `adf-v2/00-mission-foundation/`  
Purpose: define the universal operational obligations the ADF v2 system must satisfy so the frozen mission and delivery promises remain true in practice

---

## What This Document Is

This document is a first draft.

It is not yet a frozen foundation rule.
It is the current working draft for the mandatory system obligations that must hold across governed components and governed routes in ADF v2 Phase 1.

Its job is to define what the system must guarantee operationally so that:
- the mission promise remains true
- delivery completion can be truthful
- lower-level component and workflow docs can inherit one consistent obligation layer

---

## Document Boundary

This document defines universal operational obligations.

It does define:
- mandatory system guarantees
- mandatory governed behavior
- the obligation classes every governed component or governed route must satisfy

It does not define:
- mission meaning
- completion meaning
- the full trust model
- the full box schema or reporting schema
- workflow topology
- role topology

Those remain split across:
- `MISSION-STATEMENT.md`
- `DELIVERY-COMPLETION-DEFINITION.md`
- `context/artifacts/TRUST-MODEL.md`
- later `BOXED-COMPONENT-MODEL.md`
- later `ROLE-MODEL.md`
- later `WORKFLOW-MODEL.md`

This means:
- this document defines what must be guaranteed
- later box and workflow docs define how those guarantees are structurally carried by components and routes

---

## Upstream Truth This Document Enforces

This draft does not invent a new mission.
It operationalizes already frozen or already promoted truth from:

- `MISSION-STATEMENT.md`
- `DELIVERY-COMPLETION-DEFINITION.md`
- frozen decisions under `context/decisions/`

In particular, this draft must preserve:
- contract-based JSON interaction
- truthful status and truthful terminal outcomes
- queryability and resumability
- cleanliness and environment isolation
- truthful upward certification from governed system truth
- containment of internal problems below the CEO boundary
- fire-and-forget delivery without leaked burden above governed execution

---

## Core Obligation Model

ADF v2 should treat obligations as mandatory guarantees, not as aspirations.

At high level:
- if an obligation is required here, the system must satisfy it
- if the system cannot satisfy it truthfully, it must not pretend completion
- failure to meet an obligation must surface as governed truth, not as hidden cleanup

The universal obligation set below is the current draft baseline.

---

## 1. Contract Obligations

Every governed component boundary must operate through explicit contracts.

At high level, that means:
- the authoritative input package is JSON
- the authoritative output package is JSON
- the relevant fields for that boundary must be defined
- free-form prose may accompany a package, but it must not replace the authoritative payload

The system must not rely on hidden interpretation at handoff boundaries.

This includes:
- normal success packages
- blocked packages
- resolve packages
- later resume or recovery packages where needed

---

## 2. Status Truth Obligations

The system must preserve truthful status.

At high level, that means:
- status must reflect governed reality, not hope, memory, or narration
- the top-level terminal outcomes are `complete` and `blocked`
- `blocked` may represent external waiting or an internally detected failure to complete truthfully from the current state
- a route or component must not present nominal success when the real state is still incomplete, broken, or dependent on hidden repair

For `complete`, the system must not permit upward certification unless the actual completion conditions are true.

---

## 3. Audit And Durable Truth Obligations

The system must preserve durable operational truth.

At high level, that means:
- important state must be recorded in governed durable state
- the route must have enough audit trail to support truthful inspection and recovery
- status history and error history must not depend on personal memory
- the system must preserve checkpoint truth strongly enough that a later agent or process can resume without reconstruction from chat

This obligation is the operational counterpart of:
- auditability
- checkpoint truth
- durable state continuity

---

## 4. KPI Visibility Obligations

The system must preserve KPI visibility for governed execution.

At high level, that means:
- every governed component or governed route must produce enough measurable operational truth to support KPI visibility
- KPI visibility must come from governed evidence, not retrospective storytelling
- KPI visibility must remain consistent even when implementations vary

This draft does not yet define the shared KPI schema.
That later structural shape should be defined in `BOXED-COMPONENT-MODEL.md`.

---

## 5. Queryability, Checkpoint, And Recovery Obligations

The system must preserve queryability and safe continuity during execution.

At high level, that means:
- in-progress state must remain queryable
- non-terminal work must preserve governed checkpoints strong enough for safe continuation
- recoverable interruptions must be resumable from governed state
- interruption, refresh, transient breakage, or malformed intermediate state must not force hidden manual route repair above governed execution

For ended states that are not resumed in place, the system must still return enough structured truth to drive the next safe step.

---

## 6. Blocked And Resolve-Package Obligations

The system must preserve truthful non-complete outcomes.

At high level, that means:
- when completion is not truthful, the system must return `blocked` rather than pretending success
- blocked outputs must carry the relevant reason for that boundary
- when the boundary supports continuation after correction, the blocked output should carry a resolve package or equivalent structured next-step truth
- not every component must support the same blocked reasons, but every supported blocked reason must be truthful and operationally useful

This obligation preserves fire-and-forget by turning failure or waiting into governed outputs instead of hidden burden.

---

## 7. Clean Execution Obligations

The system must preserve execution cleanliness and environment isolation.

At high level, that means:
- implementation activity must not pollute the CEO's normal working environment
- implementation activity must not leave hidden cleanup for the CTO after upward declaration
- local `main` must stay clean
- implementation should happen in isolated execution contexts where required by the model
- completion is not truthful while the result is still stranded outside the production tree

This obligation covers:
- workspace cleanliness
- git cleanliness
- production-tree integrity
- safe parallel operation

---

## 8. Verification And Certification Obligations

The system must preserve truthful upward certification.

At high level, that means:
- upward `complete` certification must rest on governed system truth
- required human testing must be completed before upward `complete` certification when that boundary requires it
- governed verification must exist before upward certification
- lower trust may require deeper governed verification
- the initial implementation stage should assume governed verification is required by default

The system must not allow certification to depend on belief, manual reconstruction after the fact, or person-specific rescue knowledge.

---

## 9. Trust-Handling Obligations

The system must preserve the operational behavior required by trust-sensitive delivery, even before the full trust model is frozen.

At high level, that means:
- internal issues must be contained before completion is declared upward
- unresolved trust failures must block truthful completion
- the system must preserve enough governed evidence to support trust-sensitive verification and certification
- trust degradation must be able to affect operational behavior later without redefining the whole system contract

This draft keeps trust handling high level.
The broader trust scoring, thresholds, and governance mechanics still belong in `context/artifacts/TRUST-MODEL.md`.

---

## 10. Lower-Layer Derivation Obligations

The system definition must support lower-layer derivation without pushing decomposition back onto the CEO.

At high level, that means:
- the universal obligations should be clear enough that later box, role, and workflow docs can inherit them
- later docs should refine structure and specialization without redefining these guarantees
- if a later doc specializes an obligation, it must remain compatible with the universal obligation rather than silently weakening it

This is how the foundation prevents implementation drift while keeping the CEO at the correct abstraction level.

---

## Relationship To Later Documents

This draft should later connect to:

- `BOXED-COMPONENT-MODEL.md`
  because the shared box structure should expose how obligations appear in inputs, outputs, reporting, KPI surfaces, and checkpoint/report shapes

- `ROLE-MODEL.md`
  because role boundaries determine who is accountable for satisfying, checking, or acting on obligations

- `WORKFLOW-MODEL.md`
  because workflow topology determines how obligations behave across routes, retries, merge, pushback, and handoff paths

- `context/artifacts/TRUST-MODEL.md`
  because trust handling needs a fuller frozen model later

---

## Current Draft Summary

ADF v2 should treat system obligations as universal mandatory guarantees over governed components and governed routes: truthful contracts, truthful status, durable audit truth, KPI visibility, queryability and recovery, truthful blocked outputs, clean execution, and governed verification strong enough to support truthful upward completion.
