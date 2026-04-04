# 1. Implementation Objective

Fix the main-checkout contamination bug where `implement-plan-helper.mjs` writes governance artifacts (README.md, context.md, implement-plan-state.json, implement-plan-contract.md, implement-plan-pushback.md) to `<project_root>/docs/phase<N>/<slug>/` instead of the feature worktree. After this fix, all feature-local artifacts must be written to the worktree path, and the main checkout must remain clean of feature-stream artifacts.

# 2. Slice Scope

- Modify `implement-plan-helper.mjs` `prepare` command to create or reuse the feature worktree **before** writing any feature-local artifacts
- Modify `buildPaths()` or add a `resolveFeatureArtifactRoot()` that returns the worktree-based feature root when a worktree exists, falling back to project root only when the worktree cannot be created
- Update all feature-local write sites in the helper to use the worktree-resolved path:
  - `ensureFeatureReadme()` (line 3317)
  - `ensureFeatureContext()` (line 3358)
  - state writes (lines 787, 1118, 1234, 1381, 1493)
  - pushback writes (lines 619, 655)
  - contract writes (lines 2829, 2830)
  - brief path resolution
  - completion-summary path resolution
  - implementation-run directory creation (line 494)
  - execution-contract writes (line 2898)
- Update `review-cycle-helper.mjs` `prepare` function to avoid writing to the main checkout when the feature worktree exists — verify that when `repo_root` is the main checkout, it resolves the worktree path from implement-plan state before writing feature-local artifacts
- Keep project-level artifact writes (setup.json, agent-registry.json, features-index.json, locks) under `<project_root>/.codex/implement-plan/` — these are shared and must stay in the main checkout
- Keep the worktree creation logic (`ensureFeatureWorktree()`) in the helper where it already lives, but move its invocation earlier in the `prepare` flow

# 3. Required Deliverables

- `implement-plan-helper.mjs` changes:
  - Worktree creation moved before any feature-local artifact writes in `prepare`
  - All feature-local path resolution uses the worktree root when worktree exists
  - `buildPaths()` or equivalent updated to support worktree-aware path resolution
  - State, README, context, contract, pushback, brief, completion-summary all write to worktree
  - Fallback behavior when worktree creation fails: write to project root but emit a clear warning in the prepare output that artifacts are in the main checkout
- `review-cycle-helper.mjs` changes (if needed):
  - When `repo_root` is the main checkout and a worktree exists for the feature, resolve the worktree path before writing feature-local artifacts
  - OR: document that review-cycle must always be called with `repo_root=<worktree_path>` and the SKILL.md orchestrator already handles this correctly
- Verification that existing features with state in the main checkout are not broken by the migration (backward-compatible state loading)
- Updated feature artifacts for this stream

# 4. Allowed Edits

- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/implement-plan/SKILL.md` — only if the worktree-first contract needs documentation
- `C:/ADF/skills/implement-plan/references/workflow-contract.md` — only if the artifact write path contract needs updating
- `C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs` — only if it independently writes to the main checkout
- `C:/ADF/skills/review-cycle/SKILL.md` — only if the repo_root contract needs clarification
- `C:/ADF/skills/governed-feature-runtime.mjs` — only if shared path resolution utilities need updating
- `C:/ADF/docs/phase1/implement-plan-worktree-artifact-isolation/**`
- Repo-owned skill install/check helpers only if source changes require refreshed generated installs

# 5. Forbidden Edits

- Do not change the feature artifact layout (file names, heading contracts, section structure)
- Do not change the worktree creation mechanism (`git worktree add`)
- Do not change how the implementor worker runs inside the worktree
- Do not change merge-queue, merge logic, or merge-closeout behavior
- Do not change project-level state paths (setup.json, agent-registry.json, features-index.json must stay in main checkout)
- Do not change review-cycle auditor/reviewer/implementor dispatch or prompt templates
- Do not move or rename existing feature artifact files that are already committed on main or feature branches
- Do not delete existing state files from the main checkout for in-progress features without a migration path

# 6. Acceptance Gates

1. After the fix, running `implement-plan prepare` with `--project-root C:/ADF` must NOT create or modify any files under `C:/ADF/docs/phase<N>/<slug>/` — all feature-local artifacts must be written to the worktree path under `.codex/implement-plan/worktrees/phase<N>/<slug>/docs/phase<N>/<slug>/`
2. After the fix, `git status` on the main checkout must remain clean of feature-stream artifacts after a `prepare` or `run` invocation
3. Project-level state files (setup.json, agent-registry.json, features-index.json) must continue to be written to `<project_root>/.codex/implement-plan/`
4. Resuming an existing feature stream that has state in the main checkout must not break — the helper must check the worktree path first, fall back to project root for reading existing state, and write new state to the worktree
5. The `prepare` output must include the resolved artifact root (worktree or fallback) so the SKILL.md orchestrator and human can see where artifacts were written
6. If worktree creation fails, the helper must record the failure truthfully and fall back to project-root writes with a visible warning — not silently fail

## KPI Applicability

KPI Applicability: not required
KPI Non-Applicability Rationale: This slice fixes an internal path-resolution bug in the governance helper. It does not introduce or modify a product/runtime route that needs KPI telemetry instrumentation.

## Vision / Phase 1 / Master-Plan / Gap-Closure Compatibility

Vision Compatibility: Strengthens operational discipline and durable execution by ensuring worktree isolation works as designed — a core governance infrastructure requirement per VISION.md strategic constraints.
Phase 1 Compatibility: This is Phase 1 implementation startup infrastructure. Worktree isolation is foundational to the governed implementation path. Not a full virtual corporation function, not finance/staffing/marketing, not a generic platform.
Master-Plan Compatibility: 1. Yes — strengthens the implementation startup by fixing a bug that blocks governed merges. 2. Yes — helps the COO know the state of the project by keeping main clean and truthful. 3. Yes — directly improves the implementation and review path. 4. Required now — this bug blocks every future merge. 5. Yes — reduces operational ambiguity by eliminating stale orphan artifacts.
Current Gap-Closure Compatibility: This slice directly supports Gap D (parallel implementation safety) by fixing the worktree isolation contract that parallel work depends on. It also unblocks all gap-closure work (A-E) by preventing merge conflicts from orphan artifacts.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: The bug was discovered during the implement-plan-review-cycle-vision-master-plan-gating merge when stale artifacts on main blocked git merge. Every governed feature stream since worktree-first execution was introduced has been contaminating main. This fix is required before any further governed slices can land cleanly.

## Machine Verification Plan

- Run `node --check` on all modified helper and script files
- Run `git diff --check` on the changed source set
- Create a temporary test feature stream and verify:
  - `prepare` creates the worktree before writing artifacts
  - `README.md`, `context.md`, `implement-plan-state.json` exist in the worktree, NOT in the main checkout
  - `git status` on the main checkout shows no untracked feature artifacts after prepare
  - Project-level files (setup.json, features-index.json) are still written to `.codex/implement-plan/`
  - Resume of an existing feature with main-checkout state works (backward compatibility)
  - Worktree creation failure falls back to project-root with a warning in prepare output
- Clean up test feature stream after verification
- Refresh installed skill targets if source changes materially

## Human Verification Plan

- Required: true
- Reason: this changes the artifact write path for every future governed feature stream. A path resolution bug here would break all governed implementation. Must not self-certify.
- Executive summary of implemented behavior: After this fix, implement-plan-helper.mjs creates the feature worktree at the start of `prepare` (before any artifact writes) and resolves all feature-local paths from the worktree root. The main checkout remains clean. Project-level state stays in `.codex/implement-plan/`.
- Testing instructions:
  1. Run `implement-plan prepare` for a new test feature and verify `git status` on main shows no new files under `docs/phase1/`
  2. Verify the test feature's README.md, context.md, and state.json exist inside the worktree path
  3. Verify setup.json and features-index.json are still under `.codex/implement-plan/`
  4. Clean up the test feature
- Expected results: main checkout stays clean, all feature artifacts in worktree
- Evidence to report back: git status output before and after prepare, file locations
- Response format: `APPROVED` or `REJECTED: <comments>`

# 7. Observability / Audit

- The `prepare` output must include `artifact_root` showing where artifacts were written (worktree path or fallback)
- If fallback to project-root occurs, the prepare output must include `artifact_root_fallback: true` and a human-readable warning
- Pushback and completion summaries must reference the worktree-resolved artifact path

# 8. Dependencies / Constraints

- Must not break existing in-progress features that have state in the main checkout — load from both locations, write to worktree
- The worktree creation (`git worktree add`) requires the project root to be a git repo with the base branch available
- Locks must continue to use project-level paths (`.codex/implement-plan/locks/`) since they coordinate across feature streams
- The SKILL.md orchestrator already passes `worktree_path` to review-cycle — verify this contract is not weakened

# 9. Non-Goals

- No merge-queue or merge-closeout redesign
- No worktree lifecycle redesign (creation, cleanup, pruning)
- No feature artifact layout changes (file names, heading contracts)
- No review-cycle auditor/reviewer/implementor changes
- No COO runtime or product-route changes
- No migration/cleanup of existing orphan artifacts on main — that can be done separately after the fix lands

# 10. Source Authorities

- `C:/ADF/docs/phase1/implement-plan-worktree-artifact-isolation/README.md`
- `C:/ADF/docs/phase1/implement-plan-worktree-artifact-isolation/context.md`
- `C:/ADF/skills/implement-plan/SKILL.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs`
- `C:/ADF/skills/governed-feature-runtime.mjs`

# 11. Closeout Rules

- Run machine verification before review handoff
- Use review-cycle with `until_complete=true` after implementation
- Human verification is mandatory before merge
- Commit and push feature-branch changes before merge-queue handoff
- Do not mark complete until review closure, human approval, and merge-queue closeout succeed truthfully
