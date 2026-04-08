# Feature Context

## Feature

- phase_number: 1
- feature_slug: implement-plan-llm-tools-worker-resolution
- project_root: C:/ADF
- legacy_seed_feature_root: C:/ADF/docs/phase1/implement-plan-llm-tools-worker-resolution
- target_feature_local_artifact_root: <worktree_root>/docs/phase1/implement-plan-llm-tools-worker-resolution

## Task Summary

Wire preflight `llm_tools` into setup.json, resolveWorkerSelection(), workflow contract, and prepare output so the governed workflow can discover, select, and spawn any available LLM CLI tool as a worker.

## Current State

### What exists

- Preflight (`tools/agent-runtime-preflight.mjs`) detects `codex`, `claude`, `gemini` with `available`, `path`, `version`, `autonomous_invoke` (commit `867bcce`)
- `cli-agent.md` lists `llm_tools` as authoritative preflight output
- SKILL.md for both skills says "resolve from preflight llm_tools"

### What is missing

1. **Setup storage**: `implement-plan-setup-helper.mjs` does not read preflight output or store `llm_tools`. The `detected_runtime_capabilities` object has hardcoded boolean fields (`codex_cli_available`, etc.) that are manually set, not derived from preflight.

2. **Worker selection**: `resolveWorkerSelection()` in `implement-plan-helper.mjs` returns a single resolved worker based on static setup fields. It does not return a list of available workers or their invoke commands.

3. **Workflow contract**: Neither `implement-plan` nor `review-cycle` workflow contracts define the Bash invocation pattern for spawning a non-default worker. The orchestrator has no structured guidance for how to use `autonomous_invoke`.

4. **Prepare output**: The prepare output includes `implementor_lane` with the selected worker but does not include an `available_workers` list showing all options.

## Design Decisions

### Setup populates from preflight

The setup helper should run preflight (or accept its JSON output) and store the `llm_tools` object in setup.json alongside existing `detected_runtime_capabilities`. This makes the data durable — subsequent helper calls read it from setup without re-running preflight.

### resolveWorkerSelection() returns available_workers

The function should return `{ resolved: { ... }, available_workers: [...] }` where `available_workers` lists every tool from `llm_tools` that has `available: true`, with its `autonomous_invoke` command.

### Workflow contract defines spawn pattern

The contract should say: "To spawn a non-default worker, use `bash -c '<autonomous_invoke> "<prompt>"'` where `autonomous_invoke` comes from `available_workers` or setup `llm_tools`."

### Prepare output surfaces available_workers

The prepare output should include `available_workers` at the top level so the orchestrator can inspect it before deciding which tool to use.

### Provider-specific reasoning metadata must stay truthful

- `reasoning_effort` is currently modeled as shared worker-selection metadata, but Claude lanes do not use the Codex `xhigh` vocabulary.
- The helper must not carry Codex-style reasoning metadata into a Claude worker through persisted continuity or setup defaults.
- Invalid bare-flag values such as `"true"` must normalize away instead of persisting into feature continuity.

### Provider truth must come from selected worker configuration on first run

- A fresh helper run cannot rely only on current-shell environment markers to know which worker provider is selected.
- When runtime, access mode, or model already identify the worker target, provider truth must be derived from that selected worker configuration on the first prepare/live-contract pass.
- Persisted continuity may reinforce provider truth later, but it must not be the first source of truth for a fresh Claude-targeted route.

### Shared validator surfaces must stay aligned

- The shared governed runtime, implement-plan helper surfaces, review-cycle validator surfaces, and repo-owned setup/workflow contracts must agree on the accepted access-mode/runtime enum set.
- When Claude-specific worker/runtime values are accepted in code, the same values must be accepted by sibling validators and listed in authoritative contracts in the same cycle.

## Discovered Authorities

- [preflight] C:/ADF/tools/agent-runtime-preflight.mjs (llm_tools section)
- [bootstrap] C:/ADF/docs/bootstrap/cli-agent.md (authoritative field list)
- [skill-doc] C:/ADF/skills/implement-plan/SKILL.md (worker policy)
- [skill-doc] C:/ADF/skills/implement-plan/references/workflow-contract.md
- [helper] C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs (resolveWorkerSelection)
- [helper] C:/ADF/skills/implement-plan/scripts/implement-plan-setup-helper.mjs
- [skill-doc] C:/ADF/skills/review-cycle/SKILL.md (access-mode rule)
- [skill-doc] C:/ADF/skills/review-cycle/references/workflow-contract.md

## Notes

- The default branch is `main`.
- Human verification is not required — this is internal plumbing that can be proven through machine verification.
