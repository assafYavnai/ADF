# coo-kpi-instrumentation

## Feature Goal

Audit, review, fix, verify, document, and close the COO KPI instrumentation slice until the route-level stream has no remaining objections on the supported COO runtime.

## Requested Scope

COO KPI instrumentation across the supported CLI/controller/context/onion/memory-engine telemetry route

## Non-Goals

Do not widen into review-cycle or implement-plan runtime redesign; do not replace raw telemetry with a separate KPI store.

## Artifact Map

- context.md
- review-cycle-state.json
- cycle-XX/audit-findings.md
- cycle-XX/review-findings.md
- cycle-XX/fix-plan.md
- cycle-XX/fix-report.md
- <repo_root>/.codex/review-cycle/setup.json
- <repo_root>/.codex/review-cycle/agent-registry.json

## Cycle Rules

- One invocation = one full audit/review/fix/report cycle.
- Do not auto-start the next cycle in the same run.
- A fix report from cycle N becomes reviewer input only in cycle N+1.
- Reuse incomplete or pending-closeout cycle artifacts when resuming.
- Reuse cached auditor/reviewer/implementor executions per feature stream when they are still valid.

## Commit Rules

- Commit code changes, cycle artifacts, related docs, and changed setup artifacts together.
- Push to origin after the cycle closes.
- If commit or push fails, preserve artifacts and report the exact git failure.
