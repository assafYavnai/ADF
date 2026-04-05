# Implement-Plan Workflow Contract

Use this file as the authoritative reference for the repo-owned `implement-plan` runtime contract.

## Inputs

Required for `action=prepare` and `action=run`:

- `project_root`
- `phase_number`
- `feature_slug`
- `task_summary`

Optional contract inputs:

- `scope_hint`
- `non_goals`
- `run_mode` with allowed values `normal` or `benchmarking`; default `normal`
- `worker_provider`
- `worker_runtime`
- `worker_access_mode`
- `worker_model`
- `worker_reasoning_effort`
- `implementor_model`
- `implementor_reasoning_effort`
- `feature_status_override`
- `post_send_to_review`
- `post_send_for_review` as a deprecated compatibility alias
- `review_until_complete`
- `review_max_cycles`
- `benchmark_run_id`
- `benchmark_suite_id`
- `benchmark_lane_id`
- `benchmark_lane_label`

Rules:

- `feature_slug` must be a safe slash-separated feature-stream slug
- normal mode may override only runtime/policy knobs such as provider, runtime, access mode, model, and reasoning effort
- normal mode must not expose operator-controlled route shortcuts
- benchmarking fields may exist in the same contract, but Spec 1 stops at contract/substrate preparation and must not execute supervisor logic

## Path Resolution

The helper must resolve and surface at minimum:

- `project_root`
- `phase_number`
- `feature_slug`
- `feature_root`
- `skill_state_root`
- `worktrees_root`
- `setup_path`
- `registry_path`
- `features_index_path`
- `templates_root`
- `references_root`
- `state_path`

## Feature Artifact Layout

Feature root:

- `<project_root>/docs/phase<phase_number>/<feature_slug>/`

Stable feature artifacts:

```text
<feature_root>/
  README.md
  context.md
  implement-plan-state.json
  implement-plan-contract.md
  implement-plan-execution-contract.v1.json
  implement-plan-pushback.md
  implement-plan-brief.md
  implementation-run/
  completion-summary.md
```

Run-scoped execution artifacts:

```text
<feature_root>/implementation-run/<run-id>/
  execution-contract.v1.json
  run-projection.v1.json
  events/
    <attempt-id>/
      <timestamp>-<event-id>.json
```

Rules:

- `implement-plan-execution-contract.v1.json` is the stable repo-owned contract path shared by `prepare` and `run`
- `implementation-run/<run-id>/execution-contract.v1.json` is the run-scoped snapshot for the same schema
- `run-projection.v1.json` is the mutable reduced projection for that run
- append-only attempt event files are the durable mutation log
- `implement-plan-state.json` remains the compatibility projection for current callers; it is not the only execution truth

## Project-Level State

Project-level state root:

- `<project_root>/.codex/implement-plan/`

Project-level files:

- `setup.json`
- `agent-registry.json`
- `features-index.json`
- `locks/...`
- `worktrees/...`

`setup.json` must include truthful worker/runtime defaults and capability detection, including:

- `preferred_execution_access_mode`
- `preferred_implementor_access_mode`
- `fallback_execution_access_mode`
- `runtime_permission_model`
- `execution_access_notes`
- `preferred_execution_runtime`
- `preferred_control_plane_runtime` when available
- `persistent_execution_strategy`
- `preferred_implementor_model`
- `preferred_implementor_reasoning_effort`
- `detected_runtime_capabilities`

## Identity Model

The runtime must preserve distinct durable identities for:

- feature identity: project root, phase number, feature slug, registry key
- run identity: `run_mode`, `run_id`
- attempt identity: `attempt_id`, `attempt_number`
- worker identity: `worker_id`
- lane identity: benchmark lane ID when applicable

Rules:

- feature identity must remain stable across attempts and resets
- reset must create a new attempt identity, not a new feature identity
- worker identity must remain distinct from execution IDs so cached execution reuse can change without collapsing the worker role/lane identity
- lane identity is nullable in normal mode and explicit in benchmarking mode

## Stable Helper State

`implement-plan-state.json` must carry the current compatibility projection. At minimum it includes:

