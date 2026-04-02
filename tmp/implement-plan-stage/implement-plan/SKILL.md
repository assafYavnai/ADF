---
name: implement-plan
description: Run a governed feature implementation planning and execution slice for any project using phase/feature artifacts, transparent setup refresh, strict plan-integrity gating, persistent per-feature implementor continuity, and truthful push-to-origin closeout.
---

# Implement Plan

Use this skill to run one governed implementation-planning or implementation-execution slice for a feature stream.

This is a global skill. Do not hardcode ADF-specific paths beyond safe defaults.

## Default behavior

If the skill is invoked with no inputs, or with `action=help`, return concise help.

The help output must include:

- what the skill does
- required inputs
- optional inputs
- supported actions
- current settings summary
- current active/open features summary
- how to mark a feature complete
- what happens if a feature is already completed or closed

## Supported actions

- `action=help`
- `action=get-settings`
- `action=list-features`
- `action=prepare`
- `action=run`
- `action=mark-complete`

## Required inputs for `action=run` and `action=prepare`

- `project_root`
- `phase_number`
- `feature_slug`
- `task_summary`

Optional inputs:

- `scope_hint`
- `non_goals`
- `implementor_model`
- `implementor_reasoning_effort`
- `feature_status_override` only when explicitly reopening or administratively correcting state

## Input safety rules

- `phase_number` must be a positive integer.
- `feature_slug` must be a safe slash-separated feature-stream slug.
- Reject path traversal, empty segments, `.` or `..`, leading slash, trailing slash, and backslash-based escaping.
- Normalize all important paths from variables, not from hardcoded repo assumptions.

## Path variables

Resolve and surface at minimum:

- `project_root`
- `phase_number`
- `feature_slug`
- `feature_root`
- `skill_state_root`
- `setup_path`
- `registry_path`
- `features_index_path`
- `templates_root`
- `references_root`

## Start sequence

1. If no inputs are provided, or `action=help`, run `implement-plan-helper.mjs help ...` and print the help output.
2. If `action=get-settings`, run `implement-plan-helper.mjs get-settings ...` and print the resolved settings summary.
3. If `action=list-features`, run `implement-plan-helper.mjs list-features ...` and print the compact feature summary.
4. For `action=prepare`, `action=run`, and `action=mark-complete`, read [references/workflow-contract.md](references/workflow-contract.md) and [references/prompt-templates.md](references/prompt-templates.md).
5. Load `<project_root>/.codex/implement-plan/setup.json` internally.
6. If setup is missing, stale, unparsable, incomplete, or internally inconsistent, internally use `$implement-plan-setup` before doing any worker work.
7. Run `node C:/Users/sufin/.codex/skills/implement-plan/scripts/implement-plan-helper.mjs prepare ...` for `action=prepare` or `action=run`.
8. Treat the helper JSON as the source of truth for:
   - feature path resolution
   - setup validity
   - feature lifecycle status
   - context/input pack normalization
   - integrity precheck findings
   - implementor reuse vs recreation requirement
   - resumable state and closeout status
9. Print the detected-status summary before taking action.

## Transparent setup rule

Setup must be transparent to the invoker.

Rules:

- the main skill validates setup internally first
- if setup is missing or invalid, the main skill internally refreshes it and continues
- the normal user flow must not require a separate manual setup invocation
- `$implement-plan-setup` exists for modularity and internal reuse, not as a normal prerequisite

## Feature lifecycle rule

Every feature stream must have explicit status:

- `active`
- `blocked`
- `completed`
- `closed`

Rules:

- `active` and `blocked` features appear in open-features output
- `completed` and `closed` features do not appear in active/open output
- `action=run` must fail clearly for `completed` or `closed` features
- the failure must tell the invoker that the feature is no longer active and must be reopened or cloned to continue
- `action=mark-complete` must update both feature-local state and the project-level features index

## Full-loop ownership rule

