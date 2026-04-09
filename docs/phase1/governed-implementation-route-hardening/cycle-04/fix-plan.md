1. Failure Classes

- F1: `record-event --last-commit-sha` writes raw caller text into `last_commit_sha` without repo-object validation; `normalizeStateObject` carries forward stale/invalid anchors without repair.
- F2: No committed consumer converts `fix_cycle_dispatch_mode=delta_only` into actual prompt behavior; the helper signals but does not construct the delta-only input; `completion-summary.md` overstates fix-cycle continuity closure.

2. Route Contracts

- F1 claimed supported route: all authoritative anchor writes to `review-cycle-state.json.last_commit_sha` are repo-validated or repo-derived.
- F1 end-to-end invariant: `update-state`, `record-event`, and load/repair normalization all validate or repair anchors before persisting.
- F2 claimed supported route: when `fix_cycle_dispatch_mode=delta_only`, the helper constructs a machine-readable `fix_cycle_implementor_input` with only rejected artifact paths plus a short fix instruction.
- F2 end-to-end invariant: `prepareCycle` builds `fix_cycle_implementor_input` when dispatch mode is `delta_only`; returns `null` otherwise.
- KPI Applicability: not required.
- KPI Non-Applicability Rationale: governance enforcement route, not product-runtime KPI route.
- Vision Compatibility: Compatible.
- Phase 1 Compatibility: Compatible.
- Master-Plan Compatibility: Compatible.
- Current Gap-Closure Compatibility: Supports gap D.
- Later-Company Check: no.
- Compatibility Decision: compatible.
- Compatibility Evidence: Both fixes close audit/review-identified enforcement gaps within the review-cycle governed route.
- Allowed mutation surfaces: `recordEvent()` anchor write, `normalizeStateObject()` anchor repair, `prepareCycle()` return shape.
- Forbidden shared-surface expansion: no new state fields, no new lifecycle fields, no new arguments to existing commands.
- Docs to update: `completion-summary.md`, `skills/review-cycle/references/workflow-contract.md`, `skills/review-cycle/SKILL.md`.

3. Sweep Scope

- `review-cycle-helper.mjs`: `recordEvent()`, `normalizeStateObject()`, `prepareCycle()`, `resolveFixCycleDispatchMode()`.
- `skills/review-cycle/SKILL.md` and `skills/review-cycle/references/workflow-contract.md` for fix-cycle dispatch rule.
- `skills/tests/review-cycle-continuity-reopen.test.mjs`.
- `docs/phase1/governed-implementation-route-hardening/completion-summary.md`.

4. Planned Changes

- F1: In `recordEvent()`, validate `input.lastCommitSha` with `git cat-file -t` before writing to state; reject nonexistent objects. In `normalizeStateObject()`, validate existing `last_commit_sha` with `git cat-file -t` and repair to `null` when the object does not exist.
- F2: Add `resolveFixCycleImplementorInput()` that, when `fix_cycle_dispatch_mode=delta_only`, builds a `fix_cycle_implementor_input` object containing the prior cycle's rejected report/findings paths plus a short fix instruction. Surface it in the prepare output. Update SKILL.md and workflow-contract.md to document the dispatch input construction rule. Correct `completion-summary.md` to not overstate fix-cycle continuity closure.

5. Closure Proof

- F1 negative: `record-event --last-commit-sha deadbeef...` → rejected. F1 positive: valid SHA persists. F1 normalization: state with invalid `last_commit_sha` → repaired to `null`.
- F2 positive: prepare on a `delta_only` cycle → `fix_cycle_implementor_input` contains rejected artifact paths. F2 negative: prepare on a `fresh` cycle → `fix_cycle_implementor_input` is `null`.
- Regression: all existing 71 tests pass.

6. Non-Goals

- No review-cycle architecture rewrite.
- No schema version bump.
- No enforcing prompt content verbatim at the helper level (the helper constructs the input pack; the orchestrator remains responsible for the actual prompt).
