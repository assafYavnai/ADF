# Executive Brief - Integration Note

## Current State
The briefing package is wired into the live COO runtime through `COO/controller/executive-status.ts` and the CLI `--status` / `/status` path.

The route now runs in two layers:

1. internal 4-section brief
   - used for parity, visibility, and source-truth proof
2. normalized live executive surface
   - used for the CEO-facing render
   - exposes landed work, moving work, standout notes, and current attention items with provenance, freshness, and confidence

## Live Route Contract

### 1. Evidence Gathering
`COO/briefing/live-source-adapter.ts` gathers raw evidence from:
- COO thread/onion truth
- finalized requirement truth
- CTO-admission truth when present
- implement-plan truth when present

The adapter remains derived-only and does not write back into any source family.

### 2. Evidence Normalization
The live route does not render directly from flattened summary fields.

Before rendering, it classifies each material claim as:
- direct source truth
- derived from multiple sources
- fallback because a source family is missing
- ambiguous because the available evidence is insufficient or contradictory
- unavailable because the route has no trustworthy source for that field

### 3. CEO-Facing Render
The internal 4-section brief stays in place for audit and parity proof, but the live CEO-facing output is intentionally more scan-friendly:
- one short opening paragraph
- `What landed`
- optional `What is moving`
- optional `What stands out`
- `What needs your attention now`

### 4. Timing Truth
When the route only has implement-plan lifecycle timestamps, it renders them as elapsed lifecycle time and explicitly says that active work time is unknown.

### 5. Production / Proof Isolation
Production and proof paths remain isolated through `sourcePartition` telemetry and proof tests.

### 6. Status Window And Git Coverage Check
The live controller also carries a runtime-only status window:
- it records the last COO status update time and HEAD commit under `.codex/runtime/coo-live-status-window.json`
- it compares git activity since that prior update
- it raises a red flag when recently touched feature-slice work is absent from the current COO surface

This check is supporting evidence only. It does not mutate source truth and it does not widen into a broader context-gathering redesign.

## What Not To Change
`COO/briefing/**` remains a pure derived layer.
Do not add source mutation, persistence write-back, or any second source of truth.
