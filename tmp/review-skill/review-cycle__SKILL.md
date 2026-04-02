---
name: review-cycle
description: Run one full route-level audit, review, fix, verify, documentation-update, and closeout cycle for an ADF feature under C:/ADF. Use when the user wants the next review pass for a phase feature, with setup-driven execution-access resolution, persistent per-feature auditor/reviewer/implementor continuity, resumable cycle artifacts under docs/phaseN/feature-slug/, and commit or push closeout at the end of the run.
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
5. Run `node C:/Users/sufin/.codex/skills/review-cycle/scripts/review-cycle-helper.mjs prepare ...` and treat its JSON output as the source of truth for detected status, active cycle selection, agent registry state, and current resume point.
6. Print the detected-status summary before taking action.

## Prompt-template rule

When dispatching auditor, reviewer, or implementor work:

- use the corresponding prompt template body from `references/prompt-templates.md`
- keep the template headings and output contract exact
- add cycle-specific context around the template, but do not paraphrase or weaken the template body itself

## Global-source rule

Use the installed global skill package under `C:/Users/sufin/.codex/skills/`. Do not depend on repo-local skill copies when the installed global package already exists.

## Access-mode rule

All spawned executions used by this workflow must run under the strongest non-interactive autonomous access mode the current Codex runtime supports.

Resolve access in this order:

1. Explicit native full-access or elevated-permission mode if the current surface exposes it.
2. Headless Codex CLI full-auto plus bypass mode when `codex exec` can provide a stronger autonomous mode than native agent spawning.
3. Inherited runtime access when native spawned agents inherit the current runtime but do not expose stronger explicit access controls.
4. Explicit interactive fallback only when no stronger autonomous mode exists.

Record the resolved mode for auditor, reviewer, implementor, and any helper execution in persisted state. Do not silently downgrade.

## Full-loop control rule

The skill invoker owns the full review loop.

That means this skill, not the implementor worker, must:

- load setup and state
- resolve or refresh access modes
- reuse or recreate the dedicated auditor, reviewer, and implementor executions
- send review requests
- wait for reviewer completions
- surface reviewer reports immediately on arrival
- block implementor fixing until both reviewer reports are ready
- synthesize the fix plan
- resume the implementor with the implementor prompt and report paths
- run verification
- write and display the final fix report
- commit and push
- print the cycle-complete summary with timing

Do not make the implementor watch the filesystem for report files.

## Persistent execution rule

Cache persistent execution IDs per feature stream through:

- `<repo_root>/docs/phase<phase_number>/<feature_slug>/review-cycle-state.json`
- `<repo_root>/.codex/review-cycle/agent-registry.json`

Rules:

- treat the helper registry as the canonical per-feature execution cache
- reuse cached auditor, reviewer, and implementor executions on later invocations and later cycles
- do not spawn fresh executions for a feature if cached executions are still usable
- recreate only the missing, broken, or under-permissioned execution
- keep different feature streams isolated so multiple feature slugs can run in parallel without colliding

## Reviewer loop

Run the auditor and reviewer in parallel.

As soon as either reviewer finishes:

1. save its report artifact
2. record the completion in helper state
3. print the full report immediately in the required wrapper
4. record that the report was surfaced
5. keep waiting for the other reviewer

Do not start or resume implementor fixing until both reviewer reports exist and every already-returned report has been surfaced.

## Report surfacing rule

When auditor and reviewer executions return reports, print each completed report immediately before any implementor fixing begins, in this exact wrapper:

```text
##################################################################
########### The <Auditor | Reviewer> Report is Ready #############
##################################################################

<show report>

##################################################################
```

Rules:

- show the full report body, not only a summary
- print the report as soon as that agent returns, even if the other report is still running
- if both reports finish before implementor work starts, print both in arrival order
- do not start implementor fixing until every already-returned report has been surfaced in this wrapper

## Implementor lane rule

The implementor execution is also persistent and cached per feature stream.

Rules:

- create or reuse the implementor execution under the strongest access mode, just like auditor and reviewer
- keep the implementor idle until both reviewer reports are ready
- when both reports are ready, send the implementor the current cycle request, both report paths, the reusable context, and the implementor prompt from [references/prompt-templates.md](references/prompt-templates.md)
- require the implementor to update all materially affected authoritative docs in the same cycle
- do not let the implementor widen scope into general refactoring

## Current-cycle rule

If the current cycle already has a completed `fix-report.md`, do not overwrite it. Detect whether the cycle is awaiting verification, commit, or push closeout and finish that conservatively before starting another review pass.

## Artifact validity rule

Cycle artifacts count as reusable only when they satisfy the output contract for that artifact.

At minimum:

- `audit-findings.md` must contain the exact auditor section headings
- `review-findings.md` must contain the exact reviewer section headings
- `fix-plan.md` must contain the exact fix-plan section headings
- `fix-report.md` must contain the exact fix-report section headings

Do not treat file existence alone as proof that a cycle step is complete.
If an interrupted or malformed artifact exists, treat the cycle as needing regeneration or cleanup, not as ready to continue from that artifact.

## Resume rules

When the skill is invoked again for the same feature stream:

- call `prepare` first
- trust the helper-selected active cycle and current cycle state
- if the helper reports cached execution IDs with sufficient access, resume those executions instead of spawning new ones
- if the helper reports `resume_pending_closeout`, finish verification and git closeout before sending new review work
- if the helper reports one reviewer already finished, surface the existing report if needed and keep waiting only for the remaining reviewer
- if the helper reports both reviewers already finished, do not rerun them unless the user explicitly asks to regenerate

## Native orchestration preference

When the current Codex runtime exposes native orchestration tools such as `spawn_agent`, `resume_agent`, `send_input`, and `wait_agent`, use them as the primary control plane.

Preferred flow:

1. `resume_agent` for cached IDs when available
2. `spawn_agent` only for missing, broken, or under-permissioned lanes
3. `send_input` to dispatch cycle requests
4. `wait_agent` to detect reviewer completion
5. `wait_agent` or resumed-turn completion to detect implementor completion

If the runtime does not expose persistent native executions, fall back to the strongest truthful continuity strategy recorded in setup and state.

## Helper scripts

Use the helper scripts for deterministic local state:

- `node C:/Users/sufin/.codex/skills/review-cycle/scripts/review-cycle-helper.mjs prepare ...`
- `node C:/Users/sufin/.codex/skills/review-cycle/scripts/review-cycle-helper.mjs update-state ...`
- `node C:/Users/sufin/.codex/skills/review-cycle/scripts/review-cycle-helper.mjs record-event ...`
- `node C:/Users/sufin/.codex/skills/review-cycle/scripts/review-cycle-helper.mjs cycle-summary ...`
- `node C:/Users/sufin/.codex/skills/review-cycle-setup/scripts/review-cycle-setup-helper.mjs write-setup ...`

Use the helper as the deterministic state machine. The Codex agent still owns actual prompting, waiting, verification, documentation updates, and git closeout.

## Closeout

End each invocation by displaying:

- the artifact tree for the feature
- the saved auditor, reviewer, and implementor execution identifiers if available, otherwise the persisted continuity mechanism used
- the current cycle fix report
- the cycle-complete summary with high-level findings, high-level fixes, verification status, and elapsed cycle time
- the commit SHA if push succeeded, or the exact git failure if it did not
