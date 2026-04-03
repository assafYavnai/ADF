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

## Queue state

Persist queue state under `<project_root>/.codex/merge-queue/queue.json`.

Rules:

- group queued requests by `base_branch`
- preserve FIFO ordering inside each branch lane
- allow independent branch lanes to exist at the same time
- store request status truthfully as queued, in_progress, merged, or blocked

## Enqueue rules

- derive missing `base_branch`, `feature_branch`, `worktree_path`, and `approved_commit_sha` from implement-plan state when possible
- `last_commit_sha` is not merge authority and must never be used as the approved commit fallback
- reject enqueue when there is no approved commit SHA
- reject enqueue when the feature is already completed
- update implement-plan state to `merge_status=queued` when a request is accepted

## Process rules

- fetch before merge
- land the exact approved commit into a temporary merge worktree based on the latest target branch reference
- do not start a queued request on a `base_branch` lane while another request in that same lane is already `in_progress`
- push only after a clean merge
- on success, update implement-plan merge state, attempt safe local target sync, and mark the feature completed
- on failure, preserve queue evidence, update implement-plan state truthfully, and do not mark complete

## Sync rules

- always fetch the target branch locally after successful merge
- fast-forward the local target branch checkout only when it is both on the target branch and clean
- otherwise record a truthful sync status and continue
