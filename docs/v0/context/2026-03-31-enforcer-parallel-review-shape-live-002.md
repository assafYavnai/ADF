# Enforcer Parallel Review Shape - Live 002

## Summary

The first real experiment run compared two enforcer review shapes against the locked run 01 artifact fixture:

- `per-rule`
- `grouped-by-relevance`

Both scenarios used the same:

- locked baseline fixture
- rulebook snapshot
- provider/model family
- KPI schema
- evidence-only behavior

## Result

`grouped-by-relevance` won on runtime and cost, but it did not fully match `per-rule` coverage.

## KPI Comparison

### `per-rule`

- wall clock: `325746 ms`
- time to first useful finding: `18897 ms`
- tester count: `24`
- tester failures: `0`
- findings: `24`
- blocking: `1`
- major: `21`
- minor: `2`
- estimated cost: `$0.586835`

### `grouped-by-relevance`

- wall clock: `139930 ms`
- time to first useful finding: `44068 ms`
- tester count: `5`
- tester failures: `0`
- findings: `20`
- blocking: `1`
- major: `17`
- minor: `2`
- estimated cost: `$0.187395`

## Coverage Delta

Both scenarios found the same blocking issue:

- `ARB-016`

`grouped-by-relevance` missed these rule findings that `per-rule` caught:

- `ARB-011`
- `ARB-013`
- `ARB-015`
- `ARB-022`

`grouped-by-relevance` found no rule that `per-rule` missed.

## Interpretation

What this suggests:

- Grouping rules is materially faster.
- Grouping rules is materially cheaper.
- Grouping rules preserved the top blocking signal.
- Grouping rules lost some narrower coverage, especially around:
  - carry-forward / finding-ID mechanics
  - decision-history preservation mechanics
  - all-states artifact guard verification
  - scope-polarity cleanliness

So the grouped approach is promising, but not ready to replace the per-rule shape without another tightening pass.

## Recommended Next Experiment

Keep `grouped-by-relevance` as the current speed leader, then test one refinement:

1. keep grouped review as the main path
2. add a cheap targeted second pass only for rules currently missed by grouped review:
   - `ARB-011`
   - `ARB-013`
   - `ARB-015`
   - `ARB-022`

If that preserves the grouped runtime advantage while restoring coverage, it is likely the best next enforcer design direction.

## Artifact Paths

- `tools/agent-role-builder/tests/enforcer-parallel-review-shape/per-rule/results/live-002/`
- `tools/agent-role-builder/tests/enforcer-parallel-review-shape/grouped-by-relevance/results/live-002/`

