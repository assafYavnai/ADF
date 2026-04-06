# Review-Cycle Contract

Use this file as the execution contract for the skill.

## Inputs

Required:

- `phase_number` positive integer
- `feature_slug` safe feature-stream slug
- `task_summary`

Optional:

- `repo_root` default `C:/ADF`
- `scope_hint`
- `non_goals`
- `auditor_model`
- `reviewer_model`
- `auditor_reasoning_effort`
- `reviewer_reasoning_effort`
- `until_complete` default `false`
- `max_cycles` default `5` when `until_complete=true`

## Feature slug safety

`feature_slug` must be safe for filesystem use.

Allowed:

- slash-separated segments
- letters, numbers, dot, underscore, dash

Forbidden:

- empty segments
- `.` or `..`
- leading slash
- trailing slash
- backslash-based path escape

The helper must reject unsafe slugs instead of resolving them.

## Help and discoverability

Support these discoverability actions in the helper and main skill:

- `help`
- `get-settings`
- `list-features`

Rules:

- if the skill is invoked without inputs, it must show concise help instead of failing
- if `action=help` is requested, show concise help instead of starting a cycle
- if `action=get-settings` is requested, show the resolved setup and runtime/access summary
- if `action=list-features` is requested, show compact review-cycle stream status grouped by current cycle state

Help output must include:

- skill purpose
- supported actions
- required inputs for a normal run
- optional inputs
- transparent setup behavior summary
- current settings summary
- active/open review-cycle streams summary
- resume and pending-closeout notes

Because review-cycle does not own feature completion lifecycle status like implement-plan, `list-features` should group streams by current cycle state rather than by feature lifecycle status. At minimum support:

- `open_or_in_progress`
- `pending_closeout`
- `completed`
- `invalid_or_unreadable`

## Project artifacts

Project-level setup artifact:

- `<repo_root>/.codex/review-cycle/setup.json`

Rules:

- this file is local operational state for the current checkout or worktree
- it may be auto-created or refreshed whenever setup is missing or invalid
- it must not be committed as mergeable source history

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
  "preferred_execution_runtime": "codex_cli_exec",
  "preferred_control_plane_runtime": "native_agent_tools",
  "persistent_execution_strategy": "per_feature_agent_registry",
  "requires_project_specific_permission_rules": false,
  "project_specific_permission_rules": [],
  "detected_runtime_capabilities": {},
  "llm_tools": {},
  "setup_schema_version": 2,
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
- `preferred_execution_runtime`
- `persistent_execution_strategy`

Additional setup rules:

- `project_root` must match the actual repo root used by the cycle
- `preferred_execution_runtime` is the runtime of the worker execution itself
- `preferred_control_plane_runtime` is the runtime that may orchestrate those workers
- if `preferred_execution_access_mode` is `codex_cli_full_auto_bypass`, then `preferred_execution_runtime` must be `codex_cli_exec`
- if `preferred_execution_access_mode` is `claude_code_skip_permissions`, then `preferred_execution_runtime` must be `claude_code_exec`
- `detected_runtime_capabilities` must be an object
- `project_specific_permission_rules` must be an array
- setup must be treated as incomplete if it is missing, unparsable, or internally inconsistent

## Setup allowed values

Runtime-permission-model values:

- `native_explicit_full_access`
- `codex_cli_explicit_full_auto`
- `claude_code_skip_permissions`
- `native_inherited_access_only`
- `interactive_or_limited`

Access-mode values:

- `native_full_access`
- `native_elevated_permissions`
- `codex_cli_full_auto_bypass`
- `claude_code_skip_permissions`
- `inherits_current_runtime_access`
- `interactive_fallback`

Execution-runtime values:

- `native_agent_tools`
- `codex_cli_exec`
- `claude_code_exec`
- `artifact_continuity_only`

Persistent-execution-strategy values:

- `per_feature_agent_registry`
- `per_feature_cli_sessions`
- `artifact_continuity_only`

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
- do not erase a valid cached execution ID merely because a later invocation did not refresh that lane
- if the registry is missing or malformed, treat it as empty and rebuild conservatively

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
  "split_review_continuity": {
    "mode": "full_pair",
    "approving_lane": null,
    "rejecting_lane": null,
    "final_sanity_lane": null,
    "carried_from_cycle": null,
    "final_sanity_completed": false,
    "updated_at": null,
    "note": null
  },
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
    "lane_verdicts": {
      "auditor": "unknown",
      "reviewer": "unknown"
    },
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
- persist split-review continuity separately from the current-cycle runtime so the next cycle can reuse the approving lane truthfully
- record the per-lane verdict conservatively as `approve`, `reject`, or `unknown`
- if state is malformed or unparsable, reinitialize it conservatively and repopulate missing continuity from the registry when possible

