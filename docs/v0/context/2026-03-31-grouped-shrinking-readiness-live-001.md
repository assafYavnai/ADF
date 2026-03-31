# Grouped Shrinking Readiness Live Results

Date: 2026-03-31
Status: sandbox-only readiness signal collected from 2 completed batches

## Scope

This note records the grouped-shrinking readiness matrix run from:

- `tools/agent-role-builder/tests/grouped-shrinking-readiness/`

Completed batches:

- `live-001`
- `live-002`

Not executed:

- `live-003` was intentionally skipped by user request after `live-002` completed

## Goal

Validate whether `grouped-shrinking` is ready to replace the current pre-board rules path once we move from sandbox experiments to real ARB integration.

The readiness questions were:

1. Does the chosen grouped-shrinking path approve a real role + contract pair?
2. Does forced checkpoint/resume preserve continuity?
3. Does one final full sanity sweep reopen findings after shrink-mode approval?

## Result Matrix

| Scenario | Run | Status | Cycles | Time | Final Findings | Cost |
|---|---|---|---:|---:|---:|---:|
| `pair` | `live-001` | `approved` | 2 | 16m 05.4s | 0 | `$0.356360` |
| `pair` | `live-002` | `approved` | 3 | 20m 19.6s | 0 | `$0.568595` |
| `pair-resume` | `live-001` | `approved` | 3 | 24m 43.9s | 0 | `$0.625585` |
| `pair-resume` | `live-002` | `approved` | 2 | 28m 50.9s | 0 | `$0.353040` |
| `pair-sanity` | `live-001` | `sanity_failed` | 4 | 29m 23.5s | 4 | `$0.615205` |
| `pair-sanity` | `live-002` | `sanity_failed` | 3 | 35m 02.2s | 3 | `$0.426915` |
| `pair-resume-sanity` | `live-001` | `sanity_failed` | 3 | 22m 43.2s | 2 | `$0.417040` |
| `pair-resume-sanity` | `live-002` | `sanity_failed` | 4 | 26m 10.6s | 1 | `$0.691630` |

## What Held

- Plain `grouped-shrinking` approved in both pair runs.
- The forced checkpoint/resume path also approved in both runs.
- Resume continuity was functionally real:
  - the checkpointed runs resumed from saved state
  - resumed review/fix sessions were recorded in the per-run session registry
- Review-side time remained much lower than the older ARB replay path; the main long pole inside this sandbox is still the fix stage.

## What Failed

All 4 sanity variants failed the final full grouped sanity sweep.

That means the current grouped-shrinking loop is good enough to converge on the active rule set, but not yet trustworthy enough to replace a broader final pass.

### Reopened rule IDs

`live-001 pair-sanity`

- `ARB-022`
- `ARB-002`
- `ARB-004`
- `ARB-005`

`live-001 pair-resume-sanity`

- `ARB-025`
- `ARB-003`

`live-002 pair-sanity`

- `ARB-017`
- `ARB-021`
- `ARB-016`

`live-002 pair-resume-sanity`

- `ARB-016`

### Pattern

The reopened findings were not random.

They clustered around:

- artifact-matrix authority and canonical path precision
- output/category separation
- inherited governance/runtime semantics
- exact terminal-state wording and budget/resume semantics
- polarity-pure scope/exclusion language

These are exactly the kinds of cross-surface package rules that can be missed when shrink-mode stops revisiting already-cleared groups.

## Readiness Conclusion

Current disposition:

- `grouped-shrinking` is validated as the best fast-path reviewer shape
- `grouped-shrinking` is **not** yet ready to replace the current ARB pre-board rules path by itself
- it still needs a retained safety mechanism before live integration

The readiness matrix says:

- yes to `grouped-shrinking` as the base path
- no to shrink-only approval without a broader final safety check

## Next Sandbox Step

Do not change ARB yet.

Next, test only grouped-shrinking variants that retain a safety layer, for example:

1. grouped-shrinking + final full sanity sweep as a required terminal gate
2. grouped-shrinking + a retained always-check safety subset
3. grouped-shrinking + impact-based reactivation plus final safety subset

The next decision should answer one narrow question:

Which safety layer preserves most of the grouped-shrinking speed gain while eliminating the final-sanity reopen pattern?
