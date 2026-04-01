# Cycle 01 Review Findings

Source: backfilled from the preserved chat thread.

## Summary

The first code review established that the COO architecture was directionally right, but the implementation was brittle and not trustworthy enough to serve as the real Phase 1 COO lane.

## Main Findings

1. Governance/rule creation was structurally broken because the runtime wrote families like `rule`, `role`, `setting`, and `finding` into a schema that did not allow them.
2. Decision logging failed because the controller/runtime path defaulted `decided_by` to a non-UUID label while the DB expected `agents.id`.
3. Scope resolution was broken below organization scope because project resolution used the wrong parent column name.
4. The repeated-error circuit breaker never triggered because the event ordering reset the error streak on every turn.
5. Resume/recovery existed in files but not through the real CLI path, and prompt context grew without bound.
6. Workflow routing still exposed dead-end or unreachable paths such as `tool_path` and `specialist_path`.
7. Telemetry and provenance were overstated relative to the live runtime.
8. Hidden memory loading silently degraded when Brain search failed.
9. `memory_manage delete` could leave partial evidence behind because deletes were not transactional.

## Review Conclusion

The controller, thread model, Brain integration, and CLI entrypoint were reusable, but the runtime needed a stabilization-first plan before onion work.
