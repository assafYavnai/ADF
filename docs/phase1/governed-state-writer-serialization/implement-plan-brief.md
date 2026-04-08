1. Implementation Objective

Implement one shared governed state-writer utility for Phase 1 workflow runtime state so feature-scoped helpers stop doing unsafe whole-file read-modify-write updates directly.

2. Exact Slice Scope

- `skills/governed-feature-runtime.mjs` — add `governedStateWrite` function: serialized (per-feature lock), atomic (write-to-temp + rename), fail-closed on malformed state, write metadata (`__gsw_revision`, `__gsw_write_id`, `__gsw_timestamp`), `skipLock` option for callers already holding the lock
- `skills/implement-plan/scripts/implement-plan-helper.mjs` — import `governedStateWrite`, add `writeImplementPlanState` helper, replace `writeJsonAtomic(*.statePath, ...)` calls in `prepare`, `updateState`, `recordEvent`, `resetAttempt`, `markComplete` with the governed writer (use `skipLock: true` since those are already inside `withLock`); change `loadOrInitializeState` to fail closed on malformed state instead of silently rebuilding
- `skills/review-cycle/scripts/review-cycle-helper.mjs` — import `governedStateWrite` from the shared runtime, add `writeReviewCycleState` helper, replace all `writeJson(statePath, ...)` calls in `prepareCycle`, `updateState`, `recordEvent`, `loadOrInitializeState` with the governed writer; change `loadOrInitializeState` to fail closed on malformed state instead of silently reinitializing
- `skills/tests/governed-state-writer.test.mjs` — targeted tests for: basic committed write with revision tracking, malformed state fail-closed behavior, cross-feature isolation, same-feature serialization (concurrent writes), failed mutator hard-stop, skipLock mode
- `docs/phase1/governed-state-writer-serialization/completion-summary.md` — closeout artifact

3. Inputs / Authorities Read

- `docs/phase1/governed-state-writer-serialization/README.md`
- `docs/phase1/governed-state-writer-serialization/context.md`
- `docs/phase1/governed-state-writer-serialization/implement-plan-contract.md`
- `skills/governed-feature-runtime.mjs` (existing `writeJsonAtomic`, `withLock`, `writeTextAtomic`)
- `skills/implement-plan/scripts/implement-plan-helper.mjs` (existing state write patterns)
- `skills/review-cycle/scripts/review-cycle-helper.mjs` (existing state write patterns)

4. Required Deliverables

- `governedStateWrite` function in `governed-feature-runtime.mjs`
- `writeImplementPlanState` helper + integration in `implement-plan-helper.mjs`
- `writeReviewCycleState` helper + integration in `review-cycle-helper.mjs`
- Fail-closed malformed-state handling in both helpers
- `skills/tests/governed-state-writer.test.mjs` with all targeted tests
- Updated `completion-summary.md`

5. Forbidden Edits

- No broad Brain durability redesign
- No merge-queue redesign
- No second canonical database
- No background daemon or scheduler
- No unrelated COO work
- Do not widen into speculative refactoring

6. Integrity-Verified Assumptions Only

- `writeJsonAtomic` already does atomic write-to-temp + rename
- `withLock` already does per-feature directory-based locking with stale-lock cleanup
- `review-cycle-helper.mjs` currently uses non-atomic `writeFile` directly (root cause of truncation)
- `review-cycle-helper.mjs` `loadOrInitializeState` silently reinitializes on parse failure (lines 1462-1467)
- `implement-plan-helper.mjs` `loadOrInitializeState` silently rebuilds on parse failure (lines 2158-2162)
- All state write calls in `implement-plan-helper.mjs` are inside `withLock` (so `skipLock: true` is required)
- `review-cycle-helper.mjs` has no locks at all currently

7. Explicit Non-Goals

- No Brain schema redesign
- No queue or benchmark harness work
- No executive-status surface work
- No full repo-wide mutable-state architecture migration

8. Proof / Verification Expectations

Machine Verification:
- `node --check` on all modified scripts
- `git diff --check`
- Run `skills/tests/governed-state-writer.test.mjs` — all tests must pass
- Smoke test: `implement-plan-helper.mjs prepare` still works after integration
- Smoke test: `review-cycle-helper.mjs prepare` still works after integration

Human Verification: not required

9. Required Artifact Updates

- `docs/phase1/governed-state-writer-serialization/completion-summary.md`
- `docs/phase1/governed-state-writer-serialization/context.md` if implementation details differ from expected shape

10. Closeout Rules

- Human testing: not required
- Review-cycle: will run after implementation
- Post-human-approval sanity pass: not applicable
- Final completion: only after merge success through merge-queue
