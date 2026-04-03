1. Failure Classes Closed

- merge-approval-bypass
- same-lane-merge-serialization-breach

2. Route Contracts Now Enforced

- Only `approved_commit_sha` can authorize merge-queue enqueue. `last_commit_sha` remains implementation evidence and no longer acts as a shared merge authority fallback.
- `process-next` now skips any `base_branch` lane that already has an `in_progress` request, so same-lane FIFO cannot overlap while other branch lanes remain independently runnable.

3. Files Changed And Why

- [merge-queue-helper.mjs](/C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs): removed `last_commit_sha` fallback from enqueue authority and made lane selection skip lanes with an `in_progress` request.
- [workflow-contract.md](/C:/ADF/skills/merge-queue/references/workflow-contract.md): tightened the merge contract so approval authority is explicitly `approved_commit_sha` only and same-lane `in_progress` requests block additional selection.
- [completion-summary.md](/C:/ADF/docs/phase1/implement-plan-worktree-merge-queue/completion-summary.md): refreshed the feature-level summary so review-cycle evidence and remaining closeout truth match the current slice state.

4. Sibling Sites Checked

- Queue entry fallback surfaces in [merge-queue-helper.mjs](/C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs)
- Lane selection and lane summary behavior in [merge-queue-helper.mjs](/C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs)
- Generated install targets refreshed through `manage-skills install/check` for Codex, Claude, and Gemini

5. Proof Of Closure

- Proved route: approved feature state -> `merge-queue enqueue` -> `process-next` -> merge on target branch
- Machine Verification: `node --check C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
- Machine Verification: `git -C C:/ADF diff --check -- C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs C:/ADF/skills/merge-queue/references/workflow-contract.md C:/ADF/docs/phase1/implement-plan-worktree-merge-queue/cycle-01/audit-findings.md C:/ADF/docs/phase1/implement-plan-worktree-merge-queue/cycle-01/review-findings.md C:/ADF/docs/phase1/implement-plan-worktree-merge-queue/cycle-01/fix-plan.md`
- Negative proof: temp repo under `C:/ADF/tmp/merge-queue-cycle-proof` rejected enqueue when only `last_commit_sha` existed and no `approved_commit_sha` was present
- Negative proof: the same temp proof left the `main` lane blocked while one `main` request was already `in_progress`
- Cross-lane proof: the same temp proof still processed the `release` lane successfully and landed merge commit `072f9e4dad5be3836c23a62ec5a3cdb9cc9094f7` with `origin/release:app.txt` showing `base` then `feature-release`
- Live/proof isolation checks: all proof used the public helper entry points plus temp git sandboxes; no test-only bypass flags were added to live skill behavior
- Generated target proof: `manage-skills install/check` passed sequentially for Codex, Claude, and Gemini after the fix

6. Remaining Debt / Non-Goals

- This cycle did not retroactively force the current feature stream through its own merge-queue closeout. The remaining route work is the clean approval pass for the already-landed slice.

7. Next Cycle Starting Point

- Rerun the auditor/reviewer full pair against the current `merge-queue` helper and contract to confirm the approval boundary and same-lane FIFO route now close cleanly without reopening scope.