```json
{
  "state_schema_version": 2,
  "phase_number": 1,
  "feature_slug": "example-feature",
  "project_root": "C:/ExampleProject",
  "feature_registry_key": "phase1/example-feature",
  "feature_status": "active",
  "implementor_execution_id": null,
  "implementor_execution_access_mode": null,
  "implementor_execution_runtime": null,
  "implementor_provider": null,
  "implementor_model": null,
  "implementor_reasoning_effort": null,
  "resolved_runtime_permission_model": null,
  "resolved_runtime_capabilities": {},
  "current_branch": null,
  "base_branch": "main",
  "feature_branch": "implement-plan/phase1/example-feature",
  "worktree_path": "C:/ExampleProject/.codex/implement-plan/worktrees/phase1/example-feature",
  "worktree_status": "ready",
  "merge_required": true,
  "merge_status": "not_ready",
  "approved_commit_sha": null,
  "merge_commit_sha": null,
  "merge_queue_request_id": null,
  "local_target_sync_status": "not_started",
  "last_completed_step": "context_collected",
  "last_commit_sha": null,
  "active_run_status": "context_ready",
  "run_timestamps": {},
  "event_log": [],
  "artifacts": {},
  "current_run_id": "run-...",
  "current_attempt_id": "attempt-001",
  "execution_runs": {
    "active_by_mode": {
      "normal": "run-...",
      "benchmarking": null
    },
    "runs": {}
  }
}
```

Rules:

- repairs must be conservative and explicit
- when the compatibility state is missing or damaged, the helper may recover execution runs from run projections
- the helper must keep the legacy top-level compatibility fields synchronized from the active normal run

## Project Index Contracts

`agent-registry.json` stores per-feature worker continuity. At minimum each active entry may include:

```json
{
  "phase_number": 1,
  "feature_slug": "example-feature",
  "feature_root": "C:/ExampleProject/docs/phase1/example-feature",
  "current_run_id": "run-...",
  "current_attempt_id": "attempt-001",
  "current_worker_id": "implementor/default",
  "implementor_execution_id": "cached-impl-001",
  "implementor_execution_access_mode": "codex_cli_full_auto_bypass",
  "implementor_execution_runtime": "codex_cli_exec",
  "implementor_provider": "codex",
  "implementor_model": "gpt-5.4",
  "implementor_reasoning_effort": "xhigh",
  "resolved_runtime_permission_model": "codex_cli_explicit_full_auto",
  "execution_contract_path": "C:/.../implement-plan-execution-contract.v1.json",
  "execution_run_contract_path": "C:/.../implementation-run/run-.../execution-contract.v1.json",
  "execution_run_projection_path": "C:/.../implementation-run/run-.../run-projection.v1.json",
  "updated_at": "ISO-8601"
}
```

`features-index.json` stores per-feature discovery summary. At minimum each entry may include:

```json
{
  "phase_number": 1,
  "feature_slug": "example-feature",
  "feature_root": "C:/ExampleProject/docs/phase1/example-feature",
  "feature_status": "active",
  "active_run_status": "context_ready",
  "current_run_id": "run-...",
  "current_attempt_id": "attempt-001",
  "normal_run_id": "run-...",
  "benchmarking_run_id": null,
  "execution_contract_path": "C:/.../implement-plan-execution-contract.v1.json",
  "execution_run_projection_path": "C:/.../implementation-run/run-.../run-projection.v1.json",
  "merge_status": "not_ready",
  "last_completed_step": "context_collected",
  "last_commit_sha": null,
  "updated_at": "ISO-8601"
}
```

Rules:

- do not erase a valid cached execution ID merely because the current invocation did not refresh that lane
- project indexes must remain conservative summaries, not a replacement for feature-local execution truth

## Execution Contract Schema

The stable contract file and the run-scoped snapshot share the same schema:

