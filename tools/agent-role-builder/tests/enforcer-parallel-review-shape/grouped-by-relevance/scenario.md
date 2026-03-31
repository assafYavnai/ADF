# Scenario: Grouped By Relevance

## Intent

Run one focused tester per relevance group against the locked run 01 artifact fixture.

## Instructions

- Use the locked fixture under `tools/agent-role-builder/tests/fixtures/run01-role-artifact/`.
- Do not modify the fixture.
- Use the grouping manifest in `groups.json`.
- Assign one tester to each rule group.
- Each tester may evaluate only the rules in its assigned group.
- Each tester returns:
  - pass/fail per rule
  - finding text
  - severity
  - exact evidence location
  - no fix
- A single consolidator merges all tester outputs into one normalized review package.

## Shared Controls

- Same baseline artifact as the per-rule scenario
- Same model/provider choice as the per-rule scenario unless this becomes a separate model experiment
- Same KPI model
- Same output file schema

## Hypothesis

This scenario may retain enough specialization while reducing total launch count and merge overhead, making it a better wall-clock candidate.

