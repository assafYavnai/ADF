# Implement-Plan Workflow Contract

Use this file as the execution contract for the skill.

## Inputs

Required for `action=prepare` and `action=run`:

- `project_root`
- `phase_number` positive integer
- `feature_slug` safe feature-stream slug
- `task_summary`

Optional:

- `scope_hint`
- `non_goals`
- `implementor_model`
- `implementor_reasoning_effort`
- `feature_status_override`
- `post_send_to_review` default `false`
- `post_send_for_review` deprecated compatibility alias for `post_send_to_review`
- `review_until_complete` default `false`; only valid when `post_send_to_review=true`
- `review_max_cycles` optional positive integer; only valid when `review_until_complete=true`

## Review handoff flags

Resolve `post_send_to_review` first and treat `post_send_for_review` only as a deprecated compatibility alias.

Rules:

- do not invoke `review-cycle` unless the resolved post-review handoff flag is `true`
- if `review_until_complete=true`, pass `until_complete=true` to `review-cycle`
- if `review_max_cycles` is provided, pass `max_cycles=<value>` to `review-cycle`
- if `review_until_complete=true` and `review_max_cycles` is omitted, let `review-cycle` use its default cap of `5`
- reject `review_until_complete` or `review_max_cycles` when post-review handoff is not enabled
- reject `review_max_cycles` when `review_until_complete=false`

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

## Path variables

The helper must resolve and return at minimum:

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

## Project-level artifacts

Project-level state root:

- `<project_root>/.codex/implement-plan/`

Project-level files:

- `<project_root>/.codex/implement-plan/setup.json`
- `<project_root>/.codex/implement-plan/agent-registry.json`
- `<project_root>/.codex/implement-plan/features-index.json`

Feature root:

- `<project_root>/docs/phase<phase_number>/<feature_slug>/`

Feature artifact layout:

```text
<project_root>/docs/phase<phase_number>/<feature_slug>/
  README.md
  context.md
  implement-plan-state.json
  implement-plan-contract.md
  implement-plan-pushback.md
  implement-plan-brief.md
  implementation-run/
  completion-summary.md
```

Optional inherited supporting artifacts that may already exist under the same feature root:

- `cycle-XX/audit-findings.md`
- `cycle-XX/review-findings.md`
- `cycle-XX/fix-plan.md`
- `cycle-XX/fix-report.md`
- related spec, architecture, context, settings, or preference docs

## setup.json contract

Persist this shape under `<project_root>/.codex/implement-plan/setup.json`:

