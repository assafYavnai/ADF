# Feature Context

## Feature

- phase_number: 1
- feature_slug: implement-plan-worktree-artifact-isolation
- project_root: C:/ADF
- feature_root: C:/ADF/docs/phase1/implement-plan-worktree-artifact-isolation

## Task Summary

Fix the root cause of main-checkout contamination: the implement-plan and review-cycle helpers resolve feature artifact paths relative to project_root (the main checkout) instead of the feature worktree. Governance artifacts must be written to the worktree path once it exists, and the prepare command must either create the worktree before writing artifacts or write to a staging location that gets moved into the worktree.

## Root Cause Analysis

### Contamination path in implement-plan-helper.mjs

1. `buildPaths(projectRoot, ...)` at line 1615 computes `featureRoot = resolveFeatureRoot(projectRoot, phaseNumber, featureSlug)` where `projectRoot = C:/ADF`
2. All artifact paths derive from `featureRoot`: `readmePath`, `contextPath`, `statePath`, `contractPath`, `pushbackPath`, `briefPath`, `completionSummaryPath`
3. `prepare` command at line 492-787 writes directly to these paths: `ensureFeatureReadme()` line 3317, `ensureFeatureContext()` line 3358, state at line 787, pushback at line 619, contract at line 2829
4. The worktree is created later at line 1697 (`git worktree add`) and gets a fresh checkout from the base branch — which does NOT contain the artifacts just written to the main checkout
5. Result: artifacts exist in both locations with different content

### Contamination path in review-cycle-helper.mjs

1. `resolveFeatureRoot(repoRoot, ...)` at line 408 uses whatever `repo_root` is passed
2. When called with `repo_root=C:/ADF` (happens during initial prepare before the SKILL.md orchestrator redirects to the worktree), it writes `review-cycle-state.json` and README to the main checkout
3. When subsequently called with `repo_root=<worktree_path>`, it writes to the worktree — creating a second copy

### Files affected per feature stream

Each governed feature stream leaves these orphan files on the main checkout:
- `docs/phase1/<slug>/README.md`
- `docs/phase1/<slug>/context.md`
- `docs/phase1/<slug>/implement-plan-state.json`
- `docs/phase1/<slug>/implement-plan-contract.md` (when normalized)
- `docs/phase1/<slug>/implement-plan-pushback.md` (when integrity fails)
- `docs/phase1/<slug>/review-cycle-state.json` (when review-cycle runs with main checkout as repo_root)

### Why this blocks merges

When a feature branch is merged to main, git tries to create these files. If orphan copies already exist as untracked files in the main checkout, git refuses the merge with "untracked working tree files would be overwritten."

## Design Constraints

- The worktree must exist before feature artifacts are written
- The helper `prepare` command is the first thing that runs — it creates the worktree
- The helper must be able to run `prepare` multiple times (idempotent)
- Feature artifact paths must be consistent whether accessed from the helper, the SKILL.md orchestrator, or the worker
- Project-level state files (setup.json, agent-registry.json, features-index.json) should stay in the main checkout under `.codex/implement-plan/` — they are shared across feature streams
- Feature-local state files (implement-plan-state.json, README.md, context.md, etc.) should live in the worktree under `docs/phase1/<slug>/`

## Proposed Fix Strategy

### Option A: Create worktree before any artifact writes in prepare

Move the `ensureFeatureWorktree()` call to the beginning of the `prepare` command, before `ensureFeatureReadme()`, `ensureFeatureContext()`, and state initialization. Then resolve `featureRoot` from the worktree path instead of the project root for all feature-local artifact writes.

Advantages: cleanest isolation, no dual-path logic
Risk: worktree creation may fail, and prepare currently handles that by recording the failure in state — which itself would need to be written somewhere

### Option B: Resolve featureRoot from worktree path when worktree exists

In `buildPaths()`, check if the worktree already exists (from state or filesystem). If it does, resolve `featureRoot` from the worktree path. If it does not yet exist, resolve from project root but mark the artifacts as "staging" and copy them into the worktree after creation.

Advantages: backward compatible for first-run, supports resume
Risk: more complex, must handle copy-on-create carefully

### Recommended approach

Option A is preferred for simplicity. The prepare flow should be:
1. Load setup and registry from project root (these are project-level)
2. Create or reuse the feature worktree
3. Resolve all feature-local paths from the worktree root
4. Write README, context, state, contract, pushback to the worktree
5. Return the worktree-resolved paths in the prepare output

## Scope Hint

Focus on `implement-plan-helper.mjs` path resolution and write targets. Update `review-cycle-helper.mjs` only if it independently writes to the main checkout (it does when called with `repo_root=C:/ADF`). Do not change the SKILL.md orchestrator behavior — it already correctly passes the worktree path to review-cycle after implementation.

## Discovered Authorities

- [skill-doc] C:/ADF/skills/implement-plan/SKILL.md
- [skill-doc] C:/ADF/skills/implement-plan/references/workflow-contract.md
- [skill-doc] C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs
- [skill-doc] C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs
- [skill-doc] C:/ADF/skills/governed-feature-runtime.mjs

## Notes

- The default branch is `main`; treat "master" as `main`.
- Human verification is required because this changes the artifact write path for every future governed feature stream.
