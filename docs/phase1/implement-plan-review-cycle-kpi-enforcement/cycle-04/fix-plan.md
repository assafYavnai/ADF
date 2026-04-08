1. Failure Classes
- closeout-truth synchronization drift across human-facing cycle-03 closeout artifacts and helper-state read truth.

2. Route Contracts
- claimed supported route: `cycle-03 completion-summary + cycle-03 fix-report closeout narrative -> review-cycle closeout state -> cycle-04 rejecting-lane resume`
- end-to-end invariant: when cycle-03 is recorded complete in reviewer-facing docs, future-pass guidance must be sourced from current review-cycle helper state at the handoff point and must not be hard-coded to historical anchors.
- For truthful continuity, cycle-03 closeout chain is fixed as:
  - content commit `8d72ec8df1d1b61727385a0e22407be744bb8947`
  - helper/state closeout commit `a35151a43ea35d83a4ba7c1de791b529ce527e5d`
- KPI Applicability: required
- KPI Route / Touched Path: feature closeout documentation path in `docs/phase1/implement-plan-review-cycle-kpi-enforcement/`
- KPI Raw-Truth Source: `review-cycle-state.json` + live branch head/state in the feature worktree
- KPI Coverage / Proof: updated `completion-summary.md` and `cycle-03/fix-report.md` must explicitly align on the fixed historical cycle-03 closeout chain and include no hard-coded next-pass anchor.
- KPI Production / Proof Partition: docs-only surface; helper state is read-only in this lane.
- KPI Non-Applicability Rationale when KPI is not required: none.
- KPI Exception Owner / Expiry / Production Status / Compensating Control when a temporary exception is approved: none.
- Vision Compatibility: compatible.
- Phase 1 Compatibility: compatible.
- Master-Plan Compatibility: compatible.
- Current Gap-Closure Compatibility: compatible.
- Later-Company Check: no.
- Compatibility Decision: compatible.
- Compatibility Evidence: failure was human-facing closeout drift only, so this lane is restricted to closeout-document alignment.
- allowed mutation surfaces: `completion-summary.md`, `cycle-03/fix-report.md`, `cycle-04/fix-plan.md`, `cycle-04/fix-report.md`.
- forbidden shared-surface expansion: no helper/runtime edits; no `review-cycle-state.json` edit.
- docs that must be updated: `completion-summary.md`, `cycle-03/fix-report.md`, `cycle-04/fix-plan.md`, `cycle-04/fix-report.md`.

3. Sweep Scope
- feature-root route surfaces under `docs/phase1/implement-plan-review-cycle-kpi-enforcement/` that can route future work (`completion-summary.md`, `cycle-03/fix-report.md`).
- `cycle-04/audit-findings.md` as issue context.
- `review-cycle-state.json` as read-only truth input only.

4. Planned Changes
- Update `completion-summary.md` so it freezes the historical cycle-03 closeout chain without hard-coding a moving future-pass head.
- Update `cycle-03/fix-report.md` so its next-cycle guidance is sourced from helper state at handoff time instead of a historical SHA.
- Write `cycle-04/fix-plan.md` and `cycle-04/fix-report.md` in the same stable historical-chain framing.
- Keep `review-cycle-state.json` and workflow/helper/runtime code unchanged in this pass.

5. Closure Proof
- route to prove: synchronized closeout-anchor propagation from state truth -> human-facing closeout artifacts.
- proof route: `review-cycle-state.json` + updated text in `completion-summary.md` + updated text in `cycle-03/fix-report.md`.
- negative proof target: no active surface states cycle-04 next pass starts from `77d98598...` or says cycle-03 was still uncommitted/pending.
- live/proof isolation: docs-only edits and read-only state reference.

6. Non-Goals
- No helper/runtime edits.
- No `review-cycle-state.json` edits.
- No merge-queue/runtime hardening work.
- No hard-coded future-pass anchor in cycle-04 human-facing artifacts.
