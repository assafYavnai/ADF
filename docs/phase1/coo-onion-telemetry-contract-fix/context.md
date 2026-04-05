# coo-onion-telemetry-contract-fix - Context

## Purpose
Repair the build-breaking telemetry contract drift in the onion live path without reopening the completed freeze-to-admission slice.

## Why It Exists

- the CTO-admission handoff seam exists and tests are broadly green
- the live onion path still fails TypeScript build because the emitted telemetry shape drifted from the declared contract
- this is a corrective stabilization slice, not a new product feature

## Key Constraints

- preserve current freeze-to-admission behavior
- keep the fix inside the telemetry and persistence contract boundary
- prefer the smallest truthful contract repair that restores build cleanliness
