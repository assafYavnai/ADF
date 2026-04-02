# Onion Live Integration Report

Saved on 2026-04-02 from [`tests/integration/artifacts/onion-route-proof/report.json`](../../tests/integration/artifacts/onion-route-proof/report.json).

## 1. Route Claim vs Route Proof

- Runtime capability remains: `CLI -> controller -> classifier -> requirements_gathering_onion -> thread workflowState.onion -> governed requirement persistence -> COO response -> telemetry`.
- The ordinary production CLI now rejects proof-only parser-update injection unless explicit proof mode is enabled.
- The deterministic CLI bootstrap proof now runs through guarded `--test-proof-mode`, and the report also retains the controller-detail proof route.
- Gate controls remain: `ADF_ENABLE_REQUIREMENTS_GATHERING_ONION`, `--enable-onion`, `--disable-onion`.

## 2. Contracts Now Proved

- Production CLI bootstrap cannot be silently diverted by `ADF_COO_TEST_PARSER_UPDATES_FILE`; the ordinary entry rejects that env var and exits before any thread work starts.
- Guarded CLI proof mode covers scripted stdin routing, telemetry outbox replay, durable thread output, and clean shutdown without leaving the production bootstrap open to proof-only invoker injection.
- Persisted onion ownership is gate-enforced even after `handoff_ready` (`active_workflow=null`): gate-disabled follow-up turns are blocked fail-closed with `workflow=requirements_gathering_onion`.
- Frozen-thread recovery keeps approved onion meaning visible in thread serialization (`workflow owner`, freeze status, approved snapshot identity, and scope lines).
- Finalized requirement create/lock and no-scope fail-closed behavior remain proved.
- Reopen supersession now succeeds through an explicit governed `memory_manage supersede` path, and default readers no longer treat the retired locked artifact as current truth.

## 3. Key Runtime Evidence

- Production CLI rejection stderr: [`tests/integration/artifacts/onion-route-proof/cli-production-isolation/cli-stderr.txt`](../../tests/integration/artifacts/onion-route-proof/cli-production-isolation/cli-stderr.txt)
- Guarded proof-mode CLI stdout: [`tests/integration/artifacts/onion-route-proof/cli-runtime/cli-stdout.txt`](../../tests/integration/artifacts/onion-route-proof/cli-runtime/cli-stdout.txt)
- Guarded proof-mode CLI thread: [`tests/integration/artifacts/onion-route-proof/cli-runtime/threads/230b753d-aa4d-4ef3-b324-d19034e0ac09.json`](../../tests/integration/artifacts/onion-route-proof/cli-runtime/threads/230b753d-aa4d-4ef3-b324-d19034e0ac09.json)
- Success thread: [`tests/integration/artifacts/onion-route-proof/success-runtime/threads/81eebe47-2c34-4909-9f1b-ea8eb8471786.json`](../../tests/integration/artifacts/onion-route-proof/success-runtime/threads/81eebe47-2c34-4909-9f1b-ea8eb8471786.json)
- Success serialized context (frozen scope still visible): [`tests/integration/artifacts/onion-route-proof/success-runtime/threads/81eebe47-2c34-4909-9f1b-ea8eb8471786.txt`](../../tests/integration/artifacts/onion-route-proof/success-runtime/threads/81eebe47-2c34-4909-9f1b-ea8eb8471786.txt)
- Gate-disabled handoff thread: [`tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/805f949a-f8e3-4f08-9a75-f1084466e61f.json`](../../tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/805f949a-f8e3-4f08-9a75-f1084466e61f.json)
- Supersession thread: [`tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/b6a28c94-db92-47df-a780-959440cde947.json`](../../tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/b6a28c94-db92-47df-a780-959440cde947.json)
- No-scope fail-closed thread: [`tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/88faff44-e3e4-44a9-a656-d9d601c478bf.json`](../../tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/88faff44-e3e4-44a9-a656-d9d601c478bf.json)

## 4. Telemetry Summary From Report

- Production CLI isolation branch: rejected the proof env with exit code `1` and created `0` thread files.
- Guarded proof-mode CLI branch: `2` successful `handle_turn` rows, replayed persisted telemetry from the outbox, and removed the outbox file before shutdown.
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

- The deterministic CLI bootstrap proof is explicit test-only behavior behind `--test-proof-mode`; the ordinary CEO-facing CLI path stays on the live invoker route.
- The governed supersession route is intentionally narrow: only COO-owned locked finalized requirement artifacts can be retired this way.
- General locked-row mutability policy remains unchanged outside that explicit supersession contract.
