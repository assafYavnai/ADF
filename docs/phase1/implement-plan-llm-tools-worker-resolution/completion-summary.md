1. Objective Completed

Implemented provider-neutral LLM tool discovery and worker-selection plumbing for governed `implement-plan`, then closed the follow-on provider-truth gaps found in review.

2. Deliverables Produced

- setup refresh stores preflight `llm_tools`
- worker selection surfaces `available_workers`
- prepare output exposes the available worker list
- workflow contracts define the Bash spawn pattern for non-default workers
- provider-specific reasoning metadata is sanitized so Claude lanes do not inherit Codex-only reasoning values
- first-run Claude-targeted prepares now keep truthful `provider=claude` identity in lane output and execution contracts
- shared review-cycle validator surfaces now accept the widened Claude access/runtime enum set
- authoritative setup/workflow contracts were updated to match the code-supported surface

3. Files Changed And Why

- `skills/governed-feature-runtime.mjs`
  - added the shared Claude worker/runtime/access enums used by governed helper surfaces
- `skills/implement-plan/scripts/implement-plan-helper.mjs`
  - added worker availability output, reasoning sanitization, and first-run provider inference from selected worker configuration
- `skills/implement-plan/scripts/implement-plan-setup-helper.mjs`
  - added runtime-aware default model/reasoning handling so Claude setups do not retain Codex-only reasoning defaults
- `skills/implement-plan/references/setup-contract.md`
  - updated the authoritative implement-plan setup contract to include Claude enum values, `llm_tools`, and nullable provider-specific reasoning truth
- `skills/review-cycle/scripts/review-cycle-setup-helper.mjs`
  - widened review-cycle setup validation to accept the same Claude enum surface
- `skills/review-cycle/scripts/review-cycle-helper.mjs`
  - widened review-cycle state/setup validation to accept the same Claude enum surface
- `skills/review-cycle/references/setup-contract.md`
  - updated the authoritative review-cycle setup contract to match the widened enum surface
- `skills/review-cycle/references/workflow-contract.md`
  - updated the authoritative review-cycle workflow contract to match the widened enum surface
- `docs/phase1/implement-plan-llm-tools-worker-resolution/context.md`
  - recorded the provider-truth and shared-validator decisions

4. Verification Evidence

- `node --check` passed for all touched helper/runtime scripts
- `implement-plan-helper.mjs get-settings --project-root C:/ADF`
  - proved the live Claude setup keeps `preferred_implementor_reasoning_effort = null`
- `implement-plan-helper.mjs prepare --project-root C:/ADF --phase-number 1 --feature-slug governed-state-writer-serialization ...`
  - proved `implementor_lane.provider = claude`
  - proved `execution_contract.invoker_runtime.provider = claude`
  - proved `execution_contract.worker_selection.defaults.provider = claude`
  - proved `reasoning_effort = null` for the Claude lane
- `review-cycle-setup-helper.mjs write-setup --project-root <worktree> --runtime-permission-model claude_code_skip_permissions ...`
  - proved the widened review-cycle validator surface accepts explicit Claude worker/runtime settings coherently

5. Review-Cycle Status

- cycle-01: approved original `llm_tools` wiring route
- cycle-02: rejected, found first-run provider drift and shared-validator/authority drift
- cycle-02 fix pass: completed with proof and committed at `e1a2447`
- cycle-03: approved

6. Commit And Push Result

- cycle-02 fix commit: `e1a2447`
- cycle-03 approval closeout: pending until the current head is committed and pushed

7. Remaining Non-Goals / Debt

- Review-cycle automatic mode selection still follows its existing native/Codex preference order. This slice only closed truthful acceptance/validation and first-run provider truth; it did not redesign worker auto-selection policy.
