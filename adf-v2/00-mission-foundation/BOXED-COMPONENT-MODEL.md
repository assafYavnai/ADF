# ADF v2 - Boxed Component Model

Status: first-draft working artifact  
Scope: `adf-v2/00-mission-foundation/`  
Purpose: define the shared structural model that all governed boxed components in ADF v2 must inherit

---

## What This Document Is

This document is a first draft.

It is not yet a frozen foundation rule.
It is the current working draft for the common structural shape every governed box must follow in ADF v2 Phase 1.

Its job is to define:
- what a box is structurally
- what common surfaces every box must expose
- what common layout every box must inherit

Its job is not to define:
- the full workflow topology
- the full top-level governing-entity model
- the full trust model
- exact JSON schemas
- exact KPI field names
- exact storage backend choices
- physical repository or filesystem layout
- source-control evolution policy
- implementation workflow policy

---

## Aligned Foundation Context This Draft Carries

This draft does not invent a new system promise.
It carries already approved mission-foundation truth from aligned foundation sources:

- `MISSION-STATEMENT.md`
- `DELIVERY-COMPLETION-DEFINITION.md`
- `context/artifacts/SYSTEM-OBLIGATIONS.md`
- frozen decisions under `context/decisions/`

`SYSTEM-OBLIGATIONS.md` is not an implementation-upstream dependency of this draft.
The two drafts must be treated as aligned sibling foundation documents:
- `SYSTEM-OBLIGATIONS.md` defines the universal guarantee layer
- `BOXED-COMPONENT-MODEL.md` defines the logical common box structure that carries those guarantees

In particular, this document gives structural shape to the already approved direction that:
- ADF v2 delivers through boxed components
- components communicate through authoritative JSON contracts
- boxes preserve package-fidelity truth rather than allowing silent semantic drift
- components are self-contained, standalone-testable, and workflow-agnostic
- components must preserve truthful status, KPI truth, and durable audit truth

---

## Core Structural Definition

A `box` must be the smallest governed component unit that can be:
- invoked on its own
- inspected on its own
- retried or re-invoked safely on its own
- tested on its own
- certified from governed truth on its own

Roles and workflows must be built by assembling boxes.
They must not replace the box as the basic governed structural unit.

Boxes are the core governed execution units.
Approved shared system tools or substrate may exist as a separate governed class and are not forced into the box type merely because boxes depend on them.

---

## Frozen Structural Inputs Carried By This Draft

The current frozen structural inputs this draft carries are:

1. a box is the common governed component unit all later system parts inherit from
2. every box exposes the same high-level structural surfaces:
   - input package
   - output package
   - status surface
   - blocked reason and resolve-package surface where applicable
   - approved-package fidelity and scope-preservation truth
   - audit and checkpoint surface
   - KPI and reporting surface
3. every box uses one universal outer JSON envelope with standard fields, and box-specific content lives inside a nested payload section
4. the universal outer envelope must provide standard field families for identity, status, blocked, payload, scope fidelity, KPI, audit refs, checkpoint refs, and contract version
5. `blocked` is a universal envelope field family for all boxes
6. `resolve package` is universal-optional: it appears only for boxes that support governed continuation after blocking
7. every box output includes KPI truth for the current invocation
8. every box preserves durable long-term audit evidence for later inspection
9. every box follows a shared logical structural layout with standard governed areas for contracts, runtime state, audit history, tests, and internal artifacts
10. every box is self-contained inside its own governed logical boundary
11. outward interaction happens only through authoritative contracts plus approved shared system tools
12. every box is executable and testable as a standalone unit while remaining reusable inside larger workflows

These frozen inputs are the working reading guide for the sections below.

---

## 1. Structural Surfaces

Every box must expose the same high-level surfaces, even when the internal implementation differs.

At minimum, each box must have structural space for:
- authoritative input JSON
- authoritative output JSON
- truthful status
- blocked reason and resolve truth where that boundary supports continuation
- approved-package fidelity and scope-preservation truth
- governed audit and checkpoint truth
- governed verification and certification evidence or references
- current-invocation KPI truth
- references to the longer-lived audit trail when needed

This document freezes the existence of these surfaces, not their final schema details.

---

## 2. Universal Contract Envelope

