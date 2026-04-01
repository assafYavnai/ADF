# Cycle 03 Fix Plan

Source: backfilled from the preserved chat thread.

## Goal

Close the remaining route-level gaps and prove the supported COO path with live artifacts.

## Route-Level Plan

1. Fix the decision route through the real SQL insert path.
2. Make `memory_manage` exact-scope, transactional, and receipt-based for all mutations.
3. Remove non-live classifier/runtime paths from the live contract.
4. Make telemetry batching requeue on sink failure instead of dropping immediately.
5. Harden supported startup and CLI execution paths.
6. Run a real COO session and verify:
   - persisted thread JSON/TXT
   - `COO/...` telemetry rows
   - working resume on the same thread/scope

## Expected Outcome

Turn the COO from a mostly-correct route graph into a route-complete supported runtime with live proof artifacts.