## Setup auto-invocation

Before spawning or reusing any execution, `review-cycle` must:

1. load `<repo_root>/.codex/review-cycle/setup.json`
2. validate that the required setup fields exist
3. validate that setup enums and worker/control-plane runtime relationships are coherent
4. if setup is missing, incomplete, unparsable, or incoherent, read `references/setup-contract.md` and run the internal `review-cycle-setup-helper.mjs`
5. reload setup after setup completes
6. resolve the strongest supported execution-access mode for auditor, reviewer, implementor, and helper executions
7. record the resolved permission model and capabilities in `review-cycle-state.json`

Do not continue to review or fix work with missing setup unless the runtime makes setup creation impossible. In that case, record the limitation and strongest fallback explicitly.

## Loop mode

Default behavior is one cycle per invocation.

If `until_complete=true`:

- default `max_cycles` to `5` unless the user provided another cap
- continue automatically only while each completed cycle shows that another real fix pass is still required
- stop immediately on setup or access failure, git closeout failure, unresolved contract ambiguity, or repeated rejection without material progress
- when the cycle cap is reached, stop and surface the exact remaining open route work and current stream state
- when the invocation is a post-human-approval sanity pass, only continue while any required fix preserves the already approved human-facing behavior; otherwise stop and return the slice to human verification

## Access-resolution rules

Prefer the strongest supported autonomous access mode in this order:

1. explicit native full-access or elevated-permission mode
2. explicit Codex CLI full-auto plus bypass mode
3. inherited native runtime access without explicit elevation controls
4. interactive fallback

Important rule:

- if native spawned agents do not expose an explicit worker access-mode control but `codex exec` can run in stronger non-interactive full-auto bypass mode, prefer CLI-backed worker executions and record why
- native agent tools may still be used as the control plane if setup says so, but the worker runtime must remain truthful

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
2. persistent Codex CLI sessions under the resolved autonomous worker access mode
3. artifact-only continuity through state, context, and saved reports

When native persistent agents are available as the control plane:

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

## Worker spawn pattern

To spawn a non-default worker for auditor, reviewer, or implementor roles, use the `autonomous_invoke` from `setup.json` `llm_tools`:

```bash
bash -c '<autonomous_invoke> "<prompt_or_file>"'
```

Where `<autonomous_invoke>` is the full autonomous invocation prefix for the tool (e.g. `codex exec --full-auto --dangerously-auto-approve`, `claude --dangerously-skip-permissions`, `gemini`) and `<prompt_or_file>` is the prompt string or path to the prompt file.

Rules:

- only spawn workers whose `available` is `true` in `llm_tools`
- use the `autonomous_invoke` value exactly as provided; do not construct invocation strings manually
- if no non-default workers are available, fall back to the resolved default worker from the access-resolution rules

## Cycle selection and current-state continuation

- detect the latest existing cycle number conservatively
- if `last_completed_cycle + 1` exists on disk, treat that as the current active cycle even when all four cycle artifacts already exist. This preserves pending verification or git closeout state
- never overwrite a completed `fix-report.md`
- if the current cycle already contains `fix-report.md` and `last_completed_cycle` is still lower than the current cycle number, treat the cycle as pending verification or commit or push closeout rather than starting another review pass
- the fix report from cycle `N` is sent forward only on cycle `N+1`
- if the current cycle already has one review report, reuse it and resume only the missing required lane for the active strategy
- if a prior cycle ended in a split verdict, carry the approving lane forward and rerun only the rejecting lane on the next cycle
- if that rejecting lane clears, require one final `regression_sanity` pass from the previously approving lane before closure
- if both required review reports already exist for the active strategy, reuse them unless the user explicitly asks to regenerate
- when inferring already-completed history from disk and git, count only contiguous cycles whose artifacts are valid and cleanly tracked

## Artifact validity rule

Artifact existence is not enough.

Artifacts are reusable only when they satisfy their required output contract:

- the exact required headings must exist
- the headings must be unique
- the headings must appear in the correct order
- fenced code blocks do not count as valid heading locations

If a malformed or interrupted artifact exists:

- do not count it as ready
- do not advance the cycle state from that file alone
- surface the cycle as needing cleanup or regeneration before continuation

