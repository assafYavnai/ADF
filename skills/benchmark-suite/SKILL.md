---
name: benchmark-suite
description: Supervise isolated benchmark lanes running the real governed implementation flow (implement-plan -> machine verification -> review-cycle) across a JSON-defined provider/model/runtime matrix with per-lane isolation, stop/resume/reset controls, KPI capture, and Brain persistence.
---

# Benchmark Suite

Use this skill to run, monitor, and control a multi-lane implementation benchmark across providers and models.

The authoritative source for this skill family is `C:/ADF/skills/benchmark-suite`.
Installed target copies under Codex, Claude, or Gemini roots are generated install output.

## Default behavior

If the skill is invoked with no inputs, or with `action=help`, return concise help.

The help output must include:

- what the skill does
- required inputs
- optional inputs
- supported commands
- current settings summary
- how stop/resume/reset works

## Supported commands

- `help` — show help and current settings summary
- `run` — start a new benchmark suite run from a config JSON file
- `resume` — resume an interrupted suite run from its run-root directory
- `status` — show current suite status, lane statuses, and progress summary
- `tail-lane` — show the latest heartbeat and cycle info for a specific lane
- `stop-lane` — request graceful stop for a single lane
- `stop-provider` — request graceful stop for all lanes of a given provider
- `stop-suite` — request graceful stop for the entire suite
- `reset-lane` — reset a stopped/failed lane to allow re-run
- `dry-run` — parse config, validate engines, show planned matrix without execution

## Required inputs for `run`

- `--project-root` — path to the project root
- `--config` — path to the benchmark suite config JSON file

Optional inputs:

- `--run-root` — explicit run output directory (auto-generated if omitted)
- `--global-cutoff-minutes` — override the config's global cutoff

## Required inputs for `resume`

- `--project-root` — path to the project root
- `--run-root` — path to the existing run-root directory to resume

## Required inputs for `status`

- `--project-root` — path to the project root
- `--run-root` — path to the run-root directory

## Required inputs for `stop-lane`

- `--project-root` — path to the project root
- `--run-root` — path to the run-root directory
- `--lane-id` — the lane to stop

## Required inputs for `stop-provider`

- `--project-root` — path to the project root
- `--run-root` — path to the run-root directory
- `--provider` — the provider to stop (codex, claude, or gemini)

## Required inputs for `stop-suite`

- `--project-root` — path to the project root
- `--run-root` — path to the run-root directory

## Required inputs for `reset-lane`

- `--project-root` — path to the project root
- `--run-root` — path to the run-root directory
- `--lane-id` — the lane to reset

## Required inputs for `tail-lane`

- `--project-root` — path to the project root
- `--run-root` — path to the run-root directory
- `--lane-id` — the lane to tail

## Required inputs for `dry-run`

- `--project-root` — path to the project root
- `--config` — path to the benchmark suite config JSON file

## Config schema

The benchmark suite accepts a v2 JSON config (or v1 for backward compatibility):

```json
{
  "schema_version": 2,
  "suite_id": "my-benchmark",
  "description": "Optional description",
  "feature": {
    "project_root": "C:/ADF",
    "phase_number": 1,
    "feature_slug": "my-feature",
    "task_summary": "Implement the feature",
    "instructions": "Detailed instructions here"
  },
  "isolation": {
    "mode": "git_worktree",
    "base_ref": "main",
    "worktree_root": null,
    "target_slug": "my-feature"
  },
  "execution_policy": {
    "max_review_cycles": 3,
    "skip_human_testing": true,
    "global_cutoff_minutes": 60,
    "auto_merge_queue": false,
    "terminal_state": "merge_ready"
  },
  "verification_commands": [
    { "command": "node", "args": ["--check", "index.mjs"], "label": "Syntax check" }
  ],
  "artifact_policy": {
    "required_paths": [],
    "required_changed_prefixes": [],
    "allowed_edit_prefixes": [],
    "forbidden_edit_prefixes": []
  },
  "engines": [
    {
      "id": "claude-opus",
      "provider": "claude",
      "model": "opus",
      "effort": "max",
      "bypass": true,
      "timeout_ms": 120000
    },
    {
      "id": "codex-gpt5",
      "provider": "codex",
      "model": "gpt-5.4",
      "reasoning": "xhigh",
      "bypass": true,
      "timeout_ms": 120000
    }
  ]
}
```

## Lane lifecycle

Each lane follows this lifecycle:
1. **provisioning** — worktree creation and runtime prewarming
2. **running** — governed implementation cycle (implement-plan + review-cycle)
3. **verification_pending** — machine verification in progress
4. **review_pending** — review cycle in progress
5. Terminal states: **succeeded**, **failed**, **blocked**, **stopped**, **max_cycles_exhausted**, **global_cutoff_reached**, **suite_stopped**, **provider_stopped**, **lane_stopped**

## Stop/resume/reset

- **stop-lane/stop-provider/stop-suite** — write stop signal files; lanes check for stop signals between cycles and halt gracefully
- **resume** — reload suite state from run-root and continue any non-terminal lanes
- **reset-lane** — clear a stopped/failed lane's terminal status so it can be resumed

## Output artifacts

Each suite run produces artifacts under the run-root directory:

- `suite-state.json` — suite-level state
- `config.resolved.json` — resolved v2 config
- `prompt.txt` — base prompt for all lanes
- `lanes/<lane-id>/lane-state.json` — per-lane state
- `lanes/<lane-id>/cycles.json` — per-lane cycle history
- `lanes/<lane-id>/lane-summary.json` — per-lane final summary
- `lanes/<lane-id>/cycle-NN/` — per-cycle artifacts
- `signals/` — stop signal files
- `heartbeats/` — per-lane heartbeat files
- `events/` — durable event log
- `summary.json` — final suite summary
- `brain-summary.md` — Brain-ready markdown summary

## Input safety rules

- `suite_id` and `lane.id` must match `/^[A-Za-z0-9._-]+$/`
- `provider` must be one of: codex, claude, gemini
- `max_review_cycles` cannot exceed 6
- `config` must be a valid JSON file on disk
