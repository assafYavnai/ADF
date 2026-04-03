1. Implementation Objective

Harden repo-owned `implement-plan`, `merge-queue`, and shared governed-runtime helpers so approved-commit freeze, canonical roots, blocked-request recovery, clean target sync, and human-facing failure output are deterministic and no longer depend on post-approval tracked-file rewrites.

2. Exact Slice Scope

- Repo-owned `implement-plan` contracts, prompt templates, and helper state/index behavior.
- Repo-owned `merge-queue` contracts, prompt templates, and deterministic helper behavior.
- Shared workflow runtime helpers only where canonical-root inference or subprocess failure reporting are truly shared.
- Feature artifacts under [implement-plan-review-cycle-kpi-enforcement](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement).

3. Inputs / Authorities Read

- [README.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/README.md)
- [context.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/context.md)
- [implement-plan-contract.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/implement-plan-contract.md)
- [kpi-instrumentation-requirement.md](/C:/ADF/docs/v0/kpi-instrumentation-requirement.md)
- [2026-04-03-human-facing-reporting-rule.md](/C:/ADF/docs/v0/context/2026-04-03-human-facing-reporting-rule.md)
- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
- [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs)
- [SKILL.md](/C:/ADF/skills/merge-queue/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/merge-queue/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/merge-queue/references/prompt-templates.md)
- [merge-queue-helper.mjs](/C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs)
- [governed-feature-runtime.mjs](/C:/ADF/skills/governed-feature-runtime.mjs)

4. Required Deliverables

- `implement-plan-helper.mjs` support for canonical-vs-execution root separation plus automatic approved-SHA freeze at `merge-ready`.
- Expanded `.codex/implement-plan/features-index.json` handoff fields so merge-queue no longer depends on tracked feature docs after push.
- `merge-queue-helper.mjs` support for exact-SHA fetch and reachability validation, retry-request, requeue-request, clean target sync, transition history, and human-facing failure output.
- Workflow-contract and prompt-template updates that document the new local operational closeout behavior truthfully.
- Updated feature artifacts and truthful completion reporting.

5. Forbidden Edits

- Do not widen into product telemetry or COO runtime route work.
- Do not weaken KPI gating or human-facing report rules already established.
- Do not reintroduce tracked-doc rewrites after approval just to mirror queue state.
- Do not hide command failures behind generic helper-failed wording.

6. Integrity-Verified Assumptions Only

- The current merge-queue flow still depends on tracked `implement-plan-state.json` rewrites after enqueue or merge, which is the root cause of the dirty-worktree closeout problem.
- The current merge-queue flow fetches only the base branch before merging the approved SHA, so the exact approved commit can still be missing locally.
- The current helper surface lacks first-class retry or requeue actions for blocked entries.
- The current feature and queue state model confuses canonical repo root with execution worktree root.
- This slice is workflow-only, so `KPI Applicability: not required` is truthful.

7. Explicit Non-Goals

- No COO runtime KPI implementation work.
- No review-cycle redesign unless a minimal wording sync becomes necessary for consistency.
- No destructive cleanup of the user’s dirty root checkout.
- No git history rewriting.

8. Proof / Verification Expectations

- `node --check` for modified helper and runtime files.
- Targeted `implement-plan-helper.mjs` smoke proving `merge-ready` freezes `approved_commit_sha`.
- Targeted `merge-queue-helper.mjs` smoke proving exact-SHA fetch and reachability checks, blocked-entry retry, blocked-entry requeue, and local operational closeout without tracked post-approval rewrites.
- A small queue-processing smoke proving dirty shared-root sync falls back to a truthful clean-worktree result.
- Machine Verification Plan:
  - `node --check` on modified `.mjs` files
  - targeted helper smokes for merge-ready handoff and queue recovery
  - targeted status/output checks for human-facing failure results
- Human Verification Plan:
  - `Required: false`
  - reason: this is internal workflow-governance work, not a separate human-facing product route

9. Required Artifact Updates

- [implement-plan-contract.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/implement-plan-contract.md)
- [implement-plan-brief.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/implement-plan-brief.md)
- [implement-plan-state.json](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/implement-plan-state.json)
- [completion-summary.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/completion-summary.md)
- Modified repo-owned skill contracts, prompts, helpers, and shared runtime helpers touched by this slice

10. Closeout Rules

- Keep the slice bounded to approved-commit handoff, queue recovery, canonical roots, clean target sync, and human-facing reporting.
- Do not claim merge or completion unless the helper can prove the exact merge commit and the resulting local operational closeout state truthfully.
- Do not mutate tracked feature artifacts after approval just to mirror queue or merge lifecycle state.
- Commit and push feature-branch changes with a detailed commit message after verification passes.
- Leave merge handoff truthful and resumable if review or merge-queue is not run in this execution.
