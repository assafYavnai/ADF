1. Failure Classes

- silent route-boundary drift into unapproved `merge-queue` and shared-runtime hardening
- stale fetched-ref authorization bypass introduced by the unapproved hardening path
- mutable checkout authority leak introduced by the unapproved hardening path

2. Route Contracts

- Failure class: `silent route-boundary drift into unapproved merge-queue and shared-runtime hardening`
  - claimed supported route: `implement-plan` KPI applicability gate -> `review-cycle` KPI closure/reporting
  - end-to-end invariant: this stream may only carry the cycle-01 approved KPI-governance route and must not silently turn into a new merge-queue or shared-runtime hardening program
  - KPI Applicability: required
  - KPI Route / Touched Path: repo-owned `skills/implement-plan/*` KPI gate plus `skills/review-cycle/*` KPI closure/reporting
  - KPI Raw-Truth Source: repo-owned workflow contracts, prompt templates, helper validation, and feature/cycle artifacts
  - KPI Coverage / Proof: restore code and docs to the pre-`827f028` route boundary and rerun the approved KPI-gate proof
  - KPI Production / Proof Partition: proof stays in local workflow helpers and feature artifacts; no COO production runtime route is widened in this pass
  - KPI Non-Applicability Rationale: None.
  - KPI Exception Owner / Expiry / Production Status / Compensating Control when a temporary exception is approved: None.
  - Vision Compatibility: compatible
  - Phase 1 Compatibility: compatible
  - Master-Plan Compatibility: compatible
  - Current Gap-Closure Compatibility: compatible only if the stream is restored to the cycle-01 approved route boundary
  - Later-Company Check: no
  - Compatibility Decision: compatible
  - Compatibility Evidence: cycle-01 approved the KPI-governance route; both cycle-02 lanes rejected the later merge-queue/runtime re-scope
  - allowed mutation surfaces: feature-local docs/state, `skills/implement-plan/*`, `skills/merge-queue/*`, and `skills/governed-feature-runtime.mjs` only as needed to restore the pre-`827f028` behavior
  - forbidden shared-surface expansion: no new merge-queue KPI program, no new shared runtime behavior, no review-cycle redesign
  - docs that must be updated: `README.md`, `context.md`, `implement-plan-contract.md`, `implement-plan-brief.md`, `implement-plan-state.json`, `completion-summary.md`, `review-cycle-state.json`, `cycle-02/fix-plan.md`, `cycle-02/fix-report.md`

- Failure class: `stale fetched-ref authorization bypass introduced by the unapproved hardening path`
  - claimed supported route: no supported route remains in this slice after repair; closure here means removing the branch-only merge-queue hardening delta
  - end-to-end invariant: this feature stream must not leave unapproved merge-authorization logic behind once the slice is restored
  - KPI Applicability: not required
  - KPI Route / Touched Path: removed branch-only `merge-queue process-next` hardening path
  - KPI Raw-Truth Source: repo diff against `5dd4783`
  - KPI Coverage / Proof: prove the offending merge-queue delta is absent after repair
  - KPI Production / Proof Partition: proof is diff-based on repo-owned workflow code, not live merge execution
  - KPI Non-Applicability Rationale: this pass restores the approved feature boundary instead of certifying a new merge-queue route
  - KPI Exception Owner / Expiry / Production Status / Compensating Control when a temporary exception is approved: None.
  - Vision Compatibility: compatible
  - Phase 1 Compatibility: compatible
  - Master-Plan Compatibility: compatible
  - Current Gap-Closure Compatibility: compatible only when the unauthorized merge-queue delta is removed
  - Later-Company Check: no
  - Compatibility Decision: compatible
  - Compatibility Evidence: both cycle-02 lanes recommended removing the broadened branch-local merge-queue path rather than widening this slice further
  - allowed mutation surfaces: `skills/merge-queue/*`, `skills/governed-feature-runtime.mjs`, and truthful feature docs
  - forbidden shared-surface expansion: no follow-on merge-queue fix program, no schema or lifecycle expansion, no additional retry/requeue work
  - docs that must be updated: feature contract/brief/summary/state plus `cycle-02/fix-plan.md` and `cycle-02/fix-report.md`

