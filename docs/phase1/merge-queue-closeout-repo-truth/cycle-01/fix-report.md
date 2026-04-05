1. Failure Classes Closed

- Closed: merge closeout repo truth no longer serializes temporary merge-worktree roots into tracked implement-plan state, execution contracts, or run projections.
- Closed: merged completion artifacts can now be reconciled idempotently for an already-completed feature, which repaired the stale Spec 1 repo-owned truth.

2. Route Contracts Now Enforced

- Enforced route: approved feature commit -> canonical merge-queue control root -> isolated merge worktree merge/push -> implement-plan closeout persisted as canonical repo-owned artifacts.
- Enforced invariant: physical write root and serialized repo-owned artifact root are separated, so merged docs point at `C:/ADF` even when closeout runs from an isolated worktree.
- Enforced invariant: `mark-complete` can refresh derived closeout artifacts for an already-completed merged feature without inventing a new lifecycle step or erasing attempt history.

3. Files Changed And Why

- `skills/governed-feature-runtime.mjs`: added canonical git-root resolution so merge-queue can anchor control state and queue processing at the real repo root.
- `skills/merge-queue/scripts/merge-queue-helper.mjs`: canonicalized queue/control root handling, preserved feature-root state updates, added canonical repo-root handoff for closeout persistence, and added bounded closeout commit/push support.
- `skills/implement-plan/scripts/implement-plan-helper.mjs`: separated serialized artifact paths from physical write paths, made closeout refresh idempotent, and added final-summary reconciliation helpers.
- `docs/phase1/implement-plan-provider-neutral-run-contract/*`: repaired stale merged repo-owned state, execution contract, run projection, run-scoped contract, and completion summary through the fixed helper path.
- `docs/phase1/merge-queue-closeout-repo-truth/*`: captured review-cycle context and closure artifacts for this slice.

4. Sibling Sites Checked

- Checked `skills/merge-queue/scripts/merge-queue-helper.mjs` for other queue/control-root reads and writes so they now consistently use the canonical git root.
- Checked `skills/implement-plan/scripts/implement-plan-helper.mjs` for other run/contract/projection path serialization points so they now use the canonical artifact root when supplied.
- Checked the repaired Spec 1 feature artifacts to confirm state, execution contract, and run projection all align on canonical `C:/ADF` paths.

5. Proof Of Closure

- Proved route: canonical merge-queue closeout persistence plus repo-owned stale-artifact reconciliation.
- KPI closure state: not required.
- KPI proof: not applicable because the slice repairs governed workflow/runtime truth rather than a KPI-bearing product route.
- `node --check skills/governed-feature-runtime.mjs` passed.
- `node --check skills/implement-plan/scripts/implement-plan-helper.mjs` passed.
- `node --check skills/merge-queue/scripts/merge-queue-helper.mjs` passed.
- `git diff --check` passed with no whitespace errors.
- Canonical repair smoke passed: the repaired Spec 1 `implement-plan-state.json`, `implement-plan-execution-contract.v1.json`, and `implementation-run/.../run-projection.v1.json` now point at `C:/ADF/docs/phase1/implement-plan-provider-neutral-run-contract/...`.
- Negative proof: merge-queue `help`, `get-settings`, and `status` resolve queue/control state to the canonical repo root rather than the invoking feature worktree.
- Live/proof isolation: proof uses the real governed helper path and persisted repo-owned artifacts, not an alternate schema or benchmark-only adapter layer.

6. Remaining Debt / Non-Goals

- None for this route.

7. Next Cycle Starting Point

- None. Start a new cycle only if a later regression reintroduces non-canonical closeout paths or stale merged repo truth.
