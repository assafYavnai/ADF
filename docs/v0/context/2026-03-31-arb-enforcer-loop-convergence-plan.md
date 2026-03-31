# ARB Enforcer Loop Convergence Plan

## Overview

This experiment family moves beyond first-pass findings.

The new goal is to measure full non-governed `review -> fix -> review` convergence loops that reuse the same core engines as `agent-role-builder`, but without the governance layer.

The baseline artifact remains locked:

- `tools/agent-role-builder/tests/fixtures/run01-role-artifact/`

Every scenario in this plan must start from that same baseline.

## Why This Exists

The first experiment proved only first-pass review economics.

It did not prove:

- time to convergence
- time to approval
- whether grouped review stays better once fixes are included
- whether shrinking the active rule set preserves quality
- whether learning improves convergence enough to justify its overhead

This plan exists to answer those questions.

## Core Rules

1. use the same core engines as ARB where possible
2. do not build toy review/fix logic for the benchmark
3. exclude the governance layer from the test harness
4. keep all compared scenarios on the same baseline fixture and KPI model
5. use provider session resume across cycles
6. run the compared scenarios in parallel
7. maximize shared reusable components between scenarios

## Shared Runtime Model

The loop test harness must reuse:

- the real `rules-compliance-enforcer` for the fix step
- the real `self-learning-engine` when learning is enabled
- the shared LLM invoker
- persisted session handles between cycles
- one common KPI schema

If ARB logic is not directly reusable, extract or mirror the relevant core logic closely enough that results stay comparable.

## Optimization Matrix

The decision matrix remains:

1. time
2. cost
3. quality

This experiment family should help determine whether runtime optimization profiles should exist:

- `speed`
- `cost`
- `quality`

No permanent implementation decision is frozen yet.

## Group Definitions

### Group A

Goal:

- compare full loop convergence time against the current live lane

Variants:

- `per-rule-full`
- `grouped-full`

Rules:

- every cycle re-runs the full active review shape
- no shrinking active set
- no learning hook

Primary question:

- can the full loop beat the current roughly `45 min` live-path cost materially?

### Group B

Goal:

- measure quality retention when effort is reduced

Variants:

- `per-rule-shrinking`
- `grouped-shrinking`

Rules:

- once a rule is approved, remove it from the normal re-review set
- keep unresolved rules in the active set
- record the quality delta against Group A

Primary question:

- how much effort is saved, and what quality is lost, compared with the full-loop baseline?

### Group C

Goal:

- measure whether learning improves convergence enough to justify its overhead

Variants:

- `per-rule-learning`
- `grouped-learning`

Rules:

- use the same full-loop engine as Group A
- do not trigger learning on the first failed review
- only after the second failed review, run `self-learning-engine`
- proposed rules are applied only to the local experiment rulebook, never to the canonical component rulebook

Primary question:

- can learning improve the loop once the obvious first-pass findings have already been fixed?

## Parallel Execution Policy

All groups and variants should run in parallel as long as shared infrastructure permits it.

Current target set:

- Group A `per-rule-full`
- Group A `grouped-full`
- Group B `per-rule-shrinking`
- Group B `grouped-shrinking`
- Group C `per-rule-learning`
- Group C `grouped-learning`

## Resume Requirement

Session resume is mandatory for this experiment family.

The harness must:

- persist session handles by slot
- reuse those handles across cycles
- record fresh/resumed/replaced counts
- make session economics visible in result artifacts

## Result Requirements

Each scenario must write:

- `run-manifest.json`
- `progress.log`
- `session-registry.json`
- `kpi-summary.json`
- `analysis.md`
- `current-artifact.md`
- `cycles/cycle-<n>/...`

Per cycle:

- review task outputs
- normalized findings
- fix output
- artifact after fix
- optional learning output
- cycle summary

## Main KPIs

For these loop experiments, the primary KPIs are:

1. total wall-clock time to approval or cycle cap
2. cycles completed
3. time to first useful findings
4. time spent in review
5. time spent in fix
6. time spent in learning
7. final approval state
8. final finding count
9. estimated cost
10. session resume effectiveness

## Expected Decisions From This Phase

This phase should tell us:

- whether grouped review remains the best speed path once fixing is included
- whether shrinking active rules is worth the quality tradeoff
- whether learning belongs in the loop and at what point
- whether the runtime should expose explicit optimization profiles

## Live 002 Outcome

The first `live-001` attempt proved that realistic loop testing could not keep embedding the full artifact and contract inline for every reviewer call.

Failure:

- Windows/MSYS Codex CLI hit `Argument list too long`

Required fix:

- write per-task reviewer bundles to disk
- point the prompt at the artifact file, compact contract summary, and assigned-rules file
- keep all scenario variants running in parallel

After that fix, `live-002` completed the full 6-scenario matrix.

Headline result:

- Group A:
  - `grouped-full` beat `per-rule-full` on both time and final findings
- Group B:
  - `grouped-shrinking` was the fastest and cheapest overall
  - `per-rule-shrinking` kept a small quality edge
- Group C:
  - learning did not justify its overhead in this slice

Current interpretation:

- default production candidate: `grouped-shrinking`
- quality profile candidate: `per-rule-shrinking`
- learning remains out of the default loop until later evidence changes that
