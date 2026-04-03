1. Implementation Objective

Upgrade the repo-owned `implement-plan` and `review-cycle` workflows so the system-wide KPI instrumentation rule becomes an explicit workflow gate instead of soft guidance. Applicable implementation slices must not close without a frozen KPI contract, KPI proof, or an approved temporary exception, and workflow reports must stay human-facing rather than dense blobs of text.

2. Slice Scope

- Strengthen repo-owned workflow authorities under [implement-plan](/C:/ADF/skills/implement-plan) so `prepare` and `run` treat KPI applicability and KPI closure as integrity-gate requirements.
- Strengthen repo-owned workflow authorities under [review-cycle](/C:/ADF/skills/review-cycle) so audit, review, and implementation passes explicitly freeze and judge KPI applicability, KPI closure proof, and exception handling.
- Keep the slice bounded to:
  - skill contracts
  - prompt templates
  - deterministic helper validation where the helper already owns validation
  - feature artifacts and supporting governance notes required to keep the workflow truthful
- Include the human-facing reporting rule only where it materially affects workflow reports produced by these skills.

3. Required Deliverables

- `implement-plan` workflow contract and prompt-template updates that require a KPI applicability decision for every slice.
- `implement-plan-helper.mjs` integrity enforcement that hard-stops slices when KPI applicability or required KPI contract details are missing, weak, or contradictory.
- `review-cycle` workflow and prompt updates that require:
  - KPI applicability to be frozen in `fix-plan.md`
  - KPI closure or exception state to be judged explicitly in auditor/reviewer reports
  - KPI proof or explicit remaining KPI gap to be named before closure
- Human-facing report-quality updates for these workflows so user-facing reports remain structured, concise, and easy to scan.
- Updated feature artifacts for this stream, including the normalized contract, brief, state, and completion summary.

4. Allowed Edits

- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
- [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs)
- [SKILL.md](/C:/ADF/skills/review-cycle/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/review-cycle/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/review-cycle/references/prompt-templates.md)
- Repo-owned skill install/update helpers only if needed to refresh generated installed copies after source changes
- This feature root under [implement-plan-review-cycle-kpi-enforcement](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement)
- Supporting governance notes under [docs/v0/context](/C:/ADF/docs/v0/context) only when required to keep the rule chain explicit

5. Forbidden Edits

- Do not widen into COO runtime KPI route changes or new product telemetry work.
- Do not redesign unrelated workflow engines beyond KPI gating and human-facing reporting quality for these two skills.
- Do not weaken exact heading contracts, split-verdict handling, resume/closeout truth, or merge-queue truth.
- Do not introduce a vague checklist that replaces deterministic or prompt-level enforcement already available in these workflows.
- Do not add a new workflow artifact type unless the existing contract, brief, fix-plan, and fix-report shapes cannot carry the requirement.

6. Acceptance Gates

KPI Applicability: not required
KPI Route / Touched Path: Not applicable.
KPI Raw-Truth Source: Not applicable.
KPI Coverage / Proof: Not applicable.
KPI Production / Proof Partition: Not applicable.
KPI Non-Applicability Rationale: This slice changes repo-owned workflow contracts, prompt templates, helper validation, and report formatting. It does not introduce or change a product/runtime route whose closure depends on new KPI telemetry instrumentation.
KPI Exception Owner: Not applicable.
KPI Exception Expiry: Not applicable.
KPI Exception Production Status: Not applicable.
KPI Compensating Control: Not applicable.

1. `implement-plan` requires an explicit KPI applicability decision before implementation may start.
2. When KPI is required, `implement-plan` integrity fails unless the normalized contract or equivalent authority set explicitly defines the route or touched path, the KPI raw-truth source, the KPI coverage/proof required, and the production/proof partition handling.
3. When KPI is not required, the contract must say why the slice is outside the KPI rule instead of silently omitting KPI discussion.
4. When a temporary KPI exception is used, the contract must include explicit owner, explicit expiry, explicit compensating control, and an explicit not-production-complete statement.
5. `review-cycle` route contracts and review outputs explicitly state whether KPI closure is `Closed`, `Partial`, `Open`, or covered by a valid temporary exception.
6. `review-cycle` rejects closure for applicable slices when KPI proof is missing, when proof does not match the claimed route, or when exception details are incomplete.
7. User-facing reports produced by these workflow contracts remain human-facing:
   - lead with the most important outcome
   - use short sections and concise bullets where appropriate
   - separate status, findings, and next actions
   - avoid dense wall-of-text output
8. The updated workflow stays truthful about what is actually enforced by helper validation versus what is enforced through prompt/template judgment.
9. Installed Codex skill output is refreshed if repo-owned source changes materially.

Machine Verification Plan
- Run `node --check` on modified helper and script files.
- Run targeted `implement-plan-helper.mjs prepare` smoke checks that prove:
  - missing KPI contract details fail for a KPI-required slice
  - a valid KPI-required contract passes integrity
  - a valid explicit non-applicable rationale does not fail as missing KPI
- Run targeted `review-cycle-helper.mjs prepare` smoke checks if helper-facing status/reporting behavior changes.
- Refresh installed skill output through the repo-owned skill-management route if repo-owned source files changed materially.

Human Verification Plan
- Required: false
- Reason: this slice changes internal workflow governance, helper validation, and report formatting rather than a separate end-user product route. Closure should be proven through machine verification plus governed review rather than separate manual product testing.

7. Observability / Audit

- The workflow must make KPI applicability visible instead of leaving it implicit.
- The workflow must make it visible whether KPI closure is satisfied, deferred by approved exception, or still open.
- Implement-plan pushback and completion summaries must clearly say when KPI gating is the blocker or when KPI gating was satisfied.
- Review-cycle reports must clearly expose KPI closure state in human-facing wording instead of forcing readers to infer it from a long narrative.
- Report formatting quality is part of report completeness for these workflow artifacts.

8. Dependencies / Constraints

- Preserve the locked rule in [kpi-instrumentation-requirement.md](/C:/ADF/docs/v0/kpi-instrumentation-requirement.md).
- Preserve the human-facing reporting rule recorded in [2026-04-03-human-facing-reporting-rule.md](/C:/ADF/docs/v0/context/2026-04-03-human-facing-reporting-rule.md).
- Keep `implement-plan` as the deterministic integrity gate owner.
- Keep `review-cycle` as the route-closure judgment owner.
- Do not claim that `review-cycle-helper.mjs` performs semantic KPI review if the actual enforcement remains prompt/template driven.
- Keep exception handling explicit and bounded; do not create a silent fallback path that lets KPI-unsafe slices look complete.

9. Non-Goals

- No COO runtime KPI code changes.
- No dashboard or analytics UI work.
- No generic repo-wide style rewrite beyond workflow report readability where this slice touches it.
- No redesign of merge-queue beyond the normal closeout path for this feature.
- No new Brain MCP integration work beyond repo-backed fallback notes already required by current runtime limits.

10. Source Authorities

- [README.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/README.md)
- [context.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/context.md)
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
