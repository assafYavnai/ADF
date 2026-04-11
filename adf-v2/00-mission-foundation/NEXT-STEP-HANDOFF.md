# ADF v2 — Next-Step Handoff

Status: restart handoff for the next session  
Scope: `adf-v2/00-mission-foundation/`  
Purpose: let a new agent resume the v2 mission-foundation work quickly, with minimal drift and no need to reconstruct this session from chat history

---

## What This Handoff Is For

This file is the handoff point for the **next planning step** after the mission statement draft.

The prior session did three important things:

1. decided that `adf-v2/` should be built as a **new source of truth inside the same repo**
2. created the first mission-foundation documents for v2
3. established and recorded a reusable **requirement-gathering baseline** for future CTO-facing requirement definition

This area now also depends on a separate cross-agent working contract:
- `adf-v2/CEO-AGENT-WORKING-PROTOCOL.md`

The next session should continue from those frozen decisions rather than reopening them casually.

---

## Current Strategic Direction

### Repo decision

- `adf-v2/` lives in the **same repo** as legacy ADF
- legacy ADF is **reference only** for v2, not source of truth
- v2 is intended to become the **new architectural source of truth**

### High-level v2 direction

ADF v2 is being reframed around:
- boxed, self-contained components
- contract-based interaction
- defined failure and pushback behavior
- reusable role/workflow assemblies built from those components
- a thin startup model rather than a broad virtual-company model

### Operating model agreed so far

Core operating roles for v2 Phase 1:
- CEO
- CTO
- Scripts
- Agents
- Durable state

No separate foundational COO layer was chosen for v2 Phase 1.
No separate foundational PM layer was chosen for v2 Phase 1.

---

## Reading Order For The Next Agent

Read in this order:

### 1. `adf-v2/00-mission-foundation/HANDOFF.md`

Read this first to understand:
- why `adf-v2/` was started
- the 5-step startup sequence that was proposed
- the broad rationale behind the reset
- the high-level decisions already taken before the mission statement was drafted

### 2. `adf-v2/00-mission-foundation/context/V1-PAIN-POINT-AND-V2-FORK-RATIONALE.md`

Read this second.
It explains:
- the actual v1 pain that triggered the reset
- why continued v1 hardening stopped looking like the right main path
- what v2 is trying to resolve at the foundation level

### 3. `adf-v2/00-mission-foundation/context/DECISIONS.md`

Read this next to get the concise frozen decision log.
This is the short authoritative summary of the decisions made while defining the mission foundation.

### 4. `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`

Read this third.
It is the current draft executive charter for ADF v2.
It contains the agreed sections for:
- identity
- core promise
- foundational approach
- Phase 1 mission
- Phase 1 scope
- Phase 1 out of scope
- core operating roles
- success test

### 5. `adf-v2/00-mission-foundation/context/CTO-REQUIREMENT-GATHERING-FINDINGS.md`

Read this fourth.
This is not mission content.
It is a reusable high-level baseline for future CTO requirement gathering, derived from what worked in this session.
Use it as process guidance when defining the next foundation documents.

### 6. `adf-v2/CEO-AGENT-WORKING-PROTOCOL.md`

Read this next when working directly with the CEO.
It defines the required approval loop, trust-preservation rules, and the rule that agents must stay minimal and decision-shaped unless more depth is requested.

### 7. Individual decision files under `adf-v2/00-mission-foundation/context/`

Read these only if needed.
They contain the detailed freeze notes and wording rationale for specific decisions.
They are useful when the next session needs to understand **why** something was frozen a certain way.

---

## Files Created In This Area

### Main files

- `adf-v2/00-mission-foundation/HANDOFF.md`
- `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`
- `adf-v2/00-mission-foundation/NEXT-STEP-HANDOFF.md`
- `adf-v2/CEO-AGENT-WORKING-PROTOCOL.md`

### Context / decision files

