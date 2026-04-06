1. Implementation Objective

Fix the governed merge and closeout state model so pre-merge readiness uses `approved_commit_sha` as the reviewed merge authority, while post-merge closeout continues to require truthful `merge_commit_sha` and `last_commit_sha` evidence.

2. Exact Slice Scope

- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/merge-queue/**`
- tightly scoped shared workflow/runtime code only if strictly required
- targeted tests for closeout-readiness, merge-queue approved-SHA landing, and post-merge closeout truth
- `C:/ADF/docs/phase1/approved-commit-closeout-state-separation/**`

3. Inputs / Authorities Read

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

4. Required Deliverables

- route fix so pre-merge readiness accepts reviewed features with valid `approved_commit_sha` and valid completion summary without requiring `last_commit_sha`
- preservation of exact approved-SHA landing in merge-queue
- preservation of post-merge `merge_commit_sha` and `last_commit_sha` closeout truth
- targeted machine verification coverage for readiness, merge authority, and closeout truth
- updated authoritative docs and completion artifacts for this slice

5. Forbidden Edits

- do not manually patch governed state JSON as the product fix
- do not weaken the exact approved-SHA merge rule
- do not broaden this into merge-queue or review-cycle redesign
- do not touch unrelated COO/runtime/status work
- do not repair truth by retroactive artifact patching after the fact

6. Integrity-Verified Assumptions Only

- this rerun starts from the published seed commit `410b046` on the feature branch
- the earlier noncompliant integration history was removed from `main` and `origin/main`
- human verification is not required for this slice
- the machine verification plan in the slice contract is authoritative
- if the targeted tests do not already exist, creating them is part of this slice and required before machine verification can truthfully pass

7. Explicit Non-Goals

- no broad historical state migration across unrelated features
- no manual cleanup workflow as the intended fix
- no product KPI behavior changes
- no human-testing handoff

8. Proof / Verification Expectations

- Machine Verification Plan:
- targeted helper tests for pre-merge readiness
- targeted merge-queue tests for exact approved-SHA landing
- targeted mark-complete tests for post-merge closeout truth requirements
- `node --check` on modified scripts
- `git diff --check`
- Human Verification Plan:
- Required: false
- Reason: deterministic workflow/governance repair

9. Required Artifact Updates

- `implement-plan-contract.md`
- `implement-plan-brief.md`
- `implement-plan-state.json`
- `implement-plan-execution-contract.v1.json`
- `implementation-run/run-5f38bcd2-17c7-452c-b115-3e23340a8412/execution-contract.v1.json`
- `implementation-run/run-5f38bcd2-17c7-452c-b115-3e23340a8412/run-projection.v1.json`
- `completion-summary.md`
- any targeted proof artifacts needed to show the route truthfully

10. Closeout Rules

- human testing is not required for this slice
- `review-cycle` does not run unless governance explicitly reconfigures the slice to request it
- there is no post-human-approval sanity pass because there is no human testing stage here
- final completion is not allowed until merge success is recorded truthfully by governed merge and closeout stages
