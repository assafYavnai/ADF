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
- reject enqueue when governed closeout readiness is not yet satisfied
- reject enqueue when the approved branch delta adds or modifies `.codex/*/setup.json`
- update implement-plan state to `merge_status=queued` when a request is accepted

## Process rules

- fetch before merge
- land the exact approved commit into a temporary merge worktree based on the latest target branch reference
- reject stale queue requests: if `approved_commit_sha` is already an ancestor of the target branch, block the request instead of re-merging
- re-check the approved branch delta before merge and block the request if `.codex/*/setup.json` is added or modified
- validate closeout readiness before merge: `completion-summary.md` must exist and satisfy the required heading contract, the feature must not already be completed, and `approved_commit_sha` must be present in state. Pre-merge readiness does not require `last_commit_sha` — that is post-merge closeout evidence set after the merge lands
- block the request before merge/push when closeout readiness is invalid
- if human verification is required, closeout readiness must prove durable approval for the current `approved_commit_sha`
- if review-cycle evidence exists, only completed dual approval is merge-eligible
- do not start a queued request on a `base_branch` lane while another request in that same lane is already `in_progress`
- push only after a clean merge
- on success, update implement-plan merge state, refresh the local target branch, and mark the feature completed only after sync truth is recorded
- on failure, preserve queue evidence, update implement-plan state truthfully, and do not mark complete

## Blocked-merge resume/resolve rules

When a merge request is blocked, the governed recovery path is `resume-blocked`, not manual merge worktrees.

For `resume-blocked`:

- `project_root`
- `request_id`

Optional:

- `approved_commit_sha`
- `base_branch`

Rules:

- find the blocked request in the queue by `request_id`
- fail if the request does not exist or is not in `blocked` status
- if the original blocker was a stale commit (approved SHA is already an ancestor of base), the invoker must supply a new `approved_commit_sha`
- if the original blocker was a merge conflict, the invoker must fix the feature branch first and supply the new approved commit
- if the original blocker was a closeout readiness failure, the invoker must fix readiness before resuming
- validate the new `approved_commit_sha` against the same constraints as enqueue: reject if missing, reject if already an ancestor
- when the new `approved_commit_sha` passes validation, re-queue the request with `status=queued`, update `approved_commit_sha`, clear `last_error` and `blocked_at`
- update implement-plan feature state to `merge_status=queued` and `active_run_status=merge_queued`
- `resume-blocked` must not merge or push directly — it returns the request to the queue so `process-next` handles the actual merge
- manual merge worktrees are not the intended product-path recovery route

## Sync rules

- always fetch the target branch locally after successful merge
- if the local checkout is already on the target branch and clean, fast-forward it directly
- if the local checkout is on the target branch and dirty, preserve tracked and untracked changes first, fast-forward the branch, then restore the preserved local state
- if preserve or restore fails, fail closed, keep durable recovery evidence, and do not mark the feature completed
- if the local checkout is not on the target branch, record a truthful fetched-only outcome instead of mutating the wrong checkout
