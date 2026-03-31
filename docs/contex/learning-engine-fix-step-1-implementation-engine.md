# Learning Engine Fix Step 1: Create `implementation-engine`

Date: 2026-03-31
Status: in progress - bootstrap artifacts drafted
Related report: `docs/contex/agent-role-builder-replay-vs-018-learning-report.md`

## Purpose

This document explains the first concrete step in the current learning-engine remediation direction: create a new governed top-level `implementation-engine`.

This is written for a reader with no prior chat context.

## Executive Summary

ADF currently has shared sub-engines for review, learning, and rules-compliance, but it does not yet have a governed generic implementation tool that owns the full loop from task intake through review, learning, revision, verification, and terminal closeout.

That gap matters because the replay-vs-run-018 findings are not only about missing learning rules. They are also about missing generic implementation discipline:

- artifact drift is not being closed by one reusable governed implementer
- review findings and rule-compliance findings do not converge through one generic revision loop
- rulebook mutation needs a safe serialized promotion path while implementation jobs may run in parallel

The first step is therefore to create `implementation-engine` as a new governed tool.

## Why This Is Step 1

### Problem with the current state

Today, the closest working pattern exists inside `agent-role-builder`, but it is domain-specific. ARB already combines:

- validation
- artifact generation
- board review
- telemetry
- postmortems
- future-run rulebook promotion

Evidence: `tools/agent-role-builder/src/index.ts:7-16`, `224-291`, `745`, `771-786`, and `932-1224`.

The shared architecture already treats learning and rules-compliance as generic sub-engines:

- `shared/self-learning-engine/` extracts and evaluates rule proposals
- `shared/rules-compliance-enforcer/` performs governed rule walks and artifact revision

Evidence: `docs/v0/review-process-architecture.md:117-118` and `371-381`.

What is missing is the governed top-level tool that orchestrates those sub-engines into one reusable implementation lifecycle.

### Why not bootstrap with `llm-tool-builder`

`llm-tool-builder` is currently too thin to serve as the builder of record for the first version of `implementation-engine`.

Its present implementation does four main things:

- validate the tool-builder request
- optionally call ARB for role creation
- write `tool-contract.json`
- write `result.json`

Evidence: `tools/llm-tool-builder/src/index.ts:36-123`.

It does not yet run the governed implementation/review/learning loop that `implementation-engine` is supposed to own.

### Resulting decision

Bootstrap `implementation-engine` manually:

1. create the role manually under ARB-style governance discipline
2. create the contract manually
3. seed the engine rulebook manually
4. implement the first engine version using ARB core and governance patterns

## High-Level Decisions Already Agreed

### 0. Shared-engine boundary

`implementation-engine` is a new top-level orchestrator. It is not a replacement for every shared engine, and it does not absorb their governance.

Target high-level stack:

- `implementation-engine` orchestrates the run lifecycle
- `shared/review-engine/` remains the generic review execution and parsing surface
- `shared/self-learning-engine/` remains the generic learning surface
- `shared/rules-compliance-enforcer/` remains the generic governed revision and rules-compliance surface

Explicit migration decision:

- `shared/component-repair-engine/` is not part of the target steady-state stack
- it should be merged into, aliased to, or retired in favor of `shared/rules-compliance-enforcer/`
- until that migration is completed, `implementation-engine` should not treat `shared/component-repair-engine/` as a first-class dependency

This freezes the missing reuse/replace boundary before role drafting.

### 1. Rulebook split

`implementation-engine` has two rule layers:

- its own generic implementer rulebook
- target-specific governance/rulebook as invocation input

The engine must obey both.

### 2. Prompt and role split

Prompting is two-layer:

- fixed generic engine role
- structured task package for the specific invocation

The engine does not become whatever the invoker says on a given run.

### 3. Contract split

The engine has its own fixed contract.

The target contract is a separate artifact that may be:

- an input authority surface
- an output artifact
- or both

If the task is "create a contract," that does not change the engine's own contract.

### 4. Concurrency and governance split

`implementation-engine` may run implementation jobs in parallel, so it must be thread-safe.

But governance mutation must be serialized:

- unit of parallelism is one invocation or job
- each worker may write only to its bounded writable surface and its run-local artifacts
- shared governance promotion must run against a versioned base and fail closed on stale state
- workers may propose rule or governance changes
- only a gatekeeper path may promote them into shared mutable state

This avoids race conditions in rulebook updates.

