# Review-Cycle Setup Contract

Use this file to create or refresh `<project_root>/.codex/review-cycle/setup.json`.
This contract is used internally by `review-cycle`; it is not a separate public skill surface.
`setup.json` is local operational state for the active checkout or worktree and must not be committed as source history.

## Detection order

Resolve execution-access guidance in this order:

1. explicit native full-access or elevated-permission controls exposed by the current Codex runtime
2. explicit Codex CLI full-auto plus bypass mode
3. inherited native runtime access without explicit elevation controls
4. interactive fallback

Prefer the strongest available autonomous mode.

Important distinction:

- worker runtime = where the spawned reviewer/implementor/auditor actually runs
- control-plane runtime = what may orchestrate those workers

If native spawning does not expose explicit worker access controls but the local Codex CLI can run in stronger full-auto bypass mode, choose the CLI worker mode and record why. Native tools may still be the control plane if that is truthful.

## setup.json shape

```json
{
  "project_root": "C:/ADF",
  "preferred_execution_access_mode": "codex_cli_full_auto_bypass",
  "preferred_auditor_access_mode": "codex_cli_full_auto_bypass",
  "preferred_reviewer_access_mode": "codex_cli_full_auto_bypass",
  "preferred_implementor_access_mode": "codex_cli_full_auto_bypass",
  "fallback_execution_access_mode": "inherits_current_runtime_access",
  "runtime_permission_model": "codex_cli_explicit_full_auto",
  "execution_access_notes": "Why this mode was chosen and what limitation still exists, if any.",
  "preferred_execution_runtime": "codex_cli_exec",
  "preferred_control_plane_runtime": "native_agent_tools",
  "persistent_execution_strategy": "per_feature_agent_registry",
  "requires_project_specific_permission_rules": false,
  "project_specific_permission_rules": [],
  "detected_runtime_capabilities": {
    "native_agent_spawning_available": true,
    "native_agent_access_configurable": false,
    "native_agent_inherits_runtime_access": true,
    "native_agent_resume_available": true,
    "native_agent_send_input_available": true,
    "native_agent_wait_available": true,
    "native_parallel_wait_available": true,
    "codex_cli_available": true,
    "codex_cli_full_auto_supported": true,
    "codex_cli_bypass_supported": true
  },
  "setup_schema_version": 2,
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

Required fields:

- `preferred_execution_access_mode`
- `preferred_auditor_access_mode`
- `preferred_reviewer_access_mode`
- `preferred_implementor_access_mode`
- `fallback_execution_access_mode`
- `runtime_permission_model`
- `execution_access_notes`
- `preferred_execution_runtime`
- `persistent_execution_strategy`

Recommended additional fields:

- `preferred_control_plane_runtime`
- `requires_project_specific_permission_rules`
- `project_specific_permission_rules`
- `detected_runtime_capabilities`
- `setup_schema_version`

## Runtime-permission-model guidance

Suggested values:

- `native_explicit_full_access`
- `codex_cli_explicit_full_auto`
- `native_inherited_access_only`
- `interactive_or_limited`

Suggested access-mode values:

- `native_full_access`
- `native_elevated_permissions`
- `codex_cli_full_auto_bypass`
- `inherits_current_runtime_access`
- `interactive_fallback`

Suggested execution-runtime values:

- `native_agent_tools`
- `codex_cli_exec`
- `artifact_continuity_only`

Suggested persistent-execution-strategy values:

- `per_feature_agent_registry`
- `per_feature_cli_sessions`
- `artifact_continuity_only`

Use the strongest truthful values. Do not write `full`, `elevated`, or `bypass` unless the runtime can actually provide that for worker executions.

## Validation rules

Treat setup as incomplete if any of the following is true:

- the JSON is missing or unparsable
- any required field is missing
- any enum field has an unsupported value
- `project_root` does not match the requested project root
- `preferred_execution_access_mode` is `codex_cli_full_auto_bypass` but `preferred_execution_runtime` is not `codex_cli_exec`
- `detected_runtime_capabilities` is not an object
- `project_specific_permission_rules` is not an array

Warnings may still be emitted for softer issues such as:

- non-empty permission rules while `requires_project_specific_permission_rules` is false
- a control-plane runtime that is not supported by detected capabilities

## Project-specific permission rules

If the project needs extra rules so spawned executions do not stall, record them explicitly. Examples:

- workspace-local `CODEX_HOME`
- repo-specific safe-directory settings
- project permission presets or rules files used by the current runtime

## Detection discipline

Detection must be conservative.

Rules:

- do not infer full-auto or bypass support merely because the CLI executable exists
- prefer explicit flags, help output, or a trustworthy persisted prior detection
- when capability support cannot be proven, default to false
- allow explicit CLI arguments to override automatic detection

## Helper command

Write or refresh setup.json:

```powershell
node C:/ADF/skills/review-cycle/scripts/review-cycle-setup-helper.mjs write-setup `
  --project-root C:/ADF `
  --runtime-permission-model codex_cli_explicit_full_auto `
  --preferred-execution-access-mode codex_cli_full_auto_bypass `
  --preferred-auditor-access-mode codex_cli_full_auto_bypass `
  --preferred-reviewer-access-mode codex_cli_full_auto_bypass `
  --preferred-implementor-access-mode codex_cli_full_auto_bypass `
  --preferred-execution-runtime codex_cli_exec `
  --preferred-control-plane-runtime native_agent_tools `
  --persistent-execution-strategy per_feature_agent_registry `
  --fallback-execution-access-mode inherits_current_runtime_access `
  --execution-access-notes "CLI full-auto plus bypass is the strongest explicit non-interactive worker mode available here. Native agent tools are used only as the control plane." `
  --native-agent-spawning-available true `
  --native-agent-access-configurable false `
  --native-agent-inherits-runtime-access true `
  --native-agent-resume-available true `
  --native-agent-send-input-available true `
  --native-agent-wait-available true `
  --native-parallel-wait-available true `
  --codex-cli-available true `
  --codex-cli-full-auto-supported true `
  --codex-cli-bypass-supported true
```
