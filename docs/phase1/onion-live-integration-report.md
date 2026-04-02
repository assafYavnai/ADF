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
- Finalized requirement publication is now provisional until the dedicated publish step succeeds; blocked publish failures archive the provisional row, keep `finalized_requirement_memory_id=null`, and leave default readers on truthful current scope.
- Provisional lifecycle control is now confined to dedicated requirement-only routes: `requirements_manage create_finalized_candidate` creates the hidden provisional row, and `memory_manage publish_finalized_requirement` is the only publish route back to current truth.
- Generic governance `create` and generic `memory_manage update_trust_level` no longer accept `workflow_status` as a lifecycle control input, so sibling governance families cannot hide, retire, or republish governed rows through shared surfaces.
- Finalized requirement create/lock and no-scope fail-closed behavior remain proved.
- Reopen supersession now succeeds through an explicit governed `memory_manage supersede` path, and default readers no longer treat the retired locked artifact as current truth.

## 3. Key Runtime Evidence

- Production CLI rejection stderr: [`tests/integration/artifacts/onion-route-proof/cli-production-isolation/cli-stderr.txt`](../../tests/integration/artifacts/onion-route-proof/cli-production-isolation/cli-stderr.txt)
- Guarded proof-mode CLI stdout: [`tests/integration/artifacts/onion-route-proof/cli-runtime/cli-stdout.txt`](../../tests/integration/artifacts/onion-route-proof/cli-runtime/cli-stdout.txt)
- Guarded proof-mode CLI thread: [`tests/integration/artifacts/onion-route-proof/cli-runtime/threads/25b58d31-974d-46d4-9d5d-71c3158ff3ad.json`](../../tests/integration/artifacts/onion-route-proof/cli-runtime/threads/25b58d31-974d-46d4-9d5d-71c3158ff3ad.json)
- Success thread: [`tests/integration/artifacts/onion-route-proof/success-runtime/threads/dd9ffae5-bed3-4573-9058-f38188c72275.json`](../../tests/integration/artifacts/onion-route-proof/success-runtime/threads/dd9ffae5-bed3-4573-9058-f38188c72275.json)
- Success serialized context (frozen scope still visible): [`tests/integration/artifacts/onion-route-proof/success-runtime/threads/dd9ffae5-bed3-4573-9058-f38188c72275.txt`](../../tests/integration/artifacts/onion-route-proof/success-runtime/threads/dd9ffae5-bed3-4573-9058-f38188c72275.txt)
- Lock-failure cleanup thread: [`tests/integration/artifacts/onion-route-proof/lock-failure-runtime/threads/8d09156e-9bb3-4784-953b-76c05f0c19b3.json`](../../tests/integration/artifacts/onion-route-proof/lock-failure-runtime/threads/8d09156e-9bb3-4784-953b-76c05f0c19b3.json)
- Gate-disabled handoff thread: [`tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/dcf26d68-697c-4db6-9b33-1970b6e0daa5.json`](../../tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/dcf26d68-697c-4db6-9b33-1970b6e0daa5.json)
- Supersession thread: [`tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/57c9e6c0-f24f-482f-b4bc-1f43cc7ff030.json`](../../tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/57c9e6c0-f24f-482f-b4bc-1f43cc7ff030.json)
- No-scope fail-closed thread: [`tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/0244e6c0-0b9c-4856-9c66-09e9d2b5174e.json`](../../tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/0244e6c0-0b9c-4856-9c66-09e9d2b5174e.json)

## 4. Telemetry Summary From Report

- Production CLI isolation branch: rejected the proof env with exit code `1` and created `0` thread files.
- Guarded proof-mode CLI branch: `2` successful `handle_turn` rows, replayed persisted telemetry from the outbox, and removed the outbox file before shutdown.
- Success branch: `16` LLM telemetry rows, `48` onion operation rows, `8` `handle_turn` rows.
- Lock-failure cleanup branch: the blocked freeze turn persists `finalized_requirement_create`, failed `finalized_requirement_lock` with `action=publish_finalized_requirement`, successful `provisional_finalized_requirement_retire`, and a blocked thread state with `finalized_requirement_memory_id=null`; the later retry yields exactly one current locked finalized requirement row.
- Gate-disabled branch: `handle_turn.success=false`, `metadata.workflow=requirements_gathering_onion`, `metadata.gate_status=disabled`.
- Supersession branch: reopen persists a successful `superseded_requirement_retire` receipt, the retired row keeps `trust_level=locked` while `workflow_metadata.status='superseded'`, and the replacement approval creates a new locked finalized requirement.
- Negative governance lifecycle coverage: sibling governance `create` ignores `workflow_status`, and generic `update_trust_level` cannot hide or republish requirement rows once retirement metadata exists.

## 5. Verification Commands

- `npm.cmd run build` (from `C:/ADF/components/memory-engine`) passed.
- `npm.cmd run build` (from `C:/ADF/COO`) passed.
- `npx.cmd tsx --test src/schemas/scope-requirements.test.ts` (from `C:/ADF/components/memory-engine`) passed `7/7`.
- `npx.cmd tsx --test tests/integration/memory-manage-route.integration.test.ts` (from `C:/ADF`) passed `8/8`.
- `npx.cmd tsx --test controller/thread.test.ts requirements-gathering/onion-lane.test.ts classifier/classifier.test.ts` (from `C:/ADF/COO`) passed `16/16`.
- `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts` (from `C:/ADF`) passed and regenerated proof artifacts.

## 6. Narrow Boundary Still Intentional

- The deterministic CLI bootstrap proof is explicit test-only behavior behind `--test-proof-mode`; the ordinary CEO-facing CLI path stays on the live invoker route.
- The governed finalized-requirement lifecycle is intentionally narrow: only COO-owned onion finalized requirement artifacts can use `create_finalized_candidate`, `publish_finalized_requirement`, and the supersession retirement route.
- General locked-row mutability policy remains unchanged outside that explicit supersession contract.
