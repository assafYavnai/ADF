1. Failure Classes Closed

- First-run provider resolution drift for Claude-targeted implementor lanes.
- Shared helper and authoritative contract drift for newly accepted Claude worker/runtime enums.

2. Route Contracts Now Enforced

- Fresh Claude-targeted implementor prepares now derive `provider=claude` from selected worker runtime/access/model truth when shell-env detection is absent.
- Shared helper validators in `review-cycle` now accept the same Claude worker/runtime/access enums already accepted by the governed runtime and implement-plan helper.
- Repo-owned setup/workflow contracts now explicitly list the Claude enums and state that provider-specific reasoning metadata may be null when no truthful reasoning vocabulary exists.

3. Files Changed And Why

- [implement-plan-helper.mjs](C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-llm-tools-worker-resolution/skills/implement-plan/scripts/implement-plan-helper.mjs)
  - Added runtime/access/model-based provider inference so first-run Claude lanes keep truthful provider identity in prepare output and execution contracts.
- [review-cycle-setup-helper.mjs](C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-llm-tools-worker-resolution/skills/review-cycle/scripts/review-cycle-setup-helper.mjs)
  - Added Claude enum acceptance and runtime/access coherence validation.
- [review-cycle-helper.mjs](C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-llm-tools-worker-resolution/skills/review-cycle/scripts/review-cycle-helper.mjs)
  - Added matching Claude enum acceptance and validation so review-cycle state/setup can carry the widened worker surface truthfully.
- [setup-contract.md](C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-llm-tools-worker-resolution/skills/implement-plan/references/setup-contract.md)
  - Updated the authoritative implement-plan setup contract to include `llm_tools`, Claude enum values, and nullable provider-specific reasoning metadata.
- [setup-contract.md](C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-llm-tools-worker-resolution/skills/review-cycle/references/setup-contract.md)
  - Updated the authoritative review-cycle setup contract to include Claude enum values and the matching runtime/access constraint.
- [workflow-contract.md](C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-llm-tools-worker-resolution/skills/review-cycle/references/workflow-contract.md)
  - Updated the authoritative review-cycle workflow contract to include Claude enum values and the matching runtime/access constraint.

4. Sibling Sites Checked

- [governed-feature-runtime.mjs](C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-llm-tools-worker-resolution/skills/governed-feature-runtime.mjs)
- [implement-plan-setup-helper.mjs](C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-llm-tools-worker-resolution/skills/implement-plan/scripts/implement-plan-setup-helper.mjs)
- [setup-contract.md](C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-llm-tools-worker-resolution/skills/implement-plan/references/setup-contract.md)
- [review-cycle-setup-helper.mjs](C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-llm-tools-worker-resolution/skills/review-cycle/scripts/review-cycle-setup-helper.mjs)
- [review-cycle-helper.mjs](C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-llm-tools-worker-resolution/skills/review-cycle/scripts/review-cycle-helper.mjs)
- [setup-contract.md](C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-llm-tools-worker-resolution/skills/review-cycle/references/setup-contract.md)
- [workflow-contract.md](C:/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-llm-tools-worker-resolution/skills/review-cycle/references/workflow-contract.md)

5. Proof Of Closure

- `node --check` passed for:
  - `skills/governed-feature-runtime.mjs`
  - `skills/implement-plan/scripts/implement-plan-helper.mjs`
  - `skills/implement-plan/scripts/implement-plan-setup-helper.mjs`
  - `skills/review-cycle/scripts/review-cycle-setup-helper.mjs`
  - `skills/review-cycle/scripts/review-cycle-helper.mjs`
- Fresh Claude-targeted implement-plan prepare passed:
  - `node .../implement-plan-helper.mjs prepare --project-root C:/ADF --phase-number 1 --feature-slug governed-state-writer-serialization ...`
  - proved `implementor_lane.provider = claude`
  - proved `execution_contract.invoker_runtime.provider = claude`
  - proved `execution_contract.worker_selection.defaults.provider = claude`
  - proved `reasoning_effort = null` for the Claude lane
- Explicit review-cycle Claude setup write passed:
  - `node .../review-cycle-setup-helper.mjs write-setup --project-root <worktree> --runtime-permission-model claude_code_skip_permissions --preferred-execution-access-mode claude_code_skip_permissions ...`
  - proved the widened review-cycle validator surface accepts `claude_code_skip_permissions` + `claude_code_exec` coherently

6. Remaining Debt / Non-Goals

- Review-cycle auto-detection still prefers the existing native/Codex inference order and does not auto-select Claude from `llm_tools`; this pass only closed truthful acceptance/validation for explicit Claude worker settings.
- No worker-lifecycle redesign was attempted.

7. Next Cycle Starting Point

- Start cycle-03 as a re-audit/re-review pass against this fixed state.
- Focus on whether any remaining first-run route drift or code-vs-authority mismatch still exists.
