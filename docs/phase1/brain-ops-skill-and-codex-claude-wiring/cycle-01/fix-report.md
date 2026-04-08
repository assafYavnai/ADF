1. Fix Summary

- Narrowed the `brain-ops` helper to the documented public trust route by removing unsupported `working` promotion and `supersede` cleanup from the helper interface.
- Normalized CLI bootstrap guidance so assistant-side `project-brain` MCP stays preferred while `brain-ops` is the explicit repo-backed fallback when MCP is unavailable.
- Rebased the feature branch onto `origin/main` and reset the governed implementation attempt so the slice now evaluates branch scope and frozen authorities against current target-branch truth.
- Superseded the transient authority-freeze pushback after the rebase and attempt reset restored a truthful governed continuation path.

2. Files Updated

- `skills/brain-ops/scripts/brain-ops-helper.mjs`
- `skills/brain-ops/references/usage.md`
- `docs/bootstrap/cli-agent.md`
- `docs/phase1/brain-ops-skill-and-codex-claude-wiring/implement-plan-pushback.md`
- `docs/phase1/brain-ops-skill-and-codex-claude-wiring/completion-summary.md`

3. Verification Evidence

- `node --check skills/brain-ops/scripts/brain-ops-helper.mjs`
- `node skills/brain-ops/scripts/brain-ops-helper.mjs connect-smoke --project-root C:/ADF/.codex/implement-plan/worktrees/phase1/brain-ops-skill-and-codex-claude-wiring`
- `node skills/brain-ops/scripts/brain-ops-helper.mjs search --project-root C:/ADF/.codex/implement-plan/worktrees/phase1/brain-ops-skill-and-codex-claude-wiring --scope assafyavnai/adf --query "brain ops" --max-results 5`
- Controlled Brain round-trip:
  - capture
  - promote to `reviewed`
  - search by unique token and verify the exact memory id appears
  - cleanup via `archive`
- `node skills/manage-skills.mjs install --target codex --project-root C:/ADF/.codex/implement-plan/worktrees/phase1/brain-ops-skill-and-codex-claude-wiring`
- `node skills/manage-skills.mjs check --target codex --project-root C:/ADF/.codex/implement-plan/worktrees/phase1/brain-ops-skill-and-codex-claude-wiring`
- `node skills/manage-skills.mjs install --target claude --project-root C:/ADF/.codex/implement-plan/worktrees/phase1/brain-ops-skill-and-codex-claude-wiring`
- `node skills/manage-skills.mjs check --target claude --project-root C:/ADF/.codex/implement-plan/worktrees/phase1/brain-ops-skill-and-codex-claude-wiring`
- `git diff --name-only origin/main...HEAD`

4. Branch / Scope Proof

- After rebasing onto `origin/main`, the scope proof is judged against `origin/main...HEAD`, not stale local `main...HEAD`.
- The bounded diff remains limited to:
  - `skills/brain-ops/**`
  - `skills/manifest.json`
  - `docs/bootstrap/cli-agent.md`
  - feature-local governed artifacts under `docs/phase1/brain-ops-skill-and-codex-claude-wiring/**`

5. Reviewer Finding Closure

- Governed route-truth divergence:
  - addressed by writing the missing cycle artifacts, completion summary, superseded pushback note, and by resetting the governed attempt after the rebase.
- Brain trust / cleanup surface too broad:
  - addressed by shrinking the helper to the documented public route.
- Bootstrap fallback contradiction:
  - addressed by making MCP preferred and `brain-ops` the explicit repo-backed fallback.
- Branch-isolation concern:
  - addressed by rebasing onto `origin/main` and proving scope against current target-branch truth.

6. Remaining Work For Approval

- Commit and push this cycle-01 fix pass.
- Run the next governed review cycle against the rebased branch.
- Land the approved branch through merge-queue and finish implement-plan closeout.
