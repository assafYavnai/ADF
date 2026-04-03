# Feature Context

## Feature

- phase_number: 1
- feature_slug: implement-plan-review-cycle-kpi-enforcement
- project_root: C:/ADF
- feature_root: C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement
- current_branch: implement-plan/phase1/implement-plan-review-cycle-kpi-enforcement

## Task Summary

Enforce the system-wide KPI instrumentation rule across `implement-plan` and `review-cycle` so applicable implementation slices cannot close without explicit KPI coverage, KPI proof, or an approved time-bounded exception.

## Scope Hint

Tighten `implement-plan` and `review-cycle` contracts, prompt templates, helper validation, and closeout reporting so KPI applicability, KPI contract freezing, KPI closure verdicts, and temporary exception handling become explicit workflow gates instead of soft guidance.

## Non-Goals

Do not widen into COO runtime KPI route changes, dashboard/reporting UI, or unrelated workflow redesign outside KPI gating and human-facing report quality for these skills.

## Discovered Authorities

- [project-doc] C:/ADF/docs/v0/kpi-instrumentation-requirement.md
- [project-doc] C:/ADF/docs/v0/context/2026-04-03-human-facing-reporting-rule.md
- [project-doc] C:/ADF/docs/phase1/coo-kpi-instrumentation/context.md
- [skill-doc] C:/ADF/skills/implement-plan/SKILL.md
- [skill-doc] C:/ADF/skills/implement-plan/references/workflow-contract.md
- [skill-doc] C:/ADF/skills/implement-plan/references/prompt-templates.md
- [skill-doc] C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs
- [skill-doc] C:/ADF/skills/review-cycle/SKILL.md
- [skill-doc] C:/ADF/skills/review-cycle/references/workflow-contract.md
- [skill-doc] C:/ADF/skills/review-cycle/references/prompt-templates.md

## Notes

- This slice is meta-governance work for repo-owned skills.
- Brain route artifacts are present according to runtime preflight, but the `project-brain` MCP tool surface is not exposed in this Codex runtime, so repo-backed authority files are used when Brain capture is required.
