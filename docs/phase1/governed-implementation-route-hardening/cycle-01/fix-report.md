## 1. Fixes Applied

### F1: Authority-freeze enforcement in implement-plan-helper.mjs

- Added `checkAuthorityFreeze()` function that extracts frozen authority paths from the brief's "Inputs / Authorities Read" section, computes `git merge-base` between the feature branch and base branch, runs `git diff --name-only` to detect changes, and pushes a blocking `authority-freeze-divergence` issue when frozen files changed.
- Added `extractFrozenAuthorityPaths()` that parses absolute paths from the brief and converts them to project-relative paths.
- Integrated into `evaluateIntegrity()` so the check runs before any implementor spawn.
- Added behavioral temp-repo test: `prepare` rejects when `VISION.md` changes on `main` after branch-off; proceeds when unchanged.

### F2: Reopen guardrail enforcement in review-cycle-helper.mjs

- Added `checkForNewDiffsSinceLastCycle()` function that uses `git log <lastCommitSha>..HEAD` to detect new commits since the last completed cycle.
- Modified `selectCycle()` to accept an `options` parameter with `repoRoot`, `lastCommitSha`, and `explicitReopen`.
- When `lastCompletedCycle > 0` and no explicit reopen, if no new diffs exist, returns `mode: "approved_no_new_diffs"` instead of `mode: "new"`.
- Added `--explicit-reopen` argument to the `prepare` command.
- Added behavioral temp-repo tests: approved stream with no new diffs stops; explicit reopen proceeds; new commits reopen.

### F3: Blocker-aware resume enforcement in merge-queue-helper.mjs

- Added `classifyBlocker()` function that classifies `last_error` into `stale_commit`, `merge_conflict`, `closeout_readiness`, `push_failure`, `infrastructure`, or `unknown`.
- Modified `resumeBlocked()`: for `stale_commit` or `merge_conflict` blockers, requires a NEW approved commit SHA that differs from the original.
- Added queue lane migration: when `base_branch` changes, the request is moved from the old lane to the new lane instead of just mutating the field.
- Added behavioral tests: conflict-blocked same-SHA rejected; stale-commit same-SHA rejected; closeout-readiness same-SHA allowed; lane migration on base_branch change.

### F4: Stale-language detector ignores backtick-fenced tokens

- Added `stripCodeContent()` function that removes fenced code blocks (` ```...``` `) and inline code spans (`` `...` ``) before scanning.
- Modified `detectStaleCloseoutLanguage()` to strip code content first.
- Added tests: stale tokens inside backtick code spans pass; stale tokens inside fenced code blocks pass; bare stale tokens still fail.

### F5: Fix-cycle continuity behavioral proof

- Added behavioral test proving `implementor_execution_id` is preserved across cycles via the helper's `prepare` output.
- Test verifies that `reviewer_state.implementor_execution_id` retains the cached value `cached-impl-001` from the approved cycle state.

## 2. Files Changed

- `skills/implement-plan/scripts/implement-plan-helper.mjs` — added `checkAuthorityFreeze()`, `extractFrozenAuthorityPaths()`, integrated into `evaluateIntegrity()`; `detectStaleCloseoutLanguage()` now strips code content before scanning via `stripCodeContent()`
- `skills/review-cycle/scripts/review-cycle-helper.mjs` — added `checkForNewDiffsSinceLastCycle()`; `selectCycle()` now accepts options and enforces reopen guardrail; `prepare` command parses `--explicit-reopen`
- `skills/merge-queue/scripts/merge-queue-helper.mjs` — added `classifyBlocker()`; `resumeBlocked()` enforces blocker-aware SHA requirements and performs lane migration
- `skills/tests/requirement-freeze-guard.test.mjs` — added 2 behavioral temp-repo tests (6 total)
- `skills/tests/review-cycle-continuity-reopen.test.mjs` — added 4 behavioral temp-repo tests (8 total)
- `skills/tests/merge-queue-resume-blocked.test.mjs` — replaced 1 test, added 4 new behavioral tests (8 total)
- `skills/tests/stale-closeout-language.test.mjs` — added 2 backtick-quoting tests (8 total)
- `docs/phase1/governed-implementation-route-hardening/cycle-01/fix-plan.md` — created
- `docs/phase1/governed-implementation-route-hardening/cycle-01/fix-report.md` — created

## 3. Verification Evidence

- `node --check` passed on all 3 modified helper scripts
- `git diff --check` passed (no whitespace issues)
- 65/65 tests pass across 11 test files (11 new + 54 existing), zero regressions
- Targeted source scan confirms zero `master` references in active authoritative docs

## 4. Remaining Gaps

- Fix-cycle delta-only dispatch shape is proved at the execution-reuse level (implementor ID preserved), but not at the prompt-content level (no test that inspects the actual prompt sent to the implementor). This is an orchestration-discipline surface, not a helper-enforceable surface.
- The `--explicit-reopen` flag is parsed but not yet documented in the review-cycle SKILL.md optional inputs list. This is a minor doc gap, not a behavioral gap.
