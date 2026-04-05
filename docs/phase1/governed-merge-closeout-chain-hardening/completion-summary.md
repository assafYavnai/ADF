1. Objective Completed

Hardened the governed merge-closeout chain so valid approved features can land and mark complete automatically without manual cleanup, while invalid closeout artifacts are blocked before merge.

2. Deliverables Produced

- `normalize-completion-summary` command in implement-plan-helper.mjs: rewrites malformed summaries to the exact 7-heading contract
- `validate-closeout-readiness` command in implement-plan-helper.mjs: checks summary validity and feature state before merge
- Pre-merge closeout-readiness gate in merge-queue-helper.mjs `processNext()`: blocks before merge/push when closeout is invalid
- Automatic normalization in review-cycle-helper.mjs: `record-event closeout-finished` calls `normalize-completion-summary` via spawnSync when both review lanes approved
- `normalize-closeout-artifacts` command in review-cycle-helper.mjs for explicit invocation
- Updated SKILL.md and workflow-contract.md for implement-plan, review-cycle, and merge-queue

3. Files Changed And Why

- `skills/implement-plan/scripts/implement-plan-helper.mjs` — added `normalize-completion-summary` and `validate-closeout-readiness` commands
- `skills/merge-queue/scripts/merge-queue-helper.mjs` — added `validateCloseoutReadinessBeforeMerge()` gate in `processNext()`
- `skills/review-cycle/scripts/review-cycle-helper.mjs` — wired `record-event closeout-finished` to auto-call normalization on approval; added `normalize-closeout-artifacts`, `runCloseoutNormalization()`, `resolveWorktreeRoot()`
- `skills/implement-plan/SKILL.md` — documented new commands and normalization directive
- `skills/implement-plan/references/workflow-contract.md` — documented normalization and validation rules
- `skills/merge-queue/SKILL.md` — documented pre-merge closeout-readiness validation
- `skills/merge-queue/references/workflow-contract.md` — added closeout-readiness to process rules
- `skills/review-cycle/SKILL.md` — added completion-summary normalization rule for approval closeout
- `skills/review-cycle/references/workflow-contract.md` — added normalization rule and updated git closeout rules

4. Verification Evidence

- Machine Verification: `node --check` passed on all 7 helper/runtime scripts
- Human Verification Requirement: not required
- Human Verification Status: not applicable
- Review-Cycle Status: pending governed review-cycle
- Merge Status: pending governed merge-queue
- Local Target Sync Status: pending
- normalize-completion-summary converts malformed heading to contract-valid: `normalized: true, valid: true`
- validate-closeout-readiness blocks invalid: `closeout_ready: false, blockers: [Missing required headings]`
- mark-complete fails closed: exit 1, "merge_status is not_ready instead of merged"
- merge-queue merge command at line 383 uses `selected.approved_commit_sha` unchanged
- review-cycle record-event closeout-finished auto-normalizes on approval: `success: true, normalized: true`
- pre-merge gate exists at merge-queue-helper.mjs line 364

5. Feature Artifacts Updated

- `docs/phase1/governed-merge-closeout-chain-hardening/completion-summary.md`
- `docs/phase1/governed-merge-closeout-chain-hardening/context.md`
- `docs/phase1/governed-merge-closeout-chain-hardening/README.md`
- `docs/phase1/governed-merge-closeout-chain-hardening/implement-plan-state.json`

6. Commit And Push Result

- Feature branch: implement-plan/phase1/governed-merge-closeout-chain-hardening
- Push: pending

7. Remaining Non-Goals / Debt

- No broad merge-queue redesign, worker-selection redesign, or product/runtime behavior changes.
