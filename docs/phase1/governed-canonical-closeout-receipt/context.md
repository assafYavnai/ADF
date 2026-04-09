# Feature Context

## Feature

- phase_number: 1
- feature_slug: governed-canonical-closeout-receipt
- project_root: C:/ADF
- feature_root: C:/ADF/docs/phase1/governed-canonical-closeout-receipt
- base_branch: main
- feature_branch: implement-plan/phase1/governed-canonical-closeout-receipt

## Task Summary

Create the missing canonical post-merge closeout substrate required before ADF exposes a boxed `develop` front door. The closeout route must emit one canonical machine-facing receipt, canonicalize committed repo-root truth after merge, separate runtime observations from committed truth, and regenerate lifecycle-sensitive summary wording from current state instead of preserving stale wording.

## Root Cause Summary

The immediate trigger is not one isolated helper bug. It is a repeatable closeout truth failure class visible across recent governed slices.

### Failure family A — merge-worktree path leakage into committed feature-local truth

Current committed `coo-live-executive-status-wiring/implement-plan-state.json` on `main` records:

- `project_root = C:/ADF/.codex/merge-queue/worktrees/main/merge-main-1-coo-live-executive-status-wiring-1775719387061`
- multiple `artifacts.*` paths under that merge-queue worktree root

That means the committed feature-local implement-plan state is not fully canonical repo-root truth on `main`.

### Failure family B — stale lifecycle wording survives later closeout

Current committed `coo-live-executive-status-wiring/completion-summary.md` on `main` still mixes stale and current lifecycle claims at the same time, including lines that say:

- merge to `main` has not happened yet
- final merge-queue landing still needs to run
- cycle-07 closeout wording

while the same file also claims later merged closeout truth and cycle-12 closure.

That means completion-summary lifecycle text is still being preserved or appended instead of being deterministically regenerated from current state and closeout truth.

### Failure family C — commit-role ambiguity after later reconciliation

Recent closeout work also showed that a slice can legitimately have several different important SHAs:

- review closeout commit
- later approval-handoff commit
- merge commit
- later reconciliation docs/state commit

Without one canonical closeout receipt, it becomes too easy for human reports to overstate which SHA became the feature-local final commit authority.

### Failure family D — runtime observations are not durably separated from committed truth

Runtime checks such as:

- `git rev-list --left-right --count origin/main...HEAD`
- whether root `main` is synced at report time
- whether a dirty root checkout was intentionally left untouched

may be useful in operator reports, but they are not the same thing as committed feature-local truth. The route still lacks one canonical artifact that makes that distinction explicit.

## Explicit Design Direction For This Slice

### One canonical machine-facing closeout receipt

This slice must add one canonical per-feature closeout receipt under the feature root on `main`.

It is the machine-facing answer to:

- what exactly was approved
- what exactly was merged
- what later reconciliation happened
- what was already landed versus newly landed during reconciliation
- which facts are committed repo truth versus runtime-only observations

### Canonical repo-root rewrite after final closeout

If a later merge-queue or reconciliation worktree is used to finish closeout, the final committed feature-local state on `main` must still be rewritten to canonical repo-root truth.

Committed feature-local artifacts on `main` must not preserve merge-queue worktree roots as their final canonical path surface.

### Completion-summary lifecycle regeneration

This slice must not merely patch around stale lines.

Lifecycle-sensitive completion-summary content must be regenerated from current state plus closeout receipt truth so the final file cannot simultaneously say both:

- merge has not happened
- merge has happened

or both:

- closeout still remains
- closeout is already completed

### Clear commit-role semantics

The route must represent, explicitly and separately when present:

- approved feature commit
- review closeout commit
- approval-handoff commit
- merge commit
- later reconciliation commit

The route must not require a human reader to infer which SHA means what.

## Expected Initial Touch Points

- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/merge-queue/**`
- the smallest shared workflow-runtime helper surface strictly needed for canonical closeout receipt emission or canonical rewrite
- tightly scoped docs under `docs/phase1/governed-canonical-closeout-receipt/`

## Constraints

- keep this slice bounded to feature-local post-merge closeout truth
- do not widen into full control-plane projection unification
- do not redesign approval gates or review-cycle semantics
- do not redesign the actual product route of `coo-live-executive-status-wiring`
- preserve existing merge authority and merge-queue request semantics

## Notes

- This slice exists to make a future public `develop` front door trustworthy.
- The first consumer of this substrate is the later `develop` boxed-front-door slice, not COO itself.
- The implementation worker should not be forced to infer intent from conversation context; the contract for this slice must be explicit enough to execute directly.
