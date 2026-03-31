# Implementation Engine Sandbox Loop Live 001

Date: 2026-03-31
Status: completed
Plan source: `docs/v0/context/2026-03-31-implementation-engine-sandbox-loop-plan.md`

## Scope

This run executed the next sandbox-only loop matrix against the stronger implementation-engine role draft fixture:

- `group-d-grouped-full-implementation`
- `group-d-grouped-shrinking-implementation`
- `group-d-grouped-targeted-shrinking-implementation`
- `group-d-per-rule-shrinking-implementation`

All 4 scenarios were launched in true parallel.

Fixture:

- `tools/agent-role-builder/tests/fixtures/implementation-engine-role-draft/implementation-engine-role.md`

Important constraint:

- the source role draft does not yet have a governed companion contract package
- the sandbox therefore used a synthetic `contract-summary.json`
- this matters for interpreting the remaining `ARB-006` / `ARB-021` findings in the per-rule path

## Result Table

| Scenario | Wall Time | Cycles | Initial Findings | Final Findings | Cost USD | Status |
|---|---:|---:|---:|---:|---:|---|
| `group-d-grouped-shrinking-implementation` | `17m 58.7s` | `3` | `11` | `0` | `0.398785` | `approved` |
| `group-d-grouped-full-implementation` | `27m 15.9s` | `4` | `9` | `0` | `0.693220` | `approved` |
| `group-d-grouped-targeted-shrinking-implementation` | `30m 29.9s` | `3` | `13` | `0` | `0.437735` | `approved` |
| `group-d-per-rule-shrinking-implementation` | `40m 54.7s` | `4` | `12` | `3` | `0.779805` | `cycle_cap` |

## Findings

1. `grouped-shrinking` remains the best default path on the stronger artifact.
   It approved in under 18 minutes, closed in 3 cycles, and beat every other variant on both time and total cost.

2. The stronger fixture still did not justify a targeted residual sweep.
   The grouped-targeted hybrid also approved in 3 cycles, but it was slower than plain grouped-shrinking by about 12.5 minutes and cost slightly more.

3. Full grouped review still works, but it pays for rechecking already-cleared areas.
   It approved cleanly, but needed 4 cycles and about 9.3 more minutes than grouped-shrinking.

4. Per-rule shrinking did not outperform the grouped winner on the stronger artifact.
   It hit the cycle cap with 3 residual findings still open and was the slowest and most expensive scenario.

5. The remaining per-rule blockers were not clearly higher-value semantic discoveries.
   Final residuals:
   - `ARB-006`
   - `ARB-007`
   - `ARB-021`

   Two of those are heavily influenced by the fact that the implementation-engine draft still lacks a governed companion contract package.

6. Fix time still dominates end-to-end runtime.
   Even on the winning path:
   - review time: `407,476 ms`
   - fix time: `671,177 ms`

   So the review-shape win is real, but fix-stage latency remains the biggest wall-clock share.

## Cycle Behavior

### Grouped shrinking

- Cycle 1: `11` findings
- Cycle 2: `2` findings
- Cycle 3: `0` findings -> approved

Sticky cycle-2 findings:

- `ARB-021`
- `ARB-006`

These cleared on the next pass.

### Grouped full

- Cycle 1: `9` findings
- Cycle 2: `2` findings
- Cycle 3: `2` findings
- Cycle 4: `0` findings -> approved

Sticky late findings were artifact-matrix classification issues:

- `ARB-003`
- `ARB-016`

### Grouped targeted shrinking

- Cycle 1: `13` findings
- Cycle 2: `1` finding
- Cycle 3: `0` findings -> approved

The final held-over issue was:

- `ARB-017`

This means the targeted rule set did not actually remove the last important blocker early enough to beat the plain grouped path.

### Per-rule shrinking

- Cycle 1: `12` findings
- Cycle 2: `5` findings
- Cycle 3: `3` findings
- Cycle 4: `3` findings -> cycle cap

Final residuals:

- `ARB-006`
- `ARB-007`
- `ARB-021`

## Interpretation

This run changes the decision quality in an important way:

- the original weak-fixture experiments showed grouped review was faster
- this stronger-fixture run shows grouped-shrinking is not only faster, it is also the only clearly practical default path

The hybrid targeted sweep did not earn its complexity in this slice.

That means the current evidence now points to:

- default candidate: `grouped-shrinking`
- hold the hybrid path as an optional future experiment, not the next implementation default
- keep per-rule shrinking only as a stress or audit path until the missing governed contract package exists

## What This Means Before Any Live ARB Change

1. The next non-ARB improvement target is still the fixer, not the reviewer.
2. The implementation-engine role draft is now strong enough for the grouped-shrinking loop to approve it inside the sandbox.
3. The missing governed companion contract package is now a real blocker for quality interpretation on the per-rule path.
4. The next sandbox question should be:
   - can the same grouped-shrinking loop converge the implementation-engine role plus a real contract draft together?

## Recommended Next Sandbox Step

Do not change live ARB yet.

Instead:

1. draft the implementation-engine contract inside the sandbox
2. rerun the grouped-shrinking path against the role + contract pair
3. measure whether `ARB-006` / `ARB-021` disappear once the artifact stops relying on the synthetic contract shadow
