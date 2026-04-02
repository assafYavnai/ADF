# ADF Phase 1 Onion Parallel Build Plan

Status: active handoff plan  
Last updated: 2026-04-01  
Purpose: let a contextless agent start building the Phase 1 requirements-gathering onion lane in parallel with ongoing COO stabilization, without creating conflicts with the current live COO route.

Update: 2026-04-01

This document is now historical context for the dormant parallel-build slice.
The dormant onion engine described here was implemented and has since been integrated into the live COO runtime behind the explicit feature gate `ADF_ENABLE_REQUIREMENTS_GATHERING_ONION` / `--enable-onion`.
Use this file as build-history/reference material, not as the current live-state description.

## Audience

This document is for a contextless implementation agent that has already read:

1. `AGENTS.md`
2. `docs/bootstrap/cli-agent.md`

That bootstrap gives the basic ADF context. This plan gives the specific scope, boundaries, source set, and work order for the onion lane.

## Executive Summary

The onion model **can** be built now, but only as a **parallel dormant track**.

The current COO stabilization route is already real, and its API and flow should be treated as the base to build on top of, not something to redesign during onion work.

So the safe rule is:

- build onion logic, state, artifacts, and tests now
- keep the work additive and isolated
- leave live controller wiring as placeholders or thin adapter seams
- do not change the supported COO lane until stabilization is explicitly accepted

The onion track should be developed as a layer that will later plug into the stabilized COO lane, not as a competing rewrite.

## Current Source Of Truth

Treat these as the current authority set for this work:

1. [docs/PHASE1_MASTER_PLAN.md](../PHASE1_MASTER_PLAN.md)
2. [docs/v0/architecture.md](../v0/architecture.md)
3. [docs/v0/context/phase1-definition-source-pack.md](../v0/context/phase1-definition-source-pack.md)
4. [docs/v0/context/phase1-feature-flow-and-executive-briefing-draft.md](../v0/context/phase1-feature-flow-and-executive-briefing-draft.md)
5. [docs/v0/context/requirements-gathering-onion-model.md](../v0/context/requirements-gathering-onion-model.md)
6. [docs/phase1/adf-phase1-discussion-record.md](./adf-phase1-discussion-record.md)
7. [docs/phase1/adf-phase1-high-level-plan.md](./adf-phase1-high-level-plan.md)
8. [docs/phase1/adf-phase1-coo-completion-plan.md](./adf-phase1-coo-completion-plan.md)
9. [docs/phase1/coo-stabilization/README.md](./coo-stabilization/README.md)
10. [docs/phase1/coo-stabilization/cycle-06/fix-report.md](./coo-stabilization/cycle-06/fix-report.md)
11. [COO/requirements-gathering/rulebook.json](../../COO/requirements-gathering/rulebook.json)
12. [COO/requirements-gathering/review-prompt.json](../../COO/requirements-gathering/review-prompt.json)

Important status rule:

- `cycle-06` is the latest completed stabilization cycle
- build on top of the current stabilized route shape
- do not treat any later incomplete review-cycle attempt as authoritative unless it is explicitly closed and indexed in the stabilization trail

## Phase 1 Product Direction Relevant To This Work

The current intended Phase 1 sequence is:

1. finish the continuity foundation under the COO
2. build the real CEO <-> COO requirements-gathering onion lane
3. turn the approved onion into a finalized requirement artifact
4. hand off that finalized requirement artifact into the downstream feature lane

From the current source set, the onion lane is a **COO-owned pre-function activity**.

That means:

- it is human-facing
- it gathers and freezes business meaning
- it does not replace the machine-governed technical contract
- it produces the approved human truth that later requirement artifacts must preserve

## Non-Conflict Contract

This section is the main guardrail for parallel work.

### Hard rule

Do **not** compete with or rework the current COO stabilization route.

Build onion work as an additive layer that assumes:

- the current CLI -> controller -> Brain -> thread -> telemetry route is the supported front door
- the current thread, provenance, telemetry, and memory contracts are the foundation
- current stabilization hot-path files are not the place for new onion behavior yet

### What is safe to build now

- onion conversation-state contracts
- onion scope-summary structures
- onion freeze-readiness evaluation
- onion-derived requirement-artifact drafting logic
- onion-specific tests
- onion review/self-check logic
- docs and runbooks for later integration
- adapter interfaces that describe future wiring points without activating them

### What must stay unwired for now

