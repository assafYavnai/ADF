---
name: review-cycle
description: Run one full route-level audit, review, fix, verify, documentation-update, and closeout cycle for an ADF feature under C:/ADF. Use when the user wants the next review pass for a phase feature, with setup-driven execution-access resolution, reusable auditor and reviewer continuity, resumable cycle artifacts under docs/phaseN/feature-slug/, and commit or push closeout at the end of the run.
---

# Review Cycle

Use this skill for exactly one audit or review or fix cycle per invocation. Do not auto-start the next cycle in the same run.

## Required inputs

Collect these before doing substantive work:

- `phase_number`
- `feature_slug`
- `task_summary`

Optional inputs:

- `repo_root` default `C:/ADF`
- `scope_hint`
- `non_goals`
- `auditor_model`
- `reviewer_model`
- `auditor_reasoning_effort`
- `reviewer_reasoning_effort`

If a required input is missing, ask only for the missing field.

## Start sequence

1. Read [references/workflow-contract.md](references/workflow-contract.md).
2. Read [references/prompt-templates.md](references/prompt-templates.md).
3. Load `<repo_root>/.codex/review-cycle/setup.json`.
4. If setup is missing or incomplete, auto-use `$review-cycle-setup` and persist the missing execution-access guidance before continuing.
5. Run `node .codex/skills/review-cycle/scripts/review-cycle-helper.mjs prepare ...` and treat its JSON output as the source of truth for detected status.
6. Print the detected-status summary before taking action.

## Access-mode rule

All spawned executions used by this workflow must run under the strongest non-interactive autonomous access mode the current Codex runtime supports.

Resolve access in this order:

1. Explicit native full-access or elevated-permission mode if the current surface exposes it.
2. Headless Codex CLI full-auto plus bypass mode when `codex exec` can provide a stronger autonomous mode than native agent spawning.
3. Inherited runtime access when native spawned agents inherit the current runtime but do not expose stronger explicit access controls.
4. Explicit interactive fallback only when no stronger autonomous mode exists.

Record the resolved mode for auditor, reviewer, implementor, and any helper execution in persisted state. Do not silently downgrade.

## Current-cycle rule

If the current cycle already has a completed `fix-report.md`, do not overwrite it. Detect whether the cycle is awaiting verification, commit, or push closeout and finish that conservatively before starting another review pass.

## Helper scripts

Use the helper scripts for deterministic local state:

- `node .codex/skills/review-cycle/scripts/review-cycle-helper.mjs prepare ...`
- `node .codex/skills/review-cycle/scripts/review-cycle-helper.mjs update-state ...`
- `node .codex/skills/review-cycle-setup/scripts/review-cycle-setup-helper.mjs write-setup ...`

The helpers persist setup and state, but the Codex agent still owns context creation, reviewer prompts, route-level fixes, verification, documentation updates, and git closeout.