Every box must use one shared outer JSON envelope.

Current frozen direction:
- the outer envelope is universal across boxes
- standard cross-box fields live in that envelope
- box-specific content lives inside a nested payload section
- the envelope must provide standard field families for:
  - identity
  - status
  - blocked
  - payload
  - scope fidelity
  - KPI
  - audit refs
  - checkpoint refs
  - contract version
- `blocked` is a universal field family for every box
- `resolve package` is universal-optional and appears only when that box supports governed continuation after blocking

This means:
- contract consistency must come from the common outer shape
- specialization must happen inside the nested payload, not by reinventing the whole top-level contract per box
- status, blocked reason, package-fidelity truth, KPI truth, audit references, checkpoint references, and verification or certification references must appear in a consistent governed location across the system
- all boxes can truthfully report blocked state in the same governed outer shape
- only continuation-capable boxes are required to return resolve-package content

This document freezes the structural rule, not the final field list.

---

## 3. Output And Current-Invocation KPI Truth

Every box output must include KPI data for the current invocation.

That means the output package must carry enough KPI truth to answer, at minimum:
- what work was performed in this invocation
- how much effort or elapsed time it took
- what cost was incurred where applicable
- what result state was reached

The output does not need to carry the full long-term history inline.
It must carry the current invocation truth plus the governed references needed to inspect the fuller audit record.

---

## 4. Durable Audit And Change History

Every box must preserve durable long-term audit evidence.

At high level, that means a box must retain governed evidence such as:
- KPI history over time
- issues found
- status and error history
- governed internal artifacts needed for later audit
- checkpoint truth needed to inspect what happened and why
- governed verification and certification evidence or references needed to support truthful upward reliance

The rule here is durable governed audit evidence, not uncontrolled retention of every transient scratch artifact forever.

---

## 5. Shared Structural Layout

Every box must inherit a shared logical structural layout.

The purpose of that layout is:
- consistent inspection
- consistent execution
- consistent testing
- consistent audit access
- consistent automation and tooling

Current frozen direction:
- every box inherits one governed shared layout
- that logical layout must provide standard areas for:
  - contracts
  - runtime state
  - audit history
  - tests
  - internal artifacts

This document freezes that a common logical layout is required and what high-level areas it must contain.
It does not freeze physical folder names, repository layout, or storage mechanics.

---

## 6. Boundary Rule

A box must be self-contained inside its own governed logical boundary.

A box may use internal implementation detail freely within that boundary.
But outward interaction must happen only through:
- authoritative JSON contracts
- approved shared system tools or governed substrate interfaces

This prevents hidden neighbor-specific coupling, hidden manual conventions, and workflow-specific assumptions from becoming part of the box contract.
Physical repository layout belongs elsewhere.

---

## 7. Standalone Capability

Every box must be runnable, inspectable, and testable as a standalone governed unit.

This is what allows a box to function as a reusable building block rather than only as one hard-wired step in one chain.

Workflow reuse must come from composing boxes, not from weakening the box boundary.

---

## 8. Relationship To Trust

This document must reserve structural space for trust-relevant reporting without freezing the full trust model here.

At high level, that means:
- the box shape must support upward reporting
- the box shape must support audit truth
- the box shape must support governed verification truth
- the box shape must support certification truth
- the box shape must support later trust attachment

The full trust scoring, thresholds, and aggregation rules remain outside this document.

---

## Relationship To Other Documents

This draft aligns directly with:

- `context/artifacts/SYSTEM-OBLIGATIONS.md`
  because that aligned sibling foundation doc defines the universal guarantees that the box shape must carry logically

- `context/artifacts/TRUST-MODEL.md`
  because trust later needs reporting and audit surfaces to attach to

- later thin top-level governing-entity document
  because the top-level governing entities must later be expressed as assemblies built from governed boxes

- later `WORKFLOW-MODEL.md`
  because workflows must compose boxes without redefining the box contract

---

## Current Draft Summary

ADF v2 must treat the box as the common governed component unit: self-contained, standalone-capable, logically consistent, contract-bound outwardly, and equipped with standard input, output, status, scope-fidelity, KPI, checkpoint, verification, certification, and audit surfaces so larger roles and workflows can be assembled without hidden coupling.
