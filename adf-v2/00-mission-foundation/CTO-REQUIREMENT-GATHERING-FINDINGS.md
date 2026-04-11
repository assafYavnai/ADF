# ADF v2 — CTO Requirement-Gathering Findings

Status: reusable baseline derived from a real v2 mission-foundation requirement-gathering session  
Purpose: capture the high-level method that worked during this session so future CTO requirement gathering can reuse it instead of starting from scratch

---

## What This Document Is

This document is not a mission statement, not a specification, and not an implementation plan.

It is a distilled finding from a successful requirement-gathering session.
Its purpose is to preserve the **method** that worked well enough to reuse as a baseline for future CTO-led requirement definition.

---

## Core Finding

A good CTO requirement-gathering process should not start from a solution and should not assume every request is a pain point.

It should start from a **driver**.

A driver is the reason the work may matter.
A driver can be:

- a pain or problem to solve
- a missing capability
- a new opportunity
- a quality gap
- a scale bottleneck
- an architecture weakness
- a risk or compliance need
- a product or strategy shift

The process then determines what kind of change is actually needed.

---

## Reusable Baseline

### 1. Start from the driver

Clarify what is triggering the discussion.
Do not jump into architecture or implementation yet.

Questions to answer:
- What is the driver?
- Why does it matter now?
- What kind of change might it require?

### 2. Classify the driver

Determine whether the driver is mainly about:
- pain reduction
- missing capability
- risk reduction
- quality improvement
- scale readiness
- strategic leverage

This prevents the process from incorrectly framing every discussion as a defect fix.

### 3. Define what must become true

Before discussing implementation, define the outcome in terms of truth.

Questions to answer:
- What must become true if this succeeds?
- What must stop being true?
- What would success look like at a high level?

### 4. Separate the abstraction levels

Requirement gathering becomes confused when mission, scope, specification, and plan are mixed together.

Keep them separate:
- **mission** — why this exists
- **scope** — what must be produced in this phase
- **spec** — what must be defined in detail
- **plan** — in what order it will be built

### 5. Freeze the document purpose before the content

Before defining the requirement itself, decide:
- what document is being written
- what level it belongs to
- what goes into it
- what does not belong there

This prevents one document from becoming a mission, architecture spec, plan, and backlog all at once.

### 6. Work one decision at a time

For each topic:
- ask one focused question
- propose wording
- discuss it
- freeze it
- record it
- only then move to the next topic

This is one of the strongest anti-drift mechanisms.

### 7. Look for the reusable core

Do not stop at visible functionality.

Ask:
- What is the real IP here?
- What survives a rewrite?
- What is scaffolding versus implementation?

This often reveals that the real value is the model, structure, contracts, or workflows rather than the current code.

### 8. Prefer principles over closed lists

When possible, define:
- universal operating principles
- shared models
- base structures

before defining long enumerations of cases.

Lists become stale quickly.
Principles and shared models age better.

### 9. Record frozen decisions durably

Do not rely on chat memory or session continuity.

Requirement gathering is only reusable if decisions are written down and can be resumed by a new agent later.

### 10. End with explicit open gaps

When something remains unresolved, name it clearly.

Do not pretend a requirement set is complete when important definitions are still missing.
This keeps the next step clean and reduces fake closure.

### 11. Hold context through a layered CTO frame

CTO requirement gathering should not rely on loose memory.
It should maintain a stable context model while the discussion moves.

The model is:

- **Layer 0 — role and rules**: the governing frame CTO must obey while working
- **Layer 1 — system context**: the full system graph and cross-system relationships
- **Layer 2 — task context**: the current task subgraph being shaped now
- **Layer 3 — issue stack**: the temporary FILO issue path used while diving into a local question or blocker

This means:

- CTO does not answer only from the deepest active issue
- CTO keeps the governing role/rules above the context layers
- CTO keeps the current task tied to the wider system
- CTO may dive into a local issue, but the issue stack does not replace the task or system frame

### 12. Treat the current task as a focused subgraph of the system

The current task is not an isolated note.
It is the active slice of the wider system context.

That means the task should always be understood in relation to:

- the wider mission and operating rules
- the related documents and artifacts
- the dependencies it may affect
- the pushbacks it may require before implementation starts

This prevents narrow task wording from hiding wider system impact.

### 13. Use the issue stack only for temporary dives

Layer 3 is a working stack, not the truth model for the whole system.

Use it for:

- local clarifications
- side issues
- blockers
- proof questions
- examples used to resolve a point

When the issue is resolved and popped, CTO should immediately ask:

- does this change the current task?
- does this change the wider system rules or model?

This is how a local discussion turns into governed learning instead of drift.

---

## Why This Matters For ADF v2

ADF v2 is intended to define a new foundation rather than continue patching old assumptions.
That means requirement gathering is part of the IP of the system.

If the requirement-gathering process is weak:
- mission and scope get mixed
- architecture and implementation get mixed
- documents become overloaded
- decisions drift
- the next agent has to rediscover intent from scratch

If the requirement-gathering process is strong:
- the driver is clear
- the abstraction level is clear
- decisions are frozen incrementally
- the resulting docs are easier to trust
- implementation becomes much easier because the system definition is clearer
- context is held consistently even when the discussion dives into temporary local issues

---

## One-Sentence Baseline

A good CTO requirement-gathering process starts from a driver, classifies what kind of change is needed, defines what must become true, keeps abstraction levels separate, holds context through role/rules plus system-task-issue layers, and freezes one decision at a time into durable artifacts.
