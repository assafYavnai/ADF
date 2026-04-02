# Requirements Gathering Onion Model

Status: draft high-level model
Last updated: 2026-04-01
Purpose: define the human-facing CEO <-> COO discussion model for Phase 1 requirements gathering before the COO moves into technical requirement writing.

Update: 2026-04-01

The COO runtime now supports this onion lane live behind the explicit feature gate `ADF_ENABLE_REQUIREMENTS_GATHERING_ONION` / `--enable-onion`.
The business model below remains the source truth; the live runtime persists thread-owned onion state, requires explicit freeze approval, and derives the finalized requirement artifact only from the approved human snapshot.
Persisted onion ownership remains active for route-gating even after `handoff_ready` clears `active_workflow`, so frozen-thread follow-up turns fail closed when the gate is disabled.
Current reopen supersession behavior is fail-closed when locked finalized artifacts cannot be archived by the existing memory-manage mutation path.

---

## Core Idea

Requirements gathering should be treated as an **onion**.

The COO does not try to define the whole feature at once.

The COO peels the feature from the outside in:

- first understand what the thing is
- then why the CEO wants it
- then what result the CEO expects
- then what major parts it contains
- then what each part actually means
- then any deeper boundaries, constraints, and missing decisions

The onion is complete only when the COO can show the whole feature back to the CEO in clear human language and the CEO agrees that the scope is ready to freeze.

This model is **human-facing only**.

Its purpose is to make the feature scope crystal clear to the CEO.
Only after this approval does the COO move on to the technical requirement package and downstream CTO handoff.

Strong authority rule:

- the onion itself is not the governed machine authority
- governed lane authority must be JSON
- governed LLM roles remain structured tagged Markdown backed by JSON rules and contracts
- any markdown or prose generated from the onion is optional derived view only unless it is an approved role artifact
- the COO may translate governed JSON state back into CEO language when needed

---

## Why This Model Exists

This model protects against 3 common failures:

1. jumping into technical detail before the business intent is clear
2. collecting scattered facts without shaping one coherent feature
3. silently freezing an incomplete scope that the CEO assumed was understood

The onion model keeps the discussion natural for the CEO while still letting the COO gather enough truth to produce a governed requirement package later.

---

## The Onion Layers

### 1. Topic

What is this thing?

Example:

- `an execution monitor for ADF`

### 2. Goal

Why does the CEO want it?

Example:

- `to see what the system is currently doing, starting with the implementation queue`

### 3. Expected Result

What should exist when this work is done?

Example:

- `a local URL that shows the current system status with live updates`

### 4. Success View

How will the CEO test it or recognize success?

Example:

- `I can open the page, see the queue, and drill into current execution`

### 5. Major Parts

What are the main pieces of the feature?

Example:

- feature queue
- per-feature flow view
- current step and status
- node details
- audit trail
- token and time metrics

### 6. Part Clarification

What does each major part actually mean?

This is where the COO asks focused clarification questions, one at a time.

Example:

- does `live updates` mean push updates, refresh on click, or timed polling?
- what details should open when a node is clicked?

### 7. Experience / UI

If UI meaning matters, what should the user actually see and do?

When UI is important to the feature, the COO should suggest a mockup or interactive preview before freeze.

The goal is not design polish.
The goal is alignment.

### 8. Boundaries

What is not part of the feature?
What constraints matter?

Examples:

- not a full historic analytics suite
- phase 1 focus is implementation queue first
- synthetic data is acceptable for the first mockup

### 9. Open Decisions

What still needs a CEO answer before freeze?

These are only the business-level gaps that the company should not guess.

### 10. Whole-Onion Freeze

When the COO believes the onion is complete enough:

- show the complete feature scope back to the CEO
- ask whether anything is missing or wrong
- ask whether the scope should now be frozen

Freeze is explicit, never silent.

---

## When CEO <-> COO Discussion Is Required

The CEO and COO should stay in direct discussion when:

- the topic or goal is still unclear
- the expected result is not yet concrete
- the CEO's success view is still ambiguous
- the feature parts are still being defined
- UI meaning matters and needs approval
- a business-level scope or priority decision is missing
- the COO is asking for whole-onion freeze approval
- a later phase pushes back and needs a CEO decision

---

## When CEO <-> COO Discussion Is Not Required

The COO should not pull the CEO into internal company work unless needed.

Direct CEO discussion is usually **not** required for:

- internal organization of the captured scope
- translation from approved scope into the technical requirement package
- internal self-checks and reviews
- CTO sequencing and internal queue movement, unless a CEO decision is needed
- technical formatting or contract-writing details that do not change approved scope

---

## Example: Execution Monitor Feature

### Outer shell

CEO:

- `I want to build a dashboard to see the current execution of ADF.`

COO:

- clarifies the goal

CEO:

- `I want to see what the system is currently doing. Focus first on the implementation queue.`

COO:

- reflects the topic and goal
- `So we are building an execution monitor for ADF.`

CEO:

- `Yes.`

COO:

- moves to expected result
- `When this is complete, what do you expect to get?`

CEO:

- `A URL that I can open locally and see the current system status, with live updates.`

At this point the outer shell is clear enough:

- topic: execution monitor
- goal: see what the system is doing now
- expected result: local URL with live updates

### Inner layers

COO:

- `What do you want to see on the execution monitor?`

CEO:

- feature queue
- flow chart of steps
- branching for parallel execution
- current step and status
- drill-down into execution nodes
- agent output and substeps
- audit of completed steps
- token usage
- time totals and per-step timing
- review rounds
- learning cycles

The COO then asks focused clarification questions until the meaning of those parts is clear enough.

If UI meaning matters, the COO suggests a mockup or interactive monitor with sensible data and runs an approval loop.

### Freeze

When the COO believes the onion is complete enough:

- the COO shows the full feature scope back to the CEO
- the CEO either approves it or pushes back

Only after approval does the COO:

- write the technical requirement package
- send it to the CTO for downstream work

From the CEO point of view, the feature is now with the company and can leave the CEO's active mental agenda.

---

## Boundary With Technical Requirements

The onion model stops when the human-facing scope is clear and approved.

From there:

- the COO turns the approved scope into the technical requirement package
- the COO output artifact is the **finalized requirement list**
- that finalized requirement list is the handoff into the feature function
- the feature function then tries to turn it into a **frozen requirement list**
- if it cannot, the feature function pushes back to the COO

After that, the COO moves into a different job:

- translate approved scope into the formal requirement package
- preserve meaning exactly
- avoid silently inventing missing business decisions
- float missing business gaps back to the CEO if they appear during writing

The onion is not the technical contract.
It is the approved human truth that the technical contract must preserve.

---

## Working Rule

Peel from the outside in.
Do not freeze until the whole onion can be shown back clearly.
Do not move to technical detail until the human-facing scope is coherent.
