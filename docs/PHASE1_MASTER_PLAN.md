# ADF Phase 1 Master Plan

Status: active operating plan
Last updated: 2026-03-29
Owner: CEO and COO

## Purpose

This document is the Phase 1 alignment contract for all ADF employees, agents, departments, and components.

Use it to check whether current work strengthens the actual mission or is drifting into a later-company function too early.

## Phase 1 Mission

Build the first reliable ADF startup: a company that can take CEO demand, shape it, admit it to development intelligently, manage the queue, and deliver reviewed implementation with durable operational state.

## Feature Function Boundary

The COO owns requirements gathering as a pre-function shaping activity.

That means:

- the CEO works with the COO until the requirement list is **finalized**
- the COO handoff artifact is the **finalized requirement list**
- in the fuller company model, the COO passes that finalized requirement list to the CTO
- the CTO decides when the feature actually enters the company queue and reaches its starting point
- for the current Phase 1 scope, that CTO queue/admission layer is intentionally skipped
- the feature function therefore starts directly from the finalized requirement-list handoff
- the feature function does **not** start from vague CEO input
- the first feature-function phase is requirement-list review
- that first feature-function phase either:
  - reaches a **frozen** requirement-list state
  - or pushes back to the COO

## Phase 1 Terminology

Phase 1 should use one simple hierarchy for company work:

- **Company Function**
  - examples: `feature`, `bugfix`, `task`, `research`
- **Lifecycle**
  - the full end-to-end flow for one company function
- **Phase**
  - a major stage inside a lifecycle
- **Step**
  - a bounded unit of work inside a phase
- **Lane**
  - a parallel path inside a phase when needed

Cross-cutting terms that may apply at any level:

- **Gate**
  - a blocking checkpoint
- **Handoff**
  - a transfer package and closeout to the next unit

Important rule:

- `review` is not a taxonomy level
- review may appear as a phase activity, a step, or a shared invoked mechanism, depending on the lifecycle design
- the CEO-facing language should stay at the company-function and lifecycle level by default, with drill-down only when needed

## Function Definition Direction

Phase 1 company functions should be defined from a canonical top-down JSON artifact.

Current intended model:

- each company function should have a function-definition JSON
- the function-definition JSON should describe the lifecycle, phases, steps, lanes, gates, and handoffs
- the JSON should be detailed enough that builders can materialize the function without re-inventing its structure

Current intended build chain:

1. define the function JSON top-down
2. build shared lower-level builders bottom-up
3. build a function-builder that orchestrates those lower-level builders
4. materialize the company function from the JSON
5. wire the function into the COO

Builder orchestration direction:

- lower-level builders should include at least phase-builder and step-builder
- shared gate and handoff generation should be reusable instead of redefined per function
- once the function JSON is frozen, independent phases and independent steps should be buildable in parallel

## What Success Looks Like

Phase 1 is working when:

- the COO always knows the current project state
- the COO can answer "what is on our table?" without a forensic rebuild
- the CEO can keep creating demand without collapsing ongoing execution
- the CTO function can say what can run in parallel, what must be sequential, and what conflicts
- approved work moves through implementation and review with explicit ownership and evidence
- future-looking ideas are captured without derailing the current startup

## Phase 1 Company Map

| Department / Function | Phase 1 responsibility | Current ADF surfaces | Status |
|---|---|---|---|
| **CEO** | Sets direction, priorities, tradeoffs, and final approvals | User | active |
| **COO Office** | Holds operational state, shapes intake, peels feature scope from the outside in, routes work, keeps the live table, reports upward | `COO/controller/`, `COO/requirements-gathering/`, `COO/classifier/`, `COO/intelligence/`, `COO/context-engineer/` | active / in progress |
| **CTO Office** | Technical preflight, delivery admission, dependency/conflict analysis, design/planning/setup-analysis ownership | emerging role; informed by legacy ProjectBrain workflows | emerging |
| **Implementation Department** | Executes approved bounded work without redefining authority | current implementation flow plus future bounded specialists/workers | partial |
| **Board** | Review, audit, pushback, freeze, and drift detection | governed review patterns, `tools/agent-role-builder/` board model | active / in progress |
| **Memory and Operations** | Durable truth, open loops, context, telemetry, daily residue, thread state | `components/memory-engine/`, `threads/`, `memory/`, `decisions/`, `shared/telemetry/` | active / in progress |
| **Tooling and Enablement** | Governed creation of roles and tools that the company depends on | `tools/agent-role-builder/`, `tools/llm-tool-builder/` | partial |

## Phase 1 Component Map

