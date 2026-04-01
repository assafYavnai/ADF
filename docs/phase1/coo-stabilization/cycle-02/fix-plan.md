# Cycle 02 Fix Plan

Source: backfilled from the preserved chat thread.

## Goal

Make scope and operation receipts mandatory across the live COO lane.

## Route-Level Plan

1. Add explicit scope from CLI -> thread -> controller -> Brain.
2. Fail closed when scope is missing on normal COO reads and writes.
3. Record one truthful memory-operation receipt per action, including returned IDs and success/failure state.
4. Make hidden COO memory loading scoped and trust-aware.
5. Remove silent default-organization behavior from governance writes.
6. Reduce any still-advertised surface that the runtime did not actually implement.

## Expected Outcome

Turn the COO from "runnable" into "truthful enough for the next audit".
