# merge-queue-closeout-repo-truth

## Feature Goal

Fix merge-queue closeout so merged features persist canonical repo-owned state and completion truth even when closeout runs from an isolated merge worktree, then repair the stale Spec 1 artifacts.

## Requested Scope

merge-queue closeout persistence, implement-plan completion artifact reconciliation, stale Spec 1 repo truth repair

## Non-Goals

No new merge supervisor; no review-cycle feature expansion beyond the closeout truth fix.

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
