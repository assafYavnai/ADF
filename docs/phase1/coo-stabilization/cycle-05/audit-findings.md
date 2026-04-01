# Cycle 05 Audit Findings

Source: CEO-provided audit and closure verdict for the current cycle.

## Findings

1. Mandatory provenance on new durable writes was still open.
   - Fresh mutation routes could still succeed without caller provenance and write new `system/pre-provenance` rows.
   - The problem spanned schemas, MCP tool definitions, runtime fallbacks, and the lack of a DB-side guard.

2. Windows provider execution was still only partially proven.
   - `gemini --version` worked in PowerShell, but the real managed-process route still failed with `spawn gemini ENOENT`.
   - The root cause sat below provider callers in the shared Windows launcher path.

3. Sibling route proof was uneven.
   - Governance create/list/get/search lacked DB-backed MCP route proof.
   - Only one `memory_manage` branch had route-level integration proof.
   - Hidden scoped recall and explicit scoped search were stronger by code shape than by route-level proof.

4. Historical evidence still lacked a hard audit boundary.
   - Legacy sentinel-heavy rows were still present across all durable stores.
   - Live-route correctness had outpaced historical data quality, so management/reporting surfaces needed a policy partition.

## Audit Direction

The audit conclusion was to close the route, not just the endpoint:

- require provenance at mutation-schema, handler, and DB layers
- fix the shared Windows launch path, not provider-specific call sites
- add route-level proof across sibling branches
- partition legacy evidence out of decision-grade retrieval by default
