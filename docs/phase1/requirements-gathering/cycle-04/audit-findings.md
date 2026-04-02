1. Findings

1. failure class: non-atomic finalized-artifact handoff

broken route invariant in one sentence: a finalized requirement id must not be published as current onion truth unless the governed create and lock steps both succeed, and a blocked persistence branch must not leave current-looking durable artifacts behind.

exact route: CEO freeze approval -> `requirements_gathering_onion.persistOnionArtifacts` creates a requirement row through `requirements_manage create` with default `trust_level='working'` -> `memory_manage update_trust_level` fails or is unavailable -> onion thread state and `onion_turn_result` still store `finalized_requirement_memory_id` -> serialized thread state, requirements readers, and turn telemetry can present a blocked handoff as if a finalized artifact exists.

exact file/line references: [onion-live.ts#L200](/C:/ADF/COO/requirements-gathering/live/onion-live.ts#L200), [onion-live.ts#L210](/C:/ADF/COO/requirements-gathering/live/onion-live.ts#L210), [onion-live.ts#L241](/C:/ADF/COO/requirements-gathering/live/onion-live.ts#L241), [onion-live.ts#L508](/C:/ADF/COO/requirements-gathering/live/onion-live.ts#L508), [onion-live.ts#L559](/C:/ADF/COO/requirements-gathering/live/onion-live.ts#L559), [onion-live.ts#L577](/C:/ADF/COO/requirements-gathering/live/onion-live.ts#L577), [onion-live.ts#L603](/C:/ADF/COO/requirements-gathering/live/onion-live.ts#L603), [governance-tools.ts#L74](/C:/ADF/components/memory-engine/src/tools/governance-tools.ts#L74), [governance-tools.ts#L83](/C:/ADF/components/memory-engine/src/tools/governance-tools.ts#L83), [governance-tools.ts#L40](/C:/ADF/components/memory-engine/src/tools/governance-tools.ts#L40), [evidence-policy.ts#L16](/C:/ADF/components/memory-engine/src/evidence-policy.ts#L16), [search.ts#L202](/C:/ADF/components/memory-engine/src/services/search.ts#L202), [context.ts#L55](/C:/ADF/components/memory-engine/src/services/context.ts#L55), [thread.ts#L325](/C:/ADF/COO/controller/thread.ts#L325), [thread.ts#L367](/C:/ADF/COO/controller/thread.ts#L367), [loop.ts#L321](/C:/ADF/COO/controller/loop.ts#L321), [loop.ts#L327](/C:/ADF/COO/controller/loop.ts#L327).

concrete operational impact: a transient or scoped lock failure can leave a blocked thread carrying `finalized_requirement_memory_id` for a row that is only `working`, while default requirement/context readers still treat that row as current evidence; by inference from the current control flow, a later retry can create an additional finalized-requirement row without retiring the first provisional one.

sweep scope: every governed create-then-mutate route that publishes durable ids before the final trust/state mutation succeeds, especially retry paths after blocked onion finalization, any consumer that treats `finalized_requirement_memory_id` as authoritative without verifying lock state, and all default requirement/context readers that currently exclude only `archived`/`superseded` workflow states.

closure proof: add an integration/runtime proof that forces `requirements_manage create` to succeed and `update_trust_level` to fail, then verify `lifecycle_status=blocked`, `finalized_requirement_memory_id=null` in thread state and `onion_turn_result`, no provisional row appears in default `requirements_manage`, `search_memory`, or `get_context_summary` current-truth reads, and telemetry makes the blocked durable-handoff failure explicit; add a retry proof showing a later successful freeze leaves exactly one current locked finalized requirement row in the DB.

status: live defect

2. Conceptual Root Cause

1. missing atomic publish contract for finalized requirements

the system split finalized handoff into `create requirement` and `lock requirement` steps, but it did not enforce the route-level invariant that publication of finalized identity, reader visibility, and success-shaped telemetry must wait until the lock step succeeds. As a result, the route can fail in the middle and still expose provisional state as if it were finalized truth.

3. High-Level View Of System Routes That Still Need Work

1. explicit freeze approval -> governed requirement create -> governed lock -> thread publication -> current-truth reader visibility -> telemetry

why endpoint-only fixes will fail: clearing the thread pointer alone still leaves a current-looking provisional row in memory, while hiding the row in readers alone still leaves the thread and `onion_turn_result` claiming a finalized artifact id; fixing only telemetry would still leave the DB and recovery surfaces inconsistent.

the minimal layers that must change to close the route: the onion live persistence contract, the governed requirement create/lock or cleanup semantics in the memory-engine path, the thread/onion result publication rules, and the proof/telemetry checks for blocked lock-failure branches.

explicit non-goals, so scope does not widen into general refactoring: no onion workflow redesign, no broad memory-engine trust-model overhaul, no unrelated CLI/bootstrap changes, and no general rewrite of retrieval services beyond what is needed to keep provisional finalized artifacts out of current truth.

what done looks like operationally: a finalized requirement id is published only when the DB row is locked, a lock failure leaves no current finalized artifact visible in thread state or default readers, blocked durable handoff is obvious in telemetry, and a later retry results in exactly one current locked finalized requirement artifact.
