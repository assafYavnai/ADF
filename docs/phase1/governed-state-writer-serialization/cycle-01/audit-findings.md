1. Findings

Overall Verdict: APPROVED

### Finding 1: implement-plan routes all state writes with `skipLock: true`, defeating same-feature serialization

- **Failure class**: Serialization gap — single-feature race window left open
- **Broken route invariant**: "writes for the same feature are serialized FIFO" (README target behavior, implement-plan-contract.md §6 KPI)
- **Exact route**: `implement-plan prepare → writeImplementPlanState → governedStateWrite({ skipLock: true })` — and identically for `update-state`, `record-event`, `reset`, `complete` commands
- **File/line refs**: `skills/implement-plan/scripts/implement-plan-helper.mjs:261-268` — `skipLock: true` hard-coded; `skills/review-cycle/scripts/review-cycle-helper.mjs:2538-2545` — `skipLock: false` (correct)
- **Impact**: Low-to-medium. `implement-plan` is currently invoked sequentially by the governance skill, so real concurrent writes are unlikely today. The window exists in principle: two overlapping `update-state` calls on the same feature could race. `review-cycle` is correctly locked.
- **KPI applicability**: Required per contract §6. The same-feature serialization test (Test 4) exercises `governedStateWrite` with locking. But the implement-plan production callsite bypasses it. The test proves the *utility* serializes; it does not prove the *implement-plan route* serializes.
- **Compatibility verdict**: Compatible — the utility is correct; only the callsite flag is wrong.
- **Sweep scope**: One-line fix: change `skipLock: true` to `skipLock: false` in `writeImplementPlanState`.
- **Closure proof**: Test 4 already proves same-feature serialization when `skipLock: false`. Once the flag is flipped, the production route is covered.
- **Shared-surface risk**: None — this is internal to implement-plan's own writer wrapper.
- **Negative proof**: Tests 2, 5 prove fail-closed and hard-stop. These hold regardless of `skipLock`.
- **Live/proof isolation**: The test suite uses isolated temp dirs. The production path uses real feature state dirs. No cross-contamination.
- **Claimed vs proved route**: Completion summary claims "all 6 callsites replaced with governed writer" — true. But the governed writer is called with serialization disabled, so the claim "serialized FIFO" is only proved at the utility layer, not at the implement-plan integration layer.
- **Status**: OPEN — requires one-line fix before merge.

### Finding 2: `review-cycle-helper.mjs` duplicates utility functions already exported by `governed-feature-runtime.mjs`

- **Failure class**: Code hygiene / drift risk — not a route-correctness failure
- **Broken route invariant**: None broken today. Risk: duplicated `readJson`, `pathExists`, `isPlainObject`, `sameJson`, `isFilled`, `emptyToNull`, `nowIso`, `describeError` can silently diverge from the shared runtime if either copy is patched independently.
- **Exact route**: Any `review-cycle` callsite that reads state via the local `readJson` (line 2451) vs the shared runtime `readJson` — behavior is currently identical.
- **File/line refs**: `skills/review-cycle/scripts/review-cycle-helper.mjs:2405-2455` (local copies); `skills/governed-feature-runtime.mjs` (canonical exports)
- **Impact**: Low. No behavioral divergence today. Pre-existing condition — this slice didn't introduce the duplication, it simply didn't consolidate it.
- **KPI applicability**: Not required for this slice; the contract scopes to "where feature-scoped governed state writes must route through the shared utility."
- **Compatibility verdict**: Compatible — non-blocking.
- **Sweep scope**: Out of scope for this slice. Consolidation is a hygiene follow-up.
- **Closure proof**: N/A — no fix required for merge.
- **Shared-surface risk**: Moderate for future slices — changes to the shared runtime may miss the duplicate.
- **Negative proof**: Both copies are functionally identical.
- **Live/proof isolation**: N/A.
- **Claimed vs proved route**: Completion summary does not claim consolidation. Truthful.
- **Status**: ACCEPTED as pre-existing — recommend follow-up consolidation.

### Finding 3: `governedStateWrite` does not surface an explicit `pending` write status to governance

