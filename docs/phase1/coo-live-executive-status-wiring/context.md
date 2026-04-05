# coo-live-executive-status-wiring - Context

## Purpose
Make the COO runtime expose one live leadership status surface built from the merged `COO/briefing/**` and `COO/table/**` packages.

## Why It Exists

- The briefing package is merged but still standalone.
- The company-table package exists but is not yet the live runtime answer.
- The CEO still cannot ask the live COO for a trustworthy business-level status surface.

## Key Constraints

- Keep the briefing layer derived-only.
- Keep the table layer derived-only.
- Do not mutate source truth while building the live surface.
- Keep the output business-level and concise.
- Human verification is required because this becomes a real CEO-facing surface.

## Execution Note
Treat `company-table-queue-read-model` as upstream substrate, not as a second runtime-wiring project. This slice owns the live wiring path and must consume the table package rather than duplicating or replacing it.

## Dependency Note
This slice should read real CTO-admission truth when present, especially from the already-merged freeze-to-admission wiring path. It must still degrade gracefully if admission artifacts are missing or partially available.
