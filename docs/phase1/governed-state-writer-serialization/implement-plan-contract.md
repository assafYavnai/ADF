1. Implementation Objective

Introduce one shared governed state-writer utility for Phase 1 workflow runtime state so feature-scoped helpers stop doing unsafe whole-file read-modify-write updates directly.

2. Slice Scope

- `skills/governed-feature-runtime.mjs` for the shared feature-scoped state-writer utility
- `skills/implement-plan/**` for integration with the shared writer
- `skills/review-cycle/**` for integration with the shared writer
- tightly scoped tests for the governed writer and its helper integrations
- `docs/phase1/governed-state-writer-serialization/**` for contract, context, and completion artifacts

3. Required Deliverables

- one shared governed state-writer utility with feature-scoped serialization
- `implement-plan` integration
- `review-cycle` integration
- targeted proof for:
  - same-feature contention
  - cross-feature isolation
  - fail-closed malformed-state handling
- `context.md`
- `completion-summary.md`

4. Allowed Edits

- `C:/ADF/skills/governed-feature-runtime.mjs`
- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/review-cycle/**`
- tightly scoped tests for the governed writer and its helper integrations
- `C:/ADF/docs/phase1/governed-state-writer-serialization/**`

5. Forbidden Edits

- no broad Brain durability redesign
- no merge-queue redesign unless a minimal touch is strictly required by the shared writer contract
- no second canonical company database
- no background daemon or scheduler
- no unrelated COO runtime work

6. Acceptance Gates

1. Two near-parallel critical writes for the same feature do not corrupt state.
2. Helpers for the same feature cannot advance past an uncommitted critical write.
3. A failed critical write hard-stops the governed route truthfully.
4. Per-feature isolation is preserved.
5. Active malformed state does not silently reset to defaults.

## KPI Applicability

KPI Applicability: not required
KPI Non-Applicability Rationale: This slice hardens workflow-runtime state durability and does not add or modify a production KPI route.

## Vision / Phase 1 / Master-Plan / Gap-Closure Compatibility

Vision Compatibility: Strengthens durable governed execution by making feature-local state writes serialized, atomic, and fail-closed.
Phase 1 Compatibility: This is direct Phase 1 workflow-runtime hardening for the active implementation and review route.
Master-Plan Compatibility: Improves the reliability of the governed feature-delivery chain without widening into unrelated company functions.
Current Gap-Closure Compatibility: Directly closes Gap D by fixing the shared parallel-state safety hole instead of leaving `review-cycle` and related helpers on unsafe whole-file writes.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: Current `review-cycle` behavior can truncate state and silently reinitialize after parse failure, and the underlying defect is shared workflow-state mutation logic rather than one isolated slice bug. This slice creates the shared durability contract the gap plan still lacks.

## Machine Verification Plan

- run targeted tests for the shared writer utility
- run targeted tests for `implement-plan` integration
- run targeted tests for `review-cycle` integration
- prove same-feature contention handling, cross-feature isolation, and malformed-state fail-closed behavior
- run `git diff --check` on the changed source set

## Human Verification Plan

- Required: false
- Reason: this is workflow-runtime hardening and can be proven through deterministic machine verification

7. Observability / Audit

- the writer must expose enough metadata to distinguish `pending`, `committed`, and `failed` write outcomes
- critical workflow steps must not advance before the writer reports a committed state transition
- malformed-state handling must surface explicit failure instead of silent reinitialization

8. Dependencies / Constraints

- one shared writer utility, not per-slice copies
- feature-scoped serialization, not one global queue
- fail closed on malformed active state
- preserve cross-feature independence
- do not weaken existing worktree-first artifact isolation

9. Non-Goals

- no Brain schema redesign
- no queue or benchmark harness work
- no executive-status surface work
- no full repo-wide mutable-state architecture migration

10. Source Authorities

- `C:/ADF/docs/phase1/governed-state-writer-serialization/README.md`
- `C:/ADF/docs/phase1/governed-state-writer-serialization/context.md`
- `C:/ADF/docs/phase1/review-cycle-setup-merge-safety/README.md`
- `C:/ADF/docs/phase1/implement-plan-worktree-artifact-isolation/implement-plan-contract.md`
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
- keep contention and fail-closed proof explicit in closeout artifacts
- do not mark complete until review closure and merge-queue closeout succeed truthfully
