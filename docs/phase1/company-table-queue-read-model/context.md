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

## Design Decisions

1. **Correlation by feature slug / scope path**: Source families are correlated by matching feature_slug (for requirements, admissions, plans) and scopePath (for threads). A thread with scopePath "feature-X" is correlated with a plan with feature_slug "feature-X".

2. **State priority resolution**: When multiple sources suggest different states, the system uses priority ordering (blocked > in_motion > completed_recently > admitted > admission_pending > next > shaping). If blockers are present, state is forced to "blocked" regardless of other signals.

3. **Ambiguity surfacing**: Conflicts are never silently flattened. Each entry carries explicit ambiguityNotes listing which source suggested what and why the final state was chosen.

4. **Missing-source vs empty-state**: Availability is tracked per source family. A source that was not provided (undefined) is marked available=false. A source that was provided as an empty array is marked available=true with itemCount=0. This distinction is testable.

5. **KPI pattern**: Follows the briefing package pattern — local in-memory collector with percentile function, instrumented build+render wrapper, and self-contained report. No shared/telemetry import.

6. **Source-conditional missing flags**: Missing source families are only flagged on entries where that source was expected (e.g., finalized_requirement is only flagged missing on items that already have an approved snapshot or finalized requirement in their thread).

## Implementation Status
- Completed: all deliverables built, 35 tests pass, build clean.
