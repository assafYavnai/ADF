---
name: implement-plan
description: Run a governed feature implementation planning and execution slice for any project using phase/feature artifacts, transparent setup refresh, strict plan-integrity gating, persistent per-feature implementor continuity, and truthful push-to-origin closeout.
---

# Implement Plan

Use this skill to run one governed implementation-planning or implementation-execution slice for a feature stream.

The authoritative source for this skill family is `C:/ADF/skills/implement-plan`.
Installed target copies under Codex, Claude, or Gemini roots are generated install output.

## Default behavior

If the skill is invoked with no inputs, or with `action=help`, return concise help.

The help output must include:

- what the skill does
- required inputs
- optional inputs
- supported actions
- current settings summary
- current active/open features summary
- how to mark a feature complete
- what happens if a feature is already completed or closed

## Supported actions

- `action=help`
- `action=get-settings`
- `action=list-features`
- `action=prepare`
- `action=run`
- `action=mark-complete`

## Required inputs for `action=run` and `action=prepare`

- `project_root`
- `phase_number`
- `feature_slug`
- `task_summary`

Optional inputs:

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
- `feature_status_override` only when explicitly reopening or administratively correcting state
- `post_send_to_review` default `false`
- `post_send_for_review` deprecated compatibility alias for `post_send_to_review`
- `review_until_complete` default `false`; only valid when `post_send_to_review=true`
- `review_max_cycles` optional positive integer; only valid when `review_until_complete=true`
- `benchmark_run_id`
- `benchmark_suite_id`
- `benchmark_lane_id`
- `benchmark_lane_label`

## Review handoff flags

Use `post_send_to_review` as the primary review handoff input.
Keep `post_send_for_review` only as a compatibility alias while callers migrate.

Rules:

- do not call `review-cycle` unless the resolved post-review handoff flag is `true`
- if `review_until_complete=true`, pass `until_complete=true` to `review-cycle`
- if `review_max_cycles` is provided, pass `max_cycles=<value>` to `review-cycle`
- if `review_until_complete=true` and `review_max_cycles` is omitted, let `review-cycle` use its default cap of `5`
- reject or push back on `review_until_complete` or `review_max_cycles` when post-review handoff is not enabled

## Input safety rules

- `phase_number` must be a positive integer.
- `feature_slug` must be a safe slash-separated feature-stream slug.
- Reject path traversal, empty segments, `.` or `..`, leading slash, trailing slash, and backslash-based escaping.
- Normalize all important paths from variables, not from hardcoded repo assumptions.
- Only runtime/policy knobs may vary through normal-mode overrides; the governed route itself must not become operator-shortcuttable.

## Run-Mode Rule

`implement-plan` now uses one versioned JSON-first execution contract for both supported modes:

- `normal`
- `benchmarking`

Rules:

- `normal` remains the governed production route
- `benchmarking` in this slice only prepares the shared substrate and must not execute a supervisor
- both modes use the same contract schema, identity model, and event/projection substrate
- benchmarking fields must not weaken normal-mode behavior

## Path variables

Resolve and surface at minimum:

- `project_root`
- `phase_number`
- `feature_slug`
- `feature_root`
- `skill_state_root`
- `setup_path`
- `registry_path`
- `features_index_path`
- `templates_root`
- `references_root`

## Start sequence

1. If no inputs are provided, or `action=help`, run `implement-plan-helper.mjs help ...` and print the help output.
2. If `action=get-settings`, run `implement-plan-helper.mjs get-settings ...` and print the resolved settings summary.
3. If `action=list-features`, run `implement-plan-helper.mjs list-features ...` and print the compact feature summary.
4. For `action=prepare`, `action=run`, and `action=mark-complete`, read [references/workflow-contract.md](references/workflow-contract.md) and [references/prompt-templates.md](references/prompt-templates.md).
5. Load `<project_root>/.codex/implement-plan/setup.json` internally.
6. If setup is missing, stale, unparsable, incomplete, or internally inconsistent, read [references/setup-contract.md](references/setup-contract.md) and run the internal setup helper before doing any worker work.
7. Run `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs prepare ...` for `action=prepare` or `action=run`.
8. Treat the helper JSON as the source of truth for:
   - feature path resolution
   - setup validity
   - feature lifecycle status
   - stable execution contract path and run-scoped projection paths
   - run identity, attempt identity, worker identity, and lane identity
   - context/input pack normalization
   - integrity precheck findings
   - worker-selection defaults, persisted continuity, overrides, resolved values, and provenance
   - implementor reuse vs recreation requirement
   - resumable state, reset semantics, and closeout status
9. Print the detected-status summary before taking action.

## Transparent setup rule

Setup must be transparent to the invoker.

Rules:

- the main skill validates setup internally first
- if setup is missing or invalid, the main skill internally refreshes it and continues
- the normal user flow must not require a separate manual setup invocation
- the setup helper is internal implementation code inside this skill folder, not a separate public skill

## Feature lifecycle rule

Every feature stream must have explicit status:

- `active`
- `blocked`
- `completed`
- `closed`

Rules:

