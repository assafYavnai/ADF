# Develop Boxed Front-Door Delivery Plan

Status: active planning artifact  
Date: 2026-04-09  
Owner: CEO, COO, and future `dev_team`  
Scope: bounded rollout plan for the first production `develop` implementation path

## Purpose

This document turns the `develop` architecture direction into an explicit phased delivery plan that an implementor can execute without reconstructing intent from prior discussion.

It is additive to `develop-boxed-front-door-architecture-proposal.md`.

Use this document for rollout order, slice boundaries, command surface, lane model, KPI model, and migration sequencing.

## Architectural Decision

`develop` becomes the only public governed implementation skill.

The internal engines remain:

- `implement-plan`
- `review-cycle`
- `merge-queue`

Governance is deterministic script logic.
LLM workers may summarize, classify, or generate compact prompts, but they must never own lifecycle truth.

## Public v1 Command Surface

Public v1 commands:

- `develop help`
- `develop implement <slice>`
- `develop fix <slice>`
- `develop status <slice>`
- `develop settings <json>`

Non-public / deferred:

- public step-level reset
- direct helper actions
- direct merge/review controls
- direct completion mutation

If a reset surface is later required, it should be admin-only and attempt-based.

## Minimal Intake Contract

Before `develop implement`, the invoker prepares under `docs/phase<N>/<feature-slug>/`:

- `contract.md`
- `context.md`

Rules:

- `contract.md` is the frozen authoritative intake contract
- `context.md` contains relevant context and source references
- `develop help` must point to templates and validation rules
- the invoker should not need to understand internal worker or helper choreography

## Internal Components

Recommended `skills/develop/` structure:

```text
C:/ADF/skills/develop/
  SKILL.md
  references/
    workflow-contract.md
    invoker-guide.md
    artifact-templates.md
    settings-contract.md
    kpi-contract.md
  scripts/
    develop-helper.mjs
    develop-governor.mjs
    develop-lane-runner.mjs
    develop-setup-helper.mjs
```

Recommended operational state:

```text
C:/ADF/.codex/develop/
  settings.json
  lanes/
    <lane-id>/
      lane-state.json
      heartbeat.json
      kpi.json
      errors.json
      events/
  locks/
  signals/
```

Rules:

- lane-state, heartbeat, KPI, and error files are operational projections, not final lifecycle truth
- governed feature-local artifacts plus merge truth remain the source of final lifecycle truth
- file-based isolation and lock discipline should follow the existing benchmark/runtime patterns where useful

## Governance Command Surface

The deterministic governor should expose at minimum:

- `validate-prerequisites`
- `validate-integrity`
- `run-verification`
- `validate-closeout`
- `check-lane-conflict`

Each returns structured pass/fail output, not narrative-only text.

## Worker Roles

Recommended default worker split:

- implementor: `gpt-5.3-codex-spark`
- auditor: `gpt-5.4`
- reviewer: `gpt-5.4`
- optional lightweight orchestrator helper: smallest truthful codex-class model or equivalent low-cost helper model

Critical rule:

- the script governs
- the LLM does not govern

## Orchestration Flow

`develop implement <slice>` should follow this high-level route:

1. validate prerequisites
2. initialize lane and governed run state
3. prepare worktree and governed execution substrate
4. run implementor lane
5. run machine verification
6. run governed review-cycle
7. hold for human verification when required
8. hold for invoker approval when required by policy/contract
9. delegate governed merge
10. finalize truthful closeout and KPI capture

## Approval Model

The boxed route must support two explicit approval families:

1. human verification approval when the contract requires it
2. invoker approval before final completion truth when the route or policy requires it

Merge and completion must not silently bypass those gates.

## KPI Model

Minimum KPI families:

### Timing

- total elapsed
- preparation
- implementation
- verification
- review
- fix cycles
- human verification wait
- invoker approval wait
- merge

### Counts

- review cycles
- fix cycles
- verification attempts
- verification failures
- review rejections
- human rejections
- invoker rejections

### Quality

- first-pass review approved
- first-pass verification
- files changed
- lines added / removed
- defect classes

### Outcome

- completed
- blocked
- failed
- cancelled

Persistence rule:

- disk persistence is required
- Brain persistence is optional / best-effort when available

## Report Surfacing Rule

Reviewer reports must be surfaced immediately and verbatim before fix work begins, using the existing governed wrapper shape.

Do not collapse reviewer output into a summary before the invoker sees it.

## Parallel Execution Rule

- one active lane per feature slug unless a later explicit policy says otherwise
- multiple features may run in parallel
- use lock-based coordination and worktree isolation
- do not let the lane store become the only source of execution truth

## Error Model

At minimum, the box should distinguish:

- missing prerequisites
- integrity failure
- worker failure
- machine verification failure
- review exhaustion
- merge blocked

Each error should produce:

- structured lane state
- invoker-facing message
- append-only error log entry

## Rollout Order

### Slice 0 — canonical closeout substrate

Required before the first public `develop` shell:

- `governed-canonical-closeout-receipt`

Reason:

The later `develop` shell needs canonical committed closeout truth before status/finalize/reporting can be trusted.

### Slice A — shell, help, settings, status, and governance

Deliver:

- `skills/develop/SKILL.md`
- `develop-helper.mjs`
- `develop-governor.mjs`
- `develop-setup-helper.mjs`
- help output
- settings persistence
- status rendering
- deterministic prerequisite and integrity validation

### Slice B — full implement orchestration

Deliver:

- full implement path
- lane runner / step sequencer
- machine verification orchestration
- review-cycle delegation
- human-verification hold
- invoker-approval hold
- merge delegation
- final KPI capture

### Slice C — fix path, parallel lanes, and bounded recovery

Deliver:

- explicit fix path
- delta-only implementor resume
- parallel feature lanes
- internal/admin-only recovery surfaces if still needed

### Slice D — MCP bridge and retirement path

Deliver:

- boxed `dev_team` bridge
- status bridge
- migration path in `AGENTS.md`
- plan for retiring direct public `$implement-plan` usage

## Acceptance Criteria For The Overall Program

The program is successful only when:

1. invokers can use `develop implement <slice>` without internal helper knowledge
2. the boxed route preserves governed review, merge, and completion truth
3. status is truthful and easy to read
4. multiple slices can run in parallel safely
5. internal mutating calls fail closed outside the governor
6. the box is compatible with a later MCP `dev_team` wrapper

## Practical Rule

Do not start Slice A before Slice 0 is materially complete.

The shell can be small, but the closeout substrate it depends on must be trustworthy first.
