# coo-live-executive-status-wiring — Context

## Purpose
This slice makes the merged `COO/briefing/**` package visible in the live COO runtime so the CEO can get a real executive status surface.

## Why It Exists
- The briefing package exists but is still standalone.
- Phase 1 still lacks a strong live answer to "what is on our table?"
- The live status surface should consume admission truth when present and degrade gracefully when it is not.

## Key Constraints
- Keep the briefing layer derived-only.
- Do not mutate source truth while building the brief.
- Keep the output business-level and concise.
- Human verification is required because this becomes a real CEO-facing surface.

## Dependency Note
This slice should run after the freeze-to-admission wiring slice if possible, so the live status surface can read real admission-state truth. It should still degrade gracefully if admission artifacts are not present yet.
