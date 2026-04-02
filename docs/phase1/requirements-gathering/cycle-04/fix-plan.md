1. Failure Classes

- Non-atomic finalized-artifact handoff after freeze approval.

2. Route Contracts

- A finalized requirement memory id must not be published into thread workflow state, onion turn results, or CEO-facing success summaries unless both the governed create step and the governed lock step succeed.
- If the governed create step succeeds but the lock step fails or is unavailable, the provisional requirement row must be retired from current-truth readers before the turn completes, and the route must stay blocked with truthful receipts.
- A later retry after a blocked finalization attempt must leave exactly one current locked finalized requirement artifact visible to default requirement/context readers.

3. Sweep Scope

- `COO/requirements-gathering/live/onion-live.ts`
- `COO/requirements-gathering/contracts/onion-live.ts`
- `COO/controller/memory-engine-client.ts`
- `components/memory-engine/src/server.ts`
- `components/memory-engine/src/tools/governance-tools.ts`
- `components/memory-engine/src/evidence-policy.ts`
- `components/memory-engine/src/services/search.ts`
- `components/memory-engine/src/services/context.ts`
- `tests/integration/onion-route.runtime-proof.ts`
- `tests/integration/memory-manage-route.integration.test.ts`
- Materially affected live-route docs and proof reports

4. Planned Changes

- Change the live onion persistence path so a finalized requirement id is returned and published only after the lock step succeeds.
- Add a governed cleanup path for provisional finalized-requirement rows when create succeeds but lock fails or the lock route is unavailable, and capture truthful receipts for create, lock, and cleanup.
- Verify sibling reader surfaces still hide retired provisional artifacts from default `requirements_manage`, `search_memory`, and `get_context_summary` reads without widening into unrelated retrieval redesign.
- Extend runtime proof to force the create-success / lock-failure branch and prove blocked lifecycle, null published finalized id, hidden provisional row, and clean later retry behavior.
- Update authoritative docs and generated proof artifacts so the live contract matches the new finalization semantics.

5. Closure Proof

- `npm.cmd run build` in `C:\\ADF\\components\\memory-engine`
- `npm.cmd run build` in `C:\\ADF\\COO`
- `npx.cmd tsx --test src/schemas/scope-requirements.test.ts`
- `npx.cmd tsx --test tests/integration/memory-manage-route.integration.test.ts`
- `npx.cmd tsx --test controller/thread.test.ts requirements-gathering/onion-lane.test.ts classifier/classifier.test.ts`
- `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts`
- Updated durable proof artifacts under `tests/integration/artifacts/onion-route-proof/`

6. Non-Goals

- No onion workflow redesign.
- No controller architecture redesign.
- No broad memory-engine trust-model overhaul beyond the narrow finalization contract needed for this route.
- No unrelated telemetry or retrieval refactor outside the finalized-requirement visibility contract.
