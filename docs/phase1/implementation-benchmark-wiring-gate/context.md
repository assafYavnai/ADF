# Feature Context

## Feature

- phase_number: 1
- feature_slug: implementation-benchmark-wiring-gate
- project_root: C:/ADF
- feature_root: C:/ADF/docs/phase1/implementation-benchmark-wiring-gate
- current_branch: main

## Task Summary

Implement Spec 3: create the wiring and compatibility gate that proves Spec 1 and Spec 2 speak the same contract, preserve the same runtime semantics, and can be integrated without hidden bridge logic.

## Scope Hint

A narrow compatibility/validation layer plus the feature artifacts needed to drive governed implementation and fail-closed dry-run checks.

## Non-Goals

- Repairing missing Spec 1 or Spec 2 behavior inside Spec 3
- Hidden compatibility shims
- Partial wiring or partial merge on failed compatibility
- Creating another worker or supervisor runtime

## Discovered Authorities

- [feature-readme] C:/ADF/docs/phase1/implementation-benchmark-wiring-gate/README.md
- [feature-contract] C:/ADF/docs/phase1/implementation-benchmark-wiring-gate/implement-plan-contract.md
- [project-doc] C:/ADF/docs/phase1/implement-plan-provider-neutral-run-contract/implement-plan-contract.md
- [project-doc] C:/ADF/docs/phase1/implementation-benchmarking-supervisor-skill/implement-plan-contract.md
- [skill-doc] C:/ADF/skills/implement-plan/SKILL.md
- [skill-doc] C:/ADF/skills/implement-plan/references/workflow-contract.md
- [skill-doc] C:/ADF/skills/review-cycle/SKILL.md
- [skill-doc] C:/ADF/skills/merge-queue/SKILL.md
- [runtime] C:/ADF/skills/governed-feature-runtime.mjs

## Notes

- This context file was created manually to unblock Spec 3 readiness after the feature root was found missing in the repo.
- Spec 3 must execute through implement-plan rather than direct source implementation by the coordinating agent.
