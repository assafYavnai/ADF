# Feature Context

## Feature

- phase_number: 1
- feature_slug: implement-plan-benchmark-worktree-stabilization
- project_root: C:/ADF
- feature_root: C:/ADF/docs/phase1/implement-plan-benchmark-worktree-stabilization
- current_branch: main

## Task Summary

Stabilize the implement-plan benchmark harness so isolated worktree lanes prewarm runtime dependencies, force-close hung provider executions, classify blockers truthfully, and keep the benchmark test suite green.

## Scope Hint

Keep the fix inside `tests/implement-plan-benchmark/**`, `shared/llm-invoker/**`, and the phase-1 documentation needed to explain the new benchmark behavior.

## Non-Goals

Do not redesign provider selection, change merge policy, or broaden this into general workflow changes outside the benchmark harness and its direct process/runtime dependencies.

## Discovered Authorities

- [project-doc] C:/ADF/AGENTS.md
- [project-doc] C:/ADF/docs/bootstrap/cli-agent.md
- [feature-doc] C:/ADF/docs/phase1/coo-freeze-to-cto-admission-wiring/README.md
- [feature-doc] C:/ADF/docs/phase1/coo-live-executive-status-wiring/README.md
- [repo-doc] C:/ADF/tests/implement-plan-benchmark/README.md
- [repo-code] C:/ADF/tests/implement-plan-benchmark/harness.ts
- [repo-code] C:/ADF/tests/implement-plan-benchmark/suite.ts
- [repo-code] C:/ADF/shared/llm-invoker/managed-process.ts

## Notes

- The benchmark run failure came from isolated worktrees lacking built/runtime artifacts, not from a broken main workspace.
- The runtime preflight in `C:/ADF` passes; the stabilization work is specific to detached benchmark worktrees and benchmark closeout resilience.
- Brain MCP route artifacts are present according to runtime preflight, but the `project-brain` MCP tool surface is not exposed in this Codex runtime, so repo-backed authority files are used.
