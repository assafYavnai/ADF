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
- `implementor_model`
- `implementor_reasoning_effort`
- `feature_status_override` only when explicitly reopening or administratively correcting state
- `post_send_to_review` default `false`
- `post_send_for_review` deprecated compatibility alias for `post_send_to_review`
- `review_until_complete` default `false`; only valid when `post_send_to_review=true`
- `review_max_cycles` optional positive integer; only valid when `review_until_complete=true`

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
   - context/input pack normalization
   - integrity precheck findings
   - implementor reuse vs recreation requirement
   - resumable state and closeout status
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

## Full-loop ownership rule

The skill invoker owns the full loop.

The main skill must:

- validate or refresh setup internally
- load and normalize feature context
- verify plan integrity before implementation
- push back when the implementation slice is weak or unsafe
- create or reuse the feature worktree and feature branch before serious implementation work begins
- create the implementor brief only when integrity passes
- spawn or resume the implementation worker under the strongest truthful worker mode
- wait for completion
- verify outputs
- write completion artifacts
- commit and push implementation changes and feature artifacts on the feature branch
- if `post_send_to_review=true`, hand the same feature stream to `review-cycle` after machine verification using the feature worktree as the review repo root
- if `review_until_complete=true`, pass `until_complete=true` and pass `max_cycles` only when `review_max_cycles` was supplied
- once approval gates are satisfied, enqueue the exact approved commit for `merge-queue`
- mark the implementation slice completed only after `merge-queue` lands the merge successfully and sync state is recorded truthfully

Do not delegate orchestration responsibility to the worker.

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

## Worker policy

When integrity passes, use the strongest truthful autonomous worker mode available.

Rules:

- keep worker runtime distinct from control-plane runtime
- if native worker access is weaker than CLI full-auto bypass, prefer CLI worker mode and record why
- default implementor target is `GPT-5.4` with `xhigh` reasoning, or the strongest truthful equivalent in the current runtime
- persist which worker runtime, access mode, model, and reasoning effort were actually used

## Action behavior

`action=prepare`

- validate or refresh setup internally
- normalize the context/input pack
- run integrity verification
- if weak, write the pushback artifact and stop
- if solid, write the normalized contract and implementation brief and stop before worker spawn

`action=run`

- do everything from `prepare`
- spawn or resume the implementor when integrity passes
- wait for completion
- run the machine-verification loop until it passes or blocks
- verify outputs
- write `completion-summary.md`
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

`action=mark-complete`

- require a target feature stream
- persist feature completion in state and index only after merge success evidence exists
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
- `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs mark-complete ...`
- `node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs completion-summary ...`
- `node C:/ADF/skills/implement-plan/scripts/implement-plan-setup-helper.mjs write-setup ...`
- `node C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs enqueue ...`

## Closeout

When an implementation slice succeeds, end by showing:

- the feature artifact tree
- the feature worktree path, base branch, and feature branch
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
