# 1. Implementation Objective

Truthfully close `coo-onion-telemetry-contract-fix` by verifying that the onion live telemetry contract drift is already repaired on current `main`, updating the slice artifacts to match that truth, and avoiding new COO code changes unless verification proves the regression is still live.

# 2. Exact Slice Scope

- `docs/phase1/coo-onion-telemetry-contract-fix/**` for README, context, contract, brief, and completion artifacts
- verification of `COO/requirements-gathering/live/onion-live.ts` and `COO/requirements-gathering/contracts/onion-live.ts`
- targeted COO tests covering the onion and CTO-admission handoff path
- no production COO source edits unless current verification disproves the already-landed repair

# 3. Inputs / Authorities Read

- `C:/ADF/docs/phase1/coo-onion-telemetry-contract-fix/README.md`
- `C:/ADF/docs/phase1/coo-onion-telemetry-contract-fix/context.md`
- `C:/ADF/docs/phase1/coo-onion-telemetry-contract-fix/implement-plan-contract.md`
- `C:/ADF/COO/requirements-gathering/live/onion-live.ts`
- `C:/ADF/COO/requirements-gathering/contracts/onion-live.ts`
- `git show 42bf725a04c96f0b89fcf1a1e591cff0f72d6abb -- COO/requirements-gathering/live/onion-live.ts`
- `C:/ADF/docs/phase1/coo-freeze-to-cto-admission-wiring/completion-summary.md`
- `C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md`

# 4. Required Deliverables

- truthful slice docs explaining that the unsupported top-level emitter field was already removed on `main`
- build and targeted test proof for the onion and CTO-admission handoff path
- `completion-summary.md` recording the already-landed repair and the docs-only governed closeout
- no new COO code change unless current verification proves the regression is still live

# 5. Forbidden Edits

- no onion workflow redesign
- no broad telemetry schema redesign outside this bug
- no reopening of `coo-freeze-to-cto-admission-wiring`
- no implement-plan, review-cycle, or merge-queue product changes
- no unrelated memory-engine or other slice edits

# 6. Integrity-Verified Assumptions Only

- current `main` builds cleanly for `C:/ADF/COO`
- commit `42bf725a04c96f0b89fcf1a1e591cff0f72d6abb` already removed the unsupported top-level `ctoAdmissionState` emitter field from the live telemetry sample block
- the nested `cto_admission_*` telemetry fields are the current truthful contract surface
- this slice can close as a docs-and-governance reconciliation pass unless verification disproves those facts

# 7. Explicit Non-Goals

- no new CTO-admission behavior
- no new status surface work
- no benchmark harness work
- no speculative cleanup outside the onion telemetry contract seam

# 8. Proof / Verification Expectations

Machine Verification Plan:
- `npm.cmd run build` in `C:/ADF/COO`
- `npx.cmd tsx --test cto-admission/live-handoff.test.ts requirements-gathering/live/onion-live.test.ts controller/thread.test.ts requirements-gathering/onion-lane.test.ts`
- `node --input-type=module -e "<assert the telemetry sample block does not contain a top-level ctoAdmissionState field>"`
- `git show 42bf725a04c96f0b89fcf1a1e591cff0f72d6abb -- COO/requirements-gathering/live/onion-live.ts`
- `git diff --check`

Human Verification Requirement: false

# 9. Required Artifact Updates

- `docs/phase1/coo-onion-telemetry-contract-fix/README.md`
- `docs/phase1/coo-onion-telemetry-contract-fix/context.md`
- `docs/phase1/coo-onion-telemetry-contract-fix/implement-plan-contract.md`
- `docs/phase1/coo-onion-telemetry-contract-fix/implement-plan-brief.md`
- `docs/phase1/coo-onion-telemetry-contract-fix/completion-summary.md`
- `docs/phase1/coo-onion-telemetry-contract-fix/implement-plan-state.json`
- `docs/phase1/coo-onion-telemetry-contract-fix/implement-plan-execution-contract.v1.json`

# 10. Closeout Rules

- Human testing is not required (`Required: false`)
- Review-cycle does not run unless current verification disproves the already-landed repair and forces a real implementation change
- The approved feature commit for merge-queue is the docs-only governed closeout commit on the feature branch, not the historical already-landed code commit
- `completion-summary.md` must state explicitly that the underlying COO code repair was already present on `main`
- Final completion happens only after merge-queue lands the docs-only closeout commit and implement-plan records merge truthfully
