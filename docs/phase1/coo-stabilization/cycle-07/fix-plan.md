1. Failure Classes

- Historical evidence-lifecycle debt

2. Route Contracts

- Decision-grade evidence should be modern at rest or explicitly archived, not kept live indefinitely and hidden only by read-time filtering.
- Default reads should remain decision-safe, but explicit legacy, audit, export, and maintenance routes need an explicit storage boundary for old sentinel-backed rows.

3. Sweep Scope

- Historical sentinel backfills across `memory_items`, `decisions`, and `memory_embeddings`
- Shared evidence policy and default retrieval surfaces
- Explicit `include_legacy` reads
- Governance reads
- Audit, export, and maintenance paths that can traverse the legacy corpus directly

4. Planned Changes

- Do not run a live implementation patch in cycle 07 because the review round found no new live defect or regression.
- Preserve the audit and review reports as the cycle-07 reviewer truth.
- Update the stabilization stream docs to record that cycle 07 closes with no code-path changes and leaves one bounded historical debt item.
- Close the cycle with verification evidence and a no-code fix report so the next pass starts from the correct state.

5. Closure Proof

- `cycle-07/audit-findings.md`
- `cycle-07/review-findings.md`
- `npm run build` in `components/memory-engine`
- `npm run build` in `COO`
- `npx tsc -p tsconfig.json --noEmit` in `shared`
- `npx tsx --test tests/integration/provenance-route.integration.test.ts`
- `npx tsx --test tests/integration/retrieval-route.integration.test.ts`
- `npx tsx --test tests/integration/governance-route.integration.test.ts`

6. Non-Goals

- Do not backfill or retire the legacy corpus in this cycle.
- Do not widen into provenance-schema redesign, search refactoring, telemetry redesign, or onion work.
- Do not claim that historical debt is closed just because default live reads are safe.
