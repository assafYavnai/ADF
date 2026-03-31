# Enforcer Loop Convergence Tests

This experiment family measures full non-governed `review -> fix -> review` loops using the same core engines as `agent-role-builder` where possible.

Baseline fixture:

- `tools/agent-role-builder/tests/fixtures/run01-role-artifact/`
- `tools/agent-role-builder/tests/fixtures/implementation-engine-role-draft/`

Scenario groups:

- `group-a`
- `group-b`
- `group-c`
- `group-d`

Current expansion focus:

- `group-d` uses the stronger `implementation-engine` role draft fixture
- it compares grouped full review, grouped shrinking, grouped shrinking plus a targeted residual sweep, and per-rule shrinking
- the goal is to see whether the stronger artifact can converge in `<= 2` cycles and whether a hybrid grouped path can close the small remaining quality gap without giving up the large runtime gain
