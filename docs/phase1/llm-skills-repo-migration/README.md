# llm-skills-repo-migration

## Feature Goal

Review the repo-owned C:/ADF/skills migration and installer so review-cycle, implement-plan, and manage-skills close the supported install route for Codex, Claude, and Gemini user-scope skills without docs/runtime mismatch.

## Requested Scope

Focus on C:/ADF/skills/**, docs/skills-repo-migration-plan.md, and generated install surfaces under ~/.codex/skills, ~/.claude/skills, and ~/.gemini/skills. Exclude unrelated repo churn.

## Non-Goals

Do not review unrelated ADF product files, onion-route artifacts, or pre-existing phase streams outside this skill migration slice.

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
