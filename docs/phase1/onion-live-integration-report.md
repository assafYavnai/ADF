# Onion Live Integration Report

Saved on 2026-04-03 from [`tests/integration/artifacts/onion-route-proof/report.json`](../../tests/integration/artifacts/onion-route-proof/report.json).

## 1. Route Claim vs Route Proof

- Runtime capability now proved at two live COO seams:
  - `CLI -> controller -> classifier -> requirements_gathering_onion -> thread workflowState.onion -> governed requirement persistence -> COO response -> telemetry`
  - `controller.handleTurn -> classifier -> context-engineer -> direct COO response -> telemetry`
- The ordinary production CLI rejects proof-only parser-update injection unless explicit `--test-proof-mode` is enabled.
- KPI rollup proof now exists through the read-only `get_kpi_summary` route, sourced from raw telemetry rather than a parallel summary store.
- Direct COO response proof now covers:
  - successful scoped Brain retrieval
  - failed Brain-search latency retention on the context-assembly and canonical turn rows
  - no-attempt `missing_scope` and `brain_search_unavailable` branches that stay truthfully zero for Brain latency
  - controller write-path Brain telemetry attribution on a live `memory_capture` call
- Gate controls remain: `ADF_ENABLE_REQUIREMENTS_GATHERING_ONION`, `--enable-onion`, `--disable-onion`.

## 2. Contracts Now Proved

- Production CLI bootstrap cannot be silently diverted by `ADF_COO_TEST_PARSER_UPDATES_FILE`; the ordinary entry rejects that env var and exits before any thread work or telemetry write starts.
- Guarded CLI proof mode covers memory-engine connect, telemetry replay, bootstrap, thread resume lookup, scripted turn execution, and clean shutdown, all tagged into the `proof` telemetry partition.
- Direct COO response proof covers classifier telemetry, context assembly telemetry, positive Brain search telemetry, failed Brain-search latency retention, no-attempt zero-latency branches, LLM invocation telemetry, persistence telemetry, and KPI rollup derivation.
- Controller-triggered Brain telemetry on the proved COO route now carries frozen `route_stage` / `step_name` attribution, including `context_engineer/load_knowledge` for Brain reads and `memory_operation/capture_memory` for controller write calls.
- Onion success proof covers classifier telemetry, onion turn telemetry, finalized requirement create/lock telemetry, frozen-scope handoff truth, and KPI rollups for turns-to-freeze/time-to-freeze/tokens-to-freeze.
- Lock-failure cleanup proof still shows blocked finalization truth: provisional create succeeds, publish fails closed, provisional row retires, and downstream readers stay on truthful current state.
- Gate-disabled follow-up proof still shows persisted onion ownership blocking resume when the feature gate is off.
- Supersession proof still shows explicit retirement of the prior locked finalized artifact before replacement publication.
- No-scope proof still shows freeze approval without fake durable handoff; finalization remains blocked and explicit.

## 3. Key Runtime Evidence

- Full proof report: [`tests/integration/artifacts/onion-route-proof/report.json`](../../tests/integration/artifacts/onion-route-proof/report.json)
- Production CLI rejection stderr: [`tests/integration/artifacts/onion-route-proof/cli-production-isolation/cli-stderr.txt`](../../tests/integration/artifacts/onion-route-proof/cli-production-isolation/cli-stderr.txt)
- Guarded proof-mode CLI stdout: [`tests/integration/artifacts/onion-route-proof/cli-runtime/cli-stdout.txt`](../../tests/integration/artifacts/onion-route-proof/cli-runtime/cli-stdout.txt)
- Direct COO response runtime artifacts: [`tests/integration/artifacts/onion-route-proof/direct-response-runtime`](../../tests/integration/artifacts/onion-route-proof/direct-response-runtime)
- Onion success runtime artifacts: [`tests/integration/artifacts/onion-route-proof/success-runtime`](../../tests/integration/artifacts/onion-route-proof/success-runtime)
- Lock-failure cleanup runtime artifacts: [`tests/integration/artifacts/onion-route-proof/lock-failure-runtime`](../../tests/integration/artifacts/onion-route-proof/lock-failure-runtime)
- Gate-disabled runtime artifacts: [`tests/integration/artifacts/onion-route-proof/gate-disabled-runtime`](../../tests/integration/artifacts/onion-route-proof/gate-disabled-runtime)
- Supersession runtime artifacts: [`tests/integration/artifacts/onion-route-proof/supersession-runtime`](../../tests/integration/artifacts/onion-route-proof/supersession-runtime)
- No-scope fail-closed runtime artifacts: [`tests/integration/artifacts/onion-route-proof/no-scope-runtime`](../../tests/integration/artifacts/onion-route-proof/no-scope-runtime)

