1. Failure Classes

- governed review-handoff truth divergence
- malformed prior-cycle closure artifact

2. Route Contracts

- claimed supported route: cycle-01 fix-pass commit on the rebased branch becomes the single source commit for cycle-02 review, and every governed artifact reflects that same truth.
- end-to-end invariant: `implement-plan` state, execution contract, `review-cycle` state, and `completion-summary.md` must agree on the same branch tip, handoff state, and next safe move.
- KPI Applicability: not required
- KPI Route / Touched Path: None.
- KPI Raw-Truth Source: None.
- KPI Coverage / Proof: None.
- KPI Production / Proof Partition: None.
- KPI Non-Applicability Rationale: this slice only touches Brain bootstrap/skill governance and its governed review artifacts; no KPI-producing product route is changed.
- Vision Compatibility: compatible
- Phase 1 Compatibility: compatible
- Master-Plan Compatibility: compatible
- Current Gap-Closure Compatibility: compatible
- Later-Company Check: no
- Compatibility Decision: compatible
- Compatibility Evidence: the fix is bounded to truthful governed artifact reconciliation for the existing slice and does not widen product scope.
- allowed mutation surfaces: feature-local governed artifacts for `brain-ops-skill-and-codex-claude-wiring`, plus helper-driven projection refresh through existing governed scripts.
- forbidden shared-surface expansion: no new product behavior, no Brain helper surface expansion, no changes to merge-queue/review-cycle architecture beyond what current helper refresh already writes.
- docs that must be updated: `cycle-01/fix-report.md`, `completion-summary.md`, `implement-plan-state.json`, `implement-plan-execution-contract.v1.json`, run projection/contract artifacts, and cycle-02 artifacts.

3. Sweep Scope

- `docs/phase1/brain-ops-skill-and-codex-claude-wiring/**`
- `implementation-run/run-a700b06e-f539-434a-b6f1-566db8a49953/**`
- helper-produced `implement-plan` projection/contract refresh output for this slice only

4. Planned Changes

- refresh the feature execution contract/projection so the integrity block and next safe move reflect the rebased/pushed branch truth instead of stale authority-freeze state
- update feature-local `implement-plan-state.json` so `last_commit_sha` matches the pushed fix-pass commit
- rewrite cycle-01 `fix-report.md` to the exact governed heading contract without changing the underlying proof claims
- update `completion-summary.md` so it stops claiming the fix-pass commit/push is pending and truthfully reflects cycle-02 review in progress
- record cycle-02 fix-pass artifacts and verification proof

5. Closure Proof

- `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs prepare --project-root C:/ADF --phase-number 1 --feature-slug brain-ops-skill-and-codex-claude-wiring --task-summary "..."`
- `node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs prepare --phase-number 1 --feature-slug brain-ops-skill-and-codex-claude-wiring --task-summary "..." --repo-root C:/ADF/.codex/implement-plan/worktrees/phase1/brain-ops-skill-and-codex-claude-wiring`
- direct file proof that:
  - `implement-plan-state.json` uses commit `19c25fe961ebcbdf0b71b12ccc0c91695fde62ee`
  - `implement-plan-execution-contract.v1.json` no longer advertises `authority-freeze-divergence`
  - `cycle-01/fix-report.md` matches the exact required heading contract
  - `completion-summary.md` truthfully reflects the pushed commit and active review cycle

6. Non-Goals

- no new Brain skill functionality
- no runtime-preflight codex flag correction
- no merge-queue logic changes
- no broad implement-plan/review-cycle refactor beyond the current slice artifact refresh
