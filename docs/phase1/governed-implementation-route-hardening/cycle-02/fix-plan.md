1. Failure Classes

- F1: `review-cycle update-state --last-commit-sha` accepts nonexistent, malformed, or non-ancestor SHAs without validation; `checkForNewDiffsSinceLastCycle` treats git failure (bad object) as no-new-diffs instead of failing closed.
- F2: `checkAuthorityFreeze` only extracts frozen authority paths from the brief; contract-only prepare routes bypass the guard entirely.
- F3: `determineNextAction` still returns `send_cycle_request_to_auditor_and_reviewer` even when `selectCycle` returns `approved_no_new_diffs` mode; the hold is not carried through to the prepare output's next action.
- F4: Fix-cycle continuity has no helper-owned signal distinguishing delta-only dispatch from fresh dispatch; the orchestrator has no machine-checkable field to enforce the delta-only contract.

2. Route Contracts

- Claimed supported route: anchor integrity -> validated before persist and fail-closed on corrupt state; contract-or-brief authority freeze -> pushback; approved-no-diff -> hold next_action; fix-cycle -> helper signals delta-only dispatch.
- End-to-end invariants: `update-state` rejects invalid SHAs; `checkForNewDiffsSinceLastCycle` fails closed on bad objects; `evaluateIntegrity` checks both contract and brief for frozen authorities; `determineNextAction` returns `approved_no_new_diffs_hold` when cycle mode is `approved_no_new_diffs`; prepare output includes `fix_cycle_dispatch_mode` distinguishing `delta_only` from `fresh`.
- Allowed mutation surfaces: `updateState()`, `checkForNewDiffsSinceLastCycle()`, `checkAuthorityFreeze()` / `extractFrozenAuthorityPaths()`, `determineNextAction()`, prepare output shape.
- Forbidden shared-surface expansion: no new env vars, no new lifecycle fields beyond `fix_cycle_dispatch_mode`, no new controller arguments, no schema version bump.
- Docs to update: fix-plan.md, fix-report.md, test files.

KPI Applicability: not required
KPI Non-Applicability Rationale: This slice hardens governed workflow enforcement; it does not touch product-runtime KPI routes.

Vision Compatibility: Compatible.
Phase 1 Compatibility: Compatible.
Master-Plan Compatibility: Compatible.
Current Gap-Closure Compatibility: Supports gap D directly.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: All four fixes close audit/review-identified enforcement gaps within the governed implementation route.

3. Sweep Scope

- `review-cycle-helper.mjs` `updateState()`, `checkForNewDiffsSinceLastCycle()`, `selectCycle()`, `prepareCycle()`, `determineNextAction()`.
- `implement-plan-helper.mjs` `checkAuthorityFreeze()`, `extractFrozenAuthorityPaths()`.
- `skills/tests/` for all affected test files.
- Existing 65 tests for regression.

4. Planned Changes

- F1: In `updateState()`, validate `last_commit_sha` with `git rev-parse --verify` before persisting; reject nonexistent objects. In `checkForNewDiffsSinceLastCycle()`, when `gitOutput` returns null (git failure), return `true` (fail open = allow reopen) instead of `false` (block as no-diff). This makes corrupt state fail toward safety (allow review) rather than silently blocking.
- F2: In `extractFrozenAuthorityPaths()`, also parse the contract text's `Source Authorities` or `Inputs / Authorities Read` equivalent section. Modify `checkAuthorityFreeze()` to check both brief and contract text.
- F3: In `determineNextAction()`, add an early check: when the cycle mode is `approved_no_new_diffs`, return `approved_no_new_diffs_hold`. Pass cycle mode through to the function. In the prepare output, surface `reopen_blocked_reason` at the top level when the hold is active.
- F4: In `prepareCycle()` return, add `fix_cycle_dispatch_mode`: `delta_only` when resuming an existing rejected cycle with a cached implementor, `fresh` otherwise. Surface it in the prepare output summary.

5. Closure Proof

- F1: Negative test: `update-state --last-commit-sha nonexistent-sha` -> rejected. Positive test: valid SHA -> accepted. Test: corrupt state SHA in `checkForNewDiffsSinceLastCycle` -> returns true (allows reopen, not blocks).
- F2: Temp-repo test: contract-only prepare with changed authority on main -> `authority-freeze-divergence`. Negative: unchanged base -> no issue.
- F3: Test: approved-no-diff prepare returns `next_action=approved_no_new_diffs_hold`. Test: explicit reopen returns normal next_action.
- F4: Test: prepare on a rejected cycle with cached implementor returns `fix_cycle_dispatch_mode=delta_only`. Test: prepare on a fresh cycle returns `fix_cycle_dispatch_mode=fresh`.
- Regression: all existing tests pass.

6. Non-Goals

- No review-cycle architecture rewrite.
- No agent-registry redesign.
- No schema version bump.
- No broader lifecycle refactor.
- No rewriting of cycle-01 artifacts.
