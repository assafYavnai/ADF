1. Findings

Overall Verdict: REJECTED

Finding 1
- failure class: documentation-only authority-freeze guard
- broken route invariant in one sentence: before implementor spawn or resume, frozen authority files must be compared against base-branch drift and conflicting authority changes must fail closed, but the live helper never performs that check.
- exact route: frozen `implement-plan-contract.md` or `implement-plan-brief.md` authority set -> base-branch authority change on `main` -> `prepareFeature()` -> `evaluateIntegrity()` -> implementor brief or spawn
- exact file/line references: [SKILL.md#L263](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/implement-plan/SKILL.md#L263), [workflow-contract.md#L436](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/implement-plan/references/workflow-contract.md#L436), [implement-plan-helper.mjs#L723](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/implement-plan/scripts/implement-plan-helper.mjs#L723), [implement-plan-helper.mjs#L4501](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/implement-plan/scripts/implement-plan-helper.mjs#L4501), [requirement-freeze-guard.test.mjs#L39](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/tests/requirement-freeze-guard.test.mjs#L39)
- concrete operational impact: `implement-plan` can continue on stale requirements or decisions while the authoritative docs claim the route would push back.
- KPI applicability: not required. KPI closure state: Closed.
- KPI proof or exception gap: the feature contract freezes KPI non-applicability, but the only new proof for this guard is doc-string presence, not runtime enforcement.
- Compatibility verdict: Incompatible.
- sweep scope: `prepare`, `run`, any implementor-resume path, and the existing pushback artifact path.
- closure proof: add helper-level merge-base authority-diff enforcement plus a temp-repo test where `main` changes a frozen authority file after branch-off and `prepare` refuses to proceed.
- shared-surface expansion risk: none.
- negative proof required: prove feature-branch-only authority edits still pass after contract refresh, and prove unchanged base authority does not false-block.
- live/proof isolation risk: none.
- claimed-route vs proved-route mismatch risk: present and material, because the contract promises a merge-base guard while `evaluateIntegrity()` contains no merge-base or authority-diff logic.
- status: live defect.

Finding 2
- failure class: reopen guardrail not enforced in the helper state machine
- broken route invariant in one sentence: an approved review stream must stop when there are no new diffs and no explicit reopen request, but the helper still auto-creates the next cycle.
- exact route: approved `cycle-01` -> later `prepare` on unchanged branch -> `selectCycle()` -> `cycle-02` -> full-pair review requested again
- exact file/line references: [SKILL.md#L256](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/review-cycle/SKILL.md#L256), [workflow-contract.md#L682](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/review-cycle/references/workflow-contract.md#L682), [review-cycle-helper.mjs#L2041](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/review-cycle/scripts/review-cycle-helper.mjs#L2041), [review-cycle-helper.mjs#L2073](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/review-cycle/scripts/review-cycle-helper.mjs#L2073), [review-cycle-helper.mjs#L2215](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/review-cycle/scripts/review-cycle-helper.mjs#L2215), [review-cycle-continuity-reopen.test.mjs#L66](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/tests/review-cycle-continuity-reopen.test.mjs#L66)
- concrete operational impact: already-approved streams can be reopened accidentally, duplicating audit and review work and weakening approval continuity.
- KPI applicability: not required. KPI closure state: Closed.
- KPI proof or exception gap: the new test only proves wording; in a temp repo with a valid approved `cycle-01` and no new commits, local `prepare` returned `cycle_number=2`, `cycle_mode=new`, and `current_cycle_state=review_not_started`.
- Compatibility verdict: Incompatible.
- sweep scope: helper input model, cycle selection, `prepare.summary.next_action`, and any orchestration path that trusts `review_strategy`.
- closure proof: helper-level tests for no-diff approved-stream stop, explicit reopen override, and genuine new-diff reopen.
- shared-surface expansion risk: none.
- negative proof required: prove unchanged approved streams do not reopen and changed streams still do.
- live/proof isolation risk: none.
- claimed-route vs proved-route mismatch risk: present and material; the docs say stop, the live helper says open a new cycle.
- status: live defect.

Finding 3
- failure class: blocker-aware blocked-merge resume not enforced
- broken route invariant in one sentence: stale or conflict-blocked merge requests must require a new approved SHA before requeue, but `resume-blocked` accepts the old conflict SHA unchanged.
- exact route: blocked request with stale or conflict error -> `resume-blocked` -> `input.approvedCommitSha ?? request.approved_commit_sha` -> request reset to `queued` -> `process-next`
- exact file/line references: [SKILL.md#L73](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/merge-queue/SKILL.md#L73), [workflow-contract.md#L79](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/merge-queue/references/workflow-contract.md#L79), [merge-queue-helper.mjs#L482](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/merge-queue/scripts/merge-queue-helper.mjs#L482), [merge-queue-helper.mjs#L496](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/merge-queue/scripts/merge-queue-helper.mjs#L496), [merge-queue-helper.mjs#L514](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/merge-queue/scripts/merge-queue-helper.mjs#L514), [merge-queue-resume-blocked.test.mjs#L98](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/tests/merge-queue-resume-blocked.test.mjs#L98), [merge-queue-resume-blocked.test.mjs#L187](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/tests/merge-queue-resume-blocked.test.mjs#L187)
- concrete operational impact: a request already blocked for merge conflict can be requeued without a newly reviewed commit, so the governed route can recycle known-bad merge authority instead of forcing corrected approval.
- KPI applicability: not required. KPI closure state: Closed.
- KPI proof or exception gap: local `node skills/tests/merge-queue-resume-blocked.test.mjs` passed a test that explicitly preserves `old-sha-123` on a request whose default blocker is `Merge failed: conflict`, so the proof route codifies the opposite of the contract.
- Compatibility verdict: Incompatible.
- sweep scope: blocker classification, `resume-blocked`, caller-facing docs and tests, and any future queue mutation that revives blocked requests.
- closure proof: negative tests for stale and conflict blockers requiring a new SHA, plus a readiness-blocker test proving the route refuses requeue until closeout readiness is fixed.
- shared-surface expansion risk: present on the new `resume-blocked` queue mutation surface.
- negative proof required: prove same-SHA retries are rejected for stale or conflict blockers, and prove requeue still works with a new reviewed SHA.
- live/proof isolation risk: none.
- claimed-route vs proved-route mismatch risk: present; the contract promises blocker-specific gating, but both code and tests prove generic requeue.
- status: live defect.

Finding 4
- failure class: generated closeout artifact still self-trips the stale-language gate
- broken route invariant in one sentence: the generated `completion-summary.md` should be normalized enough to pass the new stale-language detector, but this feature’s own summary still matches every forbidden token.
- exact route: completion-summary generation -> `completion-summary.md` with literal stale tokens -> `mark-complete` -> `detectStaleCloseoutLanguage()` -> refusal to complete
- exact file/line references: [completion-summary.md#L11](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/docs/phase1/governed-implementation-route-hardening/completion-summary.md#L11), [implement-plan-helper.mjs#L1627](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/implement-plan/scripts/implement-plan-helper.mjs#L1627), [implement-plan-helper.mjs#L4125](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/implement-plan/scripts/implement-plan-helper.mjs#L4125), [stale-closeout-language.test.mjs#L118](/C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening/skills/tests/stale-closeout-language.test.mjs#L118)
- concrete operational impact: the hardening route is not self-consistent; a real artifact produced by this feature would fail the closeout gate it claims to have closed.
- KPI applicability: not required. KPI closure state: Closed.
- KPI proof or exception gap: local replay of the helper regex over the current `completion-summary.md` matched `not_ready`, `closeout_pending`, `review_cycle in progress`, `review-cycle in progress`, `approval-pending`, `merge_blocked`, `merge_queued`, and `merge_in_progress`; the test suite only uses synthetic summaries.
- Compatibility verdict: Incompatible.
- sweep scope: completion-summary generation, normalization, helper regex scope, and any feature summary that quotes forbidden tokens as examples.
- closure proof: a real-artifact test using the generated completion-summary shape, or an end-to-end `mark-complete` proof on a normalized summary that contains no stale-token matches.
- shared-surface expansion risk: none.
- negative proof required: prove truthful merged summaries that explain the route without quoting stale status tokens still pass, and prove real stale statuses still fail.
- live/proof isolation risk: present; proof is synthetic-only while the live feature artifact still trips the detector.
- claimed-route vs proved-route mismatch risk: present; claimed route is generated-summary-safe closeout, proved route is only synthetic regex rejection.
- status: regression.

2. Conceptual Root Cause

- Contract text was updated faster than deterministic helper enforcement. The authority-freeze guard and reopen guardrail were added to skill and contract docs, but the live helpers that actually gate `prepare` and cycle selection were not given matching runtime checks.
- The new proof is too documentation-shaped. Two of the new tests only verify wording, and the merge-queue proof even blesses behavior that the contract forbids.
- Review-cycle continuity is only half-materialized. Execution reuse is persisted, but the delta-only fix-pass interface remains a documentation rule rather than a behaviorally enforced surface.
- The stale-closeout validation was added as a raw full-text detector without reconciling the generated human-facing summary shape, so the claimed route and the proved route diverged on the first real artifact.

3. High-Level View Of System Routes That Still Need Work

Route: frozen-authority guard before implementor execution
- what must be frozen before implementation: the exact authority file set referenced by the active contract or brief, plus the base-branch comparison point used to detect drift.
- why endpoint-only fixes will fail: the docs already promise the guard; only helper enforcement can stop `prepare` from proceeding on stale assumptions.
- the minimal layers that must change to close the route: `implement-plan-helper.mjs` prepare or integrity path plus targeted temp-repo tests.
- explicit non-goals, so scope does not widen into general refactoring: no rebase automation, no contract-format redesign, no Brain or bootstrap work.
- what done looks like operationally: when `main` changes a frozen authority file after branch-off, `prepare` writes pushback and blocks until the contract is refreshed.

Route: review-cycle reopen and delta-fix dispatch
- what must be frozen before implementation: the approved-cycle commit boundary and the exact fix-pass request shape.
- why endpoint-only fixes will fail: more prose will not matter while `selectCycle()` still auto-creates `cycle N+1` and the delta-only fix-pass rule is not behaviorally constrained.
- the minimal layers that must change to close the route: `review-cycle-helper.mjs` cycle-selection and input model, plus a testable fix-pass payload or interface.
- explicit non-goals, so scope does not widen into general refactoring: no review-strategy redesign, no agent-registry rewrite, no change to split-verdict policy beyond respecting the reopen gate.
- what done looks like operationally: unchanged approved streams stop, explicit reopen works when requested, genuine new diffs reopen, and normal fix passes resume the same implementor with delta-only input.

Route: blocked-merge resume after conflict or stale approval
- what must be frozen before implementation: the blocker class and the approved-commit requirements for each blocker class.
- why endpoint-only fixes will fail: generic requeue logic will keep reviving known-bad SHAs even if the docs say otherwise.
- the minimal layers that must change to close the route: `merge-queue-helper.mjs` blocker classification and validation plus negative resume tests.
- explicit non-goals, so scope does not widen into general refactoring: no queue-schema rewrite, no manual merge-worktree fallback, no broader merge-policy changes.
- what done looks like operationally: stale and conflict blockers require a new reviewed SHA, readiness blockers only requeue after the readiness issue is fixed, and `process-next` only sees resumed requests that satisfy that gate.

Route: closeout artifact normalization
- what must be frozen before implementation: the human-facing `completion-summary.md` wording that will be fed into `mark-complete`.
- why endpoint-only fixes will fail: helper regex and summary generation must agree; changing only one side leaves the route broken.
- the minimal layers that must change to close the route: completion-summary generation or normalization plus real-artifact closeout tests.
- explicit non-goals, so scope does not widen into general refactoring: no broad rewrite of historical summaries and no weakening of the stale-language detector into a no-op.
- what done looks like operationally: the generated summary communicates truthful route state without matching stale-token patterns, and a real `mark-complete` path passes on that artifact while real stale states still fail.

Final Verdict: REJECTED