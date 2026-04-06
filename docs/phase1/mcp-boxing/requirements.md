# ADF Phase 1 MCP Boxing Requirements

Status: active requirements baseline  
Last updated: 2026-04-06  
Scope: `docs/phase1/mcp-boxing/`

## Purpose

This file records high-level requirements that must shape the `dev_team` boxed department model.

Some requirements are immediate Step 1 requirements.
Others are later required capabilities that must be preserved in the architecture even when they are not implemented yet.

## Requirement R-001 — Dual approval / rejection model

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
Only then may the slice move into final completion status and governed merge into master / main and origin.

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

## Requirement R-002 — Process-improvement background function

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

## Practical Rule

Step-specific slice contracts may narrow delivery, but they must not violate or silently weaken these requirements.
