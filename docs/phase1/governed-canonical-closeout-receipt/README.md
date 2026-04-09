# governed-canonical-closeout-receipt

## Implementation Objective

Create one canonical post-merge closeout receipt and canonical repo-root closeout rewrite path for governed Phase 1 slices so committed feature-local truth on `main` is explicit, machine-usable, and free of merge-worktree path leakage or stale pre-merge lifecycle wording.

## Problem Statement

Recent governed closeout work exposed a specific open loop that is now blocking a safe `develop` front door.

The current route can finish merge and completion truth while still leaving committed feature-local artifacts in an ambiguous or non-canonical state.

The concrete failure family is:

- committed feature-local state can preserve merge-queue worktree roots or worktree-local artifact paths on `main`
- completion summaries can preserve stale pre-merge or earlier-cycle lifecycle wording after later closeout reconciliation
- later reconciliation commits can be real, but the feature-local state may still record a different `last_commit_sha`, making closeout reports easy to overstate or misread
- report-time runtime observations such as local sync counts can be blended into closeout narratives without one canonical committed receipt that separates runtime observations from repo-owned truth

This is a governed closeout correctness defect, not a COO product-surface defect.

## Target Behavior

After this slice:

- every governed slice that reaches final closeout on `main` has one canonical machine-facing closeout receipt under the feature root
- committed feature-local closeout truth on `main` uses canonical repo-root paths, not merge-queue worktree roots
- lifecycle-sensitive completion-summary content is regenerated from current committed state plus the canonical closeout receipt instead of preserving stale pre-merge or stale earlier-cycle wording
- approved-feature commit, review-closeout commit, approval-handoff commit when present, merge commit, and later reconciliation commit when present are all represented explicitly and non-ambiguously
- runtime-only observations stay explicitly separated from committed repo-owned truth
- if canonical post-merge rewrite fails, the route fails closed instead of recording a misleading final closeout

## Requested Scope

Keep this slice bounded to:

- the governed post-merge closeout path for feature-local Phase 1 artifacts
- helper/runtime logic needed to emit a canonical closeout receipt
- helper/runtime logic needed to canonicalize committed repo-root paths after merge and final closeout reconciliation
- completion-summary lifecycle regeneration or equivalent deterministic rewrite for lifecycle-sensitive sections
- tightly scoped tests and proof for the above
- Phase 1 docs under `docs/phase1/governed-canonical-closeout-receipt/`

## Non-Goals

- do not redesign COO product routes
- do not redesign review-cycle behavior
- do not redesign lane admission or `dev_team`
- do not widen into full projection unification across all global control-plane views
- do not redesign Brain or provenance systems
- do not redesign merge semantics or approval semantics beyond making closeout truth canonical and explicit

## Artifact Map

- README.md
- context.md
- implement-plan-contract.md
- implement-plan-state.json
- implement-plan-brief.md
- implement-plan-pushback.md
- implementation-run/
- completion-summary.md

## Lifecycle

- active
- blocked
- completed
- closed
