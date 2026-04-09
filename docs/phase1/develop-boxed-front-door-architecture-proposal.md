# Develop Boxed Front-Door Architecture Proposal

Status: proposed architecture direction  
Date: 2026-04-09  
Owner: CEO, COO, and future `dev_team`  
Scope: Phase 1 governed implementation route and its MCP-ready boxing path

## Purpose

Define the recommended high-level architecture for replacing the current public `$implement-plan` usage pattern with a boxed public skill named `develop` that gives invokers a simple, production-safe development entry point while preserving the governed implementation, review, merge, and completion truth already built in ADF.

This document is intentionally architecture-first.
It is not the final slice contract.
Its job is to establish the target model, the boundaries, the rollout order, and the rules that make the box real instead of merely renaming the existing skill surface.

## Executive Decision

ADF should move toward a single public development front door named `develop`.

That move is the right long-term direction, but it should **not** begin as a big-bang rewrite of `implement-plan`.

The recommended path is:

1. keep the current governed engines (`implement-plan`, `review-cycle`, `merge-queue`) as internal machinery for now
2. build `develop` as the only public front door and orchestration boundary
3. move governance truth into a deterministic script-owned governor instead of relying on long prompt discipline
4. close the remaining state and run-contract substrate gaps before deeper boxing
5. later expose the same governor surface as the MCP-facing `dev_team` service

## Why This Move Is Needed

The current public implementation route is too open.

Main problems:

- invoker agents can see and call low-level skills directly
- invoker agents can partially operate the internal state machine instead of simply requesting development
- good behavior still depends too much on very long prompts
- the public surface leaks internal actions like `prepare`, `mark-complete`, review handoff details, and recovery behavior
- the route is harder to use correctly than it should be
- direct helper or skill access makes it easier to bypass the intended governed entry point

This causes practical failures:

- slices are sometimes run through the wrong entry point
- agents sometimes call review or merge machinery manually
- invokers need to understand too much internal process detail
- implementation quality still depends too much on prompt quality rather than on boxed runtime enforcement

## Current Repo Reality

ADF already has important building blocks that should be preserved:

- `implement-plan` already owns the governed implementation route
- worktree-first execution is already real
- `review-cycle` already exists as the governed review/fix loop
- `merge-queue` already exists as the governed merge landing route
- completion truth is already intended to be merge-backed rather than review-backed
- Phase 1 MCP boxing already points toward a boxed `dev_team` front door with a private lane store and a small ADF-visible contract surface

At the same time, the repo still signals that the state/projection substrate and provider-neutral run contract should be stabilized before deeper single-entry boxing is made load-bearing.

## Architecture Principle

The boxed interface must be real.

That means:

- the public API is small
- internal lifecycle truth is owned by scripts, state, and helper contracts
- the LLM does not own lifecycle truth
- internal mutating paths fail closed when called outside the governor
- invokers get progress and outcome truth without needing to understand internal worker lanes

A rename without these enforcement properties would not solve the real problem.

## Recommended Public Interface

The public skill name should be:

- `develop`

The public commands should be:

- `develop help`
- `develop implement <slice>`
- `develop fix <slice>`
- `develop status <slice>`
- `develop settings <json>`

### Command meanings

#### `develop help`

Shows:

- what `develop` does
- required intake artifacts
- template locations
- valid commands
- minimal settings surface
- how status and approval work
- what happens when human verification is required

#### `develop implement <slice>`

The normal implementation entry point.

This command takes a slice from validated intake through governed implementation, verification, review, human verification when required, merge handoff, and truthful completion closeout.

The invoker is asking for the outcome, not for the internal choreography.

#### `develop fix <slice>`

The bug-fix / follow-up entry point.

This command re-enters the governed route for an existing slice or merged slice that needs correction.
It should preserve audit continuity and create a new governed run or attempt rather than opening ad-hoc side routes.

#### `develop status <slice>`

Shows truthful human-facing progress for the slice without exposing internal operational internals that the invoker should not control.

Minimum visible fields:

- slice identity
- current stage
- current status
- current blocker if one exists
- latest durable event
- latest review verdicts when available
- whether human input is required
- next expected transition

#### `develop settings <json>`