- live classifier routing into an onion workflow
- live controller branches in the supported COO lane
- thread-schema changes that would alter current resume or recovery behavior
- Brain write paths that change current stabilization guarantees
- any user-visible claim that onion mode is already live

### Files to avoid during parallel build unless the work is only additive and clearly placeholder-level

- `COO/controller/cli.ts`
- `COO/controller/loop.ts`
- `COO/controller/thread.ts`
- `COO/controller/memory-engine-client.ts`
- `COO/context-engineer/context-engineer.ts`
- `COO/classifier/classifier.ts`
- `components/memory-engine/**`
- `shared/telemetry/**`
- `shared/llm-invoker/**`

If a later step absolutely needs a shared seam, prefer:

- a new additive interface file
- a new additive contract file
- a TODO-marked adapter placeholder

Do not disturb current live-route behavior.

## Existing Onion Seed Surface

The current repo already contains the seed of the onion lane here:

- [COO/requirements-gathering/rulebook.json](../../COO/requirements-gathering/rulebook.json)
- [COO/requirements-gathering/review-prompt.json](../../COO/requirements-gathering/review-prompt.json)

These are the starting point, not the complete implementation.

They already define the core business rules:

- outside-in scope shaping
- one business-level clarification question at a time
- explicit separation of goal, expected result, and success view
- major-parts-first clarification
- UI preview loop when needed
- working truth captured in an artifact
- explicit whole-onion freeze
- meaning-preserving transition into the technical requirement package
- readiness self-check before handoff

The new work should formalize and operationalize those rules in isolated code and tests.

## Recommended Build Location

Keep the parallel work under `COO/requirements-gathering/`.

Recommended additive structure:

```text
COO/requirements-gathering/
  rulebook.json
  review-prompt.json
  contracts/
    onion-state.ts
    onion-turn.ts
    onion-artifact.ts
  engine/
    onion-reducer.ts
    clarification-policy.ts
    freeze-check.ts
    artifact-deriver.ts
    readiness-check.ts
  fixtures/
    execution-monitor.json
    sample-onion-turns.json
  *.test.ts
```

You do not need to use these exact names, but the work should stay isolated in this area or an equally isolated sibling path.

## Target Outcome For The Parallel Track

By the end of the parallel build, another agent should be able to demonstrate:

1. a pure onion state model
2. deterministic turn progression for outside-in scope shaping
3. explicit freeze-readiness checks
4. one derived artifact path from approved onion -> finalized requirement-list draft
5. tests that cover the onion rules without using the live controller route
6. a clear integration seam showing how the stabilized COO lane can call into this later

This is the correct scope.

The goal is **not** to make the onion lane live now.

## Suggested Work Packages

### Work Package 0: Lock the contracts

Create the minimum additive contracts for:

- onion state
- onion layers
- freeze status
- open business decisions
- derived requirement artifact

Keep them pure and serializable.

Suggested state areas:

- `topic`
- `goal`
- `expected_result`
- `success_view`
- `major_parts`
- `part_clarifications`
- `experience_ui`
- `boundaries`
- `open_decisions`
- `freeze_status`
- `approved_snapshot`

### Work Package 1: Build the onion reducer/engine

Create pure logic that can:

- accept a current onion state plus a CEO message
- determine which layer is currently missing or incomplete
- propose the smallest next business-level clarification question
- update the scope summary without silently freezing
- determine whether the onion is ready to reflect back as a whole

The engine should implement the existing rulebook, not invent a new discussion philosophy.

### Work Package 2: Build whole-onion reflection and freeze checks

Create logic that can:

- render the whole current onion in clear CEO-facing language
- identify missing pieces before freeze
- ask for explicit freeze approval
- reject silent freeze

This should produce a stable structured output first, with CEO-facing prose as a derived view.

### Work Package 3: Build artifact derivation

Create the first deterministic path from:

- approved onion state

to:

- finalized requirement-list draft

This is not the full downstream company function.

It is only the COO-side artifact derivation that preserves the approved human meaning.

Keep the derivation isolated and make missing business decisions explicit instead of guessed.

### Work Package 4: Build readiness and review helpers

Operationalize the self-check rules from the rulebook:

- completeness
- boundary clarity
- unresolved decision visibility
- readiness for technical handoff

This can reuse the existing `review-prompt.json` as seed logic, but should become testable code or structured validation instead of prompt-only guidance.

### Work Package 5: Build fixtures and route-free tests

Add test cases for:

