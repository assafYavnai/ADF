# Title
Implement-plan skill family build and global skills repo closeout

## Metadata
- created_at: 2026-04-02T20:51:39.7632824+03:00
- workspace: C:/ADF
- save_root: C:/ADF/memory/savepoints
- previous_savepoint: memory/savepoints/2026-03-31/233917-coo-stabilization-plan.md
- boundary_confidence: medium

## Highlighted Topic
The thread built and hardened the global `review-cycle` family first, then added a new global `implement-plan` / `implement-plan-setup` skill family with shared runtime helpers, resumable per-feature state, transparent setup refresh, integrity gating, feature lifecycle indexing, and completion reporting.

## Discussion Summary
The work started by tightening `review-cycle` and `review-cycle-setup` around truthful access-mode selection, full-loop control, agent reuse, report surfacing, and resumable closeout behavior. A hardened refactor from `tmp/review-cycle-refactored` was compared against local/global copies and merged without losing the existing report-ready notification wrapper. A flattened upload bundle was exported to `tmp/review-cycle-v2`, and the global skills folder under `C:/Users/sufin/.codex/skills` was turned into a Git repository backed by `https://github.com/assafYavnai/codex-skills`.

The second half of the thread created a new global governed implementation family: `implement-plan` and `implement-plan-setup`. The implementation used an additive shared runtime module instead of modifying `review-cycle`, so both families remain compatible while minimizing regression risk. The new helper layer now handles slug/path safety, atomic JSON writes, narrow lock directories, setup validation, lifecycle state, feature index management, agent registry continuity, integrity pushback generation, and completion-summary rendering. The staged package under `tmp/implement-plan-stage` was validated, smoke-tested against a temporary project root, and then installed into the global skills repo.

## Decisions Made
- Keep `review-cycle` and `implement-plan` compatible through shared artifact conventions, but extract only additive shared runtime code to avoid breaking active review-cycle behavior.
- Make `implement-plan` transparent about setup refresh: the main skill must validate or regenerate setup internally instead of requiring a separate user-visible setup step.
- Persist feature lifecycle status centrally in `features-index.json` and refuse `run` on `completed` or `closed` features.
- Use per-feature and project-level lock directories plus atomic writes for thread-safe helper state changes.
- Install the new skill family globally under `C:/Users/sufin/.codex/skills` and keep the staged source bundle under `tmp/implement-plan-stage` for local recovery.
- Maintain the exact report-ready notification wrapper previously added to `review-cycle`.

## Open Loops
- Commit and push the new global skills repo changes after saving this checkpoint.
- Optionally create an initial git commit for the new `implement-plan` family if the user wants the repo history finalized in this turn.
- If needed later, refine `implement-plan` project-doc discovery to distinguish sibling-phase evidence more selectively.

## Next Likely Steps
- Save a repo-local report file summarizing the new skill family and validation results.
- Commit `_shared/`, `implement-plan/`, `implement-plan-setup/`, and the saved report in `C:/Users/sufin/.codex/skills`.
- Push `main` to `origin` in the global skills repo.
- Restart Codex if the session needs to pick up the new global skills metadata immediately.

## Referenced Files
- AGENTS.md
- docs/bootstrap/cli-agent.md
- tmp/review-cycle-v2/review-cycle.SKILL.md
- tmp/review-cycle-v2/review-cycle-setup.SKILL.md
- tmp/implement-plan-stage/_shared/governed-feature-runtime.mjs
- tmp/implement-plan-stage/implement-plan/SKILL.md
- tmp/implement-plan-stage/implement-plan/references/workflow-contract.md
- tmp/implement-plan-stage/implement-plan/references/prompt-templates.md
- tmp/implement-plan-stage/implement-plan/scripts/implement-plan-helper.mjs
- tmp/implement-plan-stage/implement-plan-setup/SKILL.md
- tmp/implement-plan-stage/implement-plan-setup/references/setup-contract.md
- tmp/implement-plan-stage/implement-plan-setup/scripts/implement-plan-setup-helper.mjs

## User Prompts
1. Asked to implement a reusable `review-cycle` skill with one full review/fix cycle per invocation and persistent reviewer continuity.
2. Asked to install the skill globally, then revise it to enforce strongest autonomous access mode and patch `review-cycle-setup` accordingly.
3. Asked whether reviewer lanes run in parallel and how implementor coordination should work.
4. Directed the workflow toward full-loop orchestration with persistent per-feature agent reuse and global installation while preserving the notification template.
5. Asked to inspect a hardened `review-cycle` refactor in `tmp/review-cycle-refactored`, merge it smartly, export the merged bundle flat to `tmp/review-cycle-v2`, and create a git repo for global skills.
6. Asked to build a new global governed implementation skill family: `implement-plan` and `implement-plan-setup`, compatible with `review-cycle` and using transparent setup, lifecycle tracking, integrity gating, and commit/push closeout.
7. Asked to save the report, commit all skills and the report, and push to origin.

## Assistant Responses
1. Implemented and installed the initial `review-cycle` family, then explained its runtime behavior, parallel review design, and persistence model.
2. Patched `review-cycle` and `review-cycle-setup` for truthful access-mode resolution, full-loop orchestration, resume logic, and detected-status reporting.
3. Clarified that the orchestrator, not the implementor, should own completion detection and that the implementor should wait until both reviewer reports exist.
4. Updated the global `review-cycle` family to preserve the exact report-ready notification wrapper and to reuse per-feature auditor, reviewer, and implementor lanes.
5. Compared the hardened refactor with local/global copies, merged the stronger validation logic into the installed skills, exported a flat upload bundle, and initialized/pushed the global skills git repo.
6. Built `implement-plan` and `implement-plan-setup` with an additive shared runtime module, thread-safe helpers, lifecycle/index support, transparent setup refresh, integrity pushback flow, and completion-summary support; validated the staged and installed copies with syntax checks, quick validation, and smoke tests.
7. Prepared to save this checkpoint and close out the global skills repo by committing and pushing the new files.

