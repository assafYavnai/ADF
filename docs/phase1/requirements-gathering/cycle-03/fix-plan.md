1. Failure Classes

- Proof-only invoker seam is live on the production CLI bootstrap path.

2. Route Contracts

- The standard COO CLI bootstrap must always use the real invoker path in normal operation and must not accept proof-only deterministic parser updates unless an explicit test-only mode is enabled.
- CLI-route proof must remain available, but it must run through an isolated proof harness or guarded proof mode that cannot silently contaminate ordinary CEO-facing CLI execution.
- Route and documentation claims must distinguish live production bootstrap behavior from test-only proof harness behavior truthfully.

3. Sweep Scope

- [`COO/controller/cli.ts`](../../../COO/controller/cli.ts)
- [`COO/controller/loop.ts`](../../../COO/controller/loop.ts)
- [`tests/integration/onion-route.runtime-proof.ts`](../../../tests/integration/onion-route.runtime-proof.ts)
- [`tests/integration/artifacts/onion-route-proof/report.json`](../../../tests/integration/artifacts/onion-route-proof/report.json)
- [`docs/phase1/onion-live-integration-report.md`](../../onion-live-integration-report.md)
- [`docs/v0/architecture.md`](../../../docs/v0/architecture.md)
- [`docs/v0/components-and-layers.md`](../../../docs/v0/components-and-layers.md)
- [`docs/v0/context/requirements-gathering-onion-model.md`](../../../docs/v0/context/requirements-gathering-onion-model.md)

4. Planned Changes

- Remove or strictly guard the proof-only parser-update env seam from the normal CLI bootstrap path so the live executable cannot be silently diverted by `ADF_COO_TEST_PARSER_UPDATES_FILE`.
- Move the deterministic CLI-entry proof onto an explicit isolated proof path that still exercises CLI bootstrap behavior without leaving the production bootstrap open to test-only invoker injection.
- Add negative proof that the ordinary CLI ignores or rejects proof-only env injection without explicit proof mode, and retain positive proof that the isolated proof harness still generates the route artifacts.
- Update authoritative docs and proof artifacts so they describe the separated live-vs-proof bootstrap behavior accurately.

5. Closure Proof

- `npm.cmd run build` in `C:\ADF\COO`.
- Route-level proof that the normal CLI path cannot be diverted by `ADF_COO_TEST_PARSER_UPDATES_FILE` alone.
- Route-level proof that the isolated CLI proof harness still produces durable thread, persistence, and telemetry artifacts for the onion route.
- Updated proof/report artifacts and docs that show the production bootstrap is clean while the proof harness remains deterministic and explicit.

6. Non-Goals

- No controller-loop redesign.
- No onion workflow redesign.
- No telemetry schema redesign.
- No broad test-framework rewrite.

7. Implementation Checklist (cycle-03 pass)

- Remove the silent proof-env invoker override from the normal CLI bootstrap path.
- Add an explicit guarded CLI proof mode so deterministic stub injection only works when the operator opts into test-only behavior.
- Make the ordinary CLI reject `ADF_COO_TEST_PARSER_UPDATES_FILE` when proof mode is not enabled, before any live route work starts.
- Extend the runtime proof with:
  - a negative production-bootstrap isolation check
  - a positive guarded proof-mode CLI bootstrap check
- Regenerate the onion route proof artifacts and report with truthful live-vs-proof bootstrap wording.
- Update authoritative docs and write `cycle-03/fix-report.md` only after verification passes.
