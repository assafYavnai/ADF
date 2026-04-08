1. Failure Classes Closed

- Brain trust / cleanup surface broader than the frozen public route: closed by narrowing the helper interface to `promote reviewed|locked` and `cleanup archive|delete`.
- contradictory bootstrap fallback policy: closed by making assistant-side `project-brain` MCP preferred and `brain-ops` the explicit repo-backed fallback when MCP is unavailable.
- branch isolation against current target branch truth: closed by rebasing onto `origin/main` and re-checking bounded diff against `origin/main...HEAD`.

2. Route Contracts Now Enforced

- CLI agents now have one truthful Brain fallback route through `brain-ops` when assistant-side MCP is unavailable.
- The public helper surface matches the documented trust/cleanup route.
- Branch isolation is evaluated against current target-branch truth after the rebase, not stale local `main`.
- The transient authority-freeze pushback was superseded after the rebase and governed attempt reset restored a truthful continuation path.

3. Files Changed And Why

- `skills/brain-ops/scripts/brain-ops-helper.mjs`: removed undocumented `working` promotion and `supersede` cleanup from the public helper interface.
- `skills/brain-ops/references/usage.md`: aligned repo-fallback guidance with the narrowed helper surface.
- `docs/bootstrap/cli-agent.md`: clarified that MCP remains preferred while `brain-ops` is the deterministic fallback path.
- `docs/phase1/brain-ops-skill-and-codex-claude-wiring/implement-plan-pushback.md`: marked the authority-freeze pushback as superseded after the rebase and reset.
- `docs/phase1/brain-ops-skill-and-codex-claude-wiring/completion-summary.md`: recorded the cycle-01 fix-pass state and the pending approval-cycle handoff.

4. Sibling Sites Checked

- `skills/brain-ops/SKILL.md`
- `skills/brain-ops/references/usage.md`
- `docs/bootstrap/cli-agent.md`
- `git diff --name-only origin/main...HEAD`

5. Proof Of Closure

- `node --check skills/brain-ops/scripts/brain-ops-helper.mjs`
- `node skills/brain-ops/scripts/brain-ops-helper.mjs connect-smoke --project-root C:/ADF/.codex/implement-plan/worktrees/phase1/brain-ops-skill-and-codex-claude-wiring`
- `node skills/brain-ops/scripts/brain-ops-helper.mjs search --project-root C:/ADF/.codex/implement-plan/worktrees/phase1/brain-ops-skill-and-codex-claude-wiring --scope assafyavnai/adf --query "brain ops" --max-results 5`
- controlled fallback Brain round-trip: capture, promote to `reviewed`, searchable readback, archive cleanup
- `node skills/manage-skills.mjs install --target codex --project-root C:/ADF/.codex/implement-plan/worktrees/phase1/brain-ops-skill-and-codex-claude-wiring`
- `node skills/manage-skills.mjs check --target codex --project-root C:/ADF/.codex/implement-plan/worktrees/phase1/brain-ops-skill-and-codex-claude-wiring`
- `node skills/manage-skills.mjs install --target claude --project-root C:/ADF/.codex/implement-plan/worktrees/phase1/brain-ops-skill-and-codex-claude-wiring`
- `node skills/manage-skills.mjs check --target claude --project-root C:/ADF/.codex/implement-plan/worktrees/phase1/brain-ops-skill-and-codex-claude-wiring`
- `git diff --name-only origin/main...HEAD`

6. Remaining Debt / Non-Goals

- no Brain server redesign
- no raw database route
- no runtime-preflight codex flag correction in this slice
- no merge-queue or review-cycle architecture changes in this slice

7. Next Cycle Starting Point

- cycle-01 substantive code/doc fixes are complete and pushed on the rebased feature branch
- the next governed step is the follow-up approval cycle on that rebased branch
- merge is still blocked until review-cycle closes with approval and merge-queue lands the approved commit
