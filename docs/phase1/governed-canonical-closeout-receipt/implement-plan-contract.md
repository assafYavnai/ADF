1. Implementation Objective

Create one canonical post-merge closeout receipt and canonical repo-root closeout rewrite path for governed Phase 1 slices so final committed feature-local truth on `main` is explicit, machine-usable, path-canonical, and free of stale lifecycle wording.

The slice must close this exact failure class:

- later closeout or merge-recovery work can leave committed feature-local state or execution artifacts pointing at merge-queue worktree roots on `main`
- lifecycle-sensitive `completion-summary.md` wording can preserve stale pre-merge or stale earlier-cycle lines after final closeout
- closeout reports can overstate which SHA became the final feature-local commit authority because no canonical receipt represents review-closeout, approval-handoff, merge, and later reconciliation roles separately
- runtime-only observations can be blended into closeout narratives without an explicit separation from committed repo truth

2. Slice Scope

- canonical post-merge closeout receipt emission for governed Phase 1 feature slices
- canonical repo-root rewrite for committed feature-local closeout truth on `main`
- lifecycle-sensitive completion-summary regeneration or deterministic rewrite from current state and closeout receipt truth
- minimal helper/runtime changes needed in `implement-plan`, `merge-queue`, and the smallest shared workflow-runtime surface strictly required for the above
- tightly scoped machine proof and tests for already-landed reconciliation paths and actual merge-closeout paths
- `C:/ADF/docs/phase1/governed-canonical-closeout-receipt/**`

3. Required Deliverables

- one canonical machine-facing closeout receipt artifact per completed governed feature slice
- deterministic emission of that receipt during final closeout
- canonical repo-root rewrite for final committed feature-local state and execution artifact references on `main`
- deterministic lifecycle-sensitive `completion-summary.md` rewrite from current committed state and closeout receipt truth
- explicit separation between committed repo truth and report-time runtime observations
- bounded machine verification proving both already-landed reconciliation and real merge-closeout paths
- updated contract docs for any touched helper/runtime route

4. Required Receipt Artifact Contract

The slice must create a canonical receipt artifact under the feature root.

Required path:

- `C:/ADF/docs/phase1/<feature-slug>/closeout-receipt.v1.json`

Required JSON shape:

```json
{
  "schema_version": 1,
  "receipt_kind": "governed_closeout_receipt",
  "project_root": "C:/ADF",
  "phase_number": 1,
  "feature_slug": "string",
  "feature_root": "C:/ADF/docs/phase1/<feature-slug>",
  "base_branch": "main",
  "feature_branch": "implement-plan/phase1/<feature-slug>",
  "slice_code_already_on_main_before_reconciliation": true,
  "approved_feature_commit_sha": "string",
  "review_closeout_commit_sha": "string | null",
  "approval_handoff_commit_sha": "string | null",
  "merge_commit_sha": "string | null",
  "final_reconciliation_commit_sha": "string | null",
  "human_verification_required": true,
  "human_verification_status": "approved | rejected | stale | not_required | null",
  "human_verification_approved_commit_sha": "string | null",
  "merge_queue_request_id": "string | null",
  "local_target_sync_status": "string | null",
  "canonical_truth_root": "C:/ADF",
  "canonical_feature_root": "C:/ADF/docs/phase1/<feature-slug>",
  "feature_state_paths_canonicalized": true,
  "completion_summary_regenerated_from_state": true,
  "runtime_observations": {
    "root_origin_main_head_left_right_count": "string | null",
    "root_main_synced_at_report_time": true,
    "observation_basis": "runtime_only_not_committed_truth"
  },
  "generated_at": "ISO-8601",
  "source_authorities": [
    "string"
  ]
}
```

Rules:

- `project_root` and `feature_root` in the receipt must be canonical repo-root values, not merge-queue worktree paths
- `review_closeout_commit_sha`, `approval_handoff_commit_sha`, `merge_commit_sha`, and `final_reconciliation_commit_sha` are all separate facts and must not be silently collapsed
- `runtime_observations` is optional data but, when present, must remain explicitly labeled as runtime-only rather than committed artifact truth

5. Required Canonicalization Rules

After final closeout on `main`:

- committed `implement-plan-state.json` must use canonical repo-root path values for `project_root`
- committed `implement-plan-execution-contract.v1.json` must use canonical repo-root path values for `feature_identity.project_root`, `feature_identity.feature_root`, and all canonical artifact references
- the active run contract and active run projection under `implementation-run/` must use canonical repo-root path values for their artifact references on the committed `main` copy
- committed feature-local artifacts on `main` must not preserve merge-queue worktree roots as their final canonical path surface

This slice must fail closed if the route reaches final closeout while these canonicalization rules are still false.

6. Required Completion Summary Regeneration Rules

The route must not preserve stale lifecycle wording when final closeout truth changes.

The slice must regenerate or deterministically rewrite lifecycle-sensitive `completion-summary.md` content from current state plus closeout receipt truth.

At minimum, the final committed `completion-summary.md` must not simultaneously contain contradictory lifecycle claims such as:

- merge has not happened
- merge has happened
- final merge-queue landing still needs to run
- final closeout is already completed
- older cycle closeout wording as the final state after a later cycle has become authoritative

Required explicit rule:

- lifecycle-sensitive lines must be regenerated from current state and receipt truth, not preserved by append-only editing

7. Allowed Edits

- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/merge-queue/**`
- the smallest shared workflow-runtime helper surface strictly needed for canonical receipt emission or canonical rewrite
- tightly scoped tests and proof artifacts for the above
- `C:/ADF/docs/phase1/governed-canonical-closeout-receipt/**`
- directly affected workflow-route contract docs that must remain truthful

8. Forbidden Edits

- no COO product-route redesign
- no review-cycle redesign
- no lane-admission or `dev_team` implementation work in this slice
- no full control-plane projection unification across all global indexes or registries
- no Brain redesign
- no approval-gate redesign beyond canonical closeout representation
- no generic status-service or dashboard work
- no unrelated refactors in other Phase 1 slices

9. Acceptance Gates

KPI Applicability: required
KPI Route / Touched Path: governed post-merge closeout path for feature-local state, execution contracts, run projections, and completion summary on committed `main`
KPI Raw-Truth Source: committed feature-local state, committed closeout receipt, committed completion summary, merge-queue records, git ancestry checks, and machine verification outputs for both already-landed and active-merge paths
KPI Coverage / Proof: deterministic proof that canonical closeout receipt is emitted, canonical repo-root rewrite occurs, stale lifecycle wording is removed, and runtime-only observations remain separated from committed repo truth
KPI Production / Proof Partition: production path is the real governed closeout route through `implement-plan` and `merge-queue`; proof path uses isolated feature roots and merge-recovery scenarios with the same helper/runtime implementation and committed artifact assertions
KPI Non-Applicability Rationale: Not used because KPI Applicability is required for this governed closeout slice
KPI Exception Owner: Not used because KPI Applicability is required and no temporary exception is approved
KPI Exception Expiry: Not used because KPI Applicability is required and no temporary exception is approved
KPI Exception Production Status: Not used because KPI Applicability is required and no temporary exception is approved
KPI Compensating Control: Not used because KPI Applicability is required and no temporary exception is approved
Vision Compatibility: Compatible. This strengthens truthful governed execution and future boxed implementation without widening into later-company autonomy.
Phase 1 Compatibility: Compatible. The slice is a bounded closeout correctness fix for active Phase 1 governed routes.
Master-Plan Compatibility: Compatible. It improves the startup’s ability to report and trust delivery state without introducing a second truth system.
Current Gap-Closure Compatibility: Compatible. It closes the specific post-merge truth gap that would otherwise leak ambiguity into the later `develop` front door.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: The defect is already visible in current Phase 1 governed closeout artifacts. One canonical closeout receipt plus deterministic canonical rewrite is the smallest bounded fix that closes the failure class without widening into full projection unification.
Machine Verification Plan: prove the route on at least these scenarios:
- Scenario A — already-landed reconciliation path: review closeout plus later reconciliation produces canonical repo-root receipt/state/contract/projection truth
- Scenario B — blocked merge-resume path: approval-handoff, merge resume, merge commit, and final closeout receipt are represented explicitly and non-ambiguously
- Scenario C — lifecycle summary rewrite: stale pre-merge and stale earlier-cycle wording is removed and replaced by current lifecycle truth
- Scenario D — runtime observation separation: runtime-only sync observations do not overwrite committed repo truth fields
- Scenario E — fail-closed canonicalization: final closeout does not record completed truth if canonical repo-root rewrite or receipt emission fails
Human Verification Plan: Required: false. This is a governed closeout correctness slice. Closure should rely on deterministic committed-artifact proof, helper/runtime verification, and explicit receipt/state assertions rather than a separate human UX test pass.

10. Observability / Audit

- The closeout receipt must make explicit which commit played each closeout role
- The route must make explicit whether slice code was already on `main` before reconciliation
- The route must make explicit whether human verification was required and which approved commit it bound to
- The route must make explicit which facts are committed repo truth and which are runtime-only observations
- Review-cycle status, merge status, local-target sync status, and feature completion state must remain truthful and non-contradictory

11. Dependencies / Constraints

- must preserve existing merge authority and merge-queue request semantics
- must preserve current approval-gate semantics
- must preserve existing feature-local artifact paths under `docs/phase1/<feature-slug>/` as the canonical committed truth surface
- must not require full projection unification across global control-plane views in this slice
- must be additive and bounded

12. Non-Goals

- redesigning COO `/status`
- redesigning `review-cycle`
- redesigning `dev_team` or MCP lane admission
- cleaning all historical stale summaries across the repo unless directly required by bounded proof in this slice
- unifying all global indexes and feature-local truth into one platform-wide projection in this slice

13. Required Source Authorities

- `C:/ADF/AGENTS.md`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`
- `C:/ADF/docs/phase1/governed-approval-gates-and-local-sync-hardening/lessons-for-mcp-boxing.md`
- `C:/ADF/docs/phase1/coo-live-executive-status-wiring/implement-plan-state.json`
- `C:/ADF/docs/phase1/coo-live-executive-status-wiring/review-cycle-state.json`
- `C:/ADF/docs/phase1/coo-live-executive-status-wiring/completion-summary.md`
- `C:/ADF/docs/phase1/governed-state-writer-serialization/implement-plan-state.json`
- `C:/ADF/docs/phase1/governed-state-writer-serialization/completion-summary.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`

14. Explicit Implementor Rule

The implementor must treat this contract as literal intent.

Do not reinterpret the goal as generic governance cleanup.
Do not widen it into full projection unification.
Do not leave canonical path truth or stale lifecycle wording as a later follow-up.

The slice is done only when the canonical closeout receipt exists, canonical repo-root closeout truth is committed on `main`, lifecycle-sensitive summary wording is regenerated from current truth, and the bounded machine proof passes without interpretation gaps.
