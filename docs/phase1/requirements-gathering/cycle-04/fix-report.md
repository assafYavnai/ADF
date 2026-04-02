1. Failure Classes Closed

- Non-atomic finalized-artifact handoff after freeze approval.

2. Route Contracts Now Enforced

- The live onion route publishes `finalized_requirement_memory_id` only after the governed create step and governed lock step both succeed.
- Finalized requirement rows are created as `workflow_status=pending_finalization`, so default requirement/context readers do not surface them as current truth before the lock step succeeds.
- If the lock step fails, the route stays `blocked`, keeps `finalized_requirement_memory_id=null` in thread workflow state and `onion_turn_result`, and retires the provisional row through governed archive cleanup with truthful receipts.
- If cleanup cannot complete, the provisional row still remains hidden from default readers because `pending_finalization` is excluded from current workflow truth.
- A later retry after the blocked branch results in exactly one current locked finalized requirement artifact visible to default readers.

3. Files Changed And Why

- `COO/controller/loop.ts`
  - Extended the governed requirement and memory-manage controller contracts to carry workflow-status options needed for truthful provisional finalization.
- `COO/controller/memory-engine-client.ts`
  - Forwarded `workflow_status` through the requirements and memory-manage MCP routes.
- `COO/controller/cli.ts`
  - Forwarded the new governed requirement-create option on the live runtime bootstrap path.
- `COO/requirements-gathering/contracts/onion-live.ts`
  - Added `provisional_finalized_requirement_retire` to the typed persistence-receipt contract.
- `COO/requirements-gathering/live/onion-live.ts`
  - Changed finalization so create stays provisional until lock succeeds, publish happens only after lock, no-manage routes fail before create, and lock failures trigger truthful provisional retirement receipts.
- `components/memory-engine/src/schemas/memory-item.ts`
- `components/memory-engine/src/schemas/governance.ts`
- `components/memory-engine/src/tools/memory-tools.ts`
- `components/memory-engine/src/tools/governance-tools.ts`
- `components/memory-engine/src/server.ts`
- `components/memory-engine/src/evidence-policy.ts`
  - Added the narrow memory-engine contract for `workflow_status`, excluded `pending_finalization` from current-truth readers, and allowed `update_trust_level` to publish the row as current only when the live route explicitly promotes it.
- `tests/integration/memory-manage-route.integration.test.ts`
  - Added reader-hiding coverage for provisional finalized requirements and kept supersession coverage aligned with the new publish contract.
- `tests/integration/onion-route.runtime-proof.ts`
  - Added the lock-failure cleanup branch and strengthened live proof for blocked handoff, null published id, hidden provisional row, and clean retry behavior.
- `tests/integration/artifacts/onion-route-proof/report.json`
- `tests/integration/artifacts/onion-route-proof/lock-failure-runtime/`
- `tests/integration/artifacts/onion-route-proof/cli-runtime/`
- `tests/integration/artifacts/onion-route-proof/success-runtime/`
- `tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/`
- `tests/integration/artifacts/onion-route-proof/supersession-runtime/`
- `tests/integration/artifacts/onion-route-proof/no-scope-runtime/`
  - Regenerated durable proof artifacts from the updated runtime proof.
- `docs/phase1/onion-live-integration-report.md`
  - Updated the authoritative live integration report to describe the provisional-finalization contract and the new lock-failure cleanup proof.
- `docs/phase1/requirements-gathering/cycle-04/fix-plan.md`
  - Captured the route-level implementation plan before the code changes.

4. Sibling Sites Checked

- `COO/controller/cli.ts`
- `COO/controller/loop.ts`
- `COO/controller/memory-engine-client.ts`
- `COO/requirements-gathering/contracts/onion-live.ts`
- `COO/requirements-gathering/live/onion-live.ts`
- `components/memory-engine/src/tools/governance-tools.ts`
- `components/memory-engine/src/server.ts`
- `components/memory-engine/src/evidence-policy.ts`
- `components/memory-engine/src/services/search.ts`
- `components/memory-engine/src/services/context.ts`
- `tests/integration/memory-manage-route.integration.test.ts`
- `tests/integration/onion-route.runtime-proof.ts`

5. Proof Of Closure

- `npm.cmd run build` from `C:/ADF/components/memory-engine`
- `npm.cmd run build` from `C:/ADF/COO`
- `npx.cmd tsx --test src/schemas/scope-requirements.test.ts` from `C:/ADF/components/memory-engine`
- `npx.cmd tsx --test tests/integration/memory-manage-route.integration.test.ts` from `C:/ADF`
- `npx.cmd tsx --test controller/thread.test.ts requirements-gathering/onion-lane.test.ts classifier/classifier.test.ts` from `C:/ADF/COO`
- `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts` from `C:/ADF`
- Durable proof report: `C:/ADF/tests/integration/artifacts/onion-route-proof/report.json`
- Lock-failure runtime proof thread: `C:/ADF/tests/integration/artifacts/onion-route-proof/lock-failure-runtime/threads/69d709f6-79da-457e-a33d-25f6e6f60395.json`

6. Remaining Debt / Non-Goals

- No onion workflow redesign.
- No controller architecture redesign.
- No broad memory-engine trust-model overhaul outside the provisional-finalization contract needed for this route.
- No new downstream CTO / implementation-lane consumption in this cycle.

7. Next Cycle Starting Point

- Carry forward the cycle-04 reviewer approval and rerun only the auditor lane, because cycle-04 closed the auditor’s rejected failure class and preserved the already-approved reviewer surface.
- Start from `C:/ADF/docs/phase1/requirements-gathering/cycle-04/fix-report.md` and `C:/ADF/tests/integration/artifacts/onion-route-proof/report.json`.
