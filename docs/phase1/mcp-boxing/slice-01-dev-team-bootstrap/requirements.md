# Slice 01 Requirements Addendum

Status: active slice requirement addendum  
Scope: `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap`

## Purpose

This file records high-level requirements that specifically affect Slice 01 positioning and must be considered part of the slice baseline.

## Requirement S1-R-001 — Invoker approval is required before merge and completion

Status: active Slice 01 requirement

Even though Slice 01 does not yet implement the full downstream delivery route, the department model created in this slice must preserve the rule that:

- merge must not happen without invoker approval that the slice is complete
- completion status must not be final before that approval exists

### Required future behavior preserved by Slice 01

Before final merge into master / main and origin, the invoker must receive a detailed report and explicitly approve the slice as complete.

That report must include at minimum:

- commits produced
- steps taken
- operation summary
- review cycle count
- KPI summary
- explicit approval request

### Why this belongs in Slice 01

Slice 01 is creating the boxed department shell and its first state model.

That shell must be designed from the beginning to support:

- final invoker approval as a first-class gate
- rejection from that gate
- truthful resume after that gate rejects

## Requirement S1-R-002 — Dual rejection model must be preserved in the state model

Status: active Slice 01 requirement

The department shell created in Slice 01 must not collapse all rejection into one generic state.

The state and route model must preserve the future ability to distinguish at minimum:

- rejection from human testing
- rejection from invoker approval

### Why this belongs in Slice 01

If the boxed department shell starts with a single undifferentiated rejection model, later approval-gate truth will be harder to add cleanly.

So even before the full downstream route is implemented, Slice 01 must preserve the architecture needed for gate-specific rejection and resume behavior.

## Decision Link

These slice requirements should be read together with:

- `docs/phase1/mcp-boxing/requirements.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/decisions.md`
