# Implement-Plan Setup Contract

Use this file to create or refresh `<project_root>/.codex/implement-plan/setup.json`.
This contract is used internally by `implement-plan`; it is not a separate public skill surface.

## Detection order

Resolve worker execution guidance in this order:

1. explicit native full-access or elevated-permission controls exposed by the current Codex runtime
2. explicit Codex CLI full-auto plus bypass mode
3. inherited native runtime access without explicit elevation controls
4. interactive fallback

Important distinction:

- worker runtime = where the implementor actually runs
- control-plane runtime = what orchestrates the worker

If native tools can orchestrate but not supply the strongest truthful worker access, keep the control plane native and move the worker runtime to CLI.

## setup.json shape

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

Required fields:

- `preferred_execution_access_mode`
- `preferred_implementor_access_mode`
- `fallback_execution_access_mode`
- `runtime_permission_model`
- `execution_access_notes`
- `preferred_execution_runtime`
- `persistent_execution_strategy`

Recommended additional fields:

- `preferred_control_plane_runtime`
- `preferred_implementor_model`
- `preferred_implementor_reasoning_effort`
- `requires_project_specific_permission_rules`
- `project_specific_permission_rules`
- `detected_runtime_capabilities`
- `setup_schema_version`

## Allowed values

Runtime-permission-model values:

- `native_explicit_full_access`
- `codex_cli_explicit_full_auto`
- `native_inherited_access_only`
- `interactive_or_limited`

Access-mode values:

- `native_full_access`
- `native_elevated_permissions`
- `codex_cli_full_auto_bypass`
- `inherits_current_runtime_access`
- `interactive_fallback`

Execution-runtime values:

- `native_agent_tools`
- `codex_cli_exec`
- `artifact_continuity_only`

Persistent-execution-strategy values:

- `per_feature_agent_registry`
- `per_feature_cli_sessions`
- `artifact_continuity_only`

## Validation rules

Treat setup as incomplete if:

- JSON is missing or unparsable
- any required field is missing
- any enum is unsupported
- `project_root` does not match the requested root
- `preferred_execution_access_mode` is `codex_cli_full_auto_bypass` but `preferred_execution_runtime` is not `codex_cli_exec`
- `detected_runtime_capabilities` is not an object
- `project_specific_permission_rules` is not an array

Warnings may still be emitted for softer issues such as:

- permission rules exist but `requires_project_specific_permission_rules` is false
- native control-plane runtime is selected while native orchestration capabilities were not detected

## Detection discipline

Detection must be conservative.

Rules:

- do not infer bypass support merely because the CLI executable exists
- prefer explicit help output or a trustworthy persisted prior detection
- when support cannot be proven, default to false
- allow explicit CLI arguments to override automatic detection
