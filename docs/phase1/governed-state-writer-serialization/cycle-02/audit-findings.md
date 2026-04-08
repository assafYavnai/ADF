1. Findings

Overall Verdict: APPROVED

**1a. Core utility (`governedStateWrite` in `governed-feature-runtime.mjs:386-439`)**
- Correctly validates all three required parameters (`statePath`, `featureSlug`, `mutator` being a function).
- Read-mutate-write cycle is atomic: reads existing file, passes parsed state to mutator, stamps `__gsw_revision`, `__gsw_write_id`, `__gsw_timestamp`, writes via `writeJsonAtomic` (temp-file + rename).
- Feature-scoped locking via `withLock` uses `mkdir`-based lock acquisition with stale-lock detection (120s) and configurable timeout (15s). Lock directory is derived from `dirname(statePath)/.gsw-locks/` keyed by sanitized feature slug — this correctly isolates different features while serializing same-feature writes.
- `skipLock` option bypasses locking when serialization is handled at a higher level or is unnecessary.
- Mutator errors propagate without writing — fail-closed is correct.
- Malformed JSON on disk causes `JSON.parse` to throw before mutator runs — file is left untouched. Fail-closed confirmed.
- `isPlainObject` check on mutator return prevents accidental array/null writes.

**1b. `implement-plan` integration (`implement-plan-helper.mjs:261-268`)**
- `writeImplementPlanState` delegates to `governedStateWrite` with `skipLock: true`. This is acceptable because `implement-plan` runs as a single sequential workflow — there is no concurrent same-feature writer to race with.
- `loadOrInitializeState` (line 2293) reads state via `readJson` and throws on malformed JSON (fail-closed, line 2303). Writes go through `writeImplementPlanState`.
- All 10+ call-sites for state persistence route through the governed writer — no direct `writeJsonAtomic` or `writeFile` calls touch the state file.

**1c. `review-cycle` integration (`review-cycle-helper.mjs:2722-2729`)**
- `writeReviewCycleState` delegates to `governedStateWrite` with `skipLock: false` — full serialization is active. This is the correct choice since review-cycle has concurrent route potential (auditor/reviewer/implementor continuity).
- `loadOrInitializeState` (line 1623) throws on malformed JSON (fail-closed, line 1637). All state writes funnel through `writeReviewCycleState`.
- Local `writeJson`/`writeText` helpers (lines 2645-2653) are only used for non-state files (registry at line 1976, readme at line 2037) — no state bypass.

**1d. Test coverage (`governed-state-writer.test.mjs`)**
- 6 tests, all passing. Coverage spans: basic revision tracking, malformed-state fail-closed, cross-feature isolation (parallel writes to different features), same-feature serialization (5 concurrent increments producing sequential revisions and correct final counter=5), failed mutator hard-stop, and skipLock mode.
- The concurrent serialization test (Test 4) is the most important — it proves FIFO ordering and no lost updates under contention.

**1e. Noted asymmetry (non-blocking)**
- `implement-plan` uses `skipLock: true`; `review-cycle` uses `skipLock: false`. This is a deliberate architectural choice reflecting their different concurrency profiles, not a defect. However, this should be documented in the contract so future maintainers don't "fix" it.

2. Conceptual Root Cause

The pre-existing defect was that both `implement-plan` and `review-cycle` performed raw `readJson` → mutate → `writeJsonAtomic`/`writeFile` directly, with no coordination layer. This meant two things could go wrong: (a) concurrent same-feature writes could read the same revision and one would silently overwrite the other (lost update), and (b) there was no durable write-id or revision counter to let governance distinguish "write succeeded" from "write is still pending" or "write failed silently."

The fix centralizes all state mutations through `governedStateWrite`, which provides a single serialized read-mutate-write path with optional file-system locking, atomic replacement via temp-file rename, and durable revision/write-id/timestamp metadata stamped on every committed state object. Governance can now distinguish committed writes (presence of `__gsw_write_id` matching the expected write), and failed writes propagate errors without touching the file on disk.

3. High-Level View Of System Routes That Still Need Work

- **merge-queue state writes**: `merge-queue` was explicitly out of scope for this slice but likely has the same raw read-modify-write pattern. It should be migrated to `governedStateWrite` in a follow-up feature.
- **Registry and index writes in both helpers**: The feature agent registry (`implement-plan-helper.mjs:4891`) and features index (`implement-plan-helper.mjs:4922`) use `writeJsonAtomic` directly, not `governedStateWrite`. These are cross-feature files and would need a different locking strategy (not feature-scoped), but they are still susceptible to concurrent-write races if two feature streams update them simultaneously.
- **review-cycle non-atomic local helpers**: `writeJson` and `writeText` in `review-cycle-helper.mjs` (lines 2645-2653) use raw `writeFile` without temp-file rename. While they currently only write non-state files (registry, readme), if future code routes state-adjacent data through them, atomicity would be lost. Consider migrating these to `writeJsonAtomic`/`writeTextAtomic` from the shared runtime.
- **Contract and projection writes in implement-plan**: Several artifact writes (`writeJsonAtomic` at lines 1537, 3452-3453, 3876) update execution contracts and projections outside the governed path. These are not state files per se, but concurrent run scenarios (especially benchmarking lanes) could race on them.
- **skipLock documentation**: The `implement-plan` / `review-cycle` asymmetry on `skipLock` is correct but undocumented. The implementation contract should explicitly state which callers use locking and why.

Final Verdict: APPROVED
