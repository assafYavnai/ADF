# Grouped Shrinking Readiness Plan

Date: 2026-03-31
Status: active sandbox-only readiness matrix

## Goal

Freeze `grouped-shrinking` as the chosen pre-board review shape unless the final readiness checks expose a material correctness or stability gap.

This phase does not change live ARB.

## Why This Exists

The previous sandbox matrices already decided the shape question strongly enough:

- `grouped-shrinking` is the best default candidate
- targeted grouped review did not justify itself
- per-rule shrinking is no longer the practical default path

The remaining unknowns are now readiness questions:

1. Does the chosen path stay sound when the artifact is evaluated as a real role + contract pair?
2. Does a final full sanity review expose blind spots after shrinking?
3. Does a forced interrupt/resume path preserve continuity and session economics?
4. Is the behavior repeatable across multiple runs?

## Fixture

Sandbox role+contract pair:

- `tools/agent-role-builder/tests/fixtures/implementation-engine-role-pair/implementation-engine-role.md`
- `tools/agent-role-builder/tests/fixtures/implementation-engine-role-pair/implementation-engine-role-contract.json`

Important:

- the role file is a read-only copy of the current `tools/implementation-engine/role/implementation-engine-role.md`
- the contract is a sandbox draft companion, not a live governed contract
- the readiness runner treats the pair as one bundle so the fixer can revise both surfaces during the loop

## Scenarios

All scenarios use:

- grouped-by-relevance review
- shrinking active rule set during normal cycles
- the same shared invoker
- the same shared `rules-compliance-enforcer`
- the same grouped rule manifest

### Scenario 1. Pair

- slug: `pair`
- normal grouped-shrinking loop
- no forced interrupt
- no final full sanity review

### Scenario 2. Pair + sanity

- slug: `pair-sanity`
- normal grouped-shrinking loop
- after approval, run one final full grouped sanity review across all rules

### Scenario 3. Pair + resume

- slug: `pair-resume`
- stop after cycle 1
- resume from the saved checkpoint using the same run id
- no final full sanity review

### Scenario 4. Pair + resume + sanity

- slug: `pair-resume-sanity`
- stop after cycle 1
- resume from the saved checkpoint using the same run id
- after approval, run one final full grouped sanity review across all rules

## Execution Shape

Run the 4 scenarios in true parallel inside each batch.

Repeat the batch 3 times:

- `batch-001`
- `batch-002`
- `batch-003`

This gives 12 total runs without forcing all 12 into one fully contended batch.

## KPIs

Primary:

1. approval or failure status
2. final-sanity pass/fail
3. cycles completed
4. wall-clock time
5. final finding count

Secondary:

1. review time
2. fix time
3. total estimated cost
4. session fresh vs resumed counts

## Decision Rule

`grouped-shrinking` remains the frozen default if:

- the pair scenario is stable
- the final sanity sweep does not reopen material findings
- the resume path preserves continuity without degrading outcomes
- the three repeated batches stay directionally consistent

If those checks pass, the next step is implementation, not more review-shape testing.
