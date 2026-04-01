1. Closure Verdicts

- `Historical evidence-lifecycle debt`: `Partial`
  - enforced route invariant: default decision-grade retrieval, context, and governance reads exclude legacy sentinel-backed rows unless `include_legacy` is explicit, and fresh writes no longer add new sentinel-backed evidence.
  - evidence shown: `modernMemoryEvidenceClause(...)` remains the shared read boundary in `components/memory-engine/src/evidence-policy.ts`, `components/memory-engine/src/services/search.ts`, `components/memory-engine/src/services/context.ts`, and `components/memory-engine/src/tools/governance-tools.ts`; focused route proof still passes in `tests/integration/retrieval-route.integration.test.ts` and `tests/integration/governance-route.integration.test.ts`; the live DB still reports legacy rows at `memory_items=3167`, `decisions=254`, `memory_embeddings=1584`.
  - missing proof: there is still no DB-backed retirement, quarantine, or backfill proof showing that legacy sentinel-backed rows have left the live decision-grade tables or moved behind an explicit archive boundary.
  - sibling sites still uncovered: all explicit `include_legacy` read surfaces, audit/export/reporting routes that read the live corpus directly, DB maintenance or backfill jobs, and the live `memory_embeddings` store that still carries legacy-linked rows.
  - whether the patch is route-complete or endpoint-only: endpoint-only read-layer containment, not route-complete storage closure.

2. Remaining Root Cause

The missing system-level contract is evidence lifecycle completion at rest. The stream now enforces two narrower policies: no fresh sentinel-backed writes and no default decision-grade reads over legacy rows. What is still only partially enforced is the storage-side policy that determines when historical sentinel-backed evidence is retired, quarantined, backfilled, or explicitly archived. Until that contract exists and is proven, storage truth and retrieval truth remain misaligned: the normal read routes are safer, but the live corpus still contains legacy evidence and every explicit legacy, audit, export, or maintenance route inherits that unresolved debt. The fix therefore remains incomplete, but the remaining gap is bounded historical debt rather than a reopened live-route regression.

3. Next Minimal Fix Pass

- `historical sentinel-backed corpus -> live decision-grade tables -> explicit legacy/audit/export routes`
  - what still breaks: legacy sentinel-backed rows still remain in `memory_items`, `decisions`, and `memory_embeddings`, so the system still depends on read-time filtering instead of proving that the live decision-grade corpus itself is modern or explicitly archived.
  - what minimal additional layers must change: add one narrow DB retirement/quarantine/backfill route for the legacy rows in those tables, plus the minimal shared policy or documentation update that defines when evidence is considered archived versus live; keep the existing default-read filters in place and do not widen into unrelated search, telemetry, or governance refactors.
  - what proof is still required: DB-backed closure proof that drives the live decision-grade legacy counts to zero or moves them behind an explicit archival boundary, focused regressions proving default reads still exclude legacy evidence unless `include_legacy` is requested, and one live verification query confirming the remaining live corpus is fully modern or deliberately archived.
