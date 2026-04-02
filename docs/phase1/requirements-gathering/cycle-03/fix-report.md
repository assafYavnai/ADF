1. Failure Classes Closed

- Proof-only invoker seam no longer lives on the production CLI bootstrap path.

2. Route Contracts Now Enforced

- The standard COO CLI bootstrap always stays on the live invoker path in normal operation and rejects `ADF_COO_TEST_PARSER_UPDATES_FILE` unless explicit `--test-proof-mode` is enabled.
- Deterministic CLI bootstrap proof remains available only through guarded `--test-proof-mode`, so proof-mode stub injection is explicit and isolated instead of silently contaminating ordinary CEO-facing CLI execution.
- Route and documentation claims now distinguish the production CLI contract from the guarded proof-mode route truthfully.

3. Files Changed And Why

- `COO/controller/cli.ts`
  - Added the proof-env isolation guard, explicit `--test-proof-mode` parsing, and truthful invoker-mode output.
- `tests/integration/onion-route.runtime-proof.ts`
  - Split CLI proof into a negative production-bootstrap isolation check and a positive guarded proof-mode bootstrap check, then made the generated report fields distinguish production contract vs proof route.
- `tests/integration/artifacts/onion-route-proof/report.json`
- `tests/integration/artifacts/onion-route-proof/cli-production-isolation/cli-stdout.txt`
- `tests/integration/artifacts/onion-route-proof/cli-production-isolation/cli-stderr.txt`
- `tests/integration/artifacts/onion-route-proof/cli-runtime/cli-stdout.txt`
- `tests/integration/artifacts/onion-route-proof/cli-runtime/cli-stderr.txt`
- `tests/integration/artifacts/onion-route-proof/cli-runtime/threads/230b753d-aa4d-4ef3-b324-d19034e0ac09.json`
- `tests/integration/artifacts/onion-route-proof/cli-runtime/threads/230b753d-aa4d-4ef3-b324-d19034e0ac09.txt`
- `tests/integration/artifacts/onion-route-proof/success-runtime/threads/81eebe47-2c34-4909-9f1b-ea8eb8471786.json`
- `tests/integration/artifacts/onion-route-proof/success-runtime/threads/81eebe47-2c34-4909-9f1b-ea8eb8471786.txt`
- `tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/805f949a-f8e3-4f08-9a75-f1084466e61f.json`
- `tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/805f949a-f8e3-4f08-9a75-f1084466e61f.txt`
- `tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/b6a28c94-db92-47df-a780-959440cde947.json`
- `tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/b6a28c94-db92-47df-a780-959440cde947.txt`
- `tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/88faff44-e3e4-44a9-a656-d9d601c478bf.json`
- `tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/88faff44-e3e4-44a9-a656-d9d601c478bf.txt`
  - Regenerated proof-bearing artifacts for the isolated production/bootstrap checks and the retained onion route proof branches.
- `docs/phase1/onion-live-integration-report.md`
- `docs/v0/architecture.md`
- `docs/v0/components-and-layers.md`
- `docs/v0/context/requirements-gathering-onion-model.md`
  - Updated authoritative docs so the live-vs-proof bootstrap separation is stated truthfully.
- `docs/phase1/requirements-gathering/cycle-03/fix-plan.md`
  - Recorded the implementation checklist before code changes.

4. Sibling Sites Checked

- `COO/controller/loop.ts`
- `COO/controller/thread.ts`
- `COO/classifier/classifier.ts`
  - Checked for any sibling env-driven invoker override or route ownership side effect; no code changes were required.
- `docs/phase1/requirements-gathering/cycle-02/fix-report.md`
- `tests/integration/artifacts/onion-route-proof/report.json`
  - Used as the prior-state comparison surface to verify the new production-vs-proof bootstrap wording and artifacts.

5. Proof Of Closure

- Build:
  - `npm.cmd run build` from `C:/ADF/COO`
- Stable controller/onion regression slice:
  - `npx.cmd tsx --test controller/thread.test.ts requirements-gathering/onion-lane.test.ts classifier/classifier.test.ts` from `C:/ADF/COO`
  - Result: `16/16` passed
- Runtime proof:
  - `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts` from `C:/ADF`
  - Output artifact: `tests/integration/artifacts/onion-route-proof/report.json`
- Proof highlights:
  - Production CLI isolation branch exits `1`, writes the explicit rejection in `tests/integration/artifacts/onion-route-proof/cli-production-isolation/cli-stderr.txt`, and leaves `thread_file_count=0`.
  - Guarded proof-mode CLI branch still replays telemetry, routes onion turns, persists thread artifacts, and shuts down cleanly, with `LLM invoker: test-proof-mode (guarded)` captured in `tests/integration/artifacts/onion-route-proof/cli-runtime/cli-stdout.txt`.
  - Existing gate-disabled, success, supersession, and no-scope onion branches still pass in the regenerated runtime proof.

6. Remaining Debt / Non-Goals

- No controller-loop redesign.
- No onion workflow redesign.
- No telemetry schema redesign.
- No broad test-framework rewrite.
- No changes to unrelated workspace state outside this cycle-03 route isolation pass.

7. Next Cycle Starting Point

- Start from [`tests/integration/artifacts/onion-route-proof/report.json`](../../../tests/integration/artifacts/onion-route-proof/report.json) and the guarded-vs-production CLI proof artifacts if a later review disputes bootstrap isolation.
- Treat cycle-03 as the stopping point for this review run. No further cycle is started in this invocation.
