# governed-state-writer-serialization

## Implementation Objective

Introduce one shared governed state-writer utility for Phase 1 workflow runtime state so feature-scoped helpers stop doing unsafe whole-file read-modify-write updates directly. The utility must provide feature-scoped serialized writes, atomic state replacement, durable audit or revision metadata, and governance-visible write outcomes that let the workflow hard-stop when critical writes are still pending or have failed.

## Problem Statement

`implement-plan` and `review-cycle` currently mutate feature-local JSON state directly. In practice, this allows near-parallel helper writes to race on the same state file, which can truncate `review-cycle-state.json`, trigger unsafe reinitialization, and lose truthful in-flight route state.

This is a shared workflow-runtime defect:

- writer logic is still helper-local or implicit instead of centralized
- same-feature writes are not serialized through one shared path
- governance does not have one durable `committed` barrier for critical state transitions
- malformed-state recovery can still drift into unsafe reset behavior

## Target Behavior

After this fix:

- there is one shared workflow-state writer utility, not per-slice duplicated logic
- governance initializes a feature-scoped writer handle for each feature stream
- all governed state writes for that feature route through the same handle
- writes for the same feature are serialized FIFO
- state writes are applied atomically
- each applied write gets durable audit metadata such as revision/write ID and timestamp
- governance can distinguish `pending`, `committed`, and `failed` writes
- critical writes block forward progress until committed
- failed critical writes hard-stop the workflow instead of allowing the next step to proceed
- transient malformed-state reads do not silently reset active workflow state to defaults

## Requested Scope

Keep this slice bounded to:

- the shared workflow runtime utility layer needed for serialized governed state writes
- `skills/governed-feature-runtime.mjs` or the smallest equivalent shared utility surface
- `implement-plan` integration for feature-scoped governed state
- `review-cycle` integration for feature-scoped governed state
- tightly scoped runtime and proof coverage for the above
- Phase 1 docs that describe this governed runtime contract

## Non-Goals

- do not redesign Brain durability or Brain schema
- do not redesign merge-queue behavior unless a minimal touch is strictly required by the shared utility contract
- do not widen into unrelated COO executive-surface behavior
- do not build a repo-wide global queue that serializes unrelated features together
- do not add a background daemon or scheduler in this slice

## Artifact Map

- README.md
- context.md
- implement-plan-contract.md
- implement-plan-state.json
- implement-plan-brief.md
- implement-plan-pushback.md
- implementation-run/
- completion-summary.md

## Lifecycle

- active
- blocked
- completed
- closed
