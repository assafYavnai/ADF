# Onion Live Integration Report

Saved on 2026-04-02 from [`tests/integration/artifacts/onion-route-proof/report.json`](../../tests/integration/artifacts/onion-route-proof/report.json).

## 1. Route Claim vs Route Proof

- Runtime capability remains: `CLI -> controller -> classifier -> requirements_gathering_onion -> thread workflowState.onion -> governed requirement persistence -> COO response -> telemetry`.
- The proof script does **not** enter through the CLI bootstrap. Its proved route is: `controller.handleTurn -> classifier -> requirements_gathering_onion -> thread/persistence -> response -> telemetry`.
- Gate controls remain: `ADF_ENABLE_REQUIREMENTS_GATHERING_ONION`, `--enable-onion`, `--disable-onion`.

## 2. Contracts Now Proved

- Persisted onion ownership is gate-enforced even after `handoff_ready` (`active_workflow=null`): gate-disabled follow-up turns are blocked fail-closed with `workflow=requirements_gathering_onion`.
- Frozen-thread recovery keeps approved onion meaning visible in thread serialization (`workflow owner`, freeze status, approved snapshot identity, and scope lines).
- Finalized requirement create/lock and no-scope fail-closed behavior remain proved.
- Reopen supersession behavior is now truthfully proved as **blocked** under current memory-engine lock immutability (no false claim of successful archive).

## 3. Key Runtime Evidence

- Success thread: [`tests/integration/artifacts/onion-route-proof/success-runtime/threads/fdc48dca-3668-4f25-998c-0a2587fa7412.json`](../../tests/integration/artifacts/onion-route-proof/success-runtime/threads/fdc48dca-3668-4f25-998c-0a2587fa7412.json)
- Success serialized context (frozen scope still visible): [`tests/integration/artifacts/onion-route-proof/success-runtime/threads/fdc48dca-3668-4f25-998c-0a2587fa7412.txt`](../../tests/integration/artifacts/onion-route-proof/success-runtime/threads/fdc48dca-3668-4f25-998c-0a2587fa7412.txt)
- Gate-disabled handoff thread: [`tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/b8f107bf-db88-4588-8be9-8758428a5f59.json`](../../tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/b8f107bf-db88-4588-8be9-8758428a5f59.json)
- Supersession attempt thread: [`tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/71d57a95-e09f-4c59-8551-9520d1273d55.json`](../../tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/71d57a95-e09f-4c59-8551-9520d1273d55.json)
- No-scope fail-closed thread: [`tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/56248f5e-dc42-401f-a625-b4bb4e2d606c.json`](../../tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/56248f5e-dc42-401f-a625-b4bb4e2d606c.json)

## 4. Telemetry Summary From Report

- Success branch: `16` LLM telemetry rows, `48` onion operation rows, `8` `handle_turn` rows.
- Gate-disabled branch: `handle_turn.success=false`, `metadata.workflow=requirements_gathering_onion`, `metadata.gate_status=disabled`.
- Supersession branch: reopen attempt persists a failed `superseded_requirement_archive` receipt because locked memory rows cannot be modified by the current archive route.

## 5. Verification Commands

- `npx.cmd tsx --test controller/thread.test.ts requirements-gathering/onion-lane.test.ts classifier/classifier.test.ts` (from `C:/ADF/COO`) passed `16/16`.
- `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts` (from `C:/ADF`) passed and regenerated proof artifacts.

## 6. Known Route Boundary (Not Claimed Closed)

- CLI stdin/bootstrap, telemetry replay, and shutdown spool behavior are runtime capabilities but are not covered by this controller-entry integration proof.
- Reopened finalized-artifact supersession is not closed as successful archive yet; current behavior is explicit blocked handoff with a failure receipt due locked-row immutability.
