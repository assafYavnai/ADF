# 1. Implementation Objective

Separate pre-merge approved-commit authority from post-merge closeout commit truth so the governed route can merge reviewed work without forbidden post-review state edits.

# 2. Exact Slice Scope

- `validateCloseoutReadiness` in `implement-plan-helper.mjs`: change from requiring `last_commit_sha` to requiring `approved_commit_sha` for pre-merge readiness
- `implement-plan` workflow contract: document the pre-merge vs post-merge state model separation
- `merge-queue` workflow contract: document that `last_commit_sha` is not merge authority
- Targeted tests covering pre-merge readiness, post-merge mark-complete truth, and merge-queue approved-SHA authority

# 3. Inputs / Authorities Read

- `C:/ADF/docs/phase1/approved-commit-closeout-state-separation/README.md`
- `C:/ADF/docs/phase1/approved-commit-closeout-state-separation/context.md`
- `C:/ADF/docs/phase1/approved-commit-closeout-state-separation/implement-plan-contract.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`

# 4. Required Deliverables

- Corrected `validateCloseoutReadiness` function accepting `approved_commit_sha` without `last_commit_sha`
- Updated `implement-plan` workflow contract documenting pre-merge vs post-merge state separation
- Updated `merge-queue` workflow contract documenting `approved_commit_sha` as sole pre-merge authority
- 10 targeted tests in `skills/tests/approved-commit-closeout-state-separation.test.mjs`
- `completion-summary.md` with truthful verification evidence

# 5. Forbidden Edits

- No direct manual edits to governed state JSON as the product fix
- No weakening of the exact approved-SHA merge rule
- No broad merge-queue redesign
- No review-cycle redesign beyond what is strictly required
- No Brain redesign
- No unrelated COO/runtime/status work

# 6. Integrity-Verified Assumptions Only

- `approved_commit_sha` is the sole pre-merge commit authority
- `last_commit_sha` is post-merge closeout evidence only
- `merge-queue` lands the exact `approved_commit_sha`
- `mark-complete` still requires `last_commit_sha` as post-merge evidence
- The route contradiction is structural, not operator error

# 7. Explicit Non-Goals

- No broad historical state migration across unrelated features
- No manual cleanup workflow as the product fix
- No benchmark/queue/product work beyond this route defect
- No attempt to rewrite already-broken historical slice truth

# 8. Proof / Verification Expectations

Machine Verification Plan:
- 10 targeted tests covering pre-merge readiness, merge-queue authority, and mark-complete post-merge truth
- `node --check` on modified scripts
- `git diff --check` for whitespace

Human Verification Requirement: false

# 9. Required Artifact Updates

- `docs/phase1/approved-commit-closeout-state-separation/completion-summary.md`
- `docs/phase1/approved-commit-closeout-state-separation/implement-plan-brief.md`
- `docs/phase1/approved-commit-closeout-state-separation/implement-plan-state.json`
- `docs/phase1/approved-commit-closeout-state-separation/implement-plan-execution-contract.v1.json`

# 10. Closeout Rules

- Human testing is not required (Human Verification Plan: Required: false)
- Review-cycle does not run (post_send_to_review=false)
- No post-human-approval sanity pass is required
- Final completion happens only after merge-queue reports merge success and local target sync status is recorded truthfully
