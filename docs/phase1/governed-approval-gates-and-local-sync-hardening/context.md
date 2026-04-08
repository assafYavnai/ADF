# Feature Context

## Feature

- phase_number: 1
- feature_slug: governed-approval-gates-and-local-sync-hardening
- project_root: C:/ADF
- feature_root: C:/ADF/docs/phase1/governed-approval-gates-and-local-sync-hardening
- intended_feature_branch: implement-plan/phase1/governed-approval-gates-and-local-sync-hardening

## Problem Statement

The governed route has two related failure families that now need a dedicated hardening slice:

1. Approval and closeout truth can advance past real gates.
2. Local target synchronization intentionally skips dirty control-plane checkouts instead of preserving local state, syncing, and restoring it.

The slice must fix both without weakening the exact approved-SHA merge rule or the existing governed separation between `implement-plan`, `review-cycle`, and `merge-queue`.

## Confirmed Route Evidence

- `C:/ADF/docs/phase1/coo-live-executive-status-wiring/implement-plan-contract.md`
  - the slice explicitly required human verification
- `C:/ADF/docs/phase1/coo-live-executive-status-wiring/implement-plan-state.json`
  - `human_verification_requested_at` is null
  - `human_testing.status` is `not_started`
  - merge still started and finished
  - local target sync was recorded as `skipped_dirty_checkout`
- `C:/ADF/docs/phase1/coo-live-executive-status-wiring/review-cycle-state.json`
  - the final landed review state carried a split verdict rather than a clean dual approval
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
  - current local sync returns `skipped_dirty_checkout` when the local target checkout is dirty
- `C:/ADF/skills/implement-plan/SKILL.md`
  - the intended governed route already says human testing must happen when required and completion must happen only after merge success
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
  - the intended ordered route is implementation -> machine verification -> review-cycle -> human testing when required -> merge-queue -> completed
- `C:/ADF/docs/phase1/governed-implementation-route-hardening/implement-plan-state.json` on `origin/main`
  - that earlier hardening slice already landed, so this new failure family needs a fresh slice rather than post-landing scope creep

## Scope Decision

- `coo-live-executive-status-wiring` keeps ownership of the broken `/status` product route and its reopened closeout.
- this slice owns only governance-engine hardening:
  - approval gate enforcement
  - human-verification truth
  - split-review truth
  - pre-resume / pre-merge origin refresh
  - local sync preserve-sync-restore policy

## Contextless Implementor Instructions

- Read `README.md`, `requirements.md`, `decisions.md`, and `implement-plan-contract.md` before changing code.
- Treat `coo-live-executive-status-wiring` as the motivating evidence, not as the implementation target.
- Do not widen into COO runtime or product route code.
- Do not weaken the exact approved commit SHA rule.
- Do not silently discard tracked or untracked user changes during local sync.
- If the chosen stash/restore design can fail or conflict, make the failure durable, explicit, and recoverable.
- Prefer deterministic helper and temp-repo proof over narrative-only claims.
- Make the new route safe for a lazy orchestration agent: the helpers and contracts should refuse unsafe progression rather than relying on operator discipline alone.

## Implementation Expectations

- `merge-queue` must block landing when required human verification is absent or stale.
- `implement-plan` must refuse closeout/completion narratives that claim human verification passed when the state does not prove it.
- post-human changes that affect approved behavior must invalidate prior human approval and route back to human testing.
- split review verdicts must not be promotable to merge-ready/completed truth.
- resume flow must refresh origin truth before implementation continues.
- merge flow must refresh origin truth before landing.
- local control-plane target sync must preserve modified and untracked files, sync safely, restore explicitly, and fail closed if restore cannot complete safely.

## Source Authorities

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

## Notes

- This slice exists because the current route behavior and the current route contract are misaligned.
- The desired fix is governed behavior, not an operator checklist.
