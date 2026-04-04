# 1. Implementation Objective

Upgrade the repo-owned `implement-plan` and `review-cycle` workflows so Vision / Phase 1 / Master-Plan compatibility becomes an explicit workflow gate instead of a soft expectation. Every implementation slice must name the governing authority set it read, freeze an explicit compatibility decision, and prove it belongs in the active Phase 1 company before implementation can start or review can close.

# 2. Slice Scope

- Strengthen `implement-plan` under `C:/ADF/skills/implement-plan/**` so `prepare` and `run` require a frozen compatibility section grounded in:
  - `C:/ADF/docs/VISION.md`
  - `C:/ADF/docs/PHASE1_VISION.md`
  - `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
  - `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`
- Strengthen `review-cycle` under `C:/ADF/skills/review-cycle/**` so auditor/reviewer/implementor route artifacts explicitly judge whether the slice fits the active company mission, current phase, and current gap-closure priorities.
- Add deterministic helper validation only where the helper already owns integrity or report-shape enforcement.
- Keep the slice bounded to repo-owned workflow contracts, prompt templates, helper validation, and this feature root.
- Refresh installed skill targets only if repo-owned source changes materially and the existing install/check workflow requires refreshed generated copies.

# 3. Required Deliverables

- Explicit `implement-plan` contract fields for:
  - `Vision Compatibility`
  - `Phase 1 Compatibility`
  - `Master-Plan Compatibility`
  - `Current Gap-Closure Compatibility`
  - `Later-Company Check`
  - `Compatibility Decision`
  - `Compatibility Evidence`
- Deterministic `implement-plan` helper enforcement that blocks a slice when:
  - the compatibility fields are missing
  - the listed authority set is incomplete
  - `Compatibility Decision` is missing or not one of: `compatible`, `defer-later-company`, `blocked-needs-user-decision`
  - the decision is not implementation-legal
  - the slice is marked as later-company work but still attempts to advance
- `review-cycle` contract and prompt updates that require explicit compatibility verdicts in audit and review outputs, including whether:
  - the claimed slice fits the active Phase 1 mission
  - the work strengthens current startup-building priorities rather than later-company breadth
  - the slice contradicts the current gap-closure plan
  - the claimed compatibility is actually supported by evidence
- Truthful closeout language so compatibility remains visible in `fix-plan.md`, `audit-findings.md`, `review-findings.md`, and `fix-report.md`.
- Updated feature artifacts and completion reporting for this stream.

# 4. Allowed Edits

- `C:/ADF/skills/implement-plan/SKILL.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/references/prompt-templates.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/review-cycle/SKILL.md`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`
- `C:/ADF/skills/review-cycle/references/prompt-templates.md`
- `C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs` only if helper-owned output or validation must change to keep the route truthful
- `C:/ADF/docs/phase1/implement-plan-review-cycle-vision-master-plan-gating/**`
- Supporting repo-backed governance notes under `C:/ADF/docs/v0/context/**` only if required to keep the authority chain explicit and truthful
- Repo-owned skill install/check helpers only if source changes require refreshed generated installs

# 5. Forbidden Edits

- Do not widen into COO runtime or product-route changes.
- Do not redesign merge-queue, worktree orchestration, memory-engine behavior, or unrelated workflow systems.
- Do not weaken exact-heading contracts, split-verdict handling, verification discipline, or truthful closeout rules.
- Do not replace deterministic gating with a vague prose reminder.
- Do not treat Brain-only knowledge as sufficient; the repo-backed authority docs above must remain explicit.
- Do not mark later-company work as implementation-legal just because it sounds useful.
- Do not add a new artifact family unless the existing contract, brief, fix-plan, fix-report, and review artifacts cannot carry the requirement.

# 6. Acceptance Gates

1. `implement-plan` requires a frozen compatibility section in every slice contract before implementation can start.
2. The frozen compatibility section names all four required repo-backed authority docs explicitly.
3. `Compatibility Decision` has an exact allowed-value contract and only `compatible` is implementation-legal.
4. A slice marked `Later-Company Check: yes` or otherwise classified as later/not-compatible cannot pass helper integrity for implementation.
5. `review-cycle` audit and review outputs must each state an explicit compatibility verdict rather than assuming compatibility silently.
6. A slice cannot receive an overall approved review verdict while compatibility proof is missing, contradicted, or unresolved.
7. Reports remain human-facing and easy to scan; the slice must not regress into dense unreadable route reports.
8. The bounded governance route is proven through helper checks, contract/template diffs, and review artifacts for this stream.

## Machine Verification Plan

- Run `node --check` on every modified helper or script file.
- Run `git diff --check` on the changed source set.
- Run targeted `implement-plan` helper smoke checks that prove:
  - missing compatibility section fails
  - incomplete authority list fails
  - `Compatibility Decision: blocked-needs-user-decision` fails advancement
  - `Later-Company Check: yes` fails advancement
  - a valid aligned slice passes
- Run targeted `review-cycle` helper or report-shape checks if helper-owned output changes.
- Refresh and validate installed skill targets with the repo’s existing install/check path if repo-owned skill source changes materially.

## Human Verification Plan

- Required: true
- Reason: this slice changes the governance rules future slices use to decide whether work belongs in the active company mission and phase. It must not self-certify without explicit CEO approval.
- Testing instructions:
  1. Read the updated `implement-plan` contract section that freezes compatibility.
  2. Read one valid aligned sample and one invalid/later-company sample produced by the implementation.
  3. Confirm the invalid sample is blocked before implementation can proceed.
  4. Confirm `review-cycle` reports now surface compatibility verdicts clearly and scan cleanly.
- Expected result:
  - aligned work can proceed
  - later-company or unproven work is blocked truthfully
  - audit/review findings show compatibility explicitly instead of assuming it
- Evidence to report back:
  - which sample was blocked
  - which sample passed
  - whether the report language is clear enough for human review
- Response format to request from the user:
  - `APPROVED`
  - or `REJECTED: <comments>`

# 7. Observability / Audit

KPI Applicability: not required
KPI Route / Touched Path: Not applicable.
KPI Raw-Truth Source: Not applicable.
KPI Coverage / Proof: Not applicable.
KPI Production / Proof Partition: Not applicable.
KPI Non-Applicability Rationale: This is a meta-governance slice for repo-owned workflow contracts, prompts, and helper validation. It does not introduce or modify a product/runtime route that needs new KPI telemetry instrumentation.
KPI Exception Owner: Not applicable.
KPI Exception Expiry: Not applicable.

Audit rules:
- Compatibility claims must remain traceable to the explicit repo-backed authority set.
- Missing authority coverage must be visible and blocking rather than silently assumed away.
- `later-company` and `blocked-needs-user-decision` states must remain distinguishable from `compatible`.
- The compatibility gate must not silently collapse into a generic “looks reasonable” judgment.
- Live/proof isolation must stay truthful: this slice proves workflow-governance behavior, not a product/runtime route.
- Human-facing workflow reporting rules already in force must not regress.

# 8. Dependencies / Constraints

- Preserve the existing four top-level feature statuses: `active`, `blocked`, `completed`, `closed`.
- Preserve current exact-heading and closeout conventions in `implement-plan` and `review-cycle`.
- Use the repo-backed authority docs as the minimum required authority set even if Brain is available.
- Keep the helper enforcement bounded to deterministic fields it can actually validate.
- Keep prompt/contract changes short, operational, and aligned across both skills.
- This slice must not claim broader semantic certainty than the helper or review route can actually prove.

# 9. Non-Goals

- No COO status/runtime changes.
- No executive-brief renderer or source-adapter changes.
- No merge-queue or worktree redesign.
- No generic business-strategy engine.
- No later-phase department or company modeling work.
- No broad review-cycle redesign outside explicit compatibility gating.

# 10. Source Authorities

- `C:/ADF/docs/phase1/implement-plan-review-cycle-vision-master-plan-gating/README.md`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`
- `C:/ADF/skills/implement-plan/SKILL.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/references/prompt-templates.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/review-cycle/SKILL.md`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`
- `C:/ADF/skills/review-cycle/references/prompt-templates.md`
- `C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs`

# 11. Closeout Rules

- Keep the slice bounded to workflow-governance compatibility gating.
- Run machine verification before review handoff.
- Use `review-cycle` with `until_complete=true` after implementation because this slice changes workflow-closure rules.
- Human verification is mandatory before final closeout because this is governance over future slice admission.
- Commit and push feature-branch changes before merge-queue handoff.
- Do not mark the feature complete until review closure, human approval, and merge-queue closeout succeed truthfully.
