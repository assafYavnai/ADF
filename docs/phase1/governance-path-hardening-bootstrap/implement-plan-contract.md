1. Implementation Objective

Implement the route-complete governance hardening described in `C:/ADF/docs/phase1/governance-path-hardening-plan-v2.md` across the real implementation path from `implement-plan prepare` through merge-to-main closeout.

This feature is the bootstrap/manual-governance landing for that repair. The first landing must preserve the plan's frozen route design, stop for manual review before code starts, and remain manually governed through implementation, verification, approval, and first merge because the route under repair cannot yet certify itself.

2. Slice Scope

- Harden the real route surfaces, not only the endpoint artifacts:
  - `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
  - `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
  - `C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs`
  - `C:/ADF/skills/governed-feature-runtime.mjs`
- Update the authoritative route contracts that must carry the same frozen model:
  - `C:/ADF/skills/implement-plan/references/workflow-contract.md`
  - `C:/ADF/skills/merge-queue/references/workflow-contract.md`
  - `C:/ADF/skills/review-cycle/references/workflow-contract.md`
- Update targeted route-owned tests and proof artifacts under `C:/ADF/skills/tests/**` where needed to prove the hardened path.
- Keep this feature root under `C:/ADF/docs/phase1/governance-path-hardening-bootstrap/**` truthful as the manual-governance authority for the slice.

In-scope route branches:

- prepare -> active worktree execution before merge
- approved feature head -> merge-ready -> queue -> process-next
- blocked merge recovery through `resume-blocked`
- merged-but-not-completed closeout
- canonical-root reconcile and cache/index sync
- legacy state hydration, migration, and recovery
- status/reporting consumers that read governance fields or artifacts

Explicit exclusions for this slice:

- no bulk Phase 6 backfill across historical streams in the same landing
- no broad Brain hygiene cleanup
- no unrelated COO product/runtime work
- no generic documentation cleanup outside the governance route

3. Required Deliverables

- Phase 0 contract-freeze pass that updates the three workflow contracts so they explicitly carry:
  - truth classes
  - field ownership
  - artifact ownership
  - four authority planes
  - persisted-schema versus hydrated-runtime split
  - contradiction gate
  - implementation-preflight gate
  - hostile-case proof obligations
- Phase 1 wrong-code-landing pass that removes or blocks:
  - stale-ref fallback after failed fetch
  - checkout-derived `base_branch` authority
  - `base_branch` mutation after initial set
  - blocked-lane retargeting in `resume-blocked`
  - persisted or queued fresh-ref shortcuts
- Phase 2 canonical-storage pass that makes canonical-root selection consistent across all in-scope read/write paths and keeps workspace mirrors staging-only.
- Phase 3 state-model pass that introduces explicit execution-domain authority and removes persisted authority semantics from:
  - `reconciliation_sha`
  - `last_commit_sha`
  - compatibility `active_run_status`
- Phase 4 reconcile/validation pass that adds domain-scoped repair plus validator coverage across:
  - truth source
  - physical authority
  - remote durability
  - ambiguity blocking
  - backward-compat normalization
- Phase 5 governed-closeout pass that replaces raw closeout git with reconciled canonical staging, stable closeout trailers, remote push proof, and unique remote recovery for `reconciliation_sha`.
- Explicit route inventory in the implementation pass covering:
  - all writers
  - all readers
  - all validators
  - all derivation paths
  - all migration and normalization paths
  - all recovery paths
  - all status/reporting consumers
- Seeded operational artifacts that preserve `brief_ready` only as the last truthful pre-implementation checkpoint, then freeze the slice in repo-native `blocked` state until bootstrap approval is recorded in `bootstrap-approval.v1.json`.
- Proof artifacts and targeted tests that cover both the allowed path and the hostile path for every changed route.

4. Allowed Edits

- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/merge-queue/**`
- `C:/ADF/skills/review-cycle/**`
- `C:/ADF/skills/governed-feature-runtime.mjs`
- tightly scoped route-owned tests under `C:/ADF/skills/tests/**`
- authoritative route contracts and skill docs only where required to keep the hardened route truthful
- this feature root under `C:/ADF/docs/phase1/governance-path-hardening-bootstrap/**`

5. Forbidden Edits

- do not implement any production code changes during this bootstrap/manual-governance planning pass
- do not widen into bulk Phase 6 backfill or historical convergence work in the same landing
- do not persist `reconciliation_sha`
- do not treat `last_commit_sha` as writable merge or lifecycle authority
- do not let merge-queue keep writing execution-domain status
- do not restore a single global precedence ladder across domains
- do not let workspace mirrors, caches, projections, or review-only evidence become source truth
- do not use manual state patching as the intended product fix
- do not encode bootstrap manual approval as governed `review_cycle` state before implementation exists
- do not use `last_error` to carry the manual bootstrap hold
- do not widen into unrelated COO product/runtime changes

6. Acceptance Gates

1. Phase 0 freezes truth classes, field ownership, artifact ownership, four authority planes, backward-compat rules, and contradiction gates without internal contradiction.
2. Phase 1 removes wrong-code-landing blockers: stale-ref fallback, checkout-derived `base_branch`, and blocked-lane retargeting.
3. Canonical root selection becomes consistent across all in-scope read/write paths.
4. Persisted schema and hydrated runtime view are explicitly separated.
5. `reconciliation_sha` is runtime-derived only and recovered from remote durability proof.
6. `last_commit_sha` is no longer a writable authority path.
7. merge-queue no longer writes execution-domain status.
8. Domain-scoped `reconcile` exists and blocks cross-domain contradictions instead of auto-resolving them.
9. Validation covers truth source, physical authority, remote durability, ambiguity, and backward-compat normalization.
10. Governed closeout is remotely provable, uniqueness-checked, and fail-safe on push failure.
11. A follow-up dogfood slice can run through prepare, implementation, review, merge, and closeout without manual artifact repair or manual state mutation.

KPI Applicability:
not required

KPI Route / Touched Path:
Not applicable as a new product KPI route. This slice hardens repo-owned workflow governance and closeout truth.

KPI Raw-Truth Source:
Not applicable for a product KPI route. Proof instead comes from the hardened governed workflow path and its targeted verification artifacts.

KPI Coverage / Proof:
Targeted proof must show the hardened route emits truthful governed state and blocks retired authority paths; no separate product KPI scorer is introduced here.

KPI Production / Proof Partition:
Proof artifacts may live in this feature stream, but they must exercise the real governed path rather than a proof-only alternate route.

KPI Non-Applicability Rationale:
This slice hardens workflow governance and authority modeling. It does not introduce or modify a separate product KPI-bearing route.

KPI Exception Owner:
None.

KPI Exception Expiry:
None.

KPI Exception Production Status:
None.

KPI Compensating Control:
None.

Vision Compatibility:
compatible. The slice strengthens truthful governed delivery instead of widening into later-company behavior.

Phase 1 Compatibility:
compatible. Phase 1 depends on a trustworthy implementation-review-merge-closeout route.

Master-Plan Compatibility:
compatible. The slice reduces operational ambiguity in the current implementation startup instead of adding speculative breadth.

Current Gap-Closure Compatibility:
compatible. The slice closes the active authority, storage, and closeout gaps in the governed implementation lane.

Later-Company Check:
no

Compatibility Decision:
compatible

Compatibility Evidence:
`governance-path-hardening-plan-v2.md` shows the current route still collapses authority planes, restores alias authority, and lets proof drift away from mutated routes. Hardening those failure classes is direct Phase 1 workflow startup work.

Machine Verification Plan:

- run the repo-wide search gate frozen in `requirements.md` before the first production code change
- run `node --check` on:
  - `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
  - `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
  - `C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs`
  - `C:/ADF/skills/governed-feature-runtime.mjs`
- run `git -C C:/ADF diff --check`
- add targeted route tests for:
  - stale-ref fetch failure blocking
  - wrong checkout branch not altering `base_branch`
  - blocked request lane-retarget rejection
  - canonical-root selection before and after `merge_commit_sha`
  - worktree-root cache write rejection or canonical redirection
  - legacy-state normalization without alias authority restoration
  - domain-scoped contradiction blocking
  - remote-only `reconciliation_sha` recovery with zero-result and multi-result blocking
  - workspace mirror never outranking canonical root
- run fresh-clone or temp-repo hostile-case proof where remote durability or unique closeout recovery is claimed
- run a final contradiction sweep across docs, contracts, implementation, and proof before closure

Human Verification Plan:
Required: false

Reason:
Standard governed `human_testing` is not the approval surface for this slice.
Bootstrap/manual governance for the first landing is enforced separately through the bootstrap approval artifact and the gated `feature-reopened` transition.

Bootstrap Approval Record:

- Bootstrap Governance Mode: manual-bootstrap
- Bootstrap Approval Artifact: `C:/ADF/docs/phase1/governance-path-hardening-bootstrap/bootstrap-approval.v1.json`
- Bootstrap Approval Required Before Reopen: true
- authoritative surface: `C:/ADF/docs/phase1/governance-path-hardening-bootstrap/bootstrap-approval.v1.json`
- required fields: `approval_status`, `approved_by`, `approved_at`, `approval_basis`
- initial state for this slice: `approval_status=pending`
- hold-clearing rule: only after that record is updated to `approved` may the slice-owned operational artifacts record a deliberate `feature-reopened` transition that reopens `feature_status=active`, `active_run_status=brief_ready`, run lifecycle `active`, and attempt status `ready_for_implementation`

7. Observability / Audit

- The hardened route must make truth classes explicit enough that lifecycle truth, execution truth, operational residue, caches, review evidence, and human-readable outputs cannot be mistaken for one another.
- Field-level ownership must be auditable even inside `implement-plan-state.json`.
- Status reporting must expose the execution-status versus compatibility-status split explicitly.
- Reconcile and validator output must name which authority plane failed:
  - truth source
  - storage root
  - commit workspace
  - remote durability proof
- Any backward-compat normalization must say exactly which legacy input was read and what authority it did not regain.
- Any mirror or copied artifact must state whether it is staging or authority.
- Proof artifacts must show both the blocked path and the allowed path for every changed route.

8. Dependencies / Constraints

- Preserve the plan phase order exactly:
  - Phase 0 contract freeze
  - Phase 1 wrong-code-landing blockers
  - Phase 2 physical authority
  - Phase 3 semantic split
  - Phase 4 reconcile and validation
  - Phase 5 governed closeout
  - Phase 6 backfill as follow-up
- Preserve route ownership boundaries:
  - implement-plan owns lifecycle and execution-domain truth
  - merge-queue owns merge-lane truth
  - review-cycle owns review-only evidence
- Preserve backward compatibility as an explicit migration surface rather than a silent alias path.
- Keep workspace mirrors staging-only.
- Keep ambiguity fail-closed.
- Keep the slice manually governed through its first landing.

9. Non-Goals

- no production code changes during this planning slice creation pass
- no broad Phase 6 convergence/backfill in the runtime hardening landing
- no Brain hygiene redesign
- no unrelated COO reporting or product work
- no generic doc cleanup outside the governance route
- no manual state edits as the intended operating model

10. Source Authorities

- `C:/ADF/AGENTS.md`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/docs/v0/architecture.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/governance-path-hardening-plan-v2.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
- `C:/ADF/skills/governed-feature-runtime.mjs`
- `C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`
- `C:/ADF/docs/phase1/governed-approval-gates-and-local-sync-hardening/README.md`
- `C:/ADF/docs/phase1/governed-approval-gates-and-local-sync-hardening/context.md`
- `C:/ADF/docs/phase1/governed-merge-closeout-chain-hardening/README.md`
- `C:/ADF/docs/phase1/governed-merge-closeout-chain-hardening/context.md`
- `C:/ADF/docs/phase1/approved-commit-closeout-state-separation/README.md`
- `C:/ADF/docs/phase1/approved-commit-closeout-state-separation/context.md`