## Split verdict handling

If one review lane clears and the other does not:

- persist `split_review_continuity.mode=rejecting_lane_only`
- store which lane approved and which lane rejected
- on the next cycle, request only the rejecting lane and carry the previously approving lane forward as reusable evidence
- do not silently rerun the previously approving lane in that next cycle
- when the rejecting lane later clears, switch continuity to `final_regression_sanity`
- request one final `regression_sanity` pass from the previously approving lane
- only after that final sanity pass clears may the split verdict be treated as fully resolved
- if the final sanity lane rejects, flip the split so that lane becomes the only lane rerun on the next cycle

Conservative approval mapping for helper state:

- treat a lane as `approve` only when the invoker has actually reviewed the report and concluded no required fix remains for that lane
- otherwise record `reject`
- if the invoker cannot classify the report truthfully, leave the lane verdict as `unknown` and do not advance split-review continuity

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

## Task normalization gate

If `task_summary` is already narrow and route-clean, keep it as-is.

If it mixes route, proof, docs, persistence, recovery, telemetry, or lifecycle concerns, normalize it into one compact route contract before sending review or implementation work.

The normalized contract must identify:

- failure classes to close
- claimed supported route
- proof route required
- mutation boundary
- shared-surface risk boundary
- KPI applicability and KPI closure expectation
- docs in scope
- non-goals

Keep this compact.
Do not create a second planning artifact just for normalization.

## Prompt-template rule

The invoker must use the matching prompt template body from `references/prompt-templates.md` for:

- auditor
- reviewer
- implementor

The invoker may wrap the template with cycle-specific context and file references, but it must not paraphrase away the required output headings or weaken the output contract.

## Pre-code route-contract freeze

Use `fix-plan.md` as the mandatory pre-code freeze artifact.
Keep the existing exact headings.

Do not let code changes start until `fix-plan.md` is valid and its sections freeze:

- `1. Failure Classes`: the normalized failure classes to close
- `2. Route Contracts`: claimed supported route, end-to-end invariants, allowed mutation surfaces, forbidden shared-surface expansion, and docs to update
- `3. Sweep Scope`: sibling callers, adjacent routes, shared surfaces, and route boundaries to inspect
- `4. Planned Changes`: the minimal layers to change and any new power being introduced
- `5. Closure Proof`: proof route, negative proof required, live/proof isolation checks, and targeted regression checks
- `6. Non-Goals`: explicit out-of-scope work

A valid heading structure alone is not enough.
The invoker must reject a thin or endpoint-only freeze.

## KPI closure gate

Every applicable route under review must carry an explicit KPI judgment instead of leaving KPI status implicit.

Rules:

- `fix-plan.md` must freeze `KPI Applicability` as one of:
  - `required`
  - `not required`
  - `temporary exception approved`
- if KPI is required or covered by a temporary exception, `fix-plan.md` must also freeze:
  - `KPI Route / Touched Path`
  - `KPI Raw-Truth Source`
  - `KPI Coverage / Proof`
  - `KPI Production / Proof Partition`
- if KPI is not required, `fix-plan.md` must state `KPI Non-Applicability Rationale`
- if a temporary KPI exception is used, `fix-plan.md` must also state:
  - `KPI Exception Owner`
  - `KPI Exception Expiry`
  - `KPI Exception Production Status`
  - `KPI Compensating Control`
- auditor and reviewer reports must explicitly state `KPI Closure State` as `Closed`, `Partial`, `Open`, or `Temporary Exception`
- do not treat a route as closed when KPI proof is missing, when the KPI proof route does not match the claimed route, or when the temporary exception details are incomplete
- do not let vague observability wording substitute for the explicit KPI fields above

## Vision / Phase 1 / Master-Plan compatibility gate

Every route under review must carry explicit compatibility judgments against the full authority chain.

Rules:

- `fix-plan.md` must freeze all seven compatibility fields:
  - `Vision Compatibility` — how the fix relates to `docs/VISION.md` strategic constraints
  - `Phase 1 Compatibility` — how the fix fits within `docs/PHASE1_VISION.md` scope
  - `Master-Plan Compatibility` — how the fix aligns with `docs/PHASE1_MASTER_PLAN.md` mission filter
  - `Current Gap-Closure Compatibility` — which gap (A-E) from `docs/phase1/adf-phase1-current-gap-closure-plan.md` the fix closes or supports
  - `Later-Company Check` — `yes` or `no`
  - `Compatibility Decision` — `compatible`, `defer-later-company`, or `blocked-needs-user-decision`
  - `Compatibility Evidence` — substantive evidence supporting the decision
