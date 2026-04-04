---
name: review-cycle
description: Run one full route-level audit, review, fix, verify, documentation-update, and closeout cycle for an ADF feature under C:/ADF, or show review-cycle help, settings, or known feature-stream status. Use when the user wants the next review pass for a phase feature, with strict setup validation, truthful execution-access resolution, persistent per-feature auditor/reviewer/implementor continuity, resumable cycle artifacts under docs/phaseN/feature-slug/, and commit or push closeout at the end of the run.
---

# Review Cycle

By default, use this skill for exactly one audit or review or fix cycle per invocation.
If `until_complete=true`, keep cycling until the review stream is fully closed or the configured cycle cap is reached.

## Default behavior

If the skill is invoked with no inputs, or with `action=help`, return concise help.

The help output must include:

- what the skill does
- required inputs
- optional inputs
- supported actions
- current settings summary
- current active/open review-cycle streams summary
- how incomplete-cycle resume works
- what happens when the current cycle is already pending closeout

## Supported actions

- `action=help`
- `action=get-settings`
- `action=list-features`
- `action=run`

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
- `until_complete` default `false`
- `max_cycles` default `5` when `until_complete=true`

If a required input is missing, ask only for the missing field.

## Input safety rules

- `phase_number` must be a positive integer.
- `feature_slug` must be a safe feature-stream slug. Allow only slash-separated path segments made of letters, numbers, dot, underscore, and dash.
- Never allow `feature_slug` path traversal such as `..`, empty segments, leading slash, trailing slash, or backslash-based escaping.

## Start sequence

1. If no inputs are provided, or `action=help`, run `node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs help ...` and print the help output.
2. If `action=get-settings`, run `node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs get-settings ...` and print the resolved settings summary.
3. If `action=list-features`, run `node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs list-features ...` and print the compact review-cycle stream summary.
4. For `action=run`, read [references/workflow-contract.md](references/workflow-contract.md).
5. For `action=run`, read [references/prompt-templates.md](references/prompt-templates.md).
6. Load `<repo_root>/.codex/review-cycle/setup.json`.
7. If setup is missing, incomplete, unparsable, or internally inconsistent, read [references/setup-contract.md](references/setup-contract.md) and run the internal setup helper before continuing.
8. Run `node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs prepare ...`.
9. Treat the helper JSON as the source of truth for:
   - active cycle selection
   - setup validity
   - registry continuity
   - current resume point
   - whether any execution must be recreated because its persisted access mode is weaker than the required mode
10. Print the detected-status summary before taking action.

## Task normalization and pre-code contract gate

If `task_summary` is already narrow and route-clean, keep it compact.
If it mixes route, proof, docs, persistence, recovery, telemetry, or lifecycle concerns, normalize it into one compact route contract before sending main work.

Rules:

- use that normalized contract in the auditor, reviewer, and implementor requests when the raw task is broad or mixed
- do not let serious implementation begin until `fix-plan.md` exists as a valid artifact and freezes:
  - failure classes
  - claimed supported route and end-to-end invariants
  - KPI applicability and KPI closure expectation
  - Vision Compatibility, Phase 1 Compatibility, Master-Plan Compatibility, Current Gap-Closure Compatibility, Later-Company Check, Compatibility Decision, and Compatibility Evidence
  - allowed mutation surfaces
  - forbidden shared-surface expansion
  - sibling sweep scope
  - closure proof, including claimed-route vs proved-route match
  - regression forecast and targeted checks
  - docs to update
  - non-goals
- keep the existing exact `fix-plan.md` headings; tighten content, not artifact shape

## Prompt-template rule

When dispatching auditor, reviewer, or implementor work:

- use the corresponding prompt template body from `references/prompt-templates.md`
- keep the template headings and output contract exact
- do not drop the required route-contract freeze, new-power analysis, negative-proof, isolation, or claimed-route vs proved-route checks
- add cycle-specific context around the template, but do not paraphrase or weaken the template body itself

## Repo-source rule

The authoritative source for this skill family is `C:/ADF/skills/review-cycle`.

Rules:

- treat the repo-owned skill folder as the source of truth
- treat installed target copies under Codex, Claude, or Gemini roots as generated install output
- update installed target copies through `C:/ADF/skills/manage-skills.mjs`, not by editing them in place

## Access-mode rule

All spawned executions used by this workflow must run under the strongest truthful non-interactive autonomous access mode the current Codex runtime supports.