- `adf-v2/00-mission-foundation/context/DECISIONS.md`
- `adf-v2/00-mission-foundation/context/V1-PAIN-POINT-AND-V2-FORK-RATIONALE.md`
- `adf-v2/00-mission-foundation/context/CTO-REQUIREMENT-GATHERING-FINDINGS.md`
- `adf-v2/00-mission-foundation/context/decision-004-identity.md`
- `adf-v2/00-mission-foundation/context/decision-005-core-promise-direction.md`
- `adf-v2/00-mission-foundation/context/decision-006-core-promise-wording.md`
- `adf-v2/00-mission-foundation/context/decision-007-phase1-mission.md`
- `adf-v2/00-mission-foundation/context/decision-008-phase1-scope-center.md`
- `adf-v2/00-mission-foundation/context/decision-009-phase1-scope.md`
- `adf-v2/00-mission-foundation/context/decision-010-phase1-out-of-scope.md`
- `adf-v2/00-mission-foundation/context/decision-011-core-operating-roles.md`
- `adf-v2/00-mission-foundation/context/decision-012-success-test.md`
- `adf-v2/00-mission-foundation/context/decision-013-delivery-completion-definition-level.md`
- `adf-v2/00-mission-foundation/context/decision-014-delivery-definition-as-service-contract.md`
- `adf-v2/00-mission-foundation/context/decision-015-input-boundary-is-a-well-defined-request-package.md`
- `adf-v2/00-mission-foundation/context/decision-016-output-boundary-is-a-truthful-terminal-result.md`
- `adf-v2/00-mission-foundation/context/decision-017-complete-is-returned-artifact-with-no-leaked-burden.md`
- `adf-v2/00-mission-foundation/context/decision-018-leaked-operational-burden-definition.md`
- `adf-v2/00-mission-foundation/context/decision-019-trust-is-the-umbrella-burden-rule.md`
- `adf-v2/00-mission-foundation/context/decision-020-production-ready-is-a-quality-indicator.md`
- `adf-v2/00-mission-foundation/context/decision-021-document-covers-artifact-quality-and-service-trust.md`
- `adf-v2/00-mission-foundation/context/decision-022-system-owns-the-route-after-handoff.md`
- `adf-v2/00-mission-foundation/context/decision-023-queryability-and-resumability-are-explicit.md`
- `adf-v2/00-mission-foundation/context/decision-024-environment-isolation-is-explicit.md`

Note:
- earlier decisions such as file naming, thin-doc style, and mission structure are also preserved in `DECISIONS.md`

---

## What Was Actually Frozen

### Mission document identity

The first mission document for v2 is:
- `MISSION-STATEMENT.md`

It is intentionally **thin**.
It is an executive charter, not an architecture spec or implementation plan.

### Mission document structure

The draft mission statement uses this structure:
1. Identity
2. Core promise
3. Foundational approach
4. Phase 1 mission
5. Phase 1 scope
6. Phase 1 out of scope
7. Core operating roles
8. Success test

### Key content direction

Important strategic conclusions already accepted:
- v2 must be **boxed and contract-based**
- roles and workflows should be treated as **assemblies built from components**
- Phase 1 is not only about building a delivery engine; it is about defining the startup model and proving it with the first complete delivery chain
- the real IP of ADF is the scaffolding: roles, workflows, contracts, obligations, structure, and truth model

---

## What The Next Session Should Do

The next session should **not** restart from first principles.
It should assume the mission-foundation work is already underway and continue from it.

Recommended next step:

### Define the next foundation documents after `MISSION-STATEMENT.md`

Most likely next documents:
- `DELIVERY-COMPLETION-DEFINITION.md`
- `SYSTEM-OBLIGATIONS.md`
- `BOXED-COMPONENT-MODEL.md`
- `ROLE-MODEL.md`
- `WORKFLOW-MODEL.md`

The immediate recommended next step is:

### 1. Define `DELIVERY-COMPLETION-DEFINITION.md`

Why this should be next:
- the mission statement intentionally leaves `truly complete, production-ready delivery` undefined
- the success test depends on that definition
- without it, later docs may drift in what “complete” means

That document should define at high level:
- what counts as complete delivery
- what counts as production-ready
- what must be true before completion can be declared
- what must not remain afterward
- how the CEO -> CTO -> governed dev-team trust chain is preserved

### 2. Then define `SYSTEM-OBLIGATIONS.md`

Why:
- the session clarified that audit trail, KPIs, git discipline, Brain/memory policy, status, and similar items are not mission scope items
- they are **cross-cutting obligations** that every component and flow must obey

### 3. Then define the universal boxed component model

Likely file:
- `BOXED-COMPONENT-MODEL.md`

Why:
- the session established that this is part of the real ADF IP
- later role/workflow definitions should sit on top of that universal model

---

## Important Boundaries For The Next Agent

### Do not do these yet

Do not widen into:
- broad architecture design for all of v2
- detailed schemas too early
- detailed implementation planning for every subsystem
- recreating legacy ADF compatibility behavior
- later-company roles and departments

### Do keep doing these

- keep the docs thin at the right level
- freeze one decision at a time
- record decisions durably in `context/`
- separate mission vs scope vs spec vs plan
- treat the current requirement-gathering method as part of the reusable v2 foundation

---

## Key Open Gap To Carry Forward

The most important intentionally unresolved item is:

**What exactly does `truly complete, production-ready delivery` mean in ADF v2?**

That is the clearest next hole to close.

---

## One-Sentence Restart Summary

ADF v2 mission foundation has been started; the mission statement is drafted, the strategic direction is boxed and contract-based, the role model is thin, the startup model is the focus of Phase 1, and the next session should define completion meaning before widening into broader v2 specifications.
