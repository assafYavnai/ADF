# Governance Path Hardening Bootstrap Requirements

Status: active slice requirements
Last updated: 2026-04-10
Owner: COO
Scope: `C:/ADF/docs/phase1/governance-path-hardening-bootstrap`

## Mandatory Requirements

- This slice is bootstrap/manual-governance only until the repaired route proves it can certify itself.
- Slice creation, implementation, verification, approval, and first merge must remain manually governed.
- The first implementation pass must stop for manual review before any production code change starts.
- The seed must preserve `brief_ready` as the last truthful pre-implementation checkpoint, but the live operational state must stay `blocked` until manual bootstrap approval is recorded.
- `bootstrap-approval.v1.json` is the sole authoritative bootstrap approval record for clearing that hold.
- Clearing the hold requires updating that approval record first and then recording a deliberate reopen transition across the slice-owned operational artifacts.
- Seeded operational artifacts must not advertise governed `review_pending` or `review_requested` state before post-implementation review actually exists.
- The slice must preserve the route-level design decisions from `C:/ADF/docs/phase1/governance-path-hardening-plan-v2.md` without widening or paraphrasing away their authority.

## Truth And Authority Requirements

- Every authority-bearing field and artifact must carry exactly one primary truth class.
- Field ownership must remain explicit even inside heterogeneous containers such as `implement-plan-state.json`.
- Artifact ownership must never silently override field ownership.
- Every changed route must answer all four authority planes explicitly:
  - truth source
  - storage root
  - commit workspace
  - remote durability proof
- `reconciliation_sha` must be runtime-derived only and recovered from durable remote proof.
- `last_commit_sha` must be a compatibility view only and must not regain write authority.
- `execution_status` and compatibility `active_run_status` must remain split.
- Workspace mirrors must remain staging-only and never become authority.
- Domain-scoped precedence must remain domain-scoped; no global priority ladder may be restored.
- Ambiguity must fail closed on zero results, multiple results, stale proof, or wrong-root proof.
- Manual bootstrap approval must not be encoded as governed `review_cycle` state before implementation exists.
- Manual bootstrap approval must not be stored in `last_error`; operational residue fields stay reserved for actual route errors.
- Manual bootstrap approval must not be considered effective unless the approval record in `bootstrap-approval.v1.json` is explicitly stamped approved.

## Route Inventory Requirements

Before Phase 0 code starts, the slice must freeze route inventory across:

- all writers
- all readers
- all validators
- all derivation paths
- all migration and normalization paths
- all recovery paths
- all status and reporting consumers

The implementation-preflight gate must include repo-wide search for at least:

- `detectCurrentBranch(`
- `last_commit_sha`
- `active_run_status`
- `review-cycle-state.json`
- `features-index.json`
- `agent-registry.json`
- `git log`
- `origin/HEAD`
- worktree-root artifact path selection

## Phase Ordering Requirements

- Phase 0 must land before any production code change.
- Phase 1 must remove wrong-code-landing risk before physical-authority refactors.
- Phase 2 must resolve canonical physical authority before semantic field hardening.
- Phase 3 must separate persisted schema from hydrated compatibility views before reconcile/closeout changes rely on that split.
- Phase 4 must add domain-scoped reconcile and multi-plane validation before governed closeout becomes authoritative.
- Phase 5 must harden governed closeout and remote durability before trust restoration is claimed.
- Phase 6 backfill and retirement work must remain explicitly separate from runtime hardening.

## Proof Requirements

- hostile-case coverage is mandatory for every hardened route
- negative proofs are mandatory for all retired authority paths
- contradiction sweep is mandatory before review readiness
- implementation-preflight gate is mandatory before first code change
- implementation review must treat defect-class regressions as blockers, not cleanup

Hostile cases that must be frozen into the slice:

- fetch fails while stale local refs exist
- wrong checkout branch does not alter `base_branch`
- blocked request cannot retarget its lane
- queued but unmerged feature remains worktree-authoritative
- merged feature with stale worktree remains repo-root authoritative
- cache write from worktree resolves to canonical root or fails
- legacy `last_commit_sha` normalizes without regaining authority
- legacy execution/merge status aliases normalize without regaining authority
- cross-domain contradictions block instead of auto-resolving
- local closeout commit without successful push is not durable proof
- zero remote closeout candidates block
- multiple remote closeout candidates block
- stale workspace mirror never outranks canonical root

## Trust-Restoration Acceptance Criteria

`implement-plan` may only be trusted again for a follow-up dogfood slice when all of the following are true:

- wrong-code-landing blockers are removed
- canonical root selection is consistent across all in-scope read/write paths
- persisted schema and hydrated runtime view are explicitly separated
- `reconciliation_sha` is runtime-derived only
- `last_commit_sha` is no longer a writable authority path
- merge-queue no longer writes execution-domain status
- domain-scoped `reconcile` exists
- validator covers truth source, physical authority, remote durability, ambiguity, and backward-compat normalization
- governed closeout is remotely provable and fail-safe on push failure
- final contradiction sweep passes
- a follow-up slice can land without manual artifact repair or manual state mutation

## Deferred Work

- bulk convergence/backfill across historical streams
- retirement of temporary compatibility bridges after the runtime path is proven
- Brain hygiene cleanup
- unrelated COO product or reporting cleanup

## Decision Link

Read together with:

- `C:/ADF/docs/phase1/governance-path-hardening-plan-v2.md`
- `C:/ADF/docs/phase1/governance-path-hardening-bootstrap/decisions.md`
- `C:/ADF/docs/phase1/governance-path-hardening-bootstrap/implement-plan-contract.md`

## Source Authorities

- `C:/ADF/AGENTS.md`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/docs/v0/architecture.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/governance-path-hardening-plan-v2.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
- `C:/ADF/skills/governed-feature-runtime.mjs`
- `C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`
