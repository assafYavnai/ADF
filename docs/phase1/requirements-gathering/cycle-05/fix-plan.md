1. Failure Classes

- Shared workflow-status lifecycle regression.

2. Route Contracts

- Only the live onion finalized-requirement publish route may create `pending_finalization` requirement rows and publish them back to current truth after lock succeeds.
- `archive` and `supersede` remain the only supported retirement routes that move governed artifacts out of default-reader truth and attach retirement metadata.
- Generic governance `create` surfaces must reject or ignore `workflow_status` so sibling governance families cannot create hidden or pre-retired rows.
- Generic `memory_manage update_trust_level` must not set `pending_finalization`, `archived`, `superseded`, or clear retired states back to `current`.
- Reader visibility and DB lifecycle metadata must stay aligned so non-onion callers cannot hide or republish governed artifacts through shared surfaces.

3. Sweep Scope

- `COO/controller/memory-engine-client.ts`
- `COO/requirements-gathering/live/onion-live.ts`
- `components/memory-engine/src/schemas/governance.ts`
- `components/memory-engine/src/schemas/memory-item.ts`
- `components/memory-engine/src/tools/governance-tools.ts`
- `components/memory-engine/src/tools/memory-tools.ts`
- `components/memory-engine/src/server.ts`
- `components/memory-engine/src/evidence-policy.ts`
- `components/memory-engine/src/services/search.ts`
- `components/memory-engine/src/services/context.ts`
- `tests/integration/memory-manage-route.integration.test.ts`
- `tests/integration/onion-route.runtime-proof.ts`
- `docs/phase1/onion-live-integration-report.md`

4. Planned Changes

- Narrow the shared schema and tool contracts so `workflow_status` is no longer available as a general-purpose governance create or trust-update input.
- Preserve the cycle-04 happy path by moving provisional-finalization control behind the dedicated finalized-requirement live route instead of the generic shared surfaces.
- Add server-side mutation guards so shared governance callers cannot create, retire, or republish rows via `workflow_metadata.status`.
- Keep archive/supersede as the only retirement routes and prove their metadata is only attached through those dedicated actions.
- Add negative integration coverage for sibling governance families and generic trust updates, then regenerate the live onion proof/report/docs against the narrowed contract.

5. Closure Proof

- `npm.cmd run build` from `C:/ADF/components/memory-engine`
- `npm.cmd run build` from `C:/ADF/COO`
- `npx.cmd tsx --test src/schemas/scope-requirements.test.ts` from `C:/ADF/components/memory-engine`
- `npx.cmd tsx --test tests/integration/memory-manage-route.integration.test.ts` from `C:/ADF`
- `npx.cmd tsx --test controller/thread.test.ts requirements-gathering/onion-lane.test.ts classifier/classifier.test.ts` from `C:/ADF/COO`
- `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts` from `C:/ADF`
- Durable proof updates in `C:/ADF/tests/integration/artifacts/onion-route-proof/report.json`
- DB/runtime proof that generic governance create and generic trust updates cannot set or clear governed lifecycle statuses outside the dedicated onion/archive/supersede routes

6. Non-Goals

- No onion workflow redesign.
- No controller architecture redesign.
- No broad telemetry redesign.
- No general evidence-lifecycle overhaul beyond scoping the lifecycle-status capability back to its dedicated routes.

7. Implementation Checklist (cycle-05 pass)

- Remove shared `workflow_status` inputs from generic governance create and generic `memory_manage update_trust_level` contracts.
- Add dedicated finalized-requirement create/publish paths that preserve the cycle-04 provisional-finalization behavior without reopening shared lifecycle writes.
- Keep `archive` and `supersede` as the only retirement actions that set retirement metadata and remove rows from default-reader truth.
- Add negative sibling coverage proving generic governance families ignore/reject lifecycle inputs and generic trust updates cannot hide or republish rows.
- Regenerate `tests/integration/artifacts/onion-route-proof/report.json` and `docs/phase1/onion-live-integration-report.md` against the narrowed route contract.
- Write `docs/phase1/requirements-gathering/cycle-05/fix-report.md` only after verification evidence exists.
