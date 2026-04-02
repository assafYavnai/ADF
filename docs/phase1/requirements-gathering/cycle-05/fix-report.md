1. Failure Classes Closed

- Shared workflow-status lifecycle regression.

2. Route Contracts Now Enforced

- Only the dedicated requirement-only route `requirements_manage create_finalized_candidate` can create a provisional `pending_finalization` finalized requirement row.
- Only the dedicated route `memory_manage publish_finalized_requirement` can publish that provisional finalized requirement back to current truth after the onion freeze handoff succeeds.
- Generic governance `create` no longer accepts `workflow_status` as a shared lifecycle control input, so sibling governance families cannot create hidden or pre-retired rows through shared surfaces.
- Generic `memory_manage update_trust_level` no longer accepts `workflow_status`, so it cannot hide current rows, republish retired rows, or clear governed lifecycle metadata back to `current`.
- `archive` and `supersede` remain the only retirement routes that move governed artifacts out of default-reader truth and attach retirement metadata.
- Default readers continue to exclude provisional and retired workflow states, so DB truth and reader truth stay aligned with the dedicated lifecycle routes.

3. Files Changed And Why

- `COO/controller/loop.ts`
  - Replaced the shared workflow-status forwarding seam with dedicated finalized-requirement lifecycle controller hooks.
- `COO/controller/cli.ts`
  - Wired the dedicated finalized requirement create/publish controller hooks into the live runtime bootstrap.
- `COO/controller/memory-engine-client.ts`
  - Removed shared workflow-status forwarding from generic requirement create and generic memory-manage update-trust paths, and added dedicated finalized-requirement candidate/publish helpers.
- `COO/requirements-gathering/live/onion-live.ts`
  - Switched the live onion handoff path to the dedicated finalized-requirement candidate and publish routes while preserving provisional archive cleanup on publish failure.
- `components/memory-engine/src/schemas/governance.ts`
  - Narrowed governance actions so only `requirements_manage` can use `create_finalized_candidate`.
- `components/memory-engine/src/schemas/memory-item.ts`
  - Added `publish_finalized_requirement` as a dedicated memory-manage action and removed shared workflow-status mutation input from generic memory-manage parsing.
- `components/memory-engine/src/tools/governance-tools.ts`
  - Removed shared workflow-status input from generic governance create and added the dedicated provisional-finalization route with strict requirement-only guards.
- `components/memory-engine/src/tools/memory-tools.ts`
  - Updated the tool contract so generic memory-manage no longer advertises shared workflow-status control and instead exposes the dedicated publish action.
- `components/memory-engine/src/server.ts`
  - Removed generic workflow-status mutation from `update_trust_level` and added the guarded `publish_finalized_requirement` mutation path that only publishes COO-owned onion finalized requirements from `pending_finalization`.
- `components/memory-engine/src/schemas/scope-requirements.test.ts`
  - Added parser-contract coverage proving the dedicated finalized-requirement lifecycle actions stay on requirement-only routes.
- `tests/integration/memory-manage-route.integration.test.ts`
  - Added negative integration coverage for sibling governance create and generic trust-update lifecycle misuse, and fixed locked-row cleanup so the suite exits truthfully.
- `tests/integration/onion-route.runtime-proof.ts`
  - Updated the lock-failure proof harness to the dedicated publish route and regenerated the live proof artifacts.
- `tests/integration/artifacts/onion-route-proof/report.json`
- `tests/integration/artifacts/onion-route-proof/cli-runtime/`
- `tests/integration/artifacts/onion-route-proof/success-runtime/`
- `tests/integration/artifacts/onion-route-proof/lock-failure-runtime/`
- `tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/`
- `tests/integration/artifacts/onion-route-proof/supersession-runtime/`
- `tests/integration/artifacts/onion-route-proof/no-scope-runtime/`
  - Regenerated durable runtime proof after the narrowed lifecycle contract.
- `docs/phase1/onion-live-integration-report.md`
  - Updated the authoritative live-route report so it now describes the dedicated finalized lifecycle routes, the negative governance coverage, and the regenerated proof artifacts.
- `docs/phase1/requirements-gathering/cycle-05/fix-plan.md`
  - Captured the route-level fix plan before code and verification changes.

4. Sibling Sites Checked

- `COO/controller/cli.ts`
- `COO/controller/loop.ts`
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
- `components/memory-engine/src/schemas/scope-requirements.test.ts`
- `tests/integration/memory-manage-route.integration.test.ts`
- `tests/integration/onion-route.runtime-proof.ts`
- `docs/phase1/onion-live-integration-report.md`

5. Proof Of Closure

- `npm.cmd run build` from `C:/ADF/components/memory-engine`
- `npm.cmd run build` from `C:/ADF/COO`
- `npx.cmd tsx --test src/schemas/scope-requirements.test.ts` from `C:/ADF/components/memory-engine`
- `npx.cmd tsx --test tests/integration/memory-manage-route.integration.test.ts` from `C:/ADF`
- `npx.cmd tsx --test controller/thread.test.ts requirements-gathering/onion-lane.test.ts classifier/classifier.test.ts` from `C:/ADF/COO`
- `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts` from `C:/ADF`
- Durable runtime proof report: `C:/ADF/tests/integration/artifacts/onion-route-proof/report.json`
- Authoritative live-route report updated from regenerated proof: `C:/ADF/docs/phase1/onion-live-integration-report.md`

6. Remaining Debt / Non-Goals

- No onion workflow redesign.
- No controller architecture redesign.
- No broad telemetry redesign.
- No evidence-lifecycle overhaul beyond scoping provisional finalization back to dedicated finalized-requirement routes.

7. Next Cycle Starting Point

- Carry forward the reviewer approval again and rerun only the auditor lane, because cycle-05 closed the reported failure class but has not yet been re-audited.
- Start the next cycle from `C:/ADF/docs/phase1/requirements-gathering/cycle-05/fix-report.md`, `C:/ADF/tests/integration/artifacts/onion-route-proof/report.json`, and `C:/ADF/docs/phase1/onion-live-integration-report.md`.
