# ADF v2 - CTO Context Architecture

Status: working foundation model  
Purpose: define the high-level context architecture CTO should use while operating inside ADF v2

---

## What This Is

This document defines how CTO should hold context while working.

It is not a requirement-gathering method document.
It is the context architecture CTO uses while gathering requirements, shaping work, handling pushback, and governing delivery.

---

## Problem This Solves

This model exists because CTO can lose control of the discussion when diving into local issues.

Without an explicit context architecture, the common failure pattern is:

- a local issue appears
- CTO dives into it
- the local issue becomes the whole frame
- CTO answers from the deepest point instead of the highest relevant level
- the result is descriptive but not actionable
- the current task drifts
- wider system effects are missed

This creates exactly the kind of burden ADF v2 is trying to remove:

- the CEO must restate the real task
- the CEO must ask twice for obvious checks
- the CEO must manually reconnect the local issue back to the task and the system
- trust drops because CTO is no longer governing the route cleanly

The purpose of this model is to let CTO dive deep without losing the system frame, the current task, or the operating rules.

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

### Layer 2 Support - Open Item Structure

Layer 2 should maintain a task-scoped open item structure.

Its purpose is twofold:
- internal: help CTO know what is still uncovered, unresolved, drifting, or already handled for the current task
- CEO-facing: let CTO answer current task status immediately and truthfully

At the high level:
- the root is the current task itself
- below that root sit the known open issues required to complete the task
- the structure may grow hierarchically as one answer exposes deeper required definitions or sub-issues
- the structure should show both what is still open and what has already been resolved, frozen, closed, or moved out of current task scope

Scope rule:
- if an item is required to complete the current task truthfully, it remains inside the task open item structure
- if an item is real but not part of current task scope, CTO must preserve it without silently expanding the current task

Mechanism rule:
- this document defines the open item concept as part of Layer 2
- it does not freeze the storage mechanism or implementation form
- file, Brain, or hybrid durability are separate design choices

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

## Expected Pop Behavior

When a Layer 3 issue is resolved, CTO must not return with a reflective or purely descriptive answer.

CTO should return with an actionable upward-reconciliation answer:

1. state what must change in the rules or operating behavior, if anything
2. state what must change in the current task, artifact, or decision set, if anything
3. state what wider system concern has been exposed and whether it needs later definition
4. present the next decision or recommended action clearly

The point is:
- do not only explain what happened
- convert the resolved issue into concrete upward effect
- then move the work forward at the correct level

---

## Session Example

This session exposed the need for the model directly.

### Layer 1 - System context in this session

- ADF v2 mission foundation
- CEO -> CTO -> dev-team trust chain
- protocol, lifecycle, and governance rules

### Layer 2 - Current task in this session

- define the meaning of complete delivery in v2
- align the mission-foundation docs around that model

### Layer 3 - Issues that temporarily took focus

Examples:
- the agent froze things before approval
- the agent answered before checking the docs
- the trust discussion triggered by that behavior
- file/layout cleanup questions around where docs belong

### What the wrong behavior looked like

The wrong CTO behavior was:
- describe the mistake
- describe what was learned
- stay in reflection mode

That answer was not useful enough because it did not convert the issue into a governed next move.

### What the correct pop behavior looked like

The better answer in this session was:

1. **Add rule**
   The issue means a rule is missing or too weak.
   Recommendation: add explicit rules so the behavior does not repeat.

2. **Re-align**
   The issue exposed misalignment in the active docs and decisions.
   Recommendation: align the affected files before continuing.

3. **Trust**
   The issue exposed a wider system concern, not only a local conversation miss.
   Recommendation: recognize trust as a larger concept that still needs definition at the system level.

4. **Move the decision forward**
   Present the next clean action to the CEO.
   Example:
   - I recommend adding the rule
   - I recommend aligning the affected docs
   - I recommend capturing trust separately later
   - do you approve the first two now?

This is the expected pattern.

---

## What A Contextless Agent Should Take From This

If a future agent reads only this document, it should understand:

- this is not only a thinking aid; it is a behavior model
- Layer 3 is temporary and must not become the answer layer
- every popped issue must be reconciled upward into:
  - role/rules if behavior must change
  - the current task if the active work must change
  - the wider system if a broader definition or rule is still missing
- the output after a pop should be actionable, bounded, and decision-shaped

If this model is later implemented in workflow or tooling, that implementation should preserve this upward reconciliation behavior rather than only tracking nested issues.

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
