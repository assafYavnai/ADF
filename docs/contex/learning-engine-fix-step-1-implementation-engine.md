# Learning Engine Fix Step 1: Create `implementation-engine`

Date: 2026-03-31
Status: proposed first execution step
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

- workers may propose rule or governance changes
- only a gatekeeper path may promote them into shared mutable state

This avoids race conditions in rulebook updates.

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
- route rule proposals to the promotion gatekeeper
- revise and re-verify
- produce governed terminal artifacts and status

It should not own domain-specific semantics for ARB, tool-builder, or other future tools. Those remain with the invoker/domain tool.

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
9. Send rule proposals to the gatekeeper.
10. Apply approved fixes and revisions.
11. Re-verify the artifact.
12. Close as `frozen`, `resume_required`, `pushback`, or `blocked`.

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
Gatekeeper decides promotion
  ->
Revise again if needed
  ->
Final verification
  ->
Terminal state
```

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

- a governed `implementation-engine` role
- a fixed engine contract
- a seeded generic implementer rulebook
- a clear invocation model for target governance inputs
- a defined parallel-safe execution model
- a defined serialized gatekeeper path for rulebook mutation
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

## Immediate Next Documents To Produce

After this plan, the next concrete artifacts are:

1. `implementation-engine` role draft
2. `implementation-engine` contract draft
3. `implementation-engine` seed rulebook draft

Only after those exist should the implementation plan move into code-level design.