| Component | Company role in Phase 1 |
|---|---|
| `COO/` | Executive operating core: intake shaping, controller, routing, intelligence, context assembly |
| `components/memory-engine/` | Company memory and operations backbone |
| `shared/` | Common infrastructure, especially LLM invocation and telemetry |
| `tools/agent-role-builder/` | Role-governance factory for bounded agent roles |
| `tools/llm-tool-builder/` | Tool-governance factory for LLM-powered tools |
| `threads/` | Session and turn-state continuity |
| `memory/` | Daily residue and short-horizon continuity |
| `decisions/` | Locked seed decisions and import candidates |
| `prompts/` | Owned prompt assets for company roles and tools |

## Legacy ProjectBrain Mapping

ProjectBrain is the skeleton of the startup we are now formalizing in ADF.

| ProjectBrain workflow or role | Phase 1 ADF company function |
|---|---|
| `ADF/COO/ADF-ROLE.md` | COO office: executive right hand, routing, continuity, escalation |
| `WAT/Workflows/requirements-gathering.md` | COO intake shaping and requirement framing |
| `WAT/Workflows/design.md` | CTO design function |
| `WAT/Workflows/planning.md` | CTO planning and execution-authority function |
| `WAT/Workflows/setup-analysis.md` | CTO preflight and dependency/admission function |
| `WAT/Workflows/implementation.md` | Implementation department / worker lane |
| `WAT/Workflows/review-cycle.md` | Board review and governed pushback |
| `WAT/Workflows/postmortem.md` | Board and learning loop after delivery |
| `WAT/Workflows/run-finalization.md` | COO closeout and executive reporting |
| `WAT/Workflows/framework-memory-capture.md` and `discussion-close-capture.md` | Memory and operations capture discipline |
| `WAT/Workflows/adf-full-cycle.md` | Company-level delivery loop spanning intake to closeout |

## Mission Filter

Before any major work starts, ask:

1. Does this strengthen the Phase 1 implementation startup?
2. Does this help the COO know the state of the project or what is on our table?
3. Does this improve intake, queue admission, technical preflight, implementation, review, or durable memory?
4. Is this required now, or is it a later-company function that should be logged and deferred?
5. Does this reduce operational ambiguity, or is it speculative breadth?

If the answer points to "later," record it and keep Phase 1 clean.

## Authority Format Rule

Phase 1 governed execution must use the right authority format for each artifact type.

- canonical lane authority is JSON
- LLM role authority is structured tagged Markdown
- rulebooks are JSON
- role and lane contracts are JSON
- the CEO is not part of the machine contract surface
- the COO is responsible for translating governed state into executive language when needed
- requirements, design, planning, setup-analysis, implementation, finalization, and postmortem should all converge on JSON-governed lane contracts and JSON-governed handoff/closeout contracts
- every governed LLM role should pair its tagged Markdown role file with a JSON contract and JSON rulebook

## Dependency Impact Rule

ADF should treat the dependency map as a governance surface, not just a reference file.

When a change touches an exposed surface, the company should be able to ask:

- who consumes this surface
- what downstream consumers are exposed
- what the blast radius is
- whether consumers must be updated now or the change must stop

See [dependency-map.md](C:/ADF/docs/v0/dependency-map.md).

## Role Alignment Rules

- **COO** must protect the table, shape CEO requests from the outer shell inward until the scope is clear, turn approved scope into development-ready briefs, push back on out-of-phase work, and log future-company ideas instead of letting them distort the current mission.
- **CTO** must not admit work into development without dependency, conflict, sequencing, and capacity analysis. Sequential first is acceptable; blind admission is not.
- **Designer** must design for the approved brief and current phase, not invent a generic platform or broad design language just because it could be useful later.
- **Planner** must produce execution-ready authority that makes implementation easier, not another layer of ambiguity.
- **Implementers and workers** must execute approved scope, surface blockers quickly, and avoid redesigning the product from inside implementation.
- **Board members** must review against the approved mission and authority chain, not only local artifact polish.
- **Memory and operations surfaces** must preserve durable truth and quick recovery so the company can resume without manual archaeology.

## Current Strategic Priorities

Phase 1 work should cluster around these priorities:

1. Fast and accurate operational state for the COO
2. Explicit intake shaping and requirements discipline
3. CTO preflight, queue admission, and sequencing logic
4. Reliable implementation and review execution
5. Durable memory, telemetry, provenance, and evidence
6. Governed role and tool creation for the company's core functions

## Explicit Not-Now List

These belong to the long-range vision but should not bend Phase 1 around themselves:

- CFO-grade finance and cost-management departments
- CHO-grade staffing and hiring systems
- CMO-grade marketing and campaign systems
- broad enterprise packaging work before the startup loop is real
- speculative platform abstractions that do not solve the current implementation-startup problem

## Operating Rule

If work is valuable but not aligned with the current mission, do not discard it and do not smuggle it into Phase 1. Log it for future reference, keep the table clean, and continue building the startup we actually need first.
