# Controller High-Level Flow

## Purpose
The controller is the control plane for every user turn.

It is not the COO identity.
It is the deterministic orchestrator around the COO.

## Core idea
The user still experiences one continuous COO.
Operationally, each turn is governed.

## High-level flow chart

```text
User input
  ↓
Controller ingress
  ↓
Load current state
  - COO role
  - current contracts
  - active summary
  - open loops
  - tool registry
  - rule versions
  ↓
Intent classification
  - bounded classifier model call
  ↓
Select workflow
  - direct COO response
  - tool path
  - specialist path
  - clarification / pushback
  ↓
Retrieve scoped context
  - only what this turn needs
  ↓
Execute selected path
  - COO call and/or tool/specialist call
  ↓
Validate outputs
  - contracts
  - required artifacts
  - status correctness
  - approval boundaries
  ↓
Commit state
  - summary
  - open loops
  - minutes/context
  - audit/logs
  - resume/session state
  ↓
Return response
```

## Important operational principles

### 1. Input first goes to the controller
The raw user prompt should not hit the COO reasoning layer first.

### 2. Intent classification is model-assisted
A script alone is not enough for broad natural-language intent classification.
A small bounded model call is usually needed.

### 3. Controller is still deterministic
Even if it invokes a classifier model, the controller itself is not a drifting long-running agent.
It is a service/orchestrator.

### 4. Fresh model calls
The recommended pattern is:
- fresh classifier call per turn
- fresh COO call per turn
- fresh specialist calls when needed

### 5. Externalized state
Continuity comes from:
- contracts
- summaries
- open loops
- Brain
- canonical artifacts
not from trusting the raw running session forever

## What is still open
We have **not** yet finalized:
- exact state artifacts for the controller
- exact classifier output schema
- exact commit/closeout schema
- exact session model
Those are next-layer design tasks.
