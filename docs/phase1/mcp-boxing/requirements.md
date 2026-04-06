# ADF Phase 1 MCP Boxing Requirements

Status: active requirements baseline
Last updated: 2026-04-06
Owner: COO
Scope: `docs/phase1/mcp-boxing/`

## Initiative Requirements

- `dev_team` is the first boxed R&D / implementation department inside ADF Phase 1.
- `dev_team` becomes the intended front door for governed implementation work, even while later slices still reuse existing internal engines behind that boundary.
- The boxed design must preserve worktree-only execution, governed review before closeout, governed merge before completion truth, durable run state, resumability, truthful audit, and safe parallel execution.
- The department shape must support multiple implementation lanes and review cycles in parallel.
- The department must expose truthful status or progress to the invoker without requiring direct control of internal worker lanes.
- The shell must stay compatible with later binary-backed packaging and later CTO control above `dev_team`.
- Repo branch language for this initiative must use `main`, not `master`.

## Step 1 Boundaries

- Step 1 is bootstrap-only and must not broaden into full downstream implementation migration.
- Step 1 establishes the bounded department surface, initial state model, initial API routes, audit identity baseline, and documentation routing needed to make `dev_team` real.
- Step 1 may reuse current governed implementation engines as future internal machinery, but it must not rewrite or retire those engines wholesale.

## Requirement R-001 - Dual approval / rejection model

Status: active Step 1 requirement

`dev_team` must support two distinct approval gates:

1. human testing approval, when human testing is required
2. invoker approval

### Meaning

The department must not treat rejection as one generic event.

It must be able to:

- stop cleanly at either gate
- record which gate rejected
- preserve the exact implementation state at the point of rejection
- resume from the correct downstream point
- route the fix back through the appropriate department flow
- preserve audit truth for the rejection and resumed path

### Important completion rule

Merge into the main line must not happen merely because code implementation and review completed.

The invoker must receive a detailed completion report and explicitly approve that the slice is complete.
Only then may the slice move into final completion status and governed merge into `main` and `origin/main`.

### Minimum detailed completion report contents

The final invoker-facing report must include at minimum:

- commits produced
- steps taken
- operation summary
- review cycle count
- KPI summary
- current status of the slice
- explicit approval request

### Architectural implication

This requirement is Step 1 scope because the boxed department must be designed from the beginning to understand:

- multiple approval gates
- gate-specific rejection handling
- gate-specific resume points
- invoker approval as the final completion authorization before merge

## Requirement R-002 - Process-improvement background function

Status: required later capability

After enough implementation lanes complete, ADF must be able to run a background process that analyzes historical implementation delivery and identifies avoidable failure points.

This function may later exist as a dedicated team such as an R&D audit team or similar quality-improvement function.

### Goal

Improve the implementation process itself.

Examples:

- improve implementor prompts
- improve what the review team checks for
- improve preflight and slice setup quality
- improve default tests and verification strategy
- reduce repeated failure patterns
- shorten review-fix cycles

### Primary analysis sources

- review-cycle reports
- KPIs
- git commits

### Additional required analysis sources

- implementation briefs and contracts
- pushback artifacts
- completion summaries
- machine verification results
- human testing notes
- invoker rejection comments
- merge outcomes and merge blockers
- reopen and retry history
- lane timing and stage timing data
- status or event logs
- defect classes found by reviewers
- regressions detected after prior approval states

### Architectural implication

This function is not Step 1 implementation scope, but it is a must-have future capability for `dev_team`.

That means the department architecture should preserve the audit, KPI, artifact, timing, and lifecycle data needed for this later analysis instead of treating them as optional noise.

## Slice 01 Link

- Slice 01 is the bootstrap slice for this initiative.
- Slice-specific mandatory requirements live in `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/requirements.md`.

## Source Authorities

- `docs/phase1/mcp-boxing/scope.md`
- `docs/phase1/mcp-boxing/step1.md`
- `docs/VISION.md`
- `docs/PHASE1_VISION.md`
- `docs/PHASE1_MASTER_PLAN.md`
- `docs/phase1/adf-phase1-current-gap-closure-plan.md`

## Practical Rule

Step-specific slice contracts may narrow delivery, but they must not violate or silently weaken these requirements.
