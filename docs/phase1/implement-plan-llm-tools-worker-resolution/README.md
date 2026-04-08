# implement-plan-llm-tools-worker-resolution

## Implementation Objective

Wire the runtime preflight `llm_tools` detection into the governed `implement-plan` and `review-cycle` worker-selection pipeline so that available LLM CLI tools are stored in setup.json, surfaced in prepare output, and usable by the orchestrator to spawn non-default workers via Bash.

## Problem Statement

Runtime preflight now detects available LLM CLI tools (`codex`, `claude`, `gemini`) with their `autonomous_invoke` commands. But this data never reaches the governed workflow:

- `implement-plan-setup-helper.mjs` writes `detected_runtime_capabilities` with hardcoded fields — it does not read or store `llm_tools` from preflight
- `resolveWorkerSelection()` in the helper picks a worker from static setup fields (`preferred_implementor_model`, `preferred_execution_runtime`) — it has no concept of multiple available tools
- The workflow contract does not define how to spawn a non-default worker
- The prepare output does not surface which workers are available

Result: the governing agent has no structured way to discover, select, or spawn a non-default LLM tool as implementor or reviewer, even when the tool is installed and preflight detects it.

## Target Behavior

After this fix:
- Setup refresh reads preflight `llm_tools` and stores the available tools, versions, and invoke commands in setup.json
- `resolveWorkerSelection()` returns `available_workers` alongside the selected default
- The workflow contract defines the Bash invocation pattern for non-default workers
- The prepare output includes `available_workers` so the orchestrator can pick
- When a user or contract requests a specific tool (e.g., "reviewers must be codex"), the orchestrator has the structured data to honor that request

## Non-Goals

- Do not redesign the full worker lifecycle or execution tracking
- Do not change how implementor results are collected or verified
- Do not change review-cycle auditor/reviewer prompt templates
- Do not change the preflight detection logic (already done)
- Do not change merge-queue or worktree behavior

## Lifecycle

- active
