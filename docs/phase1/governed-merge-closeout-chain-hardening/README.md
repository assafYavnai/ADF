# governed-merge-closeout-chain-hardening

## Feature Goal

Make the governed merge chain complete and automatic for valid approved features.

The specific failure to close is:

- `merge-queue` can merge and push an approved feature
- then `implement-plan mark-complete` can fail because `completion-summary.md` was never normalized to the required heading contract
- the merge succeeds, but governed closeout truth remains stale and requires manual repair

This slice must move closeout readiness checks ahead of merge, make the final completion summary helper-owned before approval, and preserve the rule that `merge-queue` lands the exact approved commit SHA.

## Why This Slice Exists Now

- The current chain discovers invalid closeout artifacts too late.
- The failure is governance-chain incomplete, not code-merge incomplete.
- A valid approved feature should be able to land and close without manual artifact repair.
- The current fail-closed behavior is correct, but the validation order is wrong.

## Requested Scope

Harden the governed closeout chain across:

- `implement-plan`
- `review-cycle`
- `merge-queue`
- the authoritative docs/contracts that describe those routes

This slice must:

- make final `completion-summary.md` normalization helper-owned before approval closeout
- ensure the final summary carries the exact required heading contract, including `5. Feature Artifacts Updated`
- add a pre-merge closeout-readiness gate in `merge-queue`
- block before push when closeout truth is not ready
- preserve the exact approved-SHA merge rule
- preserve fail-closed completion behavior in `mark-complete`
- prove that valid approved features can merge and mark complete end-to-end without manual cleanup

## Required Deliverables

- a helper-owned final `completion-summary.md` path that produces contract-valid closeout artifacts before merge
- a deterministic pre-merge closeout-readiness validation path
- `merge-queue` behavior that blocks invalid closeout state before merge/push
- truthful merge/closeout behavior that still lands the exact approved commit SHA
- updated authoritative docs/contracts for `implement-plan`, `review-cycle`, and `merge-queue`
- proof/tests for both the allowed path and the blocked path
- slice docs and completion artifacts for this feature

## Allowed Edits

- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/review-cycle/**`
- `C:/ADF/skills/merge-queue/**`
- tightly scoped shared helper/runtime files under `C:/ADF/skills/**` only when required for this governed route
- `C:/ADF/docs/phase1/governed-merge-closeout-chain-hardening/**`

## Forbidden Edits

- do not redesign merge strategy, lane ordering, or conflict resolution
- do not weaken the exact approved-commit merge rule
- do not silently mutate approved commits after approval
- do not bypass `mark-complete` fail-closed rules
- do not widen into unrelated provider/runtime work
- do not widen into product/runtime behavior outside governed workflow closeout
- do not perform a broad architecture restart of `implement-plan`, `review-cycle`, or `merge-queue`

## Acceptance Gates

1. A feature with invalid final closeout artifacts must be blocked before merge/push.
2. A feature with valid closeout artifacts must merge and mark complete without manual cleanup.
3. `review-cycle` approval must no longer leave `completion-summary.md` validity to be discovered only after merge.
4. `merge-queue` must validate closeout readiness before it lands the approved commit.
5. `mark-complete` must remain fail-closed if merge truth or closeout truth is still invalid.
6. The exact approved commit SHA must still be the commit that lands.
7. No unrelated implement-plan/review-cycle/merge-queue behavior may regress.

## KPI Applicability

KPI Applicability: not required

KPI Non-Applicability Rationale: This slice repairs governed workflow closeout ordering and artifact validity. It does not change a product runtime KPI route.

## Vision / Phase 1 / Master-Plan / Gap-Closure Compatibility

Vision Compatibility: strengthens the governed delivery system by making merge success and completion truth consistent and machine-trustworthy.

Phase 1 Compatibility: this is direct workflow hardening for the implementation-review-merge-complete route in Phase 1.

Master-Plan Compatibility: it reduces operational ambiguity between approved work, merged work, and completed work.

Current Gap-Closure Compatibility: it closes a real governance gap where merge success can be true while tracked closeout truth remains incomplete or invalid.

Later-Company Check: no

Compatibility Decision: compatible

Compatibility Evidence:

- the feature `phase1/implement-plan-llm-tools-worker-resolution` merged successfully
- `mark-complete` then failed because `completion-summary.md` did not satisfy the required heading contract
- that proves the current governed chain validates closeout truth too late

## Machine Verification Plan

- run `node --check` on every modified helper/runtime script
- run `git diff --check` on the changed source set
- prove helper-owned `completion-summary.md` normalization produces the required heading contract
- prove invalid closeout artifacts are blocked before merge/push
- prove valid closeout artifacts allow merge plus `mark-complete`
- prove `merge-queue` still lands the exact approved SHA
- prove `mark-complete` still fails closed when prerequisites remain missing
- run targeted helper smoke checks from both:
  - canonical repo root
  - feature worktree root when relevant

## Human Verification Plan

- Required: false
- Reason: this slice is confined to governed helper/runtime closeout behavior and can be closed with deterministic helper verification plus review-cycle

## Observability / Audit

- the blocking reason must state that closeout readiness failed before merge
- the route must make clear whether failure came from:
  - invalid completion summary
  - missing merge truth
  - missing local-target sync truth
  - other mark-complete prerequisites
- fix reports must show both:
  - blocked invalid path
  - successful valid path

## Dependencies / Constraints

- preserve helper-owned artifact generation where it already exists
- keep `merge-queue` as the owner of truthful approved merge landing
- keep `implement-plan` as the owner of completion truth
- keep `review-cycle` as the owner of final approved feature-branch closeout before merge
- do not rely on manual operator repair for a valid approved merge path

## Non-Goals

- no broad merge-queue redesign
- no worker-selection redesign
- no benchmark or provider-matrix work
- no product/runtime feature changes
- no auto-rewriting of already-approved commits after merge starts

## Source Authorities

- `C:/ADF/AGENTS.md`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`
- `C:/ADF/skills/implement-plan/SKILL.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/references/prompt-templates.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/review-cycle/SKILL.md`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/SKILL.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
- `C:/ADF/docs/phase1/implement-plan-llm-tools-worker-resolution/completion-summary.md`

## Execution Route

- implement-plan prepares or reuses the dedicated feature worktree
- implementation changes are made on the feature branch inside that worktree
- machine verification passes
- review-cycle runs and closes on the current head
- merge-queue validates closeout readiness before merge
- merge-queue lands the exact approved commit SHA
- implement-plan marks the feature complete only after truthful merge success and recorded sync truth

## Commit Rules

- commit only slice-local source, docs, and proof artifacts
- push only the feature-branch changes produced by this slice
- do not manually merge around merge-queue
- do not claim completion until merge success and governed closeout both succeed truthfully

## Prior Manual Edits — Not Governed

The code changes on this feature branch were manually edited across multiple conversation rounds without running the governed `implement-plan` route. Specifically:

- Code was written directly by the implementation agent without `implement-plan action=run`
- No `review-cycle` was executed — no auditor, no reviewer, no fix-plan, no fix-report
- Merges to main were done manually via `git merge`, not through `merge-queue`
- `mark-complete` was called freehand after manually setting state fields
- The governed artifacts (`implement-plan-state.json`, execution contract, run projection) were populated by direct helper calls, not by the governed route

The code itself may be correct, but it has not been verified or approved through the governed route.

The implementor must now:

1. Verify all code changes are correct and complete
2. Fix any issues found
3. Run the full governed closeout path through `implement-plan` including `review-cycle` and `merge-queue`
4. Reach `mark-complete` only after truthful governed merge
