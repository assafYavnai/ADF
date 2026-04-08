1. Implementation Objective

Execute the bounded Spec 1 slice for `implement-plan` in this feature worktree so the shared execution contract, identity model, resumable state, event log, KPI substrate, and governed normal-mode route are fully implemented and verified without widening into benchmark supervision or other later specs.

2. Exact Slice Scope

- Repo-owned workflow/runtime files only:
  - [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
  - [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
  - [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
  - [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs)
  - [governed-feature-runtime.mjs](/C:/ADF/skills/governed-feature-runtime.mjs)
- Minimal review integration surfaces only if needed for truthful routed review:
  - [SKILL.md](/C:/ADF/skills/review-cycle/SKILL.md)
  - [workflow-contract.md](/C:/ADF/skills/review-cycle/references/workflow-contract.md)
  - [prompt-templates.md](/C:/ADF/skills/review-cycle/references/prompt-templates.md)
- Feature artifacts under [implement-plan-provider-neutral-run-contract](/C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-provider-neutral-run-contract/docs/phase1/implement-plan-provider-neutral-run-contract)
- Machine verification, review-cycle handoff, and merge-queue handoff required for closeout

3. Inputs / Authorities Read

- [README.md](/C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-provider-neutral-run-contract/docs/phase1/implement-plan-provider-neutral-run-contract/README.md)
- [context.md](/C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-provider-neutral-run-contract/docs/phase1/implement-plan-provider-neutral-run-contract/context.md)
- [implement-plan-contract.md](/C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-provider-neutral-run-contract/docs/phase1/implement-plan-provider-neutral-run-contract/implement-plan-contract.md)
- [AGENTS.md](/C:/ADF/AGENTS.md)
- [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md)
- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
- [SKILL.md](/C:/ADF/skills/review-cycle/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/review-cycle/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/review-cycle/references/prompt-templates.md)
- [SKILL.md](/C:/ADF/skills/merge-queue/SKILL.md)
- [governed-feature-runtime.mjs](/C:/ADF/skills/governed-feature-runtime.mjs)

4. Required Deliverables

- Unified `prepare`/`run` execution contract and truthful contract/projection artifacts for Spec 1
- Truthful normal-mode governed route behavior with no benchmark-style shortcuts
- Durable identity split across feature, run, attempt, worker, and lane
- Durable reset/resume/event/KPI substrate consistent with the contract
- Machine-verification proof for the changed helper/runtime surfaces
- Slice-local completion artifact and review-cycle handoff readiness

5. Forbidden Edits

- Do not implement benchmark supervision, benchmark matrices, or stop controls
- Do not widen beyond Spec 1
- Do not weaken the normal governed route
- Do not redesign merge-queue beyond truthful handoff needs
- Do not revert unrelated work or rewrite existing branch history

6. Integrity-Verified Assumptions Only

- The feature branch already contains a local implementation commit for this slice at `f5a0bff`
- A prior proof pass polluted worktree state with a fake cached execution id; that state has been reset and the active attempt is now `attempt-003`
- The truthful next governed action is `spawn_implementor_with_brief`
- Work must continue in the feature worktree at [implement-plan-provider-neutral-run-contract](/C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-provider-neutral-run-contract), not in the main checkout
- Worktree-local setup now truthfully resolves to `codex_cli_exec` with `codex_cli_full_auto_bypass`

7. Explicit Non-Goals

- No Spec 2
- No Spec 3
- No benchmark supervisor
- No benchmark-only scorer
- No unrelated product/runtime refactor outside this bounded slice

8. Proof / Verification Expectations

- Run `node --check` on every modified helper/runtime script
- Run `git diff --check`
- Run the targeted Spec 1 smoke verifications already required by the contract
- Keep proof artifacts under this feature stream
- If existing implementation is already complete, verify it and only make the minimal delta needed to make closeout truthful
- For this governed implementor-lane attempt, stop after machine verification, truthful artifact updates, and commit closeout; do not run `review-cycle` or `merge-queue`

9. Required Artifact Updates

- [implement-plan-brief.md](/C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-provider-neutral-run-contract/docs/phase1/implement-plan-provider-neutral-run-contract/implement-plan-brief.md)
- [implement-plan-state.json](/C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-provider-neutral-run-contract/docs/phase1/implement-plan-provider-neutral-run-contract/implement-plan-state.json)
- [implement-plan-execution-contract.v1.json](/C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-provider-neutral-run-contract/docs/phase1/implement-plan-provider-neutral-run-contract/implement-plan-execution-contract.v1.json)
- [run-projection.v1.json](/C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-provider-neutral-run-contract/docs/phase1/implement-plan-provider-neutral-run-contract/implementation-run/run-e976eb7e-72ab-435f-ad23-86c523be8985/run-projection.v1.json)
- [completion-summary.md](/C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-provider-neutral-run-contract/docs/phase1/implement-plan-provider-neutral-run-contract/completion-summary.md)
- New verification artifacts under this feature stream when this attempt produces them

10. Closeout Rules

- Keep the slice bounded to Spec 1
- Preserve the governed route truth in artifacts, but stop this implementor-lane attempt after machine verification and commit closeout because `review-cycle` and `merge-queue` are explicitly deferred
- Record step/event/projection truth as work advances
- Commit any further feature-branch delta created during this governed run
- Do not claim completion on branch approval alone
- Do not mark the feature completed in this attempt
