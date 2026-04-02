# Onion Live Integration Report

Saved on 2026-04-02 from the live integration proof in [`tests/integration/artifacts/onion-route-proof/report.json`](../../tests/integration/artifacts/onion-route-proof/report.json).

## 1. Live Route Integrated

- Supported live route now: `CLI -> controller -> classifier -> requirements_gathering_onion -> thread workflowState.onion -> governed requirement persistence -> COO response -> telemetry`.
- Gate: `ADF_ENABLE_REQUIREMENTS_GATHERING_ONION` or `--enable-onion`.
- Disabled behavior is explicit and fail-closed for active onion threads; proof thread: [`tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/0c69adf3-68e3-44c1-a00f-4bd79009dcbc.json`](../../tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/0c69adf3-68e3-44c1-a00f-4bd79009dcbc.json).
- Success proof thread: [`tests/integration/artifacts/onion-route-proof/success-runtime/threads/2c18a878-ec4c-4b1b-9543-5b00870a962a.json`](../../tests/integration/artifacts/onion-route-proof/success-runtime/threads/2c18a878-ec4c-4b1b-9543-5b00870a962a.json).

## 2. Contracts Enforced

- Classifier, controller, and thread all share the same live workflow contract: `requirements_gathering_onion`.
- Onion progression remains outside-in and one-question-at-a-time because the live adapter delegates to the dormant pure engine.
- Freeze is explicit only; no silent freeze path exists.
- Open business decisions still block freeze and downstream handoff.
- The finalized requirement artifact is derived only from the approved onion snapshot; no silent business guessing.
- Persistence fails closed when scope is missing or governed writes are unavailable.
- Resume/recovery comes from persisted thread workflow state, not hidden model/session memory.
- Live turns emit durable thread evidence plus telemetry/audit evidence.

## 3. Files Changed And Why

- [`COO/controller/workflow-contract.ts`](../../COO/controller/workflow-contract.ts): new shared workflow enum so classifier/controller/thread stay aligned.
- [`COO/classifier/classifier.ts`](../../COO/classifier/classifier.ts): added gate-aware onion workflow classification.
- [`COO/classifier/classifier.test.ts`](../../COO/classifier/classifier.test.ts): locked the live workflow contract in tests.
- [`COO/controller/loop.ts`](../../COO/controller/loop.ts): added gate handling, onion routing, injectable LLM seam for proof, and richer turn telemetry metadata.
- [`COO/controller/thread.ts`](../../COO/controller/thread.ts): added durable `workflowState`, `onion_turn_result`, and onion-aware serialization.
- [`COO/controller/thread.test.ts`](../../COO/controller/thread.test.ts): added onion workflow serialization coverage.
- [`COO/controller/cli.ts`](../../COO/controller/cli.ts): added `--enable-onion` and `--disable-onion`, env-gate resolution, and governed requirement/memory wiring.
- [`COO/controller/memory-engine-client.ts`](../../COO/controller/memory-engine-client.ts): added governed requirement creation wrapper.
- [`COO/requirements-gathering/contracts/onion-live.ts`](../../COO/requirements-gathering/contracts/onion-live.ts): live thread-state and persistence-receipt contracts.
- [`COO/requirements-gathering/live/onion-live.ts`](../../COO/requirements-gathering/live/onion-live.ts): thin live adapter from COO turns to dormant onion engine plus persistence and audit.
- [`tests/integration/onion-route.runtime-proof.ts`](../../tests/integration/onion-route.runtime-proof.ts): real-route proof script using the live controller path with deterministic LLM injection.
- [`docs/v0/architecture.md`](../../docs/v0/architecture.md): replaced stale route description with the current live controller model.
- [`docs/v0/components-and-layers.md`](../../docs/v0/components-and-layers.md): marked requirements-gathering as live behind a gate.
- [`docs/v0/folder-structure.md`](../../docs/v0/folder-structure.md): documented the real `contracts/`, `engine/`, `live/`, and `fixtures/` onion surfaces.
- [`docs/v0/context/requirements-gathering-onion-model.md`](../../docs/v0/context/requirements-gathering-onion-model.md): added the live-gate note while preserving the business model as source truth.
- [`docs/phase1/README.md`](README.md): updated Phase 1 status from deferred onion to live gated onion.
- [`docs/phase1/adf-phase1-discussion-record.md`](adf-phase1-discussion-record.md): marked deferred-onion statements as historical and linked the live proof.
- [`docs/phase1/adf-phase1-high-level-plan.md`](adf-phase1-high-level-plan.md): updated the current gate and next-step wording.
- [`docs/phase1/adf-phase1-coo-completion-plan.md`](adf-phase1-coo-completion-plan.md): added the live integration closure update and shifted next work to downstream use.
- [`docs/phase1/adf-phase1-onion-parallel-build-plan.md`](adf-phase1-onion-parallel-build-plan.md): marked as historical dormant-build context.

