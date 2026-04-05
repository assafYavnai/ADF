1. Implementation Objective

Make the governed merge-closeout chain complete and automatic for valid approved features. The route must validate final closeout truth before merge, preserve exact approved-SHA landing, and allow `mark-complete` to succeed without manual cleanup when the approved feature is valid.

2. Slice Scope

- helper-owned final `completion-summary.md` normalization before approval closeout
- pre-merge closeout-readiness validation in `merge-queue`
- preservation of exact approved-SHA merge behavior
- preservation of fail-closed `mark-complete` behavior
- minimum aligned doc/contract updates across `implement-plan`, `review-cycle`, and `merge-queue`

3. Required Deliverables

- a contract-valid final `completion-summary.md` generation/normalization path owned by helpers
- a pre-merge closeout validation path that blocks invalid features before push
- end-to-end proof that a valid approved feature merges and marks complete automatically
- end-to-end proof that an invalid closeout artifact blocks before merge/push
- updated authoritative workflow contracts/docs
- slice-local review/proof artifacts

4. Allowed Edits

- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/review-cycle/**`
- `C:/ADF/skills/merge-queue/**`
- tightly scoped shared helper/runtime files under `C:/ADF/skills/**` only when required for this route
- `C:/ADF/docs/phase1/governed-merge-closeout-chain-hardening/**`

5. Forbidden Edits

- do not redesign merge ordering or merge conflict strategy
- do not weaken the exact approved commit SHA rule
- do not silently mutate approved commits after approval
- do not bypass `mark-complete` fail-closed rules
- do not widen into unrelated provider/runtime or product behavior

6. Acceptance Gates

1. Invalid closeout artifacts block before merge/push.
2. Valid closeout artifacts allow merge plus `mark-complete` without manual cleanup.
3. `review-cycle` approval no longer leaves completion-summary validity to be discovered only after merge.
4. `merge-queue` validates closeout readiness before landing the approved commit.
5. `mark-complete` remains fail-closed when prerequisites are missing.
6. Exact approved-SHA merge behavior remains intact.

## KPI Applicability

KPI Applicability: not required
KPI Non-Applicability Rationale: This is governed workflow closeout hardening, not a product KPI route change.

## Vision / Phase 1 / Master-Plan / Gap-Closure Compatibility

Vision Compatibility: strengthens governed delivery truth.
Phase 1 Compatibility: direct hardening of the implementation-review-merge-complete route.
Master-Plan Compatibility: reduces ambiguity between approved, merged, and completed states.
Current Gap-Closure Compatibility: closes the real late-validation closeout gap revealed by merged but not fully completed governed features.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: the `implement-plan-llm-tools-worker-resolution` feature merged successfully, then failed governed closeout because its completion summary was not contract-valid. That proves the chain validates too late today.

## Machine Verification Plan

- `node --check` on each modified helper/runtime script
- `git diff --check` on the changed source set
- targeted helper smoke for helper-owned completion-summary normalization
- targeted helper smoke for pre-merge invalid-closeout blocking
- targeted helper smoke for valid merge plus `mark-complete`
- proof that exact approved-SHA landing still holds

## Human Verification Plan

- Required: false
- Reason: internal governance/helper hardening only

7. Observability / Audit

- blocked invalid-closeout reasons must be explicit
- successful valid-closeout path must show merge truth and completion truth alignment
- proof artifacts must cover both blocked and successful paths

8. Dependencies / Constraints

- keep helper ownership boundaries truthful
- preserve merge-queue ownership of merge landing
- preserve implement-plan ownership of completion truth
- preserve review-cycle ownership of final approved feature-branch closeout

9. Non-Goals

- no broad architecture restart
- no unrelated workflow redesign
- no benchmark/provider-matrix work
- no product/runtime behavior changes outside governed closeout

10. Source Authorities

- `C:/ADF/AGENTS.md`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`
- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/review-cycle/**`
- `C:/ADF/skills/merge-queue/**`

11. Closeout Rules

- review-cycle closes on the feature branch before merge
- merge-queue validates closeout readiness before landing
- merge-queue lands the exact approved commit SHA
- implement-plan marks complete only after truthful merge success and sync truth
