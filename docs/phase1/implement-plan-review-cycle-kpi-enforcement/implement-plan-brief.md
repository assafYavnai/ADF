1. Implementation Objective

Make KPI support an explicit workflow gate in `implement-plan` and `review-cycle`, and keep workflow reports human-facing and easy to scan.

2. Exact Slice Scope

- Repo-owned `implement-plan` contracts, prompts, and helper validation.
- Repo-owned `review-cycle` contracts and prompts, plus helper-facing changes only where the helper already owns state/status behavior.
- Feature artifacts under [implement-plan-review-cycle-kpi-enforcement](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement).

3. Inputs / Authorities Read

- [README.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/README.md)
- [context.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/context.md)
- [implement-plan-contract.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/implement-plan-contract.md)
- [kpi-instrumentation-requirement.md](/C:/ADF/docs/v0/kpi-instrumentation-requirement.md)
- [2026-04-03-human-facing-reporting-rule.md](/C:/ADF/docs/v0/context/2026-04-03-human-facing-reporting-rule.md)
- [context.md](/C:/ADF/docs/phase1/coo-kpi-instrumentation/context.md)
- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
- [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs)
- [SKILL.md](/C:/ADF/skills/review-cycle/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/review-cycle/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/review-cycle/references/prompt-templates.md)

4. Required Deliverables

- Hard `implement-plan` integrity gating for KPI applicability and KPI contract completeness.
- Explicit workflow language for approved temporary KPI exceptions.
- `review-cycle` prompt/contract changes that force explicit KPI closure judgment.
- Human-facing report-quality language for these workflow outputs.
- Updated feature artifacts and truthful completion reporting.

5. Forbidden Edits

- Do not widen into product telemetry implementation.
- Do not weaken existing route-proof, split-verdict, or closeout semantics.
- Do not add broad abstractions or new artifact families.
- Do not claim semantic helper enforcement where only prompt/template enforcement exists.

6. Integrity-Verified Assumptions Only

- The KPI rule is already locked governance and says missing KPI coverage is production-blocking.
- Current `implement-plan` helper integrity checks are generic and do not yet hard-stop missing KPI applicability or missing KPI contract details.
- Current `review-cycle` prompts strongly enforce route proof but do not yet require an explicit KPI closure verdict.
- This meta-governance slice can truthfully declare `KPI Applicability: not required` because it does not introduce or change a product/runtime route that needs new KPI telemetry instrumentation.
- Current workflow output contracts are already structured, so human-facing reporting improvements should stay additive and minimal.

7. Explicit Non-Goals

- No COO runtime KPI code changes.
- No dashboard or reporting product work.
- No broad review-cycle redesign.
- No merge-queue redesign beyond normal feature closeout.

8. Proof / Verification Expectations

- `node --check` for modified helper/script files.
- `implement-plan-helper.mjs prepare` negative and positive smoke checks for KPI gating.
- `review-cycle-helper.mjs prepare` smoke checks only if helper-visible status text changes.
- Skill-install refresh if source changes materially.
- Machine Verification Plan:
  - `node --check` on modified helper and script files
  - targeted helper smoke checks for KPI gating branches
  - targeted smoke checks for report-quality / verdict-shape artifacts where materially changed
- Human Verification Plan:
  - Required: false
  - reason: this is internal workflow/governance work, not a separate human-facing product route

9. Required Artifact Updates

- [implement-plan-contract.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/implement-plan-contract.md)
- [implement-plan-brief.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/implement-plan-brief.md)
- [implement-plan-state.json](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/implement-plan-state.json)
- [completion-summary.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/completion-summary.md)
- Modified repo-owned skill contracts, prompts, helpers, and any refreshed installed skill copies

10. Closeout Rules

- Keep the slice bounded to KPI gating and workflow report readability.
- Run machine verification before review handoff.
- Use `review-cycle` with `until_complete=true` after implementation because the slice changes workflow-closure logic.
- Commit and push feature-branch changes before merge-queue handoff.
- Do not mark the feature complete until review closure and merge-queue closeout succeed truthfully.
