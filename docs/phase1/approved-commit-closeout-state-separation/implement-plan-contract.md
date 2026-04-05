# approved-commit-closeout-state-separation

## Objective

Separate pre-merge approved-commit authority from post-merge closeout commit truth so the governed route can merge reviewed work without forbidden post-review state edits.

## Scope

- pre-merge closeout-readiness validation
- merge-queue approved-SHA authority handling
- post-merge mark-complete closeout truth
- minimum compatible helper/doc updates

## Deliverables

- corrected pre-merge readiness contract
- corrected helper/runtime enforcement
- bounded migration or repair handling for active slices blocked by the old rule, if strictly required
- updated authoritative docs
- completion summary with truthful proof

## Allowed Edits

- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/merge-queue/**`
- tightly scoped shared runtime code if strictly required
- `C:/ADF/docs/phase1/approved-commit-closeout-state-separation/**`

## Forbidden Edits

- no manual state JSON patching as the fix
- no use of `last_commit_sha` as merge authority
- no broad route redesign
- no unrelated workflow/product work

## Acceptance

1. Pre-merge readiness accepts a reviewed feature with valid `approved_commit_sha` and valid completion summary even when `last_commit_sha` is still null.
2. Merge-queue still lands the exact `approved_commit_sha`.
3. Post-merge closeout still records `merge_commit_sha` and `last_commit_sha`.
4. Mark-complete still fails closed when true post-merge evidence is missing.
5. No manual state patch is required to move from approval to merge.

## Machine Verification Plan

- targeted helper tests for pre-merge readiness
- targeted merge-queue tests for approved-SHA landing
- targeted mark-complete tests for post-merge truth requirements
- syntax checks on modified scripts
- `git diff --check`

## Human Verification Plan

Required: false

Reason:
This is a deterministic workflow/governance repair.
