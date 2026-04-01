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

## review-cycle-state.json contract

Persist this object shape:

```json
{
  "phase_number": 1,
  "feature_slug": "example-feature",
  "repo_root": "C:/ADF",
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
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

Rules:

- Use `null` for unknown execution IDs and commit SHA.
- Keep `resolved_runtime_capabilities` as an object, not free text.
- Update `updated_at` on every mutation.
- Update `last_completed_cycle` only after the cycle is fully closed out.
- Persist the actual access mode used for each execution, not only the preferred mode from setup.

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

## Execution reuse and recreation rules

Reused executions are allowed only when their persisted access mode is sufficient for the currently required mode.

If an existing auditor, reviewer, or implementor execution was created under weaker access than the current required mode:

- do not silently keep using it
- recreate it under the stronger mode when possible
- update the persisted execution identifier in `review-cycle-state.json`
- record the recreation reason in `access_mode_resolution_notes`
- mention the recreation in the detected-status summary and cycle commit body

## Cycle selection and current-state continuation

- Detect the latest existing cycle number conservatively.
- If `last_completed_cycle + 1` exists on disk, treat that as the current active cycle even when all four cycle artifacts already exist. This preserves pending verification or git closeout state.
- Never overwrite a completed `fix-report.md`.
- If the current cycle already contains `fix-report.md` and `last_completed_cycle` is still lower than the current cycle number, treat the cycle as pending verification or commit or push closeout rather than starting another review pass.
- The fix report from cycle `N` is sent forward only on cycle `N+1`.

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
- what the skill will do next

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

## Helper commands

Prepare or resume the current cycle and return status summary data:

```powershell
node .codex/skills/review-cycle/scripts/review-cycle-helper.mjs prepare `
  --phase-number 1 `
  --feature-slug example-feature `
  --task-summary "Close the route-level defect class." `
  --repo-root C:/ADF
```

Update reviewer or implementor IDs, access modes, branch, or commit metadata:

```powershell
node .codex/skills/review-cycle/scripts/review-cycle-helper.mjs update-state `
  --phase-number 1 `
  --feature-slug example-feature `
  --repo-root C:/ADF `
  --auditor-execution-id auditor-123 `
  --reviewer-execution-id reviewer-456 `
  --implementor-execution-id implementor-789 `
  --auditor-execution-access-mode codex_cli_full_auto_bypass `
  --reviewer-execution-access-mode codex_cli_full_auto_bypass `
  --implementor-execution-access-mode codex_cli_full_auto_bypass `
  --resolved-runtime-permission-model codex_cli_explicit_full_auto `
  --access-mode-resolution-notes "Upgraded all spawned executions to CLI full-auto bypass." `
  --last-completed-cycle 1 `
  --last-commit-sha abcdef1
```