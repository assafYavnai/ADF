# Cycle 05 Fix Plan

Source: current cycle.

## Goal

Close the remaining route-level failure classes without widening scope into a broader architecture rewrite.

## Route-Level Plan

1. Durable write provenance contract
   - require provenance on mutation schemas and MCP contracts
   - remove handler fallbacks that synthesize fresh legacy provenance
   - add a DB guard so new writes and mutations cannot land with `system/pre-provenance`

2. Legacy evidence boundary
   - add one shared evidence-policy helper
   - make `search_memory`, `get_context_summary`, `list_recent`, and governance read routes exclude legacy sentinel-backed rows by default
   - allow explicit opt-in with `include_legacy`

3. Windows provider launch route
   - fix the shared managed-process launcher so Windows PATH resolution prefers real executables or `.cmd` shims
   - prove the actual managed route for `claude`, `gemini`, and the `codex` bash path

4. Telemetry lifecycle parity
   - make exported `drain()` share the same bounded shutdown semantics as `close()`

5. Capability honesty
   - remove schema-only discussion/plan artifacts from the live runtime package since they are not callable end to end

6. Sibling route proof
   - add DB-backed route tests for governance create/list/get/search
   - add DB-backed route tests for `memory_manage` delete, update_tags, and update_trust_level
   - add a mixed-corpus retrieval proof for hidden COO recall
   - add negative provenance tests for mutation routes
