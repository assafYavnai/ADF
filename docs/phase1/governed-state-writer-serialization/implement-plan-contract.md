1. Implementation Objective

Create one shared governed state-writer utility for Phase 1 workflow runtime state so `implement-plan` and `review-cycle` stop doing unsafe same-feature whole-file state writes directly. The utility must provide feature-scoped handles, FIFO serialization, atomic writes, durable write audit metadata, and governance-visible blocking semantics for critical writes.

2. Slice Scope

- Shared workflow-runtime utility for governed feature-state writes
- `C:/ADF/skills/governed-feature-runtime.mjs` or the smallest equivalent shared utility module
- `C:/ADF/skills/implement-plan/**` only where feature-scoped governed state writes must route through the shared utility
- `C:/ADF/skills/review-cycle/**` only where feature-scoped governed state writes must route through the shared utility
- tightly scoped tests and proof for serialization, atomicity, blocking behavior, and recovery
- `docs/phase1/governed-state-writer-serialization/**`

3. Required Deliverables

- shared governed state-writer utility
- feature-scoped writer handle contract for workflow helpers
- critical-write barrier behavior for `implement-plan` and `review-cycle`
- durable local write audit metadata such as revision/write ID and timestamp
- conservative recovery behavior for interrupted or malformed state writes
- proof/tests for same-feature contention, cross-feature isolation, failed critical writes, and recovery
- updated slice docs and any touched workflow-runtime contract docs

4. Allowed Edits

- `C:/ADF/skills/governed-feature-runtime.mjs`
- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/review-cycle/**`
- tightly scoped supporting tests for the above
- `C:/ADF/docs/phase1/governed-state-writer-serialization/**`
- any directly affected workflow-runtime contract docs that must stay truthful

5. Forbidden Edits

- no COO product-surface redesign
- no Brain redesign
- no merge-queue redesign unless a minimal adapter is strictly required by the shared utility contract
- no generic repo-wide scheduler or daemon
- no per-slice duplicated writer implementation
- no second canonical company database
- no unrelated refactors in other Phase 1 slices

6. Acceptance Gates

KPI Applicability: required
KPI Route / Touched Path: governed workflow-state write path for feature-local runtime state used by `implement-plan` and `review-cycle`
KPI Raw-Truth Source: writer audit metadata, helper state transitions, contention/recovery tests, and helper/runtime smoke evidence
KPI Coverage / Proof: deterministic same-feature contention proof, failed-critical-write hard-stop proof, cross-feature isolation proof, and conservative recovery proof on the shared utility route
KPI Production / Proof Partition: production path is the shared writer used by governed workflow helpers; proof path uses isolated test roots with the same writer implementation and helper/runtime smoke against the real helper routes
KPI Non-Applicability Rationale: Not used because KPI Applicability is required for this workflow-runtime slice
KPI Exception Owner: Not used because KPI Applicability is required and no temporary exception is approved
KPI Exception Expiry: Not used because KPI Applicability is required and no temporary exception is approved
KPI Exception Production Status: Not used because KPI Applicability is required and no temporary exception is approved
KPI Compensating Control: Not used because KPI Applicability is required and no temporary exception is approved
Vision Compatibility: Compatible. This strengthens truthful governed execution instead of widening into later-company autonomy.
Phase 1 Compatibility: Compatible. The slice is a bounded workflow-runtime reliability fix for active Phase 1 governance paths.
Master-Plan Compatibility: Compatible. It improves the company's ability to execute governed work reliably without adding a second truth system.
Current Gap-Closure Compatibility: Compatible. It supports the active Phase 1 governed implementation/review route by preventing state corruption and false progress.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: The defect is already live in Phase 1 workflow state. A shared per-feature serialized writer is the smallest bounded fix that closes the failure class without widening into later-phase autonomous infrastructure.
Machine Verification Plan: run deterministic same-feature contention tests, cross-feature isolation tests, failed critical-write hard-stop tests, interrupted-write recovery tests, and helper smoke for `implement-plan` plus `review-cycle` on the shared writer route.
Human Verification Plan: Required: false. This is a governed workflow-runtime reliability slice. Closure should rely on deterministic proof, helper smoke, and truthful state recovery evidence rather than a separate human UX test pass.

7. Observability / Audit

- The shared writer must make write outcomes visible as `pending`, `committed`, or `failed` for critical governed writes
- Applied writes must carry durable local audit metadata such as revision/write ID and timestamp
- Review-cycle status, machine verification status, and human verification status must remain truthful in slice artifacts
- Worktree path and merge state must remain truthful, but this slice does not claim merge completion during prepare

8. Dependencies / Constraints

- Must respect existing governed workflow route contracts
- Must preserve per-feature isolation
- Must not rely on one giant repo-global queue
- Must not require a background daemon
- Must be additive and bounded

9. Non-Goals

- redesigning Brain durability
- redesigning merge-queue
- redesigning the COO executive status surface
- adding a generic trust platform
- adding git commits per state write

10. Source Authorities

- `C:/ADF/AGENTS.md`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`
- `C:/ADF/.codex/implement-plan/worktrees/phase1/governed-state-writer-serialization/docs/phase1/governed-state-writer-serialization/README.md`
- `C:/ADF/.codex/implement-plan/worktrees/phase1/governed-state-writer-serialization/docs/phase1/governed-state-writer-serialization/context.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/references/prompt-templates.md`
