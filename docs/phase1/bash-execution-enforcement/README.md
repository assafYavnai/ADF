# bash-execution-enforcement

## Feature Goal

Review the bash-only ADF launch contract implementation until complete.

## Requested Scope

Use the task summary and current repo state to keep the fix route-level and tight.

## Non-Goals

- None recorded yet.

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
