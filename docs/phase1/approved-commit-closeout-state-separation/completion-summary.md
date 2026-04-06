1. Objective Completed

Fixed the governed merge/closeout state model so pre-merge readiness relies on `approved_commit_sha` instead of `last_commit_sha`, while post-merge closeout still records `merge_commit_sha` and `last_commit_sha` truthfully.
- Repo-owned completion truth now matches the approved review and merged feature lifecycle.
- Final closeout reflects not run and merge commit 452bf003ed7ef0046c6e37140ba19bba1866344e.
- Final closeout reflects not run and merge commit 4e27b98ce0a0827e54ade7e37939e0e1e6830d3e.

2. Deliverables Produced

- Corrected `validateCloseoutReadiness` to check `approved_commit_sha` instead of `last_commit_sha` for the pre-merge gate
- Updated the `implement-plan` workflow contract to document the separated pre-merge and post-merge state model
- Updated the `merge-queue` workflow contract to document the new readiness requirements
- Added 7 targeted tests covering pre-merge readiness, merge authority, and mark-complete fail-closed behavior
- Preserved the post-merge `mark-complete` requirement for `last_commit_sha`
- Reconciled the repo-owned completion artifacts to canonical main-root paths and merged closeout truth.

3. Files Changed And Why

- `skills/implement-plan/scripts/implement-plan-helper.mjs` - replaced the `last_commit_sha` pre-merge check with `approved_commit_sha` in `validateCloseoutReadiness`, which is the core fix
- `skills/implement-plan/references/workflow-contract.md` - documented the separated pre-merge approved-commit authority and post-merge closeout evidence model
- `skills/merge-queue/references/workflow-contract.md` - documented that pre-merge readiness requires `approved_commit_sha`, not `last_commit_sha`
- `skills/tests/approved-commit-closeout-state-separation.test.mjs` - added 7 targeted tests for pre-merge readiness, merge authority, and mark-complete fail-closed behavior

4. Verification Evidence

Machine Verification:
- 7/7 targeted tests pass
- 6/6 existing governed-state-writer tests pass
- `node --check` passes on the modified `.mjs` files
- `git diff --check` passes with no whitespace issues
Human Verification Requirement: false
Human Verification Status: not applicable
- Execution Contract / Run Projection Proof: repo-owned state, execution contract, and run projection now point at canonical C:/ADF artifact paths.
- Review-Cycle Status: not run
- Merge Status: merged via merge-queue (merge commit 4e27b98ce0a0827e54ade7e37939e0e1e6830d3e)
- Local Target Sync Status: skipped_dirty_checkout

5. Feature Artifacts Updated

- `docs/phase1/approved-commit-closeout-state-separation/completion-summary.md` - this file
- `docs/phase1/approved-commit-closeout-state-separation/completion-summary.md`
- `docs/phase1/approved-commit-closeout-state-separation/implement-plan-state.json`
- `docs/phase1/approved-commit-closeout-state-separation/implementation-run/`

6. Commit And Push Result

- Approved feature commit: dc096f08f57ad6c997020c4a1da4fd8bfce16cf3
- Merge commit: 4e27b98ce0a0827e54ade7e37939e0e1e6830d3e
- Push: success to origin/main
- Closeout note: Merged via merge-queue after approval.

7. Remaining Non-Goals / Debt

- No broad historical state migration across unrelated features
- No manual cleanup workflow as the product fix
- No review-cycle redesign beyond the narrow contract correction required here
- No KPI or product work unrelated to this merge/closeout defect