# implement-plan-worktree-artifact-isolation

## Implementation Objective

Fix the main-checkout contamination bug where `implement-plan-helper.mjs` and `review-cycle-helper.mjs` write feature-local governance artifacts to `<project_root>/docs/phase<N>/<slug>/` (the main checkout) instead of the feature worktree. After this fix, all feature-local artifacts must be written exclusively inside the feature worktree, and the main checkout must remain clean of feature-stream files.

## Problem Statement

`buildPaths()` in `implement-plan-helper.mjs` resolves `featureRoot` from `projectRoot` (the main checkout). The `prepare` command writes README.md, context.md, implement-plan-state.json, pushback, and contract to that path before the worktree exists. The worktree is created afterward and gets a fresh base-branch snapshot that does not contain those artifacts. The same pattern exists in `review-cycle-helper.mjs` when called with `repo_root` pointing at the main checkout.

Result: every governed feature stream leaves orphan files on `main` that block future `git merge` and `git pull` operations, and worktree-vs-main versions of the same file diverge silently.

## Target Behavior

After this fix:

- `implement-plan prepare` creates or reuses the feature worktree **before** any feature-local artifact writes
- All feature-local artifacts (README.md, context.md, state, contract, pushback, brief, completion-summary, implementation-run, execution-contract) are written inside the worktree only
- `review-cycle-helper.mjs` follows the same worktree-first rule for its feature-local artifacts (review-cycle-state.json, README)
- Project-level shared state (setup.json, agent-registry.json, features-index.json, locks) stays in `<project_root>/.codex/implement-plan/`
- If worktree creation fails, the helper stops and reports failure through project-level state and prepare output only — it does not fall back to writing feature-local artifacts on main
- The main checkout remains clean of feature-stream artifacts after any `prepare` or `run` invocation

## Frozen Artifact-Root Model

| Root class | Location | What lives here |
|---|---|---|
| **Project-level shared state** | `<project_root>/.codex/implement-plan/` | setup.json, agent-registry.json, features-index.json, locks/ |
| **Feature worktree root** | `<project_root>/.codex/implement-plan/worktrees/phase<N>/<slug>/` | git worktree checkout |
| **Feature-local artifact root** | `<worktree_root>/docs/phase<N>/<slug>/` | README.md, context.md, state.json, contract, pushback, brief, completion-summary, cycle-NN/, review-cycle-state.json |
| **Failure-state root** | `<project_root>/.codex/implement-plan/` (project-level) | prepare output JSON, features-index status. No feature-local docs created on main. |

## Observed Impact

- Uncommitted files accumulate on `main` from every governed feature stream
- These files block `git merge` and `git pull` with "untracked working tree files would be overwritten"
- Worktree and main-checkout versions of the same artifact diverge silently
- Manual cleanup is required before every merge to main

## Non-Goals

- Do not redesign the worktree lifecycle, merge-queue, or merge-closeout
- Do not change how the implementor worker runs inside the worktree
- Do not change the feature artifact layout, file names, or heading contracts
- Do not change review-cycle auditor/reviewer/implementor dispatch or prompt templates
- Do not migrate or clean up existing orphan artifacts on main — that is a separate follow-up

## Implementation Readiness

This slice is implementation-ready. The artifact-root model is frozen, the contamination paths in both helpers are traced with line numbers, the acceptance gates are concrete, and the fix strategy is defined. Proceed through the governed `implement-plan` path.
