# Feature Context

## Feature

- phase_number: 1
- feature_slug: governed-state-writer-serialization
- project_root: C:/ADF
- feature_root: C:/ADF/.codex/implement-plan/worktrees/phase1/governed-state-writer-serialization/docs/phase1/governed-state-writer-serialization
- base_branch: main
- feature_branch: implement-plan/phase1/governed-state-writer-serialization

## Task Summary

Create a shared governed state-writer utility that each workflow feature stream can initialize as a feature-scoped handle. The handle must serialize writes for that feature, expose durable write outcomes, and let governance block on critical writes instead of assuming a state transition succeeded just because a helper command returned.

## Root Cause Summary

The immediate trigger was a real `review-cycle-state.json` race during `coo-live-executive-status-wiring` review closeout. Parallel helper mutations touched the same feature-local state file too closely together, the file became truncated, and the helper reinitialized state from defaults.

The deeper system problem is:

1. state mutation is still whole-file and helper-local
2. there is no per-feature single-writer discipline enforced by a shared utility
3. governance does not have one canonical `committed` barrier for critical writes
4. malformed state can still drift into unsafe reset-to-default recovery behavior

## Frozen Design Decisions

### Shared utility vs duplicated slice logic

- The writer must be one shared workflow-runtime utility.
- Feature slices and helpers must use the shared utility; they must not copy local queue, lock, or atomic-write logic.

### Feature-scoped handle model

- Governance initializes a feature-scoped handle once for the active feature stream.
- All related agents or sub-agents for that feature must use the same handle for governed local state writes.
- Different feature streams must remain isolated from each other.

### Critical vs advisory writes

- Critical writes must not allow governance to move forward until committed.
- Failed critical writes must hard-stop the route.
- Advisory writes may later use lighter semantics, but the first implementation priority is the critical governed path.

### Audit model

- Applied writes need durable local audit metadata such as revision/write ID and timestamp.
- Audit must be local/runtime-level, not one git commit per write.

### Recovery model

- Parse failure during an active cycle must fail closed and prefer conservative repair.
- Silent reset-to-default behavior is not acceptable for active governed workflow state.

## Expected Initial Touch Points

- `C:/ADF/skills/governed-feature-runtime.mjs`
- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/review-cycle/**`
- tightly scoped docs under `docs/phase1/governed-state-writer-serialization/`

## Notes

- The current immediate user request is to create and prepare the slice, not to start implementation yet.
- The implementation worker for this slice should be pinned to Claude Opus through the worker override fields, even though the local setup defaults remain on the codex-supported governed enum set.

## Notes

- This context file was created automatically during implement-plan prepare.
