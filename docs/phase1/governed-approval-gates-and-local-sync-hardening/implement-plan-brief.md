# Implementor Brief

## Mission

Implement the governed workflow hardening described in `implement-plan-contract.md` without widening into product-runtime code.

## Core Failure Classes

- required human verification can be skipped while merge/completion still proceeds
- split review truth can leak into merge-ready or completed narratives
- post-human route changes can leave stale approval looking valid
- local target sync currently treats dirty control-plane checkouts as a reason to skip sync instead of preserving, syncing, and restoring state

## Mandatory Deliverables

- hard landing guard for required human verification
- stale-human-approval invalidation after post-human changes
- split-review truth guard
- pre-resume origin refresh
- pre-merge origin refresh
- stash-sync-restore local target sync for tracked and untracked files
- durable fail-closed recovery when restore cannot complete safely
- targeted deterministic tests and temp-repo proof

## Hard Rules

- preserve the exact approved commit SHA landing rule
- do not weaken review, human approval, merge, or completion gates
- do not silently discard tracked or untracked local changes
- if a restore conflict occurs, fail closed and preserve recovery evidence
- keep the slice bounded to governed route hardening

## First Read Order

1. `README.md`
2. `requirements.md`
3. `decisions.md`
4. `implement-plan-contract.md`
5. `context.md`

## Proof Expectations

- prove the blocked routes, not only the happy path
- include targeted helper tests for human gate truth and split-review truth
- include temp-repo or isolated worktree smoke for local sync behavior
- prove that the new behavior is safe for a contextless orchestration agent

## Finish Line

The slice is ready for implementation only when the governed route itself refuses unsafe progression without relying on operator memory or manual cleanup.
