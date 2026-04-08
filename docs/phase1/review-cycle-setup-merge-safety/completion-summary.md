1. Objective Completed

Prevented merge conflicts from tracked worktree-local .codex setup files by treating review-cycle setup as local operational state and blocking governed merge closeout when such setup files are present in an approved branch delta.
- Repo-owned completion truth now matches the approved review and merged feature lifecycle.
- Final closeout reflects cycle-01 approved and closed and merge commit f8134d9febee3ef73d4a596a42ff7d9985d38fff.

2. Deliverables Produced

- Removed .codex/review-cycle/setup.json from source control so worktree-local review setup stops participating in merges.
- Added branch-delta inspection and local-setup guard at merge-queue enqueue and process time.
- Documented the new rejection rule, allowed one-time deletion, and local-only setup rule across all affected authority docs.
- Reconciled the repo-owned completion artifacts to canonical main-root paths and merged closeout truth.

3. Files Changed And Why

- `.codex/review-cycle/setup.json`: removed from source control.
- `skills/merge-queue/scripts/merge-queue-helper.mjs`: added branch-delta inspection and local-setup guard at enqueue and process time.
- `skills/merge-queue/SKILL.md`: documented the new rejection rule and the allowed one-time deletion.
- `skills/merge-queue/references/workflow-contract.md`: documented that enqueue and process both reject added or modified `.codex/*/setup.json`.
- `skills/review-cycle/SKILL.md`: documented that review-cycle setup is local operational state.
- `skills/review-cycle/references/workflow-contract.md`: documented the local-only setup rule.
- `skills/review-cycle/references/setup-contract.md`: documented that setup.json is local operational state and must not be committed.

4. Verification Evidence

- `node --check skills/merge-queue/scripts/merge-queue-helper.mjs` passed.
- `git diff --check` passed.
- Negative proof: merge-queue enqueue rejected a commit containing `.codex/review-cycle/setup.json`.
- Positive proof: pure deletion of the previously tracked setup file was allowed.
- Local recreation: `review-cycle-setup-helper.mjs write-setup` recreated setup.json locally without it being tracked.
- Generated installs: `node skills/manage-skills.mjs install` and `check` both passed.
- Execution Contract / Run Projection Proof: repo-owned state, execution contract, and run projection now point at canonical C:/ADF artifact paths.
- Review-Cycle Status: cycle-01 approved and closed
- Merge Status: merged via merge-queue (merge commit f8134d9febee3ef73d4a596a42ff7d9985d38fff)
- Local Target Sync Status: fetched_only

5. Feature Artifacts Updated

- docs/phase1/review-cycle-setup-merge-safety/README.md
- docs/phase1/review-cycle-setup-merge-safety/context.md
- docs/phase1/review-cycle-setup-merge-safety/implement-plan-contract.md
- docs/phase1/review-cycle-setup-merge-safety/cycle-01/audit-findings.md
- docs/phase1/review-cycle-setup-merge-safety/cycle-01/review-findings.md
- docs/phase1/review-cycle-setup-merge-safety/cycle-01/fix-plan.md
- docs/phase1/review-cycle-setup-merge-safety/cycle-01/fix-report.md
- docs/phase1/review-cycle-setup-merge-safety/completion-summary.md
- docs/phase1/review-cycle-setup-merge-safety/implement-plan-state.json
- `docs/phase1/review-cycle-setup-merge-safety/completion-summary.md`
- `docs/phase1/review-cycle-setup-merge-safety/implement-plan-state.json`
- `docs/phase1/review-cycle-setup-merge-safety/implementation-run/`

6. Commit And Push Result

- Approved feature commit: f8134d9febee3ef73d4a596a42ff7d9985d38fff
- Merge commit: f8134d9febee3ef73d4a596a42ff7d9985d38fff
- Push: success to origin/main
- Closeout note: Legacy already-landed feature reconciled to completed state after cycle-01 review approval. Code was already on main at f8134d9. No merge-queue replay was performed.

7. Remaining Non-Goals / Debt

- The separate implement-plan bug that writes new feature docs into the main checkout before worktree creation still exists and was intentionally left out of this slice.
- No broader .codex artifact cleanup was attempted.