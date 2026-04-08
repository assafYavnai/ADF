1. Implementation Objective

Fix the governed merge-closeout repo-truth defect in `implement-plan` and `merge-queue`. When merge processing is invoked from a feature worktree, post-merge closeout currently updates worktree-local artifacts instead of canonical repo-owned truth, so merged features can still look active or unmerged in tracked docs. Make merge closeout canonical, durable, and reviewable without weakening the existing governed route.

2. Slice Scope

- Strengthen `merge-queue` so project-level queue state and post-merge implement-plan handoff resolve against the canonical repository root, not an arbitrary feature worktree root.
- Strengthen `implement-plan` closeout handling so the final repo-owned completion artifacts remain truthful after merge success:
  - `implement-plan-state.json`
  - normal-run projection artifacts needed for current repo truth
  - `completion-summary.md`
- Keep the route the same:
  - implementation
  - machine verification
  - review-cycle
  - human testing when required
  - merge-queue
  - completed only after truthful merge success
- Repair the already-stale repo-owned completion artifacts for `phase1/implement-plan-provider-neutral-run-contract` through this slice so downstream agents see correct repo evidence.
- Update only the minimum shared runtime/docs/contracts needed to describe and prove the fix.

3. Required Deliverables

- a canonical-repo-root resolution path for merge-queue project-level state and implement-plan handoff
- post-merge closeout persistence that updates tracked repo-owned artifacts after merge success instead of leaving final truth only as local dirty files
- truthful final `completion-summary.md` content that reflects review-cycle and merge-queue outcomes after completion
- one bounded repair path for the already-stale `implement-plan-provider-neutral-run-contract` tracked artifacts
- updated skill/reference docs that describe the canonical closeout behavior truthfully
- governed feature artifacts for this slice, including review-cycle evidence

4. Allowed Edits

- `C:/ADF/skills/governed-feature-runtime.mjs`
- `C:/ADF/skills/implement-plan/SKILL.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/references/prompt-templates.md` only if required for truthful closeout wording
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/merge-queue/SKILL.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
- minimal aligned shared helper/runtime files under `C:/ADF/skills` only where needed for canonical repo-root or closeout persistence
- `C:/ADF/docs/phase1/implement-plan-provider-neutral-run-contract/**` only for the bounded stale-artifact repair
- `C:/ADF/docs/phase1/merge-queue-closeout-repo-truth/**`

5. Forbidden Edits

- do not redesign review-cycle routing or reviewer strategy
- do not redesign merge strategy, queue ordering, or conflict handling beyond canonical closeout persistence
- do not weaken the rule that approval on the feature branch is merge-ready, not completed
- do not replace the tracked artifact model with a larger architecture migration in this slice
- do not widen into benchmark orchestration, provider-matrix work, or unrelated workflow redesign
- do not silently paper over stale artifacts without fixing the runtime path that caused them

6. Acceptance Gates

1. `merge-queue process-next` must keep queue and implement-plan closeout state anchored to the canonical repository root even when invoked from a feature worktree.
2. After successful merge, the tracked repo-owned closeout artifacts for the feature must become truthful and durable instead of remaining local dirty state only.
3. Final repo truth for a merged feature must align across at least:
   - `implement-plan-state.json`
   - normal-run projection closeout status
   - `completion-summary.md`
4. The already-stale `phase1/implement-plan-provider-neutral-run-contract` repo-owned artifacts must be repaired by this slice.
5. Existing truthful failure behavior for merge conflicts or blocked merges must remain intact.
6. No unrelated implement-plan or review-cycle route behavior may regress.

## KPI Applicability

KPI Applicability: not required
KPI Non-Applicability Rationale: This slice repairs governance closeout persistence for repo-owned workflow artifacts. It does not add or change a product KPI route.

## Vision / Phase 1 / Master-Plan / Gap-Closure Compatibility

Vision Compatibility: Strengthens durable governed execution by making merged-state truth machine-consumable and consistent across repo-owned artifacts.
Phase 1 Compatibility: This is direct Phase 1 workflow hardening for implementation, review, merge, and completion truth.
Master-Plan Compatibility: Improves the governed feature-delivery route by closing an operational truth gap between merge success and repo-owned closeout evidence.
Current Gap-Closure Compatibility: Closes the remaining gap where merge success can exist in git history while tracked feature artifacts still claim the feature is active or unmerged.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: The merged Spec 1 feature already has a real merge commit and approved review artifacts, but its tracked completion artifacts still claim review-cycle and merge-queue did not run. This slice fixes that governance inconsistency at the runtime and artifact level.

## Machine Verification Plan

- run `node --check` on every modified helper/runtime script
- run `git diff --check` on the changed source set
- smoke-check merge-queue canonical-root behavior when invoked from:
  - the canonical repo root
  - a feature worktree root
- smoke-check post-merge closeout persistence so tracked repo-owned artifacts become truthful after merge success
- smoke-check that stale completion-summary text is replaced by truthful final closeout text
- validate the bounded repair for `phase1/implement-plan-provider-neutral-run-contract`
- refresh and validate installed skill targets with `manage-skills install` and `manage-skills check` if source changes materially affect generated installs

## Human Verification Plan

- Required: false
- Reason: This slice is confined to governed workflow/runtime closeout persistence and can be closed with deterministic helper verification plus review-cycle.

7. Observability / Audit

- merge-queue closeout must surface the canonical repo root it is using for project-level state handoff
- final feature artifacts must make merge success and completion truth visible without requiring an operator to inspect a dirty worktree
- the repair path for the stale Spec 1 feature must remain explicit in repo artifacts and review-cycle evidence

8. Dependencies / Constraints

- preserve the current tracked feature-artifact model in this slice
- preserve merge-queue ownership of truthful merge landing
- preserve implement-plan ownership of completion truth
- keep worktree-local development behavior intact for active feature branches while ensuring final project-level closeout resolves to canonical repo truth

9. Non-Goals

- no benchmark supervisor or provider-matrix work
- no review-cycle redesign
- no full migration of all mutable operational state out of the repo
- no broad cleanup of unrelated stale phase artifacts

10. Source Authorities

- `C:/ADF/docs/phase1/merge-queue-closeout-repo-truth/README.md`
- `C:/ADF/docs/phase1/merge-queue-closeout-repo-truth/context.md`
- `C:/ADF/docs/phase1/implement-plan-provider-neutral-run-contract/implement-plan-state.json`
- `C:/ADF/docs/phase1/implement-plan-provider-neutral-run-contract/completion-summary.md`
- `C:/ADF/docs/phase1/implement-plan-provider-neutral-run-contract/review-cycle-state.json`
- `C:/ADF/skills/implement-plan/SKILL.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/merge-queue/SKILL.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
- `C:/ADF/skills/governed-feature-runtime.mjs`

11. Closeout Rules

- run review-cycle after implementation and machine verification
- treat review approval as merge-ready, not completed
- keep the slice incomplete until the fix commit is either merged or explicitly left awaiting merge by user choice
- do not claim the stale Spec 1 artifacts are repaired until the tracked repo-owned files prove it
