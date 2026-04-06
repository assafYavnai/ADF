# ADF Phase 1 MCP Boxing Scope

Status: proposed baseline scope  
Last updated: 2026-04-06  
Owner: COO  
Primary department target: `dev_team`

## Purpose

This document defines the full scope of the MCP boxing initiative under ADF Phase 1.

The goal is to move ADF implementation from an open skill-based operating model into a boxed internal department model.

The first department being boxed is `dev_team`, which represents the R&D / implementation department.

## Why This Work Exists

Today, core governed implementation behavior already exists across repo-local skills such as:

- `implement-plan`
- `review-cycle`
- `merge-queue`

That behavior is already strong in many areas, but it is still exposed as open operational surfaces inside the repo.

This creates three problems:

1. agents can bypass the intended governed route
2. internal workflow components are still treated as first-class callable surfaces
3. the implementation function is not yet boxed as a company department

This initiative exists to close that gap.

## Phase 1 Mission Fit

This work is inside ADF Phase 1 because it directly strengthens the implementation startup.

It improves:

- governed implementation admission and execution
- route integrity
- operational state ownership
- parallel execution safety
- audited closeout
- company-function boxing inside ADF

This is not a later-company side quest.

It is a direct strengthening of the Phase 1 implementation startup.

## End-State Target

The end-state of this initiative is:

1. `dev_team` is a boxed internal department
2. `dev_team` is exposed through an MCP surface
3. `dev_team` is packaged as a binary-backed component
4. `dev_team` owns the full governed implementation lane:
   - implementation
   - review
   - merge
5. all implementation work runs through governed worktrees
6. `dev_team` supports multiple implementation lanes and review cycles in parallel
7. `dev_team` provides live progress visibility to the invoker
8. `dev_team` writes a durable audit trail for every lane
9. raw repo-local skills stop being the public operating surface
10. later, `dev_team` is managed by CTO rather than being called directly by higher-level actors

## High-Level Department Model

### Long-term company position

- COO shapes and routes work
- CTO will later manage technical admission, balancing, and downstream execution
- `dev_team` is the boxed R&D / implementation department

### Immediate operational position

In the near term, `dev_team` may still be invoked directly while the company stack is being boxed.

That direct invocation is transitional.

The long-term goal is that higher-level actors talk to CTO, and CTO talks to `dev_team`.

## Full Scope Of This Initiative

The full initiative scope includes all of the following.

### A. Create `dev_team` as a new boxed department surface

`dev_team` becomes the new authoritative front door for governed implementation work.

Its public surface is expected to center around bounded department actions such as:

- settings
- init
- implement
- status
- resume
- cancel

### B. Re-house current governed implementation engines behind `dev_team`

The current implementation, review, and merge engines become internal department machinery rather than independent public workflow surfaces.

This includes existing behavior currently carried by:

- `implement-plan`
- `review-cycle`
- `merge-queue`

### C. Preserve and strengthen current route invariants

The boxed department must preserve these non-negotiables:

- worktree-only execution
- governed review before closeout
- governed merge before completion truth
- durable run state
- resumability
- truthful audit trail
- safe parallel execution

### D. Add department-level progress visibility

`dev_team` must expose ongoing status so the invoker can track progress without directly controlling the internal worker lanes.

### E. Add department-level operational KPIs

The department must provide production-level visibility into efficiency and operational health.

Examples include:

- start latency
- review cycle count
- rejection rate
- merge-ready time
- merge completion time
- blocked lane rate
- retry / reopen rate
- lane utilization

### F. Box documentation and usage routing

ADF documentation must teach the department entry path rather than the raw internal implementation tree.

This includes:

- keeping `AGENTS.md` slim
- adding `MCP.md` as the front-door operating guide
- teaching Brain + `dev_team` usage without exposing implementation internals as the intended route

### G. Remove raw-skill operating behavior from the public surface

Over time, skills such as `implement-plan`, `review-cycle`, and similar operational routes must stop being directly used as public execution surfaces.

### H. Convert Brain into the same boxed pattern later

After `dev_team` is established, Brain should be boxed using the same pattern:

- MCP surface
- binary-backed packaging
- boxed operational role inside ADF

## Out Of Scope For This Initiative

The following are not the goal of this initiative:

- full virtual-company completion
- final CTO queue intelligence and balancing logic
- non-R&D department boxing
- broad company reorganization beyond what is required to box the implementation department cleanly

## Recommended Program Shape

This initiative should be delivered in ordered steps, not as one giant cutover.

At a minimum:

1. establish `dev_team` as the new authoritative front door
2. prove full governed implementation through `dev_team`
3. retire or hard-block old public operational skills
4. package `dev_team` as a stable binary-backed MCP component
5. later apply the same boxing pattern to Brain

## Current Step Breakdown

The first delivery step for this initiative is defined in:

- `docs/phase1/mcp-boxing/step1.md`

Additional steps will be cut from this scope after the baseline is reviewed and accepted.

## Practical Rule

This scope file is the authority for the full initiative.

Individual step files must narrow delivery without weakening the boxed end-state.
