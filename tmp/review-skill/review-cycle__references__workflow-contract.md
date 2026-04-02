# Review-Cycle Contract

Use this file as the execution contract for the skill.

## Inputs

Required:

- `phase_number`
- `feature_slug`
- `task_summary`

Optional:

- `repo_root` default `C:/ADF`
- `scope_hint`
- `non_goals`
- `auditor_model`
- `reviewer_model`
- `auditor_reasoning_effort`
- `reviewer_reasoning_effort`

## Project artifacts

Project-level setup artifact:

- `<repo_root>/.codex/review-cycle/setup.json`

Project-level persistent execution registry:

- `<repo_root>/.codex/review-cycle/agent-registry.json`

Feature root:

- `<repo_root>/docs/phase<phase_number>/<feature_slug>/`

Feature artifact layout:

```text
<repo_root>/docs/phase<phase_number>/<feature_slug>/
  README.md
  context.md
  review-cycle-state.json
  cycle-01/
    audit-findings.md
    review-findings.md
    fix-plan.md
    fix-report.md
  cycle-02/
    ...
```

## setup.json contract

Persist this object under `<repo_root>/.codex/review-cycle/setup.json`:

```json
{
  "project_root": "C:/ADF",
  "preferred_execution_access_mode": "codex_cli_full_auto_bypass",
  "preferred_auditor_access_mode": "codex_cli_full_auto_bypass",
  "preferred_reviewer_access_mode": "codex_cli_full_auto_bypass",
  "preferred_implementor_access_mode": "codex_cli_full_auto_bypass",
  "fallback_execution_access_mode": "inherits_current_runtime_access",
  "runtime_permission_model": "codex_cli_explicit_full_auto",
  "execution_access_notes": "Why this runtime supports or does not support true full-access autonomous execution.",
  "preferred_execution_runtime": "native_agent_tools",
  "persistent_execution_strategy": "per_feature_agent_registry",
  "requires_project_specific_permission_rules": false,
  "project_specific_permission_rules": [],
  "detected_runtime_capabilities": {},
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

Required setup fields:

- `preferred_execution_access_mode`
- `preferred_auditor_access_mode`
- `preferred_reviewer_access_mode`
- `preferred_implementor_access_mode`
- `fallback_execution_access_mode`
- `runtime_permission_model`
- `execution_access_notes`

Setup must also capture:

- which access mode or permission model the runtime supports
- what the skill should request for spawned executions
- what fallback to use if full-access mode is unavailable
- whether any project-specific elevated-permission rules are needed
- which execution runtime and continuity strategy the workflow should prefer

## agent-registry.json contract

Persist this object under `<repo_root>/.codex/review-cycle/agent-registry.json`:

```json
{
  "version": 1,
  "features": {
    "phase1/example-feature": {
      "phase_number": 1,
      "feature_slug": "example-feature",
      "feature_root": "C:/ADF/docs/phase1/example-feature",
      "auditor_execution_id": "agent-1",
      "reviewer_execution_id": "agent-2",
      "implementor_execution_id": "agent-3",
      "auditor_execution_access_mode": "codex_cli_full_auto_bypass",
      "reviewer_execution_access_mode": "codex_cli_full_auto_bypass",
      "implementor_execution_access_mode": "codex_cli_full_auto_bypass",
      "resolved_runtime_permission_model": "codex_cli_explicit_full_auto",
      "updated_at": "ISO-8601"
    }
  }
}
```

Rules:

- the registry key must be stable per feature stream and safe for parallel feature work
- keep auditor, reviewer, and implementor IDs together in the same registry entry
- update the registry whenever any execution ID or execution access mode changes
- do not erase a valid cached execution ID just because a later invocation did not need that lane

## review-cycle-state.json contract

Persist this object shape:

```json
{
  "phase_number": 1,
  "feature_slug": "example-feature",
  "repo_root": "C:/ADF",
  "feature_agent_registry_key": "phase1/example-feature",
  "auditor_execution_id": null,
  "reviewer_execution_id": null,
  "implementor_execution_id": null,
  "auditor_execution_access_mode": null,
  "reviewer_execution_access_mode": null,
  "implementor_execution_access_mode": null,
  "auditor_model": null,
  "reviewer_model": null,
  "auditor_reasoning_effort": null,
  "reviewer_reasoning_effort": null,
  "resolved_runtime_permission_model": null,
  "access_mode_resolution_notes": null,
  "resolved_runtime_capabilities": {},
  "current_branch": null,
  "last_completed_cycle": 0,
  "last_commit_sha": null,
  "active_cycle_number": 1,
  "cycle_runtime": {
    "cycle_number": 1,
    "cycle_name": "cycle-01",
    "status": "review_not_started",
    "cycle_started_at": "ISO-8601",
    "review_requested_at": null,
    "auditor_finished_at": null,
    "reviewer_finished_at": null,
    "implementor_started_at": null,
    "implementor_finished_at": null,
    "verification_finished_at": null,
    "cycle_finished_at": null,
    "report_ready": {
      "auditor": false,
      "reviewer": false
    },
    "report_surfaced": {
      "auditor": false,
      "reviewer": false
    },
    "report_surface_order": [],
    "recreated_executions": {
      "auditor": false,
      "reviewer": false,
      "implementor": false
    }
  },
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

Rules:

- use `null` for unknown execution IDs and commit SHA
- keep `resolved_runtime_capabilities` as an object, not free text
- update `updated_at` on every mutation
- update `last_completed_cycle` only after the cycle is fully closed out
- persist the actual access mode used for each execution, not only the preferred mode from setup
- keep `cycle_runtime` focused on the active or pending-closeout cycle so resume detection stays conservative

## Setup auto-invocation

Before spawning or reusing any execution, `review-cycle` must:

1. load `<repo_root>/.codex/review-cycle/setup.json`
2. validate that the required setup fields exist
3. if setup is missing or incomplete, auto-invoke `$review-cycle-setup`
4. reload setup after setup completes
5. resolve the strongest supported execution-access mode for auditor, reviewer, implementor, and helper executions
6. record the resolved mode in `review-cycle-state.json`

Do not continue to review or fix work with missing setup unless the runtime makes setup creation impossible. In that case, record the limitation and strongest fallback explicitly.

## Access-resolution rules

Prefer the strongest supported autonomous access mode in this order:

1. explicit native full-access or elevated-permission mode
2. explicit Codex CLI full-auto plus bypass mode
3. inherited native runtime access without explicit elevation controls
4. interactive fallback

Important rule:

- if native spawned agents do not expose an explicit access-mode control but `codex exec` can run in stronger non-interactive full-auto bypass mode, prefer the CLI-spawned execution for reviewer or implementor workers and record why

Applies to:

- auditor execution
- reviewer execution
- implementor execution
- any helper execution the workflow spawns

If the runtime cannot provide true full-access autonomous execution:

- detect that clearly
- record the limitation in setup and state
- use the strongest available fallback
- do not silently downgrade to interactive approval mode

## Execution runtime and continuity rules

Use the strongest truthful orchestration mechanism available in this order:

1. native persistent agent tools with `spawn_agent`, `resume_agent`, `send_input`, and `wait_agent`
2. persistent Codex CLI sessions under the resolved autonomous access mode
3. artifact-only continuity through state, context, and saved reports

When native persistent agents are available:

- cache auditor, reviewer, and implementor IDs in both state and the registry
- resume those IDs on later invocations and later cycles
- do not spawn replacement executions unless the cached execution is missing, broken, or under-permissioned

## Execution reuse and recreation rules

Reused executions are allowed only when their persisted access mode is sufficient for the currently required mode.

If an existing auditor, reviewer, or implementor execution was created under weaker access than the current required mode:

- do not silently keep using it
- recreate it under the stronger mode when possible
- update the persisted execution identifier in `review-cycle-state.json`
- update the cached registry entry in `agent-registry.json`
- record the recreation reason in `access_mode_resolution_notes`
- mention the recreation in the detected-status summary and cycle commit body

If `resume_agent` or equivalent execution reuse fails at runtime:

- recreate only the failed execution lane
- keep the other healthy lanes
- persist the new identifier immediately before continuing

## Cycle selection and current-state continuation

- detect the latest existing cycle number conservatively
- if `last_completed_cycle + 1` exists on disk, treat that as the current active cycle even when all four cycle artifacts already exist. This preserves pending verification or git closeout state
- never overwrite a completed `fix-report.md`
- if the current cycle already contains `fix-report.md` and `last_completed_cycle` is still lower than the current cycle number, treat the cycle as pending verification or commit or push closeout rather than starting another review pass
- the fix report from cycle `N` is sent forward only on cycle `N+1`
- if the current cycle already has one review report, reuse it and resume only the missing reviewer lane
- if both review reports already exist for the current cycle, reuse them unless the user explicitly asks to regenerate

## Artifact validity rule

Artifact existence is not enough.

Artifacts are reusable only when they satisfy their required output contract:

- `audit-findings.md` must contain the exact auditor headings
- `review-findings.md` must contain the exact reviewer headings
- `fix-plan.md` must contain the exact fix-plan headings
- `fix-report.md` must contain the exact fix-report headings

If a malformed or interrupted artifact exists:

- do not count it as ready
- do not advance the cycle state from that file alone
- surface the cycle as needing cleanup or regeneration before continuation

## Review input pack

Build the review request from:

- `context.md`
- current repo state
- current branch
- prior cycle `fix-report.md` if it exists
- prior cycle `audit-findings.md` when useful
- prior cycle `review-findings.md` when useful
- `task_summary`
- `scope_hint` when provided
- `non_goals` when provided

Critical rule:

- do not send the current cycle `fix-report.md` to auditor or reviewer in the same run

## Prompt-template rule

The invoker must use the matching prompt template body from `references/prompt-templates.md` for:

- auditor
- reviewer
- implementor

The invoker may wrap the template with cycle-specific context and file references, but it must not paraphrase away the required output headings or weaken the output contract.

## Detected-status summary format

Before taking action, print a short summary that states:

- detected project root
- detected artifact root
- latest cycle number
- current cycle state
- whether `fix-report.md` exists
- whether commit or push is pending
- which execution-access mode will be used for auditor, reviewer, and implementor
- whether any existing execution had to be recreated because of weaker access mode
- which cached execution IDs will be resumed for auditor, reviewer, and implementor
- which reviewer reports are already ready and already surfaced
- what the skill will do next

## Report surfacing rule

When auditor or reviewer work completes and produces a report artifact, the orchestrator must print that report to the user immediately, before implementor fixing starts, using exactly this wrapper:

```text
##################################################################
########### The <Auditor | Reviewer> Report is Ready #############
##################################################################

<show report>

##################################################################
```

Execution rules:

- print the full report body, not only a summary
- print whichever report arrives first as soon as it is ready
- if the second report arrives before implementor work starts, print it the same way immediately on arrival
- do not start implementor fixing until every already-returned report has been surfaced in this wrapper
- if implementor work is not needed because both reports are clean, still surface the reports in this wrapper

## Implementor rules

Implementation remains route-level. Keep this rule unchanged:

- Do not treat the cited files as the scope of the bug. Treat them as evidence of a failure class, then sweep the full route and sibling sites for the same contract break.

Also enforce this rule:

- You must also update all materially affected authoritative documentation in the same cycle, and you must run under the strongest available autonomous access mode supported by the current Codex runtime so the workflow does not stall on permission prompts.

Affected authoritative docs may include:

- design docs
- context docs
- architecture docs
- specs
- runbooks
- related project documents

The implementor execution is persistent too, but it stays idle until both reviewer reports are ready.

## Final cycle summary rule

The invoker must be the source of truth for cycle completion.

A cycle is complete only when:

- auditor finished
- reviewer finished
- implementor finished or was conclusively unnecessary
- verification finished
- `fix-report.md` exists
- commit and push succeeded, or the exact git failure was persisted and surfaced

Before ending, print a cycle summary that includes:

- high-level auditor findings
- high-level reviewer verdicts
- high-level fixes applied
- verification outcome
- remaining debt or explicit non-goals
- total cycle time
- optional phase timing breakdown when available

## Git closeout rules

Each cycle commit must include:

- code changes
- cycle artifacts
- related documentation updates
- setup artifacts if they changed

Commit or push failure rules:

- preserve all artifacts even if git closeout fails
- report the exact git failure
- do not mark the cycle completed in state until closeout succeeded

Commit message body must include:

- execution access mode used for auditor, reviewer, and implementor
- whether any execution was recreated to upgrade access mode
- documentation updated
- why those docs changed
- whether setup was reused, refreshed, or auto-created

## Exact behavior without setup info

When `review-cycle` is called without valid setup info:

1. detect missing or incomplete setup from `<repo_root>/.codex/review-cycle/setup.json`
2. print a status summary that says setup is missing or incomplete and that setup will be auto-created or refreshed
3. run `$review-cycle-setup`
4. persist setup.json
5. reload setup and continue the cycle using the resolved execution-access modes

## Exact behavior in the current situation

If the implementor just finished a fix cycle and `fix-report.md` already exists for the active cycle:

- reuse the existing fix report
- do not re-run the implementor just because the report exists
- detect whether verification, commit, or push is still pending
- finish verification and git closeout conservatively
- only start another audit or review pass on the next invocation or next cycle as the workflow contract allows

## Exact behavior for next-cycle resume

When the next invocation starts cycle `N+1` for the same feature stream:

- reuse the cached auditor, reviewer, and implementor execution IDs from state or registry
- resume those same executions instead of spawning fresh ones
- send the prior cycle `fix-report.md` forward as reviewer context for cycle `N+1`
- keep the same execution IDs unless they are broken or under-permissioned

## Helper commands

Prepare or resume the current cycle and return status summary data:

```powershell
node C:/Users/sufin/.codex/skills/review-cycle/scripts/review-cycle-helper.mjs prepare `
  --phase-number 1 `
  --feature-slug example-feature `
  --task-summary "Close the route-level defect class." `
  --repo-root C:/ADF
```

Update cached execution IDs, access modes, branch, or commit metadata:

```powershell
node C:/Users/sufin/.codex/skills/review-cycle/scripts/review-cycle-helper.mjs update-state `
  --phase-number 1 `
  --feature-slug example-feature `
  --repo-root C:/ADF `
  --auditor-execution-id agent-1 `
  --reviewer-execution-id agent-2 `
  --implementor-execution-id agent-3 `
  --auditor-execution-access-mode codex_cli_full_auto_bypass `
  --reviewer-execution-access-mode codex_cli_full_auto_bypass `
  --implementor-execution-access-mode codex_cli_full_auto_bypass `
  --resolved-runtime-permission-model codex_cli_explicit_full_auto `
  --access-mode-resolution-notes "Reused cached feature-stream agents under CLI full-auto bypass." `
  --last-completed-cycle 1 `
  --last-commit-sha abcdef1
```

Record lifecycle events for the active cycle:

```powershell
node C:/Users/sufin/.codex/skills/review-cycle/scripts/review-cycle-helper.mjs record-event `
  --phase-number 1 `
  --feature-slug example-feature `
  --repo-root C:/ADF `
  --event report-ready `
  --role auditor
```

Render the final cycle summary:

```powershell
node C:/Users/sufin/.codex/skills/review-cycle/scripts/review-cycle-helper.mjs cycle-summary `
  --phase-number 1 `
  --feature-slug example-feature `
  --repo-root C:/ADF
```
