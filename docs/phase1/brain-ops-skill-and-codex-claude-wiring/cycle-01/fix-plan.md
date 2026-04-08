1. Failure Classes

- Governed route-truth divergence between implement-plan state, execution contract, review handoff, and closeout artifacts.
- Brain trust and cleanup surface is broader than the documented `brain-ops` route.
- Bootstrap fallback policy is contradictory when assistant-side `project-brain` MCP is unavailable.
- Branch-isolation proof must be judged against the current merge target truth (`origin/main`), not stale local `main`.

2. Route Contracts

- Claimed supported route: `ADF CLI bootstrap -> preferred assistant-side project-brain MCP -> repo fallback through brain-ops helper -> durable Brain read/search/capture/trust proof -> generated Codex/Claude installs`.
- End-to-end invariants:
  - bootstrap must present one unambiguous preferred path and one unambiguous fallback path
  - fallback writes must route only through the documented `brain-ops` helper surface
  - helper trust actions must stay bounded to the documented `promote reviewed|locked` and `cleanup archive|delete` route
  - feature-local implement-plan state, execution contract, review handoff truth, and completion-summary artifact must agree before merge readiness
  - slice-isolation proof must be based on the actual merge target truth, not a stale local tracking ref
- KPI Applicability: not required
- KPI Route / Touched Path: None.
- KPI Raw-Truth Source: None.
- KPI Coverage / Proof: None.
- KPI Production / Proof Partition: None.
- KPI Non-Applicability Rationale: This slice is an operational skill/bootstrap/install hardening route and does not ship a product KPI path.
- Vision Compatibility: compatible; the slice makes durable memory operations clearer and safer for contextless agents.
- Phase 1 Compatibility: compatible; Phase 1 requires durable company memory and predictable governed execution.
- Master-Plan Compatibility: compatible; this is bounded hardening that improves current-company execution rather than widening company scope.
- Current Gap-Closure Compatibility: compatible; it closes an agent-operability gap around Brain usage and truthful governed closeout.
- Later-Company Check: no
- Compatibility Decision: compatible
- Compatibility Evidence: `docs/VISION.md`, `docs/PHASE1_VISION.md`, `docs/PHASE1_MASTER_PLAN.md`, `docs/phase1/adf-phase1-current-gap-closure-plan.md`, and the existing slice contract all support bounded operational hardening here.
- Allowed mutation surfaces:
  - `skills/brain-ops/**`
  - `docs/bootstrap/cli-agent.md`
  - `docs/phase1/brain-ops-skill-and-codex-claude-wiring/**`
- Forbidden shared-surface expansion:
  - no `components/memory-engine/**` redesign
  - no raw DB route
  - no workflow-engine or merge-queue code changes in this slice
  - no widening into generic bootstrap cleanup outside the Brain fallback wording already in scope
- Docs that must be updated:
  - `docs/bootstrap/cli-agent.md`
  - `skills/brain-ops/SKILL.md`
  - `skills/brain-ops/references/usage.md`
  - feature-local governed artifacts under `docs/phase1/brain-ops-skill-and-codex-claude-wiring/`

3. Sweep Scope

- `skills/brain-ops/scripts/brain-ops-helper.mjs`
- `skills/brain-ops/SKILL.md`
- `skills/brain-ops/references/usage.md`
- `docs/bootstrap/cli-agent.md`
- generated install proof through `skills/manage-skills.mjs`
- feature-local implement-plan artifacts:
  - `implement-plan-state.json`
  - `implement-plan-execution-contract.v1.json`
  - `implement-plan-pushback.md`
  - `completion-summary.md`
- branch-isolation proof:
  - `git diff --name-only origin/main...HEAD`

4. Planned Changes

- Narrow the helper trust surface to the documented route by removing unsupported trust transitions from the public helper interface.
- Rewrite the bootstrap Brain capture language so MCP remains preferred, but `brain-ops` is the explicit repo-backed fallback when assistant MCP is unavailable.
- Mark the original pushback artifact as superseded now that the contract and brief exist and the slice is in governed review/closeout.
- Refresh implement-plan projections through the helper with truthful review-handoff settings so the execution contract and state stop contradicting the live slice.
- Generate and normalize a truthful `completion-summary.md` after state refresh and verification proof are recorded.

5. Closure Proof

- `node --check skills/brain-ops/scripts/brain-ops-helper.mjs`
- `node skills/brain-ops/scripts/brain-ops-helper.mjs connect-smoke --project-root C:/ADF`
- `node skills/brain-ops/scripts/brain-ops-helper.mjs search --project-root C:/ADF --scope assafyavnai/adf --query "brain ops"`
- controlled fallback write on the bounded route:
  - capture
  - promote to `reviewed`
  - read/search verification
  - cleanup via `archive`
- `node skills/manage-skills.mjs install --target codex --project-root C:/ADF`
- `node skills/manage-skills.mjs check --target codex --project-root C:/ADF`
- `node skills/manage-skills.mjs install --target claude --project-root C:/ADF`
- `node skills/manage-skills.mjs check --target claude --project-root C:/ADF`
- `git diff --name-only origin/main...HEAD` proves the slice remains bounded to the intended paths.
- helper-regenerated implement-plan execution contract/state plus a normalized `completion-summary.md` prove route-truth alignment.

6. Non-Goals

- No Brain server or schema redesign.
- No fix to the runtime-preflight `codex` `autonomous_invoke` mismatch in this slice.
- No merge-queue or review-cycle architecture changes.
- No generic company-process rewrite beyond the bounded Brain fallback wording already in scope.
