# Onion Implementation + Review Contract

Date: 2026-04-01  
Status: active implementation contract  
Audience: implementer agent, reviewer agent, audit agent, human owner

## What This File Is

This is the **single explicit contract** for building the onion model implementation safely and reviewing it later.

Use this file as the visible source of truth for:

- what is in scope
- what is out of scope
- which files may be touched
- what must be delivered
- how reviewers should judge the result
- what observability and audit evidence must exist

## What This File Is Not

This file is **not** the business definition of the onion model.

The business model remains:

- `docs/v0/context/requirements-gathering-onion-model.md`

That file explains the human-facing product behavior.

This contract explains how to implement it without reopening the current COO stabilization route.

## Required Working Method

Use a **two-pass flow**.

### Pass 1 — Design Lock

Do **not** write code yet.

The implementer must return only:

1. proposed file list
2. proposed state shape
3. proposed reducer/checker responsibilities
4. proposed fixtures
5. proposed tests
6. proposed observability and audit shape
7. compliance-map skeleton against `RQG-001..RQG-010`
8. explicit statement of which forbidden files will remain untouched

This pass exists to catch architecture drift before code exists.

### Pass 2 — Implementation

Only after Pass 1 is accepted.

The implementer returns:

1. full code for each changed or new file
2. tests
3. compliance map against `RQG-001..RQG-010`
4. changed file list
5. observability and audit evidence
6. known limitations
7. future integration seams only
8. explicit statement confirming dormant-track safety

## Mission

Implement the Phase 1 requirements-gathering onion lane as a **dormant parallel track**.

The result must be:

- additive
- isolated
- deterministic
- serializable
- route-free
- test-backed
- auditable
- observable enough for implementation review and later integration

The result must **not**:

- activate onion in the live controller route
- widen the supported COO runtime surface
- compete with the current stabilization path
- silently assume that broader shared telemetry redesign is in scope

## Authority Precedence

For this implementation slice:

1. this contract governs implementation scope, allowed edits, forbidden edits, required deliverables, observability requirements, and acceptance gates
2. `docs/v0/context/requirements-gathering-onion-model.md` remains the business and product truth
3. broader planning and architecture documents provide context and constraints

If there is tension between broad context documents and this contract, follow this contract for the implementation slice.

## Hard Boundaries

### Allowed

- additive files under `COO/requirements-gathering/`
- pure contracts
- pure reducer/checker logic
- artifact derivation logic
- fixtures
- route-free tests
- slice-local observability and audit surfaces
- future adapter placeholders only

### Forbidden

- live controller route changes
- live classifier workflow changes
- thread schema changes
- memory-engine redesign
- shared telemetry redesign
- user-visible claim that onion mode is already live

## Forbidden Edit Targets

These files and areas should remain untouched unless a change is:

- additive
- minimal
- clearly placeholder-only
- explicitly justified in the output

Targets:

- `COO/controller/cli.ts`
- `COO/controller/loop.ts`
- `COO/controller/thread.ts`
- `COO/controller/memory-engine-client.ts`
- `COO/context-engineer/context-engineer.ts`
- `COO/classifier/classifier.ts`
- `components/memory-engine/**`
- `shared/telemetry/**`
- `shared/llm-invoker/**`

## Required Build Surface

Recommended location:

```text
COO/requirements-gathering/
  rulebook.json
  review-prompt.json
  contracts/
    onion-state.ts
    onion-turn.ts
    onion-artifact.ts
    onion-observability.ts
  engine/
    onion-reducer.ts
    clarification-policy.ts
    freeze-check.ts
    artifact-deriver.ts
    readiness-check.ts
    audit-trace.ts
  fixtures/
    execution-monitor.json
    sample-onion-turns.json
    sample-onion-trace.json
  *.test.ts
```

Equivalent structure is acceptable if the same responsibilities are covered explicitly.

## Required Deliverables

The implementation must deliver these surfaces or their direct equivalents:

1. `contracts/onion-state.ts`
2. `contracts/onion-turn.ts`
3. `contracts/onion-artifact.ts`
4. `contracts/onion-observability.ts` or equivalent typed schema surface
5. `engine/onion-reducer.ts`
6. `engine/clarification-policy.ts`
7. `engine/freeze-check.ts`
8. `engine/artifact-deriver.ts`
9. `engine/readiness-check.ts`
10. `engine/audit-trace.ts` or equivalent trace builder
11. `fixtures/execution-monitor.json`
12. `fixtures/sample-onion-turns.json`
13. `fixtures/sample-onion-trace.json` or equivalent audit example
14. tests that prove the onion rules without using the live controller route
15. future adapter placeholder contracts only, if needed

## Minimum Onion State Contract

The state must be serializable and include at least:

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

## Required Behavior

The implementation must support:

1. deterministic progression from incomplete outer shell to deeper layers
2. one business-level clarification question at a time
3. major-parts-first progression
4. whole-onion reflection back to the CEO
5. explicit freeze-readiness determination
6. explicit freeze request generation
7. requirement-list draft derivation from approved onion state
8. refusal to silently guess unresolved business meaning

## Rulebook Compliance Requirements

The implementation must explicitly operationalize these rules:

- `RQG-001` — outer shell first
- `RQG-002` — one business-level clarification question at a time
- `RQG-003` — keep `topic`, `goal`, `expected_result`, and `success_view` separate
- `RQG-004` — major parts before per-part clarification
- `RQG-005` — support UI preview/mockup loop when UI meaning matters
- `RQG-006` — maintain a working scope artifact
- `RQG-007` — boundaries, constraints, and open decisions explicit before freeze
- `RQG-008` — explicit whole-onion freeze approval
- `RQG-009` — preserve approved human meaning in artifact derivation
- `RQG-010` — run readiness self-check before handoff

## Observability And Audit Requirements

The onion slice must be observable and auditable enough that a reviewer can reconstruct what the COO logic did **without guessing**.

### Operation-Level Timing

The implementation must define a typed observability surface that can represent timing for every major onion operation, at minimum:

- `onion_reducer`
- `clarification_policy`
- `freeze_check`
- `artifact_deriver`
- `readiness_check`
- `audit_trace_build`

For each operation record, the schema must support at least:

- `trace_id`
- `turn_id` or equivalent turn correlation field
- `operation`
- `started_at` or equivalent
- `completed_at` or equivalent
- `duration_ms`
- `success`
- `error_code` or `error_message` when not successful
- `input_summary`
- `output_summary`

The implementation does not need to redesign the shared telemetry stack for this slice.
It must, however, produce a deterministic and reviewable operation-timing surface inside the onion module.

### LLM Call Metrics

If the onion slice introduces any LLM call, the implementation must capture a typed record for each call with at least:

- `trace_id`
- `turn_id` or equivalent correlation field
- `provider`
- `model`
- `purpose`
- `latency_ms`
- `tokens_in`
- `tokens_out`
- `estimated_cost_usd` if available
- `fallback_used`
- `success`

If the slice intentionally uses **no LLM calls**, the implementer must state that explicitly in the output package and tests/evidence.

### Workflow Audit Trace

The implementation must provide a structured workflow trace that shows, per onion turn, at minimum:

- `trace_id`
- `turn_id`
- `current_layer`
- `workflow_step`
- `decision_reason`
- `selected_next_question` or explicit reason no question was asked
- `freeze_blockers`
- `open_decisions_snapshot`
- `artifact_change_summary`
- `result_status`

This trace must be reconstructable from structured data, not only prose.

### Evidence Requirement

The implementer must include at least one sample audit trace artifact for the execution-monitor fixture or an equivalent representative fixture.

## Test Requirements

Tests must be route-free and must cover at least:

1. outside-in clarification
2. one-question-at-a-time behavior
3. major-parts-before-deep-detail behavior
4. explicit freeze gate
5. requirement-artifact derivation without intent drift
6. blocked readiness when business decisions remain unresolved
7. deterministic behavior on the execution-monitor fixture
8. operation-timing records are produced for major onion operations
9. workflow trace can reconstruct the onion path without ambiguity
10. if LLM calls are present, typed token/latency records are produced for each call

## Acceptance Gates

The slice passes only if **all** conditions are true:

1. deterministic serializable onion state exists
2. next-question selection is one-question-at-a-time
3. outer-shell-first progression is enforced
4. whole-onion freeze is explicit
5. artifact derivation preserves approved meaning and flags unresolved business decisions instead of guessing
6. readiness check is machine-testable
7. tests prove route-free behavior
8. operation timing exists for all major onion operations
9. workflow trace is sufficient to audit the onion path without guessing
10. if any LLM call exists in the slice, token and latency records exist for each such call
11. forbidden files were not changed, or every exception is explicitly justified and still dormant-track safe

## Required Implementer Output Package

The implementer must submit this package:

1. short implementation summary
2. exact changed file list
3. full code for each changed or new file
4. test list and expected outcomes
5. compliance map for `RQG-001..RQG-010`
6. explicit contract-compliance summary against this file section by section
7. explicit note confirming which forbidden files were untouched
8. precise justification for any touched forbidden file
9. observability schema summary
10. workflow audit schema summary
11. sample timing evidence
12. sample audit trace evidence
13. LLM metrics evidence or an explicit statement that the slice contains no LLM calls
14. known limitations
15. future integration seams only
16. explicit note explaining why the result is dormant-track safe

## Required Reviewer Checklist

The reviewer must verify:

1. the implementation stayed inside the allowed surface
2. no live route was widened
3. the state model is serializable and complete
4. the reducer/checkers are deterministic
5. question selection is one-at-a-time and business-level
6. the implementation operationalizes `RQG-001..RQG-010`
7. the artifact derivation preserves approved meaning
8. unresolved business decisions are explicit rather than guessed
9. operation-level timing exists for each major onion operation
10. workflow audit trace can reconstruct what the onion logic did without guesswork
11. if LLM calls were introduced, each call has token and latency evidence
12. forbidden files were untouched or exceptions were explicitly justified and still dormant-track safe

## Review Verdict Rule

A reviewer should reject the slice if any of these are true:

- the implementation widened the live COO path
- the implementation guessed business meaning silently
- the onion logic is not deterministic
- the workflow trace is not reconstructable from structured evidence
- operation timing is missing for major onion operations
- LLM token/latency evidence is missing for LLM calls introduced by the slice
- the evidence package is incomplete

## Future Integration Note

This contract intentionally asks for **slice-local observability and audit** first.

A later integration pass may connect these surfaces into the broader shared telemetry and live COO audit route.
That later pass is outside the current dormant-track scope unless explicitly reopened.
