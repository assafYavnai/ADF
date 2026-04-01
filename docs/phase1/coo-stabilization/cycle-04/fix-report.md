# Cycle 04 Fix Report

Source: current cycle.

## Implemented

The remaining system-level route fixes were implemented across controller, storage, telemetry lifecycle, and reporting.

### Decision provenance continuity

- Added separate decision `content provenance` fields and derivation mode in:
  - `components/memory-engine/src/schemas/decision.ts`
  - `components/memory-engine/src/tools/decision-tools.ts`
  - `components/memory-engine/src/db/migrations/014_decision_content_provenance_chain.sql`
- Passed extractor provenance through:
  - `COO/controller/loop.ts`
  - `COO/controller/memory-engine-client.ts`
  - `COO/controller/cli.ts`

### Bounded telemetry shutdown

- Replaced unbounded drain-only shutdown with bounded close + outbox replay in:
  - `shared/telemetry/collector.ts`
  - `shared/telemetry/collector.test.ts`
  - `COO/controller/cli.ts`

### Evidence partitioning and warm-context

- Decision rows now distinguish `direct_input`, `llm_extracted`, and `legacy_unknown`.
- Daily residue now follows local day in:
  - `COO/context-engineer/context-engineer.ts`

## Verification

- `npm run build` in `components/memory-engine`
- `npm run build` in `COO`
- `npx tsc -p tsconfig.json --noEmit` in `shared`
- `npm run migrate:apply`
- `npm run migrate:status`
- focused tests, including:
  - `tests/integration/decision-route.integration.test.ts`
  - `shared/telemetry/collector.test.ts`
  - `components/memory-engine/src/schemas/scope-requirements.test.ts`

## Live Proof

Supported COO decision route proof:

- thread id: `82cd8901-61ab-451d-9b71-d1fa228def69`
- decision id: `b7637c70-0fe8-4ac9-90f2-55bd8f16306c`

What the proof shows:

- the thread contains the extracted structured decision with extractor provenance
- the committed memory-operation receipt records both content provenance and write provenance
- the durable decision row is marked `llm_extracted`
- Brain telemetry contains matching `COO/intelligence/extract-decision`, `COO/controller/memory-operation/log_decision`, and `COO/controller/handle-turn` events

## Residual

The main remaining debt is historical evidence quality, not live COO route correctness. Legacy rows are now partitioned more honestly, but they are still weaker than modern rows for management-grade reconstruction.