Resolve access in this order:

1. explicit native full-access or elevated-permission mode
2. explicit Codex CLI full-auto plus bypass mode
3. inherited runtime access without explicit elevation controls
4. interactive fallback only when no stronger autonomous mode exists

Important distinction:

- `preferred_execution_runtime` is the runtime of the worker execution itself
- `preferred_control_plane_runtime` is the runtime that may orchestrate those workers

If the strongest explicit worker mode is CLI-based, the worker runtime must be `codex_cli_exec` even if native agent tools are available as the control plane.

Do not silently downgrade.

## Full-loop control rule

The skill invoker owns the full review loop.

That means this skill, not the implementor worker, must:

- load setup and state
- resolve or refresh access modes
- reuse or recreate the dedicated auditor, reviewer, and implementor executions
- normalize broad task summaries into one compact route contract before worker dispatch when needed
- send review requests
- wait for reviewer completions
- surface reviewer reports immediately on arrival
- block implementor fixing until both reviewer reports are ready and every already-returned report has been surfaced
- synthesize the fix plan
- resume the implementor with the implementor prompt and report paths
- run verification
- write and display the final fix report
- commit and push
- if `until_complete=true`, decide truthfully whether another cycle is still required and continue until closure or `max_cycles` is reached
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
- recreate only the missing, broken, or under-permissioned execution lane
- keep different feature streams isolated so multiple feature slugs can run in parallel without colliding
- do not erase a valid cached registry entry merely because the current invocation did not refresh that lane

## Reviewer loop

Default first-pass behavior:

- run the auditor and reviewer in parallel

As soon as either reviewer finishes:

1. save its report artifact
2. record the completion in helper state
3. classify the lane conservatively as `approve` or `reject`
4. print the full report immediately in the required wrapper
5. record that the report was surfaced
6. keep waiting for the remaining required review lanes for the active strategy

By default, do not start or resume implementor fixing until both reviewer reports exist and every already-returned report has been surfaced.

## Continuous mode rule

If `until_complete=true`:

- default `max_cycles` to `5` unless the user supplied another value
- continue into the next cycle automatically only when another real fix pass is required
- stop early on blockers such as setup or access failure, git closeout failure, unresolved contract ambiguity, or repeated rejection with no material delta
- when the cycle cap is reached without closure, stop and surface the exact remaining open route work
- when the invocation is a post-human-approval sanity pass, only keep looping while the fix preserves the approved human-facing behavior; if the required fix would change that behavior, stop and return the slice to human testing instead of silently continuing

## Split verdict rule

If one lane clears and the other lane still rejects:

- persist that split verdict in helper state
- carry the previously approving lane forward as reusable evidence
- on the next cycle, rerun only the rejecting lane
- do not rerun the previously approving lane in that next cycle unless final `regression_sanity` is required or the user explicitly asks to regenerate
- if the rejecting lane clears, run one final `regression_sanity` pass with the previously approving lane before treating the review as closed
- if that final `regression_sanity` pass rejects, flip the split and rerun only that new rejecting lane on the following cycle
- use the helper-reported `review_strategy` as the source of truth for which lanes to request in the active cycle

## Report surfacing rule

When auditor and reviewer executions return reports, print each completed report immediately before any implementor fixing begins, in this exact wrapper:

```text
##################################################################
########### The <Auditor | Reviewer> Report is Ready - <APPROVED | REJECTED> ###########
##################################################################

<show report>

##################################################################
```

Rules:

- show the full report body, not only a summary
- print the report as soon as that agent returns, even if the other report is still running
- if both reports finish before implementor work starts, print both in arrival order
- do not start implementor fixing until every already-returned report has been surfaced in this wrapper
- require the report body itself to start section 1 with `Overall Verdict: APPROVED|REJECTED` and end with `Final Verdict: APPROVED|REJECTED`
- keep surfaced reports human-facing and easy to scan instead of emitting dense wall-of-text output

## Implementor lane rule

The implementor execution is also persistent and cached per feature stream.

Rules:

- create or reuse the implementor execution under the strongest resolved access mode, just like auditor and reviewer
- keep the implementor idle until the helper-reported required review evidence is ready for the active strategy
- when the helper says review evidence is ready, send the implementor the current cycle request, the active-cycle report paths, any carried-forward approval context, the reusable context, and the implementor prompt from [references/prompt-templates.md](references/prompt-templates.md)
- require the implementor to freeze the route contract in `fix-plan.md` before code changes
- require `fix-plan.md` to freeze KPI applicability, KPI closure state, and temporary KPI exception details when KPI closure is deferred
- require explicit new-power analysis when the fix introduces or broadens a shared surface
- require negative proof for shared-surface changes, not only happy-path proof
- require live-route vs proof-route isolation checks when proof uses seams, toggles, harnesses, or alternate bootstrap paths
- require claimed supported route, route mutated, and route proved to close or remain explicitly open
- require KPI closure to stay explicitly `Closed`, `Partial`, `Open`, or `Temporary Exception`; do not allow silent KPI gaps
- require the implementor to update all materially affected authoritative docs in the same cycle
- require proof-bearing closure, not narrative-only closure
- do not let the implementor widen scope into general refactoring

## Current-cycle rule

If the current cycle already has a completed `fix-report.md`, do not overwrite it. Detect whether the cycle is awaiting verification, commit, or push closeout and finish that conservatively before starting another review pass.

## Artifact validity rule

Cycle artifacts count as reusable only when they satisfy the output contract for that artifact.

At minimum:

- every required heading must exist
- every required heading must appear exactly once
- the required headings must appear in the correct order
- fenced code blocks do not count as valid heading locations

Do not treat file existence alone as proof that a cycle step is complete.
If an interrupted or malformed artifact exists, treat the cycle as needing regeneration or cleanup, not as ready to continue from that artifact.

## Resume rules

When the skill is invoked again for the same feature stream:

- call `prepare` first
- trust the helper-selected active cycle and current cycle state
- if the helper reports cached execution IDs with sufficient access, resume those executions instead of spawning new ones
- if the helper reports `resume_pending_closeout`, finish verification and git closeout before sending new review work
- if the helper reports one reviewer already finished, surface the existing report if needed and keep waiting only for the remaining required review lane
- if the helper reports `review_strategy.mode=rejecting_lane_only`, carry forward the previously approving lane and rerun only the rejecting lane
- if the helper reports `review_strategy.mode=final_regression_sanity`, run only the final `regression_sanity` lane and do not restart the full pair
- if the helper reports both required review lanes already satisfied for the active strategy, do not rerun them unless the user explicitly asks to regenerate
- if the helper reports setup validation errors, refresh setup before review work starts
- if the helper reports state repairs, continue from the repaired state instead of assuming the old cache was reliable

## Native orchestration preference

When the current Codex runtime exposes native orchestration tools such as `spawn_agent`, `resume_agent`, `send_input`, and `wait_agent`, use them as the primary control plane when that is truthful and compatible with the selected worker runtime.

Preferred flow:

1. `resume_agent` for cached IDs when available
2. `spawn_agent` only for missing, broken, or under-permissioned lanes
3. `send_input` to dispatch cycle requests
4. `wait_agent` to detect reviewer completion
5. `wait_agent` or resumed-turn completion to detect implementor completion

If the strongest truthful worker runtime is CLI-based, native tools may still orchestrate those CLI-backed workers if setup says so. Otherwise fall back to the strongest truthful continuity strategy recorded in setup and state.

## Helper scripts

Use the helper scripts for deterministic local state:

- `node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs help ...`
- `node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs get-settings ...`
- `node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs list-features ...`
- `node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs prepare ...`
  The prepare result now includes a single `review_strategy` object that tells the invoker whether to run the full pair, only the rejecting lane, or the final `regression_sanity` lane.
- `node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs update-state ...`
- `node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs record-event ...`
- `node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs cycle-summary ...`
- `node C:/ADF/skills/review-cycle/scripts/review-cycle-setup-helper.mjs write-setup ...`

Use the helper as the deterministic state machine. The Codex agent still owns actual prompting, waiting, verification, documentation updates, and git closeout.

## Closeout

End each invocation by displaying:

- the artifact tree for the feature
- the saved auditor, reviewer, and implementor execution identifiers if available, otherwise the persisted continuity mechanism used
- the current cycle fix report
- the cycle-complete summary with high-level findings, high-level fixes, verification status, and elapsed cycle time
- the commit SHA if push succeeded, or the exact git failure if it did not

User-facing review-cycle reports must stay human-facing:

- lead with the current verdict and route state
- keep sections short and easy to scan
- separate findings, fixes, and next actions
- avoid dense narrative blobs
