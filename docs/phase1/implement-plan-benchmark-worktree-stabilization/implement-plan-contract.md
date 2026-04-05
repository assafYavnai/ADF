1. Implementation Objective

Stabilize the `tests/implement-plan-benchmark` harness so isolated benchmark lanes inherit a runnable ADF runtime, hung provider executions cannot stall suite closeout, and blocker reporting stays truthful enough to compare active and near-launch slices cleanly.

2. Slice Scope

- `tests/implement-plan-benchmark/**` for worktree preparation, lane execution, lane closeout, and summary truth
- `shared/llm-invoker/**` only where provider process management or invocation classification must change to support truthful benchmark execution
- tightly scoped helper/runtime files only where needed to prewarm benchmark worktrees with the correct runtime artifacts and entrypoint assumptions
- targeted tests for the benchmark harness and any touched shared process-management helpers
- `docs/phase1/implement-plan-benchmark-worktree-stabilization/**` for contract, context, and completion artifacts

3. Required Deliverables

- benchmark harness fixes that prewarm isolated lane worktrees with the runtime artifacts and entrypoint assumptions they actually need
- authoritative provider invocation and classification that stays aligned with current runtime truth
- bounded timeout and forced-close handling for hung provider executions
- truthful lane classification for:
  - harness/setup failure
  - provider failure
  - blocked product state
  - max-cycles exhaustion
- targeted harness tests that prove the new guarantees
- `context.md`
- `completion-summary.md`

4. Allowed Edits

- `C:/ADF/tests/implement-plan-benchmark/**`
- `C:/ADF/shared/llm-invoker/**`
- tightly scoped helper/runtime files needed to prewarm lane worktrees or classify lane failures truthfully
- `C:/ADF/docs/phase1/implement-plan-benchmark-worktree-stabilization/**`

5. Forbidden Edits

- no new benchmark product features
- no provider recommendation policy changes
- no merge strategy changes
- no unrelated implement-plan, review-cycle, or merge-queue redesign
- no broad COO runtime redesign outside the benchmark harness contract

6. Acceptance Gates

1. Isolated benchmark worktrees inherit a runnable ADF runtime and entrypoint path.
2. A hung provider execution cannot stall whole-suite closeout indefinitely.
3. Lane summaries distinguish harness/setup failure, provider failure, blocked product state, and max-cycles exhaustion.
4. Benchmark artifacts stay truthful for currently active and near-launch slices.
5. Targeted tests prove the harness behavior.

## KPI Applicability

KPI Applicability: not required
KPI Non-Applicability Rationale: This slice hardens benchmark and workflow harness behavior rather than introducing or modifying a production product route.

## Vision / Phase 1 / Master-Plan / Gap-Closure Compatibility

Vision Compatibility: Strengthens truthful governed execution by making benchmark evidence explainable instead of silently mixing harness failures with product failures.
Phase 1 Compatibility: Supports the active implementation lane by improving the benchmark substrate used to compare providers on launch-facing Phase 1 slices.
Master-Plan Compatibility: Keeps the work inside the governed implementation path and improves the truthfulness of implementation benchmarking rather than adding new company functions.
Current Gap-Closure Compatibility: Addresses the benchmark and provider-neutral reliability weakness that currently clouds confidence in active gap-closure slices.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: Recent benchmark runs for active slices show blocked lanes and exhausted cycles that were partly caused by harness/runtime defects such as missing worktree runtime artifacts and stale invocation assumptions. This slice fixes the benchmark substrate so those slices can be evaluated cleanly.

## Machine Verification Plan

- run targeted tests for `tests/implement-plan-benchmark/**`
- run targeted tests for any modified `shared/llm-invoker/**` helpers
- exercise a lane setup path that proves runtime prewarm behavior
- exercise timeout handling that proves forced-close and truthful classification
- validate summary artifact truth for at least one blocked lane and one harness-failure lane
- run `git diff --check` on the changed source set

## Human Verification Plan

- Required: false
- Reason: this slice is harness/runtime hardening, not a human-facing product surface

7. Observability / Audit

- benchmark lane summaries must preserve the real blocker class and the command/runtime facts that explain it
- suite closeout must show whether a failure came from harness setup, provider invocation, blocked product state, or cycle exhaustion
- timeout-driven forced close must be recorded explicitly rather than inferred

8. Dependencies / Constraints

- keep the scope inside benchmark harness and direct process/runtime dependencies
- preserve the benchmark suite artifact structure unless a minimal change is required for truthful classification
- keep active and near-launch slices comparable even when one provider lane fails for harness reasons
- stay aligned with current runtime preflight and provider invocation truth

9. Non-Goals

- no new benchmark features
- no provider recommendation policy
- no merge behavior changes
- no unrelated review-cycle or implement-plan redesign outside the benchmark harness stabilization path

10. Source Authorities

- `C:/ADF/docs/phase1/implement-plan-benchmark-worktree-stabilization/README.md`
- `C:/ADF/docs/phase1/implement-plan-benchmark-worktree-stabilization/context.md`
- `C:/ADF/docs/phase1/coo-live-executive-status-wiring/README.md`
- `C:/ADF/docs/phase1/coo-freeze-to-cto-admission-wiring/completion-summary.md`
- `C:/ADF/tests/implement-plan-benchmark/README.md`
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
- keep lane-classification truth explicit in completion artifacts
- commit and push feature-branch changes before merge-queue handoff if the slice changes tracked source
- do not mark complete until review closure and merge-queue closeout succeed truthfully
