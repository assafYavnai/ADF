# coo-live-executive-status-wiring - Context

## Purpose
This slice no longer means only "wire the executive brief into the CLI."

It now means:
- build a company-first COO executive surface
- cross-check evidence before briefing upward
- investigate anomalies
- maintain bounded operating continuity and trust continuity
- fail closed when Brain is unavailable

## Rebased Scope Decision - 2026-04-05
- The original narrow live-status contract was insufficient for Phase 1.
- The COO is expected to act as an executive operator, not a field renderer.
- The slice is therefore rebased, not abandoned.
- Existing live-status wiring, provenance plumbing, git status window, and briefing package remain the foundation.
- The slice now adds bounded situational awareness, operating-table continuity, deep-audit behavior, and trust-aware judgment on top of that foundation.

## Evidence Hierarchy Decision - 2026-04-05
When evidence disagrees, the COO trusts:
1. direct workspace reality
2. canonical lifecycle artifacts
3. docs and Brain
4. worker claims / summaries / KPI surfaces
5. the derived trust ledger

The trust ledger may increase or decrease suspicion, but it never outranks stronger evidence.

## Brain Decision - 2026-04-05
- Brain is the primary durable memory for the rebased COO path.
- Local persisted state is allowed only for regenerable runtime continuity:
  - operating table continuity
  - trust continuity
  - status-window comparison anchor
- If Brain is unavailable, the COO must hard stop.
- No fake Brain-backed conclusion is allowed.

## Company-First Decision - 2026-04-05
- `/status` defaults to company-level state.
- The current thread remains visible only as operational context.
- The current thread must not define the entire CEO answer.

## Investigation Decision - 2026-04-05
- Suspicious surfaced facts must be investigated before being briefed upward.
- Example: `0 review cycles` is not a reportable conclusion by itself.
- The COO must determine whether it is:
  - acceptable legacy timing
  - acceptable route policy
  - suspicious route failure
  - contradicted or not provable
- The implicated worker, component, or route should be identified when failure is real.
- For KPI gaps, the COO now cross-checks workspace route code against landed slice closeout truth.
- In the current repo shape, that investigation showed a specific route fault: implement-plan computes KPI totals in `run.kpi_projection`, but some landed feature closeout truth does not persist that projection into durable `implement-plan-state.json`.
- That means the CEO-facing report should frame the problem as a system closeout-route gap, not as a feature-delivery failure.

## Deep-Audit Decision - 2026-04-05
- First run performs a deep audit when no prior valid baseline exists.
- Later deep audits are bounded and trigger from:
  - suspicious findings
  - git-backed dropped-context red flags
  - trust transitions
  - staleness pressure
- Deep audits are targeted by default and expand to company-wide only when findings justify broader concern.
- Deep audits write findings to Brain through the runtime path and should be visible to the CEO through status notes.

## Trust Decision - 2026-04-05
- Trust subjects are workers, components, and routes.
- Trust rises from repeated evidence agreement and softens under staleness pressure.
- Credible drift or contradiction can downgrade trust immediately.
- Trust changes only the intensity of checking and suspicion.
- Full trust requires:
  - a fresh deep audit
  - a COO recommendation
  - a CEO approval opportunity

## Status Surface Decision - 2026-04-05
- The live CEO-facing output must stay readable and business-level.
- The output keeps the 4 executive sections as the main management view:
  - Issues That Need Your Attention
  - On The Table
  - In Motion
  - What's Next
- The runtime should gather and normalize the evidence deterministically, but the final CEO-facing wording should come from the COO model, not from hardcoded slot-filled prose.
- Supporting context is allowed around those sections:
  - opening summary
  - status window
  - status notes
  - what landed
  - operational footer

## Timing Truth Decision - 2026-04-05
- Elapsed lifecycle time is not the same as active implementation time.
- If only lifecycle timestamps are available, the COO must say active work time is unknown.
- This rule is enforced both in landed-item rendering and in anomaly classification.

## Operating Continuity Decision - 2026-04-05
Derived runtime continuity currently lives under:
- `.codex/runtime/coo-operating-state.json`
- `.codex/runtime/coo-live-status-window.json`

These files are:
- regenerable
- derived
- secondary to stronger evidence
- not a second canonical company database

Tracked COO issues inside the operating state now also carry:
- a prepared handoff id
- a task summary
- implicated subjects
- an evidence digest

This keeps the COO ready to move directly into implement-plan after approval without reopening the same investigation after a crash or restart.

## Open Constraint
- This slice does not widen into autonomous execution launch.
- The COO may investigate, classify, track, and prepare.
- The CEO still controls launch into major downstream execution.
