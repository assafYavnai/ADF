# ADF Phase 1 Context Pack

Purpose: give a contextless agent the minimum Phase 1 framing needed to continue the current company-design work without reconstructing the recent discussion.

## Read Order

1. [../PHASE1_MASTER_PLAN.md](../PHASE1_MASTER_PLAN.md)
2. [../v0/context/phase1-feature-flow-and-executive-briefing-draft.md](../v0/context/phase1-feature-flow-and-executive-briefing-draft.md)
3. [../v0/context/requirements-gathering-onion-model.md](../v0/context/requirements-gathering-onion-model.md)
4. [adf-phase1-discussion-record.md](./adf-phase1-discussion-record.md)
5. [adf-phase1-high-level-plan.md](./adf-phase1-high-level-plan.md)
6. [adf-phase1-coo-completion-plan.md](./adf-phase1-coo-completion-plan.md)
7. [coo-stabilization/README.md](./coo-stabilization/README.md)
8. [adf-phase1-onion-parallel-build-plan.md](./adf-phase1-onion-parallel-build-plan.md)

## Why This Folder Exists

The Phase 1 direction has now been simplified:

- the immediate goal is not to perfect every specialized governance module
- the immediate goal is to make a fast, reasonable-quality end-to-end chain from CEO/COO requirements shaping to completed feature delivery
- the work should start by finishing the `ADF continuity foundation`
- then move into the requirements-gathering onion model
- then into a minimal implementation lane

This folder records that simplified direction.

Current COO note:

- the COO stabilization slice made the runtime real and buildable
- the remaining blocker is not architecture restart
- the most serious end-to-end scope + truthful memory-operation evidence gaps are now closed
- the supported COO route now has live proof artifacts:
  - a real persisted COO thread under `threads/`
  - `COO/...` telemetry rows in Brain
  - successful resume on the same thread and scope
- the decision route now preserves two provenance chains:
  - content provenance for the structured decision itself
  - write provenance for the durable decision mutation
- telemetry shutdown is now bounded and durable on the supported CLI route:
  - drain if possible
  - spool to a local outbox if the sink stays unavailable
  - replay on the next supported startup
- the main remaining blocker has shifted further toward evidence quality debt:
  - historical provenance quality is still dominated by legacy sentinel rows
  - historical decision rows are now explicitly partitioned as `legacy_unknown`, but they still carry weaker trust than modern rows
- onion implementation remains deferred until the evidence layer is strong enough for management use
- a separate parallel-build plan now exists for onion work that must stay additive and unwired until stabilization is formally accepted

## Core Source Pointers

Primary source docs:

- `docs/PHASE1_MASTER_PLAN.md`
- `docs/v0/context/phase1-feature-flow-and-executive-briefing-draft.md`
- `docs/v0/context/requirements-gathering-onion-model.md`

Important supporting context:

- `docs/v0/context/2026-03-31-grouped-shrinking-readiness-live-001.md`
- `docs/v0/context/2026-03-31-grouped-shrinking-safety-layer-live-001.md`
- `docs/v0/context/2026-03-31-arb-next-steps-workplan.md`

Use the supporting context as evidence about review-cost tradeoffs, not as the main Phase 1 design authority.

## Current Working Direction

- Phase 1 should be treated as 2 primary lanes:
  - `CEO <-> COO requirements gathering`
  - `implementation lane` from finalized requirements to completed feature
- before the onion lane is treated as real, the `ADF continuity foundation` should be strong enough that discussions, decisions, requirement fragments, prompts, and open loops are restorable
- requirements gathering is still a COO-owned pre-function activity
- the feature function starts from the finalized requirement-list handoff
- the final target chain is broader, but the first build should stay small and fast

For the current intended shape and the most recent discussion synthesis, continue into:

- [adf-phase1-discussion-record.md](./adf-phase1-discussion-record.md)
- [adf-phase1-high-level-plan.md](./adf-phase1-high-level-plan.md)
- [adf-phase1-coo-completion-plan.md](./adf-phase1-coo-completion-plan.md)
- [coo-stabilization/README.md](./coo-stabilization/README.md)