## 4. Telemetry Summary From The Current Report

- Production CLI isolation branch: exit code `1`, `0` thread files, `0` telemetry rows written.
- Guarded CLI proof branch: `2` successful `handle_turn` rows plus durable `memory_engine_connect`, `telemetry_replay`, `cli_bootstrap`, `thread_resume_lookup`, and `cli_shutdown` system events, all in the `proof` partition.
- Direct COO response branch:
  - `classifier_step` records provider/model/tokens/cost with `selected_workflow=direct_coo_response`
  - successful `context_assemble` records positive `knowledge_latency_ms`, and successful `search_memory` route telemetry now carries `route_stage=context_engineer` and `step_name=load_knowledge`
  - failed Brain-search proof records `context_assemble.success=false`, preserves positive `knowledge_latency_ms`, and keeps canonical `handle_turn.metadata.context_ms` non-zero instead of erasing the attempted lookup cost
  - `missing_scope` and `brain_search_unavailable` branches keep `knowledge_latency_ms=0` and emit no `search_memory` rows because no Brain lookup was attempted
  - controller `capture_memory` proof records `route_stage=memory_operation` and `step_name=capture_memory` while keeping the `proof` telemetry partition and thread/scope ownership intact
  - `get_kpi_summary` reports non-zero proof-only context latency for both successful and failed-search direct-response threads, while the failed-search branch keeps `brain_latency_ms=0` because no Brain row was persisted
- Onion success branch:
  - `8` classifier rows
  - `8` `onion_turn` rows
  - successful `requirements_manage create_finalized_candidate`
  - successful `memory_manage:publish_finalized_requirement`
  - non-zero rollups for turns/time/tokens-to-freeze
- Gate-disabled branch: `handle_turn.success=false`, `metadata.workflow=requirements_gathering_onion`, `metadata.gate_status=disabled`.
- Direct proof-thread KPI summary returns proof-only turn, Brain, LLM, context, and persistence latency for the proof thread, while the same thread queried in the `production` partition returns `0` turns.

## 5. Verification Commands

- `npm.cmd run build` (from `C:/ADF/COO`) passed.
- `npx.cmd tsx --test COO/context-engineer/context-engineer.test.ts tests/integration/telemetry-route.integration.test.ts` (from `C:/ADF`) passed `4/4`.
- `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts` (from `C:/ADF`) passed and regenerated proof artifacts.

## 6. Narrow Boundary Still Intentional

- The deterministic CLI bootstrap proof remains explicit test-only behavior behind `--test-proof-mode`; the ordinary CEO-facing CLI path stays on the live invoker route.
- Raw KPI truth remains append-only in PostgreSQL telemetry; `get_kpi_summary` is read-only derivation, not a replacement write path.
- Proof telemetry is intentionally partitioned from production telemetry and must stay explicitly requested in rollup queries.
- The governed finalized-requirement lifecycle remains intentionally narrow: only COO-owned onion finalized requirement artifacts use `create_finalized_candidate`, `publish_finalized_requirement`, and the supersession retirement route.
