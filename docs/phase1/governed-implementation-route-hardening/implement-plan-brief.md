1. Implementation Objective

Harden the governed implementation route so future Phase 1 slices can move from slice-contract preparation through implementation, review, blocked-merge recovery, and closeout with less operator guesswork and fewer route-truth failures.

2. Exact Slice Scope

- Update `skills/review-cycle/SKILL.md` with a hard fix-cycle continuity rule.
- Update `skills/review-cycle/references/workflow-contract.md` to freeze the same continuity and reopen guardrail behavior at contract level.
- Update `skills/merge-queue/SKILL.md` and `skills/merge-queue/references/workflow-contract.md` to document a governed blocked-merge resume or resolve path.
- Update `skills/merge-queue/scripts/merge-queue-helper.mjs` to implement blocked-merge resume or resolve inside the governed route.
- Update `skills/implement-plan/SKILL.md` and or `skills/implement-plan/references/workflow-contract.md` with authoritative requirement-freeze guarding.
- Update `skills/implement-plan/scripts/implement-plan-helper.mjs` so post-`mark-complete` validation fails if generated artifacts still contain stale pre-merge or in-progress language.
- Update `docs/bootstrap/cli-agent.md` with more explicit bash-on-Windows and sibling-worker invocation examples.
- Normalize active authoritative docs and templates from `master` to `main` where that branch language is still live.
- Add targeted tests required to prove the new governed behavior.

3. Inputs / Authorities Read

- `C:/ADF/AGENTS.md`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`
- `C:/ADF/docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/completion-summary.md`
- `C:/ADF/docs/phase1/approved-commit-closeout-state-separation/README.md`
- `C:/ADF/docs/phase1/review-cycle-setup-merge-safety/README.md`
- `C:/ADF/docs/phase1/governed-merge-closeout-chain-hardening/README.md`
- `C:/ADF/skills/review-cycle/SKILL.md`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`
- `C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs`
- `C:/ADF/skills/merge-queue/SKILL.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
- `C:/ADF/skills/implement-plan/SKILL.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/docs/phase1/governed-implementation-route-hardening/README.md`
- `C:/ADF/docs/phase1/governed-implementation-route-hardening/context.md`
- `C:/ADF/docs/phase1/governed-implementation-route-hardening/requirements.md`
- `C:/ADF/docs/phase1/governed-implementation-route-hardening/decisions.md`
- `C:/ADF/docs/phase1/governed-implementation-route-hardening/implement-plan-contract.md`

4. Required Deliverables

- `review-cycle` must state that rejection or fix cycles reuse the same implementor execution when still valid.
- `review-cycle` must state that normal fix cycles do not send a fresh long implementation prompt.
- `review-cycle` must state that normal fix cycles send only rejected findings or report artifact paths plus a short fix instruction.
- `review-cycle` must guard against opening cycle `N+1` unless there are new diffs since the approved cycle or the invoker explicitly requests reopen.
- `merge-queue` must document a governed blocked-merge resume or resolve route.
- `merge-queue-helper.mjs` must support blocked-merge resume or resolve without falling back to manual merge worktrees as the intended product path.
- `implement-plan-helper.mjs` must fail closeout when generated artifacts still carry stale language such as `not_ready`, `closeout_pending`, `review_cycle in progress`, or `approval-pending`.
- `implement-plan` must guard against independent authoritative requirement introduction on base and feature for required initiative or slice authority files.
- `cli-agent.md` must include concrete sibling-worker launch examples that match Windows-host plus bash-workflow truth.
- Active authoritative docs and templates must use `main` instead of `master` where the default branch language is intended.
- Add targeted tests and proof artifacts for the new behavior.

5. Forbidden Edits

- Do not broaden into unrelated COO or product-runtime work.
- Do not redesign Brain routing or MCP behavior.
- Do not document manual merge worktrees as the intended blocked-merge recovery route.
- Do not rewrite frozen historical evidence just for terminology cleanup.
- Do not weaken review, approval, merge, or completion gates.
- Do not widen the slice into a general workflow redesign beyond the recorded failures.
- Do not merge or mark the feature completed.

6. Integrity-Verified Assumptions Only

- The governed feature branch is `implement-plan/phase1/governed-implementation-route-hardening`.
- The governed feature worktree is `C:/ADF/.codex/implement-plan/worktrees/phase1/governed-implementation-route-hardening`.
- The repo default target branch is `main`.
- Runtime preflight on `2026-04-06` reported Windows host plus `bash` workflow shell, with `adf.sh` as the control-plane entrypoint.
- Runtime preflight reported `claude --dangerously-skip-permissions` as the truthful autonomous implementor lane, while Codex CLI remains available for review lanes.
- Human verification is not required for this slice.
- The current `implement-plan-helper.mjs` argument parser accepts `--flag value`, not `--flag=value`.
- The current `implement-plan` prepare output still does not persist `post_send_to_review=true`; if that remains unchanged after implementation, the orchestrator will hand the feature to `review-cycle` explicitly while keeping the same governed feature stream.

7. Explicit Non-Goals

- No product feature implementation outside governed workflow hardening.
- No global historical wording cleanup beyond active authoritative sources.
- No broad workflow platform rewrite.
- No Brain MCP redesign.
- No benchmark supervisor work.

8. Proof / Verification Expectations

Machine Verification:
- Add targeted `skills/tests` coverage for:
  - review-cycle fix-cycle continuity and reopen guardrail behavior
  - merge-queue blocked-merge resume or resolve behavior
  - implement-plan stale closeout validation
  - implement-plan authoritative requirement-freeze pushback
- Run `node --check` on modified helper scripts.
- Run `git diff --check`.
- Run targeted source scans to prove active authoritative docs no longer use `master` where `main` is intended.

Human Verification:
- Required: false

9. Required Artifact Updates

- `C:/ADF/skills/review-cycle/SKILL.md`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/SKILL.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
- `C:/ADF/skills/implement-plan/SKILL.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/skills/tests/**` as required by the slice
- `C:/ADF/docs/phase1/governed-implementation-route-hardening/completion-summary.md` when produced truthfully
- execution-contract, run-projection, or other feature artifacts only when the route truth changes require them

10. Closeout Rules

- Human testing: not required.
- Review-cycle: required after implementation and machine verification.
- Post-human-approval sanity pass: not applicable unless later code changes introduce a human-facing approval loop.
- Final completion: only after review closure, governed merge, and truthful completion updates.
