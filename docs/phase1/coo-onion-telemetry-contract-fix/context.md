# coo-onion-telemetry-contract-fix - Context

## Purpose
Truthfully close the telemetry-contract slice by verifying the already-landed onion live contract repair and recording governed proof without reopening the completed freeze-to-admission slice.

## Why It Exists

- the CTO-admission handoff seam exists and remains the governing authority for the persistence shape
- the slice was opened when the live onion emitter appeared to drift from that contract, but commit `42bf725a04c96f0b89fcf1a1e591cff0f72d6abb` has already removed the unsupported top-level field on `main`
- this is now a corrective documentation and closeout slice, not a new product feature

## Key Constraints

- preserve current freeze-to-admission behavior
- keep all work inside the telemetry and persistence contract boundary
- prefer no new COO code changes unless current verification shows the regression is still live
