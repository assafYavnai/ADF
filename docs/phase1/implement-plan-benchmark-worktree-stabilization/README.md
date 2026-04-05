# implement-plan-benchmark-worktree-stabilization

## Target Local Folder
C:/ADF/docs/phase1/implement-plan-benchmark-worktree-stabilization/README.md

## Feature Goal
Stabilize the `tests/implement-plan-benchmark` harness so isolated benchmark lanes inherit a runnable ADF runtime, hung provider executions cannot stall suite closeout, and blocker reporting stays truthful enough to compare active and near-launch slices cleanly.

## Why This Slice Exists Now

- recent benchmark runs for active slices produced blocked lanes and exhausted cycles because isolated lane worktrees did not consistently inherit runnable ADF runtime state
- some lane failures were harness and invocation failures, not product failures
- current benchmark evidence is therefore not trustworthy enough to compare providers cleanly for launch-facing slices

## Requested Scope

Tighten the benchmark harness, provider invocation path, and harness tests so detached git worktrees are prewarmed with required runtime artifacts, provider/model failures are classified conservatively, and benchmark closeout cannot hang indefinitely.

This slice must:

- prewarm isolated benchmark worktrees with the runtime artifacts and entrypoint assumptions they actually need
- use authoritative provider invocation flags from current runtime truth rather than stale lane-local copies
- force-close hung provider executions and report the timeout truthfully
- distinguish harness/setup failures from provider failures from product-code failures
- keep summary and lane artifacts truthful enough for cross-provider comparison
- cover currently active and near-launch slices, especially the live COO status and CTO-admission paths

## Allowed Edits

- `tests/implement-plan-benchmark/**`
- `shared/llm-invoker/**`
- tightly scoped helper/runtime files needed to prewarm lane worktrees or classify lane failures truthfully
- `docs/phase1/implement-plan-benchmark-worktree-stabilization/**`

## Forbidden Edits

- no new benchmark product features
- no provider recommendation policy changes
- no merge strategy changes
- no unrelated implement-plan, review-cycle, or merge-queue redesign
- no broad COO runtime redesign outside the benchmark harness contract

## Required Deliverables

- benchmark harness fixes for worktree prewarming and command construction truth
- bounded timeout/closeout behavior for hung provider executions
- truthful lane classification for setup failure, provider failure, blocked product state, and max-cycles exhaustion
- targeted harness tests that prove the new guarantees
- context.md
- implement-plan-contract.md
- completion-summary.md

## Truth Rules

- a benchmark lane must not be reported as a product failure when the real defect is harness setup or invocation
- a benchmark lane must not hang forever waiting for a provider process that can be force-closed safely
- lane summaries must preserve the real blocker class and the command/runtime facts that explain it
- active slices should remain comparable even when one provider lane fails for harness reasons

## Acceptance Gates

- isolated benchmark worktrees inherit a runnable ADF runtime and entrypoint path
- a hung provider execution cannot stall whole-suite closeout indefinitely
- lane summaries distinguish harness/setup failure, provider failure, blocked product state, and max-cycles exhaustion
- benchmark artifacts stay truthful for currently active and near-launch slices
- targeted tests prove the harness behavior

## Machine Verification Plan

- run targeted tests for `tests/implement-plan-benchmark/**`
- run targeted tests for any modified `shared/llm-invoker/**` helpers
- exercise a lane setup path that proves runtime prewarm behavior
- exercise timeout handling that proves forced-close and truthful classification
- validate summary artifact truth for at least one blocked lane and one harness-failure lane

## Human Verification Plan

- Required: false
- Reason: this slice is harness/runtime hardening, not a human-facing product surface

## Non-Goals

- no new benchmark features
- no provider recommendation policy
- no merge behavior changes
- no unrelated review-cycle or implement-plan redesign outside the benchmark harness stabilization path
