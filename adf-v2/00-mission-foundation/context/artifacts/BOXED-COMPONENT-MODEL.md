# ADF v2 - Boxed Component Model

Status: first-draft working artifact  
Scope: `adf-v2/00-mission-foundation/`  
Purpose: define the shared structural model that all governed boxed components in ADF v2 should inherit

---

## What This Document Is

This document is a first draft.

It is not yet a frozen foundation rule.
It is the current working draft for the common structural shape every governed box should follow in ADF v2 Phase 1.

Its job is to define:
- what a box is structurally
- what common surfaces every box must expose
- what common layout every box must inherit

Its job is not to define:
- the full workflow topology
- the full role model
- the full trust model
- exact JSON schemas
- exact KPI field names
- exact storage backend choices

---

## Upstream Truth This Document Carries

This draft does not invent a new system promise.
It carries already approved mission-foundation truth from:

- `MISSION-STATEMENT.md`
- `DELIVERY-COMPLETION-DEFINITION.md`
- `context/artifacts/SYSTEM-OBLIGATIONS.md`
- frozen decisions under `context/decisions/`

In particular, this document gives structural shape to the already approved direction that:
- ADF v2 delivers through boxed components
- components communicate through authoritative JSON contracts
- components are self-contained, standalone-testable, and workflow-agnostic
- components must preserve truthful status, KPI truth, and durable audit truth

---

## Core Structural Definition

A `box` should be the smallest governed component unit that can be:
- invoked on its own
- inspected on its own
- retried or re-invoked safely on its own
- tested on its own
- certified from governed truth on its own

Roles and workflows should be built by assembling boxes.
They should not replace the box as the basic governed structural unit.

---

## Approved Structural Baseline

The current approved structural baseline for boxes is:

1. a box is the common governed component unit all later system parts inherit from
2. every box exposes the same high-level structural surfaces:
   - input package
   - output package
   - status surface
   - blocked reason and resolve-package surface where applicable
   - audit and checkpoint surface
   - KPI and reporting surface
3. every box uses one universal outer JSON envelope with standard fields, and box-specific content lives inside a nested payload section
4. every box output includes KPI truth for the current invocation
5. every box preserves durable long-term audit evidence and change history for later inspection
6. every box follows a shared structural layout so components look and behave consistently at the governance level
7. every box is self-contained inside its own governed folder or module boundary
8. outward interaction happens only through authoritative contracts plus approved shared system tools
9. every box is executable and testable as a standalone unit while remaining reusable inside larger workflows

This approved baseline is the working reading guide for the sections below.

---

## 1. Structural Surfaces

Every box should expose the same high-level surfaces, even when the internal implementation differs.

At minimum, each box should have structural space for:
- authoritative input JSON
- authoritative output JSON
- truthful status
- blocked reason and resolve truth where that boundary supports continuation
- governed audit and checkpoint truth
- current-invocation KPI truth
- references to the longer-lived audit trail when needed

This document freezes the existence of these surfaces, not their final schema details.

---

## 2. Universal Contract Envelope

Every box should use one shared outer JSON envelope.

Recommendation now approved:
- the outer envelope is universal across boxes
- standard cross-box fields live in that envelope
- box-specific content lives inside a nested payload section

This means:
- contract consistency should come from the common outer shape
- specialization should happen inside the nested payload, not by reinventing the whole top-level contract per box
- status, blocked reason, KPI truth, audit references, and checkpoint references should appear in a consistent governed location across the system

This document freezes the structural rule, not the final field list.

---

## 3. Output And Current-Invocation KPI Truth

Every box output should include KPI data for the current invocation.

That means the output package should carry enough KPI truth to answer, at minimum:
- what work was performed in this invocation
- how much effort or elapsed time it took
- what cost was incurred where applicable
- what result state was reached

The output does not need to carry the full long-term history inline.
It should carry the current invocation truth plus the governed references needed to inspect the fuller audit record.

---

## 4. Durable Audit And Change History

Every box should preserve durable long-term audit evidence.

At high level, that means a box should retain governed evidence such as:
- KPI history over time
- issues found
- status and error history
- commits and change trail for box evolution over time
- governed internal artifacts needed for later audit
- checkpoint truth needed to inspect what happened and why

The rule here is durable governed audit evidence, not uncontrolled retention of every transient scratch artifact forever.

---

## 5. Shared Structural Layout

Every box should inherit a shared structural layout.

The purpose of that layout is:
- consistent inspection
- consistent execution
- consistent testing
- consistent audit access
- consistent automation and tooling

This document should freeze that a common layout is required.
The exact folder names, file names, and storage arrangement can be specialized later if needed, as long as the shared governance shape remains consistent.

---

## 6. Boundary Rule

A box should be self-contained inside its own governed folder or module boundary.

A box may use internal implementation detail freely within that boundary.
But outward interaction should happen only through:
- authoritative JSON contracts
- approved shared system tools

This prevents hidden neighbor-specific coupling, hidden manual conventions, and workflow-specific assumptions from becoming part of the box contract.

---

## 7. Standalone Capability

Every box should be runnable, inspectable, and testable as a standalone governed unit.

This is what allows a box to function as a reusable building block rather than only as one hard-wired step in one chain.

Workflow reuse should come from composing boxes, not from weakening the box boundary.

---

## 8. Relationship To Trust

This document should reserve structural space for trust-relevant reporting without freezing the full trust model here.

At high level, that means:
- the box shape must support upward reporting
- the box shape must support audit truth
- the box shape must support certification truth
- the box shape must support later trust attachment

The full trust scoring, thresholds, and aggregation rules remain outside this document.

---

## Relationship To Other Documents

This draft connects directly to:

- `context/artifacts/SYSTEM-OBLIGATIONS.md`
  because that document defines the universal guarantees that the box shape must carry structurally

- `context/artifacts/TRUST-MODEL.md`
  because trust later needs reporting and audit surfaces to attach to

- later `ROLE-MODEL.md`
  because roles should be assemblies built from governed boxes

- later `WORKFLOW-MODEL.md`
  because workflows should compose boxes without redefining the box contract

---

## Current Draft Summary

ADF v2 should treat the box as the common governed component unit: self-contained, standalone-capable, structurally consistent, contract-bound outwardly, and equipped with standard input, output, status, KPI, checkpoint, and long-term audit surfaces so larger roles and workflows can be assembled without hidden coupling.
