# ADF Phase 1 MCP Boxing Step 1

Status: proposed baseline step  
Last updated: 2026-04-06  
Owner: COO  
Step name: establish `dev_team` as the boxed implementation front door

## Purpose

This step establishes `dev_team` as the new authoritative front door for governed implementation work inside ADF.

This is a step, not a new phase.

It lives under ADF Phase 1 and exists to begin boxing the implementation department without trying to complete the whole company stack at once.

## Why This Step Comes First

The main missing piece is no longer raw implementation capability.

ADF already has substantial governed implementation machinery.

The missing piece is authority shape.

Right now, implementation behavior is still spread across open skill surfaces.

This first step fixes that by introducing one bounded department entry path.

## Step Goal

At the end of this step:

1. `dev_team` exists as the official R&D / implementation department surface
2. new governed implementation work can enter through `dev_team`
3. implementation, review, and merge are treated as one department-level route
4. the current engines are reused behind the department boundary rather than re-invented
5. the system is positioned for later hard boxing, skill retirement, and binary packaging

## What This Step Includes

### 1. Create `dev_team` as the new front door

`dev_team` is introduced as the bounded department entry point for implementation work.

### 2. Define the first public department contract

This first contract should stay small and stable.

It is expected to center around:

- settings
- init
- implement
- status
- resume
- cancel

### 3. Route current governed engines behind `dev_team`

The existing implementation, review, and merge behavior is reused behind the department surface.

This step is not about rewriting everything.

It is about making `dev_team` the new authority surface.

### 4. Preserve current governed implementation invariants

This step must preserve:

- worktree-only implementation
- governed review
- governed merge
- truthful completion
- durable run state
- resumability
- audit trail

### 5. Establish department-owned progress visibility

The invoker must be able to understand where the implementation lane currently stands.

This step should establish a clean department-level progress/status surface.

### 6. Support multiple lanes safely

`dev_team` must be shaped from the beginning as a department that can support more than one implementation lane at a time.

## What This Step Does Not Yet Require

This step does not require all final-state changes to land immediately.

It does not yet require:

- full removal of legacy public skills
- final hard blocking of all old routes
- Brain conversion to binary
- final CTO-controlled orchestration
- final packaging maturity for every boxed component in ADF

Those belong to later steps.

## Deliverable Shape

This step should leave behind:

1. a real `dev_team` department entry surface
2. a clear mapping from current implementation/review/merge behavior into that department
3. a documented department contract for invokers
4. a visible progress/status model for active lanes
5. a baseline that can be cut into narrower implementation slices

## Step Success Criteria

This step is successful when the following are true:

- `dev_team` is the intended front door for governed implementation work
- an implementation lane can run through the department shape rather than requiring direct raw-skill usage
- current route integrity is preserved
- worktree isolation remains true
- auditability remains true
- the architecture is clearly positioned for later hard boxing

## Immediate Follow-On Direction

After this step is accepted, the next slices should be cut to:

1. harden `dev_team` from wrapper to stronger boxed authority
2. remove or block direct operational use of old skills
3. package `dev_team` as a stable binary-backed MCP component
4. later apply the same pattern to Brain

## Practical Rule

This file defines the first delivery step only.

It should stay high level and should be used as the parent step authority for the narrower slices that will follow.