- auditor and reviewer reports must explicitly state `Compatibility Verdict` as `Compatible` or `Incompatible`
- do not treat a route as closed when any of the seven compatibility fields is missing
- do not treat a route as closed when `Compatibility Decision` is not `compatible` or when `Later-Company Check` is `yes`
- do not let vague compatibility wording substitute for explicit authority-chain references

## Shared-surface and new-power gate

If the fix adds or broadens any shared capability such as:

- env var
- schema field
- `workflow_status` or lifecycle field
- controller argument
- generic create/update path
- shared helper behavior
- reusable mutation surface

Then before coding the plan must say:

- who may set it
- who must not set it
- what sibling routes or callers could misuse it
- what negative proof will show misuse is blocked

Happy-path proof alone cannot close such a change.

## Live-route vs proof-route isolation gate

For any route closure, especially when proof uses harnesses or toggles, inspect:

- proof or test seams contaminating live bootstrap
- env vars or harness knobs that can silently alter production behavior
- proof paths that are stronger or weaker than the claimed supported runtime path

If isolation is not shown, closure stays open.

## Claimed-route vs proved-route closure gate

Before closure, compare:

- claimed supported route
- route actually mutated by the code
- route actually exercised by proof

If these do not match, the reviewer must mark the fix `Partial` or `Open` and name the remaining gap.

KPI proof must obey the same rule:

- if KPI closure is claimed, the claimed KPI route, the route actually changed, and the route actually proved must line up
- if they do not line up, the reviewer must keep KPI closure `Partial` or `Open`

## Regression forecast gate

Before coding, the plan must name the most likely regressions the fix could create and the targeted checks that will guard them.

Shared-surface changes must forecast sibling misuse, lifecycle drift, bootstrap contamination, or proof-only path drift when relevant.

## Detected-status summary format

Before taking action, print a short summary that states:

- detected project root
- detected artifact root
- latest cycle number
- current cycle state
- whether `fix-report.md` exists
- whether commit or push is pending
- which execution-access mode will be used for auditor, reviewer, and implementor
- which worker runtime and control-plane runtime are in effect
- whether any existing execution had to be recreated because of weaker access mode
- which cached execution IDs will be resumed for auditor, reviewer, and implementor
- which reviewer reports are already ready and already surfaced
- which `review_strategy` is active: `full_pair`, `rejecting_lane_only`, or `final_regression_sanity`
- which lane is being carried forward and which lane must still run, when split-review continuity is active
- whether setup has validation errors or warnings
- what the skill will do next

## Report surfacing rule

When auditor or reviewer work completes and produces a report artifact, the orchestrator must print that report to the user immediately, before implementor fixing starts, using exactly this wrapper:

