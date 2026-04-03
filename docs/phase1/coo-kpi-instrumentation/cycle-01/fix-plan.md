1. Failure Classes

- Failed Brain-search latency is zeroed on the `controller.handleTurn -> context-engineer -> Brain search -> telemetry` path.
- Controller-triggered Brain telemetry lacks a frozen `route_stage` / `step_name` vocabulary on the live COO route.

2. Route Contracts

- If the supported COO runtime attempts a Brain lookup during `controller.handleTurn -> context-engineer -> direct COO response`, the actual elapsed lookup time must survive into raw telemetry even when the lookup fails, and the canonical `handle_turn` row must not erase that measured context work by publishing `context_ms = 0`.
- If the live COO controller triggers Brain reads or writes, the emitted raw telemetry rows must preserve `thread_id`, `scope_path`, `workflow`, `route_stage`, and `step_name` so the originating controller subroute remains auditable without changing proof/production partition truth.
- No-attempt branches such as missing scope or unavailable Brain search must remain truthfully zero-latency because no remote lookup was attempted, not because attempted failure latency was defaulted away.
- KPI summaries must remain read-only derivations from raw telemetry. This cycle may tighten metadata truth and route proof, but it must not add a second telemetry store or a proof-only fork of the production controller path.

3. Sweep Scope

- [`COO/context-engineer/context-engineer.ts`](../../../COO/context-engineer/context-engineer.ts)
- [`COO/controller/loop.ts`](../../../COO/controller/loop.ts)
- [`tests/integration/telemetry-route.integration.test.ts`](../../../tests/integration/telemetry-route.integration.test.ts)
- [`tests/integration/onion-route.runtime-proof.ts`](../../../tests/integration/onion-route.runtime-proof.ts)
- [`docs/phase1/coo-kpi-route-contract.md`](../../coo-kpi-route-contract.md)
- [`docs/phase1/onion-live-integration-report.md`](../../onion-live-integration-report.md)
- [`tests/integration/artifacts/onion-route-proof/report.json`](../../../tests/integration/artifacts/onion-route-proof/report.json)

4. Planned Changes

- Measure Brain-search latency across the full attempted call in `context-engineer` and preserve that elapsed time on the failure branch instead of zeroing it.
- Propagate measured context-assembly latency back to the canonical `handle_turn` telemetry row for direct COO response turns so the turn summary does not erase a failed Brain lookup's cost.
- Freeze a shared controller Brain telemetry vocabulary by emitting explicit `route_stage` and `step_name` metadata on controller-triggered Brain reads and writes, including the context-engineer Brain lookup path.
- Extend route-level proof to cover failed Brain-search latency retention, no-attempt zero-latency branches, and controller Brain-route attribution without widening into a broader telemetry redesign.
- Update authoritative proof/report docs only if the committed proof coverage description changes materially after verification.

5. Closure Proof

- `npm.cmd run build` in `C:\ADF\COO`.
- Targeted automated verification for the live COO route showing that a simulated Brain-search failure persists nonzero `knowledge_latency_ms` and nonzero canonical turn `context_ms`.
- Negative proof that the `missing_scope` and `brain_search_unavailable` branches still remain zero only because no Brain search was attempted.
- Route-level proof that controller-triggered Brain rows persist `route_stage` and `step_name` while keeping `thread_id`, `scope_path`, `workflow`, and `telemetry_partition`.
- Regenerated durable proof artifact in [`tests/integration/artifacts/onion-route-proof/report.json`](../../../tests/integration/artifacts/onion-route-proof/report.json) and final cycle report only after verification passes.

6. Non-Goals

- No review-cycle runtime redesign.
- No implement-plan runtime redesign.
- No materialized KPI warehouse or second telemetry store.
- No broad controller or memory-engine refactor beyond the minimum metadata and latency-truth closure for this route.

7. Implementation Checklist (cycle-01 pass)

- Update the `context-engineer` Brain-search failure branch to retain attempted lookup latency.
- Update the direct COO response path in [`COO/controller/loop.ts`](../../../COO/controller/loop.ts) so the canonical `handle_turn` row records measured context latency.
- Freeze controller Brain telemetry metadata through explicit `route_stage` / `step_name` values on the context-engineer route and each `buildBrainTelemetryContext(...)` caller.
- Extend the runtime proof with:
  - failed Brain-search latency retention
  - legitimate zero-latency no-attempt branches
  - controller Brain-route attribution on read and write paths
  - proof/production partition preservation after the metadata expansion
- Touch route docs only if the proof summary materially changes.
- Write [`fix-report.md`](./fix-report.md) only after build and proof verification succeed.
