# governed-state-writer-serialization

## Target Local Folder
C:/ADF/docs/phase1/governed-state-writer-serialization/README.md

## Feature Goal
Introduce one shared governed state-writer utility for Phase 1 workflow runtime state so feature-scoped helpers stop doing unsafe whole-file read-modify-write updates directly.

## Why This Slice Exists Now

- `review-cycle` can currently lose or silently reinitialize state after file corruption or concurrent writes
- the failure class is shared across workflow helpers, not unique to one slice
- Gap D is not closed until state writes become serialized, atomic, and fail-closed

## Problem Statement

`implement-plan` and `review-cycle` currently mutate feature-local JSON state directly. In practice, this allows near-parallel helper writes to race on the same state file, which can truncate `review-cycle-state.json`, trigger unsafe reinitialization, and lose truthful in-flight route state.

The system-level problem is:

- writer logic is still helper-local or implicit instead of centralized
- same-feature writes are not serialized through one shared path
- governance does not have one durable `committed` barrier for critical state transitions
- malformed-state recovery can still drift into unsafe reset behavior

## Requested Scope

Keep this slice bounded to the shared workflow-runtime utility layer and the two Phase 1 helpers that still need to consume it directly.

This slice must:

- provide one shared feature-scoped state-writer utility
- serialize writes per feature stream
- apply writes atomically
- expose durable write metadata such as revision or write id plus timestamp
- let governance distinguish `pending`, `committed`, and `failed` writes
- hard-stop critical workflow progression when a critical state write fails or is still pending
- integrate the shared writer into `implement-plan` and `review-cycle`
- fail closed on malformed active state instead of silently reinitializing from defaults

## Allowed Edits

- `skills/governed-feature-runtime.mjs`
- `skills/implement-plan/**`
- `skills/review-cycle/**`
- tightly scoped tests for the governed writer and its helper integrations
- `docs/phase1/governed-state-writer-serialization/**`

## Forbidden Edits

- no broad Brain durability redesign
- no merge-queue redesign unless a minimal touch is strictly required by the shared writer contract
- no second canonical company database
- no background daemon or scheduler
- no unrelated COO runtime work

## Required Deliverables

- one shared governed state-writer utility with feature-scoped serialization
- `implement-plan` integration
- `review-cycle` integration
- targeted proof for same-feature contention, cross-feature isolation, and fail-closed malformed-state handling
- context.md
- implement-plan-contract.md
- completion-summary.md

## Truth Rules

- critical state writes must not be treated as committed before they are durable
- failed critical writes must block forward progress
- malformed active state must not silently reset to defaults
- different feature streams must stay isolated even while one feature stream is blocked on state I/O

## Acceptance Gates

- two near-parallel critical writes for the same feature do not corrupt state
- helpers for the same feature cannot advance past an uncommitted critical write
- a failed critical write hard-stops the governed route truthfully
- per-feature isolation is preserved
- active malformed state does not silently reset to defaults

## Machine Verification Plan

- run targeted tests for the shared writer utility
- run targeted tests for `implement-plan` integration
- run targeted tests for `review-cycle` integration
- prove same-feature contention handling, cross-feature isolation, and malformed-state fail-closed behavior
- run `git diff --check` on the changed source set

## Human Verification Plan

- Required: false
- Reason: this is workflow-runtime hardening and can be proven through deterministic machine verification

## Non-Goals

- no Brain schema redesign
- no queue or benchmark harness work
- no executive-status surface work
- no full repo-wide mutable-state architecture migration
