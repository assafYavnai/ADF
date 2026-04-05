# coo-onion-telemetry-contract-fix

## Target Local Folder
C:/ADF/docs/phase1/coo-onion-telemetry-contract-fix/README.md

## Feature Goal
Restore a build-clean COO runtime by fixing the onion live telemetry contract drift around CTO-admission persistence fields without changing the intended freeze-to-admission behavior.

## Why This Slice Exists Now

- current `main` fails the `COO` TypeScript build because onion live telemetry emits a top-level `ctoAdmissionState` field that is not part of the declared telemetry contract
- the regression sits on a core Phase 1 path that should already be stable after the freeze-to-admission wiring work
- tests are green, but the branch is not releasable while the build stays broken

## Requested Scope

Keep this slice tightly focused on the onion live telemetry contract and the minimum proof needed to reestablish build truth.

This slice must:

- align `COO/requirements-gathering/live/onion-live.ts` with the declared telemetry and persistence contract
- keep CTO-admission persistence fields in one truthful location instead of duplicating them across transport shapes
- preserve the intended freeze-to-admission behavior and persistence receipts
- add or update targeted tests if the contract fix is not already sufficiently covered
- prove that `COO` builds cleanly again

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
- targeted tests or proof updates if needed
- context.md
- implement-plan-contract.md
- completion-summary.md

## Acceptance Gates

- `npm.cmd run build` under `C:/ADF/COO` passes
- the onion live telemetry path no longer emits unsupported top-level fields
- CTO-admission persistence fields remain visible in the correct nested location
- targeted onion and CTO-admission proof remains truthful

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
