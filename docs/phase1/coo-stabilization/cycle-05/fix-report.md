# Cycle 05 Fix Report

Source: current cycle.

## Implemented

### Durable write provenance contract

- Made caller provenance mandatory for durable mutation routes in:
  - `components/memory-engine/src/schemas/memory-item.ts`
  - `components/memory-engine/src/schemas/decision.ts`
  - `components/memory-engine/src/schemas/governance.ts`
  - `components/memory-engine/src/tools/memory-tools.ts`
  - `components/memory-engine/src/tools/decision-tools.ts`
  - `components/memory-engine/src/tools/governance-tools.ts`
- Removed fresh legacy-provenance fallbacks from:
  - `components/memory-engine/src/services/capture.ts`
  - `components/memory-engine/src/tools/decision-tools.ts`
  - `components/memory-engine/src/tools/governance-tools.ts`
- Added DB-side rejection of fresh sentinel provenance writes in:
  - `components/memory-engine/src/db/migrations/015_no_fresh_legacy_provenance.sql`

### Legacy evidence boundary

- Added one shared evidence policy in:
  - `components/memory-engine/src/evidence-policy.ts`
- Applied default legacy partitioning across:
  - `components/memory-engine/src/services/search.ts`
  - `components/memory-engine/src/services/context.ts`
  - `components/memory-engine/src/tools/governance-tools.ts`
- Added `include_legacy` to the relevant read contracts.

### Windows provider launch route

- Hardened the shared launcher in:
  - `shared/llm-invoker/managed-process.ts`
- Added Windows shim-route proof in:
  - `shared/llm-invoker/managed-process.test.ts`

### Telemetry lifecycle parity

- Exported `drain()` now shares bounded shutdown semantics with `close()` in:
  - `shared/telemetry/collector.ts`
  - `shared/telemetry/collector.test.ts`

### Capability honesty

- Removed non-live runtime-adjacent schemas:
  - `components/memory-engine/src/schemas/discussion.ts`
  - `components/memory-engine/src/schemas/plan.ts`

### Sibling route proof

- Added DB-backed integration coverage for:
  - `tests/integration/provenance-route.integration.test.ts`
  - `tests/integration/governance-route.integration.test.ts`
  - `tests/integration/retrieval-route.integration.test.ts`
  - `tests/integration/memory-manage-route.integration.test.ts`

## Verification

- `npm run build` in `components/memory-engine`
- `npm run build` in `COO`
- `npx tsc -p tsconfig.json --noEmit` in `shared`
- `npm run migrate:apply`
- `npm run migrate:status`
- focused tests:
  - `components/memory-engine/src/schemas/scope-requirements.test.ts`
  - `shared/telemetry/collector.test.ts`
  - `shared/llm-invoker/managed-process.test.ts`
  - `tests/integration/decision-route.integration.test.ts`
  - `tests/integration/memory-manage-route.integration.test.ts`
  - `tests/integration/provenance-route.integration.test.ts`
  - `tests/integration/governance-route.integration.test.ts`
  - `tests/integration/retrieval-route.integration.test.ts`

## Live Proof

- Managed Windows provider route now succeeds on the real launcher path:
  - `claude --version` through `runManagedProcess(...)`
  - `gemini --version` through `runManagedProcess(...)`
  - `codex --version` through the supported `bash` route
- Live retrieval partition proof:
  - `search_memory('decision', 'assafyavnai/shippingagent')` returned 2 rows, 0 legacy rows
  - `list_recent('assafyavnai/shippingagent')` returned 2 rows, 0 legacy rows
- Live legacy debt remains visible in the DB but is now partitioned by default:
  - `legacy_memory_rows = 3167`
  - `legacy_decision_rows = 254`
  - `legacy_embedding_rows = 1584`

## Residual

The remaining debt is historical evidence quality, not live-route correctness. Legacy rows still exist in large numbers, but fresh writes and default decision-grade retrieval paths no longer treat them as modern evidence.