```json
{
  "project_root": "C:/ExampleProject",
  "preferred_execution_access_mode": "codex_cli_full_auto_bypass",
  "preferred_implementor_access_mode": "codex_cli_full_auto_bypass",
  "fallback_execution_access_mode": "inherits_current_runtime_access",
  "runtime_permission_model": "codex_cli_explicit_full_auto",
  "execution_access_notes": "CLI full-auto plus bypass is the strongest truthful worker mode available here.",
  "preferred_execution_runtime": "codex_cli_exec",
  "preferred_control_plane_runtime": "native_agent_tools",
  "persistent_execution_strategy": "per_feature_agent_registry",
  "preferred_implementor_model": "gpt-5.4",
  "preferred_implementor_reasoning_effort": "xhigh",
  "requires_project_specific_permission_rules": false,
  "project_specific_permission_rules": [],
  "detected_runtime_capabilities": {},
  "setup_schema_version": 1,
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

Required setup fields:

- `preferred_execution_access_mode`
- `preferred_implementor_access_mode`
- `fallback_execution_access_mode`
- `runtime_permission_model`
- `execution_access_notes`
- `preferred_execution_runtime`
- `persistent_execution_strategy`

Validation rules:

- `project_root` must match the requested project root
- `preferred_execution_access_mode` and `preferred_implementor_access_mode` must be supported enum values
- `runtime_permission_model` must be a supported enum value
- `preferred_execution_runtime` must be a supported enum value
- `preferred_control_plane_runtime` must be a supported enum value when present
- `persistent_execution_strategy` must be a supported enum value
- if `preferred_execution_access_mode` is `codex_cli_full_auto_bypass`, then `preferred_execution_runtime` must be `codex_cli_exec`
- `detected_runtime_capabilities` must be an object
- `project_specific_permission_rules` must be an array
- setup is incomplete if missing, unparsable, stale, or internally inconsistent

## agent-registry.json contract

Persist this shape under `<project_root>/.codex/implement-plan/agent-registry.json`:

```json
{
  "version": 1,
  "features": {
    "phase1/example-feature": {
      "phase_number": 1,
      "feature_slug": "example-feature",
      "feature_root": "C:/ExampleProject/docs/phase1/example-feature",
      "implementor_execution_id": "agent-123",
      "implementor_execution_access_mode": "codex_cli_full_auto_bypass",
      "implementor_model": "gpt-5.4",
      "implementor_reasoning_effort": "xhigh",
      "resolved_runtime_permission_model": "codex_cli_explicit_full_auto",
      "updated_at": "ISO-8601"
    }
  }
}
```

Rules:

- the registry key must be stable per feature stream and safe for parallel feature work
- update the registry whenever implementor execution identity or execution access details change
- do not erase a valid cached execution ID merely because the current invocation did not refresh that lane
- if the registry is missing or malformed, treat it as empty and rebuild conservatively

## features-index.json contract

Persist this shape under `<project_root>/.codex/implement-plan/features-index.json`:

```json
{
  "version": 1,
  "updated_at": "ISO-8601",
  "features": {
    "phase1/example-feature": {
      "phase_number": 1,
      "feature_slug": "example-feature",
      "feature_root": "C:/ExampleProject/docs/phase1/example-feature",
      "feature_status": "active",
      "active_run_status": "context_ready",
      "last_completed_step": "context_collected",
      "last_commit_sha": null,
      "updated_at": "ISO-8601"
    }
  }
}
```

Feature status values:

- `active`
- `blocked`
- `completed`
- `closed`

Rules:

- `active` and `blocked` are open features
- `completed` and `closed` are not open features
- `action=run` must fail for `completed` and `closed`
- `action=mark-complete` must update both the feature-local state and this index

## implement-plan-state.json contract

Persist this shape under the feature root:

```json
{
  "phase_number": 1,
  "feature_slug": "example-feature",
  "project_root": "C:/ExampleProject",
  "feature_registry_key": "phase1/example-feature",
  "feature_status": "active",
  "implementor_execution_id": null,
  "implementor_execution_access_mode": null,
  "implementor_model": null,
  "implementor_reasoning_effort": null,
  "resolved_runtime_permission_model": null,
  "resolved_runtime_capabilities": {},
  "current_branch": null,
  "last_completed_step": null,
  "last_commit_sha": null,
  "active_run_status": "idle",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

Rules:

- state repairs must be conservative and explicit
- merge continuity from `agent-registry.json` when safe
- do not mark the slice completed until git push succeeds, unless a clearly pending-closeout status is persisted

## Supported active_run_status values

At minimum support:

- `idle`
- `context_ready`
- `integrity_failed`
- `brief_ready`
- `implementation_running`
- `verification_pending`
- `closeout_pending`
- `completed`
- `blocked`

## Transparent setup rule

The main skill must:

1. load and validate setup internally
2. internally refresh setup when it is missing or invalid
3. continue automatically after setup refresh
4. not require a user-visible separate setup invocation in normal use
5. use the internal `implement-plan-setup-helper.mjs`, not a separate public setup skill

## Context/input pack rule

The helper must build a normalized implementation-input pack from all relevant artifacts when present.

At minimum collect and categorize:

- feature README and context docs
- saved implementation contract docs
- current plan docs
- audit docs
- review docs
- fix-plan and fix-report docs
- relevant architecture, context, spec docs
- settings and preference docs
- current per-feature state

## Integrity gate rule

Before any implementor worker starts, the main skill must verify:

- required implementation contract exists or a valid equivalent source is available
- the plan is explicit and internally coherent
- required deliverables are clear
- allowed edits and forbidden edits are clear
- acceptance gates are clear
- `Machine Verification Plan` exists
- `Human Verification Plan` exists
- `Human Verification Plan` states `Required: true|false`
- if `Human Verification Plan` says `Required: true`, the slice is configured with `post_send_to_review=true`
- if `Human Verification Plan` says `Required: true`, the plan also includes explicit testing-phase instructions, expected results, evidence to report back, and `APPROVED` / `REJECTED: <comments>` response guidance
- observability or audit expectations are clear when required
- dependencies, constraints, and non-goals are explicit enough
- upstream context is sufficient to implement without business guessing
- the feature is still active/open
- the target slice is bounded and product-shaped, not broad speculative refactoring

If integrity fails:

- do not spawn the implementor
- write `implement-plan-pushback.md`
- surface concise pushback
- preserve resumable state

If integrity passes:

- write or refresh `implement-plan-contract.md` if normalization is needed
- write `implement-plan-brief.md`
- spawn or resume the implementor

## Worker mode rule

Use the strongest truthful worker mode available.

Rules:

- if native worker access is weaker than CLI full-auto bypass, prefer CLI worker mode and record why
- keep worker runtime distinct from control-plane runtime
- default implementor target is `gpt-5.4` with `xhigh` reasoning, or the strongest truthful equivalent available
- persist the actual worker runtime, access mode, model, and reasoning effort used

## Verification flow rule

The implementation flow must stay truthful and minimal:

1. implement
2. run the machine-verification loop
3. if configured, send the slice to `review-cycle`
4. if human verification is required and the route-level review approved, enter the human-testing phase
5. after human approval, run a final sanity `review-cycle` only if code changed after human approval
6. close only when every required verification gate is satisfied

Rules:

- machine verification is mandatory for every code-changing slice
- rerun machine verification after every code change until it passes or blocks
- when human verification is required, do not claim the slice is complete before the testing-phase handoff is surfaced
- when human verification is required, `post_send_to_review` must be enabled because human testing happens only after the first route-level `review-cycle` gate
- if human verification is required, use review-cycle as the route-closure gate before handing the slice to human testing
- if human testing rejects, return to code fix plus machine verification before re-requesting human testing
- when code changes after human approval, any sanity-pass fix must preserve approved human-facing behavior or the human approval becomes stale

## Human-testing handoff rule

When human verification is required, the handoff must clearly say the slice is in the testing phase.

Use this fixed message shape:

- `IMPLEMENTATION COMPLETE AND READY FOR YOUR TESTING`
- short executive summary of implemented behavior
- `IMPLEMENTATION IS READY FOR TESTING`
- exact testing sequence, expected results, and evidence to report back
- explicit response contract using `APPROVED` or `REJECTED: <comments>`
- `IMPLEMENTATION COMPLETE AND READY FOR YOUR TESTING`

## Thread-safety rule

The skills may be invoked concurrently.

Therefore:

- use per-feature isolation so different feature streams do not collide
- use atomic JSON persistence
- use narrow locks for feature-local and project-level shared files
- make locks stale-safe and deterministic
- never allow one feature invocation to corrupt another feature stream

## Main action behavior

`action=help`

- return concise help with current settings summary and current active/open features summary

`action=get-settings`

- return the resolved current settings used by the skill

`action=list-features`

- return active/open/completed/closed features in compact structured form

`action=prepare`

- do setup validation or refresh
- load feature state and lifecycle status
- fail clearly for completed/closed features
- build the normalized context/input pack
- run the integrity gate
- write pushback or brief artifacts accordingly
- stop before implementor spawn

`action=run`

- perform all of `prepare`
- spawn or resume the implementor when integrity passes
- wait for completion
- run the machine-verification loop until it passes or blocks
- verify outputs
- write `completion-summary.md`
- commit and push all feature artifacts to origin
- if `post_send_to_review=false` and human verification is not required, mark the feature completed when closeout succeeds
- if `post_send_to_review=true`, invoke `review-cycle` for the same feature stream after machine verification and mark the feature completed only if review closes cleanly
- if `post_send_to_review=true` and `review_until_complete=true`, pass `until_complete=true` to `review-cycle` and let `review-cycle` default `max_cycles` to `5` unless `review_max_cycles` was supplied
- if human verification is required, do not mark the feature completed until the human-testing phase and any required post-human-approval sanity review are both satisfied

`action=mark-complete`

- require a target feature stream
- persist completion in both state and index
- remove the feature from active/open output

## Git closeout rule

Successful implementation is not final until:

- code changes are committed
- feature artifacts are committed
- docs/specs/contracts updates are committed
- changes are pushed to origin

If commit or push fails:

- preserve artifacts
- surface the exact failure
- keep the state truthful with a pending-closeout status instead of completed

## Completion summary rule

When successful, `completion-summary.md` must include at minimum:

- implementation objective completed
- deliverables produced
- files changed
- verification evidence
- artifacts updated
- commit and push result
- remaining non-goals or debt

Section `4. Verification Evidence` must distinguish at minimum:

- machine verification status and evidence
- human verification requirement
- human verification status
- review-cycle status