## 4. Sibling Sites Checked

- [`COO/context-engineer/context-engineer.ts`](../../COO/context-engineer/context-engineer.ts): inspected, unchanged.
- [`shared/telemetry/collector.ts`](../../shared/telemetry/collector.ts): inspected and reused as-is; no telemetry redesign.
- [`shared/llm-invoker/invoker.ts`](../../shared/llm-invoker/invoker.ts): inspected and reused as-is; no invoker redesign.
- [`components/memory-engine/src/server.ts`](../../components/memory-engine/src/server.ts) and [`components/memory-engine/src/tools/governance-tools.ts`](../../components/memory-engine/src/tools/governance-tools.ts): inspected to confirm the existing governed requirement and memory-manage routes were sufficient.
- [`COO/classifier/classifier.ts`](../../COO/classifier/classifier.ts), [`COO/controller/loop.ts`](../../COO/controller/loop.ts), [`COO/controller/thread.ts`](../../COO/controller/thread.ts), [`COO/controller/cli.ts`](../../COO/controller/cli.ts), and [`COO/controller/memory-engine-client.ts`](../../COO/controller/memory-engine-client.ts): changed together so the route is controller-complete, not endpoint-only.

## 5. Persistence And Recovery Proof

- Checkpoint persistence after interruption is captured in [`tests/integration/artifacts/onion-route-proof/success-runtime/threads/2c18a878-ec4c-4b1b-9543-5b00870a962a.json`](../../tests/integration/artifacts/onion-route-proof/success-runtime/threads/2c18a878-ec4c-4b1b-9543-5b00870a962a.json) and [`tests/integration/artifacts/onion-route-proof/success-runtime/threads/2c18a878-ec4c-4b1b-9543-5b00870a962a.txt`](../../tests/integration/artifacts/onion-route-proof/success-runtime/threads/2c18a878-ec4c-4b1b-9543-5b00870a962a.txt). The persisted checkpoint layer is `experience_ui`, with next question `Does UI or user-experience meaning matter to this scope before freeze?`.
- The same thread resumes and finishes as `handoff_ready`; proof is recorded in [`tests/integration/artifacts/onion-route-proof/report.json`](../../tests/integration/artifacts/onion-route-proof/report.json) under `success`.
- Finalized governed requirement artifact ID from the live route: `2545e7eb-34c6-404e-b879-3fbf94586cbf`. It is persisted as `content_type=requirement`, `trust_level=locked`, with COO-owned tags; that row is captured in [`tests/integration/artifacts/onion-route-proof/report.json`](../../tests/integration/artifacts/onion-route-proof/report.json).
- Fail-closed no-scope proof is in [`tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/8fbbaf4c-b736-4525-97da-4b1a7a8539b6.json`](../../tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/8fbbaf4c-b736-4525-97da-4b1a7a8539b6.json): freeze is approved, lifecycle is `blocked`, and the receipt says `Cannot persist the finalized requirement artifact without an explicit scope.`

## 6. Telemetry And Audit Proof

