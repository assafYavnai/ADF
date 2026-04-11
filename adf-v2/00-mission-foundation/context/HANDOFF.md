# ADF v2 — Mission Foundation Handoff

Status: working handoff for the next architecture/planning session  
Location purpose: layer-global handoff for restarting the effort on a thinner foundation  
Audience: next agent / architect / CEO review session

---

## Why This Document Exists

This session reached a strategic conclusion:

**ADF should start a new thin core inside the same repo under `adf-v2/`, rather than keep treating the current ADF stack as the source of truth.**

The current repo contains valuable learning, docs, patterns, and some useful substrate pieces, but it also carries too much accumulated governance patching, legacy assumptions, and competing architectural directions.

The goal of this document is to let a new chat continue from that decision without re-litigating the same questions from scratch.

For the explicit v1 pain statement and the reason v2 was forked instead of continuing to patch v1 as the main path, also read:
- `adf-v2/00-mission-foundation/V1-PAIN-POINT-AND-V2-FORK-RATIONALE.md`

---

## Decisions Already Taken

### 1. `adf-v2/` will live in the same repo

Reason:
- keep history and reference material close
- keep old ADF available for selective reuse
- avoid fragmenting truth across multiple repos too early

Constraint:
- **same repo does not mean same architecture**
- `adf-v2/` must be treated as a new architecture island
- legacy ADF is **reference only**, not source of truth for v2

### 2. Legacy ADF is not the source of truth for v2

Use old ADF for:
- ideas
- reference flows
- proven narrow utilities
- migration knowledge
- examples of what to avoid

Do not use old ADF as automatic inheritance for:
- architecture
- state model
- lifecycle model
- role model
- public surface
- governance assumptions

### 3. v2 should start thinner than the current model

The current conclusion is that the system should **not** start from a people-company org chart like:
- COO
- PM
- engineering department
- review department
- merge department

Instead, v2 should start from a thinner agentic/control-plane model.

### 4. Proposed Phase 1 operating model for v2

Core structure:
- **CEO** — vision, priorities, approval at the right abstraction level
- **CTO** — shaping, architecture, sequencing, scope decisions, PM-equivalent function for now
- **governance scripts** — deterministic control plane and lifecycle truth
- **agentic engineering lanes** — implementation/review/fix work
- **durable truth/state** — state, events, telemetry, memory references

Explicit decisions:
- **no COO as a core foundational layer in v2 Phase 1**
- **no separate PM as a core foundational layer in v2 Phase 1**
- **CTO carries the PM/TPO function initially**
- **scripts carry process discipline and governance enforcement**
- **agents do work but do not own lifecycle truth**

### 5. CEO should stay high-level from the start

This was treated as a key principle:

If the CEO gets pulled into:
- slices
- review cycles
- merge mechanics
- route repair
- queue janitor work
- artifact debugging

then ADF has already failed to provide its intended value.

Default interaction model for v2:
- **CEO speaks to CTO-facing layer only**
- CTO-facing layer speaks to governance scripts + agentic engineering
- CEO should not directly operate implementation mechanics

### 6. Architecture should be defined top-down, but implementation should begin bottom-up

Decision:
- first freeze the thin system model and interfaces
- then build the substrate/governor/state model first
- then place the CTO-facing interface on top of it

In short:
- **top-down on architecture**
- **bottom-up on implementation**

---

## High-Level Goal We Are Trying To Achieve

### Draft v2 direction

Build a thin software-building startup for the CEO:
- CTO-led shaping
- script-owned governance
- agentic engineering execution
- durable truth

This is a reframing of the current repo Phase 1 direction.

The original high-level idea is still considered valid:
- the system should let the CEO stay high-level
- the system should turn intent into reviewed implementation
- the system should preserve state and truth durably

But v2 should stop modeling itself around a premature COO/company abstraction and instead start from a cleaner software-delivery control plane.

---

## The 5-Step Plan For Starting `adf-v2/`

This was the proposed startup sequence.

## Step 1 — Freeze the v2 mission

Create a short, clear mission statement for `adf-v2/`.

Purpose:
- define what v2 is
- define what Phase 1 is
- define what Phase 1 is not
- prevent reintroducing later-company breadth too early

Output expected from Step 1:
- `adf-v2/VISION.md`
- `adf-v2/PHASE1.md`

Minimum questions Step 1 must answer:
- What is ADF v2 trying to become in Phase 1?
- What is the promise to the CEO?
- What is explicitly out of scope?
- What is the difference between old ADF framing and v2 framing?

## Step 2 — Freeze the architecture model

Define the minimum architectural structure for v2.

Purpose:
- stop architectural drift before coding
- separate human authority from script governance from agentic execution
- define the core planes cleanly

Output expected from Step 2:
- `adf-v2/ARCHITECTURE.md`

