---
name: review-cycle-setup
description: Detect and persist execution-access guidance for review-cycle at project-root/.codex/review-cycle/setup.json. Use when setup is missing, incomplete, stale for the current runtime, unparsable, or internally inconsistent, and when the strongest truthful autonomous access mode for spawned auditor, reviewer, implementor, and helper executions must be resolved without silent downgrades.
---

# Review Cycle Setup

Use this skill to create or refresh `project-root/.codex/review-cycle/setup.json` for `review-cycle`.

## Required input

- `project_root` default `C:/ADF`

## Start sequence

1. Read [references/setup-contract.md](references/setup-contract.md).
2. Detect the current runtime permission model, worker execution runtime, control-plane runtime, and persistent execution strategy from the live Codex surface and local CLI availability.
3. Resolve the strongest truthful autonomous execution-access mode available for worker executions.
4. Persist the result with `node C:/Users/sufin/.codex/skills/review-cycle-setup/scripts/review-cycle-setup-helper.mjs write-setup ...`.
5. Print the saved setup summary, including validation errors or warnings if any.

## Guardrails

- Prefer explicit full-access or full-auto modes over inherited or interactive access.
- If native agent spawning cannot request elevated worker access explicitly but CLI full-auto bypass can, prefer the CLI worker mode and record why.
- If native tools are available only as the control plane, record that separately instead of pretending the worker runtime is native.
- If no true full-access autonomous worker mode exists, record the limitation explicitly and persist the strongest available fallback.
- Record whether project-specific elevated-permission rules are needed.
- Record whether the runtime supports persistent native agent reuse or whether the workflow must fall back to CLI sessions or artifact continuity.
- Refresh setup when the runtime surface changes, when `review-cycle` reports incomplete or inconsistent setup, or when a weaker access mode caused or could cause stalls.
- Do not overstate CLI support just because the CLI binary exists. Detect support conservatively.
