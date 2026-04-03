1. Implementation Objective

Implement a worktree-first `implement-plan` flow that executes each feature stream on its own feature branch and git worktree, stops at merge-ready state after approvals, and hands the exact approved commit to a new FIFO merge skill that lands changes serially per target branch and marks the feature completed only after merge plus safe sync succeed.

2. Exact Slice Scope

- Update the repo-owned `implement-plan` skill contract, prompts, and helper to track worktree and merge lifecycle state.
- Add worktree creation, reuse, and truthful state persistence for feature runs.
- Create a new repo-owned merge skill with queue, status, enqueue, and process-next behavior.
- Update shared skill install/check wiring so the merge skill is included in generated Codex, Claude, and Gemini targets.
- Update feature artifacts and completion reporting for the new merge-ready and merge-complete lifecycle.

3. Inputs / Authorities Read

- [README.md](/C:/ADF/docs/phase1/implement-plan-worktree-merge-queue/README.md)
- [context.md](/C:/ADF/docs/phase1/implement-plan-worktree-merge-queue/context.md)
- [implement-plan-contract.md](/C:/ADF/docs/phase1/implement-plan-worktree-merge-queue/implement-plan-contract.md)
- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
- [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs)
- [SKILL.md](/C:/ADF/skills/review-cycle/SKILL.md)
- [manifest.json](/C:/ADF/skills/manifest.json)
- [manage-skills.mjs](/C:/ADF/skills/manage-skills.mjs)

4. Required Deliverables

- Worktree-aware `implement-plan` state, contract, and helper behavior.
- New repo-owned merge skill source with setup/helper/runtime contracts.
- FIFO-per-target-branch merge queue behavior with truthful blocked or merged outcomes.
- Merge-ready versus completed feature-state handling.
- Generated-target install/check support for the merge skill.
- Feature artifacts and completion summary proving the new flow.

5. Forbidden Edits

- No unrelated ADF workflow redesign.
- No direct landing of unapproved feature changes onto the base branch.
- No silent merge-conflict auto-resolution.
- No weakening of exact heading contracts, review-cycle discipline, or truthful completion reporting.
- No force-updating a dirty local target branch during sync.

6. Integrity-Verified Assumptions Only

- Repo-owned skill source of truth is `C:/ADF/skills`.
- Generated install targets are produced through `manage-skills.mjs`.
- `implement-plan` currently tracks feature lifecycle in feature-local state plus project-level registry and features index.
- `review-cycle` remains the review gate; merge handling is a separate concern.
- The current top-level feature statuses remain `active`, `blocked`, `completed`, and `closed`.

7. Explicit Non-Goals

- No replacement of `review-cycle`.
- No product-surface UI work.
- No general-purpose CI or deployment orchestration.
- No removal of the generated skill install model.

8. Proof / Verification Expectations

Machine Verification Plan
- Run `node --check` on all modified helpers and runtime scripts.
- Run `git diff --check` on the changed source set.
- Run targeted `implement-plan` helper smoke checks for the new worktree fields and merge-ready state handling.
- Run merge-skill smoke checks for help/status, enqueue, and process-next behavior.
- Run at least one temp-repo clean-merge integration smoke that proves queue processing can land an approved commit and update status truthfully.
- Refresh and validate installed skills for Codex, Claude, and Gemini with `manage-skills install/check`.

Human Verification Plan
- Required: false
- Reason: this slice changes internal skill orchestration, git helpers, queue state, and install surfaces. Machine proof plus governed review is sufficient.

9. Required Artifact Updates

- [implement-plan-state.json](/C:/ADF/docs/phase1/implement-plan-worktree-merge-queue/implement-plan-state.json)
- [completion-summary.md](/C:/ADF/docs/phase1/implement-plan-worktree-merge-queue/completion-summary.md)
- This feature stream's review-cycle artifacts if post-review handoff runs
- Repo-owned skill docs and helper contracts materially changed by the implementation

10. Closeout Rules

- Keep the feature active until merge success, even if implementation and review approval are already complete.
- If human testing is not required and review closes cleanly, enqueue the approved commit for merge rather than marking the feature completed immediately.
- Mark the feature completed only after merge success, push success, and truthful sync-state recording.
- If merge blocks or conflicts, keep the feature resumable and do not silently complete it.