```json
{
  "schema_version": 1,
  "contract_kind": "implement-plan-execution",
  "contract_revision": 1,
  "prepared_at": "ISO-8601",
  "feature_identity": {
    "project_root": "C:/ExampleProject",
    "phase_number": 1,
    "feature_slug": "example-feature",
    "feature_registry_key": "phase1/example-feature",
    "feature_root": "C:/ExampleProject/docs/phase1/example-feature"
  },
  "run_identity": {
    "run_mode": "normal",
    "run_id": "run-...",
    "attempt_id": "attempt-001",
    "attempt_number": 1,
    "lane_id": null,
    "worker_id": "implementor/default"
  },
  "invoker_runtime": {},
  "worker_selection": {
    "defaults": {},
    "continuity": {},
    "overrides": {},
    "resolved": {},
    "resolved_sources": {},
    "inheritance": {}
  },
  "route_policy": {
    "normal_mode_governed_flow": [
      "implementation",
      "machine_verification",
      "review_cycle",
      "human_testing",
      "merge_queue"
    ],
    "supported_operator_stop_surface": false,
    "supported_reset_surface": "helper-reset-attempt",
    "normal_mode_shortcuts_allowed": false
  },
  "review_handoff": {},
  "benchmarking": {
    "enabled": false,
    "supervisor_status": "not_applicable",
    "benchmark_run_id": null,
    "benchmark_suite_id": null,
    "lane_id": null,
    "lane_label": null
  },
  "resume_policy": {
    "resumable_after_crash_or_kill": true,
    "reuse_cached_workers_when_valid": true,
    "recreate_workers_when_invalid": true,
    "last_truthful_checkpoint": {}
  },
  "reset_policy": {
    "supported": true,
    "behavior": "new_attempt_from_implementation_preserving_history",
    "next_attempt_number": 2
  },
  "kpi_policy": {
    "source": "governed_production_flow",
    "step_timing_enabled": true,
    "governance_call_timing_enabled": true,
    "verification_outcomes_enabled": true,
    "review_and_self_fix_counts_enabled": true,
    "blocker_classification_enabled": true,
    "terminal_status_enabled": true
  },
  "integrity": {},
  "artifacts": {
    "state_path": "C:/.../implement-plan-state.json",
    "markdown_contract_path": "C:/.../implement-plan-contract.md",
    "execution_contract_path": "C:/.../implement-plan-execution-contract.v1.json",
    "run_contract_path": "C:/.../implementation-run/run-.../execution-contract.v1.json",
    "run_projection_path": "C:/.../implementation-run/run-.../run-projection.v1.json",
    "execution_run_root": "C:/.../implementation-run/run-...",
    "event_root": "C:/.../implementation-run/run-.../events/attempt-001",
    "worktree_path": "C:/.../worktrees/phase1/example-feature"
  }
}
```

Rules:

- `contract_revision` increments when the stable contract materially changes
- the feature-root contract is the canonical repo-owned path for the active run/attempt
- the run-scoped contract snapshot preserves the same schema within the run root
- every normal-mode mutator that changes the active run, attempt, resume checkpoint, or closeout state must refresh both contract files so they stay aligned with the compatibility state and the run projection
- the contract may contain benchmarking fields in both modes, but normal mode behavior must not weaken
- `worker_selection.defaults` must stay reserved for current invoker/runtime defaults, while persisted feature-local reuse must be surfaced separately under `worker_selection.continuity`

## Run Projection Schema

Each run keeps a mutable reduced projection:

```json
{
  "schema_version": 1,
  "projection_kind": "implement-plan-run-projection",
  "feature_registry_key": "phase1/example-feature",
  "run_id": "run-...",
  "run_mode": "normal",
  "updated_at": "ISO-8601",
  "artifacts": {
    "execution_contract_path": "C:/.../implement-plan-execution-contract.v1.json",
    "run_contract_path": "C:/.../implementation-run/run-.../execution-contract.v1.json",
    "run_projection_path": "C:/.../implementation-run/run-.../run-projection.v1.json",
    "event_root": "C:/.../implementation-run/run-.../events/attempt-001"
  },
  "run": {
    "run_id": "run-...",
    "run_mode": "normal",
    "lifecycle_status": "active",
    "terminal_status": null,
    "contract_schema_version": 1,
    "contract_revision": 1,
    "feature_contract_path": "C:/.../implement-plan-execution-contract.v1.json",
    "contract_path": "C:/.../implementation-run/run-.../execution-contract.v1.json",
    "projection_path": "C:/.../implementation-run/run-.../run-projection.v1.json",
    "benchmark_context": {},
    "worker_keys": [
      "implementor/default"
    ],
    "current_attempt_id": "attempt-001",
    "attempt_counter": 1,
    "attempts": {},
    "kpi_projection": {}
  }
}
```

Rules:

- the run projection is the preferred mutable reduced state for a run
- the helper may recover execution runs from these projections when the compatibility state is missing or damaged

## Event Log Schema

Attempt events are append-only JSON documents with at minimum:

```json
{
  "schema_version": 1,
  "event_type": "step-transition",
  "feature_registry_key": "phase1/example-feature",
  "run_id": "run-...",
  "run_mode": "normal",
  "attempt_id": "attempt-001",
  "occurred_at": "ISO-8601",
  "event_id": "event-...",
  "payload": {}
}
```

Supported event families in Spec 1:

