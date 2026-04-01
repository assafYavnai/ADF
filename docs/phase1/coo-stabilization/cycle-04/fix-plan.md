# Cycle 04 Fix Plan

Source: current cycle.

## Goal

Close the last live system-level route gaps without widening scope.

## Route-Level Plan

1. Decision provenance continuity
   - carry `content provenance` from COO extraction through thread evidence into the durable decision row
   - keep `write provenance` separate as the durable mutation identity

2. Bounded telemetry lifecycle
   - replace infinite drain semantics with:
     - normal drain when possible
     - bounded shutdown timeout
     - local outbox spool when the sink stays unavailable
     - replay on next supported startup

3. Evidence partitioning
   - mark decision rows as `direct_input`, `llm_extracted`, or `legacy_unknown`
   - keep historical legacy rows explicitly weaker than modern rows

4. Warm-context local-day fix
   - load daily residue using local date instead of UTC date

5. Proof
   - rerun the supported COO route through a real decision logging turn
   - verify the thread artifact, decision row, and `COO/...` telemetry agree
