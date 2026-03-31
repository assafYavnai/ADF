# ARB Enforcer Flow Test Plan

## Overview

This test plan evaluates one specific optimization question before changing the governed `agent-role-builder` flow:

Should the `rules-compliance-enforcer` review the artifact as:

1. one focused tester per rule, or
2. one focused tester per relevance group of rules?

The goal is to reduce wall-clock time without losing review quality.

This plan uses one locked baseline artifact so that only the scenario shape changes between tests. The first baseline is the original run 01 draft artifact copied into:

- `tools/agent-role-builder/tests/fixtures/run01-role-artifact/`

That fixture is read-only and must not be edited during experiments.

## What We Are Trying To Achieve

We want a faster pre-board enforcer lane that still catches the same important issues the board would care about.

The intended long-term direction is:

1. implementor produces or revises the artifact
2. enforcer reviews it and returns findings only
3. implementor fixes those findings
4. board reviews the improved artifact
5. if the board introduces new rules, re-run only the relevant enforcer checks

This test plan does not lock that architecture yet. It tests the first major fork in that design: review shape.

## Goals

Primary goals:

- reduce total wall-clock time
- reduce time to first useful findings
- preserve or improve artifact-quality signal
- preserve reproducibility across scenarios

Secondary goals:

- measure merge overhead for many focused testers
- understand whether grouping rules is worth the extra setup
- capture evidence that can guide later model-selection experiments

## Primary KPI Policy

For this experiment family, time is the primary optimization target.

Priority order:

1. wall-clock time
2. time to first useful finding
3. blocking/major issue coverage
4. total unique issue coverage
5. merge overhead
6. token and cost economics

Token and cost still matter, but they are not the deciding KPI for this round.

## Common Controls

Every scenario in this experiment must keep these fixed:

- same baseline fixture
- same rulebook snapshot
- same provider/model choice unless the experiment explicitly tests model variation
- same output schema
- same KPI schema
- same evidence-only behavior
- no artifact fixing by enforcer testers
- no use of board-review output as additional context during the enforcer run

## Baseline Fixture

Fixture root:

- `tools/agent-role-builder/tests/fixtures/run01-role-artifact/`

Locked fixture files:

- `agent-role-builder-role.md`
- `agent-role-builder-role-contract.json`

The copied files are read-only on disk. Their source and hashes are recorded in the fixture manifest.

## Experiment Slug

Initial experiment goal slug:

- `enforcer-parallel-review-shape`

This slug compares two scenario shapes only:

1. `per-rule`
2. `grouped-by-relevance`

## Scenario Definitions

### Scenario A: `per-rule`

Hypothesis:

- Maximum specialization may improve issue precision, but coordination and merge overhead may dominate total runtime.

Shape:

- one tester per rule
- each tester checks only its assigned rule
- each tester returns verdict plus evidence only
- one consolidator merges results into a single enforcer review package

Expected strengths:

- narrow prompts
- clean rule ownership
- strong traceability from finding to rule

Expected risks:

- too many sub-agent launches
- duplicate context transfer
- expensive merge and dedupe work

### Scenario B: `grouped-by-relevance`

Hypothesis:

- Grouping related rules may retain enough specialization while reducing launch overhead and merge cost.

Shape:

- one tester per rule group
- each tester checks only the rules in its group
- each tester returns verdict plus evidence only
- one consolidator merges results into a single enforcer review package

Expected strengths:

- lower fan-out
- lower merge overhead
- easier prompt management

Expected risks:

- weaker specialization than one-rule-per-tester
- group definitions may require ongoing maintenance

## Initial Relevance Groups

The current rulebook has no built-in family/category field. For this experiment only, use an external grouping manifest rather than changing the canonical rulebook.

Initial groups:

1. `authority-and-governance`
2. `scope-and-identity`
3. `workflow-rounds-and-terminals`
4. `artifact-lifecycle-and-outputs`
5. `validation-and-current-vs-target`

This grouping is experimental only. It is not yet a platform taxonomy.

## Output Requirements

Each scenario run must write results under its own scenario folder:

- `tools/agent-role-builder/tests/enforcer-parallel-review-shape/per-rule/results/<run-id>/`
- `tools/agent-role-builder/tests/enforcer-parallel-review-shape/grouped-by-relevance/results/<run-id>/`

Required result files:

- `run-manifest.json`
- `raw-findings.json`
- `normalized-findings.json`
- `kpi-summary.json`
- `analysis.md`

Recommended additional files:

- `merge-log.md`
- `reviewer-prompts/`
- `reviewer-outputs/`

## Evaluation Method

After both scenarios complete:

1. normalize findings to a common schema
2. dedupe overlapping findings
3. compare blocking and major issue coverage
4. compare total unique useful findings
5. compare wall-clock time and time to first finding
6. compare merge overhead
7. compare token and cost only as secondary economics

## Success Criteria

The winner is not just the fastest scenario.

A scenario wins if it:

- materially reduces wall-clock time, and
- does not lose important blocking/major coverage, and
- does not introduce unacceptable merge overhead or analysis noise

If the fastest scenario loses important coverage, it is not the winner.

## Follow-On Experiments

If one of the two shapes wins, later experiments can test:

- model selection per scenario shape
- session reuse for enforcer reviewers
- re-check only failed or newly-added rules after fixes
- moving `self-learning-engine` off the critical path
- deciding whether post-fix work goes back through enforcer before board review