The skill invoker owns the full loop.

The main skill must:

- validate or refresh setup internally
- load and normalize feature context
- verify plan integrity before implementation
- push back when the implementation slice is weak or unsafe
- create the implementor brief only when integrity passes
- spawn or resume the implementation worker under the strongest truthful worker mode
- wait for completion
- verify outputs
- write completion artifacts
- commit and push all feature artifacts to origin
- only then mark the implementation slice completed

Do not delegate orchestration responsibility to the worker.

## Integrity gate rule

Before spawning the implementor, the main skill must verify whether the slice is truly ready.

At minimum, check:

- required implementation contract exists or a valid equivalent source is available
- the slice is explicit, bounded, and internally coherent
- required deliverables are stated clearly
- allowed edits and forbidden edits are stated clearly
- acceptance gates are stated clearly
- observability or audit expectations are stated when required
- dependencies, constraints, and non-goals are explicit enough
- upstream context is sufficient to implement without business guessing
- the feature is still active/open
- the slice is product-shaped and not broad speculative refactoring

If integrity fails:

- do not spawn the implementor
- write `implement-plan-pushback.md`
- surface a concise pushback to the invoker
- preserve resumable state

If integrity passes:

- write or refresh `implement-plan-contract.md` when normalization is needed
- write `implement-plan-brief.md`
- spawn or resume the implementor

## Worker policy

When integrity passes, use the strongest truthful autonomous worker mode available.

Rules:

- keep worker runtime distinct from control-plane runtime
- if native worker access is weaker than CLI full-auto bypass, prefer CLI worker mode and record why
- default implementor target is `GPT-5.4` with `xhigh` reasoning, or the strongest truthful equivalent in the current runtime
- persist which worker runtime, access mode, model, and reasoning effort were actually used

## Action behavior

`action=prepare`

- validate or refresh setup internally
- normalize the context/input pack
- run integrity verification
- if weak, write the pushback artifact and stop
- if solid, write the normalized contract and implementation brief and stop before worker spawn

`action=run`

- do everything from `prepare`
- spawn or resume the implementor when integrity passes
- wait for completion
- verify outputs
- write `completion-summary.md`
- commit and push all code and feature artifacts to origin
- mark the feature completed when closeout succeeds

`action=mark-complete`

- require a target feature stream
- persist feature completion in state and index
- remove the feature from active/open output
- do not silently mark complete if closeout evidence is missing

## Helper scripts

Use the helper scripts for deterministic local state:

- `node C:/Users/sufin/.codex/skills/implement-plan/scripts/implement-plan-helper.mjs help ...`
- `node C:/Users/sufin/.codex/skills/implement-plan/scripts/implement-plan-helper.mjs get-settings ...`
- `node C:/Users/sufin/.codex/skills/implement-plan/scripts/implement-plan-helper.mjs list-features ...`
- `node C:/Users/sufin/.codex/skills/implement-plan/scripts/implement-plan-helper.mjs prepare ...`
- `node C:/Users/sufin/.codex/skills/implement-plan/scripts/implement-plan-helper.mjs update-state ...`
- `node C:/Users/sufin/.codex/skills/implement-plan/scripts/implement-plan-helper.mjs record-event ...`
- `node C:/Users/sufin/.codex/skills/implement-plan/scripts/implement-plan-helper.mjs mark-complete ...`
- `node C:/Users/sufin/.codex/skills/implement-plan/scripts/implement-plan-helper.mjs completion-summary ...`
- `node C:/Users/sufin/.codex/skills/implement-plan-setup/scripts/implement-plan-setup-helper.mjs write-setup ...`

## Closeout

When an implementation slice succeeds, end by showing:

- the feature artifact tree
- the saved implementor execution identifier if available
- the resolved worker and control-plane runtime/access mode summary
- the completion summary
- the commit SHA if push succeeded, or the exact git failure if it did not
