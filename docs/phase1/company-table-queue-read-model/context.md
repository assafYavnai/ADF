# company-table-queue-read-model — Context

## Purpose
This slice builds a standalone management-level table and queue read model for Phase 1.

## Why It Exists
- The live wiring slices need a stable derived table model to consume.
- The user wants a large safe weekend chunk that does not collide with the active live-wiring seams.
- This slice is intentionally standalone and unwired.

## Key Constraints
- Derived-only, no source mutation.
- No COO controller wiring.
- No briefing or CTO-admission package edits.
- Missing-source and ambiguous-source cases must remain explicit.

## Dependency Note
This slice can run in parallel with the live wiring slices because it is package-only. Later live status wiring may consume it if the model proves useful.
