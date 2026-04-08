# Benchmark Suite Setup Contract

Use this file to create or refresh `<project_root>/.codex/benchmark-suite/setup.json`.
This contract is used internally by `benchmark-suite`; it is not a separate public skill surface.

## Detection order

Resolve worker execution guidance in this order:

1. explicit native full-access or elevated-permission controls exposed by the current runtime
2. explicit Codex CLI full-auto plus bypass mode
3. inherited native runtime access without explicit elevation controls
4. interactive fallback

Important distinction:

- worker runtime = where the benchmark lane implementors actually run
- control-plane runtime = what orchestrates the supervisor

## setup.json shape

```json
{
  "project_root": "C:/ADF",
  "preferred_execution_access_mode": "native_full_access",
  "fallback_execution_access_mode": "inherits_current_runtime_access",
  "runtime_permission_model": "native_explicit_full_access",
  "execution_access_notes": "Native agent tools provide full-access benchmark execution.",
  "preferred_execution_runtime": "native_agent_tools",
  "preferred_control_plane_runtime": "native_agent_tools",
  "persistent_execution_strategy": "per_feature_agent_registry",
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
- `fallback_execution_access_mode`
- `runtime_permission_model`
- `execution_access_notes`
- `preferred_execution_runtime`
- `persistent_execution_strategy`

## Capability detection

The setup helper probes for native agent tools and Codex CLI availability,
then infers the strongest truthful execution mode for benchmark workers.

The benchmark supervisor needs autonomous execution capability for each lane.
If no autonomous execution is available, the setup will report `artifact_continuity_only`
which means lanes cannot be run in parallel.

## Refresh rules

- Setup refresh happens before each `run` command
- Existing setup values are preserved as fallbacks
- CLI argument overrides take priority over existing values
- Capability detection runs fresh each time
