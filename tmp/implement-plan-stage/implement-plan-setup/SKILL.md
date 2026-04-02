---
name: implement-plan-setup
description: Detect and persist truthful execution-access, worker-runtime, and continuity settings for implement-plan at project-root/.codex/implement-plan/setup.json.
---

# Implement Plan Setup

Use this skill to create or refresh `<project_root>/.codex/implement-plan/setup.json`.

This skill normally runs internally from `$implement-plan` and should not be a user-visible prerequisite in normal use.

## Required input

- `project_root`

## Start sequence

1. Read [references/setup-contract.md](references/setup-contract.md).
2. Detect the current runtime permission model, preferred worker runtime, preferred control-plane runtime, and persistent execution strategy conservatively.
3. Persist the result with `implement-plan-setup-helper.mjs write-setup ...`.
4. Return the saved settings summary.

## Guardrails

- prefer explicit worker access over inherited or interactive access
- keep worker runtime distinct from control-plane runtime
- if native worker access is weaker than CLI full-auto bypass, prefer CLI worker mode and record why
- if no true autonomous mode exists, record the limitation explicitly
- setup must be truthful, internally coherent, and safe for transparent auto-refresh by `$implement-plan`

