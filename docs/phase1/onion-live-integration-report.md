# Onion Live Integration Report

Saved on 2026-04-02 from [`tests/integration/artifacts/onion-route-proof/report.json`](../../tests/integration/artifacts/onion-route-proof/report.json).

## 1. Route Claim vs Route Proof

- Runtime capability remains: `CLI -> controller -> classifier -> requirements_gathering_onion -> thread workflowState.onion -> governed requirement persistence -> COO response -> telemetry`.
- The proof script now enters through the real CLI bootstrap in scripted mode and also records the controller-detail route inside the generated report.
- Gate controls remain: `ADF_ENABLE_REQUIREMENTS_GATHERING_ONION`, `--enable-onion`, `--disable-onion`.

## 2. Contracts Now Proved

- CLI bootstrap proof covers arg-over-env gate resolution, scripted stdin routing, telemetry outbox replay, durable thread output, and clean shutdown.
- Persisted onion ownership is gate-enforced even after `handoff_ready` (`active_workflow=null`): gate-disabled follow-up turns are blocked fail-closed with `workflow=requirements_gathering_onion`.
- Frozen-thread recovery keeps approved onion meaning visible in thread serialization (`workflow owner`, freeze status, approved snapshot identity, and scope lines).
- Finalized requirement create/lock and no-scope fail-closed behavior remain proved.
- Reopen supersession now succeeds through an explicit governed `memory_manage supersede` path, and default readers no longer treat the retired locked artifact as current truth.

## 3. Key Runtime Evidence

- CLI-entry stdout: [`tests/integration/artifacts/onion-route-proof/cli-runtime/cli-stdout.txt`](../../tests/integration/artifacts/onion-route-proof/cli-runtime/cli-stdout.txt)
- CLI-entry thread: [`tests/integration/artifacts/onion-route-proof/cli-runtime/threads/e7e2e92a-10b6-43f5-b4b0-d049dc47bc78.json`](../../tests/integration/artifacts/onion-route-proof/cli-runtime/threads/e7e2e92a-10b6-43f5-b4b0-d049dc47bc78.json)
- Success thread: [`tests/integration/artifacts/onion-route-proof/success-runtime/threads/0550eff3-be49-4576-a72b-626251883067.json`](../../tests/integration/artifacts/onion-route-proof/success-runtime/threads/0550eff3-be49-4576-a72b-626251883067.json)
- Success serialized context (frozen scope still visible): [`tests/integration/artifacts/onion-route-proof/success-runtime/threads/0550eff3-be49-4576-a72b-626251883067.txt`](../../tests/integration/artifacts/onion-route-proof/success-runtime/threads/0550eff3-be49-4576-a72b-626251883067.txt)
- Gate-disabled handoff thread: [`tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/6d4134b1-2d90-4e43-be1a-93749cb3bb77.json`](../../tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/6d4134b1-2d90-4e43-be1a-93749cb3bb77.json)
- Supersession thread: [`tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/0f154aba-4db4-4eed-a2b5-c1601e48ffa4.json`](../../tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/0f154aba-4db4-4eed-a2b5-c1601e48ffa4.json)
- No-scope fail-closed thread: [`tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/ec85f21b-6217-41f6-a6ad-122ebdfea385.json`](../../tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/ec85f21b-6217-41f6-a6ad-122ebdfea385.json)

## 4. Telemetry Summary From Report

- CLI-entry branch: `2` successful `handle_turn` rows, replayed persisted telemetry from the outbox, and removed the outbox file before shutdown.
- Success branch: `16` LLM telemetry rows, `48` onion operation rows, `8` `handle_turn` rows.
- Gate-disabled branch: `handle_turn.success=false`, `metadata.workflow=requirements_gathering_onion`, `metadata.gate_status=disabled`.
- Supersession branch: reopen persists a successful `superseded_requirement_retire` receipt, the retired row keeps `trust_level=locked` while `workflow_metadata.status='superseded'`, and the replacement approval creates a new locked finalized requirement.

## 5. Verification Commands

- `npm.cmd run build` (from `C:/ADF/components/memory-engine`) passed.
- `npm.cmd run build` (from `C:/ADF/COO`) passed.
- `npx.cmd tsx --test components/memory-engine/src/schemas/scope-requirements.test.ts` (from `C:/ADF`) passed `6/6`.
- `npx.cmd tsx --test tests/integration/memory-manage-route.integration.test.ts` (from `C:/ADF`) passed `5/5`.
- `npx.cmd tsx --test controller/thread.test.ts requirements-gathering/onion-lane.test.ts classifier/classifier.test.ts` (from `C:/ADF/COO`) passed `16/16`.
- `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts` (from `C:/ADF`) passed and regenerated proof artifacts.

## 6. Narrow Boundary Still Intentional

- The governed supersession route is intentionally narrow: only COO-owned locked finalized requirement artifacts can be retired this way.
- General locked-row mutability policy remains unchanged outside that explicit supersession contract.
