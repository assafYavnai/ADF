# COO Stabilization Context

## Stream Status

- Feature stream: `coo-stabilization`
- Phase: `1`
- Latest completed cycle: `cycle-08`
- Latest completed cycle commit: pending current closeout
- Latest completed cycle focus:
  - validate the carried-forward cycle-07 closure set without widening the stabilization scope
  - confirm whether any live route defect or regression remained after the no-code closeout
  - isolate whether historical evidence-lifecycle debt was still the only bounded remaining item

## Current Operational Truth

- `cycle-08` is a no-code review closeout on top of the cycle-07 review-verified route.
- The supported CLI -> COO -> Brain -> thread -> telemetry route is materially healthy.
- Historical evidence rows in `memory_items`, `decisions`, and `memory_embeddings` now use an explicit at-rest contract:
  - `evidence_format_version = 2`
  - `evidence_lifecycle_status = current | legacy_archived`
  - `legacy_marker = ADF_LEGACY_SENTINEL_V1` for the upgraded legacy corpus
- Default decision-grade retrieval paths still exclude legacy evidence, and explicit legacy reads now return the lifecycle markers instead of relying on sentinel heuristics alone.
- The remaining in-scope gap is narrower now: archival/retention policy for the legacy corpus, not legacy detection on the live route.
- The review-cycle setup for this stream now resolves to `codex_cli_full_auto_bypass` for spawned executions, with native persistent-agent reuse available for orchestration.

## Inputs To Carry Into The Next Cycle

- Primary carry-forward artifact:
  - `docs/phase1/coo-stabilization/cycle-08/fix-report.md`
- Supporting prior findings:
  - `docs/phase1/coo-stabilization/cycle-08/audit-findings.md`
  - `docs/phase1/coo-stabilization/cycle-08/review-findings.md`

## Cycle 08 Goal

Continue from the latest completed fix report without regenerating prior artifacts, then determine whether any live stabilization route defect still remained.

Specific direction:

- reuse the existing review stream under `docs/phase1/coo-stabilization`
- treat `cycle-08` as complete once closeout is recorded
- start the next review round from the carried-forward `cycle-08` fix report
- keep the scope on route-level COO stabilization only
- do not widen into unrelated refactors

## Known Non-Goals

- do not restart the review stream
- do not overwrite completed cycle artifacts
- do not re-run completed cycles
- do not broaden into onion implementation or unrelated feature work during this cycle
