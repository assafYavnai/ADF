# Executive Brief - Integration Note

## Current State
The briefing package is wired into the live COO runtime through:
- `COO/controller/executive-status.ts`
- `COO/controller/cli.ts` via `--status` and `/status`

The live route is no longer only a direct status renderer.
It now includes:
- evidence gathering
- anomaly investigation
- bounded deep-audit decisions
- bounded trust continuity
- company operating-table continuity
- Brain hard-stop enforcement

## Live Route Layers

### 1. Raw evidence gathering
`COO/briefing/live-source-adapter.ts` gathers derived source facts from:
- live COO thread/onion truth
- finalized requirement truth
- CTO-admission truth when present
- implement-plan truth when present

### 2. Governance and investigation
`COO/briefing/status-governance.ts`:
- hard-stops when Brain-backed continuity is unavailable
- ensures the rebased COO operating rule is recorded through the runtime Brain path
- assesses landed-route quality
- investigates suspicious route facts such as missing review/KPI truth
- creates tracked COO issues
- manages bounded trust state
- decides whether a deep audit should run

### 3. Executive surface rendering
`COO/briefing/live-executive-surface.ts`:
- keeps the internal 4 executive sections available as derived operating truth
- the default live CEO-facing route now freezes a separate approved contract:
  - opening summary
  - optional delivery snapshot
  - optional recent landings
  - `Issues That Need Your Attention`
  - `On The Table`
  - `In Motion`
  - recommendation sentence plus final focus options
- `COO/briefing/status-render-agent.ts` validates the model output against that live contract and falls back deterministically if the model drifts

## Derived-Only Rule
The briefing layer, operating table, and trust continuity remain derived-only.
They do not replace canonical artifact truth and they do not write back into source families.

## Runtime Continuity Files
Bounded local runtime continuity currently uses:
- `.codex/runtime/coo-operating-state.json`
- `.codex/runtime/coo-live-status-window.json`

These files are secondary, regenerable, and auditable.

## What Not To Change
- do not turn the COO brief into a second canonical company database
- do not bypass Brain hard-stop rules on the rebased path
- do not collapse missing-source, ambiguous, or contradicted evidence into calm narrative summaries
