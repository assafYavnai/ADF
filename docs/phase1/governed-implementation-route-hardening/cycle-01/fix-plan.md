## 1. Failure Classes

- F1: Authority-freeze guard is documentation-only; `evaluateIntegrity()` performs no merge-base authority-diff check.
- F2: Reopen guardrail is documentation-only; `selectCycle()` auto-creates cycle N+1 without checking for new diffs or explicit reopen.
- F3: `resume-blocked` accepts the old approved SHA for stale/conflict blockers and mutates `request.base_branch` without migrating the queue lane.
- F4: Stale-language detector matches literal tokens inside backtick-quoted code examples in human-facing completion summaries.
- F5: Fix-cycle continuity proof is wording-only; no behavioral test verifies delta-only dispatch or implementor reuse.

## 2. Route Contracts

- Claimed supported route: frozen-authority divergence -> pushback; approved-no-diff cycle -> stop; conflict-blocked resume -> require new SHA; completion summary with quoted tokens -> pass; fix-cycle -> delta-only dispatch.
- End-to-end invariants: `prepare` blocks on stale authority; `selectCycle` stops on approved-no-diff; `resume-blocked` rejects same-SHA for conflict/stale; `mark-complete` passes on truthful summaries that quote stale tokens inside backticks; fix-cycle proof covers execution reuse and delta dispatch.
- Allowed mutation surfaces: `evaluateIntegrity()`, `selectCycle()`, `resumeBlocked()`, `detectStaleCloseoutLanguage()`, review-cycle-helper prepare output, state schema.
- Forbidden shared-surface expansion: no new env vars, no new lifecycle fields, no new controller arguments, no new shared helpers.
- Docs to update: fix-plan.md, fix-report.md, existing test files, new behavioral test files.

KPI Applicability: not required
KPI Non-Applicability Rationale: This slice hardens governed workflow enforcement and proof; it does not touch product-runtime KPI routes.

Vision Compatibility: Compatible. The fix closes the gap between documented governance rules and deterministic enforcement, which is core ADF posture.
Phase 1 Compatibility: Compatible. Phase 1 requires governed feature delivery; this fix makes 4 governance gates deterministic.
Master-Plan Compatibility: Compatible. The master plan requires transparent execution and observable workflows; deterministic enforcement improves both.
Current Gap-Closure Compatibility: Supports gap D (governed merge/closeout chain hardening) directly.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: All four fixes close documented-vs-enforced gaps within the governed implementation route. No product-runtime, Brain, or company-formation work is touched.

## 3. Sweep Scope

- `implement-plan-helper.mjs` `evaluateIntegrity()` and any caller that trusts its output before spawning the implementor.
- `review-cycle-helper.mjs` `selectCycle()`, `prepareCycle()`, and the prepare output that drives the orchestrator's next action.
- `merge-queue-helper.mjs` `resumeBlocked()`, queue lane mutation, and `selectNextQueuedRequest()`.
- `implement-plan-helper.mjs` `detectStaleCloseoutLanguage()` and `markComplete()`.
- All existing test files in `skills/tests/` for regression.

## 4. Planned Changes

- F1: Add `checkAuthorityFreeze()` inside `evaluateIntegrity()` that extracts authority paths from the brief `Inputs / Authorities Read` section, computes `git merge-base` between the feature branch and base branch, and runs `git diff --name-only <merge-base>..<base>` to detect divergence. Push a blocking issue when frozen authority files changed. Add a behavioral temp-repo test.
- F2: Add a reopen guard in `selectCycle()`: when `mode === "new"` and `lastCompletedCycle > 0`, check whether there are new commits on the feature branch since the last completed cycle's commit. If not, and no explicit reopen flag was passed, return `mode: "approved_no_new_diffs"` which the prepare output surfaces as a stop. Add a behavioral temp-repo test.
- F3: Store `blocker_class` on blocked requests (derived from `last_error`). In `resumeBlocked()`, when blocker class is `stale_commit` or `merge_conflict`, require a new `approved_commit_sha` that differs from the original. For `base_branch` changes, migrate the request between queue lanes instead of just mutating the field. Add negative behavioral tests.
- F4: Make `detectStaleCloseoutLanguage()` skip content inside backtick-fenced code spans and fenced code blocks before scanning for stale patterns. Add a test proving quoted tokens pass.
- F5: Add a behavioral test in `review-cycle-continuity-reopen.test.mjs` that verifies the helper's `prepare` output preserves implementor execution ID across cycles and the prepare summary signals delta-only dispatch when resuming a rejected cycle.

## 5. Closure Proof

- F1: Temp-repo test where `main` changes a frozen authority file after branch-off -> `prepare` returns `integrity_failed` with `authority-freeze-divergence` issue class.
- F1 negative: Unchanged base authority -> `prepare` proceeds. Feature-branch-only authority edits -> `prepare` proceeds.
- F2: Temp-repo test with approved cycle-01 and no new commits -> `selectCycle` returns `approved_no_new_diffs` mode. Explicit reopen flag -> cycle opens. New commit -> cycle opens.
- F3: Negative test: conflict-blocked resume with same SHA -> rejected. Stale-blocked resume with same SHA -> rejected. New SHA -> accepted. Lane migration test: `resume-blocked --base-branch release` moves request to release lane.
- F4: Completion summary quoting stale tokens inside backticks -> `detectStaleCloseoutLanguage` returns empty. Bare stale tokens -> still detected.
- F5: Consecutive prepare calls on cycles 1 and 2 -> implementor_execution_id preserved; cycle 2 prepare summary signals delta-only fix pass.
- Regression: all existing 54 tests pass.

## 6. Non-Goals

- No rebase automation.
- No contract-format redesign.
- No Brain or bootstrap work.
- No review-strategy redesign.
- No queue-schema rewrite.
- No broad rewrite of historical summaries.
