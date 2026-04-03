1. Failure Classes Closed

- Failed Brain-search latency is no longer zeroed on the `controller.handleTurn -> context-engineer -> Brain search -> telemetry` path.
- Controller-triggered Brain telemetry on the live COO route now carries a frozen `route_stage` / `step_name` vocabulary for the audited read and write paths.

2. Route Contracts Now Enforced

- If the direct COO response path attempts a Brain lookup and that lookup fails, the attempted lookup duration now survives into raw telemetry as both `context_assemble.metadata.knowledge_latency_ms` and canonical `handle_turn.metadata.context_ms` instead of collapsing to zero.
- If the direct COO response path never attempts a Brain lookup because scope is missing or the search client is unavailable, Brain latency truthfully remains zero and no `search_memory` row is emitted.
- Controller-triggered Brain rows now keep `thread_id`, `scope_path`, `workflow`, `route_stage`, and `step_name` on the proved read path (`context_engineer/load_knowledge`) and controller write path (`memory_operation/capture_memory`) without changing proof/production partition semantics.
- KPI summaries remain read-only derivations from raw telemetry. This cycle tightened metadata truth and proof coverage without adding a second telemetry store or a proof-only controller fork.

3. Files Changed And Why

- `docs/phase1/coo-kpi-instrumentation/cycle-01/fix-plan.md`
  - Froze the contract, sweep scope, proof requirements, and non-goals before code changes.
- `COO/context-engineer/context-engineer.ts`
  - Preserved attempted Brain-search duration on the failure path and added frozen `route_stage=context_engineer` / `step_name=load_knowledge` metadata for the controller-triggered Brain read.
- `COO/controller/loop.ts`
  - Carried measured context-assembly latency into canonical `handle_turn` telemetry and froze controller Brain telemetry attribution for capture, log-decision, rule-create, search, and context-load callers.
- `COO/context-engineer/context-engineer.test.ts`
  - Updated the scoped-search regression expectation to include the new frozen telemetry vocabulary.
- `tests/integration/onion-route.runtime-proof.ts`
  - Extended the route proof to cover:
    - successful direct-response Brain attribution
    - failed-search latency retention
    - legitimate zero-latency no-attempt branches
    - controller write-path Brain attribution
- `tests/integration/artifacts/onion-route-proof/report.json`
  - Regenerated the durable proof artifact with the new direct-response subproof branches.
- `docs/phase1/onion-live-integration-report.md`
  - Updated the human-readable proof summary so it matches the widened direct-response proof coverage.
- `docs/phase1/coo-kpi-instrumentation/cycle-01/fix-report.md`
  - Recorded the verified closure evidence for this cycle.

4. Sibling Sites Checked

- `COO/context-engineer/context-engineer.ts`
  - Checked the attempted-search failure branch, `missing_scope`, and `brain_search_unavailable` branches so only attempted calls retain nonzero Brain latency.
- `COO/controller/loop.ts`
  - Checked every `buildBrainTelemetryContext(...)` caller in the memory-operation lane: `capture`, `log_decision`, `make_rule`, `memory_search`, and `context_load`.
- `tests/integration/telemetry-route.integration.test.ts`
  - Checked the generic memory-engine telemetry route surface; no code changes were required because caller-provided telemetry metadata was already forwarded correctly.
- `tests/integration/onion-route.runtime-proof.ts`
  - Checked direct-response, controller Brain-write, and existing proof/production partition paths so the new metadata contract did not drift into an endpoint-only patch.
- `tests/integration/artifacts/onion-route-proof/report.json`
  - Checked that the success, failed-search, no-attempt, and controller write-path branches all landed in the durable proof artifact together.

5. Proof Of Closure

- Build:
  - `npm.cmd run build` from `C:/ADF/COO`
  - `npm.cmd run build` from `C:/ADF/components/memory-engine`
- Targeted tests:
  - `npx.cmd tsx --test C:\ADF\shared\telemetry\collector.test.ts C:\ADF\shared\llm-invoker\invoker.test.ts C:\ADF\COO\classifier\classifier.test.ts C:\ADF\COO\context-engineer\context-engineer.test.ts C:\ADF\COO\controller\thread.test.ts C:\ADF\COO\requirements-gathering\onion-lane.test.ts C:\ADF\tests\integration\telemetry-route.integration.test.ts`
  - Result: `27/27` passed
- Runtime proof:
  - `npx.cmd tsx C:\ADF\tests\integration\onion-route.runtime-proof.ts`
  - Output artifact: `tests/integration/artifacts/onion-route-proof/report.json`
- Proof highlights from the regenerated report:
- direct-response success proof records `search_memory.metadata.route_stage = "context_engineer"` and `step_name = "load_knowledge"`, with canonical `handle_turn.metadata.context_ms` staying non-zero for the assembled context path
- direct-response failed-search proof records `context_assemble.success = false`, preserves positive `knowledge_latency_ms`, and keeps canonical `handle_turn.metadata.context_ms` non-zero instead of erasing the attempted lookup cost
  - direct-response `missing_scope` and `brain_search_unavailable` proofs keep `knowledge_latency_ms = 0` and emit no `search_memory` rows because no lookup was attempted
  - controller write-path proof records `capture_memory.metadata.route_stage = "memory_operation"` and `step_name = "capture_memory"` while keeping the `proof` partition and scoped thread ownership
  - production-vs-proof isolation remains intact; the success-thread production KPI summary still reports zero turns for the proof thread

6. Remaining Debt / Non-Goals

- No review-cycle runtime redesign.
- No implement-plan runtime redesign.
- No telemetry schema redesign or second telemetry store.
- No broader controller or memory-engine refactor beyond the audited route closure.

7. Next Cycle Starting Point

- If a later review disputes the direct COO response route, start from `tests/integration/artifacts/onion-route-proof/report.json`, especially:
  - `direct_response.success`
  - `direct_response.failed_search`
  - `direct_response.missing_scope`
  - `direct_response.brain_search_unavailable`
  - `direct_response.controller_memory_capture`
- This cycle stops at route closure and proof regeneration. No new review cycle is started in this invocation.
