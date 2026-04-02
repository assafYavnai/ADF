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
- the historical evidence layer is now explicitly upgraded in place:
  - `memory_items`, `decisions`, and `memory_embeddings` all carry `evidence_format_version = 2`
  - legacy rows are marked at rest as `legacy_archived`
  - the stable legacy marker is `ADF_LEGACY_SENTINEL_V1`
  - explicit legacy reads now surface those markers directly
- the main remaining blocker has shifted further toward evidence policy debt:
  - the old corpus is now explicitly labeled, not heuristically inferred
  - the remaining decision is whether to keep it in place behind the explicit boundary or move it into a separate archive path
- the requirements-gathering onion lane is now integrated into the supported COO runtime behind the explicit feature gate `ADF_ENABLE_REQUIREMENTS_GATHERING_ONION` / `--enable-onion`
- live proof now exists under `tests/integration/artifacts/onion-route-proof/`
- the older parallel-build plan remains as historical context for the dormant build slice, not as the current live-state description

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
- the `ADF continuity foundation` is now strong enough for the live onion lane to run behind its explicit feature gate with durable thread state, governed requirement persistence, and telemetry/audit evidence
- requirements gathering is still a COO-owned pre-function activity
- the feature function starts from the finalized requirement-list handoff
- the final target chain is broader, but the first build should stay small and fast

For the current intended shape and the most recent discussion synthesis, continue into:

- [adf-phase1-discussion-record.md](./adf-phase1-discussion-record.md)
- [adf-phase1-high-level-plan.md](./adf-phase1-high-level-plan.md)
- [adf-phase1-coo-completion-plan.md](./adf-phase1-coo-completion-plan.md)
- [coo-stabilization/README.md](./coo-stabilization/README.md)
