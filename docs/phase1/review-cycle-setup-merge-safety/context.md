# Feature Context

## Feature

- phase_number: 1
- feature_slug: review-cycle-setup-merge-safety
- project_root: C:/ADF
- feature_root: C:/ADF/.codex/implement-plan/worktrees/phase1/review-cycle-setup-merge-safety/docs/phase1/review-cycle-setup-merge-safety
- current_branch: implement-plan/phase1/review-cycle-setup-merge-safety

## Task Summary

Prevent merge conflicts from tracked worktree-local `.codex` setup files by treating `review-cycle` setup as local operational state and blocking governed merge closeout when such setup files are present in an approved branch delta.

## Scope Hint

Keep the fix inside `review-cycle` local setup handling, `merge-queue` merge safety, and the authority docs that describe those contracts.

## Non-Goals

Do not redesign review routing, worker selection, merge strategy, or unrelated implement-plan artifact behavior.

## Discovered Authorities

- [project-doc] C:/ADF/AGENTS.md
- [project-doc] C:/ADF/docs/bootstrap/cli-agent.md
- [feature-doc] C:/ADF/docs/phase1/review-cycle-setup-merge-safety/README.md
- [repo-doc] C:/ADF/skills/review-cycle/SKILL.md
- [repo-doc] C:/ADF/skills/review-cycle/references/workflow-contract.md
- [repo-doc] C:/ADF/skills/review-cycle/references/setup-contract.md
- [repo-doc] C:/ADF/skills/merge-queue/SKILL.md
- [repo-doc] C:/ADF/skills/merge-queue/references/workflow-contract.md
- [repo-code] C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs

## Notes

- The prior merge blocker came from a tracked `.codex/review-cycle/setup.json` conflict between two feature worktrees.
- `.gitignore` already ignores `.codex/`; the actual problem was that this one setup file was already tracked.
- The smallest truthful fix is to untrack the setup file and reject future approved commits that try to carry `.codex/*/setup.json`.
