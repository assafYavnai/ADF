# governed-approval-gates-and-local-sync-hardening

## Implementation Objective

Harden the governed implementation-review-merge-complete route so required human verification, split-review truth, and local target synchronization are enforced before merge or completion. The route must stop treating dirty local checkouts as a reason to skip sync silently and must instead use an explicit preserve-sync-restore policy that keeps user changes safe and auditable.

## Why This Slice Exists Now

- `coo-live-executive-status-wiring` proved a real route defect: the slice contract required human verification, but merge and completion still happened without durable human-verification truth.
- The same landing also showed that split review truth can still leak into merge/completion narratives even when the final review state is not a clean all-green approval.
- `merge-queue` currently records `skipped_dirty_checkout` instead of preserving local dirt, syncing the target branch, and restoring the local state afterward.
- `governed-implementation-route-hardening` already landed on `origin/main`, so these requirements need a new bounded governance slice instead of widening a completed stream.

## Requested Scope

- `skills/implement-plan/**`
- `skills/review-cycle/**`
- `skills/merge-queue/**`
- tightly scoped shared helper/runtime files under `skills/**` only when required for this route
- `skills/tests/**` when directly required to prove the new governed behavior
- `docs/bootstrap/cli-agent.md` only if operator guidance must change to reflect the new route truth
- `docs/phase1/governed-approval-gates-and-local-sync-hardening/**`

## Required Deliverables

- merge-time gating that refuses landing when human verification is required but not durably satisfied
- closeout validation that fails when human-verification truth is missing, stale, or contradicted by later behavior-changing commits
- review/approval gating that prevents split review verdicts from becoming merge-ready or completed truth
- explicit stale-human-approval invalidation when post-human code changes affect the approved human-facing route
- pre-resume refresh of origin truth for governed worktrees before implementation continues
- pre-merge refresh of origin truth for target branches before landing
- local target sync that stashes tracked and untracked changes, syncs, then restores local state explicitly instead of skipping dirty checkouts
- fail-closed recovery behavior when stash restore conflicts or cannot be completed safely
- targeted tests and proof artifacts that cover both happy-path and negative-path behavior

## Allowed Edits

- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/review-cycle/**`
- `C:/ADF/skills/merge-queue/**`
- tightly scoped shared helper/runtime files under `C:/ADF/skills/**` only when required for this route
- `C:/ADF/skills/tests/**` when directly required to prove the route
- `C:/ADF/docs/bootstrap/cli-agent.md` if route guidance must change
- `C:/ADF/docs/phase1/governed-approval-gates-and-local-sync-hardening/**`

## Forbidden Edits

- no product-surface COO changes
- no unrelated slice changes
- no weakening of review, human approval, merge, or closeout gates
- no silent discard of tracked or untracked local changes
- no undocumented stash/pop side effects as the intended route
- no broad git UX redesign outside the governed implementation route
- no manual merge-worktree workaround documented as the intended happy path

## Machine Verification Plan

- targeted helper and route tests for human-verification gating before merge
- targeted helper and route tests for stale human approval after post-human changes
- targeted helper and route tests proving split review verdicts cannot become merge-ready/completed
- targeted helper and temp-repo smoke for clean local sync, dirty tracked sync, dirty untracked sync, and restore-failure handling
- `node --check` on modified helper/runtime scripts
- `git diff --check`

## Human Verification Plan

- Required: false
- Reason: this slice hardens governed workflow helpers and contracts rather than changing a user-facing product route

## Artifact Map

- `README.md`
- `context.md`
- `requirements.md`
- `decisions.md`
- `implement-plan-contract.md`
- `implement-plan-state.json`
- `implement-plan-pushback.md`
- `implement-plan-brief.md`
- `implement-plan-execution-contract.v1.json`
- `implementation-run/`
- `completion-summary.md`

## Lifecycle

- active
- blocked
- completed
- closed
