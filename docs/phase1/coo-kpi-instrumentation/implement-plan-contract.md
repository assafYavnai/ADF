1. Implementation Objective

Upgrade the COO KPI instrumentation slice so production triage can rely on raw telemetry and read-only KPI rollups to identify bottlenecks truthfully. Extend the supported KPI surface to include telemetry about KPI API usage itself, repair the current production KPI truth gaps, and make bottleneck-focused diagnostic KPIs durable for the supported COO runtime.

2. Slice Scope

- Extend the supported COO KPI route from `CLI -> controller -> classifier/context/onion/Brain -> raw telemetry persistence -> read-only KPI rollups` to also include telemetry about KPI API reads through:
  - `query_metrics`
  - `get_cost_summary`
  - `get_kpi_summary`
- Close production telemetry gaps on the supported route so triage-critical metadata is durably present on live production events, especially for:
  - `handle_turn`
  - requirements-gathering lifecycle/finalization
  - KPI read routes
- Expand read-only KPI rollups so they expose bottleneck-oriented operational truth rather than mainly averages, including:
  - tail latency
  - slow-bucket counts
  - workflow/stage failure concentration
  - metadata completeness
  - KPI raw-vs-rollup parity
  - KPI API usage volume and latency
  - uncosted/fallback model usage
- Keep the slice bounded to the current supported COO production route and its read-only KPI surfaces. Do not widen into unrelated ecosystems, dashboards, or a new warehouse.

3. Required Deliverables

- Durable telemetry for KPI API usage that records, at minimum, call count, latency, success/failure, requested partition, caller provenance mode, and enough query-shape metadata to support triage without leaking unsafe payload volume.
- Production `handle_turn` telemetry improvements so successful and failed turn rows carry triage-grade metadata:
  - `workflow`
  - `trace_id`
  - `route_stage`
  - `result_status`
  - failure typing and error detail on failures
- Requirements-gathering lifecycle KPI truth that reconciles freeze/handoff reporting with the actual durable production lifecycle/finalization route.
- Read-only KPI rollup coverage for bottleneck tracking, including at minimum:
  - `p50`, `p95`, `p99` latency for core routes
  - counts for slow turns over `1s`, `10s`, and `60s`
  - top failing workflows and route stages
  - `unknown` workflow counts
  - KPI API usage counts and latency
  - metadata completeness KPIs
  - raw-vs-rollup parity or reconciliation counts for critical lifecycle outcomes
  - uncosted LLM call count and fallback cost/usage truth
- Updated route contract, proof/report docs, and integration/runtime proof artifacts for the supported KPI route.

4. Allowed Edits

- [server.ts](/C:/ADF/components/memory-engine/src/server.ts)
- [telemetry-tools.ts](/C:/ADF/components/memory-engine/src/tools/telemetry-tools.ts)
- [loop.ts](/C:/ADF/COO/controller/loop.ts)
- [cli.ts](/C:/ADF/COO/controller/cli.ts)
- [memory-engine-client.ts](/C:/ADF/COO/controller/memory-engine-client.ts)
- relevant telemetry helper files under [shared/telemetry](/C:/ADF/shared/telemetry)
- [onion-live.ts](/C:/ADF/COO/requirements-gathering/live/onion-live.ts)
- related COO/controller/context files only where required to preserve truthful metadata propagation on the supported route
- telemetry indexes or migrations only if required to keep read-side KPI queries production-viable
- tests and proof artifacts under [tests/integration](/C:/ADF/tests/integration)
- KPI contract/proof docs under [docs/phase1](/C:/ADF/docs/phase1)
- feature-stream artifacts under [coo-kpi-instrumentation](/C:/ADF/docs/phase1/coo-kpi-instrumentation)

5. Forbidden Edits

- Do not introduce a second telemetry or KPI truth store.
- Do not widen the slice into dashboard UI, BI/reporting frontends, or a generic analytics platform.
- Do not redesign `review-cycle`, `implement-plan`, or unrelated ADF runtimes.
- Do not let proof/test telemetry contaminate production KPI truth.
- Do not weaken append-only telemetry, provenance truth, or production/proof partition enforcement.
- Do not broaden scope into unrelated tool ecosystems outside the supported COO production route.

6. Acceptance Gates

