# Feature Context

## Feature

- phase_number: 1
- feature_slug: implement-plan-provider-neutral-run-contract
- project_root: C:/ADF
- feature_root: C:/ADF/docs/phase1/implement-plan-provider-neutral-run-contract
- current_branch: main

## Task Summary

Implement Spec 1 for `implement-plan`: one versioned JSON-first execution contract shared by `prepare` and `run`, normal and benchmarking run modes, provider-neutral worker selection, durable resumable state, explicit reset semantics, lane-safe identity, push-capable eventing, and production KPI capture.

## Scope Hint

Keep normal mode as the governed production route. Add only the shared substrate needed for later benchmark supervision. Preserve merge-ready versus completed truth, resume after interruption, and review-cycle / merge-queue route integrity.

## Non-Goals

Do not build the benchmark supervisor, matrix execution, suite/lane stop commands, or a benchmark-only scoring layer. Do not implement Spec 2 or Spec 3 in this slice.

## Discovered Authorities

- [project-doc] C:/ADF/docs/VISION.md
- [project-doc] C:/ADF/docs/PHASE1_VISION.md
- [project-doc] C:/ADF/docs/PHASE1_MASTER_PLAN.md
- [project-doc] C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md
- [skill-doc] C:/ADF/skills/implement-plan/SKILL.md
- [skill-doc] C:/ADF/skills/implement-plan/references/workflow-contract.md
- [skill-doc] C:/ADF/skills/implement-plan/references/prompt-templates.md
- [skill-doc] C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs
- [skill-doc] C:/ADF/skills/review-cycle/SKILL.md
- [skill-doc] C:/ADF/skills/review-cycle/references/workflow-contract.md
- [skill-doc] C:/ADF/skills/review-cycle/references/prompt-templates.md
- [skill-doc] C:/ADF/skills/merge-queue/SKILL.md
- [skill-doc] C:/ADF/skills/governed-feature-runtime.mjs

## Notes

- Runtime preflight is authoritative: host OS is Windows, the workflow shell is bash, and the control-plane entrypoint is `adf.cmd`.
- Brain capture is required by repo policy, but the Brain MCP tool surface is not exposed in this Codex runtime. Durable decisions for this slice are therefore captured in repo-backed feature artifacts.
- Review-cycle authority was first aligned to merge commit `9839399` before continuing this implementation pass.
- Durable design decisions in this slice:
  - the stable feature-root contract file is `implement-plan-execution-contract.v1.json`
  - each run also keeps its own run-scoped contract snapshot plus `run-projection.v1.json`
  - append-only attempt event files under `implementation-run/<run-id>/events/<attempt-id>/` are the durable mutation log
  - `implement-plan-state.json` remains the compatibility projection, not the only execution truth
