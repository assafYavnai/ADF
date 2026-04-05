# governed-state-writer-serialization - Context

## Purpose
Close the shared workflow-state durability gap by moving feature-local helper writes onto one serialized, atomic, fail-closed writer contract.

## Why It Exists

- `review-cycle` can currently truncate or silently reinitialize `review-cycle-state.json`
- the risk is shared across workflow helpers and cannot stay as a one-off patch
- future parallel feature work depends on truthful per-feature state durability

## Root Cause Summary

- state mutation is still whole-file and helper-local
- there is no per-feature single-writer discipline enforced by a shared utility
- governance does not have one canonical `committed` barrier for critical writes
- malformed state can still drift into unsafe reset-to-default recovery behavior

## Key Constraints

- one shared writer utility, not per-slice copies
- feature-scoped serialization, not one global queue
- fail closed on malformed active state
- preserve cross-feature independence
