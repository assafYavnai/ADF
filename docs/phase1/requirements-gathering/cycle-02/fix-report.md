1. Failure Classes Closed

- Full CLI-entry live-route proof is now closed through the real COO bootstrap path.
- Reopened finalized requirements now retire the prior locked durable artifact through a governed supersession route before replacement handoff.

2. Route Contracts Now Enforced

- If the supported runtime is documented as `CLI -> controller -> classifier -> requirements_gathering_onion -> persistence -> telemetry`, proof now enters through the actual CLI bootstrap and covers gate resolution, scripted routing, telemetry replay, durable thread output, and shutdown.
- If a frozen onion scope reopens, the previous finalized requirement artifact must stop serving as current durable truth through an explicit governed supersession write before the resumed onion can re-approve a replacement artifact.
- Onion persistence receipts now report governed `memory_manage` mutation success truthfully; transport success alone no longer counts as durable success.

3. Files Changed And Why

- `COO/controller/cli.ts`
  - Added narrow runtime-dir and parser-stub seams so the real CLI bootstrap can be proved in isolation without touching the main workspace runtime folders.
- `COO/controller/loop.ts`
- `COO/controller/memory-engine-client.ts`
  - Extended the governed memory-manage contract to include `supersede`.
- `COO/requirements-gathering/live/onion-live.ts`
  - Replaced reopen-time generic archive with explicit governed supersession and made lock/retire receipts fail closed when `memory_manage` returns an unsuccessful receipt.
- `COO/requirements-gathering/contracts/onion-live.ts`
  - Updated persistence receipt enums for the supersession contract.
- `components/memory-engine/src/schemas/memory-item.ts`
- `components/memory-engine/src/tools/memory-tools.ts`
- `components/memory-engine/src/server.ts`
- `components/memory-engine/src/evidence-policy.ts`
  - Added the governed `supersede` mutation, constrained it to COO-owned locked finalized requirements, and excluded `workflow_metadata.status in ('archived', 'superseded')` from default modern-reader truth.
- `components/memory-engine/src/schemas/scope-requirements.test.ts`
- `tests/integration/memory-manage-route.integration.test.ts`
- `tests/integration/onion-route.runtime-proof.ts`
  - Added focused coverage for the supersede contract and extended the runtime proof to cover CLI entry, telemetry replay, successful supersession, and replacement handoff.
- `tests/integration/artifacts/onion-route-proof/report.json`
- `tests/integration/artifacts/onion-route-proof/cli-runtime/cli-stdout.txt`
- `tests/integration/artifacts/onion-route-proof/cli-runtime/cli-stderr.txt`
- `tests/integration/artifacts/onion-route-proof/cli-runtime/threads/e7e2e92a-10b6-43f5-b4b0-d049dc47bc78.json`
- `tests/integration/artifacts/onion-route-proof/cli-runtime/threads/e7e2e92a-10b6-43f5-b4b0-d049dc47bc78.txt`
- `tests/integration/artifacts/onion-route-proof/success-runtime/threads/0550eff3-be49-4576-a72b-626251883067.json`
- `tests/integration/artifacts/onion-route-proof/success-runtime/threads/0550eff3-be49-4576-a72b-626251883067.txt`
- `tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/6d4134b1-2d90-4e43-be1a-93749cb3bb77.json`
- `tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/6d4134b1-2d90-4e43-be1a-93749cb3bb77.txt`
- `tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/0f154aba-4db4-4eed-a2b5-c1601e48ffa4.json`
- `tests/integration/artifacts/onion-route-proof/supersession-runtime/threads/0f154aba-4db4-4eed-a2b5-c1601e48ffa4.txt`
- `tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/ec85f21b-6217-41f6-a6ad-122ebdfea385.json`
- `tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/ec85f21b-6217-41f6-a6ad-122ebdfea385.txt`
  - Regenerated proof-bearing artifacts from the verified runtime route.
- `docs/phase1/onion-live-integration-report.md`
- `docs/v0/architecture.md`
- `docs/v0/components-and-layers.md`
- `docs/v0/context/requirements-gathering-onion-model.md`
  - Updated authoritative docs so the claimed route, supersession behavior, and proof boundaries match the verified integrated behavior.
- `docs/phase1/requirements-gathering/cycle-02/fix-plan.md`
  - Recorded the implementation checklist before code changes.

4. Sibling Sites Checked

- `COO/controller/thread.ts`
- `COO/controller/thread.test.ts`
- `COO/classifier/classifier.ts`
- `COO/context-engineer/context-engineer.ts`
  - Checked persisted-thread ownership and recovery surfaces; no additional code changes were required in this cycle.
- `components/memory-engine/src/tools/governance-tools.ts`
- `components/memory-engine/src/services/search.ts`
- `components/memory-engine/src/services/context.ts`
  - Checked default current-truth reader behavior after supersession and relied on the shared evidence policy update instead of duplicating filters.
- `components/memory-engine/src/db/migrations/001_init.sql`
- `components/memory-engine/src/db/migrations/003_workflow_layer.sql`
  - Confirmed the lock policy and existing `workflow_metadata` field were sufficient for the narrow supersession contract.

5. Proof Of Closure

- Build:
  - `npm.cmd run build` from `C:/ADF/components/memory-engine`
  - `npm.cmd run build` from `C:/ADF/COO`
- Focused tests:
  - `npx.cmd tsx --test components/memory-engine/src/schemas/scope-requirements.test.ts` from `C:/ADF`
    - Result: `6/6` passed
  - `npx.cmd tsx --test tests/integration/memory-manage-route.integration.test.ts` from `C:/ADF`
    - Result: `5/5` passed
  - `npx.cmd tsx --test controller/thread.test.ts requirements-gathering/onion-lane.test.ts classifier/classifier.test.ts` from `C:/ADF/COO`
    - Result: `16/16` passed
- Runtime proof:
  - `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts` from `C:/ADF`
  - Output artifact: `tests/integration/artifacts/onion-route-proof/report.json`
- Proof highlights:
  - CLI-entry proof shows `--enable-onion` overrides a disabled env gate, replays one persisted telemetry event from the outbox, persists an onion-owned thread, and exits cleanly.
  - Supersession proof shows reopen stays `active`, persists a successful `superseded_requirement_retire` receipt, marks the old locked row `workflow_metadata.status='superseded'`, removes it from default list/search readers, and then creates and locks a replacement finalized requirement.
  - No-scope proof still fails closed with a truthful persistence receipt.

6. Remaining Debt / Non-Goals

- No controller architecture redesign.
- No broad memory-engine schema overhaul beyond the narrow governed supersession contract.
- No change to the general locked-row immutability policy outside the explicit COO-owned finalized-requirement supersession path.
- No expansion into unrelated workflows or non-onion CLI behavior.

7. Next Cycle Starting Point

- Start from [`tests/integration/artifacts/onion-route-proof/report.json`](../../../tests/integration/artifacts/onion-route-proof/report.json) and this cycle's proof artifacts if any new review disputes the CLI-entry route or the supersession contract.
- Treat the current closure as route-complete for the reviewed onion lane unless a later cycle finds a regression in CLI bootstrap, governed supersession receipts, or downstream readers of retired finalized requirements.
