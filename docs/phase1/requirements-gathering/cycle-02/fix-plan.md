1. Failure Classes

- Full CLI-entry route closure is still only partially proved. The supported runtime is documented as CLI-driven, but the committed proof still enters at `controller.handleTurn` and does not exercise CLI gate/bootstrap/shutdown behavior.
- Reopened finalized requirements cannot supersede the prior locked durable artifact truthfully. The live onion route still falls back to a failed generic archive attempt and blocks instead of retiring the previous locked artifact through a governed supersession path.

2. Route Contracts

- If the supported COO runtime is `CLI -> controller -> classifier -> requirements_gathering_onion -> persistence -> telemetry`, the closure proof for this feature must enter through the real CLI bootstrap and show gate resolution, scripted turn routing, durable thread output, telemetry persistence, and shutdown/replay behavior.
- If a frozen onion scope is reopened, the previous finalized requirement artifact must stop being current durable truth through an explicit governed supersession path before the resumed onion can continue toward a corrected re-approval.
- The thread, memory-engine receipts, and proof artifacts must stay aligned. If a supersession or persistence write does not happen, the route must fail closed and record the exact governed failure.

3. Sweep Scope

- [`COO/controller/cli.ts`](../../../COO/controller/cli.ts)
- [`COO/controller/loop.ts`](../../../COO/controller/loop.ts)
- [`COO/controller/thread.ts`](../../../COO/controller/thread.ts)
- [`COO/controller/memory-engine-client.ts`](../../../COO/controller/memory-engine-client.ts)
- [`COO/classifier/classifier.ts`](../../../COO/classifier/classifier.ts)
- [`COO/requirements-gathering/live/onion-live.ts`](../../../COO/requirements-gathering/live/onion-live.ts)
- [`components/memory-engine/src/server.ts`](../../../components/memory-engine/src/server.ts)
- [`components/memory-engine/src/tools/governance-tools.ts`](../../../components/memory-engine/src/tools/governance-tools.ts)
- [`components/memory-engine/src/db/migrations/001_init.sql`](../../../components/memory-engine/src/db/migrations/001_init.sql)
- [`tests/integration/onion-route.runtime-proof.ts`](../../../tests/integration/onion-route.runtime-proof.ts)
- [`docs/phase1/onion-live-integration-report.md`](../../onion-live-integration-report.md)
- [`docs/v0/architecture.md`](../../../docs/v0/architecture.md)
- [`docs/v0/components-and-layers.md`](../../../docs/v0/components-and-layers.md)
- [`docs/v0/context/requirements-gathering-onion-model.md`](../../../docs/v0/context/requirements-gathering-onion-model.md)

4. Planned Changes

- Add a narrow CLI-entry route proof that drives the real bootstrap path with scripted input, validates `--enable-onion` / env gate behavior, persists thread output, and captures shutdown or telemetry replay evidence without redesigning the controller.
- Add an explicit governed supersession path for locked finalized requirement artifacts in the memory engine, including truthful receipts and durable state that mark the prior finalized artifact as superseded or otherwise retired from current truth without weakening general lock safety.
- Update the requirements-gathering live adapter and memory-engine client to call the new supersession path on reopen, keep thread lifecycle truthful, and persist the replacement finalized requirement artifact only after the prior artifact has been retired successfully.
- Extend route-level proof so reopen no longer blocks, the supersession receipt succeeds, the old finalized artifact is no longer the current durable truth, and a later re-approval creates a new locked finalized artifact.
- Update authoritative docs so the live route, supersession behavior, and proof boundaries match the actual integrated behavior produced by this cycle.

5. Closure Proof

- `npm.cmd run build` in `C:\ADF\COO`.
- Route-free and focused tests for any new CLI/bootstrap and supersession logic, including any affected controller/thread/memory-engine tests.
- Route-level proof that enters through the real CLI path, writes durable thread and telemetry artifacts, and shows gate/bootstrap/shutdown behavior for the onion lane.
- Route-level proof that reopens a frozen scope, supersedes the previous locked finalized requirement artifact through a governed path, keeps the thread active truthfully, and then re-approves to a replacement locked finalized artifact.
- Durable evidence in the proof artifacts and any DB/runtime receipts showing:
  - the prior finalized artifact is no longer current truth
  - the supersession receipt succeeded
  - the replacement finalized artifact exists and is locked
  - telemetry records the live route, timings, and any LLM calls truthfully

6. Non-Goals

- No controller architecture redesign.
- No classifier redesign beyond any narrow routing/proof alignment needed for the real CLI route.
- No dormant onion engine redesign.
- No broad memory-engine schema overhaul beyond the minimum governed supersession contract needed for locked finalized requirements.
- No downstream CTO or implementation-lane expansion.

7. Implementation Checklist (cycle-02 pass)

- Add a governed locked-row supersession action in the memory engine for COO-owned finalized requirement artifacts instead of reusing generic `archive`.
- Use `workflow_metadata` plus tags as the durable retirement surface and tighten default modern-read filters so superseded/archived workflow states are no longer treated as current truth.
- Update the COO memory-engine client and onion live persistence path to call the explicit supersession action on reopen and keep receipts/thread lifecycle truthful.
- Add focused integration coverage for the new memory-engine supersession route.
- Add a narrow scripted CLI proof seam for deterministic runtime proof without widening the controller architecture.
- Extend the onion runtime proof to:
  - enter through the real CLI bootstrap for one scripted onion route
  - prove startup replay of a persisted telemetry outbox item
  - prove clean scripted shutdown output
  - prove reopen -> supersede prior locked finalized artifact -> continue -> re-approve replacement artifact
- Regenerate proof artifacts and align authoritative docs to the now-proved CLI-entry and supersession behavior.
- Write `fix-report.md` only after build/tests/runtime proof and durable evidence are complete.
