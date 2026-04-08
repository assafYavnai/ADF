1. Failure Classes

- Unfenced `terminal-status-recorded` can stamp normal-mode completion without the guarded merge-backed closeout route.
- Worker-selection provenance labels persisted continuity as invoker inheritance, making provider/runtime/access/model/reasoning truth untrustworthy on resume.
- `closeout_pending` collapses back to `ready_for_implementation` when normal-mode state is resynced into the structured run/attempt projection.
- `mark-complete` accepts merged state with unresolved local-target sync truth.

2. Route Contracts

- Failure class: unfenced normal-mode terminal completion.
  Claimed supported route: `merge-queue -> mark-complete -> terminal-status-recorded -> completed`.
  End-to-end invariant: only the guarded normal-mode closeout route may emit `terminal_status=completed`, and generic `record-event` must fail closed until merge-backed closeout evidence already exists.
  KPI Applicability: not required.
  KPI Route / Touched Path: `skills/implement-plan/scripts/implement-plan-helper.mjs` event reduction and closeout gating only.
  KPI Raw-Truth Source: governed normal-route execution state and append-only attempt events.
  KPI Coverage / Proof: targeted negative proof that pre-merge `terminal-status-recorded` is rejected and leaves state/run/projection non-terminal.
  KPI Production / Proof Partition: proof artifacts may live under this feature stream, but the enforced rule must hold on the live normal-mode helper route.
  KPI Non-Applicability Rationale: this cycle closes workflow-runtime route truth, not a separate product KPI route.
  KPI Exception Owner / Expiry / Production Status / Compensating Control when a temporary exception is approved: None.
  Vision Compatibility: preserves truthful governed execution instead of adding a shortcut completion surface.
  Phase 1 Compatibility: keeps merge-ready versus completed truth intact for the Phase 1 delivery route.
  Master-Plan Compatibility: closes a route-integrity gap in implementation closeout without widening into workflow redesign.
  Current Gap-Closure Compatibility: closes the remaining Spec 1 gap around event-first execution truth.
  Later-Company Check: no.
  Compatibility Decision: compatible.
  Compatibility Evidence: the Phase 1 implementation route already requires merge-backed completion truth; this fix removes the bypass on the shared event surface.
  Allowed mutation surfaces: `skills/implement-plan/scripts/implement-plan-helper.mjs`, `skills/implement-plan/SKILL.md`, `skills/implement-plan/references/workflow-contract.md`.
  Forbidden shared-surface expansion: no new operator shortcut, no new generic completion path, no merge-queue redesign.
  Docs that must be updated: `skills/implement-plan/SKILL.md`, `skills/implement-plan/references/workflow-contract.md`.

- Failure class: worker-selection provenance is untruthful on resume/reuse.
  Claimed supported route: `prepare -> resolveWorkerSelection -> buildWorkerBinding/buildExecutionContract -> persisted contract/projection`.
  End-to-end invariant: provider/runtime/access/model/reasoning values must distinguish `explicit_override`, `persisted_continuity`, and `invoker_inheritance` instead of collapsing continuity into inheritance.
  KPI Applicability: not required.
  KPI Route / Touched Path: worker-selection resolution and serialization in `skills/implement-plan/scripts/implement-plan-helper.mjs`.
  KPI Raw-Truth Source: live helper prepare outputs and persisted execution artifacts.
  KPI Coverage / Proof: fresh-prepare, continuity-resume, and explicit-override proofs showing truthful per-field provenance.
  KPI Production / Proof Partition: proof artifacts live under this feature stream, but the same provenance fields must be emitted by live helper prepare output and the stable/run-scoped contracts.
  KPI Non-Applicability Rationale: this cycle repairs helper metadata truth, not a product KPI route.
  KPI Exception Owner / Expiry / Production Status / Compensating Control when a temporary exception is approved: None.
  Vision Compatibility: keeps worker/runtime truth explicit and machine-consumable.
  Phase 1 Compatibility: supports truthful provider-neutral execution without changing the governed route.
  Master-Plan Compatibility: narrows ambiguity in routed worker selection and resumability.
  Current Gap-Closure Compatibility: closes the remaining Spec 1 provenance gap on the provider-neutral worker substrate.
  Later-Company Check: no.
  Compatibility Decision: compatible.
  Compatibility Evidence: Spec 1 already requires provider-neutral worker selection and truthful invoker/runtime inheritance; the missing piece is explicit persisted continuity provenance.
  Allowed mutation surfaces: `skills/implement-plan/scripts/implement-plan-helper.mjs`, `skills/implement-plan/SKILL.md`, `skills/implement-plan/references/workflow-contract.md`.
  Forbidden shared-surface expansion: no provider-manager redesign, no benchmark supervisor work, no new worker-selection knobs beyond provenance truth.
  Docs that must be updated: `skills/implement-plan/SKILL.md`, `skills/implement-plan/references/workflow-contract.md`.

