1. Failure Classes

- Merge closeout repo truth could be written from an isolated merge worktree and persist that temporary root into tracked implement-plan state, execution contracts, and run projections.
- Final merged completion evidence could remain stale because closeout reconciliation depended on a one-shot `mark-complete` path that stopped early once a feature was already marked completed.

2. Route Contracts

- Failure class 1:
  Claimed supported route: approved feature commit -> merge-queue isolated merge worktree -> push to target branch -> repo-owned implement-plan closeout artifacts on the merged target branch.
  End-to-end invariant: queue/control state stays anchored to the canonical git root, while repo-owned completion artifacts always serialize canonical target-branch paths even when physical writes happen in a temporary merge worktree.
  KPI Applicability: not required.
  KPI Non-Applicability Rationale: this slice repairs governed workflow/runtime truth and repo-owned lifecycle artifacts; it does not change a production KPI-bearing product route.
  Vision Compatibility: compatible, because it strengthens truthful governed execution and resumable auditability instead of adding shortcut control surfaces.
  Phase 1 Compatibility: compatible, because it closes a workflow/runtime defect in the governed Phase 1 implementation path.
  Master-Plan Compatibility: compatible, because it removes a repo-truth contradiction between actual merge results and tracked completion evidence.
  Current Gap-Closure Compatibility: compatible with governance/runtime gap closure.
  Later-Company Check: no.
  Compatibility Decision: compatible.
  Compatibility Evidence: the change only narrows merge-queue and implement-plan closeout behavior so merged repo truth matches real lifecycle state.
  Allowed mutation surfaces: `skills/governed-feature-runtime.mjs`, `skills/merge-queue/scripts/merge-queue-helper.mjs`, `skills/implement-plan/scripts/implement-plan-helper.mjs`, and the repaired Spec 1 repo-owned artifacts.
  Forbidden shared-surface expansion: no new merge supervisor, no new stop surface, no new benchmark orchestration behavior, and no operator shortcuts in the governed route.
  Docs that must be updated: stale Spec 1 `implement-plan-state.json`, `implement-plan-execution-contract.v1.json`, run projection, run-scoped execution contract, and `completion-summary.md`.
- Failure class 2:
  Claimed supported route: merged feature -> closeout reconciliation -> truthful repo-owned completion summary and compatibility projection.
  End-to-end invariant: `mark-complete` must be idempotent enough to refresh derived artifacts for an already-completed merged feature without fabricating a new lifecycle or erasing history.
  KPI Applicability: not required.
  KPI Non-Applicability Rationale: same as above; the slice repairs governance truth rather than a KPI-bearing product path.
  Vision Compatibility: compatible.
  Phase 1 Compatibility: compatible.
  Master-Plan Compatibility: compatible.
  Current Gap-Closure Compatibility: compatible with governance/runtime gap closure.
  Later-Company Check: no.
  Compatibility Decision: compatible.
  Compatibility Evidence: the change keeps lifecycle truth append-only and only refreshes derived artifacts from existing merge evidence.
  Allowed mutation surfaces: same bounded helper/runtime files and stale Spec 1 repo-owned artifacts.
  Forbidden shared-surface expansion: no new lifecycle states, no benchmark-only scoring, and no new shared operator mutation surface.
  Docs that must be updated: stale Spec 1 repo-owned completion summary and completion-state artifacts.

3. Sweep Scope

- `skills/merge-queue/scripts/merge-queue-helper.mjs`
- `skills/implement-plan/scripts/implement-plan-helper.mjs`
- `skills/governed-feature-runtime.mjs`
- `docs/phase1/implement-plan-provider-neutral-run-contract/`

4. Planned Changes

- Canonicalize merge-queue queue/control state to the canonical git root instead of the invoking feature worktree.
- Pass the canonical repo root into implement-plan closeout mutations while still allowing physical writes from the isolated merge worktree.
- Separate physical write paths from serialized repo-owned artifact paths inside implement-plan helper contract/projection/state refresh code.
- Make `mark-complete` idempotent for already-completed merged features so stale summaries and projections can be reconciled without faking a new lifecycle.
- Repair the stale Spec 1 repo-owned closeout artifacts through the fixed helper path.

5. Closure Proof

- `node --check skills/governed-feature-runtime.mjs`
- `node --check skills/implement-plan/scripts/implement-plan-helper.mjs`
- `node --check skills/merge-queue/scripts/merge-queue-helper.mjs`
- `git diff --check`
- Canonical closeout repair smoke: `implement-plan-helper.mjs update-state --canonical-project-root C:/ADF` for `phase1/implement-plan-provider-neutral-run-contract`
- Idempotent summary refresh smoke: `implement-plan-helper.mjs mark-complete --canonical-project-root C:/ADF` for the same feature
- Proof artifact: repaired Spec 1 state, execution contract, and run projection now point at `C:/ADF/docs/phase1/implement-plan-provider-neutral-run-contract/...`
- Negative proof: confirm merge-queue queue/status helper paths still resolve to the canonical git root rather than the invoking feature worktree

6. Non-Goals

- No benchmark supervisor implementation.
- No new provider/model matrix execution.
- No review-cycle orchestration redesign beyond what is required to validate this slice.
