# implement-plan-benchmark-worktree-stabilization - Context

## Purpose
Make benchmark lane results trustworthy enough to compare active and near-launch slices without confusing harness failures for product failures.

## Why It Exists

- recent benchmark lanes failed because isolated worktrees lacked runtime artifacts or used stale invocation assumptions
- timeout and closeout behavior was not strong enough to prevent misleading or hanging suite results
- active launch-facing slices need cleaner provider-comparison evidence than the current harness can produce

## Key Constraints

- keep the scope inside benchmark harness and direct process/runtime dependencies
- do not widen into provider recommendation policy
- keep blocker classification truthful and conservative
- preserve enough artifact detail to explain why a lane failed

## Priority Targets

- `coo-live-executive-status-wiring`
- `coo-freeze-to-cto-admission-wiring`
- any future launch-facing slice benchmarked through the same harness
