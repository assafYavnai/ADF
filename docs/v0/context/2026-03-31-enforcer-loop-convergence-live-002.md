# Enforcer Loop Convergence Live 002

Date: 2026-03-31
Status: completed loop matrix after prompt-size fix

## Scope

This run executed the full `review -> fix -> review` loop matrix for:

- Group A: full re-review each cycle
- Group B: shrinking active review set
- Group C: Group A loop plus `self-learning-engine` after the second failed review

All 6 scenarios ran in parallel against the locked run-01 artifact fixture.

## Critical Fix Validated

`live-001` failed because reviewer prompts embedded the artifact and contract inline, which tripped the Windows/MSYS Codex CLI limit:

- `Argument list too long`

For `live-002`, the loop harness was changed to use file-backed reviewer bundles:

- artifact markdown written to disk
- compact contract summary written to disk
- assigned rules written to disk
- prompt contains file references instead of the full payload

Result:

- no scenario failed with `Argument list too long`
- all 6 scenarios completed their bounded runs

## Result Table

| Scenario | Wall Time | Total Cost USD | Initial Findings | Final Findings | Status |
|---|---:|---:|---:|---:|---|
| `group-a-grouped-full` | `26m 19.9s` | `0.637180` | `23` | `5` | `cycle_cap` |
| `group-a-per-rule-full` | `39m 29.6s` | `0.914825` | `23` | `10` | `cycle_cap` |
| `group-b-grouped-shrinking` | `23m 36.7s` | `0.578140` | `23` | `4` | `cycle_cap` |
| `group-b-per-rule-shrinking` | `30m 31.0s` | `0.734305` | `24` | `3` | `cycle_cap` |
| `group-c-grouped-learning` | `34m 03.5s` | `0.674590` | `22` | `4` | `cycle_cap` |
| `group-c-per-rule-learning` | `42m 21.6s` | `1.006565` | `24` | `7` | `cycle_cap` |

## Residual Rule Sets

- `group-a-grouped-full`: `ARB-019`, `ARB-006`, `ARB-018`, `ARB-008`, `ARB-016`
- `group-a-per-rule-full`: `ARB-002`, `ARB-003`, `ARB-006`, `ARB-008`, `ARB-016`, `ARB-017`, `ARB-018`, `ARB-019`, `ARB-021`, `ARB-022`
- `group-b-grouped-shrinking`: `ARB-006`, `ARB-018`, `ARB-008`, `ARB-016`
- `group-b-per-rule-shrinking`: `ARB-008`, `ARB-018`, `ARB-021`
- `group-c-grouped-learning`: `ARB-006`, `ARB-018`, `ARB-008`, `ARB-016`
- `group-c-per-rule-learning`: `ARB-003`, `ARB-006`, `ARB-008`, `ARB-016`, `ARB-018`, `ARB-021`, `ARB-022`

## Findings

1. The prompt-size fix is mandatory.
   File-backed reviewer bundles are now proven necessary on Windows Codex CLI for loop testing at realistic artifact size.

2. `grouped-full` beat `per-rule-full` on both time and quality.
   This is stronger than the first-pass-only experiment and is the most important end-to-end result from `live-002`.

3. `grouped-shrinking` is the best speed/cost candidate.
   It was the fastest completed scenario and the cheapest scenario overall.

4. `per-rule-shrinking` kept a slight quality edge over `grouped-shrinking`.
   The difference was small:
   `3` residual findings vs `4`.

5. Learning did not justify itself in this slice.
   - `grouped-learning` matched `grouped-shrinking` on final findings (`4`) but was slower and more expensive
   - `per-rule-learning` was slower, more expensive, and worse than `per-rule-shrinking`

6. The fix stage remains the dominant wall-time sink.
   Review-shape optimization matters, but fix-stage latency is still the largest share of end-to-end time.

7. The main remaining loop problem is fixer translation, not reviewer ignorance.
   The grouped path already finds enough to expose the core package gaps. The longer tail comes from getting the fixer to rewrite scope, identity, artifact-matrix, and terminal semantics coherently in one pass.

## Current Recommendation

For implementation direction today:

- `speed` / `cost` profile:
  - `grouped-shrinking`
- `quality` profile:
  - `per-rule-shrinking`

But the quality gap is small enough that the most pragmatic default is:

- adopt `grouped-shrinking` as the primary path
- add an optional targeted residual sweep for the few rules it misses

## Follow-Up

1. implement the loop-path prompt bundling pattern in the reusable core path
2. treat `grouped-shrinking` as the leading candidate for production integration
3. test a targeted residual sweep on top of `grouped-shrinking`
4. continue attacking fix-stage latency, because that is still the biggest runtime cost
5. move the next sandbox group onto the stronger `implementation-engine` role draft instead of repeating the weak run-01 fixture
