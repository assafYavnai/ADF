# Benchmark Suite Workflow Contract

Use this file as the authoritative reference for the benchmark-suite runtime contract.

## Commands

### run

Start a new benchmark suite run.

Required inputs:
- `--project-root` — project root path
- `--config` — path to suite config JSON

Optional inputs:
- `--run-root` — explicit output directory
- `--global-cutoff-minutes` — override config cutoff

Behavior:
1. Parse and validate the config (v1 auto-converts to v2)
2. Initialize suite-state.json
3. Build the base prompt from config feature/instructions/context
4. For each engine, provision a lane workspace (git worktree if configured)
5. Run lanes sequentially or in parallel depending on runtime capabilities
6. Each lane runs: implement-plan -> machine verification -> review-cycle (if cycles > 1)
7. Collect KPIs, artifacts, and lane summaries
8. Build suite summary with rankings
9. Write Brain summary markdown

### resume

Resume an interrupted suite run.

Required inputs:
- `--project-root` — project root path
- `--run-root` — path to existing run-root

Behavior:
1. Load suite-state.json and config.resolved.json
2. Skip lanes in terminal states
3. Continue non-terminal lanes from their last cycle
4. Update suite state and summary on completion

### status

Show suite status.

Required inputs:
- `--project-root` — project root path
- `--run-root` — path to run-root

Output includes:
- Suite status, started_at, updated_at
- Per-lane: lane_id, provider, model, status, cycle_number, verification_status
- Totals: total/active/completed/failed/blocked/stopped counts
- Rankings if suite is completed

### tail-lane

Show latest lane progress.

Required inputs:
- `--project-root`, `--run-root`, `--lane-id`

Output: latest heartbeat, current cycle number, status, last verification result

### stop-lane / stop-provider / stop-suite

Write stop signal files that lanes check between cycles.

Required inputs:
- `--project-root`, `--run-root`
- `--lane-id` (for stop-lane) or `--provider` (for stop-provider)

### reset-lane

Clear a stopped/failed lane status to allow resume.

Required inputs:
- `--project-root`, `--run-root`, `--lane-id`

Resets the lane status to `provisioning` so resume can re-run it.

### dry-run

Parse config, validate engines, show planned matrix without execution.

Required inputs:
- `--project-root`, `--config`

Output: resolved config, planned lane matrix, verification plan, artifact policy

## Suite State Machine

```
initializing -> running -> completing -> completed
                       \-> stopped
                       \-> failed
```

## Lane State Machine

```
provisioning -> running -> verification_pending -> review_pending -> running (next cycle)
                                                                  \-> succeeded
            \-> blocked
            \-> stopped / lane_stopped / provider_stopped / suite_stopped
            \-> failed
            \-> max_cycles_exhausted
            \-> global_cutoff_reached
```

## Stop Signal Protocol

Stop signals are file-based under `<run-root>/signals/`:
- `stop-suite-all.json` — stops all lanes
- `stop-provider-<provider>.json` — stops all lanes for a provider
- `stop-lane-<lane-id>.json` — stops a single lane

Lanes check for stop signals before each cycle iteration.

## Config Schema (v2)

```json
{
  "schema_version": 2,
  "suite_id": "string (safe slug)",
  "description": "string | null",
  "feature": {
    "project_root": "string | null",
    "phase_number": "number | null",
    "feature_slug": "string | null",
    "task_summary": "string | null",
    "instructions": "string | null",
    "instructions_path": "string | null"
  },
  "isolation": {
    "mode": "none | git_worktree",
    "base_ref": "string | null",
    "worktree_root": "string | null",
    "target_slug": "string | null"
  },
  "execution_policy": {
    "max_review_cycles": "number (1-6)",
    "skip_human_testing": "boolean",
    "global_cutoff_minutes": "number | null",
    "auto_merge_queue": "boolean",
    "terminal_state": "merge_ready"
  },
  "verification_commands": "[{ command, args?, cwd?, timeout_ms?, optional?, label?, id? }]",
  "artifact_policy": {
    "required_paths": "[string]",
    "required_changed_prefixes": "[string]",
    "allowed_edit_prefixes": "[string]",
    "forbidden_edit_prefixes": "[string]"
  },
  "notification_policy": {
    "required": "boolean",
    "channels": "[string]",
    "progress_interval_seconds": "number"
  },
  "engines": "[{ id, provider, model, reasoning?, effort?, bypass?, access_mode?, timeout_ms? }]",
  "context_files": "[string]",
  "response_requirements": "string | null",
  "telemetry_metadata": "object"
}
```

## v1 Backward Compatibility

v1 configs (schema_version: 1) are auto-converted to v2 format:
- `benchmark_id` maps to `suite_id`
- `task_summary` moves under `feature`
- `instructions`/`instructions_path` move under `feature`
- `engines[].cli` maps to `engines[].provider`
- Default `execution_policy.terminal_state` is `merge_ready`
- Default `notification_policy` is file_event_log only
