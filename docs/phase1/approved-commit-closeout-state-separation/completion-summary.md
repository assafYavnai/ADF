1. Objective Completed

Fixed the governed merge/closeout state model so pre-merge readiness relies on `approved_commit_sha` instead of `last_commit_sha`, while post-merge closeout still records `merge_commit_sha` and `last_commit_sha` truthfully. Additionally fixed a shared runtime `parseArgs` bug that prevented CLI-driven null-clear of nullable state fields.

- Pre-merge readiness no longer blocks solely because `last_commit_sha` is absent.
- `merge-queue` still uses the exact approved SHA as merge authority.
- Post-merge closeout still requires truthful `merge_commit_sha` and `last_commit_sha`.
- Stale already-merged queue requests are now blocked before duplicate merge work starts.
- CLI-driven `update-state --last-commit-sha ''` now correctly clears to `null` instead of writing the literal string `"true"`.

2. Deliverables Produced

- Core `validateCloseoutReadiness` fix in `skills/implement-plan/scripts/implement-plan-helper.mjs`
- Updated workflow contracts in `skills/implement-plan/references/workflow-contract.md` and `skills/merge-queue/references/workflow-contract.md`
- Stale-ancestor guard in `skills/merge-queue/scripts/merge-queue-helper.mjs`
- `parseArgs` null-clear fix in `skills/governed-feature-runtime.mjs`
- Five targeted machine test suites covering closeout readiness, merge authority, stale queue rejection, post-merge closeout truth, and CLI null-clear behavior

3. Files Changed And Why

- `skills/implement-plan/scripts/implement-plan-helper.mjs` - switched pre-merge readiness authority from `last_commit_sha` to `approved_commit_sha`
- `skills/implement-plan/references/workflow-contract.md` - documented the corrected pre-merge authority rule
- `skills/merge-queue/references/workflow-contract.md` - documented approved-SHA merge authority, stale-request rejection, and pre-merge readiness without `last_commit_sha`
- `skills/merge-queue/scripts/merge-queue-helper.mjs` - added stale-ancestor guard rejecting already-merged queue requests before worktree creation
- `skills/governed-feature-runtime.mjs` - fixed `parseArgs` to use `next === undefined` instead of `!next`, preserving empty-string CLI args as values
- `skills/tests/closeout-readiness.test.mjs` - 6 targeted pre-merge readiness tests
- `skills/tests/mark-complete-closeout-truth.test.mjs` - 4 targeted post-merge closeout truth tests
- `skills/tests/merge-authority.test.mjs` - 4 targeted approved-SHA authority tests
- `skills/tests/stale-merge-guard.test.mjs` - 2 targeted stale-queue guard tests
- `skills/tests/null-clear-state-update.test.mjs` - 3 targeted CLI null-clear tests

4. Verification Evidence

Machine Verification:
- `node skills/tests/closeout-readiness.test.mjs` - 6 passed, 0 failed
- `node skills/tests/mark-complete-closeout-truth.test.mjs` - 4 passed, 0 failed
- `node skills/tests/merge-authority.test.mjs` - 4 passed, 0 failed
- `node skills/tests/stale-merge-guard.test.mjs` - 2 passed, 0 failed
- `node skills/tests/null-clear-state-update.test.mjs` - 3 passed, 0 failed
- `node --check` on all modified scripts and tests - passed
- `git diff --check` - no whitespace errors
Human Verification Requirement: false
Human Verification Status: not applicable
Review-Cycle Status: not run
Merge Status: ready_to_queue
Local Target Sync Status: not_started

5. Feature Artifacts Updated

- `docs/phase1/approved-commit-closeout-state-separation/implement-plan-state.json`
- `docs/phase1/approved-commit-closeout-state-separation/implement-plan-execution-contract.v1.json`
- `docs/phase1/approved-commit-closeout-state-separation/implementation-run/`
- `docs/phase1/approved-commit-closeout-state-separation/completion-summary.md`

6. Commit And Push Result

- Original draft commit: `f08442b` (core closeout-readiness fix + 4 test suites)
- Stale-ancestor guard commit: `f024ab9` (stale-merge guard + scoped tests)
- Rebased onto `origin/main` (`d1b42b5`) to resolve merge-queue conflicts from prior blocked attempt
- Attempt-004 commit: pending (null-clear fix + test + state repair + completion summary)
- Route history: attempt-001 draft, attempt-002 verification pass, attempt-003 blocked by merge conflicts, attempt-004 rebase repair + null-clear fix

7. Remaining Non-Goals / Debt

- No human-review handoff for this machine-only slice
- No broad merge-queue redesign beyond the stale-request guard
- Merge-queue enqueue, process, and mark-complete to be executed as final governed steps