The only public override surface.

It should stay intentionally small and focus only on truly safe run-policy overrides such as model selection, review cap, and verbosity.

## Public Surface That Should Not Exist

The following should not remain public operator surfaces:

- direct public `implement-plan`
- direct public `review-cycle`
- direct public `merge-queue`
- public `mark-complete`
- public step-level reset
- public merge handoff internals
- public review lane selection internals

These are internal implementation mechanics, not invoker responsibilities.

## Reset Recommendation

Do **not** expose `develop reset <slice> <step>` as a normal public command.

Recommendation:

- if reset is needed, make it an internal or admin-only operation
- scope reset to a new governed attempt, not to an arbitrary internal step
- preserve prior attempt history and evidence

Preferred shape:

- `develop admin reset-attempt <slice>`

Reason:

A public step-level reset teaches invokers the internal machine and invites them to work around the box instead of through the box.

## Target Layered Architecture

The recommended architecture has four layers.

### Layer 1 — Public `develop` boundary

This is the only public skill surface.

Responsibilities:

- parse public commands
- show help
- validate intake presence
- call the governor
- render user-facing status and results

This layer is intentionally thin.

### Layer 2 — Deterministic governance script

Create a real governor script, for example:

- `skills/develop/scripts/develop-governor.mjs`

This script is the actual box.

It owns:

- path resolution
- runtime preflight
- setup validation
- intake validation
- run identity
- attempt identity
- lock acquisition
- state transitions
- lane selection
- helper invocation
- review/fix loop sequencing
- merge sequencing
- human verification gates
- KPI/event emission
- truthful status synthesis

Critical rule:

The governor owns lifecycle truth.
The LLM does not.

### Layer 3 — Internal lane adapter

The governor talks to internal working lanes:

- orchestrator helper lane
- implementor lane
- auditor lane
- reviewer lane

The lane adapter is responsible for:

- compact prompt construction
- worker selection from policy
- persistent lane reuse when valid
- recreation only when invalid or under-permissioned
- collecting worker outputs back into governed artifacts

### Layer 4 — Internal governed engines

For the first boxed version, keep using the current engines behind the boundary:

- `implement-plan`
- `review-cycle`
- `merge-queue`

These should become internal machinery, not public skills.

Longer term, the same responsibilities can migrate behind MCP endpoints or a dedicated `dev_team` service without changing the public front-door contract.

## Closed-Box Enforcement Model

Hiding old skills is not enough.

The real box requires mutating-path enforcement.

### Required rule

All internal mutating actions must require a governor-issued lease or run token.

Conceptually, the governor issues a governed lease that carries:

- feature identity
- run identity
- attempt identity
- allowed stage or transition set
- expiration
- expected next transitions
- mutation scope

Internal mutating helpers reject calls that do not carry a valid lease for the active governed run.

### Effect

Even if an invoker or agent discovers internal helpers:

- direct mutation attempts fail closed
- review, merge, or completion cannot be advanced outside the governor
- the public route is no longer enforceable only by prompt discipline

This is the core difference between an open skill family and a real boxed service boundary.

## Intake Artifact Model

The invoker should not need to understand the internal lifecycle.
The invoker should need only to prepare a small authoritative intake package.

Recommended minimum ADF-visible intake package:

- `contract.md`
- `context.md`

Optional:

- `README.md`
- other slice-specific support artifacts when explicitly required

Rules:

- `contract.md` is the frozen authoritative intake artifact
- `context.md` contains the relevant context and source references needed to implement truthfully
- the governor validates the package before starting implementation
- the governor generates its own machine-facing execution artifacts rather than requiring invokers to write them

This aligns with the current MCP boxing direction where the ADF-visible surface stays small and deep operational artifacts stay in the private lane store.

## Internal State Model

`develop` should preserve the strong parts of the current implementation substrate.

Required durable identities:

- feature identity
- run identity
- attempt identity
- worker identity
- lane identity

Required state properties:

- resumable after crash or interruption
- parallel-safe across multiple slices
- truthful merge-ready versus completed distinction
- durable approval history
- durable human-verification history when required
- append-only event truth for important lifecycle mutations

### Parallel execution support

Parallel slice execution is required.

The box should support it through:

