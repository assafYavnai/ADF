1. Implementation Objective

Upgrade the repo-owned `implement-plan` skill so implementation runs in a per-feature git worktree on a dedicated feature branch, approved slices hand off to a new FIFO merge skill instead of landing directly from the implementation lane, and feature completion happens only after merge plus safe local sync succeed. Keep the workflow truthful: implementation, machine verification, review-cycle, optional human testing, merge readiness, queued landing, then completion.

2. Slice Scope

- Strengthen [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md), [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md), [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md), and [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs).
- Add worktree-aware feature state and helper behavior for:
  - base branch resolution
  - feature branch naming
  - worktree path resolution
  - worktree creation or reuse
  - truthful worktree and merge lifecycle statuses
  - approved commit tracking
- Create a new repo-owned merge skill with its own contract, prompt, setup helper, and queue helper so approved slices can enqueue a merge request and be landed serially per target branch.
- Update the shared skill manifest and installer/check tooling so the new merge skill is installed and validated for Codex, Claude, and Gemini targets.
- Integrate `implement-plan` with the merge skill so implementation slices stop at merge-ready state, and final completion happens only after merge success updates feature state and indexes.
- Add safe local branch sync behavior after successful merge:
  - always fetch the target branch
  - fast-forward the local target branch only when it is clean and safe
  - surface pending sync truthfully otherwise
- Update only the minimum shared runtime or docs needed to support the new state fields, queue data, and installed skill visibility.
- Update this feature stream's artifacts to reflect the new design and execution proof.

3. Required Deliverables

- A worktree-aware `implement-plan` contract and helper implementation that keeps one canonical feature branch plus one canonical worktree per feature stream.
- New persisted state for at least:
  - base branch
  - feature branch
  - worktree path
  - worktree status
  - approved commit SHA
  - merge status
  - merge commit SHA
- A new merge skill under `C:/ADF/skills/` that supports at minimum:
  - help or settings
  - queue status
  - enqueue merge request
  - process next queued merge request
- A queued merge flow that serializes landings FIFO per target branch, not one global FIFO.
- Merge execution that lands the exact approved commit, not a moving branch head.
- Safe conflict handling that leaves the feature truthful as merge-blocked or ready-for-fix instead of silently forcing resolution.
- Status/reporting updates so `implement-plan` can distinguish:
  - implementation in progress
  - waiting for review
  - waiting for human approval
  - approved and ready to merge
  - merge in progress
  - merge blocked
  - completed after merge
- Shared installer and manifest updates so the merge skill is included in repo-owned source and generated target installs.
- End-to-end proof that a feature can prepare, run, queue a merge request, and complete only after merge success.

4. Allowed Edits

- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
- [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs)
- New repo-owned merge skill files under [skills](/C:/ADF/skills)
- [manifest.json](/C:/ADF/skills/manifest.json)
- [manage-skills.mjs](/C:/ADF/skills/manage-skills.mjs)
- [install-skills.ps1](/C:/ADF/skills/install-skills.ps1) only if needed for merge-skill install/check parity
- Minimal aligned updates under [review-cycle](/C:/ADF/skills/review-cycle) only when required for truthful post-approval or merge-ready status handling
- This feature root under [implement-plan-worktree-merge-queue](/C:/ADF/docs/phase1/implement-plan-worktree-merge-queue)

5. Forbidden Edits

- Do not redesign unrelated ADF runtime or product workflows.
- Do not convert the skills system into a generic git platform or CI orchestrator.
- Do not weaken existing exact-heading contracts, split-verdict handling, immediate report surfacing, or truthful closeout rules.
- Do not land feature code directly on the target branch before approval.
- Do not silently auto-resolve merge conflicts and call the slice complete.
- Do not force-update a dirty local target branch during post-merge sync.
- Do not create repo-local duplicate skill sources outside the repo-owned canonical `C:/ADF/skills` tree.

