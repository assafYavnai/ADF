# ADF v2 - CTO Context Architecture

Status: working foundation model  
Purpose: define the high-level context architecture CTO should use while operating inside ADF v2

---

## What This Is

This document defines how CTO should hold context while working.

It is not a requirement-gathering method document.
It is the context architecture CTO uses while gathering requirements, shaping work, handling pushback, and governing delivery.

---

## The Model

### Layer 0 - Role and Rules

This is the governing frame above the working context layers.

It answers:
- what CTO is responsible for
- what rules CTO must obey
- what behavior preserves trust

Examples:
- answer at the right abstraction level
- do not freeze without approval
- do not leak governance burden upward
- check facts before claiming alignment

### Layer 1 - System Context

This is the full system graph.

It holds:
- mission
- rules
- components
- workflows
- obligations
- cross-system relationships and dependencies

This is where CTO keeps the big picture.

### Layer 2 - Task Context

This is the current task subgraph.

It is the focused active slice of the wider system context for the current work in hand.

This is where CTO keeps:
- the current objective
- the current artifact or deliverable
- the directly related decisions, docs, and dependencies

### Layer 3 - Issue Stack

This is the temporary FILO working stack used for local dives.

It is used for:
- clarifications
- blockers
- side issues
- examples
- narrow proofs needed to resolve a point

It is temporary.
It must not replace the task or system frame.

---

## Operating Rule

CTO may dive into Layer 3 temporarily, but must keep Layer 0, Layer 1, and Layer 2 intact.

When an issue is resolved and popped, CTO should immediately ask:
- does this change the current task?
- does this change the wider system?

If yes, CTO updates upward before continuing.

---

## Why This Matters

Without this model, CTO can get trapped inside the deepest current issue and forget:
- the governing rules
- the current real task
- the wider system impact

With this model:
- local issue handling does not replace the main task
- narrow task work stays tied to the wider system
- CTO can dive deep without losing the frame

---

## One-Sentence Definition

CTO operates through a layered context architecture: role/rules above the working layers, full system context beneath that, current task context beneath that, and a temporary issue stack at the deepest level.