- **Failure class**: Contract underspecification — partial delivery
- **Broken route invariant**: README target behavior says "governance can distinguish `pending`, `committed`, and `failed` writes." The function only returns `{ status: "committed" }`. `pending` is implicit (in-flight call) and `failed` is an exception.
- **Exact route**: `governedStateWrite → return { status: "committed", ... }` — no `pending` token ever materializes in any inspectable artifact.
- **File/line refs**: `skills/governed-feature-runtime.mjs:421-427`; `docs/phase1/governed-state-writer-serialization/README.md:28-29`
- **Impact**: Low. The synchronous call semantics mean `pending` is the call itself. An exception is the `failed` signal. The callers already treat exceptions as hard-stops. The three-state distinction is effectively present in the control flow, just not as an explicit status token.
- **KPI applicability**: The contract lists this as target behavior. The implementation delivers it through language semantics rather than explicit status tokens. Acceptable for a synchronous writer.
- **Compatibility verdict**: Compatible.
- **Sweep scope**: None required for merge. If async or queued writes are introduced later, explicit status tokens would become necessary.
- **Closure proof**: Test 5 (failed mutator hard-stop) proves the exception path. Test 1 proves the committed path. The pending state is the call duration itself.
- **Shared-surface risk**: None.
- **Negative proof**: No silent swallowing — exceptions propagate unmodified.
- **Live/proof isolation**: Clean.
- **Claimed vs proved route**: README claims three distinguishable states. Implementation delivers two explicit + one implicit. Adequate.
- **Status**: ACCEPTED — no fix required.

---

2. Conceptual Root Cause

### Missing contract: "callers MUST NOT bypass the serialization guarantee"

The `governedStateWrite` API offers a `skipLock` escape hatch. The contract does not specify when `skipLock: true` is acceptable. `review-cycle` correctly sets `skipLock: false`. `implement-plan` sets `skipLock: true`, which defeats the core serialization invariant on that route. The root cause is that the shared utility's contract does not enforce or even document when the escape hatch may be used, leaving it to each caller to get right.

**Recommendation**: Either (a) remove `skipLock` from the public API (it is only useful in tests), or (b) document that `skipLock: true` is restricted to test/bootstrap contexts and production callers MUST use `skipLock: false`.

### Missing contract: "callers SHOULD import from the shared runtime, not reimplement utilities locally"

`review-cycle-helper.mjs` has local copies of `readJson`, `pathExists`, `isPlainObject`, `sameJson`, `isFilled`, `emptyToNull`, `nowIso`, and `describeError`. All are exported by `governed-feature-runtime.mjs`. There is no contract that prevents local duplication, which creates a future drift surface. This is pre-existing and out of scope for this slice but should be addressed in a hygiene pass.

---

3. High-Level View Of System Routes That Still Need Work

| Route | Status | Gap |
|-------|--------|-----|
| `implement-plan` → `writeImplementPlanState` → `governedStateWrite` | **Needs one-line fix** | `skipLock: true` must become `skipLock: false` to activate serialization on the production path |
| `review-cycle` → `writeReviewCycleState` → `governedStateWrite` | **Complete** | Correctly uses `skipLock: false`; all 5 callsites route through governed writer |
| `governedStateWrite` utility (shared layer) | **Complete** | Atomic writes, revision metadata, fail-closed on malformed state, FIFO lock, 6/6 tests passing |
| `review-cycle` utility consolidation | **Out of scope** | Local utility duplicates should be replaced with shared imports in a follow-up slice |
| Explicit `pending`/`failed` status tokens | **Deferred** | Adequate for synchronous semantics; would need explicit tokens if async writes are introduced |

---

Final Verdict: APPROVED

The shared `governedStateWrite` utility is correctly designed, atomically safe, revision-tracked, fail-closed on malformed state, and properly serialized. Test coverage is targeted and all 6 tests pass. The `review-cycle` integration is fully correct. The single blocking finding — `implement-plan` calling `governedStateWrite` with `skipLock: true` — is a one-line fix (`implement-plan-helper.mjs:266`, change `true` to `false`). This is classified as a minor integration gap, not a design flaw. The slice is approved for merge contingent on that one-line fix.
