# Context

## Stream

- Phase: `1`
- Feature slug: `coo-kpi-instrumentation`
- Branch: `main`
- Active cycle: completed (cycle-04 approved)

## Normalized Route Contract

- Claimed supported route: `CLI -> controller -> classifier/context/onion/Brain -> raw telemetry persistence -> read-only KPI rollups`
- Failure classes to close in this stream:
  - missing or partial durable KPI truth on the supported COO route
  - route-stage latency/token/cost blind spots that prevent audit and rollup accuracy
  - production/proof contamination risk in KPI truth
  - claimed-route vs proved-route mismatch in KPI closure claims
- End-to-end invariants:
  - raw telemetry stays append-only
  - proof/test telemetry is partitioned from production telemetry
  - step-level latency and token/cost truth survives durable persistence
  - Brain interactions are attributable to the COO route where the route already carries thread/trace context
  - rollups are read-only derivations from raw telemetry, not a second truth store
- Allowed mutation surfaces:
  - telemetry metadata/default propagation
  - raw telemetry emission at live COO route stages
  - read-only KPI query/rollup logic
  - docs and proof artifacts
- Forbidden shared-surface expansion:
  - no new business mutation routes
  - no second raw telemetry store
  - no proof seam that silently affects the ordinary production CLI path
- Docs in scope:
  - `docs/phase1/coo-kpi-route-contract.md`
  - `docs/phase1/onion-live-integration-report.md`
  - `docs/phase1/README.md`
  - `docs/v0/architecture.md`
  - `docs/v0/kpi-instrumentation-requirement.md`
- Non-goals:
  - review-cycle runtime redesign
  - implement-plan runtime redesign
  - materialized KPI warehouse beyond raw telemetry plus read-only rollups

## Current Implementation State

- The KPI slice is already implemented in the working tree under:
  - `COO/controller/cli.ts`
  - `COO/controller/loop.ts`
  - `COO/controller/thread.ts`
  - `COO/controller/memory-engine-client.ts`
  - `COO/context-engineer/context-engineer.ts`
  - `COO/requirements-gathering/live/onion-live.ts`
  - `shared/telemetry/collector.ts`
  - `shared/telemetry/metadata.ts`
  - `shared/llm-invoker/invoker.ts`
  - `shared/llm-invoker/types.ts`
  - `components/memory-engine/src/server.ts`
  - `components/memory-engine/src/tools/telemetry-tools.ts`
  - `components/memory-engine/src/schemas/memory-item.ts`
  - `components/memory-engine/src/db/migrations/016_telemetry_kpi_indexes.sql`
- The stream should treat those files as evidence, not as the full route scope.

## Proof Pack Already Present

- Route contract: `docs/phase1/coo-kpi-route-contract.md`
- Human-readable proof summary: `docs/phase1/onion-live-integration-report.md`
- Durable proof artifact: `tests/integration/artifacts/onion-route-proof/report.json`
- Production CLI isolation stderr proof:
  - `tests/integration/artifacts/onion-route-proof/cli-production-isolation/cli-stderr.txt`
- Real CLI proof stdout:
  - `tests/integration/artifacts/onion-route-proof/cli-runtime/cli-stdout.txt`

## Verification Already Run

- `npm.cmd run build` from `C:/ADF/components/memory-engine`
- `npm.cmd run build` from `C:/ADF/COO`
- `npx.cmd tsx --test shared/telemetry/collector.test.ts shared/llm-invoker/invoker.test.ts COO/classifier/classifier.test.ts COO/context-engineer/context-engineer.test.ts COO/controller/thread.test.ts COO/requirements-gathering/onion-lane.test.ts tests/integration/telemetry-route.integration.test.ts`
- `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts`

## Review Focus

- Determine whether the claimed supported route is fully closed rather than only instrumented at cited endpoints.
- Check sibling paths for the same KPI truth contract:
  - startup/shutdown
  - turn ingress/failure paths
  - classifier/context/LLM
  - Brain read/write operations
  - onion persistence/recovery transitions
  - outbox replay and recovery telemetry
- Reject closure if:
  - proof depends on a stronger or different route than the claimed supported runtime
  - production/proof isolation is not actually enforced
  - raw truth was replaced by summary truth
  - thread/trace ownership for Brain metrics is lost on claimed covered routes

## Environment Note

- The ADF bootstrap requires Brain context load at startup, but no `project-brain` MCP tools were exposed in this Codex runtime. This cycle therefore uses checked local code, docs, proof artifacts, and helper state as its grounded input set.

## 2026-04-03 Live Production KPI Gaps

- The production KPI read tools currently expose KPI rollups, but KPI API usage itself is not durably counted because `query_metrics`, `get_cost_summary`, and `get_kpi_summary` are excluded from generic tool-route telemetry.
- The current live production KPI rollup reports `frozen_trace_count = 0`, while the same production dataset shows successful finalization activity such as `freeze_check` and `memory_manage:publish_finalized_requirement`; freeze/handoff KPI truth is therefore not yet authoritative.
- Production `handle_turn` telemetry currently lacks triage-critical metadata on live rows:
  - `trace_id`
  - `route_stage`
  - `result_status`
  - typed error metadata on failures
- Production latency is dominated by a small long-tail of very slow turns rather than broad slowdown, so triage-grade KPIs need percentile and slow-bucket reporting, not only averages.
- Fallback activity is visible, but fallback cost truth is incomplete because some fallback model calls carry tokens without `estimated_cost_usd`.
- The implementation-planning slice for this stream should focus on production-grade KPI truth, KPI-on-KPI API usage telemetry, metadata completeness KPIs, and bottleneck-oriented rollups for the supported COO route.

## 2026-04-03 Implement-Plan Execution Notes

- KPI read routes now flow through normal tool-route telemetry, so `query_metrics`, `get_cost_summary`, and `get_kpi_summary` are durably counted with bounded request metadata and no recursive self-counting in the current response.
- `handle_turn` telemetry now emits triage-grade metadata on both success and failure paths:
  - `workflow`
  - `trace_id`
  - `route_stage`
  - `result_status`
  - typed failure fields on blocked/failed turns
- `get_kpi_summary` now reports:
  - turn latency percentiles and slow buckets
  - route-stage breakdown
  - KPI API usage
  - handle-turn metadata completeness
  - lifecycle parity between onion handoff and finalized publish truth
  - uncosted/fallback LLM quality signals
- Machine verification for this slice passed:
  - `npm.cmd run build` in `components/memory-engine`
  - `npm.cmd run build` in `COO`
  - `npx.cmd tsx --test tests/integration/telemetry-route.integration.test.ts`
  - `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts`
