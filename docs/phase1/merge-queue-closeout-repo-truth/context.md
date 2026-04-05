# Merge-Queue Closeout Repo Truth

- Objective: fix the post-merge governance gap where merge-queue could land code but leave repo-owned implement-plan closeout artifacts stale or serialized against a temporary worktree root.
- Scope: `skills/merge-queue/scripts/merge-queue-helper.mjs`, `skills/implement-plan/scripts/implement-plan-helper.mjs`, `skills/governed-feature-runtime.mjs`, and the one-time repair of stale Spec 1 artifacts under `docs/phase1/implement-plan-provider-neutral-run-contract/`.
- Route under repair: approved feature commit -> merge-queue isolated merge worktree -> push to target branch -> implement-plan closeout state/projection/summary persistence.
- Invariant to enforce: repo-owned completion truth must point at the canonical repo root (`C:/ADF`) even when the physical write happens from an isolated merge worktree, and the closeout path must be idempotent enough to reconcile stale merged artifacts without inventing a fake new lifecycle.
- Verification used in this slice: `node --check` on modified helpers, `git diff --check`, merge-queue control-root smoke, implement-plan helper `update-state --canonical-project-root C:/ADF`, and idempotent `mark-complete` summary refresh for the stale Spec 1 artifacts.
