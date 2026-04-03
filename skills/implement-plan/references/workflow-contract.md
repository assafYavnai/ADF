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
- `worktrees_root`
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
- `<project_root>/.codex/implement-plan/worktrees/...`

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
      "merge_status": "not_ready",
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
  "base_branch": "main",
  "feature_branch": "implement-plan/phase1/example-feature",
  "worktree_path": "C:/ExampleProject/.codex/implement-plan/worktrees/phase1/example-feature",
  "worktree_status": "ready",
  "merge_required": true,
  "merge_status": "not_ready",
  "approved_commit_sha": null,
  "merge_commit_sha": null,
  "merge_queue_request_id": null,
  "local_target_sync_status": "not_started",
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
- `review_pending`
- `human_verification_pending`
- `merge_ready`
- `merge_queued`
- `merge_in_progress`
- `merge_blocked`
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

- the contract explicitly states `KPI Applicability: required`, `KPI Applicability: not required`, or `KPI Applicability: temporary exception approved`
- if KPI is required or covered by a temporary exception, the contract explicitly freezes:
  - `KPI Route / Touched Path`
  - `KPI Raw-Truth Source`
  - `KPI Coverage / Proof`
  - `KPI Production / Proof Partition`
- if KPI is not required, the contract includes `KPI Non-Applicability Rationale`
- if a temporary KPI exception is used, the contract also includes:
  - `KPI Exception Owner`
  - `KPI Exception Expiry`
  - `KPI Exception Production Status`
  - `KPI Compensating Control`
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
- a deterministic base branch, feature branch, and worktree path can be resolved for the feature stream

If integrity fails:

- do not spawn the implementor
- write `implement-plan-pushback.md`
- surface concise pushback
- preserve resumable state

If integrity passes:

- write or refresh `implement-plan-contract.md` if normalization is needed
- write `implement-plan-brief.md`
- spawn or resume the implementor

## KPI applicability gate

Every implementation slice must make KPI applicability explicit before implementation may begin.

Rules:

- do not allow a slice to stay silent on KPI applicability
- when KPI is required, freeze the route or touched path, the raw KPI truth source, the KPI coverage or proof expected, and the production or proof partition handling
- when KPI is not required, require a narrow rationale that says why the slice is outside the KPI rule instead of omitting KPI discussion
- when a temporary exception is used, require explicit approval status, owner, expiry, compensating control, and an explicit not-production-complete statement
- do not let vague observability wording stand in for the required KPI contract fields

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
3. if configured, send the slice to `review-cycle` against the feature worktree snapshot
4. if human verification is required and the route-level review approved, enter the human-testing phase
5. after human approval, run a final sanity `review-cycle` only if code changed after human approval
6. when approval gates are satisfied, enqueue the exact approved commit into `merge-queue`
7. close only when every required verification gate is satisfied and the merge queue reports merge success truthfully

Rules:

- machine verification is mandatory for every code-changing slice
- rerun machine verification after every code change until it passes or blocks
- when human verification is required, do not claim the slice is complete before the testing-phase handoff is surfaced
- when human verification is required, `post_send_to_review` must be enabled because human testing happens only after the first route-level `review-cycle` gate
- if human verification is required, use review-cycle as the route-closure gate before handing the slice to human testing
- if human testing rejects, return to code fix plus machine verification before re-requesting human testing
- when code changes after human approval, any sanity-pass fix must preserve approved human-facing behavior or the human approval becomes stale
- implementation, machine verification, and review-cycle all operate against the dedicated feature worktree rather than the shared base checkout
- approval on the feature branch is merge-ready state, not completed state

## Human-testing handoff rule

When human verification is required, the handoff must clearly say the slice is in the testing phase.

Use this fixed message shape:

- `IMPLEMENTATION COMPLETE AND READY FOR YOUR TESTING`
- short executive summary of implemented behavior
- `IMPLEMENTATION IS READY FOR TESTING`
- exact testing sequence, expected results, and evidence to report back
- explicit response contract using `APPROVED` or `REJECTED: <comments>`
- `IMPLEMENTATION COMPLETE AND READY FOR YOUR TESTING`

## Human-facing report rule

The user-facing artifacts for this workflow are reports, not raw dumps.

Rules:

- `implement-plan-pushback.md`, `implement-plan-brief.md`, `completion-summary.md`, and the testing handoff must be easy for a human to scan quickly
- lead with the most important current outcome
- keep sections short and use concise bullets when the content is list-shaped
- separate status, findings or blockers, and next actions instead of blending them into one paragraph wall
- reference long evidence instead of pasting it inline unless exact text is required

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
- create or reuse the deterministic feature worktree before implementor execution
- spawn or resume the implementor when integrity passes
- wait for completion
- run the machine-verification loop until it passes or blocks
- verify outputs
- write `completion-summary.md`
- commit and push all feature artifacts on the feature branch
- if `post_send_to_review=false` and human verification is not required, stop at merge-ready state and enqueue the approved commit instead of marking the feature completed immediately
- if `post_send_to_review=true`, invoke `review-cycle` for the same feature stream after machine verification using the feature worktree as `repo_root`
- if `post_send_to_review=true` and `review_until_complete=true`, pass `until_complete=true` to `review-cycle` and let `review-cycle` default `max_cycles` to `5` unless `review_max_cycles` was supplied
- if human verification is required, do not mark the feature completed until the human-testing phase and any required post-human-approval sanity review are both satisfied
- after approval gates are satisfied, enqueue the exact approved commit in `merge-queue`
- do not mark the feature completed until `merge-queue` updates the feature to merged and completion closeout succeeds

`action=mark-complete`

- require a target feature stream
- persist completion in both state and index only after merge success evidence exists
- remove the feature from active/open output

## Git closeout rule

Successful implementation is not final until:

- feature-branch code changes are committed
- feature-branch artifacts are committed
- docs/specs/contracts updates are committed
- feature-branch changes are pushed to origin
- the approved commit is merged into the target branch
- target-branch sync state is recorded truthfully

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
- merge status
- local target sync status
