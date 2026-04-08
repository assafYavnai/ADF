# Feature Context

## Feature

- phase_number: 1
- feature_slug: implement-plan-review-cycle-vision-master-plan-gating
- project_root: C:/ADF
- feature_root: C:/ADF/docs/phase1/implement-plan-review-cycle-vision-master-plan-gating
- current_branch: main

## Task Summary

Upgrade the repo-owned `implement-plan` and `review-cycle` workflows so every implementation slice must explicitly prove compatibility with the ADF vision, Phase 1 vision, Phase 1 master plan, and current Phase 1 gap-closure plan before implementation can start or review can close.

## Scope Hint

Focus on repo-owned workflow governance only: `skills/implement-plan/**`, `skills/review-cycle/**`, and this feature root. Add deterministic plan-time gating where helpers already own integrity checking, add explicit compatibility-verdict requirements to review outputs, and keep reports human-facing and easy to scan. Do not widen into COO runtime work or unrelated workflow redesign.

## Non-Goals

Do not change COO runtime/product routes, merge-queue behavior, dashboard/reporting UI, memory-engine behavior, or later-company planning beyond what is needed to block non-aligned work from entering the active Phase 1 implementation lane.

## Discovered Authorities

- [feature-readme] C:/ADF/docs/phase1/implement-plan-review-cycle-vision-master-plan-gating/README.md
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
- [skill-doc] C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs

## Notes

- This is a meta-governance slice for repo-owned workflow skills.
- The default branch of `assafYavnai/ADF` is `main`; treat any request phrased as “master” as `main` for this repository.
- Human verification is required because this slice changes the rules future slices use to decide whether work fits the active company mission and phase. It should not self-certify without explicit CEO approval.
