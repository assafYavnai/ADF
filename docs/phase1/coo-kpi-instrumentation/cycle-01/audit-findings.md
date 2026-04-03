1. Findings
1. **Route-stage latency blind spot on context retrieval failure**
   - failure class: route-stage latency blind spot
   - broken route invariant in one sentence: the live COO route must persist the actual elapsed time for a failed Brain lookup, and the canonical turn summary must not erase that work by publishing zero context latency.
   - exact route (A -> B -> C): `controller.handleTurn -> context-engineer -> brainSearch -> telemetry`
   - exact file/line references: [COO/context-engineer/context-engineer.ts:258](C:/ADF/COO/context-engineer/context-engineer.ts#L258), [COO/context-engineer/context-engineer.ts:261](C:/ADF/COO/context-engineer/context-engineer.ts#L261), [COO/controller/loop.ts:479](C:/ADF/COO/controller/loop.ts#L479), [COO/controller/loop.ts:794](C:/ADF/COO/controller/loop.ts#L794)
   - concrete operational impact: a failed or degraded direct-response turn can look instantaneous in durable KPI rows, so latency regressions, flaky Brain calls, and slow fallback behavior are hidden from rollups and incident review.
   - sweep scope: all `loadKnowledge` error branches, `handleCooResponse` turn emission, and any sibling path that reuses `assembleContext` or records `context_assemble` telemetry.
   - closure proof: a simulated Brain-search failure must persist nonzero elapsed knowledge latency in raw telemetry, and the derived KPI query must surface that failure duration instead of zero; the handle-turn summary must not discard the measured context step.
   - shared-surface expansion risk: none
   - negative proof required: prove the `missing_scope` and `brain_search_unavailable` branches still stay legitimately zero only because no remote lookup was attempted, not because the failure path defaulted to zero.
   - live/proof isolation risk: none
   - claimed-route vs proved-route mismatch risk: present and why: the current proof material exercises the successful proof-mode Brain path, but it does not prove that failed Brain lookups retain their real elapsed time.
   - status: live defect
2. **Controller-triggered Brain telemetry lacks route-stage / step attribution**
   - failure class: audit attribution gap
   - broken route invariant in one sentence: Brain searches and mutations triggered by the live COO controller must carry a frozen route-stage vocabulary so the same `search_memory` or `capture_memory` operation can still be traced back to the controller step that issued it.
   - exact route (A -> B -> C): `controller.handleTurn -> brainSearch / brainCapture / brainLogDecision / brainManageMemory -> memory-engine telemetry`
   - exact file/line references: [COO/controller/loop.ts:565](C:/ADF/COO/controller/loop.ts#L565), [COO/controller/loop.ts:634](C:/ADF/COO/controller/loop.ts#L634), [COO/controller/loop.ts:700](C:/ADF/COO/controller/loop.ts#L700), [COO/controller/loop.ts:740](C:/ADF/COO/controller/loop.ts#L740), [COO/controller/loop.ts:1108](C:/ADF/COO/controller/loop.ts#L1108), [COO/context-engineer/context-engineer.ts:221](C:/ADF/COO/context-engineer/context-engineer.ts#L221)
   - concrete operational impact: same-tool operations from different COO stages collapse into the same memory bucket, so KPI queries and audit reviews cannot cleanly separate controller subroutes or prove which step produced a row.
   - sweep scope: every `buildBrainTelemetryContext` caller, the direct `brainSearch` telemetry context in `context-engineer`, and any future controller path that injects `telemetry_context` into the memory-engine client.
   - closure proof: persisted telemetry rows for live controller Brain calls must include `route_stage` and `step_name` where applicable, and query/rollup tests must prove that stage-separated calls remain distinguishable without changing the production/proof partition markers.
   - shared-surface expansion risk: none
   - negative proof required: prove the onion live route and the controller direct-response route both keep their partition markers intact while adding stage attribution, and prove sibling memory operations do not lose their existing thread/scope joins.
   - live/proof isolation risk: none
   - claimed-route vs proved-route mismatch risk: present and why: the proof artifact validates partitioning and thread joins, but it does not demonstrate live controller Brain rows carrying route-stage or step-name attribution.
   - status: live defect

2. Conceptual Root Cause
- The KPI slice split its truth across summary rows and step rows, but the failure-path measurement contract was not frozen tightly enough: the context-engineer failure branch zeroes elapsed Brain latency, and the controller summary row still publishes a zero context duration instead of propagating the measured step.
- Brain telemetry context was built ad hoc per caller instead of through one frozen route-stage vocabulary, so the onion path, direct-response path, and controller Brain operations do not all emit the same attribution keys.
- The proof harness focused on success-path partitioning and raw rollups, not on failure-path latency retention or controller-step attribution, so those gaps stayed open even though the success proof looked complete.

3. High-Level View Of System Routes That Still Need Work
1. `controller.handleTurn -> context-engineer -> Brain search -> durable telemetry`
   - what must be frozen before implementation: whether the canonical KPI record is allowed to hide failed Brain latency, or whether failure-duration truth must be first-class in the raw rows.
   - why endpoint-only fixes will fail: changing only the KPI query still leaves the raw telemetry wrong, so historical rows and incident evidence stay misleading.
   - the minimal layers that must change to close the route: `COO/context-engineer/context-engineer.ts`, `COO/controller/loop.ts`, the KPI rollup query, and the targeted route test.
   - explicit non-goals, so scope does not widen into general refactoring: no new telemetry table, no warehouse, no review-cycle/runtime redesign.
   - what done looks like operationally: failed and successful Brain lookups both persist truthful elapsed time, and the KPI summary reproduces that time from raw telemetry.
2. `controller.handleTurn -> controller Brain calls -> memory-engine telemetry`
   - what must be frozen before implementation: a shared route-stage / step-name vocabulary for controller-triggered Brain reads and writes.
   - why endpoint-only fixes will fail: query-side labels cannot reconstruct attribution that was never persisted on the row.
   - the minimal layers that must change to close the route: `COO/controller/loop.ts`, `COO/context-engineer/context-engineer.ts`, memory-engine telemetry persistence/query surfaces, and the route-level integration proof.
   - explicit non-goals, so scope does not widen into general refactoring: no new business mutation routes, no second raw telemetry store, no proof-only fork of the live controller path.
   - what done looks like operationally: the same memory operation issued from different controller steps remains separable in both production and proof partitions without changing the live route shape.
