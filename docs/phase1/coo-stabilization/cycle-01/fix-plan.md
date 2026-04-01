# Cycle 01 Fix Plan

Source: backfilled from the preserved chat thread.

## Goal

Do not restart architecture. Stabilize the COO foundation before onion implementation.

## Route-Level Plan

1. Fix persistence truth
   - repair decision logging
   - repair governance/rule creation
   - repair deep scope resolution
2. Fix recovery truth
   - durable turn checkpoints
   - real CLI resume
   - bounded prompt replay
3. Fix memory truth
   - safer retrieval
   - visible retrieval degradation
4. Fix observability truth
   - real telemetry sink
   - actual LLM telemetry
   - explicit provenance limits
5. Fix capability honesty
   - remove or fail-close dead-end surfaces

## Expected Outcome

Turn the COO from a salvageable prototype into a stabilization candidate.
