1. Failure Classes

- F1: `resolveFixCycleImplementorInput()` over-collects `rejected_artifact_paths` during `delta_only` dispatch by pulling prior approved-cycle artifacts and `fix-report.md` into the helper-owned implementor input.

2. Route Contracts

- F1 claimed supported route: when `fix_cycle_dispatch_mode` is `delta_only`, `fix_cycle_implementor_input.rejected_artifact_paths` contains only the active rejecting cycle's findings/report artifacts that belong to that rejecting context.
- F1 end-to-end invariant: later-cycle `delta_only` resumes include only the active cycle's `audit-findings.md` and `review-findings.md`; they exclude prior approved-cycle artifacts and exclude `fix-report.md`.
- Fresh-dispatch invariant: when dispatch mode is `fresh`, `fix_cycle_implementor_input` remains `null`.
- KPI Applicability: not applicable.
- KPI Non-Applicability Rationale: helper continuity enforcement route, not a product-runtime KPI route.
- Vision Compatibility: Compatible.
- Phase 1 Compatibility: Compatible.
- Master-Plan Compatibility: Compatible.
- Current Gap-Closure Compatibility: closes the remaining cycle-05 delta-only continuity defect.
- Later-Company Check: no.
- Compatibility Decision: compatible.
- Compatibility Evidence: the rejected-cycle context identifies only one remaining defect in helper-owned delta-only artifact membership, and the requested closure is confined to that route.
- Allowed mutation surfaces: `skills/review-cycle/scripts/review-cycle-helper.mjs`, `skills/tests/review-cycle-continuity-reopen.test.mjs`, and `docs/phase1/governed-implementation-route-hardening/cycle-05/fix-report.md`.
- Forbidden shared-surface expansion: no new helper commands, no new state fields, no widening beyond delta-only implementor-input construction.
- Docs to update: `docs/phase1/governed-implementation-route-hardening/cycle-05/fix-report.md`.

3. Sweep Scope

- `resolveFixCycleImplementorInput()` in `skills/review-cycle/scripts/review-cycle-helper.mjs`.
- Later-cycle delta-only behavioral proof in `skills/tests/review-cycle-continuity-reopen.test.mjs`.
- Cycle-05 fix artifacts only.

4. Planned Changes

- Change `resolveFixCycleImplementorInput()` so `delta_only` mode sources `rejected_artifact_paths` only from the active rejecting cycle artifacts and only for `audit-findings.md` and `review-findings.md`.
- Remove prior-cycle artifact collection from the helper-owned delta pack and keep `fix-report.md` excluded.
- Add a later-cycle behavioral test that proves exact membership for the rejecting cycle and negative proof for excluded prior approved-cycle files and excluded `fix-report.md`.
- Preserve the existing `fresh` behavior where `fix_cycle_implementor_input` is `null`.

5. Closure Proof

- Positive proof: a later-cycle `delta_only` resume returns exactly the rejecting cycle's `audit-findings.md` and `review-findings.md`.
- Negative proof: the same test proves prior approved-cycle `audit-findings.md`, `review-findings.md`, and `fix-report.md` are absent.
- Regression proof: the existing fresh-dispatch test still proves `fix_cycle_implementor_input === null`.
- Syntax and focused behavioral verification: `node --check skills/review-cycle/scripts/review-cycle-helper.mjs` and `node skills/tests/review-cycle-continuity-reopen.test.mjs`.

6. Non-Goals

- No changes to review-cycle orchestration outside delta-only implementor-input construction.
- No doc-contract rewrites beyond cycle-05 fix artifacts.
- No schema/version changes and no review-strategy behavior changes.