- [`tests/integration/artifacts/onion-route-proof/report.json`](../../tests/integration/artifacts/onion-route-proof/report.json) records `16` LLM telemetry rows, `48` onion operation rows, and `8` `handle_turn` rows for the success route.
- Sample durable LLM telemetry in the report includes classifier and parser rows with real latency/token fields:
  - classifier: `latency_ms=11`, `tokens_in=592`, `tokens_out=74`
  - onion parser: `latency_ms=23`, `tokens_in=541`, `tokens_out=32`
- Sample durable onion operation telemetry in the report includes `onion_reducer`, `clarification_policy`, `freeze_check`, `artifact_deriver`, `readiness_check`, and `audit_trace_build`, each with `route_stage=requirements_gathering_onion`.
- Durable workflow audit is also persisted in-thread: the final `onion_turn_result` stores `6` operation records and `1` LLM call record in [`tests/integration/artifacts/onion-route-proof/success-runtime/threads/2c18a878-ec4c-4b1b-9543-5b00870a962a.json`](../../tests/integration/artifacts/onion-route-proof/success-runtime/threads/2c18a878-ec4c-4b1b-9543-5b00870a962a.json).
- Gate-disabled telemetry proof is in [`tests/integration/artifacts/onion-route-proof/report.json`](../../tests/integration/artifacts/onion-route-proof/report.json) under `gate_disabled.gate_turn_telemetry`: `success=false`, `workflow=requirements_gathering_onion`, `gate_status=disabled`.

## 7. Route-Level Test / Runtime Proof

- Build: `npm.cmd run build` in `C:\ADF\COO` passed.
- Route-free and unit coverage: `npx.cmd tsx --test controller/thread.test.ts requirements-gathering/onion-lane.test.ts classifier/classifier.test.ts` in `C:\ADF\COO` passed `15/15`.
- Live route proof: `npx.cmd tsx tests/integration/onion-route.runtime-proof.ts` in `C:\ADF` passed and wrote [`tests/integration/artifacts/onion-route-proof/report.json`](../../tests/integration/artifacts/onion-route-proof/report.json).
- The proof script uses the real controller, classifier, thread, persistence, and telemetry route and injects only the LLM responses through `ControllerConfig.invokeLLM` so routing, persistence, recovery, and telemetry are exercised deterministically.

## 8. Documentation Updated

- [`docs/v0/architecture.md`](../../docs/v0/architecture.md): current controller/workflow model.
- [`docs/v0/components-and-layers.md`](../../docs/v0/components-and-layers.md): requirements-gathering lane status.
- [`docs/v0/folder-structure.md`](../../docs/v0/folder-structure.md): actual onion folder layout.
- [`docs/v0/context/requirements-gathering-onion-model.md`](../../docs/v0/context/requirements-gathering-onion-model.md): live-gate note without changing business truth.
- [`docs/phase1/README.md`](README.md): Phase 1 status and proof pointer.
- [`docs/phase1/adf-phase1-discussion-record.md`](adf-phase1-discussion-record.md): deferred-onion statements marked historical.
- [`docs/phase1/adf-phase1-high-level-plan.md`](adf-phase1-high-level-plan.md): next-step language updated after live integration.
- [`docs/phase1/adf-phase1-coo-completion-plan.md`](adf-phase1-coo-completion-plan.md): live onion integration closure and next work.
- [`docs/phase1/adf-phase1-onion-parallel-build-plan.md`](adf-phase1-onion-parallel-build-plan.md): reclassified as historical dormant-build context.

## 9. Remaining Non-Goals / Deferred Work

- No downstream CTO or implementation-lane consumption of the finalized requirement artifact yet.
- No redesign of the controller architecture or thread model.
- No redesign of shared telemetry or the shared LLM invoker.
- No UI mockup generator; the live lane only carries UI alignment state and approval metadata.
- No broader historical-evidence policy redesign in this slice.
- No context-engineer redesign; onion integration stays on the narrow live adapter path.
