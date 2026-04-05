# Feature Context

## Feature

- phase_number: 1
- feature_slug: governed-merge-closeout-chain-hardening
- project_root: C:/ADF
- feature_root: C:/ADF/.codex/implement-plan/worktrees/phase1/governed-merge-closeout-chain-hardening/docs/phase1/governed-merge-closeout-chain-hardening
- worktree_path: C:/ADF/.codex/implement-plan/worktrees/phase1/governed-merge-closeout-chain-hardening
- feature_branch: implement-plan/phase1/governed-merge-closeout-chain-hardening

## Problem Statement

The governed merge chain currently validates one critical closeout artifact too late.

Observed route failure:

1. `review-cycle` approved the feature branch.
2. `merge-queue` merged and pushed the exact approved commit.
3. `implement-plan mark-complete` then failed because `completion-summary.md` did not satisfy the required heading contract.

That means:

- merge truth was real
- closeout truth was still invalid
- the governed chain required manual cleanup after merge

This slice closes that ordering defect.

## Why The Current Chain Is Incomplete

- `review-cycle` does not currently guarantee that the final feature-branch completion summary is helper-normalized before approval closeout.
- `merge-queue` does not currently run a pre-merge closeout-readiness gate strong enough to catch invalid completion-summary contracts before push.
- `mark-complete` is correctly fail-closed, but it is currently the first place that discovers the defect.

## Approved Route Decisions

1. The final `completion-summary.md` must become helper-owned before merge.
2. `review-cycle` is the right stage to normalize final closeout artifacts on the approved feature branch.
3. `merge-queue` must validate closeout readiness before landing the approved commit.
4. `merge-queue` must not silently mutate the approved commit after approval.
5. `mark-complete` must remain fail-closed.
6. The exact approved commit SHA must remain the one that lands.

## Expected Fix Shape

- add or tighten a helper-owned completion-summary normalization path before approval closeout is final
- add a pre-merge closeout readiness validation path in `merge-queue`
- preserve the current truthful merge and completion ownership boundaries
- prove both:
  - invalid closeout blocks before merge/push
  - valid approved features merge and mark complete automatically

## Scope Boundaries

In scope:

- `implement-plan` helper/doc/contract changes needed for helper-owned final completion-summary truth
- `review-cycle` helper/doc/contract changes needed to ensure approved heads are merge-closeout-ready
- `merge-queue` helper/doc/contract changes needed to validate closeout readiness before merge
- slice-local docs/proof artifacts

Out of scope:

- broad merge-strategy redesign
- queue reordering
- worker/provider/runtime redesign
- product/runtime behavior outside governed workflow closeout
- silent mutation of approved commits after approval

## Compatibility Notes

- Vision: compatible, because this removes a governance hole between real merge success and durable completion truth
- Phase 1: compatible, because it hardens the real delivery route without widening into later-company behavior
- Master plan: compatible, because it reduces operational ambiguity in the governed implementation system
- Current gap-closure plan: compatible, because it tightens the workflow substrate that Phase 1 now depends on

## Source Authorities Used

- `C:/ADF/AGENTS.md`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`
- `C:/ADF/skills/implement-plan/SKILL.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/references/prompt-templates.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/review-cycle/SKILL.md`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/SKILL.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
- `C:/ADF/docs/phase1/implement-plan-llm-tools-worker-resolution/completion-summary.md`

## Notes

- The helper echoed a malformed worktree path during the first `prepare`, but the actual dedicated worktree exists and is on the correct feature branch.
- The integrity gate initially failed because the seed README/context did not yet carry the full governed contract fields. This context update is part of making the slice implementation-ready.