6. Acceptance Gates

1. `implement-plan` prepares or runs a slice with a deterministic feature branch and worktree path, and persists them in state.
2. Implementation, machine verification, review-cycle, and any human-testing handoff all operate against the feature worktree snapshot instead of the shared base checkout.
3. `implement-plan` no longer marks a reviewed feature completed immediately after implementation closeout; it must stop at a truthful merge-ready state until merge succeeds.
4. A new merge skill can enqueue and process merge requests FIFO per target branch.
5. The merge skill merges the exact approved commit SHA into the latest fetched target branch snapshot, not a moving feature head.
6. If merge conflicts occur, the merge skill fails truthfully and leaves the feature resumable for follow-up fixes instead of forcing completion.
7. After successful merge and push, the feature is marked completed and the project features index reflects that state.
8. After successful merge, the merge flow fetches the local target branch automatically and fast-forwards the local checkout only when it is clean and safe; otherwise it records that sync is pending.
9. Shared installer/check flow includes the new merge skill for Codex, Claude, and Gemini generated targets.
10. Existing `implement-plan` and `review-cycle` contract strengths remain intact, including exact headings, verification discipline, and truthful status reporting.

Machine Verification Plan
- Run `node --check` on every modified helper or runtime script, including the new merge-skill helpers.
- Run `git diff --check` on the changed source set.
- Run targeted helper smoke checks for:
  - `implement-plan` prepare or list-features behavior with new worktree state fields
  - merge-skill help or status output
  - merge-request enqueue and queue status behavior
  - merge processing on a temp git sandbox with a bare remote and at least one clean merge path
- Refresh and validate installed skill targets with `manage-skills install/check` for Codex, Claude, and Gemini.

Human Verification Plan
- Required: false
- Reason: this slice changes skill orchestration, git/worktree helpers, queue handling, and installed skill surfaces. Route closure can be proven through machine verification, repo-side artifacts, and governed review rather than a separate human-facing product test.

7. Observability / Audit

- Feature state must make the current branch, feature branch, worktree path, worktree status, merge status, approved commit SHA, and merge commit SHA truthfully visible.
- Queue state must make it obvious which merge requests are pending, in progress, merged, or blocked, and on which target branch lane they are waiting.
- Completion summaries must distinguish implementation approval from merge completion.
- Post-merge sync status must be visible when automatic fetch succeeded but fast-forward of the local target branch was skipped because the checkout was dirty or unsafe.
- Any surfaced merge failure must explain whether the blocker is conflict, missing approved commit, stale branch state, dirty target checkout, or push failure.

8. Dependencies / Constraints

- Preserve the current four feature statuses: `active`, `blocked`, `completed`, `closed`.
- Use active-run or merge-status fields for intermediate states instead of widening the top-level status model unless a justified contract change is required.
- Worktree paths must be deterministic and safe for concurrent feature execution.
- The merge queue must serialize by base branch lane while still allowing separate base branches to progress independently.
- The merge skill should be repo-owned source and generated into user install targets like the existing skills.
- Keep prompts and contracts short and operational.
- Do not assume the local target branch checkout can always be fast-forwarded safely after merge.

9. Non-Goals

- No broad redesign of review-cycle artifact layout.
- No replacement of `review-cycle` with the merge skill.
- No UI or product-surface feature work.
- No removal of the existing generated skill install target model in this slice.

10. Source Authorities

- [README.md](/C:/ADF/docs/phase1/implement-plan-worktree-merge-queue/README.md)
- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
- [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs)
- [SKILL.md](/C:/ADF/skills/review-cycle/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/review-cycle/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/review-cycle/references/prompt-templates.md)
- [manifest.json](/C:/ADF/skills/manifest.json)
- [manage-skills.mjs](/C:/ADF/skills/manage-skills.mjs)
- [skills-repo-migration-plan.md](/C:/ADF/docs/skills-repo-migration-plan.md)
