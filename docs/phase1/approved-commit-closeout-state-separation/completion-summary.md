1. Objective Completed

Implemented the governed state separation so pre-merge closeout readiness relies on `approved_commit_sha` instead of `last_commit_sha`, while post-merge closeout still remains fail-closed on true merge-backed evidence.

- Pre-merge readiness no longer blocks solely because `last_commit_sha` is absent.
- `merge-queue` still uses the exact approved SHA as merge authority.
- Post-merge closeout still requires truthful `merge_commit_sha` and `last_commit_sha`.
- Stale already-merged queue requests are now blocked before duplicate merge work starts.

2. Deliverables Produced

- Core `validateCloseoutReadiness` fix in `skills/implement-plan/scripts/implement-plan-helper.mjs`
- Updated workflow contracts in `skills/implement-plan/references/workflow-contract.md` and `skills/merge-queue/references/workflow-contract.md`
- Stale-ancestor guard in `skills/merge-queue/scripts/merge-queue-helper.mjs`
- Four targeted machine test suites covering closeout readiness, merge authority, stale queue rejection, and post-merge closeout truth

3. Files Changed And Why

- `skills/implement-plan/scripts/implement-plan-helper.mjs` - switched pre-merge readiness authority from `last_commit_sha` to `approved_commit_sha`
- `skills/implement-plan/references/workflow-contract.md` - documented the corrected pre-merge authority rule
- `skills/merge-queue/references/workflow-contract.md` - documented approved-SHA merge authority and stale-request rejection expectations
- `skills/merge-queue/scripts/merge-queue-helper.mjs` - rejects stale already-merged queue requests before merge work proceeds
- `skills/tests/closeout-readiness.test.mjs` - 6 targeted pre-merge readiness tests
- `skills/tests/mark-complete-closeout-truth.test.mjs` - 4 targeted post-merge closeout truth tests
- `skills/tests/merge-authority.test.mjs` - 4 targeted approved-SHA authority tests
- `skills/tests/stale-merge-guard.test.mjs` - 2 targeted stale-queue guard tests

4. Verification Evidence

Machine Verification:
- `node skills/tests/closeout-readiness.test.mjs` - 6 passed, 0 failed
- `node skills/tests/mark-complete-closeout-truth.test.mjs` - 4 passed, 0 failed
- `node skills/tests/merge-authority.test.mjs` - 4 passed, 0 failed
- `node skills/tests/stale-merge-guard.test.mjs` - 2 passed, 0 failed
- `node --check` on all modified scripts and tests - passed
- `git diff --check` - passed (CRLF warnings only on Windows)
Human Verification Requirement: false
Human Verification Status: not applicable
Review-Cycle Status: not run
Merge Status: ready_to_queue
Local Target Sync Status: not_started

5. Feature Artifacts Updated

- `docs/phase1/approved-commit-closeout-state-separation/implement-plan-state.json`
- `docs/phase1/approved-commit-closeout-state-separation/implement-plan-execution-contract.v1.json`
- `docs/phase1/approved-commit-closeout-state-separation/implementation-run/run-5f38bcd2-17c7-452c-b115-3e23340a8412/execution-contract.v1.json`
- `docs/phase1/approved-commit-closeout-state-separation/implementation-run/run-5f38bcd2-17c7-452c-b115-3e23340a8412/run-projection.v1.json`
- `docs/phase1/approved-commit-closeout-state-separation/implementation-run/run-5f38bcd2-17c7-452c-b115-3e23340a8412/events/attempt-002/`
- `docs/phase1/approved-commit-closeout-state-separation/completion-summary.md`

6. Commit And Push Result

- Preserved draft commit: `f08442b`
- Approved feature commit: `f024ab9ee83d0075b5fb3e5927722f83cae1d112`
- Feature branch push: success to `origin/implement-plan/phase1/approved-commit-closeout-state-separation`
- Route status: merge-ready; merge-queue not yet invoked

7. Remaining Non-Goals / Debt

- No human-review handoff for this machine-only slice
- No broad merge-queue redesign beyond the stale-request guard needed for truthful governed behavior
- Merge-queue, post-merge closeout, and guarded `mark-complete` still remain to be executed by the parent governance loop
