# Feature Context

## Feature

- phase_number: 1
- feature_slug: implement-plan-review-cycle-kpi-enforcement
- project_root: C:/ADF
- feature_root: C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement
- current_branch: implement-plan/phase1/implement-plan-review-cycle-kpi-enforcement

## Task Summary

Harden `implement-plan` and `merge-queue` so approved-commit freeze, queue recovery, canonical root handling, clean target sync, and human-facing closeout failures are deterministic and no longer depend on dirty tracked feature artifacts after approval.

## Scope Hint

Keep the slice bounded to repo-owned workflow authorities and helper code:

- `implement-plan` state/index behavior at merge-ready handoff
- `merge-queue` enqueue/process/retry/requeue behavior
- shared runtime helpers only where canonical-root inference or subprocess failure reporting are truly shared
- feature artifacts required to keep the slice truthful and human-facing

## Non-Goals

Do not widen into COO runtime KPI route changes, product telemetry work, or unrelated workflow redesign outside approved-commit handoff, merge-queue recovery, canonical roots, and truthful closeout reporting.

## Discovered Authorities

- [project-doc] C:/ADF/docs/v0/kpi-instrumentation-requirement.md
- [project-doc] C:/ADF/docs/v0/context/2026-04-03-human-facing-reporting-rule.md
- [project-doc] C:/ADF/docs/phase1/coo-kpi-instrumentation/context.md
- [skill-doc] C:/ADF/skills/implement-plan/SKILL.md
- [skill-doc] C:/ADF/skills/implement-plan/references/workflow-contract.md
- [skill-doc] C:/ADF/skills/implement-plan/references/prompt-templates.md
- [skill-doc] C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs
- [skill-doc] C:/ADF/skills/merge-queue/SKILL.md
- [skill-doc] C:/ADF/skills/merge-queue/references/workflow-contract.md
- [skill-doc] C:/ADF/skills/merge-queue/references/prompt-templates.md
- [skill-doc] C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs
- [skill-doc] C:/ADF/skills/governed-feature-runtime.mjs

## Notes

- This slice is meta-governance work for repo-owned skills.
- The current merged KPI slice proved that merge success and local root cleanliness must be separated because queue state recorded `local_target_sync_status=skipped_dirty_checkout` even though `origin/main` was correct.
- The current merge-queue helper still depends on tracked feature-state rewrites after enqueue or merge, which is the main source of the local dirty-state regression being fixed here.
- Brain route artifacts are present according to runtime preflight, but the `project-brain` MCP tool surface is not exposed in this Codex runtime, so repo-backed authority files are used when Brain capture is required.
