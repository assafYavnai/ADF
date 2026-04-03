# Merge-Queue Setup Contract

Use this file to create or refresh `<project_root>/.codex/merge-queue/setup.json`.
This contract is used internally by `merge-queue`; it is not a separate public skill surface.

## Detection order

Resolve execution guidance in this order:

1. explicit native full-access or elevated-permission controls exposed by the current Codex runtime
2. explicit Codex CLI full-auto plus bypass mode
3. inherited native runtime access without explicit elevation controls
4. interactive fallback

Important distinction:

- worker runtime = where the merge execution actually runs
- control-plane runtime = what orchestrates that execution

If native tools can orchestrate but not supply the strongest truthful worker access, keep the control plane native and move the worker runtime to CLI.

## setup.json shape

```json
{
  "project_root": "C:/ExampleProject",
  "preferred_execution_access_mode": "codex_cli_full_auto_bypass",
  "fallback_execution_access_mode": "inherits_current_runtime_access",
  "runtime_permission_model": "codex_cli_explicit_full_auto",
  "execution_access_notes": "CLI full-auto plus bypass is the strongest truthful worker mode available here.",
  "preferred_execution_runtime": "codex_cli_exec",
  "preferred_control_plane_runtime": "native_agent_tools",
  "persistent_execution_strategy": "artifact_continuity_only",
  "detected_runtime_capabilities": {},
  "setup_schema_version": 1,
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

Required fields:

- `preferred_execution_access_mode`
- `fallback_execution_access_mode`
- `runtime_permission_model`
- `execution_access_notes`
- `preferred_execution_runtime`
- `persistent_execution_strategy`

## Validation rules

Treat setup as incomplete if:

- JSON is missing or unparsable
- any required field is missing
- any enum is unsupported
- `project_root` does not match the requested root
- `preferred_execution_access_mode` is `codex_cli_full_auto_bypass` but `preferred_execution_runtime` is not `codex_cli_exec`
- `detected_runtime_capabilities` is not an object
