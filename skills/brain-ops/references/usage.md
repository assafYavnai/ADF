# Brain Ops Helper Reference

This reference provides deterministic examples for non-interactive invocations.

- Prefer assistant-side `project-brain` MCP tools when they are exposed.
- Fall back to this skill for reproducible shell truth.

Example commands:

- `node skills/brain-ops/scripts/brain-ops-helper.mjs connect-smoke --project-root C:/ADF`
- `node skills/brain-ops/scripts/brain-ops-helper.mjs search --project-root C:/ADF --scope assafyavnai/adf --query "phase1" --content-type finding --max-results 10`
- `node skills/brain-ops/scripts/brain-ops-helper.mjs read --project-root C:/ADF --scope assafyavnai/adf --query "status-governance" --max-results 1`
- `node skills/brain-ops/scripts/brain-ops-helper.mjs capture --project-root C:/ADF --scope assafyavnai/adf --content-type finding --title "brain-ops smoke" --summary "test entry" --content "..." --tag reviewed`
- `node skills/brain-ops/scripts/brain-ops-helper.mjs trust --project-root C:/ADF --scope assafyavnai/adf --memory-id <id> --action promote --trust-level reviewed`
- `node skills/brain-ops/scripts/brain-ops-helper.mjs trust --project-root C:/ADF --scope assafyavnai/adf --memory-id <id> --action cleanup --cleanup-action archive`

Guardrails:

- `promote` only supports `reviewed` or `locked`
- `cleanup` only supports `archive` or `delete`
- use this helper as the repo-backed fallback route only when assistant-side `project-brain` MCP is unavailable or when you need deterministic shell proof
