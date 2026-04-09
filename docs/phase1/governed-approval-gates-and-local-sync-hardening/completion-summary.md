1. Objective Completed

Hardened the governed implementation-review-merge-closeout route so merge and completion truth now fail closed on missing or stale approval evidence, split review verdicts cannot advance closeout truth, and dirty local target sync uses preserve-sync-restore instead of silent skip behavior.
- Repo-owned completion truth now matches the approved review and merged feature lifecycle.
- Final closeout reflects not run and merge commit ab2f68e565bb03e19a3c084400dbfeaf9fa7ef5c.

2. Deliverables Produced

- durable human-verification state fields and closeout gating in `implement-plan-helper.mjs`
- pre-resume origin refresh guard before governed implementation continues
- preserve-sync-restore local target sync in `merge-queue-helper.mjs`
- structured restore-failure handling so `process-next` returns recovery evidence instead of hard-exiting
- targeted proof for approval gates, preserve-sync-restore, and origin-refresh failure
- workflow-contract and skill documentation updates for the governed route
- Reconciled the repo-owned completion artifacts to canonical main-root paths and merged closeout truth.

3. Files Changed And Why

- `skills/implement-plan/scripts/implement-plan-helper.mjs`: added durable approval-truth enforcement, stale-approval invalidation, split-review gating, completion-eligibility checks, and origin refresh before resume
- `skills/merge-queue/scripts/merge-queue-helper.mjs`: added preserve-sync-restore, excluded live `.codex` operational state from the stash set, and fixed helper error propagation so restore failures return structured closeout results
- `skills/tests/governed-approval-gates.test.mjs`: proves missing/stale approval and split-review blockers
- `skills/tests/merge-queue-preserve-sync-restore.test.mjs`: proves tracked, untracked, and restore-conflict sync behavior
- `skills/tests/implement-plan-origin-refresh.test.mjs`: proves prepare fails closed when the local feature branch is behind origin
- `skills/implement-plan/references/workflow-contract.md`, `skills/merge-queue/references/workflow-contract.md`, `skills/implement-plan/SKILL.md`, `skills/merge-queue/SKILL.md`: align the documented governed contract with the implemented route

4. Verification Evidence

- Machine Verification: passed
- Execution Contract / Run Projection Proof: repo-owned state, execution contract, and run projection now point at canonical C:/ADF artifact paths.
- Human Verification Requirement: not required
- Human Verification Status: not required
- Review-Cycle Status: not run
- Merge Status: merged via merge-queue (merge commit ab2f68e565bb03e19a3c084400dbfeaf9fa7ef5c)
- Local Target Sync Status: fast_forwarded

5. Feature Artifacts Updated

- `implement-plan-state.json`
- `completion-summary.md`
- workflow-contract references for `implement-plan` and `merge-queue`
- targeted test artifacts covering the new route guards
- `docs/phase1/governed-approval-gates-and-local-sync-hardening/completion-summary.md`
- `docs/phase1/governed-approval-gates-and-local-sync-hardening/implement-plan-state.json`
- `docs/phase1/governed-approval-gates-and-local-sync-hardening/implementation-run/`

6. Commit And Push Result

- Approved feature commit: 3881d85f6b6e69933c8a20abb87aba6d357bb1b3
- Merge commit: ab2f68e565bb03e19a3c084400dbfeaf9fa7ef5c
- Push: success to origin/main

7. Remaining Non-Goals / Debt

No additional debt was introduced beyond the bounded route hardening in this slice.
