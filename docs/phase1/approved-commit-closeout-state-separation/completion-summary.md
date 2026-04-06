1. Objective Completed

Fixed the governed merge/closeout state model so pre-merge readiness relies on `approved_commit_sha` instead of `last_commit_sha`, while post-merge closeout still records `merge_commit_sha` and `last_commit_sha` truthfully.

2. Deliverables Produced

- Corrected `validateCloseoutReadiness` to check `approved_commit_sha` instead of `last_commit_sha` for the pre-merge gate
- Updated the `implement-plan` workflow contract to document the separated pre-merge and post-merge state model
- Updated the `merge-queue` workflow contract to document the new readiness requirements
- Added 7 targeted tests covering pre-merge readiness, merge authority, and mark-complete fail-closed behavior
- Preserved the post-merge `mark-complete` requirement for `last_commit_sha`

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

Review-Cycle Status: not run (machine-only route; `post_send_to_review=false`)

Merge Status: pending merge-queue

Local Target Sync Status: pending

5. Feature Artifacts Updated

- `docs/phase1/approved-commit-closeout-state-separation/completion-summary.md` - this file

6. Commit And Push Result

Pending governed feature-branch commit and push by the orchestrator after machine verification.

7. Remaining Non-Goals / Debt

- No broad historical state migration across unrelated features
- No manual cleanup workflow as the product fix
- No review-cycle redesign beyond the narrow contract correction required here
- No KPI or product work unrelated to this merge/closeout defect
