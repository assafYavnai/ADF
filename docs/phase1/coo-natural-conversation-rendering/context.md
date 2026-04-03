# Feature Context

## Feature

- phase_number: 1
- feature_slug: coo-natural-conversation-rendering
- project_root: C:/ADF
- feature_root: C:/ADF/docs/phase1/coo-natural-conversation-rendering
- current_branch: main

## Task Summary

Replace shallow COO requirements-gathering replies that expose raw internal state with natural human-facing replies derived from onion state, while preserving one-question-at-a-time clarification, approval/freeze flow, and existing requirement artifact behavior.

## Scope Hint

Authoritative slice root:
Treat docs/phase<phase_number>/<feature_slug>/ as the authoritative slice root for this work.
If the slice already exists there, treat its saved contract, brief, state, and prior implementation/review artifacts as the authoritative continuity source.
Do not fork a parallel slice unless integrity requires it and you explain exactly why.

Scope hint:
Implement a bounded, production-grade slice for the COO requirements-gathering onion only.

Current problem evidence:
Today COO can answer with shallow slot-dump style output such as repeated Topic, Goal, Expected result, where the user sees raw internal structure instead of a natural operator response.

Target behavior:
COO should still uphold governance, but answer like a human operator.
Example target shape:
“I understand the request: add /status to COO CLI so it shows current thread ID, active workflow, onion layer when present, scope path, and last state commit timestamp.
I would consider this working when you type /status and it prints those fields clearly.
Did I get it right?”

Important product decision:
Do not make conversation state identical to onion state.
Implement conversation state as a derived presentation layer from:
- existing onion/internal truth state
- readiness/completeness facts
- approval/freeze facts
- blocker state if any

The onion/internal workflow state remains the source of truth.
Conversation state must be derived, not a second persisted source of truth, unless an unavoidable exception is proven and documented.

Implementation objective:
Build a production-ready conversation-state projection and natural response renderer for COO requirements-gathering so CEO-facing turns become natural, concise, and useful without weakening governance.

In scope:
- requirements_gathering_onion CEO-facing response generation
- derived conversation-state projection from existing onion/readiness/approval/blocker facts
- natural recap / confirm / smallest-next-question rendering
- minimal CLI/output plumbing only if required
- automated tests
- authoritative docs update for the two-layer model

Suggested conversation states:
- ask_smallest_question
- reflect_and_confirm
- ready_for_approval
- approved_and_frozen
- blocked_with_reason

Expected behavior by state:
- ask_smallest_question:
  ask exactly one smallest next question; no field-dump recap
- reflect_and_confirm:
  reflect the understood request naturally in human language, then ask one smallest next question if still needed
- ready_for_approval:
  concise natural recap + explicit confirmation/freeze check
- approved_and_frozen:
  confirm scope is frozen and do not reopen it casually
- blocked_with_reason:
  explain the blocker clearly and give the next safe move without pretending readiness

Must preserve:
- one-question-at-a-time clarification
- do not freeze until explicit approval
- existing onion layer semantics and order
- existing requirement artifact creation/finalization behavior
- existing thread persistence behavior
- existing lock/freeze semantics

Preferred implementation shape:
Use additive, low-risk modules with thin integration points.
Good candidates are:
- COO/requirements-gathering/engine/conversation-state.ts
- COO/requirements-gathering/engine/conversation-renderer.ts

