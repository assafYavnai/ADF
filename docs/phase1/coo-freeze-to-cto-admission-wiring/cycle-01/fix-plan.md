1. Failure Classes
- Proof partition can persist CTO-admission artifacts into a real checkout/worktree feature root.
- Deterministic CTO-admission feature-root identity is derived from topic text instead of the stable scope slug.

2. Route Contracts
- Failure class: proof partition contamination.
  Claimed supported route: `proof-mode bootstrap -> live onion freeze -> CTO admission handoff -> isolated proof artifact root or fail-closed`.
  End-to-end invariant: proof inputs must never overwrite `docs/phase1/<feature-slug>/cto-admission-*` inside a real ADF checkout/worktree.
  KPI Applicability: required.
  KPI Route / Touched Path: `COO/controller/** -> COO/requirements-gathering/live/** -> COO/cto-admission/**`.
  KPI Raw-Truth Source: handoff receipts, persisted admission state, and the presence or absence of `docs/phase1/<feature-slug>/cto-admission-*` under the supplied root.
  KPI Coverage / Proof: targeted negative test for proof-on-real-root rejection, targeted positive tests for production persistence and proof persistence under isolated temp roots, and existing slice verification.
  KPI Production / Proof Partition: production continues to use the real feature root; proof must use isolated temp roots and fail closed on real checkout/worktree roots.
  Allowed mutation surfaces: `COO/cto-admission/live-handoff.ts`, `COO/controller/cli.ts`, `COO/controller/loop.ts`, `COO/requirements-gathering/live/onion-live.ts`, tightly scoped tests, and slice docs.
  Forbidden shared-surface expansion: no new generic scheduler, no new queue engine, no unrelated controller redesign, and no broad proof-runtime architecture changes.
  Docs that must be updated: `docs/phase1/coo-freeze-to-cto-admission-wiring/context.md` and `docs/phase1/coo-freeze-to-cto-admission-wiring/completion-summary.md`.
- Failure class: deterministic feature-root identity.
  Claimed supported route: `scope path -> scope-derived feature slug -> CTO admission request/state/artifacts under docs/phase1/<feature-slug>`.
  End-to-end invariant: when a scope path exists, the persisted feature root and request `feature_slug` must come from the scope slug, with topic text only as fallback.
  KPI Applicability: required.
  KPI Route / Touched Path: `COO/cto-admission/live-handoff.ts -> docs/phase1/<feature-slug>/cto-admission-* -> persisted CTO admission state`.
  KPI Raw-Truth Source: live scope path, persisted artifact paths, persisted request payload, and targeted scope/topic mismatch tests.
  KPI Coverage / Proof: targeted test for scope/topic mismatch plus existing onion live integration proof.
  KPI Production / Proof Partition: both partitions may derive the same relative feature slug, but proof remains isolated by root.
  Allowed mutation surfaces: `COO/cto-admission/live-handoff.ts`, `COO/cto-admission/live-handoff.test.ts`, `COO/requirements-gathering/live/onion-live.test.ts`, and slice docs.
  Forbidden shared-surface expansion: no broader requirement artifact schema changes and no new classifier contract.
  Docs that must be updated: `docs/phase1/coo-freeze-to-cto-admission-wiring/context.md` and `docs/phase1/coo-freeze-to-cto-admission-wiring/completion-summary.md`.

3. Sweep Scope
- Inspect all `feature_slug` and artifact-path derivation inside `COO/cto-admission/live-handoff.ts`.
- Inspect the live onion caller path that forwards `projectRoot`, `scopePath`, and `telemetryPartition`.
- Inspect the controller proof bootstrap that sets proof mode so the new guard cannot be bypassed accidentally.
- Inspect targeted tests for both live production persistence and proof-path negative isolation.

4. Planned Changes
- Add a stable feature-slug resolver that prefers the last scope-path segment and falls back to topic slugification only when no scope path exists.
- Add a proof-root isolation guard in the admission persistence route so proof partition fails closed on real ADF checkout/worktree roots instead of writing into live docs.
- Extend targeted tests to cover scope/topic mismatch and proof-on-real-root rejection while keeping existing production and isolated-proof paths passing.
- Update slice docs with the new design decisions and closeout evidence.

5. Closure Proof
- Prove route: `approved onion artifact -> handoff -> persisted request/state/summary under scope-derived docs root`.
- KPI closure state target: Closed.
- KPI proof route: targeted `live-handoff` tests for scope/topic mismatch, proof-on-real-root rejection, and existing latency/partition counters; targeted `onion-live` integration test for live freeze wiring.
- Negative proof required: proof partition on a repo-like root must not leave `docs/phase1/<feature-slug>/cto-admission-*` behind.
- Live/proof isolation checks: confirm isolated temp roots still work for proof and that repo-like roots fail closed in proof mode.
- Targeted regression checks: rerun `cto-admission/live-handoff.test.ts`, `requirements-gathering/live/onion-live.test.ts`, `controller/thread.test.ts`, and `requirements-gathering/onion-lane.test.ts`.

6. Non-Goals
- None.
