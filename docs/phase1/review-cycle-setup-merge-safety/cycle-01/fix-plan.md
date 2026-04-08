1. Failure Classes

- Prevent tracked local operational setup files from entering mergeable source history through governed review or merge routes.

2. Route Contracts

- Claimed supported route: `review-cycle` setup refresh stays local to the active checkout or worktree, and `merge-queue` rejects approved branch deltas that add or modify `.codex/*/setup.json`.
- End-to-end invariant: local operational setup is regenerated locally and never merged as source; the one-time tracked-file deletion is allowed so the repo can transition out of the bad state.
- KPI Applicability: not required.
- KPI Non-Applicability Rationale: this slice closes workflow-governance merge safety rather than a production KPI route.
- Vision Compatibility: keeps governed execution durable by separating local runtime setup from mergeable source history.
- Phase 1 Compatibility: hardens the Phase 1 implementation/review/merge workflow without widening scope.
- Master-Plan Compatibility: removes a class of merge blockers that corrupt closeout truth.
- Current Gap-Closure Compatibility: supports Gap D parallel implementation safety by preventing worktree-local state collisions.
- Later-Company Check: no.
- Compatibility Decision: compatible.
- Compatibility Evidence: the prior blocked merge was caused by a tracked `.codex/review-cycle/setup.json` conflict, not by the feature code.
- Allowed mutation surfaces: `.codex/review-cycle/setup.json` deletion from source control, review-cycle authority docs, merge-queue helper logic, merge-queue authority docs, and this feature-stream documentation.
- Forbidden shared-surface expansion: no new runtime knobs, no merge-strategy redesign, no review-lane orchestration changes.
- Docs that must be updated: `skills/review-cycle/SKILL.md`, `skills/review-cycle/references/workflow-contract.md`, `skills/review-cycle/references/setup-contract.md`, `skills/merge-queue/SKILL.md`, `skills/merge-queue/references/workflow-contract.md`, and the feature docs under `docs/phase1/review-cycle-setup-merge-safety/`.

3. Sweep Scope

- Check `.codex/*/setup.json` as the full local-setup pattern, not only `review-cycle`.
- Check both merge-queue entry points: `enqueue` and `process-next`.
- Check review-cycle authority docs and setup contract so the runtime behavior and repo truth stay aligned.

4. Planned Changes

- Remove the tracked repo copy of `.codex/review-cycle/setup.json`.
- Teach `merge-queue-helper.mjs` to inspect approved branch deltas against the base branch and reject added or modified `.codex/*/setup.json`.
- Allow pure deletion of the tracked setup file so the repo can migrate out of the broken state.
- Update the review-cycle and merge-queue docs so the guard and the local-only setup rule are explicit.

5. Closure Proof

- `node --check skills/merge-queue/scripts/merge-queue-helper.mjs`
- `git diff --check`
- prove the historical bad pattern with a commit whose branch delta adds `.codex/review-cycle/setup.json`; helper must reject enqueue with the local-operational-state message
- prove the allowed path with the current branch delta showing `D .codex/review-cycle/setup.json`
- recreate review-cycle setup locally with `review-cycle-setup-helper.mjs write-setup` and confirm `git status` stays clean because the file is ignored and no longer tracked
- run `skills/manage-skills.mjs install` and `skills/manage-skills.mjs check`

6. Non-Goals

- Do not fix the separate implement-plan artifact-placement bug in this slice.
- Do not redesign merge-queue lane ordering or merge mechanics.
- Do not widen into generic `.codex` cleanup.
