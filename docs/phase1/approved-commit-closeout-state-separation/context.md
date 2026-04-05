# Feature Context

## Feature

- phase_number: 1
- feature_slug: approved-commit-closeout-state-separation
- project_root: C:/ADF
- feature_root: C:/ADF/.codex/implement-plan/worktrees/phase1/approved-commit-closeout-state-separation/docs/phase1/approved-commit-closeout-state-separation
- worktree_path: C:/ADF/.codex/implement-plan/worktrees/phase1/approved-commit-closeout-state-separation
- base_branch: main
- feature_branch: implement-plan/phase1/approved-commit-closeout-state-separation

## Task Summary

Repair the structural contradiction in the governed merge/closeout route where pre-merge readiness still requires `last_commit_sha`, even though pre-merge authority should come only from `approved_commit_sha`.

## Why This Slice Exists

The recent `governed-state-writer-serialization` route exposed a real design defect:

1. review-cycle produced an approved feature head
2. merge-queue expected to land the exact `approved_commit_sha`
3. `validate-closeout-readiness` still blocked on missing `last_commit_sha`
4. the only apparent way to satisfy that gate was to mutate tracked state after approval
5. that mutation created a new feature commit and broke the approved-SHA chain

This is not just operator misuse. It is a route contradiction.

## Root Cause

The route currently conflates:

- **approved feature commit truth**: the reviewed feature SHA that merge-queue is allowed to land
- **closeout commit truth**: the merge/main SHA recorded after merge and completion

`approved_commit_sha` is a pre-merge authorization fact.
`merge_commit_sha` and `last_commit_sha` are post-merge closeout facts.

Requiring `last_commit_sha` before merge is structurally wrong because it forces post-merge-style evidence into a pre-merge gate.

## Desired Route Model

Pre-merge:

- valid `completion-summary.md`
- active feature not already completed
- valid `approved_commit_sha`
- no requirement for `last_commit_sha`

Merge:

- merge-queue lands exactly `approved_commit_sha`

Post-merge / closeout:

- record `merge_commit_sha`
- record `last_commit_sha`
- run `mark-complete`
- preserve fail-closed completion semantics

## Touched Authorities

- `C:/ADF/skills/implement-plan/SKILL.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/merge-queue/SKILL.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
- `C:/ADF/docs/phase1/governed-merge-closeout-chain-hardening/README.md`
- `C:/ADF/docs/phase1/governed-state-writer-serialization/README.md`

## Implementation Boundaries

- keep merge authority on `approved_commit_sha`
- do not weaken mark-complete fail-closed requirements
- do not repair this by normalizing manual state edits into accepted behavior
- if migration logic is needed for active blocked slices, keep it minimal and truthful

## Success Shape

After this slice, a reviewed feature should be able to move into merge-queue and land without any post-review manual state mutation, while final completion still records truthful merge-backed closeout evidence.