### 5. Gatekeeper scope

The gatekeeper is not limited to rulebook mutation.

It must serialize governance-surface routing and promotion across:

- rulebook updates
- contract updates
- validator or enforcer updates
- review prompt updates
- docs-only governance updates

This keeps the system aligned with the architecture rule that findings must be routed to the narrowest enforceable surface, not defaulted into rulebook-only promotion.

### 6. Conditional acceptance authority

`implementation-engine` may return `frozen_with_conditions`, but it does not own the final business acceptance of that state.

The invoker or domain tool decides whether to accept the conditional result. The engine may declare the condition set and supporting evidence, but it must not silently treat conditional freeze as equivalent to clean freeze.

## Minimum Target Governance Input Package

The target-governance package must be explicit before role and contract drafting. The minimum package is:

- artifact kind
- bounded writable surface
- target contract
- target rulebook
- target review prompt
- authority documents
- runtime review configuration
- canonical output declarations
- stop conditions
- acceptance authority for conditional outcomes

Without this package, the engine role and contract will drift because the live governed surface is larger than a target rulebook alone.

## Intended Scope of `implementation-engine`

`implementation-engine` should own the generic governed loop:

- intake and normalize a structured task package
- load engine governance
- load target governance inputs
- freeze a bounded implementation slice
- produce or revise the target artifact
- run rules-compliance
- run review
- run learning extraction
- route governance-surface proposals to the promotion gatekeeper
- revise and re-verify
- produce governed terminal artifacts and status

It should not own domain-specific semantics for ARB, tool-builder, or other future tools. Those remain with the invoker/domain tool.

It also should not replace governance ownership of the shared engines it orchestrates. Runtime control flow sits above them; governance ownership remains with each shared engine and with the domain tool that invoked the run.

## Governance Lifecycle

### High-level step flow

1. Receive invocation.
2. Load engine role, contract, and engine rulebook.
3. Load target governance inputs.
4. Freeze a bounded implementation slice.
5. Implement or revise the target artifact.
6. Run rules-compliance.
7. Run review.
8. Run learning extraction.
9. Route governance-surface proposals to the gatekeeper.
10. Apply approved fixes and revisions.
11. Re-verify the artifact.
12. Run parity audit across declared surfaces, emitted artifacts, self-check evidence, and terminal payload.
13. Close as `frozen`, `frozen_with_conditions`, `resume_required`, `pushback`, or `blocked`.

### Flow chart

```text
Invocation
  ->
Load engine governance
  ->
Load target governance
  ->
Freeze bounded slice
  ->
Implement / revise artifact
  ->
Rules compliance
  ->
Review
  ->
Learning extraction
  ->
Gatekeeper decides promotion / routing
  ->
Revise again if needed
  ->
Final verification
  ->
Parity audit
  ->
Terminal state
```

## Terminal Semantics and Artifact Matrix

Step 1 must freeze the terminal-state model up front.

Required generic terminal states:

- `frozen`
- `frozen_with_conditions`
- `resume_required`
- `pushback` (pre-review or post-review)
- `blocked`

High-level artifact matrix:

| Terminal state | Required artifacts | Intentionally not written |
|---|---|---|
| `frozen` | result, immutable staged-final snapshot, final artifact outputs, self-check evidence, parity audit, run postmortem, cycle postmortem | conditions manifest, resume package, pushback artifact |
| `frozen_with_conditions` | result, immutable staged-final snapshot, final artifact outputs, conditions manifest, self-check evidence, parity audit, run postmortem, cycle postmortem | resume package, pushback artifact |
| `resume_required` | result, resume package, self-check evidence, parity audit, run postmortem, cycle postmortem | canonical promotion reserved for clean or conditional freeze |
| `pushback` | result, pre-review or post-review pushback artifact, self-check evidence when available, parity audit, cycle postmortem, and run postmortem when a review round actually ran | canonical promotion, resume package unless explicitly part of pushback semantics |
| `blocked` | result, blocking incident or bug artifact, available self-check evidence, parity audit if the run reached auditable state, run postmortem, cycle postmortem | canonical promotion, conditions manifest |

This matrix is intentionally generic. Domain tools may add domain-specific artifacts, but they must not weaken these state distinctions.

## What This Engine Enables

Once `implementation-engine` exists, ADF can stop rebuilding the full governed implementation loop inside each domain tool.

That makes it easier to create additional governed tools because each new tool mostly needs:

- a domain contract
- a domain rulebook
- a review prompt
- artifact schema and outputs
- a task package

Instead of having to rebuild:

- implementation orchestration
- rules-compliance orchestration
- review orchestration
- learning orchestration
- terminal closeout and evidence flow

## Manual Bootstrap Sequence

Because ARB is still expensive to run and `llm-tool-builder` is not mature enough for this job, the first version should be bootstrapped manually in this order:

### 1. Manual role creation

Create a high-level governed role for `implementation-engine` manually, but under strict ARB-style artifact discipline and contract compliance.

### 2. Manual contract creation

Create the engine contract manually, based on the existing ADF tool-contract style where useful, but tailored to `implementation-engine` as a governed executor rather than a simple contract writer.

### 3. Manual seed rulebook

Seed the rulebook from already-known implementation discipline findings, including:

- freeze one bounded slice before coding
- do not answer review criticism by expanding architecture
- no define-without-wire, no wire-without-proof
- every new concept must name owner, consumer, lifecycle, and proof
- separate design, implementation, review, and run-analysis phases
- adversarial closeout is mandatory before ready
- one defect family per commit boundary
- bounded validation after each slice
- separate execution status from artifact status from review outcome from termination reason

These are generic implementation-discipline rules, not ARB-specific rules.

### 4. Manual first implementation

Implement the engine by reusing ARB core and governance patterns rather than waiting for ARB or tool-builder to generate it.

## Bootstrap Governance Path

Before implementation begins, the manually created bootstrap artifacts must themselves go through a lightweight governed path:

1. Freeze the boundary decisions in this document.
2. Draft the engine role manually under strict ARB-style artifact discipline.
3. Run an independent contextless review of the role draft.
4. Draft the engine contract manually.
5. Run an independent contextless review of the contract draft.
6. Draft the seed rulebook and review it the same way.
7. Freeze the role, contract, seed rulebook, target-governance package, and terminal artifact matrix before code-level design starts.

This is the bootstrap substitute for a full ARB-generated package.

## What Must Be Preserved From Replay vs Run 018

The engine should preserve the stronger semantics learned from replay, while also making room for the operational completeness that run 018 still handled better.

Preserve from replay:

- legality gates that reflect actual reviewer state
- clear separation of distinct semantic states
- stronger final verification discipline

Preserve from run 018 conceptually:

- explicit non-happy-path branch coverage
- resume handling
- update/fix history preservation
- honest handling of unimplemented checks
- dedicated conditional/deferred artifact support where needed

These concepts should be implemented generically in `implementation-engine`, not hardcoded as ARB-specific meanings.

## Acceptance Criteria For Step 1

Step 1 is complete when all of the following exist:

- a frozen shared-engine boundary memo
- a governed `implementation-engine` role
- a fixed engine contract
- a seeded generic implementer rulebook
- a concrete target-governance input package
- a defined parallel-safe execution model
- a defined serialized gatekeeper path for governance-surface routing and mutation
- a frozen terminal-state model including `frozen_with_conditions`
- one authoritative terminal-state artifact matrix
- a required parity-audit stage in the lifecycle
- a documented terminal-state model
- a documented artifact set for runs and reviews
- a clear statement that the first implementation is bootstrapped manually from ARB patterns, not generated by tool-builder

## What Step 1 Does Not Yet Require

Step 1 does not require:

- full implementation of the engine
- full retrofit of ARB onto the new engine
- immediate replacement of `llm-tool-builder`
- final KPI schema design
- final learning-engine schema changes

Those come after the engine boundary, role, contract, and seeded governance are established.

## Current Bootstrap Artifact State

The first bootstrap artifacts now exist in draft form under `tools/implementation-engine/`:

1. role draft
2. tool-contract draft
3. review-contract draft
4. review-prompt draft
5. seed rulebook draft
6. invocation-request schema draft

These artifacts are not frozen yet. They exist so the next independent review can test boundary clarity, artifact completeness, and operational usability instead of reviewing an empty placeholder surface.

## Immediate Next Review And Freeze Steps

1. run another independent contextless review of the role plus companion governance artifacts
2. tighten the role until the artifact matrix, authority chain, and terminal semantics are stable
3. draft and review the fuller engine contract surface
4. review and tighten the seed rulebook
5. freeze the target-governance invocation package and bootstrap governance set before code-level design

Only after those are reviewed and frozen should the implementation plan move into code-level design.


