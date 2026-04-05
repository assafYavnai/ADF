1. Implementation Objective

Restore a build-clean COO runtime by fixing the onion live telemetry contract drift around CTO-admission persistence fields without changing the intended freeze-to-admission behavior.

2. Slice Scope

- `COO/requirements-gathering/live/**` for the live onion telemetry and persistence path
- `COO/requirements-gathering/contracts/**` for the declared telemetry and persistence contract shape
- `COO/cto-admission/**` only if a minimal additive contract alignment is strictly required
- tightly scoped tests for the onion and CTO-admission handoff path
- `docs/phase1/coo-onion-telemetry-contract-fix/**` for contract, context, and completion artifacts

3. Required Deliverables

- one truthful telemetry and persistence contract shape for the onion live handoff path
- a clean `COO` build on current `main` semantics
- targeted tests or proof updates if needed
- `context.md`
- `completion-summary.md`

4. Allowed Edits

- `C:/ADF/COO/requirements-gathering/live/**`
- `C:/ADF/COO/requirements-gathering/contracts/**`
- `C:/ADF/COO/cto-admission/**` only if a minimal additive contract alignment is strictly required
- tightly scoped tests for the onion and CTO-admission handoff path
- `C:/ADF/docs/phase1/coo-onion-telemetry-contract-fix/**`

5. Forbidden Edits

- no onion workflow redesign
- no broad telemetry schema redesign outside this bug
- no implement-plan, review-cycle, or merge-queue changes
- no unrelated memory-engine changes
- no edits to other slice folders

6. Acceptance Gates

1. `npm.cmd run build` under `C:/ADF/COO` passes.
2. The onion live telemetry path no longer emits unsupported top-level fields.
3. CTO-admission persistence fields remain visible in the correct nested location.
4. Targeted onion and CTO-admission proof remains truthful.

## KPI Applicability

KPI Applicability: not required
KPI Non-Applicability Rationale: This slice repairs a build-breaking telemetry contract mismatch without adding or changing a production KPI route.

## Vision / Phase 1 / Master-Plan / Gap-Closure Compatibility

Vision Compatibility: Restores truthful implementation health on a core COO path by eliminating a build-breaking contract drift.
Phase 1 Compatibility: This is bounded stabilization of the existing requirements-to-admission path, not a later-company expansion.
Master-Plan Compatibility: Keeps the current implementation lane buildable and preserves the already-merged freeze-to-admission semantics.
Current Gap-Closure Compatibility: Supports Gap B by restoring build cleanliness on the live CTO-admission seam that already exists in code.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: The freeze-to-admission seam exists and tests pass, but current `main` still fails the `COO` build because the live telemetry emitter drifted from the declared contract. This slice repairs that regression without widening scope.

## Machine Verification Plan

- run `npm.cmd run build` in `C:/ADF/COO`
- run targeted tests for the onion and CTO-admission handoff path
- run `git diff --check` on the changed source set

## Human Verification Plan

- Required: false
- Reason: this is a bounded build-contract repair and does not change a human-facing surface

7. Observability / Audit

- the emitted telemetry and the declared contract must describe the same persistence shape
- any targeted proof updates must show the corrected field location truthfully
- build cleanliness is the primary release gate for this slice

8. Dependencies / Constraints

- preserve the current freeze-to-admission behavior
- keep the fix inside the telemetry and persistence contract boundary
- prefer the smallest truthful contract repair that restores build cleanliness

9. Non-Goals

- no new CTO-admission behavior
- no new status surface work
- no benchmark harness work
- no unrelated onion feature work

10. Source Authorities

- `C:/ADF/docs/phase1/coo-onion-telemetry-contract-fix/README.md`
- `C:/ADF/docs/phase1/coo-onion-telemetry-contract-fix/context.md`
- `C:/ADF/docs/phase1/coo-freeze-to-cto-admission-wiring/completion-summary.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`

11. Implementor Defaults

- Preferred Worker Provider: `claude`
- Preferred Worker Runtime: `claude_code_exec`
- Preferred Worker Access Mode: `claude_code_skip_permissions`
- Preferred Worker Model: `claude-opus-4-6`
- Preferred Implementor Model: `claude-opus-4-6`
- Preferred Throttle: `max`
- Preferred Reasoning Effort: not separately configured for this Claude route

12. Closeout Rules

- run machine verification before review handoff
- use review-cycle after implementation
- keep the slice tightly bounded to the contract repair
- do not mark complete until review closure and merge-queue closeout succeed truthfully
