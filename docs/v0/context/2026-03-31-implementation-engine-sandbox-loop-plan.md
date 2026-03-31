# Implementation Engine Sandbox Loop Plan

Date: 2026-03-31
Status: active sandbox-only experiment plan

## Why This Exists

The first loop-convergence matrix answered the weak-fixture question:

- grouped review is much faster than the live ARB pre-board path
- shrinking the active set saves more time
- learning does not belong in the default inner loop yet

It did not answer the stronger question:

- can a stronger near-production role draft converge in one to two cycles?

The next sandbox group therefore moves from the weak run-01 fixture to the current `implementation-engine` role draft.

## Latest Findings Carried Forward

1. The main reason the loop still takes more than one or two cycles is not reviewer ignorance.
   The sticky rules are cross-surface package issues that require the fixer to coordinate identity, scope, artifact matrix, terminal semantics, and history behavior in one pass.

2. `grouped-shrinking` is the current default candidate.
   It gave the best runtime outcome on the weak fixture and only trailed `per-rule-shrinking` by one residual finding.

3. The grouped path still has historically weak rule coverage.
   Across the first-pass and full-loop experiments, the grouped path most often left behind:
   - `ARB-006`
   - `ARB-011`
   - `ARB-013`
   - `ARB-015`
   - `ARB-016`
   - `ARB-019`
   - `ARB-022`

4. Learning should stay out of the default next group.
   The current goal is to test convergence on a stronger artifact, not to re-open a path that already lost on time, cost, and quality in the previous matrix.

## Fixture

Sandbox fixture:

- `tools/agent-role-builder/tests/fixtures/implementation-engine-role-draft/implementation-engine-role.md`

Important note:

- the source draft lives outside the sandbox at `tools/implementation-engine/role/implementation-engine-role.md`
- the sandbox fixture is a read-only copy
- there is no governed implementation-engine contract package yet
- the sandbox therefore carries a synthetic companion `contract-summary.json` so the loop harness can keep the same review shape without mutating production surfaces

## Group D Matrix

All scenarios in this group must run in true parallel.

### D1. Grouped full

- scenario: `group-d-grouped-full-implementation`
- purpose: baseline the stronger artifact against the previous Group A full-loop behavior

### D2. Grouped shrinking

- scenario: `group-d-grouped-shrinking-implementation`
- purpose: test whether the current production candidate still wins on the stronger artifact

### D3. Grouped shrinking plus targeted residual sweep

- scenario: `group-d-grouped-targeted-shrinking-implementation`
- purpose: keep the fast grouped path, but move the historically weak rules into focused per-rule review every cycle
- targeted rules:
  - `ARB-006`
  - `ARB-011`
  - `ARB-013`
  - `ARB-015`
  - `ARB-016`
  - `ARB-019`
  - `ARB-022`

### D4. Per-rule shrinking

- scenario: `group-d-per-rule-shrinking-implementation`
- purpose: quality control baseline for the stronger artifact

## Questions This Group Must Answer

1. Can the stronger implementation-engine role draft converge in `<= 2` cycles?
2. Does `grouped-shrinking` still beat the full grouped path on the stronger artifact?
3. Does the targeted residual sweep close the small quality gap without giving back too much time?
4. Does the quality fallback still need to be `per-rule-shrinking`, or can the hybrid grouped path replace it?

## KPI Priorities

Primary:

1. total wall-clock time
2. cycles to approval or cycle cap
3. final finding count
4. time spent in review
5. time spent in fix

Secondary:

1. total cost
2. review-side tokens
3. session reuse effectiveness

## Decision Trigger

If either grouped implementation scenario:

- converges in one to two cycles
- preserves near-per-rule quality
- and materially beats the current ARB pre-board timing

then that scenario becomes the leading non-ARB candidate for later production integration discussion.

## Live 001 Outcome

The first implementation-engine sandbox run answered the question clearly enough to narrow the next move.

Headline result:

- `group-d-grouped-shrinking-implementation` won

Measured outcome:

- approved in `17m 58.7s`
- approved in `3` cycles
- final findings `0`
- total cost `0.398785`

Comparison:

- grouped full also approved, but took `27m 15.9s`
- grouped targeted shrinking also approved, but took `30m 29.9s`
- per-rule shrinking hit `cycle_cap` after `40m 54.7s` with `3` findings left

Interpretation:

- the stronger fixture did not overturn the earlier conclusion
- `grouped-shrinking` remains the best default candidate
- the targeted hybrid did not justify its extra complexity in this slice
- the next sandbox bottleneck is still the fixer plus the missing governed companion contract package
