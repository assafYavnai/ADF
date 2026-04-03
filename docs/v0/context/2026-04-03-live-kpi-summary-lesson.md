# Live KPI Summary Lesson

Date: 2026-04-03
Scope: `assafyavnai/adf/phase1`

## Lesson

- The current production COO KPI rollup can report `frozen_trace_count = 0` even while production telemetry shows successful finalization activity such as `memory_manage:publish_finalized_requirement`.
- In the current live dataset, requirements-gathering production traffic emits `freeze_check`, `readiness_check`, `onion_reducer`, `clarification_policy`, `audit_trace_build`, and `artifact_deriver`, but no production `onion_turn` events with `lifecycle_status`.
- Because `get_kpi_summary` derives freeze metrics from `operation = 'onion_turn'` plus `metadata.lifecycle_status = 'handoff_ready'`, the current freeze KPI is non-authoritative against this dataset.
- Production `handle_turn` failure rows in the same dataset are also missing `trace_id`, `route_stage`, `result_status`, and error fields, which makes failure-rate KPIs hard to diagnose.

## Session Note

- The `project-brain` MCP tools were not exposed in this Codex runtime, so this lesson is captured here as the fallback durable note for the session.
