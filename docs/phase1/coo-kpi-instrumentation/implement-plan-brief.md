1. Implementation Objective

Upgrade the supported COO KPI route so production triage can trust both the raw telemetry and the read-only KPI rollups. The implementation must add telemetry for KPI API usage itself, repair the current production KPI truth gaps, and expose bottleneck-oriented rollups that make real operational choke points visible.

2. Exact Slice Scope

- Instrument KPI read routes in the memory engine:
  - `query_metrics`
  - `get_cost_summary`
  - `get_kpi_summary`
- Repair production metadata propagation on the supported COO route, especially for:
  - `handle_turn`
  - requirements-gathering lifecycle/finalization
  - any KPI-read telemetry context needed for trustworthy triage
- Expand read-only KPI rollups to surface:
  - latency percentiles
  - slow-bucket counts
  - workflow/stage failure concentration
  - KPI API usage counts and latency
  - metadata completeness
  - raw-vs-rollup parity on critical lifecycle outcomes
  - uncosted/fallback model usage
- Update only the tests, proof artifacts, and KPI contract/report docs required to keep the claimed route truthful.

3. Inputs / Authorities Read

- [README.md](/C:/ADF/docs/phase1/coo-kpi-instrumentation/README.md)
- [context.md](/C:/ADF/docs/phase1/coo-kpi-instrumentation/context.md)
- [implement-plan-contract.md](/C:/ADF/docs/phase1/coo-kpi-instrumentation/implement-plan-contract.md)
- [coo-kpi-route-contract.md](/C:/ADF/docs/phase1/coo-kpi-route-contract.md)
- [onion-live-integration-report.md](/C:/ADF/docs/phase1/onion-live-integration-report.md)
- [kpi-instrumentation-requirement.md](/C:/ADF/docs/v0/kpi-instrumentation-requirement.md)
- [architecture.md](/C:/ADF/docs/v0/architecture.md)
- [2026-04-03-live-kpi-summary-lesson.md](/C:/ADF/docs/v0/context/2026-04-03-live-kpi-summary-lesson.md)
- [server.ts](/C:/ADF/components/memory-engine/src/server.ts)
- [telemetry-tools.ts](/C:/ADF/components/memory-engine/src/tools/telemetry-tools.ts)
- latest review-cycle artifacts already present under [coo-kpi-instrumentation](/C:/ADF/docs/phase1/coo-kpi-instrumentation)

4. Required Deliverables

- Durable KPI API usage telemetry for `query_metrics`, `get_cost_summary`, and `get_kpi_summary`.
- Production `handle_turn` telemetry that always carries triage-grade route metadata and typed failure detail.
- Requirements-gathering lifecycle KPI truth that reconciles freeze/handoff reporting with the real durable production finalization route.
- Read-only KPI rollups for bottleneck diagnosis, including percentile latency, slow-bucket counts, KPI-quality metrics, and KPI API usage metrics.
- Updated proof/tests/docs showing:
  - no recursive KPI-read telemetry loop
  - no production/proof contamination
  - truthful route closure for the claimed KPI slice

5. Forbidden Edits

- Do not add a second KPI or telemetry truth store.
- Do not build dashboards or reporting UI in this slice.
- Do not redesign unrelated ADF runtimes or broaden into repo-wide observability work.
- Do not weaken append-only telemetry, provenance truth, or production/proof isolation.
- Do not widen scope beyond the supported COO route and its read-only KPI APIs.

6. Integrity-Verified Assumptions Only

- The current KPI read APIs exist, but they are not currently counted as KPI usage telemetry.
- The current live production KPI dataset contains a freeze/finalization parity gap that makes at least one headline KPI non-authoritative.
- Current production `handle_turn` rows are missing triage-critical metadata such as `trace_id` and `route_stage`.
- Current production latency pain is dominated by long-tail outliers, so percentile and slow-bucket visibility is more important than average-only reporting.
- Raw telemetry must remain append-only and KPI rollups must remain read-only derivations.
- This prepared feature stream is configured to hand off to `review-cycle` after machine verification.

7. Explicit Non-Goals

- No dashboard UI or warehouse layer.
- No historical backfill initiative beyond the current route and proof artifacts.
- No unrelated review-cycle or implement-plan redesign.
- No generic observability expansion for tool ecosystems outside the supported COO route.

8. Proof / Verification Expectations

- Machine Verification Plan:
  - run `npm.cmd run build` from `C:/ADF/components/memory-engine`
  - run `npm.cmd run build` from `C:/ADF/COO`
  - run targeted unit/integration tests for modified telemetry, rollup, and COO route files
  - run route-proof/runtime-proof coverage when the claimed KPI route or lifecycle proof changes
  - prove KPI API usage telemetry is durable and non-recursive
  - prove production/proof isolation and raw-vs-rollup parity on critical lifecycle outcomes
- Human Verification Plan:
  - Required: false
  - reason: this is an internal telemetry and proof slice rather than a separate human-facing product route
- Review-Cycle Expectation:
  - after machine verification passes, hand this feature stream to `review-cycle`
  - do not close the feature as complete until the review handoff closes cleanly

9. Required Artifact Updates

- [implement-plan-contract.md](/C:/ADF/docs/phase1/coo-kpi-instrumentation/implement-plan-contract.md)
- [implement-plan-brief.md](/C:/ADF/docs/phase1/coo-kpi-instrumentation/implement-plan-brief.md)
- [implement-plan-state.json](/C:/ADF/docs/phase1/coo-kpi-instrumentation/implement-plan-state.json)
- [context.md](/C:/ADF/docs/phase1/coo-kpi-instrumentation/context.md)
- route contract/proof docs under [docs/phase1](/C:/ADF/docs/phase1)
- affected integration/runtime proof artifacts under [tests/integration](/C:/ADF/tests/integration)

10. Closeout Rules

- Keep the implementation bounded to KPI truth, KPI API usage telemetry, and bottleneck rollups for the supported COO route.
- Run machine verification before any review handoff.
- Hand the slice to `review-cycle` after machine verification because this prepared stream has `post_send_to_review=true`.
- Human testing is not required for this slice unless the implementation later widens into a human-facing route change; if that happens, update the contract first instead of assuming `Required: false` still holds.
- Do not mark the feature complete until code, docs, proof artifacts, and feature artifacts are updated and the governed closeout path succeeds.
