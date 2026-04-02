1. Failure Classes Closed

- Persisted onion workflow ownership no longer fails open after `handoff_ready` when the gate is disabled.
- Frozen-thread recovery no longer drops the approved onion meaning from the serialized thread/context surface.
- Route-proof and documentation claims no longer overstate CLI-entry coverage or successful finalized-artifact supersession closure.

2. Route Contracts Now Enforced

- A thread with persisted onion workflow state remains onion-owned for gate enforcement even when `active_workflow` is `null`.
- A frozen onion thread keeps approved-scope visibility in the thread serialization path used for later COO/context recovery.
- Proof-bearing docs now claim only the controller-entry route and explicitly describe the current blocked supersession behavior under locked-row immutability.

3. Files Changed And Why

- `COO/controller/loop.ts`
  - Gate-disabled routing now checks persisted onion ownership instead of relying only on `active_workflow`.
  - Classifier context now carries persisted onion lifecycle ownership.
- `COO/classifier/classifier.ts`
  - Classifier prompt contract now includes persisted onion ownership fields and a rule for post-handoff onion-owned turns.
- `COO/controller/thread.ts`
  - Thread serialization now exposes frozen approved-scope details even after `handoff_ready`.
- `COO/controller/thread.test.ts`
  - Added frozen-thread serialization coverage.
- `tests/integration/onion-route.runtime-proof.ts`
  - Added gate-disabled handoff proof, supersession proof, and frozen-thread serialization assertions.
- `tests/integration/artifacts/onion-route-proof/report.json`
  - Regenerated runtime proof summary.
- `tests/integration/artifacts/onion-route-proof/success-runtime/threads/fdc48dca-3668-4f25-998c-0a2587fa7412.json`
- `tests/integration/artifacts/onion-route-proof/success-runtime/threads/fdc48dca-3668-4f25-998c-0a2587fa7412.txt`
- `tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/b8f107bf-db88-4588-8be9-8758428a5f59.json`
- `tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/b8f107bf-db88-4588-8be9-8758428a5f59.txt`
- `tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/71d57a95-e09f-4c59-8551-9520d1273d55.json`
- `tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/71d57a95-e09f-4c59-8551-9520d1273d55.txt`
- `tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/56248f5e-dc42-401f-a625-b4bb4e2d606c.json`
- `tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/56248f5e-dc42-401f-a625-b4bb4e2d606c.txt`
  - Regenerated route-proof artifacts from the updated proof script.
- `docs/phase1/onion-live-integration-report.md`
  - Updated to point at the current proof artifacts and keep claims truthful.
- `docs/v0/architecture.md`
- `docs/v0/components-and-layers.md`
- `docs/v0/context/requirements-gathering-onion-model.md`
  - Updated to reflect persisted post-handoff ownership and blocked supersession truthfully.

4. Sibling Sites Checked

- `COO/context-engineer/context-engineer.ts`
  - Confirmed it consumes the improved thread serialization without needing direct changes.
- `COO/controller/cli.ts`
  - Confirmed gate/bootstrap behavior was not widened in this pass.
- `COO/requirements-gathering/live/onion-live.ts`
  - Reviewed the supersession branch and kept it unchanged because the truthful fix was proof/documentation alignment, not a speculative refactor.
- `components/memory-engine/src/server.ts`
  - Reviewed the locked-row behavior that currently blocks supersession archive mutation.

5. Proof Of Closure

- Build:
  - `npm.cmd run build` from `C:/ADF/COO`
- Unit and route-free tests:
  - `npx.cmd tsx --test controller/thread.test.ts requirements-gathering/onion-lane.test.ts classifier/classifier.test.ts` from `C:/ADF/COO`
  - Result: `16/16` passed
- Integration runtime proof:
  - `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts` from `C:/ADF`
  - Output artifact: `tests/integration/artifacts/onion-route-proof/report.json`
- Proof highlights:
  - Gate-disabled follow-up on a `handoff_ready` thread fails closed with `workflow=requirements_gathering_onion` and `gate_status=disabled`.
  - Frozen-thread serialized output keeps approved-scope context visible in `tests/integration/artifacts/onion-route-proof/success-runtime/threads/fdc48dca-3668-4f25-998c-0a2587fa7412.txt`.
  - Supersession is now evidenced as explicitly blocked with a failed `superseded_requirement_archive` receipt rather than being falsely claimed closed.

6. Remaining Debt / Non-Goals

- CLI stdin/bootstrap, shutdown replay, and telemetry spool behavior are still not proved by this controller-entry integration proof.
- Memory-engine lock-policy redesign for successful supersession archiving is still out of scope.
- No controller architecture redesign.
- No thread-store redesign.
- No shared telemetry redesign.

7. Next Cycle Starting Point

- Add a dedicated CLI-entry proof pass if the project wants to claim end-to-end CLI bootstrap coverage rather than controller-entry coverage.
- Decide whether locked finalized requirements should support a governed archive/supersession mutation path; if yes, close that persistence route in a focused follow-up cycle.