- per-feature or per-scope locks
- stable run and attempt IDs
- worktree isolation
- explicit overlap or scope-claim rules where needed
- no shared mutable whole-feature truth as the only source of execution state

## Recommended Visible and Internal Artifacts

### ADF-visible package and summary artifacts

Recommended visible artifacts:

- `contract.md`
- `context.md`
- `develop-state.json`
- `develop-summary.json`
- `completion-summary.md`

### Private lane and execution artifacts

Keep deep operational artifacts internal, for example under a lane store or governed worktree/runtime store.

These may include:

- run-scoped execution contracts
- run projections
- attempt event logs
- worker continuity registry
- review artifacts
- merge closeout evidence
- KPI and timing records

### Summary bridge rule

The visible summary artifact should reference private truth rather than duplicating every internal artifact.

At minimum it should be able to reference:

- `run_id`
- `attempt_id`
- `lane_id` when applicable
- `artifact_snapshot_id` or equivalent
- `worktree_ref`
- `related_commit_shas`

## Lifecycle Rule

The public `develop implement <slice>` route should behave conceptually like this:

1. validate intake artifacts
2. validate setup and runtime
3. create or resume governed run and attempt
4. acquire locks
5. create or reuse worktree
6. spawn or resume implementor lane
7. run machine verification
8. run governed review cycle
9. request human verification when required
10. if rejected, return through governed fix route
11. after all approval gates are satisfied, run governed merge handoff
12. record merge truth and sync truth
13. only then record completed truth

Critical rule:

Approval on a branch is not completion.
Completion is merge-backed closeout truth.

## LLM Role Policy

LLMs are workers inside the box, not the box itself.

### Governance ownership

- script-owned governor for lifecycle truth
- optional lightweight orchestrator LLM for compact prompt shaping and human-facing summaries
- worker LLMs for implementation and review work only

### Recommended model defaults

- orchestrator helper: minimal codex-class model or strongest truthful low-cost equivalent
- implementor: `gpt-5.3-codex-spark`
- auditor: `gpt-5.4`
- reviewer: `gpt-5.4`

### Important rule

The orchestrator model must not be the authority for lifecycle state, merge truth, completion truth, or approval truth.
Those remain script-owned.

## Settings Surface Recommendation

Keep settings intentionally small.

Recommended public settings shape:

```json
{
  "models": {
    "implementor": "gpt-5.3-codex-spark",
    "auditor": "gpt-5.4",
    "reviewer": "gpt-5.4"
  },
  "review": {
    "until_complete": true,
    "max_cycles": 5
  },
  "output": {
    "verbose": true
  }
}
```

Do not expose public settings for:

- merge shortcuts
- step jumping
- review lane routing internals
- helper state repair internals
- worktree plumbing
- direct completion mutation

## KPI and Observability Model

`develop` must emit production-useful KPIs from the governed route itself.

Recommended KPI families:

### Flow KPIs

- total run duration
- step duration
- queue wait time
- review-cycle count
- human-verification latency
- merge-closeout latency

### Quality KPIs

- rejection rate by lane
- self-fix count
- reopen count
- stale approval count
- escaped defect count

### Governance KPIs

- direct internal-call rejection attempts
- invalid lease attempts
- state repair count
- manual intervention count
- reset count

### Efficiency KPIs

- worker reuse versus respawn rate
- artifact reuse rate
- estimated token and cost by lane when available
- redundant review rerun count

### Truthfulness KPIs

- claimed-route versus proved-route mismatches
- completion blocked for missing evidence
- merge truth mismatches
- sync truth mismatches

## Verbose Status Model

Verbose output should be truthful and easy to scan.

Do not use fake progress percentages.

Recommended stage vocabulary:

- `validating_artifacts`
- `pushback_required`
- `worktree_prepared`
- `implementing`
- `machine_verifying`
- `review_cycle_running`
- `fixing`
- `awaiting_human_verification`
- `ready_for_merge`
- `merging`
- `completed`
- `blocked`

For each status, show at minimum:

- current stage
- status
- last durable event
- current blocker if present
- latest verdicts if present
- next action

## Recommended Rollout Order

The safest rollout is phased.

### Phase A — substrate hardening

