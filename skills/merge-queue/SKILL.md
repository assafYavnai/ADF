---
name: merge-queue
description: Queue and land approved feature merges FIFO per target branch using isolated merge worktrees, truthful conflict reporting, and completion handoff back into implement-plan state.
---

# Merge Queue

Use this skill to inspect merge status, enqueue an approved feature merge, or process the next queued merge request for a target branch lane.

The authoritative source for this skill family is `C:/ADF/skills/merge-queue`.
Installed target copies under Codex, Claude, or Gemini roots are generated install output.

## Supported actions

- `action=help`
- `action=get-settings`
- `action=status`
- `action=enqueue`
- `action=process-next`

## Required inputs

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

## Start sequence

1. If no inputs are provided, or `action=help`, run `merge-queue-helper.mjs help ...` and print the help output.
2. If `action=get-settings`, run `merge-queue-helper.mjs get-settings ...` and print the resolved settings summary.
3. If `action=status`, run `merge-queue-helper.mjs status ...` and print the compact queue summary.
4. For `action=enqueue` or `action=process-next`, read [references/workflow-contract.md](references/workflow-contract.md).
5. Load `<project_root>/.codex/merge-queue/setup.json` internally.
6. If setup is missing, stale, unparsable, incomplete, or internally inconsistent, read [references/setup-contract.md](references/setup-contract.md) and run the internal setup helper before continuing.
7. Use `merge-queue-helper.mjs` as the source of truth for queue state, merge execution, and implement-plan handoff updates.

## Rules

- Queue requests FIFO per `base_branch` lane, not one global FIFO.
- Merge the exact approved commit SHA, not a moving branch head.
- Reject approved branch deltas that add or modify `.codex/*/setup.json`; those files are local operational state, not mergeable source. The one-time tracked-file removal is allowed.
- Validate closeout readiness before merge: `completion-summary.md` must exist and pass the required heading contract. Block the merge request when closeout readiness is invalid.
- Use an isolated merge worktree for landing.
- If merge conflicts or push failures occur, surface them truthfully and leave the feature resumable instead of silently forcing completion.
- After successful merge, fetch the target branch locally and fast-forward only when the local checkout is clean and safe.
- Mark the feature completed only after merge success updates implement-plan state truthfully.

## Helper scripts

- `node C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs help ...`
- `node C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs get-settings ...`
- `node C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs status ...`
- `node C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs enqueue ...`
- `node C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs process-next ...`
- `node C:/ADF/skills/merge-queue/scripts/merge-queue-setup-helper.mjs write-setup ...`