```text
##################################################################
########### The <Auditor | Reviewer> Report is Ready - <APPROVED | REJECTED> ###########
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
- the report body itself must start section 1 with `Overall Verdict: APPROVED|REJECTED`
- the report body itself must end with `Final Verdict: APPROVED|REJECTED`
- the report body must stay human-facing and easy to scan, not a blob of dense prose

## Fix-cycle continuity contract

When a review cycle rejects and requires a fix pass, the orchestrator must reuse the same implementor execution that produced the prior fix, unless that execution is broken or under-permissioned.

Rules:

- rejection or fix cycles reuse the same implementor execution when it is still valid
- normal fix cycles do not send a fresh long implementation prompt to the implementor
- normal fix cycles send only the rejected findings or report artifact paths plus a short fix instruction
- the implementor receives only the delta work, not a full re-bootstrap

## Reopen guardrail contract

Do not open cycle `N+1` for a feature stream unless at least one of these conditions is true:

- there are new diffs on the feature branch since the last approved cycle
- the invoker explicitly requests a reopen

Rules:

- when neither condition is met, surface a message that the review stream is already approved with no new changes and stop
- do not start a new audit or review pass when the last completed cycle was approved and the branch has not changed
- the invoker may override the guardrail by passing an explicit reopen request
- the guardrail protects against accidental double-review, not against intentional re-review

## Implementor rules

Implementation remains route-level. Keep this rule unchanged:

- Do not treat the cited files as the scope of the bug. Treat them as evidence of a failure class, then sweep the full route and sibling sites for the same contract break.

Also enforce this rule:

- You must also update all materially affected authoritative documentation in the same cycle, and you must run under the strongest available autonomous access mode supported by the current Codex runtime so the workflow does not stall on permission prompts.

Additional implementation gates:

- `fix-plan.md` must be created or updated before code changes and must satisfy the pre-code route-contract freeze
- `fix-plan.md` must also freeze KPI applicability, KPI closure expectations, and any approved KPI exception details
- if a shared surface changes, require explicit new-power analysis and negative proof before closure
- if proof relies on a seam, harness, toggle, or env knob, require live-route vs proof-route isolation evidence
- if claimed supported route, mutated route, and proved route do not match, keep the fix open
- if KPI closure is required and the KPI fields or KPI proof stay incomplete, keep the fix open
- require pre-code regression forecasting with targeted checks, not only post-hoc verification

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
- KPI closure status
- high-level fixes applied
- verification outcome
- remaining debt or explicit non-goals
- total cycle time
- optional phase timing breakdown when available

## Human-facing report rule

The cycle artifacts and surfaced reports are decision tools for humans.

Rules:

- keep audit, review, fix-plan, fix-report, and cycle-summary outputs easy to scan
- lead with the current verdict or route state before longer detail
- use short sections and concise bullets when the content is list-shaped
- separate status, findings, and next actions instead of blending them together
- reference long evidence instead of pasting giant text blocks unless exact text is required

## Completion-summary normalization rule

When the review cycle reaches approval closeout (both required review lanes satisfied), the invoker must call `normalize-completion-summary` on the feature's `completion-summary.md` before the final approved commit. This rewrites the summary to the exact required 7-heading contract so that `merge-queue` and `mark-complete` can succeed without manual cleanup.

Call: `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs normalize-completion-summary --project-root <repo_root_or_worktree> --phase-number <phase_number> --feature-slug <feature_slug>`

Rules:

- call after all review work is finished and before the final approval commit and push
- if the summary is already valid, no changes are made
- if the summary is missing, treat it as a blocker
- include any normalization changes in the same approval commit

## Git closeout rules

Each cycle commit must include:

- code changes
- cycle artifacts
- related documentation updates
- completion-summary normalization changes when the cycle is an approval closeout

Do not commit local operational setup artifacts such as `.codex/*/setup.json`, even when they were refreshed during the cycle.

Commit or push failure rules:

- preserve all artifacts even if git closeout fails
- report the exact git failure
- do not mark the cycle completed in state until closeout succeeded

Commit message body must include:

- execution access mode used for auditor, reviewer, and implementor
- whether any execution was recreated to upgrade access mode
- worker runtime and control-plane runtime when they differ
- documentation updated
- why those docs changed
- whether setup was reused, refreshed, or auto-created

## Exact behavior without setup info

When `review-cycle` is called without valid setup info:

1. detect missing, invalid, or inconsistent setup from `<repo_root>/.codex/review-cycle/setup.json`
2. print a status summary that says setup is missing, invalid, or incomplete and that setup will be auto-created or refreshed
3. run `node C:/ADF/skills/review-cycle/scripts/review-cycle-setup-helper.mjs write-setup ...`
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
- if there is no split verdict continuity, request both review lanes as usual
- if the prior cycle ended with one lane approved and one lane rejected, request only the rejecting lane and carry the approving lane forward
- if the rejecting lane later clears, request only the final `regression_sanity` lane from the previously approving side
- keep the same execution IDs unless they are broken or under-permissioned

## Helper commands

Render help and current review-cycle stream summary:

```powershell
node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs help `
  --repo-root C:/ADF
```

Render resolved settings summary:

```powershell
node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs get-settings `
  --repo-root C:/ADF
```

Render compact feature-stream summary:

```powershell
node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs list-features `
  --repo-root C:/ADF
```

Prepare or resume the current cycle and return status summary data:

```powershell
node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs prepare `
  --phase-number 1 `
  --feature-slug example-feature `
  --task-summary "Close the route-level defect class." `
  --repo-root C:/ADF
```

Update cached execution IDs, access modes, branch, or commit metadata:

```powershell
node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs update-state `
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
node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs record-event `
  --phase-number 1 `
  --feature-slug example-feature `
  --repo-root C:/ADF `
  --event report-ready `
  --role auditor `
  --lane-verdict approve
```

Render the final cycle summary:

```powershell
node C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs cycle-summary `
  --phase-number 1 `
  --feature-slug example-feature `
  --repo-root C:/ADF
```
