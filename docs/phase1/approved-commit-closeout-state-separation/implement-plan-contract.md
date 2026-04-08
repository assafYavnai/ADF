1. Implementation Objective

Separate pre-merge approved-commit authority from post-merge closeout commit truth so the governed route can merge reviewed work without forbidden post-review state edits.

2. Slice Scope

- pre-merge closeout-readiness validation
- merge-queue approved-SHA authority handling
- post-merge mark-complete closeout truth
- minimum compatible helper, test, and authoritative doc updates

3. Required Deliverables

- corrected pre-merge readiness contract
- corrected helper/runtime enforcement
- targeted machine verification coverage for readiness, merge authority, and closeout truth
- bounded migration or repair handling for active slices blocked by the old rule, if strictly required
- updated authoritative docs
- truthful completion summary with concrete proof

4. Allowed Edits

- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/merge-queue/**`
- tightly scoped shared runtime code only if strictly required
- targeted tests directly required by this slice
- `C:/ADF/docs/phase1/approved-commit-closeout-state-separation/**`

5. Forbidden Edits

- no manual state JSON patching as the product fix
- no use of `last_commit_sha` as merge authority
- no weakening of the exact approved-SHA merge rule
- no broad route redesign
- no unrelated workflow, product, or runtime work

6. Acceptance Gates

KPI Applicability:
not required

KPI Route / Touched Path:
None.

KPI Raw-Truth Source:
None.

KPI Coverage / Proof:
None.

KPI Production / Proof Partition:
None.

KPI Non-Applicability Rationale:
This slice repairs governed merge and closeout semantics. It does not add or change product KPI collection behavior.

KPI Exception Owner:
None.

KPI Exception Expiry:
None.

KPI Exception Production Status:
None.

KPI Compensating Control:
None.

Vision Compatibility:
Compatible. The slice removes false pressure toward manual state mutation and preserves truthful route evidence.

Phase 1 Compatibility:
Compatible. Phase 1 requires a governed implementation route that can land approved work without contradictory pre-merge state requirements.

Master-Plan Compatibility:
Compatible. This hardens the approval-to-merge-to-closeout chain without widening scope.

Current Gap-Closure Compatibility:
Compatible. This is direct workflow hardening for the active Phase 1 governed route.

Later-Company Check:
no

Compatibility Decision:
compatible

Compatibility Evidence:
The slice keeps merge authority on `approved_commit_sha`, preserves post-merge closeout truth on `merge_commit_sha` and `last_commit_sha`, and removes the need for forbidden manual bridge edits between review and merge.

Machine Verification Plan:
- targeted helper tests for pre-merge readiness
- targeted merge-queue tests for approved-SHA landing
- targeted mark-complete tests for post-merge truth requirements
- syntax checks on modified scripts
- `git diff --check`

Human Verification Plan:
Required: false

Reason:
This is a deterministic workflow/governance repair.

7. Observability / Audit

- `implement-plan-state.json` must truthfully show the active run, attempt, worktree state, merge state, and closeout evidence fields
- `implement-plan-execution-contract.v1.json` and the active `implementation-run/.../run-projection.v1.json` must stay consistent with the governed route state
- machine verification status must be visible in completion artifacts and run projection
- human verification status must remain explicitly not required for this slice
- worktree status, approved commit authority, and post-merge evidence must remain distinguishable in the artifacts

8. Dependencies / Constraints

- `approved_commit_sha` remains the only legal pre-merge feature commit authority
- `merge_commit_sha` and `last_commit_sha` remain post-merge closeout facts
- `mark-complete` must remain fail-closed on missing true post-merge evidence
- if targeted tests do not already exist, creating them is required by this slice before machine verification can truthfully pass

9. Non-Goals

- no broad historical repair across unrelated slices
- no manual cleanup workflow as the intended fix
- no review-cycle redesign beyond strictly required route truth
- no KPI/product work unrelated to this merge/closeout defect

10. Source Authorities

- `C:/ADF/AGENTS.md`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`
- `C:/ADF/docs/phase1/approved-commit-closeout-state-separation/README.md`
- `C:/ADF/docs/phase1/approved-commit-closeout-state-separation/context.md`
- `C:/ADF/docs/phase1/approved-commit-closeout-state-separation/implement-plan-contract.md`
- `C:/Users/sufin/.codex/skills/implement-plan/SKILL.md`
- `C:/Users/sufin/.codex/skills/implement-plan/references/workflow-contract.md`
- `C:/Users/sufin/.codex/skills/implement-plan/references/prompt-templates.md`
