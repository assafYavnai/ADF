# Implement-Plan Orchestrator Template Bash Launch Addendum

Status: active addendum  
Last updated: 2026-04-06

## Purpose

Use this addendum together with `implement-plan-orchestrator-prompt-template.md`.

It hardens the orchestration prompt against the worker-launch failure mode where an agent mixes PowerShell interpolation with the required ADF bash workflow shell on Windows.

## Required Additions To Future Orchestrator Prompts

Add these rules explicitly to future prompts.

### 1. Runtime preflight is mandatory

Before substantive orchestration work:

- read `AGENTS.md`
- read `docs/bootstrap/cli-agent.md`
- run the ADF runtime preflight
- treat runtime preflight output as authority for:
  - host OS
  - workflow shell
  - execution shell
  - command construction mode
  - bash write style
  - path style
  - control-plane entrypoint
  - `llm_tools.<name>.available`
  - `llm_tools.<name>.version`
  - `llm_tools.<name>.autonomous_invoke`

### 2. Windows host does not change the workflow shell

On Windows, ADF workflow shell is still `bash`.

Rules:

- remain aware of Windows path and process behavior
- do not treat PowerShell as an equivalent workflow shell
- do not build mixed PowerShell + bash wrappers for worker launch

### 3. Use the exact autonomous worker command

When a sibling LLM tool is requested as a worker:

- use the exact `autonomous_invoke` command surfaced by runtime preflight or governed setup
- do not manually reconstruct the `claude`, `codex`, or `gemini` autonomous invocation string
- do not assume the tool is unavailable before checking `llm_tools`

### 4. Use bash-native temp script flow for fragile launches

If a worker launch is multiline, quote-heavy, regex-heavy, or otherwise fragile:

- write a temporary `.sh` file
- run it through bash
- prefer bash-native temp files and heredoc flow over nested wrapper quoting
- capture worker output in bash-native temp artifacts when inspection is needed

### 5. Treat wrapper bugs as orchestration defects

If a worker launch fails because of shell-wrapper construction:

- treat that as an orchestration defect
- repair the wrapper
- relaunch with the same prompt and the same worktree unless governed state truth requires a different action
- do not treat the worker lane itself as failed unless the worker actually ran and failed

## Recommended Prompt Snippet

Include wording equivalent to the following in future orchestration prompts:

- "On Windows, ADF workflow shell remains bash. Use bash syntax and bash-native launch flow."
- "Run runtime preflight first and use `llm_tools.*.autonomous_invoke` as launch authority for sibling LLM workers."
- "For multiline or quote-heavy worker launches, write a temporary `.sh` file and run it through bash instead of using a mixed shell wrapper."
- "If the first launch fails because of wrapper construction, fix the wrapper and relaunch; do not misclassify the worker lane as the failure source."

## Source Basis

These rules come from the repo bootstrap and governed worker-launch contracts:

- `AGENTS.md`
- `docs/bootstrap/cli-agent.md`
- `skills/implement-plan/SKILL.md`
- `skills/implement-plan/references/workflow-contract.md`
- `skills/review-cycle/SKILL.md`