Before making `develop` the load-bearing public entry point, close the remaining substrate issues that directly affect boxing quality.

Highest-value prerequisites:

1. governed state-writer serialization / projection stability
2. provider-neutral run contract completion for `implement-plan`
3. any remaining integrity or runtime truth issues that would make the box look clean outside while drifting internally

### Phase B — boxed front door

Create the first public `develop` surface.

Deliverables:

- `skills/develop/SKILL.md`
- `skills/develop/scripts/develop-governor.mjs`
- `skills/develop/references/...`
- public command contract
- status rendering
- intake validation
- governor-owned orchestration
- internal reuse of existing governed engines

### Phase C — internal mutation closure

After the box exists, make it real.

Deliverables:

- lease or run-token enforcement for internal mutating helper calls
- old public skill surfaces removed from normal discovery
- direct internal calls fail closed
- public lifecycle mutation only through `develop`

### Phase D — MCP promotion

Promote the same governor into the first `dev_team` MCP surface.

Example future MCP routes:

- `dev.prepare_guidance`
- `dev.validate_package`
- `dev.start_run`
- `dev.get_status`
- `dev.fix`
- `dev.record_human_approval`
- `dev.record_human_rejection`
- `dev.list_runs`
- `dev.get_kpis`

This preserves one architecture across CLI skill mode and MCP service mode.

## COO Readiness Implication

After `develop` exists, COO can begin using it for bounded development handoffs.

However, COO is not yet ready to act as the sole reliable development controller for all ADF work without cracks.

Current repo direction still says the larger COO-side gaps remain:

- stronger executive briefing surface
- a real COO -> CTO admission seam
- a stronger company-level table or queue view

So the intended near-term shape is:

- COO remains the shaping and admission-side business front door
- `develop` becomes the boxed governed development front door
- later MCP `dev_team` turns that front door into a service boundary

## Acceptance Criteria For The Future Box

The `develop` direction should be considered successful only when all of the following are true:

1. an invoker can start implementation through `develop implement <slice>` without understanding internal workflow mechanics
2. the route still preserves governed review, merge, and completion truth
3. multiple slices can run in parallel safely
4. direct internal calls to mutate state, review, merge, or completion fail closed outside the governor
5. verbose status is truthful and useful without leaking control of internal worker lanes
6. human verification is supported where required
7. internal operational artifacts can stay private while ADF-visible summaries stay stable and machine-usable
8. the same governor boundary can later be exposed through MCP without redesigning the architecture from scratch

## Non-Goals

This proposal does **not** recommend:

- a big-bang rewrite of all governed engines first
- immediate retirement of all current helpers before the box exists
- making `develop` just a renamed `implement-plan`
- exposing internal reset or merge controls publicly
- building full benchmark supervision in the first boxed slice
- turning COO into the full company operating system before the current COO gap work is complete

## Practical Recommendation

Proceed with `develop` as the new public front door, but treat it as a **boxing and governance project**, not as a simple skill rename.

The right first production version is:

- small public surface
- deterministic governor
- existing governed engines kept internal
- lease-based internal mutation enforcement
- MCP-ready summary bridge and run identity model

That path gives ADF a real development boundary now and preserves a clean upgrade path into the later MCP service model.

## Source Authorities

- `docs/VISION.md`
- `docs/PHASE1_VISION.md`
- `docs/PHASE1_MASTER_PLAN.md`
- `docs/phase1/README.md`
- `docs/phase1/adf-phase1-current-gap-closure-plan.md`
- `docs/phase1/MCP-gaps.md`
- `docs/phase1/mcp-boxing/requirements.md`
- `docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge/requirements.md`
- `docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge/decisions.md`
- `docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge/contract.md`
- `skills/implement-plan/SKILL.md`
- `skills/implement-plan/references/workflow-contract.md`
- `skills/review-cycle/references/workflow-contract.md`

## Recommended Next Document

The next bounded implementation document should be a real slice contract for the first production version of `develop`, including:

- required deliverables
- forbidden edits
- machine verification plan
- human verification plan
- lease or token enforcement rules
- migration rules for retiring public `$implement-plan` use
- compatibility rules for later MCP `dev_team` promotion
