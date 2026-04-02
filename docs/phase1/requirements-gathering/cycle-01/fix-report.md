1. Contracts now enforced

- Persisted onion workflow ownership now fails closed under a disabled gate even when `active_workflow` is already `null` after `handoff_ready`.
- Frozen onion thread recovery now keeps approved onion meaning visible in serialized thread/context surfaces.
- Route-proof and architecture/docs claims are now aligned to what is actually exercised: controller-entry proof is claimed as proof; CLI bootstrap is no longer overstated.
- Reopen supersession is now explicitly evidenced as blocked under locked-row immutability instead of being implicitly claimed closed.

2. Files changed and why

- `COO/controller/loop.ts`
  - Gate-disabled guard now checks persisted onion ownership, not only `active_workflow`.
  - Classifier prompt inputs now carry persisted onion ownership + lifecycle context.
  - Workflow routing summary now includes persisted frozen-scope context for classifier continuity.
- `COO/classifier/classifier.ts`
  - Prompt contract now includes persisted onion ownership fields and routing rule for post-handoff onion-owned threads.
- `COO/controller/thread.ts`
  - Workflow-state serialization now emits frozen-scope/approved-snapshot context even after handoff (`active_workflow=null`).
- `COO/controller/thread.test.ts`
  - Added frozen-thread serialization coverage and updated active-workflow serialization assertion text.
- `tests/integration/onion-route.runtime-proof.ts`
  - Added handoff-ready gate-disabled proof path.
  - Added supersession proof path and made report route naming truthful (`live_route_under_proof`).
  - Added frozen-thread serialization assertions in success proof.
- `tests/integration/artifacts/onion-route-proof/report.json`
  - Regenerated proof artifact with success/gate-disabled/supersession/no-scope evidence.
- `tests/integration/artifacts/onion-route-proof/success-runtime/threads/fdc48dca-3668-4f25-998c-0a2587fa7412.json`
- `tests/integration/artifacts/onion-route-proof/success-runtime/threads/fdc48dca-3668-4f25-998c-0a2587fa7412.txt`
- `tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/b8f107bf-db88-4588-8be9-8758428a5f59.json`
- `tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/b8f107bf-db88-4588-8be9-8758428a5f59.txt`
- `tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/71d57a95-e09f-4c59-8551-9520d1273d55.json`
- `tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/71d57a95-e09f-4c59-8551-9520d1273d55.txt`
- `tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/56248f5e-dc42-401f-a625-b4bb4e2d606c.json`
- `tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/56248f5e-dc42-401f-a625-b4bb4e2d606c.txt`
  - Regenerated route-proof runtime artifacts from the updated integration script.
- `docs/phase1/onion-live-integration-report.md`
  - Rewritten to reflect true proof boundaries and updated runtime evidence.
- `docs/v0/architecture.md`
  - Clarified capability route vs proved route and documented reopen/archive blocked behavior.
- `docs/v0/components-and-layers.md`
  - Updated requirements-gathering lane description for frozen-context persistence + fail-closed reopen supersession behavior.
- `docs/v0/context/requirements-gathering-onion-model.md`
  - Added live-route notes about persisted ownership gating and current supersession-blocked behavior.
- `docs/phase1/requirements-gathering/cycle-01/fix-plan.md`
  - Updated pre-implementation execution checklist for this pass.

3. Sibling sites checked

- `COO/context-engineer/context-engineer.ts` (thread serialization is consumed as-is; no code change required).
- `COO/controller/cli.ts` (gate/bootstrap behavior retained; route proof wording corrected in docs instead of overstating CLI-proof entry).
- `COO/requirements-gathering/live/onion-live.ts` (supersession persistence branch reviewed; no behavioral refactor in this pass).
- `components/memory-engine/src/server.ts` and lock trigger behavior reviewed to explain supersession failure evidence.

4. Proof of closure

- Unit tests:
  - `npx.cmd tsx --test controller/thread.test.ts requirements-gathering/onion-lane.test.ts classifier/classifier.test.ts` (from `C:/ADF/COO`) passed `16/16`.
- Build:
  - `npm.cmd run build` (from `C:/ADF/COO`) passed.
- Integration runtime proof:
  - `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts` (from `C:/ADF`) passed and regenerated `tests/integration/artifacts/onion-route-proof/report.json`.
  - `gate_disabled` evidence now uses a `handoff_ready` frozen thread and confirms fail-closed telemetry tagging (`workflow=requirements_gathering_onion`, `gate_status=disabled`).
  - `success` evidence confirms frozen-thread serialization carries persisted approved-scope context.
  - `supersession` evidence confirms reopened frozen scope records explicit archive failure due locked-row immutability and keeps lifecycle blocked instead of silently claiming closure.

5. Non-goals intentionally left untouched

- No controller architecture redesign.
- No thread-store format redesign.
- No shared telemetry redesign.
- No CLI bootstrap proof expansion to scripted stdin/shutdown replay in this cycle.
- No memory-engine lock-policy redesign in this cycle (supersession remains explicitly blocked and documented).
