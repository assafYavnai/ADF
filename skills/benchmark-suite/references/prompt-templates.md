# Benchmark Suite Prompt Templates

## Base Prompt Template

The base prompt is built from the suite config and sent to every lane. Structure:

```
You are participating in a controlled multi-engine implementation benchmark for the ADF implement-plan workflow.
[isolation note if git_worktree mode]

<benchmark>
id: {suite_id}
description: {description}
target_slug: {target_slug}
base_ref: {base_ref}
</benchmark>

<execution_policy>
max_review_cycles: {max_review_cycles}
skip_human_testing: {skip_human_testing}
global_cutoff_minutes: {global_cutoff_minutes}
</execution_policy>

<task_summary>
{task_summary}
</task_summary>

<instructions>
{instructions}
</instructions>

[for each context_file:]
<context_file path="{path}">
{content}
</context_file>

[if verification_commands:]
<machine_verification>
The harness will run these machine checks after each review cycle:
- {label}: {rendered_command} (cwd={cwd}, timeout_ms={timeout_ms}, optional={optional})
</machine_verification>

[if artifact_policy has entries:]
<artifact_policy>
required_paths: {paths}
required_changed_prefixes: {prefixes}
allowed_edit_prefixes: {prefixes}
forbidden_edit_prefixes: {prefixes}
</artifact_policy>

[if response_requirements:]
<response_requirements>
{response_requirements}
</response_requirements>

Return only your substantive answer for this benchmark run.
```

## Per-Cycle Prompt Extension

Each cycle appends lane-specific execution context:

```
<lane_execution>
lane_id: {lane_id}
provider: {provider}
model: {model}
review_cycle: {cycle_number} of {max_cycles}
Work directly in the current git worktree. Make the code and test changes yourself.
The harness is invoking you in non-interactive full-access mode for this benchmark lane. Never stop to request permission, approval, or sandbox elevation.
The harness has already prewarmed local runtime dependencies and built artifacts for this worktree. Do not run install/bootstrap unless machine verification proves it is still required.
Do not ask for approval. Do not merge, push, or perform human testing.
If the plan mentions human testing or human verification, treat it as disabled for this benchmark. Stop at machine-verification green.
[if first cycle:] Aim to pass machine verification in this cycle.
</lane_execution>

[if feedback from previous cycle:]
<previous_cycle_feedback>
{feedback}
</previous_cycle_feedback>
```

## Verification Feedback Template

When verification fails, feedback is built from the failing commands:

```
The previous cycle did not pass machine verification. Fix the failures below and rerun the targeted tests yourself before finishing.

Command: {label}
Rendered: {rendered_command}
Error: {error_message}
Stdout:
{stdout (trimmed to 1800 chars)}
Stderr:
{stderr (trimmed to 1800 chars)}
```

## Brain Summary Template

After suite completion, a Brain-ready markdown summary is generated:

```markdown
# Benchmark Suite Summary

**Suite ID:** {suite_id}
**Started:** {started_at}
**Finished:** {finished_at}
**Status:** {status}

## Results

| Metric | Count |
|--------|-------|
| Total Lanes | {count} |
| Succeeded | {count} |
| Failed | {count} |
| Blocked | {count} |
| Stopped | {count} |

## Rankings

- **Fastest:** {lane_id}
- **Lowest Cost:** {lane_id}
- **Best Quality:** {lane_id}
- **Fewest Cycles:** {lane_id}

## Per-Lane Results

| Lane | Provider | Model | Status | Cycles | Cost (USD) | Quality |
|------|----------|-------|--------|--------|------------|---------|
| ... | ... | ... | ... | ... | ... | ... |
```
