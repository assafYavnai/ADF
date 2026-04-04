# implement-plan-worktree-artifact-isolation

## Implementation Objective

Fix the main-checkout contamination bug where `implement-plan-helper.mjs` and `review-cycle-helper.mjs` write governance artifacts (README.md, context.md, implement-plan-state.json, implement-plan-contract.md, implement-plan-pushback.md, review-cycle-state.json) directly to the main checkout instead of the feature worktree. This causes uncommitted files on `main` that block future merges, creates stale duplicates that diverge from worktree versions, and violates the worktree-first isolation contract.

## Problem Statement

When `implement-plan` is invoked with `--project-root C:/ADF`, the helper's `buildPaths()` function resolves `featureRoot` to `C:/ADF/docs/phase1/<slug>/` — the main checkout. The `prepare` command then writes governance artifacts directly there (README.md at line 3317, context.md at line 3358, implement-plan-state.json at line 787, pushback at line 619, contract at line 2829). The worktree is only created *after* prepare succeeds, meaning every prepare call contaminates the main checkout with feature artifacts that should only exist on the feature branch.

The same pattern exists in `review-cycle-helper.mjs` where `resolveFeatureRoot(repoRoot, ...)` writes `review-cycle-state.json` and README to whatever `repo_root` is passed.

## Observed Impact

- Uncommitted files accumulate on `main` from every governed feature stream
- These files block `git merge` and `git pull` operations
- Worktree and main-checkout versions of the same file diverge silently
- Manual cleanup is required before every merge to main

## Non-Goals

- Do not redesign the worktree lifecycle or merge-queue
- Do not change how the implementor worker runs inside the worktree
- Do not change the feature artifact layout or heading contracts
- Do not change review-cycle auditor/reviewer/implementor dispatch

## Artifact Map

- context.md
- implement-plan-contract.md
- implement-plan-state.json
- implement-plan-pushback.md
- implement-plan-brief.md
- implementation-run/
- completion-summary.md

## Lifecycle

- active
