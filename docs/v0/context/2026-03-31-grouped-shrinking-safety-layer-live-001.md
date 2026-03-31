# Grouped Shrinking Safety-Layer Batch

Date: 2026-03-31
Status: one sandbox batch completed

## Goal

Find the minimum retained safety layer that preserves most of the `grouped-shrinking` speed gain while preventing the final-sanity reopen pattern seen in the readiness matrix.

## Scenarios

All 3 scenarios used the same implementation-engine role + contract pair fixture and ran in parallel under one batch:

- `safety-final-sanity`
- `safety-always-active`
- `safety-impact-reactivation`

## Results

| Scenario | Status | Cycles | Time | Final Findings | Cost |
|---|---|---:|---:|---:|---:|
| `safety-final-sanity` | `sanity_failed` | 4 | 26m 38.2s | 3 | `$0.620515` |
| `safety-always-active` | `sanity_failed` | 3 | 22m 09.2s | 1 | `$0.438720` |
| `safety-impact-reactivation` | `approved` | 4 | 26m 02.3s | 0 | `$0.736960` |

## What This Proved

### 1. Final sanity alone is not enough

Plain shrink-mode plus a final full sanity gate still reopened multiple findings:

- `ARB-025`
- `ARB-016`
- `ARB-005`

That confirms the earlier readiness result was not a fluke.

### 2. Always-active safety rules help, but they are not sufficient by themselves

Keeping the reopened-rule subset always active reduced the miss count from multiple findings down to one:

- `ARB-025`

That is a real improvement, but it still did not clear final sanity.

### 3. Impact-based reactivation + safety subset is the first passing safety layer

The winning path was:

- keep the reopened-rule subset always active
- if any grouped reviewer task fails, keep the whole task scope active for the next cycle
- still require the final full sanity sweep

That path:

- approved cleanly
- cleared final sanity
- preserved a runtime that stayed much closer to the fast grouped path than the old ARB replay path

## Current Interpretation

The sandbox signal now looks like this:

- base review shape: `grouped-shrinking`
- required safety layer: `impact-based reactivation + safety subset + final sanity`

This is the first sandbox result that satisfies both:

- fast convergence
- no reopened findings in the final full sanity pass

## Recommendation

This is now the leading candidate for live integration design:

1. `grouped-shrinking` as the fast path
2. always-active safety subset for known cross-surface rules
3. group-scope reactivation after failed grouped review
4. required final full sanity sweep before approval

## Remaining Caution

This was only one batch.

It is enough to identify the leading safety-layer design, but not enough to claim full repeatability yet. The next decision is whether to:

- run one confirmation batch
- or move directly into ARB integration with the expectation that live ARB remains the final proving ground
