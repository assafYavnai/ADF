# Feature Context

## Feature

- phase_number: 1
- feature_slug: governed-implementation-route-hardening
- project_root: C:/ADF
- feature_root: C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/docs/phase1/governed-implementation-route-hardening
- worktree_path: C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening
- base_branch: main
- feature_branch: implement-plan/phase1/governed-implementation-route-hardening
- current_branch: implement-plan/phase1/governed-implementation-route-hardening

## Task Summary

Harden the governed implementation route by fixing review-cycle implementor continuity and reopen guardrails, merge-queue blocked-merge resume flow, implement-plan stale closeout validation, requirement-freeze integrity checks, stronger CLI bash invocation examples, and main-branch terminology sources.

## Scope Hint

Bound this slice to governed workflow skills, helper scripts, authoritative bootstrap docs, active templates, and required tests or docs. Keep historical artifacts and unrelated product surfaces out of scope.

## Non-Goals

- no product-runtime feature work
- no Brain surface redesign
- no unrelated COO features
- no manual merge-worktree fallback as the intended product behavior
- no historical artifact rewrite beyond active authoritative sources

## Primary Authorities

- `C:/ADF/AGENTS.md`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`
- `C:/ADF/skills/review-cycle/SKILL.md`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/SKILL.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
- `C:/ADF/skills/implement-plan/SKILL.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/completion-summary.md`
- `C:/ADF/docs/phase1/approved-commit-closeout-state-separation/README.md`
- `C:/ADF/docs/phase1/review-cycle-setup-merge-safety/README.md`
- `C:/ADF/docs/phase1/governed-merge-closeout-chain-hardening/README.md`

## Initial Design Notes

- The feature must improve both policy sources and helper enforcement. Documentation-only cleanup is not sufficient.
- The feature should preserve the existing governed route shape instead of widening it into a new workflow design.
- The branch-language normalization should target live authoritative docs and templates first, not churn frozen historical evidence.
- A baseline contract commit should be pushed on the feature branch before the implementation worker starts.

## Runtime Notes

- Runtime preflight on 2026-04-06 reported `workflow_shell=bash`, `execution_shell=bash`, and `control_plane.entrypoint=adf.sh`.
- Runtime preflight also reported sibling worker CLIs available through `llm_tools`, including `claude --dangerously-skip-permissions` and `codex exec --full-auto --dangerously-auto-approve`.
- The repo bootstrap requires Brain MCP loading, but this Codex runtime does not expose `mcp__project-brain__*` tools. That is being treated as a runtime defect, not as license to invent a fake Brain path.

## Notes

- The first auto-generated prepare pass created the worktree successfully but left an integrity-failed stub, as expected before the slice contract was normalized.
- The contract source must be frozen on the feature branch before worker implementation begins.