- Failure class: `mutable checkout authority leak introduced by the unapproved hardening path`
  - claimed supported route: no supported route remains in this slice after repair; closure here means removing the branch-only shared-runtime/base-branch hardening delta
  - end-to-end invariant: this feature stream must not leave shared base-branch authority changes behind once the slice is restored
  - KPI Applicability: not required
  - KPI Route / Touched Path: removed branch-only canonical-root/base-branch hardening path
  - KPI Raw-Truth Source: repo diff against `5dd4783`
  - KPI Coverage / Proof: prove the offending runtime and caller deltas are absent after repair
  - KPI Production / Proof Partition: proof is diff-based on repo-owned workflow code, not live branch landing
  - KPI Non-Applicability Rationale: this pass restores approved scope instead of certifying new shared-runtime behavior
  - KPI Exception Owner / Expiry / Production Status / Compensating Control when a temporary exception is approved: None.
  - Vision Compatibility: compatible
  - Phase 1 Compatibility: compatible
  - Master-Plan Compatibility: compatible
  - Current Gap-Closure Compatibility: compatible only when the unauthorized shared-surface delta is removed
  - Later-Company Check: no
  - Compatibility Decision: compatible
  - Compatibility Evidence: cycle-02 findings tied this defect to the branch-only hardening path, not to the cycle-01 approved KPI-governance route
  - allowed mutation surfaces: `skills/governed-feature-runtime.mjs`, `skills/implement-plan/scripts/implement-plan-helper.mjs`, and truthful feature docs
  - forbidden shared-surface expansion: no new base-branch detection design, no broader worktree/runtime refactor
  - docs that must be updated: feature contract/brief/summary/state plus `cycle-02/fix-plan.md` and `cycle-02/fix-report.md`

3. Sweep Scope

- `skills/implement-plan/SKILL.md`
- `skills/implement-plan/references/workflow-contract.md`
- `skills/implement-plan/references/prompt-templates.md`
- `skills/implement-plan/scripts/implement-plan-helper.mjs`
- `skills/review-cycle/SKILL.md`
- `skills/review-cycle/references/workflow-contract.md`
- `skills/review-cycle/references/prompt-templates.md`
- `skills/merge-queue/SKILL.md`
- `skills/merge-queue/references/workflow-contract.md`
- `skills/merge-queue/references/prompt-templates.md`
- `skills/merge-queue/scripts/merge-queue-helper.mjs`
- `skills/governed-feature-runtime.mjs`
- feature root docs plus `cycle-01` and `cycle-02` artifacts for claimed-route versus proved-route consistency

4. Planned Changes

- Restore the top-of-branch changes in `skills/implement-plan/*`, `skills/merge-queue/*`, and `skills/governed-feature-runtime.mjs` to their pre-`827f028` state so this stream matches the cycle-01 approved route boundary again.
- Restore the feature-local contract, brief, context, README, implement-plan state, and completion summary to the approved KPI-governance route, then add cycle-02 artifacts that explain the boundary restoration truthfully.
- Update `review-cycle-state.json` only to reflect cycle-02 fix-plan/fix-report and verification progress; do not mark commit or push complete.
- New-power analysis: none. This pass must remove unapproved shared-surface power, not add it.

5. Closure Proof

- Proved route: `implement-plan` contract intake -> helper KPI applicability gate -> `review-cycle` KPI closure/reporting
- KPI closure proof: rerun the approved KPI-gate verification after restoration and record the outputs in `cycle-02/fix-report.md`
- Negative proof required: show no remaining diff versus `5dd4783` for `skills/merge-queue/*` and `skills/governed-feature-runtime.mjs`
- Live/proof isolation checks: proof is route-aligned repo state plus helper verification only; no harness toggles or alternate bootstrap path may be required
- Targeted regression checks:
  - `node --check skills/implement-plan/scripts/implement-plan-helper.mjs`
  - `node --check skills/review-cycle/scripts/review-cycle-helper.mjs` only if the file ends up changed; otherwise not required
  - targeted helper smoke proving the restored KPI-required missing-fields case still fails with `incomplete-kpi-contract-freeze`
  - targeted helper smoke proving valid KPI-required and KPI-not-required cases still pass with `run_allowed=true`
  - diff proof showing the rejected merge-queue/runtime hardening delta is absent from the worktree after repair

6. Non-Goals

- No new merge-queue KPI applicability or KPI closure program in this pass.
- No attempt to individually harden the rejected merge-queue/runtime defects inside this feature stream.
- No review-cycle redesign.
- No commit or push.
