1. Implementation Objective

Harden the governed implementation-review-merge-complete route so:
- required human verification is enforced before merge or completion
- stale human approval is invalidated after post-human route changes
- split review verdicts cannot leak into merge-ready or completed truth
- implementation resume and merge both refresh origin truth before continuing
- local target synchronization preserves modified and untracked local state through an explicit stash-sync-restore route instead of silently skipping dirty checkouts

2. Slice Scope

- human-verification gate enforcement in `implement-plan`, `review-cycle`, and `merge-queue`
- stale-human-approval invalidation after post-human route changes
- split-review truth hardening so partial approval cannot become merge-ready/completed truth
- pre-resume origin refresh for governed feature worktrees
- pre-merge origin refresh for governed merge landing
- local target sync preserve-sync-restore behavior for modified and untracked state
- durable blocked-state and recovery evidence when stash restore fails or conflicts
- targeted tests and route proofs for the new governed behavior

3. Required Deliverables

- `merge-queue` landing guard that refuses landing when human verification is required but not durably completed
- `implement-plan` closeout validation that fails when human-verification truth is missing, stale, or contradicted by later route changes
- route logic that invalidates prior human approval after post-human behavior-changing commits unless a new explicit approval is recorded
- route logic that prevents split review verdicts from becoming merge-ready, merged, or completed truth
- pre-resume origin refresh path for governed feature worktrees
- pre-merge origin refresh path for governed merge landing
- explicit local target sync stash/restore route that preserves tracked and untracked changes and restores them after sync
- durable fail-closed recovery path when stash restore cannot complete safely
- targeted tests and proof artifacts covering both positive and negative cases
- updated authoritative workflow docs/contracts for contextless orchestrators and implementors

4. Allowed Edits

- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/review-cycle/**`
- `C:/ADF/skills/merge-queue/**`
- tightly scoped shared helper/runtime files under `C:/ADF/skills/**` only when required for this route
- `C:/ADF/skills/tests/**` when directly required to prove the route
- `C:/ADF/docs/bootstrap/cli-agent.md` if route guidance must change to stay truthful
- `C:/ADF/docs/phase1/governed-approval-gates-and-local-sync-hardening/**`

5. Forbidden Edits

- no COO product/runtime changes
- no unrelated slice fixes
- no weakening of review, human verification, merge, or completion gates
- no change to the exact approved commit SHA landing rule
- no silent discard or overwrite of tracked or untracked local changes
- no manual merge workaround documented as the intended governed happy path
- no broad git workflow redesign beyond the governed implementation route

6. Acceptance Gates

1. `merge-queue` refuses landing when human verification is required but durable human-verification truth is missing.
2. `implement-plan` refuses closeout/completion when human-verification truth is missing, stale, or contradicted by later route changes.
3. A post-human route change that affects approved behavior invalidates prior human approval until a new approval is recorded.
4. Split review verdicts cannot become merge-ready or completed truth.
5. Resume flow refreshes origin truth before implementation continues.
6. Merge flow refreshes origin truth before landing.
7. Local target sync preserves modified and untracked local state, syncs, then restores it explicitly.
8. Restore failure or conflict fails closed and preserves recovery evidence.
9. Exact approved-SHA landing behavior remains intact.
10. No local tracked or untracked developer changes are silently lost.

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
This slice hardens governed workflow helpers, contracts, and sync behavior. It does not add or change a product KPI route.

KPI Exception Owner:
None.

KPI Exception Expiry:
None.

KPI Exception Production Status:
None.

KPI Compensating Control:
None.

Vision Compatibility:
compatible. The slice strengthens truthful governed execution and prevents unsafe approval or completion shortcuts.

Phase 1 Compatibility:
compatible. Phase 1 depends on a reliable governed implementation route with real approval gates and safe local synchronization.

Master-Plan Compatibility:
compatible. This is bounded route hardening, not speculative workflow redesign.

Current Gap-Closure Compatibility:
compatible. The slice closes a real gap where approval truth and local sync truth can diverge from the intended governed contract.

Later-Company Check:
no

Compatibility Decision:
compatible

Compatibility Evidence:
Current helper docs already require human testing when needed and completion only after merge, but the motivating slice showed the route still allowed merge/completion without durable human-verification truth while merge-queue also recorded `skipped_dirty_checkout` instead of preserving and restoring local state.

post_send_to_review: true

review_until_complete: true

review_max_cycles: 5

Machine Verification Plan:
- `node --check C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `node --check C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs`
- `node --check C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
- `git -C C:/ADF diff --check`
- targeted `skills/tests` coverage for:
  - required human-verification merge blocking
  - stale human approval after post-human route changes
  - split review verdicts blocked from merge-ready/completed truth
  - pre-resume origin refresh behavior
  - pre-merge origin refresh behavior
  - dirty tracked local sync preserve-sync-restore
  - dirty untracked local sync preserve-sync-restore
  - restore-failure or conflict fail-closed behavior
- targeted temp-repo or isolated worktree smoke proving:
  - clean sync fast-forward route
  - dirty tracked preserve-sync-restore route
  - dirty untracked preserve-sync-restore route
  - restore-failure recovery evidence route

Human Verification Plan:
Required: false

Reason:
This slice is internal governance-helper and contract hardening. The proof surface is deterministic helper, state, and temp-repo behavior rather than a product-facing manual route.

7. Observability / Audit

- helper state must make human-verification truth explicit enough to distinguish `required-and-satisfied`, `required-but-missing`, and `required-but-stale`
- merge blocking reasons must be explicit and durable
- local sync outcome must make preserve-sync-restore truth explicit instead of collapsing into a generic dirty-checkout skip
- if a stash or restore artifact is created, its recovery context must be durably recorded
- proof artifacts must cover both blocked and successful routes

8. Dependencies / Constraints

- preserve the governed route order: implementation -> machine verification -> review-cycle -> human testing when required -> merge-queue -> completion
- preserve merge-queue ownership of landing the exact approved commit SHA
- preserve implement-plan ownership of closeout/completion truth
- preserve review-cycle ownership of review verdict truth
- local sync mutation must remain safe on Windows-hosted bash-based ADF workflows
- no destructive sync behavior is allowed unless the route can preserve and restore local state truthfully
- contextless agents must be able to follow the route from helper output and contract text without business guesswork

9. Non-Goals

- no COO `/status` route implementation changes
- no broad git UX redesign outside governed implementation workflow hardening
- no benchmark/provider matrix work
- no historical rewrite of unrelated slices
- no weakening of existing review or approval gates to make the new sync route easier

10. Source Authorities

- `C:/ADF/AGENTS.md`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`
- `C:/ADF/docs/phase1/coo-live-executive-status-wiring/implement-plan-contract.md`
- `C:/ADF/docs/phase1/coo-live-executive-status-wiring/implement-plan-state.json`
- `C:/ADF/docs/phase1/coo-live-executive-status-wiring/review-cycle-state.json`
- `C:/ADF/skills/implement-plan/SKILL.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/review-cycle/SKILL.md`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`
- `C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs`
- `C:/ADF/skills/merge-queue/SKILL.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
