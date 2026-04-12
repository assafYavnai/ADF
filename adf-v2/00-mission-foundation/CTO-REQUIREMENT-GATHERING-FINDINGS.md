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

Just as important:
- the CEO is deciding high-level system behavior, contracts, boundaries, and governing intent
- CTO's job is to help define those high-level objects clearly and completely
- CTO should then derive the lower-level artifacts from that frozen high-level truth instead of asking the CEO to design the lower layers directly

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

This step is about the governing object the CEO is actually deciding:
- a behavior rule
- a boundary definition
- a contract capability
- a system guarantee

It is not yet the step for asking the CEO to design the lower-level artifact set.

### 4. Separate the abstraction levels

Requirement gathering becomes confused when mission, scope, specification, and plan are mixed together.

Keep them separate:
- **mission** — why this exists
- **scope** — what must be produced in this phase
- **spec** — what must be defined in detail
- **plan** — in what order it will be built

### 5. Stay in the requirements layer

The CTO should keep the CEO discussion in the requirements layer.

That means:
- do not drift upward into abstract philosophy when a governing object should be frozen
- do not drift downward into schema, repo layout, workflow policy, or implementation detail before the governing object is frozen

The target layer here is:
- behavior
- contracts
- boundaries
- governing intent

### 6. Freeze the document purpose before the content

One more separation matters before moving on:
- **high-level governing objects** are what the CEO should decide
- **lower-level derived artifacts** are what CTO should generate from those decisions

If CTO asks the CEO to design the lower layers directly, the abstraction boundary is already failing.

Before defining the requirement itself, decide:
- what document is being written
- what level it belongs to
- what goes into it
- what does not belong there

This prevents one document from becoming a mission, architecture spec, plan, and backlog all at once.
It also prevents CTO from asking the CEO to solve decomposition questions that should be resolved later by the derived lower-level docs.

### 7. Work one decision at a time

For each topic:
- ask one focused question
- propose wording
- discuss it
- freeze it
- record it
- only then move to the next topic

This is one of the strongest anti-drift mechanisms.

The decision should stay at the highest level that still governs the lower layers cleanly.
Once that level is clear enough, CTO should derive the downstream artifacts instead of escalating lower-layer design questions unnecessarily.

### 8. Use executive batch mode for smaller decisions

When the remaining decisions are small or low-level rather than major architectural gaps:
- batch them in groups of up to 5 items
- give a recommendation for each item
- wait for explicit approval or discussion

No explicit approval means discussion, not freeze.

### 9. Look for the reusable core

Do not stop at visible functionality.

Ask:
- What is the real IP here?
- What survives a rewrite?
- What is scaffolding versus implementation?

This often reveals that the real value is the model, structure, contracts, or workflows rather than the current code.

### 10. Prefer principles over closed lists

When possible, define:
- universal operating principles
- shared models
- base structures

before defining long enumerations of cases.

Lists become stale quickly.
Principles and shared models age better.

This matters because high-level principles, guarantees, and contract capabilities are exactly the objects the CEO should be deciding.
Lower-level field sets, doc expansions, and implementation-facing artifacts should usually be derived afterward by CTO.

### 11. Record frozen decisions durably

Do not rely on chat memory or session continuity.

Requirement gathering is only reusable if decisions are written down and can be resumed by a new agent later.

### 12. Use open items as the task lighthouse

Open items are not only parking.

They are the CTO's lighthouse for:
- what is still open in the current task
- what belongs later and must not be lost
- what answer should be given immediately when the CEO asks for status

### 13. End with explicit open gaps

When something remains unresolved, name it clearly.

Do not pretend a requirement set is complete when important definitions are still missing.
This keeps the next step clean and reduces fake closure.

### 14. Run a freeze-read before promotion

Before asking for freeze or promotion, the CTO should run a freeze-read against:
- already frozen upstream truth
- aligned sibling docs
- the current artifact itself

That pass should check:
- promise carry-through
- abstraction-level purity
- normative-language purity
- sibling-doc alignment
- stale wording

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
- lower-level artifacts can be generated from frozen high-level objects instead of repeatedly being redesigned upward in chat

---

## One-Sentence Baseline

A good CTO requirement-gathering process starts from a driver, keeps the CEO in the requirements layer, helps the CEO freeze the right high-level governing objects, keeps lower-layer derivation below that boundary, uses batch mode when needed, preserves open items as the task lighthouse, and records one decision at a time into durable artifacts.
