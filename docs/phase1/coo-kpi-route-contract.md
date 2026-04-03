# COO KPI Route Contract

Status: active implementation contract
Last updated: 2026-04-03

This Phase 1 slice implements the system-wide rule in [`../v0/kpi-instrumentation-requirement.md`](../v0/kpi-instrumentation-requirement.md).

## 1. Live Routes Covered In This Slice

This slice instruments only live COO runtime routes and the directly relevant telemetry persistence surface.

Covered live routes:

- `COO/controller/cli.ts`
  - CLI bootstrap
  - memory-engine connection
  - telemetry outbox replay
  - scripted and interactive shutdown
- `COO/controller/loop.ts`
  - turn ingress
  - thread create/resume
  - classifier selection
  - workflow execution
  - turn closeout
- `COO/controller/thread.ts`
  - thread create
  - thread load
  - thread save
- `COO/context-engineer/context-engineer.ts`
  - context assembly
  - scoped knowledge retrieval
- `COO/requirements-gathering/live/onion-live.ts`
  - onion parse
  - onion deterministic step chain
  - finalized requirement create/lock
  - reopen/supersede retirement
- `shared/llm-invoker/invoker.ts`
  - raw LLM invocation attempts
- `components/memory-engine/src/server.ts`
  - Brain tool-route telemetry for COO caller traffic
- `components/memory-engine/src/tools/telemetry-tools.ts`
  - raw telemetry query
  - read-only KPI rollup path

Not newly covered in this slice:

- dormant or non-CLI COO routes
- review-cycle runtime
- implement-plan runtime
- broader board/tool ecosystems outside the active COO path

## 2. Raw Telemetry Truth

Raw telemetry remains append-only in the existing PostgreSQL `telemetry` table.

No separate KPI write store is introduced.

The authoritative raw event classes for this slice are:

- `llm`
- `memory`
- `turn`
- `system`

Every live COO event emitted in this slice must preserve these audit keys in durable metadata when applicable:

- `telemetry_partition`
  - `production`
  - `proof`
- `runtime_entry_surface`
- `proof_mode`
- `thread_id`
- `scope_path`
- `workflow`
- `active_workflow`
- `trace_id`
- `route_stage`
- `step_name`
- `result_status`

Category-specific KPI fields that are not first-class table columns must still survive durably by being materialized into telemetry metadata before persistence.

## 3. Production vs Proof Isolation

Proof/test telemetry must never silently count as production KPI truth.

Isolation rule:

- proof-mode COO runs emit `metadata.telemetry_partition = "proof"`
- ordinary CEO-facing COO runtime emits `metadata.telemetry_partition = "production"`
- Brain tool-route telemetry called by COO inherits the same partition marker
- raw query tools may inspect both partitions
- KPI rollups default to `production` unless a caller explicitly requests another partition

## 4. Step Coverage Required

The following step families must emit durable KPI evidence:

- CLI bootstrap/shutdown
- telemetry replay/spool outcome
- turn start and end
- classifier step
- context assembly
- workflow execution
- thread create/load/save
- Brain search/mutation route calls
- onion turn summary
- onion finalized requirement persistence transitions
- raw LLM attempts

## 5. Required Rollup Path

Derived KPI summaries must be read-only and must be computed from raw telemetry.

The slice must support or report:

- average turn latency
- average classifier latency
- average LLM latency
- average Brain latency
- average persistence latency
- turns to freeze
- time to freeze
- tokens to freeze
- clarification turns per requirement
- reopen count
- pushback count
- failure rate by workflow
- fallback rate by provider/model
- outbox spool/replay count
- production-vs-proof route counts

## 6. Proof Gate

Coverage may only be claimed for a route that has concrete proof from:

- a real CLI entry path, or
- a real controller route with durable telemetry rows, or
- a generated proof artifact committed under `tests/integration/artifacts/...`

Negative proof is mandatory for:

- proof-only env injection into ordinary CLI entry
- proof telemetry exclusion from production KPI rollups
- sibling paths that must fail closed or carry different partition tags

## 7. Capability Scope Audit

This slice may add:

- richer telemetry metadata
- read-only telemetry rollup queries
- telemetry indexes that only accelerate reads on the existing append-only table

This slice must not add:

- new mutation routes
- new lifecycle control over requirements or memory
- a second raw telemetry store
- proof data that masquerades as production data

## 8. Current Proof Artifact

The current durable proof/report artifact for this contract is:

- `tests/integration/artifacts/onion-route-proof/report.json`

The current human-readable proof summary is:

- `docs/phase1/onion-live-integration-report.md`
