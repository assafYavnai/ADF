1. Failure Classes

- F1: `selectCycle` reopen guard treats any `last_completed_cycle > 0` as approved; a rejected completed cycle with no new diffs falsely returns `approved_no_new_diffs_hold` instead of allowing a new review pass.
- F2: `resolveFixCycleDispatchMode` returns `delta_only` for any `resume` mode with a cached implementor, including `review_in_progress` states that are not fix dispatches; the signal is overbroad and no live consumer enforces delta-only.

2. Route Contracts

- Claimed supported route: only actually approved completed cycles trigger the no-diff hold; `fix_cycle_dispatch_mode=delta_only` only signals for cycles that are in a fix-dispatch state after rejection, not during review-in-progress or other non-fix resume states.
- End-to-end invariants: `selectCycle` checks persisted lane verdicts from the last completed cycle before issuing `approved_no_new_diffs`; `resolveFixCycleDispatchMode` checks `currentCycleState` to distinguish fix-dispatch resumes from review-in-progress resumes.
- Allowed mutation surfaces: `selectCycle()`, `resolveFixCycleDispatchMode()`, prepare output.
- Forbidden shared-surface expansion: no new state fields, no new env vars, no schema version bump.
- Docs to update: fix-plan.md, fix-report.md, test files.

KPI Applicability: not required
KPI Non-Applicability Rationale: This slice hardens review-cycle governance enforcement; no product-runtime KPI routes touched.

Vision Compatibility: Compatible.
Phase 1 Compatibility: Compatible.
Master-Plan Compatibility: Compatible.
Current Gap-Closure Compatibility: Supports gap D directly.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: Both fixes close audit/review-identified enforcement gaps within the review-cycle governed route.

3. Sweep Scope

- `review-cycle-helper.mjs` `selectCycle()`, `resolveFixCycleDispatchMode()`, `prepareCycle()`.
- `skills/tests/review-cycle-continuity-reopen.test.mjs`.
- Existing 69 tests for regression.

4. Planned Changes

- F1: Pass `state` (or at least the last completed cycle's lane verdicts) into `selectCycle`. Before returning `approved_no_new_diffs`, check that both auditor and reviewer verdicts from the last completed cycle's runtime are `approve`. If either is `reject` or `unknown`, treat the completed cycle as non-approved and allow a new review pass.
- F2: Tighten `resolveFixCycleDispatchMode`: return `delta_only` only when `cycleStatus.mode === "resume"` AND the `currentCycleState` indicates a fix-dispatch state (`fix_planned_or_implementation_in_progress` or `findings_ready_for_fix_planning`). For `review_in_progress` and `review_not_started` states, return `fresh` even with a cached implementor.

5. Closure Proof

- F1: Negative test: rejected completed cycle with no new diffs -> mode is NOT `approved_no_new_diffs`, next_action is NOT `approved_no_new_diffs_hold`. Positive test: approved completed cycle with no new diffs -> mode IS `approved_no_new_diffs`.
- F2: Test: resume on a `review_in_progress` cycle with a cached implementor -> `fix_cycle_dispatch_mode=fresh`. Test: resume on a `fix_planned_or_implementation_in_progress` cycle with a cached implementor -> `fix_cycle_dispatch_mode=delta_only`.
- Regression: all existing tests pass.

6. Non-Goals

- No review-cycle architecture rewrite.
- No agent-registry redesign.
- No schema version bump.
- No enforcing prompt construction at the helper level (that remains orchestration discipline).
