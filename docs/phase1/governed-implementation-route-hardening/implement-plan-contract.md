1. Implementation Objective

Harden the governed implementation route so future features can move from contract creation through implementation, review, blocked-merge recovery, and completion with less operator guesswork and fewer route-truth failures.

2. Slice Scope

- `review-cycle` continuity and reopen guardrail rules in both skill and contract sources
- `merge-queue` blocked-merge resume or resolve route in both skill docs and helper tooling
- `implement-plan` closeout validation against stale pre-merge or in-progress language
- `implement-plan` integrity gating for authoritative initiative or slice requirement files that are being introduced independently on base and feature
- `cli-agent.md` bash-on-Windows and sibling-worker launch examples
- active authoritative template and documentation branch-language normalization from `master` to `main`
- targeted tests directly required to prove the hardening

3. Required Deliverables

- hard fix-cycle continuity rule in `skills/review-cycle/SKILL.md`
- matching reopen guardrail documentation in `skills/review-cycle/SKILL.md` and `skills/review-cycle/references/workflow-contract.md`
- governed blocked-merge recovery route documentation in `skills/merge-queue/SKILL.md` and `skills/merge-queue/references/workflow-contract.md`
- implemented blocked-merge resume or resolve flow in `skills/merge-queue/scripts/merge-queue-helper.mjs`
- post-`mark-complete` stale-language validation in `skills/implement-plan/scripts/implement-plan-helper.mjs`
- requirement-freeze integrity rule in `skills/implement-plan/SKILL.md` and or `skills/implement-plan/references/workflow-contract.md`
- explicit bash-on-Windows sibling-worker invocation examples in `docs/bootstrap/cli-agent.md`
- live-source `main` terminology cleanup in authoritative templates and docs
- machine verification covering the new governed behavior

4. Allowed Edits

- `C:/ADF/skills/review-cycle/**`
- `C:/ADF/skills/merge-queue/**`
- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- live authoritative templates and docs that govern the implementation route
- `C:/ADF/skills/tests/**` when directly required to prove the new behavior
- `C:/ADF/docs/phase1/governed-implementation-route-hardening/**`

5. Forbidden Edits

- no unrelated COO or product-runtime feature changes
- no Brain route redesign
- no manual merge-worktree fallback documented as the intended governed route
- no broad historical artifact rewrite just for terminology cleanup
- no weakening of review, approval, merge, or completion gates
- no speculative workflow redesign outside the specific failures recorded for this slice

6. Acceptance Gates

KPI Applicability:
not required

KPI Route / Touched Path:
None.

KPI Raw-Truth Source:
None.

KPI Coverage / Proof:
None.

KPI Production / Proof Partition:
None.

KPI Non-Applicability Rationale:
This slice hardens governed workflow helpers, contracts, and authoritative docs. It does not add or change product KPI collection behavior.

KPI Exception Owner:
None.

KPI Exception Expiry:
None.

KPI Exception Production Status:
None.

KPI Compensating Control:
None.

Vision Compatibility:
Compatible. The slice reduces orchestration ambiguity and preserves truthful governed execution rather than encouraging ad hoc operator recovery.

Phase 1 Compatibility:
Compatible. Phase 1 depends on a reliable startup implementation route with durable state, review, merge, and closeout truth.

Master-Plan Compatibility:
Compatible. This is route hardening for the implementation startup, not speculative breadth.

Current Gap-Closure Compatibility:
Compatible. The current gap plan explicitly depends on a real governed implementation route. This slice removes friction inside that route.

Later-Company Check:
no

Compatibility Decision:
compatible

Compatibility Evidence:
The requested changes stay inside `implement-plan`, `review-cycle`, `merge-queue`, bootstrap guidance, and their proving tests. They improve the existing route instead of inventing a new organizational layer.

Machine Verification Plan:
- targeted `skills/tests` coverage for review-cycle continuity and reopen guardrails
- targeted `skills/tests` coverage for merge-queue blocked-merge resume or resolve behavior
- targeted `skills/tests` coverage for implement-plan stale closeout validation
- targeted `skills/tests` coverage for authoritative requirement-freeze integrity pushback
- `node --check` on modified helper scripts
- `git diff --check`
- targeted scans over active authoritative sources to prove `main` normalization

Human Verification Plan:
Required: false

Reason:
This slice is deterministic governed-route and source-of-truth hardening. Human-facing product behavior is not the primary proof surface.

7. Observability / Audit

- `implement-plan-state.json` must truthfully show the active run, attempt, worktree state, merge state, and closeout state for this feature
- the stable execution contract and active run projection must stay aligned with the feature state
- review-cycle artifacts and helper state must truthfully reflect continuity and reopen behavior
- merge-queue queue state and blocked-merge recovery state must remain inspectable and truthful
- machine verification results must be visible in completion artifacts
- human verification must remain explicitly `Required: false`
- branch-language cleanup must be inspectable through source diffs, not claimed abstractly

8. Dependencies / Constraints

- maintain the existing governed route shape: implement-plan -> review-cycle -> merge-queue -> completion
- do not silently downgrade worker continuity or worker access rules
- blocked merge recovery must stay inside merge-queue tooling and docs
- authoritative requirement-freeze guarding must fail closed or push back; it must not guess or auto-merge conflicting authorities
- `cli-agent.md` examples must remain consistent with runtime preflight truth that Windows host still uses bash as the workflow shell
- the slice must remain compatible with `main` as the default branch language

9. Non-Goals

- no broad workflow platform rewrite
- no redesign of the Brain MCP availability model
- no cleanup of every historical document that ever mentioned `master`
- no product-surface implementation unrelated to governed route hardening
- no attempt to retroactively rewrite old slice histories beyond what active authorities require

10. Source Authorities

- `C:/ADF/AGENTS.md`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`
- `C:/ADF/docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/completion-summary.md`
- `C:/ADF/docs/phase1/approved-commit-closeout-state-separation/README.md`
- `C:/ADF/docs/phase1/review-cycle-setup-merge-safety/README.md`
- `C:/ADF/docs/phase1/governed-merge-closeout-chain-hardening/README.md`
- `C:/ADF/skills/review-cycle/SKILL.md`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/SKILL.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
- `C:/ADF/skills/implement-plan/SKILL.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/docs/phase1/governed-implementation-route-hardening/README.md`
- `C:/ADF/docs/phase1/governed-implementation-route-hardening/context.md`
- `C:/ADF/docs/phase1/governed-implementation-route-hardening/requirements.md`
- `C:/ADF/docs/phase1/governed-implementation-route-hardening/decisions.md`