Minimum questions Step 2 must answer:
- What are the foundational roles/planes?
- What does the CEO touch?
- What does the CTO touch?
- What do scripts own?
- What do agents own?
- What does durable state own?
- Where does lifecycle truth live?

## Step 3 — Freeze migration rules from legacy ADF

Define how v2 relates to old ADF.

Purpose:
- prevent accidental legacy inheritance
- force selective reuse instead of architectural cargo culting
- keep same-repo work clean

Output expected from Step 3:
- `adf-v2/MIGRATION.md`

Minimum questions Step 3 must answer:
- What is reference-only?
- What can be selectively ported?
- What must not be inherited?
- What is the policy for copying narrow utilities?
- What is the rule for critical fixes in old ADF while v2 is being built?

## Step 4 — Build the thinnest executable core

After mission and architecture are frozen, build the smallest real system.

Purpose:
- validate the model in running code
- avoid endless abstract planning
- make governance and truth real early

Suggested first executable core:
- one governor script
- one state model
- one run/attempt model
- one happy-path implementation flow
- one durable event trail

Likely artifacts later, not to be over-defined yet:
- governor entrypoint
- state schema
- run/attempt schema
- lock model
- stage model
- minimal status surface

## Step 5 — Expand surfaces only after the core is trustworthy

Only after the thin core works should v2 widen.

Purpose:
- keep the startup fast
- avoid rebuilding big architecture before the core is real
- keep new surfaces honest

Potential later expansions:
- richer CTO-facing interface
- status/reporting surfaces
- richer queue/admission support
- more worker lane types
- later business-facing facade if still useful

Critical rule:
- do **not** widen surface area before governance/state/run truth are stable

---

## What Should Happen Next

The next planning session should **not** start coding immediately.

It should do exactly this:

1. Review this handoff document.
2. Confirm whether the v2 reframing is accepted.
3. Draft the v2 mission statement.
4. Draft the v2 Phase 1 definition.
5. Draft the thin architecture model.
6. Draft migration rules from legacy ADF.
7. Only then choose the first executable thin-core slice.

---

## Strong Recommendations For The Next Agent

### Keep the model thin

Do not reintroduce early:
- COO as a core operating layer
- PM as a separate layer
- many departments
- enterprise process surfaces
- broad human-company simulation

### Treat scripts as the governance layer

Scripts should own:
- lifecycle truth
- state transitions
- queue/control logic
- lock enforcement
- merge/completion truth
- status synthesis

### Treat agents as cheap execution

Agents should own:
- implementation work
- review work
- fix work
- summarization work

Agents should **not** own:
- lifecycle truth
- approval truth
- completion truth
- merge truth

### Keep the CEO out of the weeds

If any proposed architecture requires the CEO to directly manage implementation route details, that proposal should be treated as a likely regression.

---

## Open Questions Still To Be Resolved

These questions were recognized but not yet frozen.

1. Should the v2 public-facing human interface be called CTO, or something else?
2. How much of the old Phase 1 vision language should be preserved verbatim versus rewritten?
3. What is the minimum run/attempt/state model for the first executable core?
4. Should the first working v2 core live behind a CLI only, or be library-first with a thin CLI wrapper?
5. What is the minimum viable intake artifact set for the first real implementation path?
6. Which current ADF substrate utilities are trustworthy enough to port immediately, if any?

---

## Non-Goals For The Next Session

The next session should **not** try to:
- rebuild all of ADF mentally
- define every later-company function
- define a full org chart
- define all future departments
- design benchmarks, finance, staffing, or marketing layers
- widen into full COO/company-operating-system abstractions
- start by repairing all legacy governance code

The next session should stay focused on:
- mission
- Phase 1
- architecture
- migration policy
- first executable thin core

---

## Suggested Folder Growth Pattern

The exact names can still change, but the current recommendation is to grow `adf-v2/` in a very explicit sequence.

Example:

- `adf-v2/00-mission-foundation/context/HANDOFF.md`  ← this file
- `adf-v2/00-mission-foundation/VISION.md`
- `adf-v2/00-mission-foundation/PHASE1.md`
- `adf-v2/01-architecture/ARCHITECTURE.md`
- `adf-v2/01-architecture/CONTROL-PLANE.md`
- `adf-v2/02-migration/MIGRATION.md`
- `adf-v2/03-thin-core/` ...

The naming idea is:
- explicit sequence
- easy restart in new chats
- no hidden context requirement

---

## Final Summary For The Next Agent

The key conclusion of the prior session was:

**ADF v2 should begin as a thin control-plane startup, not as a continuation of the current layered COO/governance patch path.**

Use this operating model:
- CEO
- CTO
- governance scripts
- agentic engineering lanes
- durable truth/state

Build in the same repo under `adf-v2/`, but treat legacy ADF as reference only.

Do not start by fixing every old problem.
Start by freezing:
1. mission
2. Phase 1 scope
3. architecture model
4. migration rules
5. first thin executable core

That is the intended restart point.