- Failure class: `closeout_pending` resume truth regresses to implementation.
  Claimed supported route: `implementation -> machine_verification -> closeout_pending/review handoff -> resume`.
  End-to-end invariant: once machine verification or merge closeout reaches `closeout_pending`, the active attempt and run projection must preserve a closeout-bound checkpoint instead of reopening implementation.
  KPI Applicability: not required.
  KPI Route / Touched Path: legacy-to-structured state mapping in `skills/implement-plan/scripts/implement-plan-helper.mjs`.
  KPI Raw-Truth Source: state/projection rebuild after `verification-finished`, `completion-summary-written`, and merge-closeout steps.
  KPI Coverage / Proof: targeted state-to-run resync proof from `closeout_pending` showing attempt status and checkpoint remain at the closeout boundary.
  KPI Production / Proof Partition: proof artifacts live under this feature stream, but the repair must apply to live resume/rebuild paths.
  KPI Non-Applicability Rationale: this is a workflow-runtime checkpoint repair, not a product KPI route.
  KPI Exception Owner / Expiry / Production Status / Compensating Control when a temporary exception is approved: None.
  Vision Compatibility: preserves truthful resumability in the governed execution route.
  Phase 1 Compatibility: prevents review or closeout handoff state from silently reopening implementation.
  Master-Plan Compatibility: closes a resumability integrity gap without widening into a larger state-system rewrite.
  Current Gap-Closure Compatibility: closes the remaining Spec 1 checkpoint-truth gap between compatibility state and structured projections.
  Later-Company Check: no.
  Compatibility Decision: compatible.
  Compatibility Evidence: the execution contract already promises resumability after interruption; the reducer now needs to keep late normal-mode checkpoints truthful.
  Allowed mutation surfaces: `skills/implement-plan/scripts/implement-plan-helper.mjs`.
  Forbidden shared-surface expansion: no new steps, no route redesign, no additional stop/reset surfaces.
  Docs that must be updated: `skills/implement-plan/references/workflow-contract.md`.

- Failure class: completion can close with unresolved local-target sync state.
  Claimed supported route: `merge_queue -> update-state(local_target_sync_status) -> mark-complete`.
  End-to-end invariant: completion requires merge truth plus a recorded local-target sync outcome; unresolved `not_started` sync state must fail closed.
  KPI Applicability: not required.
  KPI Route / Touched Path: `skills/implement-plan/scripts/implement-plan-helper.mjs` closeout gate only.
  KPI Raw-Truth Source: helper state, completion summary, and merge-closeout proof artifacts.
  KPI Coverage / Proof: negative proof that `mark-complete` rejects `local_target_sync_status=not_started`, plus positive proof that recorded sync outcomes still pass.
  KPI Production / Proof Partition: proof artifacts live under this feature stream, but the guard must apply to the live `mark-complete` helper route used by merge-queue.
  KPI Non-Applicability Rationale: this cycle repairs workflow closeout truth, not a product KPI route.
  KPI Exception Owner / Expiry / Production Status / Compensating Control when a temporary exception is approved: None.
  Vision Compatibility: keeps completion truth aligned with real merge-closeout evidence.
  Phase 1 Compatibility: preserves truthful completion gating after merge landing.
  Master-Plan Compatibility: narrows a remaining closeout contract gap without changing merge-queue ownership.
  Current Gap-Closure Compatibility: closes the remaining Spec 1 completion-gate gap on local target sync truth.
  Later-Company Check: no.
  Compatibility Decision: compatible.
  Compatibility Evidence: the workflow contract already requires truthful local target sync status before completion; the helper guard now needs to enforce it.
  Allowed mutation surfaces: `skills/implement-plan/scripts/implement-plan-helper.mjs`, `skills/implement-plan/references/workflow-contract.md`.
  Forbidden shared-surface expansion: no new sync statuses, no merge-queue redesign, no change to who owns merge landing.
  Docs that must be updated: `skills/implement-plan/references/workflow-contract.md`.

