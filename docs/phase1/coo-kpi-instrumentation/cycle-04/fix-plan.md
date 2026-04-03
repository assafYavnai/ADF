1. Failure Classes

- KPI API usage was previously invisible on the read-only KPI routes.
- Canonical `handle_turn` rows previously dropped triage-grade metadata needed for production diagnosis.
- Freeze/handoff KPI truth previously under-reported finalized lifecycle outcomes relative to durable publish telemetry.
- Bottleneck KPIs previously emphasized averages while omitting percentile, slow-bucket, and KPI-quality truth.

2. Route Contracts

- Claimed supported route: `CLI -> controller -> classifier/context/onion/Brain -> raw telemetry persistence -> read-only KPI rollups`.
- End-to-end invariants:
  - raw telemetry remains append-only
  - KPI rollups remain read-only derivations
  - KPI read APIs are themselves observable
  - canonical `handle_turn` telemetry preserves triage-critical metadata
  - lifecycle rollups reconcile onion handoff truth with finalized publish truth
  - production and proof partitions remain isolated by default
- Allowed mutation surfaces:
  - `components/memory-engine/src/server.ts`
  - `components/memory-engine/src/tools/telemetry-tools.ts`
  - `COO/controller/loop.ts`
  - integration/runtime proofs and authoritative KPI docs
  - cycle-04 review-closeout artifacts
- Forbidden shared-surface expansion:
  - no new mutation routes
  - no dashboard UI
  - no second telemetry or KPI store
  - no proof seam that contaminates live production behavior
- Docs to update:
  - `docs/phase1/coo-kpi-route-contract.md`
  - `docs/phase1/onion-live-integration-report.md`
  - `docs/phase1/coo-kpi-instrumentation/context.md`
  - `docs/phase1/coo-kpi-instrumentation/completion-summary.md`
  - cycle-04 review artifacts

3. Sweep Scope

- KPI read-route dispatch and telemetry summarization in `components/memory-engine/src/server.ts`
- KPI rollup derivation and lifecycle parity logic in `components/memory-engine/src/tools/telemetry-tools.ts`
- Canonical controller turn emission paths in `COO/controller/loop.ts`
- Existing finalized publish telemetry context in `COO/requirements-gathering/live/onion-live.ts`
- Integration and runtime proof surfaces:
  - `tests/integration/telemetry-route.integration.test.ts`
  - `tests/integration/onion-route.runtime-proof.ts`
  - `tests/integration/artifacts/onion-route-proof/report.json`

4. Planned Changes

- No additional runtime code change is planned in cycle-04 unless review finds a missed route defect.
- Materialize cycle-04 audit/review/fix-plan/fix-report artifacts for the current KPI delta.
- Carry only the bounded KPI slice through staging, commit, push, and implement-plan completion.
- New shared power introduced in this delta:
  - None. The read-side KPI surface stays read-only and bounded.

5. Closure Proof

- Proved route:
  - `query_metrics|get_cost_summary|get_kpi_summary -> route telemetry`
  - `controller.handleTurn -> canonical turn telemetry`
  - `requirements_gathering_onion -> finalized publish truth -> KPI parity rollup`
- Verification evidence:
  - `npm.cmd run build` in `C:/ADF/components/memory-engine`
  - `npm.cmd run build` in `C:/ADF/COO`
  - `npx.cmd tsx --test tests/integration/telemetry-route.integration.test.ts`
  - `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts`
- Negative proof required:
  - KPI reads do not count themselves inside the same response
  - proof-only data still stays out of default production KPI rollups
  - blocked/no-scope/failure branches still fail closed while preserving lifecycle truth
- Live/proof isolation checks:
  - ordinary CLI rejection path remains proved in `tests/integration/artifacts/onion-route-proof/report.json`
  - proof-thread KPI queries still return zero in the `production` partition
- Regression checks:
  - direct-response and gate-disabled `handle_turn` assertions in `tests/integration/onion-route.runtime-proof.ts`
  - KPI self-telemetry assertions in `tests/integration/telemetry-route.integration.test.ts`

6. Non-Goals

- No dashboard or analytics UI.
- No historical backfill.
- No repo-wide telemetry redesign outside the supported COO route.
- No mutation-surface expansion beyond the current read-only KPI APIs and canonical turn telemetry.
