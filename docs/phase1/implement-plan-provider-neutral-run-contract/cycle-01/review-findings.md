1. Closure Verdicts

Overall Verdict: REJECTED

- Failure class: Closeout checkpoint truth regresses to implementation after machine verification.
- Verdict: Open.
- Enforced route invariant: once the normal route reaches machine-verification complete / closeout-pending, the active run, attempt, contract, and projection must keep the resume boundary at closeout or review handoff rather than falling back to implementation.
- Evidence shown: `skills/implement-plan/scripts/implement-plan-helper.mjs:2916-2939` rebuilds attempt state from legacy status, but `legacyActiveRunStatusToAttemptStatus()` and `legacyLastCompletedStepToResumeStep()` never map `closeout_pending` (`skills/implement-plan/scripts/implement-plan-helper.mjs:2484-2521`). The emitted artifacts already show the break: `docs/phase1/implement-plan-provider-neutral-run-contract/implement-plan-state.json:38-40` says `completion_summary_written` and `closeout_pending`, while the same active attempt is stored as `ready_for_implementation` with checkpoint `implementation` / `ready` at `docs/phase1/implement-plan-provider-neutral-run-contract/implement-plan-state.json:577-586`. The run projection repeats that regression at `docs/phase1/implement-plan-provider-neutral-run-contract/implementation-run/run-e976eb7e-72ab-435f-ad23-86c523be8985/run-projection.v1.json:249-258`.
- Missing proof: no proof shows that a crash or resume after `verification-finished` or `completion-summary-written` restarts from the closeout boundary instead of reopening implementation.
- KPI applicability: not required.
- KPI closure state: Closed.
- Missing KPI proof or incomplete exception details: None. The product-KPI non-applicability rationale is already frozen in `docs/phase1/implement-plan-provider-neutral-run-contract/implement-plan-contract.md`.
- Compatibility verdict: Incompatible. The slice is supposed to preserve the governed Phase 1 implementation route and truthful closeout semantics, but this regression leaves the route open against `docs/phase1/implement-plan-provider-neutral-run-contract/implement-plan-contract.md:25,106` and `skills/implement-plan/references/workflow-contract.md:488-501`.
- Sibling sites still uncovered: `recordEvent()` legacy mirroring (`skills/implement-plan/scripts/implement-plan-helper.mjs:1133-1242`), `syncNormalRunProjectionFromState()` (`skills/implement-plan/scripts/implement-plan-helper.mjs:2916-2947`), and any resume/rebuild path that depends on the legacy compatibility projection.
- Whether broader shared power was introduced and whether that was justified: no new shared power, but the shared helper now owns more route-state translation and the closeout mapping is incomplete.
- Whether negative proof exists where required: no. There is no negative proof for post-verification resume or post-summary rebuild.
- Whether live-route vs proof-route isolation is shown: no. The proof artifacts cover happy-path materialization, not late-stage resume after the live route reaches closeout-pending.
- Claimed supported route / route mutated / route proved: claimed `implementation -> machine_verification -> review_cycle/human_testing/merge_queue as applicable, resumable after interruption`; mutated helper state/projection/contract sync around prepare/update-state/record-event; proved happy-path prepare/reset/verification artifact generation only.
- Whether the patch is route-complete or endpoint-only: endpoint-only. It writes the new contract/projection/event surfaces but loses truthful route position at the closeout boundary.

- Failure class: Completion can still be marked without local-target sync truth.
- Verdict: Open.
- Enforced route invariant: `mark-complete` must refuse completion until merge success and truthful local-target sync status are both recorded.
- Evidence shown: the workflow contract requires completion only after merge success and truthful local-target sync status (`skills/implement-plan/references/workflow-contract.md:495-501`), but `markComplete()` only checks `last_commit_sha`, a valid `completion-summary.md`, and `merge_status === "merged"` (`skills/implement-plan/scripts/implement-plan-helper.mjs:1424-1433`). There is no guard on `local_target_sync_status`, even though the state schema and summary surface carry that field (`skills/implement-plan/scripts/implement-plan-helper.mjs:1561-1568`).
- Missing proof: no negative proof shows `mark-complete` rejects merged-but-unsynced state such as `local_target_sync_status = not_started`.
- KPI applicability: not required.
- KPI closure state: Closed.
- Missing KPI proof or incomplete exception details: None. This rejection is about merge-closeout truth, not a missing product KPI field.
- Compatibility verdict: Incompatible. Allowing completion without target-sync truth contradicts the governed closeout contract in the Phase 1 route.
- Sibling sites still uncovered: any closeout caller that treats `merge_status` alone as completion truth, especially the completion-summary and state-sync consumers downstream of `markComplete()`.
- Whether broader shared power was introduced and whether that was justified: no new shared power; this is an incomplete guard on an existing shared completion surface.
- Whether negative proof exists where required: no. The verification set does not prove rejection when merge truth is only partially recorded.
- Whether live-route vs proof-route isolation is shown: partial at best. The live closeout gate exists, but proof only covers the happy path and not the reject path mandated by the contract.
- Claimed supported route / route mutated / route proved: claimed `merge_queue -> truthful target sync -> mark-complete`; mutated the helper completion gate; proved completion-summary validation and merged-status checking only.
- Whether the patch is route-complete or endpoint-only: endpoint-only. It closes on merged status without enforcing the full merge-truth tuple.

2. Remaining Root Cause

- The shared helper still uses incomplete legacy-to-structured mapping rules for late normal-mode states. Because `closeout_pending` is not mapped explicitly, any resync from the compatibility projection collapses the active attempt back to implementation.
- The closeout gate is still field-presence oriented instead of route-contract oriented. `mark-complete` validates that merge happened, but not that the target-branch sync truth required by the contract is present.
- The verification pack stayed on happy-path artifact materialization. It does not contain the negative proof needed for post-verification resume or incomplete merge-closeout rejection.

3. Next Minimal Fix Pass

- Route: post-verification / post-summary resume truth.
- What still breaks: after `verification-finished` or `completion-summary-written`, the active normal attempt is rewritten to `ready_for_implementation` with a checkpoint of `implementation` / `ready`.
- What minimal additional layers must change: fix the closeout-state mappings in `legacyActiveRunStatusToAttemptStatus()`, `legacyLastCompletedStepToResumeStep()`, and the `syncNormalRunProjectionFromState()` / `recordEvent()` call paths that mirror legacy state into the structured run projection.
- What proof is still required: a targeted proof case that starts from `closeout_pending`, rebuilds from state/projection, and shows the recovered run remains at the closeout or review boundary instead of reopening implementation.

- Route: merge-closeout gate.
- What still breaks: `mark-complete` can succeed while `local_target_sync_status` is still unresolved.
- What minimal additional layers must change: tighten `markComplete()` so completion requires the full merge-truth tuple, including truthful local-target sync status, and keep the completion summary / run projection aligned with that stricter gate.
- What proof is still required: negative proof that merged-but-unsynced state is rejected, plus positive proof that completion succeeds only after merge and target-sync evidence are both present.

Final Verdict: REJECTED
