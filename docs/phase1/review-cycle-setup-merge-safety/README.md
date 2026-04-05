# review-cycle-setup-merge-safety

## Implementation Objective

Prevent merge conflicts from tracked worktree-local `.codex` setup files by treating `review-cycle` setup as local operational state and blocking governed merge closeout when such setup files are present in an approved branch delta.

## Requested Scope

Keep the fix inside `review-cycle` local setup handling, `merge-queue` merge safety, and the authority docs that describe those contracts.

## Non-Goals

Do not redesign review routing, worker selection, merge strategy, or unrelated implement-plan artifact behavior.

## Artifact Map

- README.md
- context.md
- implement-plan-contract.md
- review-cycle-state.json
- cycle-01/

## Lifecycle

- active
- blocked
- completed
- closed
