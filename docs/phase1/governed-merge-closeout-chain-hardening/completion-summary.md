1. Objective Completed

Closed the governed merge-closeout chain so valid approved features can land and mark complete automatically without manual cleanup, while invalid closeout artifacts are blocked before merge.

2. Deliverables Produced

- Helper-owned `normalize-completion-summary` command in implement-plan-helper.mjs that rewrites malformed summaries to the exact 7-heading contract
- Helper-owned `validate-closeout-readiness` command in implement-plan-helper.mjs that checks summary validity and feature state before merge
- Pre-merge closeout-readiness gate in `merge-queue process-next` that blocks before merge/push when closeout is invalid
- Automatic normalization in `review-cycle-helper.mjs`: `record-event closeout-finished` calls `normalize-completion-summary` via spawnSync when both review lanes approved
- Standalone `normalize-closeout-artifacts` command in review-cycle-helper.mjs for explicit invocation
- Updated authoritative docs/contracts for `implement-plan`, `review-cycle`, and `merge-queue`

3. Files Changed And Why

- `skills/implement-plan/scripts/implement-plan-helper.mjs` — added `normalize-completion-summary` and `validate-closeout-readiness` commands
- `skills/merge-queue/scripts/merge-queue-helper.mjs` — added `validateCloseoutReadinessBeforeMerge()` gate in `processNext()`
- `skills/review-cycle/scripts/review-cycle-helper.mjs` — wired `record-event closeout-finished` to auto-call normalization on approval; added `normalize-closeout-artifacts` command; added `runCloseoutNormalization()` and `resolveWorktreeRoot()` helpers
- `skills/implement-plan/SKILL.md` — documented new helper commands, added normalization directive to run action
- `skills/implement-plan/references/workflow-contract.md` — documented normalization and validation rules
- `skills/merge-queue/SKILL.md` — documented pre-merge closeout-readiness validation rule
- `skills/merge-queue/references/workflow-contract.md` — added closeout-readiness bullet to process rules
- `skills/review-cycle/SKILL.md` — added completion-summary normalization rule for approval closeout
- `skills/review-cycle/references/workflow-contract.md` — added normalization rule and updated git closeout rules
- `docs/phase1/governed-merge-closeout-chain-hardening/context.md` — updated implementation summary
- `docs/phase1/governed-merge-closeout-chain-hardening/completion-summary.md` — this file

4. Verification Evidence

- Machine Verification: `node --check` passed on all modified helper/runtime scripts; `git diff --check` passed
- Human Verification Requirement: not required
- Human Verification Status: not applicable
- Review-Cycle Status: pending
- Merge Status: pending
- Local Target Sync Status: pending
- `record-event closeout-finished` with both lanes approved automatically called normalization: `success: true, normalized: true` — converted `5. Review-Cycle Status` to `5. Feature Artifacts Updated`
- `normalize-closeout-artifacts` skips correctly when cycle is not an approval: `skipped: true`
- `validate-closeout-readiness` returns `closeout_ready: false` with explicit blockers for invalid/missing completion summaries
- `mark-complete` returns exit code 1 with "Refusing to mark complete without last_commit_sha evidence" when prerequisites are missing
- `merge-queue process-next` merge command at line 383 still uses `selected.approved_commit_sha` — exact approved SHA preserved

5. Feature Artifacts Updated

- `docs/phase1/governed-merge-closeout-chain-hardening/completion-summary.md`
- `docs/phase1/governed-merge-closeout-chain-hardening/context.md`
- `docs/phase1/governed-merge-closeout-chain-hardening/README.md`
- `docs/phase1/governed-merge-closeout-chain-hardening/implement-plan-contract.md`

6. Commit And Push Result

- Feature branch: implement-plan/phase1/governed-merge-closeout-chain-hardening
- Push: pending

7. Remaining Non-Goals / Debt

- No broad merge-queue redesign, worker-selection redesign, or product/runtime behavior changes.
- No auto-rewriting of already-approved commits after merge starts.
