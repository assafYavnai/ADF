# approved-commit-closeout-state-separation

## Implementation Objective

Fix the governed merge/closeout state model so pre-merge readiness uses `approved_commit_sha` as the only merge authority, while post-merge closeout continues to record `merge_commit_sha` and `last_commit_sha` truthfully.

## Why This Slice Exists Now

- `merge-queue` correctly treats `approved_commit_sha` as the exact reviewed feature head that may land
- `validate-closeout-readiness` currently blocks on missing `last_commit_sha` before merge
- before merge, there is no honest governed way to persist a tracked `last_commit_sha` that also remains the reviewed commit
- this creates a structural contradiction:
  - either mutate tracked state after review and break the approved-SHA chain
  - or leave state truthful and fail the pre-merge gate
- this defect makes a clean governed merge impossible for some slices even when code and review are otherwise correct

## Problem Statement

The current route mixes two different kinds of truth:

- **pre-merge authority**: which reviewed feature commit is allowed to land
- **post-merge closeout evidence**: which merge/main commit actually completed the route

Those are different facts and must not be forced into one field at one stage of the route.

Today the route still requires `last_commit_sha` too early. That requirement is incompatible with the exact approved-SHA rule and pushes agents toward forbidden post-review state edits.

## Requested Scope

Keep this slice bounded to the governed merge/closeout state model and the minimum route surfaces that enforce it.

This slice must:

- make `approved_commit_sha` the only required pre-merge commit authority
- remove pre-merge dependence on `last_commit_sha` from closeout-readiness validation
- preserve `merge_commit_sha` and `last_commit_sha` as post-merge closeout evidence
- keep `merge-queue` landing the exact approved feature SHA
- keep `mark-complete` fail-closed on merge-backed closeout truth
- provide a truthful migration/repair path for active slices blocked by the old contradictory rule

## Allowed Edits

- `skills/implement-plan/**`
- `skills/merge-queue/**`
- tightly scoped shared workflow/runtime code only if strictly required
- targeted tests for closeout-readiness, merge-queue integration, and closeout truth
- `docs/phase1/approved-commit-closeout-state-separation/**`

## Forbidden Edits

- no direct manual edits to governed state JSON as the product fix
- no weakening of the exact approved-SHA merge rule
- no broad merge-queue redesign
- no review-cycle redesign beyond what is strictly required by the commit-authority model
- no Brain redesign
- no unrelated COO/runtime/status work

## Required Deliverables

- pre-merge readiness model that accepts `approved_commit_sha` without requiring `last_commit_sha`
- post-merge closeout path that still records `merge_commit_sha` and `last_commit_sha`
- bounded integration updates in `implement-plan` and `merge-queue`
- proof that no manual state patch is needed to bridge review to merge
- truthful docs for the new route contract
- `context.md`
- `implement-plan-contract.md`
- `completion-summary.md`

## KPI Applicability

KPI Applicability: not required

KPI Non-Applicability Rationale:
This slice fixes governed merge/closeout state semantics and route truth. It does not add or alter delivery KPI collection behavior.

## Compatibility

Vision Compatibility:
Compatible. This reduces false governance pressure and preserves truthful route evidence instead of incentivizing manual artifact mutation.

Phase 1 Compatibility:
Compatible. Phase 1 needs a governed implementation pipeline that can actually land reviewed work without contradictory state requirements.

Master-Plan Compatibility:
Compatible. This hardens the approval-to-merge-to-closeout chain rather than widening scope.

Current Gap-Closure Compatibility:
Compatible. This is direct workflow/governance hardening for the active Phase 1 route.

Later-Company Check:
no

Compatibility Decision:
compatible

Compatibility Evidence:
The slice preserves existing route ownership while separating pre-merge authority from post-merge closeout truth.

## Acceptance Gates

- `validate-closeout-readiness` no longer blocks solely because `last_commit_sha` is absent before merge
- `merge-queue` still requires and lands `approved_commit_sha`
- `mark-complete` still fails closed unless merge-backed closeout truth exists
- a reviewed feature can move from approval to merge without any manual state edit
- post-merge state still records truthful `merge_commit_sha` and `last_commit_sha`
- the route never falls back to using `last_commit_sha` as merge authority

## Machine Verification Plan

- targeted tests for pre-merge closeout readiness
- targeted tests for merge-queue approved-SHA landing
- targeted tests for mark-complete fail-closed behavior
- proof that a reviewed feature with valid `approved_commit_sha` and valid summary can merge without manual state mutation
- proof that `last_commit_sha` remains required only for post-merge closeout
- `node --check` on modified scripts
- `git diff --check`

## Human Verification Plan

Required: false

Reason:
This is governed route hardening and can be proven through deterministic helper/runtime verification.

## Non-Goals

- no attempt to rewrite already-broken historical slice truth
- no broad state-model migration across unrelated features
- no benchmark/queue/product work beyond this route defect
- no manual cleanup workflow as the intended fix

## Artifact Map

- README.md
- context.md
- implement-plan-contract.md
- implement-plan-state.json
- implement-plan-brief.md
- implement-plan-pushback.md
- implementation-run/
- completion-summary.md

## Lifecycle

- active
- blocked
- completed
- closed