Possible touched areas only if needed:
- COO/requirements-gathering/live/onion-live.ts
- COO/requirements-gathering/engine/*
- COO/controller/cli.ts
- tests
- authoritative docs

Allowed edits:
- add pure derivation/rendering helpers
- refactor CEO-facing onion response composition
- add non-persistent TypeScript types used for rendering
- add/update targeted tests
- update materially affected authoritative docs
- make small CLI output adjustments only when required

Forbidden edits:
- do not redesign the onion state machine
- do not reorder onion layers
- do not add a new persisted conversation-state truth model unless separately justified
- do not broaden this into a global COO tone rewrite
- do not change unrelated workflows
- do not introduce speculative refactors
- do not add new env vars, flags, or generic shared mutation surfaces unless proven necessary
- do not touch /status command implementation in this slice

Critical review-cycle compatibility rules:
Treat the observed shallow reply as evidence of a failure class, not the whole scope.
Sweep the full supported CEO-facing onion reply route and sibling branches for the same contract break.
Do not ship an endpoint-only fix.
Update all materially affected authoritative docs in the same implementation.
Prove the fix on the live supported route, not only through isolated helpers.

Claimed supported route:
CEO input -> classifier -> requirements_gathering_onion -> onion state/readiness facts -> conversation-state derivation -> natural response render -> CLI/thread output

Acceptance gates:
1. Default CEO-facing onion replies no longer expose raw internal slot-style labels as the primary response.
2. COO still asks only one smallest next question when clarification is needed.
3. When intent is clear, COO reflects the request back naturally in human language.
4. When approval/freeze is appropriate, COO asks for explicit confirmation.
5. When blocked, COO explains the blocker clearly instead of pretending readiness.
6. Conversation state is derived from existing truth state and not stored as a second source of truth.
7. Existing requirement artifact flow still works.
8. Existing freeze/approval behavior still works.
9. TTY output and pipe/test-proof output remain usable.
10. Materially affected authoritative docs are updated.
11. Implementation and artifacts are committed and pushed.
12. review-cycle closes without open route-level objections, or stops truthfully with a clearly surfaced blocker.

Required proof:
- automated coverage for:
  - unclear intent -> exactly one smallest next question
  - intent clear but missing detail -> natural recap + one next question
  - ready for approval -> concise human recap + explicit confirmation/freeze check
  - approved/frozen -> confirmation without reopening scope
  - blocked -> clear reason + next safe move
- regression proof that existing onion requirement artifact flow still works
- proof on the live supported route
- manual or automated proof that TTY and pipe/test-proof mode remain usable

Documentation requirements:
Update the authoritative docs to explain:
- onion/internal state is the source of truth
- conversation state is a derived presentation layer
- why this separation exists
- what CEO-facing behavior is guaranteed

Closeout requirements:
- use the strongest truthful worker mode available
- if native worker mode is weaker than CLI full-auto bypass, prefer the stronger truthful mode and record why
- keep worker runtime distinct from control-plane runtime if required by the skill contract
- commit and push all code and feature artifacts
- send the same feature stream to review-cycle
- keep iterating review until completion under the skill contract or until a truthful stop condition is reached

## Non-Goals

- no /status command implementation
- no automated requirement-to-implementation bridge
- no phase engine / queue / CTO workflow work
- no global conversational rewrite outside this onion lane
- no Brain schema changes unless absolutely required and separately justified
- no review-cycle optimization work in this slice

## Discovered Authorities

- [feature-readme] C:/ADF/docs/phase1/coo-natural-conversation-rendering/README.md
- [phase-doc] C:/ADF/docs/phase1/adf-phase-gates-and-next-phase-design-implementation-ready-contract.md
- [phase-doc] C:/ADF/docs/phase1/adf-phase0-readiness-and-phase1-implementation-ready-plan.md
- [phase-doc] C:/ADF/docs/phase1/adf-phase1-coo-completion-plan.md
- [phase-doc] C:/ADF/docs/phase1/adf-phase1-discussion-record.md
- [phase-doc] C:/ADF/docs/phase1/adf-phase1-high-level-plan.md
- [phase-doc] C:/ADF/docs/phase1/adf-phase1-onion-parallel-build-plan.md
- [phase-doc] C:/ADF/docs/phase1/adf-requirement-to-implementation-high-level-design.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/context.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-01/audit-findings.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-01/fix-plan.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-01/fix-report.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-01/review-findings.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-01/verification-evidence.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-02/audit-findings.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-02/fix-plan.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-02/fix-report.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-02/review-findings.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/README.md
- [phase-doc] C:/ADF/docs/phase1/coo-kpi-instrumentation/context.md
- [phase-doc] C:/ADF/docs/phase1/coo-kpi-instrumentation/cycle-01/audit-findings.md
- [phase-doc] C:/ADF/docs/phase1/coo-kpi-instrumentation/cycle-01/fix-plan.md
- [phase-doc] C:/ADF/docs/phase1/coo-kpi-instrumentation/cycle-01/fix-report.md
- [phase-doc] C:/ADF/docs/phase1/coo-kpi-instrumentation/cycle-01/review-findings.md
- [phase-doc] C:/ADF/docs/phase1/coo-kpi-instrumentation/cycle-02/audit-findings.md
- [phase-doc] C:/ADF/docs/phase1/coo-kpi-instrumentation/cycle-02/fix-plan.md
- [project-doc] C:/ADF/docs/phase1/coo-stabilization/context.md
- [project-doc] C:/ADF/docs/phase1/llm-skills-repo-migration/context.md
- [project-doc] C:/ADF/docs/phase1/requirements-gathering/context.md
- [project-doc] C:/ADF/docs/v0/architecture.md
- [project-doc] C:/ADF/docs/v0/context/agent-role-builder-governance-v1-frozen-design.md
- [project-doc] C:/ADF/docs/v0/context/context-cache-layer-ideas.md
- [project-doc] C:/ADF/docs/v0/review-process-architecture.md

## Notes

- This context file was created automatically during implement-plan prepare.
