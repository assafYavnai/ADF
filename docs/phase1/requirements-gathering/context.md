# Requirements-Gathering Review Context

## 1. Task Summary

Review the requirements-gathering implementation end to end, with emphasis on the live COO onion integration route, persistence, telemetry, recovery, documentation, and proof.

## 2. Current Baseline

- Repo root: `C:/ADF`
- Current branch: `main`
- Current head at cycle start: `3ddb772`
- Feature stream: `phase1/requirements-gathering`
- Review-cycle root: `docs/phase1/requirements-gathering`

## 3. Route Under Review

The target live route is:

`CLI -> controller -> classifier -> requirements_gathering_onion -> onion truth state + readiness/freeze facts -> derived conversation-state render -> COO response -> telemetry`

The route is currently documented in:

- [`docs/phase1/onion-live-integration-report.md`](onion-live-integration-report.md)
- [`tests/integration/artifacts/onion-route-proof/report.json`](../../tests/integration/artifacts/onion-route-proof/report.json)

## 4. Main Implementation Surfaces

Primary live-route files:

- [`COO/controller/workflow-contract.ts`](../../COO/controller/workflow-contract.ts)
- [`COO/classifier/classifier.ts`](../../COO/classifier/classifier.ts)
- [`COO/controller/loop.ts`](../../COO/controller/loop.ts)
- [`COO/controller/thread.ts`](../../COO/controller/thread.ts)
- [`COO/controller/cli.ts`](../../COO/controller/cli.ts)
- [`COO/controller/memory-engine-client.ts`](../../COO/controller/memory-engine-client.ts)
- [`COO/requirements-gathering/contracts/onion-live.ts`](../../COO/requirements-gathering/contracts/onion-live.ts)
- [`COO/requirements-gathering/live/onion-live.ts`](../../COO/requirements-gathering/live/onion-live.ts)
- [`COO/requirements-gathering/engine/conversation-state.ts`](../../COO/requirements-gathering/engine/conversation-state.ts)
- [`COO/requirements-gathering/engine/conversation-renderer.ts`](../../COO/requirements-gathering/engine/conversation-renderer.ts)

Dormant/pure onion engine surfaces already existed and are now consumed by the live adapter:

- [`COO/requirements-gathering/contracts/`](../../COO/requirements-gathering/contracts)
- [`COO/requirements-gathering/engine/`](../../COO/requirements-gathering/engine)

## 5. Current Proof Artifacts

Live route proof script:

- [`tests/integration/onion-route.runtime-proof.ts`](../../tests/integration/onion-route.runtime-proof.ts)

Durable proof artifacts:

- [`tests/integration/artifacts/onion-route-proof/report.json`](../../tests/integration/artifacts/onion-route-proof/report.json)
- [`tests/integration/artifacts/onion-route-proof/success-runtime/threads/2c18a878-ec4c-4b1b-9543-5b00870a962a.json`](../../tests/integration/artifacts/onion-route-proof/success-runtime/threads/2c18a878-ec4c-4b1b-9543-5b00870a962a.json)
- [`tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/0c69adf3-68e3-44c1-a00f-4bd79009dcbc.json`](../../tests/integration/artifacts/onion-route-proof/gate-disabled-runtime/threads/0c69adf3-68e3-44c1-a00f-4bd79009dcbc.json)
- [`tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/8fbbaf4c-b736-4525-97da-4b1a7a8539b6.json`](../../tests/integration/artifacts/onion-route-proof/no-scope-runtime/threads/8fbbaf4c-b736-4525-97da-4b1a7a8539b6.json)

Existing tests related to the feature:

- [`COO/classifier/classifier.test.ts`](../../COO/classifier/classifier.test.ts)
- [`COO/controller/thread.test.ts`](../../COO/controller/thread.test.ts)
- [`COO/requirements-gathering/engine/conversation-renderer.test.ts`](../../COO/requirements-gathering/engine/conversation-renderer.test.ts)
- [`COO/requirements-gathering/onion-lane.test.ts`](../../COO/requirements-gathering/onion-lane.test.ts)
- [`tests/integration/onion-route.runtime-proof.ts`](../../tests/integration/onion-route.runtime-proof.ts)

## 6. Documentation Updated By The Implementation

- [`docs/v0/architecture.md`](../../docs/v0/architecture.md)
- [`docs/v0/components-and-layers.md`](../../docs/v0/components-and-layers.md)
- [`docs/v0/folder-structure.md`](../../docs/v0/folder-structure.md)
- [`docs/v0/context/requirements-gathering-onion-model.md`](../../docs/v0/context/requirements-gathering-onion-model.md)
- [`docs/phase1/README.md`](README.md)
- [`docs/phase1/adf-phase1-discussion-record.md`](adf-phase1-discussion-record.md)
- [`docs/phase1/adf-phase1-high-level-plan.md`](adf-phase1-high-level-plan.md)
- [`docs/phase1/adf-phase1-coo-completion-plan.md`](adf-phase1-coo-completion-plan.md)
- [`docs/phase1/adf-phase1-onion-parallel-build-plan.md`](adf-phase1-onion-parallel-build-plan.md)
- [`docs/phase1/onion-live-integration-report.md`](onion-live-integration-report.md)

## 7. Review Focus

The audit and review should check at least these route-level claims:

- classifier, controller, thread, and live onion adapter stay contract-aligned
- active onion threads fail closed when the gate is disabled
- onion state and finalized artifacts persist truthfully and resume truthfully
- approved human meaning is preserved in derived requirements with no silent guessing
- route-level telemetry and workflow audit are durable, not only in memory
- the runtime proof reflects real behavior rather than a mocked endpoint-only shortcut
- sibling routes and persistence/telemetry surfaces were checked, not just the new adapter
- onion/internal truth state remains the persisted source of truth while CEO-facing conversation state stays a derived, non-persistent presentation layer

## 8. Non-Goals

- Do not redesign the full controller architecture.
- Do not widen into downstream CTO implementation workflows.
- Do not redesign shared telemetry or the shared LLM invoker unless a real route defect forces it.
- Do not rebuild the dormant onion engine from scratch unless a concrete integration defect requires a targeted correction.