- `active` and `blocked` features appear in open-features output
- `completed` and `closed` features do not appear in active/open output
- `action=run` must fail clearly for `completed` or `closed` features
- the failure must tell the invoker that the feature is no longer active and must be reopened or cloned to continue
- `action=mark-complete` must update both feature-local state and the project-level features index
- `action=mark-complete` must fail closed unless merge success, valid completion-summary evidence, and recorded local-target sync truth already exist

## Full-loop ownership rule

The skill invoker owns the full loop.

The main skill must:

- validate or refresh setup internally
- load and normalize feature context
- verify plan integrity before implementation
- push back when the implementation slice is weak or unsafe
- create or reuse the feature worktree and feature branch before serious implementation work begins
- create the implementor brief only when integrity passes
- in normal mode, spawn or resume the implementation worker under the strongest truthful worker mode
- wait for completion
- verify outputs
- write completion artifacts
- commit and push implementation changes and feature artifacts on the feature branch
- if `post_send_to_review=true`, hand the same feature stream to `review-cycle` after machine verification using the feature worktree as the review repo root
- if `review_until_complete=true`, pass `until_complete=true` and pass `max_cycles` only when `review_max_cycles` was supplied
- once approval gates are satisfied, enqueue the exact approved commit for `merge-queue`
- mark the implementation slice completed only after `merge-queue` lands the merge successfully and sync state is recorded truthfully

Do not delegate orchestration responsibility to the worker.

## Execution Contract Rule

The helper owns the deterministic execution contract and runtime substrate.

The main skill must treat the helper result as authoritative for:

- `implement-plan-execution-contract.v1.json` at the feature root
- the run-scoped contract snapshot under `implementation-run/<run-id>/execution-contract.v1.json`
- the mutable run projection under `implementation-run/<run-id>/run-projection.v1.json`
- append-only attempt event files under `implementation-run/<run-id>/events/<attempt-id>/`
- the current `run_id`, `attempt_id`, `worker_id`, and benchmarking lane identity when applicable
- any post-prepare normal-mode mutation must keep the feature-root contract, run-scoped contract, run projection, and compatibility state aligned on the active run, attempt, checkpoint, and closeout truth

`implement-plan-state.json` remains an important compatibility projection, but it is no longer the only execution truth.

## Integrity gate rule

Before spawning the implementor, the main skill must verify whether the slice is truly ready.

At minimum, check:

- `KPI Applicability` is explicit
- if `KPI Applicability` is `required` or `temporary exception approved`, the slice explicitly states:
  - `KPI Route / Touched Path`
  - `KPI Raw-Truth Source`
  - `KPI Coverage / Proof`
  - `KPI Production / Proof Partition`
- if `KPI Applicability` is `not required`, the slice states `KPI Non-Applicability Rationale`
- if `KPI Applicability` is `temporary exception approved`, the slice also states:
  - `KPI Exception Owner`
  - `KPI Exception Expiry`
  - `KPI Exception Production Status`
  - `KPI Compensating Control`
- the compatibility section is frozen with all required fields:
  - `Vision Compatibility` against `docs/VISION.md`
  - `Phase 1 Compatibility` against `docs/PHASE1_VISION.md`
  - `Master-Plan Compatibility` against `docs/PHASE1_MASTER_PLAN.md`
  - `Current Gap-Closure Compatibility` against `docs/phase1/adf-phase1-current-gap-closure-plan.md`
  - `Later-Company Check` (yes or no)
  - `Compatibility Decision` must be one of: `compatible`, `defer-later-company`, `blocked-needs-user-decision`
  - `Compatibility Evidence`
- only `Compatibility Decision: compatible` is implementation-legal
- `Later-Company Check: yes` blocks implementation
- required implementation contract exists or a valid equivalent source is available
- the slice is explicit, bounded, and internally coherent
- required deliverables are stated clearly
- allowed edits and forbidden edits are stated clearly
- acceptance gates are stated clearly
- `Machine Verification Plan` exists
- `Human Verification Plan` exists
- `Human Verification Plan` states `Required: true|false`
- if `Human Verification Plan` says `Required: true`, the slice is configured with `post_send_to_review=true`
- if human verification is required, the plan also includes explicit testing-phase instructions, expected results, evidence to report back, and `APPROVED` / `REJECTED: <comments>` response guidance
- observability or audit expectations are stated when required
- dependencies, constraints, and non-goals are explicit enough
- upstream context is sufficient to implement without business guessing
- the feature is still active/open
- the slice is product-shaped and not broad speculative refactoring

If integrity fails:

- do not spawn the implementor
- write `implement-plan-pushback.md`
- surface a concise pushback to the invoker
- preserve resumable state

If integrity passes:

- write or refresh `implement-plan-contract.md` when normalization is needed
- write `implement-plan-brief.md`
- spawn or resume the implementor

## Authoritative requirement-freeze guard

When a feature stream has an active implementation slice, the governed route must guard against independent authoritative requirement introduction on both the base branch and the feature branch.

Rules:

- if the feature's `implement-plan-contract.md` or `implement-plan-brief.md` freezes specific authority files (requirements docs, context docs, decision docs), the route must not silently accept new or changed authority files that were not present when the contract was frozen
- before spawning or resuming the implementor, the invoker should verify that no new or modified authority files on the base branch conflict with the frozen slice contract
- if new authority files have appeared on the base branch that overlap the slice scope, the invoker must surface a pushback instead of silently proceeding with stale assumptions
- this guard protects against the case where requirements are updated independently on `main` while a feature branch is in flight, leading to silent divergence
- the guard does not block feature-branch-internal authority file updates that are part of the slice itself

## Worker policy

When integrity passes, use the strongest truthful autonomous worker mode available.

Rules:

- resolve worker availability from runtime preflight `llm_tools` section before assuming any CLI tool is unavailable
- when the user or contract requests a specific LLM tool as a worker, use the `autonomous_invoke` command from preflight to spawn it via Bash
- worker selection must stay provider-neutral
- keep worker runtime distinct from control-plane runtime
- when override knobs are absent, inherit truthful invoker/runtime defaults unless persisted worker continuity is being reused, and surface that continuity explicitly
- if native worker access is weaker than CLI full-auto bypass, prefer CLI worker mode and record why
- default implementor target is `GPT-5.4` with `xhigh` reasoning, or the strongest truthful equivalent in the current runtime
- persist which provider, worker runtime, access mode, model, and reasoning effort were actually used

## Action behavior

`action=prepare`

- validate or refresh setup internally
- normalize the context/input pack
- run integrity verification
- if weak, write the pushback artifact and stop
- if solid, materialize the execution contract, run projection, and implementation brief
- in `run_mode=normal`, stop before worker spawn when the caller asked only for `prepare`
- in `run_mode=benchmarking`, stop after the shared contract/substrate is prepared; do not execute a supervisor in this slice

`action=run`

- do everything from `prepare`
- in `run_mode=normal`, spawn or resume the implementor when integrity passes
- wait for completion
- run the machine-verification loop until it passes or blocks
- verify outputs
- write `completion-summary.md`
- call `normalize-completion-summary` to ensure the summary satisfies the required 7-heading contract before commit
- commit and push all code and feature artifacts on the feature branch, not the base branch
- if `post_send_to_review=false` and human verification is not required, stop at merge-ready state instead of marking the feature completed directly
- if human verification is required, `post_send_to_review` must be enabled because human testing happens only after the first route-level `review-cycle` gate
- if `post_send_to_review=true`, call `review-cycle` for the same feature stream after machine verification and pass the feature worktree as the review repo root
- if `post_send_to_review=true` and `review_until_complete=true`, pass `until_complete=true` to `review-cycle` and let `review-cycle` default `max_cycles` to `5` unless `review_max_cycles` was supplied
- if human verification is required, surface the testing-phase handoff instead of closing immediately
- if human verification is required and human testing rejects, return to code fix plus machine verification before re-requesting human testing
- after human approval, run a final sanity `review-cycle` only when code changed after human approval
- if a post-approval sanity fix changes approved human-facing behavior, treat the human approval as stale and return to human testing instead of silently closing
- after the approval gates are satisfied, enqueue the exact approved commit into `merge-queue`
- do not mark the feature completed until `merge-queue` reports merge success and truthful local target sync status
- in `run_mode=benchmarking`, stop at contract/substrate preparation in this slice and report that supervisor orchestration is deferred

`action=mark-complete`

- require a target feature stream
- persist feature completion in state and index only after merge success evidence exists
- keep merged-but-not-completed closeout state internally consistent before final completion is recorded
- remove the feature from active/open output
- do not silently mark complete if closeout evidence is missing

## Helper scripts

Use the helper scripts for deterministic local state:

- `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs help ...`
- `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs get-settings ...`
- `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs list-features ...`
- `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs prepare ...`
- `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs update-state ...`
- `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs record-event ...`
- `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs reset-attempt ...`
- `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs mark-complete ...`
- `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs completion-summary ...`
- `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs normalize-completion-summary ...`
- `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs validate-closeout-readiness ...`
- `node C:/ADF/skills/implement-plan/scripts/implement-plan-setup-helper.mjs write-setup ...`
- `node C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs enqueue ...`

## Closeout

When an implementation slice succeeds, end by showing:

- the feature artifact tree
- the feature worktree path, base branch, and feature branch
- the stable execution contract path and the active run projection path
- the saved implementor execution identifier if available
- the resolved worker and control-plane runtime/access mode summary
- the completion summary
- the feature-branch commit SHA if push succeeded, or the exact git failure if it did not
- the merge-queue request identifier when merge handoff was created

User-facing reports for this skill must stay human-facing:

- lead with the most important current outcome
- use short sections and concise bullets where appropriate
- separate status, blockers or findings, and next actions
- avoid dense wall-of-text output

If human verification is required, the testing-phase handoff must use this exact visible shape:

- `IMPLEMENTATION COMPLETE AND READY FOR YOUR TESTING`
- short executive summary of implemented behavior
- `IMPLEMENTATION IS READY FOR TESTING`
- exact testing sequence, expected results, and evidence to report back
- explicit response contract using `APPROVED` or `REJECTED: <comments>`
- `IMPLEMENTATION COMPLETE AND READY FOR YOUR TESTING`
