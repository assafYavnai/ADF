# coo-freeze-to-cto-admission-wiring — Context

## Purpose
This slice makes the live COO freeze path produce real CTO-admission artifacts from the merged `COO/cto-admission/**` package.

## Why It Exists
- The packet builder exists but is still standalone.
- The COO can already freeze finalized requirements.
- The missing seam is the live handoff from finalized requirement to technical admission truth.

## Key Constraints
- Keep the change narrow and additive.
- Do not build a full CTO queue or scheduler.
- Do not auto-spawn implement-plan in this slice.
- Make `pending decision` explicit instead of pretending the packet is fully admitted.

## Dependency Note
This slice should land before the live executive/status wiring slice, because the status surface should be able to read real admission-state truth if available.
