# coo-onion-telemetry-contract-fix

## Target Local Folder
C:/ADF/docs/phase1/coo-onion-telemetry-contract-fix/README.md

## Feature Goal
Truthfully close the telemetry-contract slice by verifying that the onion live handoff no longer emits the unsupported top-level CTO-admission field and by recording the already-landed repair without changing the intended freeze-to-admission behavior.

## Why This Slice Exists Now

- this slice was opened when the onion live telemetry path appeared to drift from the declared CTO-admission contract
- current `main` no longer reproduces that failure: commit `42bf725a04c96f0b89fcf1a1e591cff0f72d6abb` already removed the unsupported top-level emitter field while closing `adf-runtime-preflight-and-install-split`
- the remaining governed work is to verify the already-landed repair, record the proof truthfully, and close this slice without reintroducing duplicate transport fields

## Requested Scope

Keep this slice tightly focused on the onion live telemetry contract and the minimum proof needed to close the slice truthfully.

This slice must:

- verify that `COO/requirements-gathering/live/onion-live.ts` now matches the declared telemetry and persistence contract
- confirm CTO-admission persistence fields remain in the nested truthful location instead of a duplicate top-level transport field
- preserve the intended freeze-to-admission behavior and persistence receipts
- add code changes only if current verification disproves the already-landed repair
- record the proof that `COO` builds cleanly on current `main`

## Allowed Edits

- `COO/requirements-gathering/live/**`
- `COO/requirements-gathering/contracts/**`
- `COO/cto-admission/**` only if a minimal additive contract alignment is strictly required
- tightly scoped tests for the onion and CTO-admission handoff path
- `docs/phase1/coo-onion-telemetry-contract-fix/**`

## Forbidden Edits

- no onion workflow redesign
- no broad telemetry schema redesign outside this bug
- no implement-plan, review-cycle, or merge-queue changes
- no unrelated memory-engine changes
- no edits to other slice folders

## Required Deliverables

- one truthful telemetry and persistence contract shape for the onion live handoff path
- a clean `COO` build on current `main` semantics
- targeted tests or proof updates showing the current route truthfully
- context.md
- implement-plan-contract.md
- implement-plan-brief.md
- completion-summary.md

## Acceptance Gates

- `npm.cmd run build` under `C:/ADF/COO` passes
- the onion live telemetry path no longer emits unsupported top-level fields
- CTO-admission persistence fields remain visible in the correct nested location
- targeted onion and CTO-admission proof remains truthful
- no new COO code changes are introduced unless verification shows the regression is still live

## Machine Verification Plan

- run `npm.cmd run build` in `C:/ADF/COO`
- run targeted tests for the onion and CTO-admission handoff path
- run `git diff --check` on the changed source set

## Human Verification Plan

- Required: false
- Reason: this is a bounded build-contract repair and does not change a human-facing surface

## Non-Goals

- no new CTO-admission behavior
- no new status surface work
- no benchmark harness work
- no unrelated onion feature work