- outside-in clarification
- one-question-at-a-time behavior
- major-parts-before-deep-detail behavior
- explicit freeze gate
- requirement-artifact derivation without intent drift
- pushback when a business decision is still missing

Preferred example fixture:

- the execution-monitor feature from the onion model doc

### Work Package 6: Add future integration placeholders only

Once the isolated onion logic exists, define future seam points only.

Examples:

- an adapter contract for `classifier -> onion workflow`
- an adapter contract for `controller loop -> onion engine`
- an adapter contract for `approved onion -> requirement artifact persistence`

Do not activate these seams in the live route yet.

## Recommended Technical Shape

Prefer:

- pure functions
- serializable state
- deterministic reducers/checkers
- additive tests
- narrow adapter interfaces

Avoid:

- hidden dependence on current chat/session memory
- new live Brain dependencies in this phase
- new telemetry or provenance requirements on the hot path
- changing the supported controller route while stabilization is still active

## Integration Assumptions

The current stabilized route is close enough to treat as the future integration base.

So the onion track may assume that later wiring will probably pass through:

- `COO/classifier/classifier.ts`
- `COO/controller/loop.ts`
- `COO/controller/thread.ts`
- `COO/context-engineer/context-engineer.ts`
- `COO/controller/memory-engine-client.ts`

But for this parallel build, those should be treated as **future adapter points**, not active edit targets.

Where assumptions are needed:

- assume current scope handling stays as the stable basis
- assume thread persistence remains the durable state mechanism
- assume Brain remains the governed memory/provenance surface
- leave placeholders where later wiring is required

## Concrete Non-Goals

Do not do these in this parallel track:

- do not redesign the controller architecture
- do not reopen stabilization findings already closed in the review trail
- do not replace the current thread model
- do not add a live onion classifier route
- do not advertise onion mode as a supported current capability
- do not redesign Brain or telemetry
- do not widen into CTO/downstream implementation-lane work

## Definition Of Done For This Parallel Build

This parallel track is in a good state when:

1. the onion lane has isolated contracts, logic, and tests
2. the logic follows the current onion model and rulebook
3. the work does not modify the supported stabilization route
4. the result is ready to wire later through small adapter changes
5. a contextless agent can prove the onion flow on fixtures without touching the live COO controller path

## Handoff Into Later Wiring

When stabilization is explicitly accepted, the later integration pass should:

1. choose the live workflow entrypoint
2. add classifier vocabulary only if the live surface is ready
3. add controller/thread wiring using the already-built onion contracts
4. persist the right approved onion artifacts
5. add route-level proof through the real COO lane

That later pass should be small because this document is specifically asking the parallel agent to do the heavy lifting in isolated modules first.

## Recommended Read Order For The Implementation Agent

Read in this order:

1. [docs/PHASE1_MASTER_PLAN.md](../PHASE1_MASTER_PLAN.md)
2. [docs/v0/architecture.md](../v0/architecture.md)
3. [docs/v0/context/phase1-definition-source-pack.md](../v0/context/phase1-definition-source-pack.md)
4. [docs/v0/context/phase1-feature-flow-and-executive-briefing-draft.md](../v0/context/phase1-feature-flow-and-executive-briefing-draft.md)
5. [docs/v0/context/requirements-gathering-onion-model.md](../v0/context/requirements-gathering-onion-model.md)
6. [docs/phase1/adf-phase1-discussion-record.md](./adf-phase1-discussion-record.md)
7. [docs/phase1/adf-phase1-high-level-plan.md](./adf-phase1-high-level-plan.md)
8. [docs/phase1/adf-phase1-coo-completion-plan.md](./adf-phase1-coo-completion-plan.md)
9. [docs/phase1/coo-stabilization/README.md](./coo-stabilization/README.md)
10. [docs/phase1/coo-stabilization/cycle-06/fix-report.md](./coo-stabilization/cycle-06/fix-report.md)
11. [COO/requirements-gathering/rulebook.json](../../COO/requirements-gathering/rulebook.json)
12. [COO/requirements-gathering/review-prompt.json](../../COO/requirements-gathering/review-prompt.json)
13. this document

## Final Instruction To The Parallel Agent

Build the onion lane **beside** the current COO.

Do not fight the stabilized route.

Use the current COO implementation as the foundation you will later plug into.

If a choice is unclear, prefer:

- new additive files
- isolated tests
- explicit placeholders for later wiring

over:

- touching the current live route
- changing established stabilization behavior
- guessing that onion activation is already approved