- `run-initialized`
- `attempt-started`
- `attempt-reset`
- `contract-materialized`
- `worker-bound`
- `state-patched`
- `step-transition`
- `governance-call-recorded`
- `verification-recorded`
- `blocker-recorded`
- `terminal-status-recorded`

Rules:

- event files must be append-only
- event writes may use a narrow per-feature lock in this slice
- future benchmark-driven review-cycle parallelism must be able to reduce from the event stream and run projections without depending only on one whole-feature JSON file
- `terminal-status-recorded` must not create normal-mode completion truth until the guarded `mark-complete` route has already frozen merge-backed closeout evidence

## Run-Mode Rules

Normal mode:

- is the governed production route
- prepares the feature worktree
- may spawn or resume the implementor
- must preserve the strict route:
  - implementation
  - machine verification
  - review-cycle when required
  - human testing when required
  - merge-queue
  - completed only after truthful merge success

Benchmarking mode in Spec 1:

- uses the same contract schema
- materializes run identity, lane identity, worker selection, event root, and KPI substrate
- does not execute benchmark supervision or matrix orchestration
- must not weaken normal-mode behavior

## Worker-Selection Rules

Worker selection must be provider-neutral.

Resolution order:

1. explicit override
2. persisted feature-local worker settings
3. invoker/runtime defaults from setup and runtime detection

The helper must surface:

- `defaults`
- `continuity`
- `overrides`
- `resolved`
- `resolved_sources` with per-field values `explicit_override`, `persisted_continuity`, or `invoker_inheritance`
- `inheritance` flags that show which values were inherited directly from the current invoker/runtime defaults

## Resume And Reset Rules

Resume:

- there is no supported in-band operator stop surface once the run starts
- crash, kill, or external interruption must remain resumable
- when a cached execution ID remains valid and access is sufficient, the route should resume that worker
- when cached execution is invalid or under-permissioned, recreate only what is necessary and continue from the last truthful checkpoint

Reset:

- `reset-attempt` is the explicit helper surface
- reset starts a new attempt from implementation
- reset preserves prior attempt history and event files
- reset invalidates later-step status for the prior attempt without erasing history
- reset may optionally clear execution identity

## Verification And Completion Rules

Normal route closure must remain truthful:

1. implementation
2. machine verification
3. review-cycle when configured or required by the route
4. human testing when required
5. merge-queue
6. completed only after merge success and truthful local target sync status

Rules:

- approval on the feature branch is merge-ready, not completed
- do not claim completion if merge evidence is missing
- merged-but-not-completed state may keep `active_run_status=closeout_pending`, but `merge_status`, `step_status.merge_queue`, and the resume checkpoint must still agree that merge work already completed
- do not treat `local_target_sync_status=not_started` as truthful closeout evidence
- `mark-complete` must fail closed unless merge truth, recorded local target sync truth, and completion-summary evidence exist

## KPI Rules

Use KPI truth from the real governed route itself.

The run projection must support at minimum:

- per-step timing
- per-governance-call timing
- estimated prompt/completion/total tokens when available
- estimated governance-call cost when available
- verification outcomes
- review cycle count
- self-fix cycle count
- blocker classification
- terminal status

Do not introduce a benchmark-only scoring subsystem in this slice.

## Thread-Safety Rule

- use narrow feature-local and project-level locks where mutation is still shared
- keep append-only event files and run-scoped projections under the feature root
- do not rely on unsafe shared whole-file read-modify-write state as the only durable execution truth
- keep repairs deterministic and conservative

## Main Action Behavior

`action=prepare`

- validate or refresh setup
- normalize feature context
- run the integrity gate
- write pushback on failure
- materialize the stable execution contract, run-scoped contract snapshot, run projection, and initial events
- return `run_allowed=true` only for runnable normal mode
- return `benchmark_contract_ready=true` only for runnable benchmarking substrate preparation

`action=run`

- the skill invoker performs all of `prepare`
- in normal mode, the invoker then executes the governed route using the returned contract and execution projection
- in benchmarking mode, Spec 1 stops at contract/substrate preparation

`action=mark-complete`

- require merge success evidence, recorded local target sync truth, and a valid `completion-summary.md`
- update both the compatibility state and the active normal execution projection
- append terminal completion evidence

## Completion Summary Rule

`completion-summary.md` remains the human-facing closeout artifact and must distinguish at minimum:

- machine verification status
- human verification requirement
- human verification status
- review-cycle status
- merge status
- local target sync status
