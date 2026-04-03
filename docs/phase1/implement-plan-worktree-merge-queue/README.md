# implement-plan-worktree-merge-queue

## Implementation Objective

Upgrade the repo-owned `implement-plan` skill so each feature stream can execute in a dedicated git worktree on a dedicated feature branch, stop at approval-ready merge state instead of landing directly on the base branch, and hand approved merge requests to a new FIFO merge skill that serializes landing per target branch and marks the feature completed only after merge and sync succeed.

## Requested Scope

Focus on `C:/ADF/skills/implement-plan/**`, a new repo-owned merge skill under `C:/ADF/skills/`, and the shared installer/runtime files needed to support the new skill and its truthful installed targets. Add worktree-aware state, worktree lifecycle management, merge-request handoff, queued merge execution, and safe local-branch sync after successful landing. Keep the current governed feature flow compact and truthful.

## Non-Goals

Do not redesign unrelated ADF product workflows. Do not broaden scope into a generic git platform. Do not weaken existing review-cycle orchestration, exact artifact contracts, or truthful status reporting.

## Artifact Map

- context.md
- implement-plan-state.json
- implement-plan-contract.md
- implement-plan-pushback.md
- implement-plan-brief.md
- implementation-run/
- completion-summary.md

## Lifecycle

- active
- blocked
- completed
- closed
