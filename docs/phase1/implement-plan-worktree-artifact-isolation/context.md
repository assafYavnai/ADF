# Feature Context

## Feature

- phase_number: 1
- feature_slug: implement-plan-worktree-artifact-isolation
- project_root: C:/ADF
- feature_root: C:/ADF/docs/phase1/implement-plan-worktree-artifact-isolation
- original_seed_commit: 22a9fce

## Task Summary

Fix the root cause of main-checkout contamination: both `implement-plan-helper.mjs` and `review-cycle-helper.mjs` resolve feature artifact paths relative to `project_root` (the main checkout) and write governance artifacts there before the feature worktree exists. After this fix, the worktree must be created first, all feature-local writes must target the worktree, and worktree-creation failure must stop the helper instead of falling back to main-checkout writes.

## Artifact-Root Classes

The implementation must distinguish exactly four root classes:

1. **Project-level shared state root** (`<project_root>/.codex/implement-plan/`)
   - setup.json, agent-registry.json, features-index.json, locks/
   - Shared across feature streams, stays in the main checkout

2. **Feature worktree root** (`<project_root>/.codex/implement-plan/worktrees/phase<N>/<slug>/`)
   - Git worktree checkout on the feature branch
   - Created by `ensureFeatureWorktree()` via `git worktree add`

3. **Feature-local artifact root** (`<worktree_root>/docs/phase<N>/<slug>/`)
   - README.md, context.md, implement-plan-state.json, implement-plan-contract.md, implement-plan-pushback.md, implement-plan-brief.md, completion-summary.md, implementation-run/, review-cycle-state.json, cycle-NN/
   - Must be inside the feature worktree, NOT under the main checkout

4. **Failure-state root** (`<project_root>/.codex/implement-plan/`)
   - When worktree creation fails, the failure is recorded in project-level output (prepare JSON result, features-index)
   - Must NOT create or update files under `<project_root>/docs/phase<N>/<slug>/`

## Root Cause Analysis

### Contamination path in implement-plan-helper.mjs

1. `buildPaths(projectRoot, ...)` at line 1615 computes `featureRoot = resolveFeatureRoot(projectRoot, phaseNumber, featureSlug)` where `projectRoot = C:/ADF`
2. All artifact paths derive from `featureRoot`: `readmePath`, `contextPath`, `statePath`, `contractPath`, `pushbackPath`, `briefPath`, `completionSummaryPath`
3. `prepare` command at lines 492-787 writes directly to these paths:
   - `ensureFeatureReadme()` line 3317 writes `README.md`
   - `ensureFeatureContext()` line 3358 writes `context.md`
   - State write at line 787 writes `implement-plan-state.json`
   - Pushback write at line 619 writes `implement-plan-pushback.md`
   - Contract write at line 2829 writes `implement-plan-contract.md`
   - Implementation-run mkdir at line 494 creates the directory
4. The worktree is created later at line 1697 (`git worktree add`) — AFTER these writes
5. The worktree gets a fresh base-branch snapshot that does NOT contain the artifacts just written to main
6. Result: artifacts exist in both locations with diverging content

### Contamination path in review-cycle-helper.mjs

1. `resolveFeatureRoot(repoRoot, ...)` at line 408 uses whatever `repo_root` is passed
2. When called with `repo_root=C:/ADF` (before the SKILL.md orchestrator redirects to the worktree), it writes `review-cycle-state.json` and README to the main checkout at line 516 and line 1856
3. When subsequently called with `repo_root=<worktree_path>`, it writes to the worktree — creating a second divergent copy
4. `review-cycle-helper.mjs` is part of the same contamination class and must follow the same worktree-first artifact-root rules

### Files contaminated per feature stream

Each governed feature stream leaves these orphan files on the main checkout:
- `docs/phase1/<slug>/README.md`
- `docs/phase1/<slug>/context.md`
- `docs/phase1/<slug>/implement-plan-state.json`
- `docs/phase1/<slug>/implement-plan-contract.md` (when normalized)
- `docs/phase1/<slug>/implement-plan-pushback.md` (when integrity fails)
- `docs/phase1/<slug>/review-cycle-state.json` (when review-cycle runs with main checkout as repo_root)

## Frozen Design Decisions

### Fallback behavior

- If worktree creation succeeds: feature-local artifacts are written only inside the worktree. No writes to `<project_root>/docs/phase<N>/<slug>/`.
- If worktree creation fails: the helper must stop truthfully and report the failure through project-level state and prepare output JSON only. It must NOT fall back to creating or updating files under `<project_root>/docs/phase<N>/<slug>/` on main.
- There is no "write to main as fallback" path. Worktree failure is a hard stop.

### Legacy read/write precedence

- **Read**: check `<worktree_root>/docs/phase<N>/<slug>/` first. If not found, fall back to `<project_root>/docs/phase<N>/<slug>/` for backward compatibility with features that already have state on main.
- **Write**: always write to `<worktree_root>/docs/phase<N>/<slug>/`. Never write feature-local artifacts to the main checkout.
- Once worktree-local state exists, all subsequent reads and writes use the worktree path exclusively.
- The legacy fallback is for reading existing state only, not for continuing main-root writes.

### Review-cycle participation

`review-cycle-helper.mjs` is explicitly part of this fix scope. It follows the same contamination pattern and must follow the same worktree-first artifact-root rules. It is not optional or conditional.

## Discovered Authorities

- [skill-doc] C:/ADF/skills/implement-plan/SKILL.md
- [skill-doc] C:/ADF/skills/implement-plan/references/workflow-contract.md
- [skill-doc] C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs
- [skill-doc] C:/ADF/skills/review-cycle/SKILL.md
- [skill-doc] C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs
- [skill-doc] C:/ADF/skills/governed-feature-runtime.mjs

## Notes

- The default branch is `main`; treat "master" as `main`.
- Human verification is required because this changes the artifact write path for every future governed feature stream.
- The original seed was committed at `22a9fce`. This update tightens the plan without changing the slice topic.
