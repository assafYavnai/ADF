---
name: merge-queue
description: Queue and land approved feature merges FIFO per target branch using isolated merge worktrees, truthful conflict reporting, and completion handoff back into implement-plan state.
---

# Merge Queue

Use this skill to inspect merge status, enqueue an approved feature merge, retry or requeue a blocked request, or process the next queued merge request for a target branch lane.

The authoritative source for this skill family is `C:/ADF/skills/merge-queue`.
Installed target copies under Codex, Claude, or Gemini roots are generated install output.

## Supported actions

- `action=help`
- `action=get-settings`
- `action=status`
- `action=enqueue`
- `action=retry-request`
- `action=requeue-request`
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

## Start sequence

1. If no inputs are provided, or `action=help`, run `merge-queue-helper.mjs help ...` and print the help output.
2. If `action=get-settings`, run `merge-queue-helper.mjs get-settings ...` and print the resolved settings summary.
3. If `action=status`, run `merge-queue-helper.mjs status ...` and print the compact queue summary.
4. For `action=enqueue`, `action=retry-request`, `action=requeue-request`, or `action=process-next`, read [references/workflow-contract.md](references/workflow-contract.md).
5. Load `<project_root>/.codex/merge-queue/setup.json` internally.
6. If setup is missing, stale, unparsable, incomplete, or internally inconsistent, read [references/setup-contract.md](references/setup-contract.md) and run the internal setup helper before continuing.
7. Use `merge-queue-helper.mjs` as the source of truth for queue state, merge execution, and local implement-plan operational closeout updates.

## Rules

- Queue requests FIFO per `base_branch` lane, not one global FIFO.
- Merge the exact approved commit SHA, not a moving branch head.
- Use an isolated merge worktree for landing.
- Fetch and validate the base ref, feature ref, and approved commit SHA before merge.
- Provide first-class retry or requeue actions for blocked requests; do not require manual queue JSON repair.
- If merge conflicts or push failures occur, surface them truthfully and leave the feature resumable instead of silently forcing completion.
- After successful merge, either fast-forward the shared root checkout safely or create a truthful clean target-sync worktree when the shared root checkout is dirty or on the wrong branch.
- Do not rewrite tracked feature artifacts after approval just to mirror queue progress or merge success; use local `.codex` operational state instead.

## Helper scripts

- `node C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs help ...`
- `node C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs get-settings ...`
- `node C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs status ...`
- `node C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs enqueue ...`
- `node C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs retry-request ...`
- `node C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs requeue-request ...`
- `node C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs process-next ...`
- `node C:/ADF/skills/merge-queue/scripts/merge-queue-setup-helper.mjs write-setup ...`
