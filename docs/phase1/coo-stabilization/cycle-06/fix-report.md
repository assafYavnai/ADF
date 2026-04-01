# Cycle 06 Fix Report

Source: current cycle.

## Implemented

### Telemetry provenance route

- Made direct telemetry writes require full provenance in:
  - `components/memory-engine/src/tools/telemetry-tools.ts`
- Tightened the published telemetry MCP contract so `emit_metric` and `emit_metrics_batch` no longer advertise partial provenance as valid input.
- Removed caller-provenance fabrication from tool-route telemetry in:
  - `components/memory-engine/src/server.ts`
- Caller-visible tool routes now do one of two things only:
  - preserve valid caller provenance
  - emit under explicit internal provenance at `memory-engine/internal/tool-route-telemetry/<tool>`

### Windows/provider launch transport

- Removed the shell-backed Codex prompt wrapper in:
  - `shared/llm-invoker/invoker.ts`
- Removed the shell-backed Claude session launch in:
  - `shared/llm-invoker/invoker.ts`
- Hardened the shared Windows launcher in:
  - `shared/llm-invoker/managed-process.ts`
- The managed route now:
  - resolves npm-style `.cmd` shims directly to `node <script>` when possible
  - uses an explicit `cmd.exe` fallback with staged arguments for generic batch shims
  - preserves metacharacter-bearing args on the managed shim route

### Capability-surface parity cleanup

- Removed `artifact_ref` from the governable family contract in:
  - `components/memory-engine/src/schemas/governance.ts`
- Removed `artifact_ref` from hidden COO recall and context-load allowlists in:
  - `COO/context-engineer/context-engineer.ts`
  - `COO/controller/loop.ts`

### Proof additions

- Added telemetry route proof in:
  - `tests/integration/telemetry-route.integration.test.ts`
- Expanded Windows shim transport proof in:
  - `shared/llm-invoker/managed-process.test.ts`
- Updated sibling contract tests in:
  - `components/memory-engine/src/schemas/scope-requirements.test.ts`
  - `COO/context-engineer/context-engineer.test.ts`

## Verification

- `npm run build` in `components/memory-engine`
- `npm run build` in `COO`
- `npx tsc -p tsconfig.json --noEmit` in `shared`
- focused tests:
  - `shared/llm-invoker/managed-process.test.ts`
  - `shared/llm-invoker/invoker.test.ts`
  - `COO/context-engineer/context-engineer.test.ts`
  - `components/memory-engine/src/schemas/scope-requirements.test.ts`
  - `tests/integration/provenance-route.integration.test.ts`
  - `tests/integration/telemetry-route.integration.test.ts`
  - `tests/integration/governance-route.integration.test.ts`
  - `tests/integration/retrieval-route.integration.test.ts`

## Live Proof

- Managed launcher proof on the supported Windows route:
  - `claude --version` through `runManagedProcess(...)` -> `2.1.85 (Claude Code)`
  - `gemini --version` through `runManagedProcess(...)` -> `0.34.0`
  - `codex --version` through `runManagedProcess(...)` -> `codex-cli 0.117.0`
- DB-backed telemetry proof:
  - partial `emit_metric` provenance now rejects
  - partial `emit_metrics_batch` provenance now rejects
  - caller-less `list_recent` telemetry now writes under `memory-engine/internal/tool-route-telemetry/list_recent`

## Residual

- Historical evidence debt remains historical debt; this cycle did not backfill old sentinel-heavy rows.
- This cycle did not add a new `artifact_refs_manage` tool family. It closed the mismatch by shrinking the live governable/injectable contract instead.
