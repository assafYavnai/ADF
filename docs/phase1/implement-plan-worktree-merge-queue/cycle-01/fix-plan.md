1. Failure Classes

- merge-approval-bypass
- same-lane-merge-serialization-breach

2. Route Contracts

- merge-approval-bypass
  claimed supported route: reviewed feature state -> merge-queue enqueue -> process-next -> target branch merge
  end-to-end invariants: enqueue accepts only an explicitly approved commit; `last_commit_sha` is implementation evidence and must never grant merge authority
  allowed mutation surfaces: merge-queue enqueue helper logic, merge-queue workflow contract wording, route-level proof artifacts for approved vs unapproved queue entry
  forbidden shared-surface expansion: do not add new override flags or alternate approval bypass paths on queue entry
  docs that must be updated: [workflow-contract.md](/C:/ADF/skills/merge-queue/references/workflow-contract.md), [completion-summary.md](/C:/ADF/docs/phase1/implement-plan-worktree-merge-queue/completion-summary.md)

- same-lane-merge-serialization-breach
  claimed supported route: queued requests on one `base_branch` lane -> process-next -> exactly one in-progress merge worktree per lane
  end-to-end invariants: a lane with one `in_progress` request cannot start another request on the same branch until that request resolves; other branch lanes stay independently runnable
  allowed mutation surfaces: merge-queue request selection helper logic, queue-state smoke proof, merge-queue workflow contract wording
  forbidden shared-surface expansion: do not introduce a global scheduler or cross-lane locking beyond what is needed to honor per-lane FIFO
  docs that must be updated: [workflow-contract.md](/C:/ADF/skills/merge-queue/references/workflow-contract.md), [completion-summary.md](/C:/ADF/docs/phase1/implement-plan-worktree-merge-queue/completion-summary.md)

3. Sweep Scope

- [merge-queue-helper.mjs](/C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs) enqueue approval fallback, queue selection, and lane summary behavior
- [workflow-contract.md](/C:/ADF/skills/merge-queue/references/workflow-contract.md) enqueue/process rules for exact approved commit and per-lane FIFO
- temp merge-queue smoke coverage under `C:/ADF/tmp` to prove approval rejection, same-lane blocking, and cross-lane independence

4. Planned Changes

- Remove `last_commit_sha` as an enqueue authority fallback so queue entry requires an explicit approved commit from input or persisted approval state.
- Make lane selection skip any `base_branch` lane that already has an `in_progress` request.
- Add machine proof for:
  - rejection when only `last_commit_sha` exists
  - same-lane second request remaining queued
  - different-lane request still selectable

5. Closure Proof

- Route to prove: approved feature state -> enqueue -> process-next -> merge on target branch
- Negative proof required:
  - enqueue rejects a feature state with no `approved_commit_sha`
  - process-next does not start a second same-branch request while one is `in_progress`
- Live/proof isolation checks:
  - use temp git sandboxes and queue files only; do not rely on special production bypass flags
  - verify the same helper code paths used by the live skill entry points
- Targeted regression checks:
  - `node --check` on modified helpers
  - `git diff --check`
  - temp queue smoke for approval rejection
  - temp queue smoke for same-lane block and cross-lane independence

6. Non-Goals

- None.
