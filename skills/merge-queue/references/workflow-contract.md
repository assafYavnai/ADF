# Merge-Queue Workflow Contract

Use this file as the execution contract for the skill.

## Inputs

For `action=enqueue`:

- `project_root`
- `phase_number`
- `feature_slug`

Optional enqueue inputs:

- `approved_commit_sha`
- `base_branch`
- `feature_branch`
- `worktree_path`
- `queue_note`

For `action=process-next`:

- `project_root`

Optional process inputs:

- `base_branch`
- `sync_local_target` default `true`

For `action=retry-request`:

- `project_root`
- `request_id`

Optional retry inputs:

- `queue_note`

For `action=requeue-request`:

- `project_root`
- `request_id`

Optional requeue inputs:

- `approved_commit_sha`
- `base_branch`
- `feature_branch`
- `worktree_path`
- `queue_note`

## Queue state

Persist queue state under `<project_root>/.codex/merge-queue/queue.json`.

Rules:

- group queued requests by `base_branch`
- preserve FIFO ordering inside each branch lane
- allow independent branch lanes to exist at the same time
- store request status truthfully as queued, in_progress, merged, or blocked
- preserve blocked or superseded request history instead of requiring manual queue JSON edits

## Enqueue rules

- derive missing `base_branch`, `feature_branch`, `worktree_path`, and `approved_commit_sha` from local `.codex/implement-plan/features-index.json` when possible
- use tracked feature-state docs only as a fallback source of truth when local operational handoff data is incomplete
- `last_commit_sha` is not merge authority and must never be used as the approved commit fallback
- reject enqueue when there is no approved commit SHA
- reject enqueue when the feature is already completed
- update local implement-plan operational state to `merge_status=queued` when a request is accepted

## Recovery rules

- `retry-request` must move a blocked request back to `queued` without erasing the fact that it was previously blocked
- `requeue-request` must create a new queued request that can supersede a blocked request without deleting the blocked request
- surface a truthful next action for blocked requests instead of forcing manual queue JSON edits

## Process rules

- fetch the target base ref before merge
- fetch the feature ref that is expected to contain the approved SHA before merge
- prove the approved SHA exists locally after fetch before attempting the merge
- prove the approved SHA is reachable from the fetched feature ref before attempting the merge
- land the exact approved commit into a temporary merge worktree based on the latest target branch reference
- do not start a queued request on a `base_branch` lane while another request in that same lane is already `in_progress`
- push only after a clean merge
- on success, update local implement-plan operational state truthfully and record merge success without rewriting tracked feature artifacts after approval
- on failure, preserve queue evidence, update local implement-plan operational state truthfully, and do not claim completion

## Sync rules

- always fetch the target branch locally after successful merge
- fast-forward the shared root target branch checkout only when it is both on the target branch and clean
- when the shared root checkout is dirty or on the wrong branch, create or refresh a clean target-sync worktree and record that truthful result instead of downgrading merge success
- keep shared-root sync truth separate from merge success
