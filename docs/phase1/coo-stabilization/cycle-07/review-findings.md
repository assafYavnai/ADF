1. Closure Verdicts

- `Historical evidence-lifecycle debt`: `Partial`
  - enforced route invariant: default decision-grade retrieval, context, and governance reads now exclude legacy sentinel-backed rows unless `include_legacy` is explicit, and fresh writes no longer add new sentinel-backed evidence.
  - evidence shown: `modernMemoryEvidenceClause(...)` is applied in `components/memory-engine/src/evidence-policy.ts`, `components/memory-engine/src/services/search.ts`, `components/memory-engine/src/services/context.ts`, and `components/memory-engine/src/tools/governance-tools.ts`; the focused route coverage remains in `tests/integration/retrieval-route.integration.test.ts` and `tests/integration/governance-route.integration.test.ts`; the live DB still reports legacy rows at `memory_items=3167`, `decisions=254`, `memory_embeddings=1584`.
  - missing proof: there is still no storage-level retirement, quarantine, or backfill proof showing that legacy rows have been removed from live decision-grade tables or moved behind an explicit archive boundary.
  - sibling sites still uncovered: all explicit `include_legacy` read surfaces, any audit/export/reporting path that reads the live corpus directly, DB maintenance or backfill jobs, and the live `memory_embeddings` store that still carries legacy-linked rows.
  - whether the patch is route-complete or endpoint-only: endpoint-only read-layer containment, not route-complete storage closure.

2. Remaining Root Cause

The missing system-level contract is evidence lifecycle completion. The code now shares one read-time policy for modern evidence and blocks fresh sentinel-backed writes, but it still does not define or enforce when historical sentinel-backed rows leave the live decision-grade corpus. That leaves storage truth and retrieval truth only partially aligned: default reads are safer, but the live tables still hold legacy evidence, so every explicit legacy route, audit route, export route, or maintenance path inherits the same unresolved debt. This should remain classified as bounded historical debt, not as a reopened live-route regression.

3. Next Minimal Fix Pass

- `historical sentinel-backed corpus -> live decision-grade tables -> explicit legacy/audit/export routes`
  - what still breaks: legacy sentinel-backed rows remain in `memory_items`, `decisions`, and `memory_embeddings`, so the system still relies on read-time filtering instead of proving that the live corpus itself is modern or explicitly archived.
  - what minimal additional layers must change: add one narrow DB retirement/quarantine/backfill route for the legacy rows in those tables, and add the minimal shared policy/documentation update that defines when evidence is considered archived versus live; keep the existing default-read filters in place rather than widening into unrelated search or governance refactors.
  - what proof is still required: DB-backed retirement or archive proof that drives the live decision-grade counts to zero or moves them behind an explicit archival boundary, focused regressions proving default reads still exclude legacy evidence unless `include_legacy` is requested, and one live verification query confirming the remaining live corpus is fully modern or deliberately archived.
