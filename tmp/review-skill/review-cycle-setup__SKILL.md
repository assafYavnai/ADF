---
name: review-cycle-setup
description: Detect and persist execution-access guidance for review-cycle at project-root/.codex/review-cycle/setup.json. Use when review-cycle setup is missing, incomplete, stale for the current runtime, or when the strongest autonomous access mode for spawned auditor, reviewer, implementor, and helper executions must be resolved and recorded without silent downgrades.
---

# Review Cycle Setup

Use this skill to create or refresh `project-root/.codex/review-cycle/setup.json` for `review-cycle`.

## Required input

- `project_root` default `C:/ADF`

## Start sequence

1. Read [references/setup-contract.md](references/setup-contract.md).
2. Detect the current runtime permission model, preferred execution runtime, and persistent execution strategy from the live Codex surface and local CLI availability.
3. Resolve the strongest autonomous execution-access mode available for spawned executions.
4. Persist the result with `node C:/Users/sufin/.codex/skills/review-cycle-setup/scripts/review-cycle-setup-helper.mjs write-setup ...`.
5. Print the saved setup summary.

## Guardrails

- Prefer explicit full-access or full-auto modes over inherited or interactive access.
- If native agent spawning cannot request elevated access explicitly but CLI full-auto bypass can, prefer the CLI mode and record why.
- If no true full-access autonomous mode exists, record the limitation explicitly and persist the strongest available fallback.
- Record whether project-specific elevated-permission rules are needed.
- Record whether the runtime supports persistent native agent reuse or whether the workflow must fall back to CLI sessions or artifact continuity.
- Refresh setup when the runtime surface changes, when `review-cycle` reports incomplete setup, or when a weaker access mode caused or could cause stalls.
