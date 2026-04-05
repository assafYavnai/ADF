# 1. Implementation Objective

Fix the main-checkout contamination bug where `implement-plan-helper.mjs` and `review-cycle-helper.mjs` write feature-local governance artifacts to `<project_root>/docs/phase<N>/<slug>/` (the main checkout) instead of the feature worktree. After this fix, the worktree must be created before any feature-local writes, all feature-local artifacts must be written exclusively inside the worktree, worktree-creation failure must be a hard stop with no main-checkout fallback, and the main checkout must remain clean.

# 2. Slice Scope

- Modify `implement-plan-helper.mjs` `prepare` command to call `ensureFeatureWorktree()` **before** any feature-local artifact writes (before `ensureFeatureReadme()`, `ensureFeatureContext()`, state initialization, pushback, contract)
- Add or modify path resolution so `featureRoot` for all feature-local writes resolves from the worktree root, not `projectRoot`
- Update all feature-local write sites in `implement-plan-helper.mjs`:
  - `ensureFeatureReadme()` (line 3317)
  - `ensureFeatureContext()` (line 3358)
  - state writes (lines 787, 1118, 1234, 1381, 1493)
  - pushback writes (lines 619, 655)
  - contract writes (lines 2829, 2830)
  - brief path resolution
  - completion-summary path resolution
  - implementation-run directory creation (line 494)
  - execution-contract writes (line 2898)
- Update `review-cycle-helper.mjs` to follow the same worktree-first artifact-root rules:
  - `prepare` at line 408 must resolve `featureRoot` from the worktree, not from `repoRoot` when `repoRoot` is the main checkout
  - State writes at line 516, README writes at line 1856 must target the worktree
  - `review-cycle-helper.mjs` is explicitly part of this fix scope, not optional
- Keep project-level shared state writes (setup.json, agent-registry.json, features-index.json, locks) under `<project_root>/.codex/implement-plan/` and `<project_root>/.codex/review-cycle/`
- Implement legacy read precedence: read worktree first, fall back to main-checkout for existing state, write to worktree only
- On worktree-creation failure: stop truthfully, report failure in prepare output and project-level state, do NOT create feature-local docs on main

# 3. Required Deliverables

- `implement-plan-helper.mjs`:
  - Worktree creation moved before any feature-local artifact writes in `prepare`
  - All feature-local path resolution uses the worktree root
  - No feature-local writes to `<project_root>/docs/phase<N>/<slug>/`
  - Worktree-creation failure is a hard stop with truthful error reporting
  - Legacy state read from main-checkout when worktree-local state does not yet exist
  - `prepare` output includes `artifact_root`, `artifact_root_kind`, `worktree_path`, and `legacy_state_source` when applicable
- `review-cycle-helper.mjs`:
  - Same worktree-first artifact-root rules for `review-cycle-state.json` and README
  - When `repo_root` is the main checkout and a worktree exists, resolve the worktree path before writing
- Backward-compatible state loading for features with existing main-checkout state
- Updated feature artifacts for this stream

# 4. Allowed Edits

- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/implement-plan/SKILL.md` — only if the worktree-first write contract needs documentation
- `C:/ADF/skills/implement-plan/references/workflow-contract.md` — only if the artifact write path contract needs updating
- `C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs`
- `C:/ADF/skills/review-cycle/SKILL.md` — only if the repo_root contract needs clarification
- `C:/ADF/skills/governed-feature-runtime.mjs` — only if shared path resolution utilities need updating
- `C:/ADF/docs/phase1/implement-plan-worktree-artifact-isolation/**`
- Repo-owned skill install/check helpers only if source changes require refreshed generated installs

# 5. Forbidden Edits

- Do not change the feature artifact layout (file names, heading contracts, section structure)
- Do not change the worktree creation mechanism (`git worktree add`)
- Do not change how the implementor worker runs inside the worktree
- Do not change merge-queue, merge logic, or merge-closeout behavior
- Do not change project-level state paths (setup.json, agent-registry.json, features-index.json must stay in main checkout under `.codex/`)
- Do not change review-cycle auditor/reviewer/implementor dispatch or prompt templates
- Do not move or rename existing feature artifact files that are already committed on main or feature branches
- Do not delete existing state files from the main checkout for in-progress features without a migration path
- Do not redesign worktree lifecycle (creation, cleanup, pruning) beyond what is needed to move creation earlier in prepare

# 6. Acceptance Gates

1. After the fix, `implement-plan prepare` with `--project-root C:/ADF` for a new feature must NOT create or modify any files under `C:/ADF/docs/phase<N>/<slug>/`. All feature-local artifacts must exist only inside `<worktree_root>/docs/phase<N>/<slug>/`.
2. After the fix, `git status` on the main checkout must show no new untracked or modified feature-stream files after a `prepare` or `run` invocation (project-level state under `.codex/` is excluded from this check since it is gitignored).
3. Project-level shared state files (setup.json, agent-registry.json, features-index.json, locks) must continue to be written to `<project_root>/.codex/implement-plan/` and `<project_root>/.codex/review-cycle/`.
4. When a feature stream has existing state only in the main checkout (legacy), the helper must read it from there for backward compatibility, but all subsequent writes must go to the worktree. Once worktree-local state exists, the main-checkout copy is ignored.
5. The `prepare` output JSON must include `artifact_root` (the resolved path where artifacts were written), `artifact_root_kind` (`worktree` or `failure`), `worktree_path`, and `failure_reason` when worktree creation failed. When legacy state was loaded from the main checkout, include `legacy_state_source` with the path.
6. If worktree creation fails, the helper must stop without writing any feature-local artifacts. It must report the failure truthfully in the prepare output JSON and update project-level state (features-index) with the failure. It must NOT fall back to writing feature-local docs under `<project_root>/docs/phase<N>/<slug>/`.
7. `review-cycle-helper.mjs` must follow the same worktree-first rules: when a worktree exists for the feature, all feature-local writes (review-cycle-state.json, README) target the worktree, not the main checkout.

## KPI Applicability

KPI Applicability: not required
KPI Non-Applicability Rationale: This slice fixes an internal path-resolution bug in governance helpers. It does not introduce or modify a product/runtime route that needs KPI telemetry instrumentation.

## Vision / Phase 1 / Master-Plan / Gap-Closure Compatibility

Vision Compatibility: Strengthens operational discipline and durable execution by ensuring worktree isolation works as designed — a core governance infrastructure requirement per VISION.md strategic constraints.
Phase 1 Compatibility: Phase 1 implementation startup infrastructure. Worktree isolation is foundational to the governed implementation path. Not a full virtual corporation function, not finance/staffing/marketing, not a generic platform.
Master-Plan Compatibility: 1. Yes — strengthens the implementation startup by fixing a bug that blocks governed merges. 2. Yes — helps the COO know the state of the project by keeping main clean and truthful. 3. Yes — directly improves the implementation and review path. 4. Required now — this bug blocks every future merge. 5. Yes — reduces operational ambiguity by eliminating stale orphan artifacts.
Current Gap-Closure Compatibility: Directly supports Gap D (parallel implementation safety) by fixing the worktree isolation contract that parallel work depends on. Also unblocks all gap-closure work (A-E) by preventing merge conflicts from orphan artifacts.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: The bug was discovered during the implement-plan-review-cycle-vision-master-plan-gating merge when stale artifacts on main blocked git merge. Every governed feature stream since worktree-first execution was introduced has been contaminating main.

## Machine Verification Plan

- Run `node --check` on all modified helper and script files
- Run `git diff --check` on the changed source set
- Create a temporary test feature stream and verify:
  - `prepare` creates the worktree before writing artifacts
  - `README.md`, `context.md`, `implement-plan-state.json` exist in the worktree at `<worktree_root>/docs/phase1/<test_slug>/`, NOT in the main checkout at `C:/ADF/docs/phase1/<test_slug>/`
  - `git status` on the main checkout shows no untracked feature artifacts after prepare
  - Project-level files (setup.json, features-index.json) are still written to `.codex/implement-plan/`
  - `prepare` output JSON includes `artifact_root`, `artifact_root_kind: "worktree"`, and `worktree_path`
  - Resume of an existing feature with main-checkout state reads legacy state and writes to worktree
- Clean up test feature stream after verification
- Refresh installed skill targets if source changes materially

## Human Verification Plan

- Required: true
- Reason: this changes the artifact write path for every future governed feature stream. A path-resolution bug here would break all governed implementation. Must not self-certify without explicit CEO approval.
- Executive summary of implemented behavior: After this fix, implement-plan-helper.mjs creates the feature worktree at the start of prepare (before any artifact writes) and resolves all feature-local paths from the worktree root. review-cycle-helper.mjs follows the same rule. The main checkout remains clean. Project-level shared state stays in `.codex/`. Worktree-creation failure is a hard stop.
- Testing instructions:
  1. Run `implement-plan prepare` for a new test feature and verify `git status` on main shows no new files under `docs/phase1/`
  2. Verify the test feature's README.md, context.md, and state.json exist inside the worktree path at `<worktree_root>/docs/phase1/<test_slug>/`
  3. Verify the prepare output JSON includes `artifact_root_kind: "worktree"` and the correct `artifact_root` path
  4. Verify setup.json and features-index.json are still under `.codex/implement-plan/`
  5. Clean up the test feature
- Expected results: main checkout stays clean, all feature artifacts in worktree, observability fields present
- Evidence to report back: git status output before and after prepare, prepare output JSON showing artifact_root fields, file locations
- Response format: `APPROVED` or `REJECTED: <comments>`

# 7. Observability / Audit

The `prepare` output JSON must include these fields to verify where artifacts were written:

- `artifact_root` — the resolved path where feature-local artifacts were written
- `artifact_root_kind` — `worktree` when the worktree was used, `failure` when worktree creation failed and no feature-local artifacts were written
- `worktree_path` — the worktree root path
- `failure_reason` — human-readable reason when worktree creation failed (null otherwise)
- `legacy_state_source` — the main-checkout path when legacy state was loaded for backward compatibility (null when state was loaded from worktree)

Pushback and completion summaries must reference the worktree-resolved artifact path, not the main-checkout path.

# 8. Dependencies / Constraints

- Must not break existing in-progress features that have state in the main checkout — read from main checkout for backward compatibility, write to worktree only
- The worktree creation (`git worktree add`) requires the project root to be a git repo with the base branch available
- Locks must continue to use project-level paths (`.codex/implement-plan/locks/`) since they coordinate across feature streams
- The SKILL.md orchestrator already passes `worktree_path` to review-cycle — verify this contract is not weakened
- `review-cycle-helper.mjs` must be updated as part of this slice, not deferred

# 9. Non-Goals

- No merge-queue or merge-closeout redesign
- No worktree lifecycle redesign (creation, cleanup, pruning) beyond moving creation earlier in prepare
- No feature artifact layout changes (file names, heading contracts)
- No review-cycle auditor/reviewer/implementor changes
- No COO runtime or product-route changes
- No migration/cleanup of existing orphan artifacts on main — that is a separate follow-up after the fix lands

# 10. Source Authorities

- `C:/ADF/docs/phase1/implement-plan-worktree-artifact-isolation/README.md`
- `C:/ADF/docs/phase1/implement-plan-worktree-artifact-isolation/context.md`
- `C:/ADF/skills/implement-plan/SKILL.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/review-cycle/SKILL.md`
- `C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs`
- `C:/ADF/skills/governed-feature-runtime.mjs`

# 11. Closeout Rules

- Run machine verification before review handoff
- Use review-cycle with `until_complete=true` after implementation
- Human verification is mandatory before merge
- Commit and push feature-branch changes before merge-queue handoff
- Do not mark complete until review closure, human approval, and merge-queue closeout succeed truthfully
