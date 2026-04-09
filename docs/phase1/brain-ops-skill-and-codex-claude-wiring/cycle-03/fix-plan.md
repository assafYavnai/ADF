1. Failure Classes

- governed review-handoff truth divergence across the cycle-02 closeout lineage and the cycle-03 approval-review kickoff.

2. Route Contracts

- claimed supported route: cycle-02 artifact reconciliation closeout -> committed cycle-02 closeout-state sync -> cycle-03 approval review on the same reviewed branch truth.
- end-to-end invariant: the current branch-tip artifacts must preserve one explicit closeout lineage and one explicit active review-request marker across `implement-plan-state.json`, `review-cycle-state.json`, and `completion-summary.md`.
- KPI Applicability: not required.
- KPI Route / Touched Path: not applicable.
- KPI Raw-Truth Source: not applicable.
- KPI Coverage / Proof: not applicable.
- KPI Production / Proof Partition: not applicable.
- KPI Non-Applicability Rationale: this fix only reconciles governed review-handoff truth for a repo skill slice and does not touch a product KPI route.
- Vision Compatibility: compatible because the fix tightens fail-closed governed truth instead of widening behavior.
- Phase 1 Compatibility: compatible because it preserves bounded repo-skill scope and truthful review state.
- Master-Plan Compatibility: compatible because it strengthens deterministic governance evidence.
- Current Gap-Closure Compatibility: compatible because it closes the open cycle-03 artifact lineage gap without broadening into review-cycle architecture work.
- Later-Company Check: no later-company expansion; this pass is feature-local artifact reconciliation only.
- Compatibility Decision: proceed.
- Compatibility Evidence: both cycle-03 rejection reports call for one explicit cycle-02 closeout lineage and one explicit active review-request truth on the branch tip.
- allowed mutation surfaces: `docs/phase1/brain-ops-skill-and-codex-claude-wiring/cycle-03/*`, `docs/phase1/brain-ops-skill-and-codex-claude-wiring/completion-summary.md`, and governed state updates through repo helpers only.
- forbidden shared-surface expansion: no `skills/brain-ops/*`, no bootstrap changes, no helper architecture changes, no merge-queue changes.
- docs that must be updated: `completion-summary.md` and `cycle-03/fix-report.md`.

3. Sweep Scope

- `implement-plan-state.json`
- `review-cycle-state.json`
- `implement-plan-execution-contract.v1.json`
- `implementation-run/run-a700b06e-f539-434a-b6f1-566db8a49953/run-projection.v1.json`
- `completion-summary.md`

4. Planned Changes

- Align `implement-plan` review-request truth to the already-open cycle-03 review via helper-recorded governed state.
- Preserve the cycle-02 closeout lineage explicitly in `completion-summary.md`, including which commit closed cycle-02 and which commit only aligned state before the approval review.
- Keep the fix artifact-only; do not mutate the `brain-ops` product route or shared workflow code.

5. Closure Proof

- `implement-plan-state.json` and `review-cycle-state.json` both carry the same cycle-03 review request timestamp.
- `completion-summary.md` explicitly names the cycle-02 closeout-state commit and the cycle-03 pre-review alignment commit so the current branch tip no longer tells competing lineage stories.
- cycle-04 review can approve the branch tip without depending on dirty-only state or ambiguous commit lineage.

- targeted regression checks:
  - review the updated `completion-summary.md` against `git log --oneline origin/main..HEAD` before committing
  - compare `implement-plan-state.json` and `review-cycle-state.json` directly before writing `cycle-03/fix-report.md`

6. Non-Goals

- No changes to `skills/brain-ops/*`.
- No changes to `docs/bootstrap/cli-agent.md`.
- No generic review-cycle or implement-plan architecture redesign.
- No merge-to-main work in this fix pass itself.
