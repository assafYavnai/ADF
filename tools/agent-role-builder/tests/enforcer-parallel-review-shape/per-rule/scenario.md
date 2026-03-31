# Scenario: Per Rule

## Intent

Run one focused tester per rule against the locked run 01 artifact fixture.

## Instructions

- Use the locked fixture under `tools/agent-role-builder/tests/fixtures/run01-role-artifact/`.
- Do not modify the fixture.
- Assign exactly one tester to each active rule in `tools/agent-role-builder/rulebook.json`.
- Each tester may only evaluate its assigned rule.
- Each tester returns:
  - pass/fail for that rule
  - finding text
  - severity
  - exact evidence location
  - no fix
- A single consolidator merges all tester outputs into one normalized review package.

## Shared Controls

- Same baseline artifact as the grouped scenario
- Same model/provider choice as the grouped scenario unless this becomes a separate model experiment
- Same KPI model
- Same output file schema

## Hypothesis

This scenario may maximize specialization and traceability, but it risks losing on wall-clock time because of launch fan-out and merge overhead.

