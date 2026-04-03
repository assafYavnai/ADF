# Context: coo-executive-brief-read-model

## Slice Origin
This slice builds the first bounded CEO-facing executive brief read model as a pure derived layer.

## Active Constraints
- The active coo-kpi-instrumentation stream owns shared COO route files; this slice must avoid those files.
- This slice stays unwired to CLI and controller while the KPI lane is active.
- The executive brief is a derived read model only; source truth remains authoritative.

## Dependencies
- Existing saved feature/thread/open-loop shapes as inputs (read-only).
- No runtime wiring dependencies in this slice.

## Decision Log
- 2026-04-03: Slice created. Plan approved by CEO. Implementation via governed implement-plan path.