3. Sweep Scope

- `skills/implement-plan/scripts/implement-plan-helper.mjs` reducer surfaces:
  `recordEvent`, `applyStructuredExecutionEvent`, `markComplete`, `syncNormalRunProjectionFromState`, `syncLegacyNormalStateFromRun`, `buildLegacyAttemptSummary`, `resolveWorkerSelection`, `buildWorkerBinding`, and `buildExecutionContract`.
- Persisted sibling outputs that must stay aligned:
  stable execution contract, run-scoped contract, run projection, feature state, feature index, and agent registry summaries produced through helper prepare/update-state/record-event/mark-complete paths.
- Adjacent callers that must keep working without redesign:
  `skills/merge-queue/scripts/merge-queue-helper.mjs` local-target-sync closeout path and any existing prepare/resume flows that rely on persisted worker continuity.

4. Planned Changes

- Add one guarded normal-mode completion check inside `terminal-status-recorded` so generic structured events cannot mint completion before the guarded closeout route has already frozen completion truth.
- Tighten `mark-complete` to reject unresolved `local_target_sync_status=not_started` while still accepting recorded sync outcomes from merge-queue.
- Teach the legacy-to-structured checkpoint mapping to preserve `closeout_pending` attempt status and a truthful closeout-bound resume checkpoint.
- Split worker-selection provenance into explicit per-field sources, keeping `defaults` as invoker/runtime defaults, adding persisted continuity truth, and serializing the resulting source map into bindings and contracts.
- Update only the authoritative `implement-plan` docs needed to reflect the stricter completion gate and the explicit worker-selection provenance model.
- New power analysis: none. The fix constrains existing shared helper surfaces; it does not add a new caller surface, env var, schema input, or operator shortcut.

5. Closure Proof

- Machine verification:
  `node --check skills/governed-feature-runtime.mjs`
  `node --check skills/implement-plan/scripts/implement-plan-helper.mjs`
  `git diff --check`
- Negative proof required:
  direct `record-event terminal-status-recorded` before merge-backed closeout evidence must fail and leave the normal run non-terminal.
  `mark-complete` with `local_target_sync_status=not_started` must fail closed.
- Route proof required:
  a `closeout_pending` resync proof must show the attempt stays `closeout_pending` with a closeout-bound checkpoint instead of `ready_for_implementation`.
  a worker-selection proof set must show `invoker_inheritance`, `persisted_continuity`, and `explicit_override` distinctly on fresh prepare, resume, and override cases.
- Live/proof isolation checks:
  proof uses the real helper entrypoints and persisted feature artifacts only; no alternate bootstrap, env toggle, or harness-only completion path may be used.
- Targeted regression checks:
  merge-queue-compatible `mark-complete` still succeeds when `merge_status=merged` and a recorded sync status exists.
  normal-mode prepare still materializes stable/run-scoped contracts and projections with truthful worker metadata.

6. Non-Goals

- No merge-queue redesign.
- No benchmark supervisor or matrix execution work.
- No new operator stop surface or normal-mode shortcut.
- No broader workflow/state-system rewrite beyond the cited route-level failure classes.