1. KPI API usage is durably instrumented for `query_metrics`, `get_cost_summary`, and `get_kpi_summary`, and the implementation proves that KPI reads are counted without creating recursive self-instrumentation loops or polluting production-vs-proof truth.
2. Production `handle_turn` rows on the supported route now persist `workflow`, `trace_id`, `route_stage`, and `result_status`; failed production turns also persist typed failure metadata that is sufficient for triage.
3. Requirements-gathering lifecycle KPI truth no longer under-reports freeze/handoff outcomes relative to the actual durable production finalization route; either compatible lifecycle events are emitted or the rollup is corrected to use the real durable events.
4. Read-only KPI rollups expose tail-latency and bottleneck-focused outputs for the supported route, including percentile latency and slow-bucket counts.
5. Read-only KPI rollups expose KPI-quality outputs for triage reliability, including metadata completeness, `unknown` workflow counts, raw-vs-rollup parity for critical lifecycle outcomes, and uncosted/fallback model usage.
6. Production-only KPI queries remain isolated from proof/test data by default, and proof/test telemetry remains queryable without silently affecting production KPI truth.
7. The updated route contract and proof artifacts truthfully match the supported route being claimed.

Machine Verification Plan
- Run `npm.cmd run build` from `C:/ADF/components/memory-engine`.
- Run `npm.cmd run build` from `C:/ADF/COO`.
- Run targeted unit/integration tests for modified telemetry and COO route files, including:
  - telemetry route tests
  - KPI rollup tests
  - requirements-gathering lifecycle proof where modified
  - any new tests that prove KPI API usage telemetry and raw-vs-rollup parity
- Run the supported runtime proof or equivalent integration proof for the KPI route if the route contract or lifecycle proof surfaces change.
- Verify that the live-proof dataset distinguishes production and proof partitions and that KPI API telemetry does not recurse indefinitely.

Human Verification Plan
- Required: false
- Reason: this slice upgrades internal telemetry truth, KPI rollups, and proof/report artifacts for the supported COO route. It should close through machine verification and route proof rather than a separate human-facing product test.

7. Observability / Audit

- KPI truth must be auditable from raw telemetry rather than inferred from secondary summaries.
- KPI API access must itself become observable so leadership can distinguish missing KPI data from missing KPI usage.
- The slice must make bottleneck locations obvious by workflow, stage, latency percentile, and slow-bucket concentration.
- The slice must make KPI reliability obvious by surfacing metadata completeness, parity/reconciliation health, partition isolation, and fallback/uncosted-call counts.
- Updated proof/report artifacts must explicitly state what is authoritative for:
  - KPI API usage telemetry
  - lifecycle completion truth
  - production/proof separation
  - bottleneck rollup semantics

8. Dependencies / Constraints

- Preserve the system-wide rule in [kpi-instrumentation-requirement.md](/C:/ADF/docs/v0/kpi-instrumentation-requirement.md) that raw telemetry remains append-only and rollups remain read-only derivations.
- Preserve the supported route contract in [coo-kpi-route-contract.md](/C:/ADF/docs/phase1/coo-kpi-route-contract.md) unless the contract itself is explicitly updated as part of this slice.
- Keep KPI API telemetry bounded and low-risk; instrument the read surfaces without serializing or duplicating large result payloads into telemetry.
- Respect existing production/proof partition markers and default production-only rollups.
- Prefer truthful bottleneck metrics over decorative metric expansion; if a metric cannot be derived reliably from current raw truth, either repair the raw truth or do not claim the metric as authoritative.

9. Non-Goals

- No dashboard product or UI build.
- No historical backfill project beyond what the current production telemetry already supports.
- No repo-wide bottleneck program for unrelated tool ecosystems outside the supported COO route.
- No general telemetry redesign unrelated to triage-grade KPI truth on the supported route.
- No warehouse, materialized analytics layer, or external reporting pipeline.

10. Source Authorities

- [README.md](/C:/ADF/docs/phase1/coo-kpi-instrumentation/README.md)
- [context.md](/C:/ADF/docs/phase1/coo-kpi-instrumentation/context.md)
- [coo-kpi-route-contract.md](/C:/ADF/docs/phase1/coo-kpi-route-contract.md)
- [onion-live-integration-report.md](/C:/ADF/docs/phase1/onion-live-integration-report.md)
- [kpi-instrumentation-requirement.md](/C:/ADF/docs/v0/kpi-instrumentation-requirement.md)
- [architecture.md](/C:/ADF/docs/v0/architecture.md)
- [2026-04-03-live-kpi-summary-lesson.md](/C:/ADF/docs/v0/context/2026-04-03-live-kpi-summary-lesson.md)
- [server.ts](/C:/ADF/components/memory-engine/src/server.ts)
- [telemetry-tools.ts](/C:/ADF/components/memory-engine/src/tools/telemetry-tools.ts)
- current proof artifacts under [tests/integration/artifacts/onion-route-proof](/C:/ADF/tests/integration/artifacts/onion-route-proof)
