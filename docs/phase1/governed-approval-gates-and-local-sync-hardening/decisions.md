# Decisions

## Decision 1

Use a new slice instead of widening `governed-implementation-route-hardening`.

Reason:
- that slice already landed on `origin/main`
- these requirements surfaced too late to change its scope truthfully without reopening a completed stream

## Decision 2

Keep this slice internal to governed workflow hardening.

Reason:
- the motivating evidence comes from `coo-live-executive-status-wiring`
- but the implementation target is the workflow engine, not the COO route itself

## Decision 3

Human verification for this slice is `Required: false`.

Reason:
- this slice changes helper/runtime/contract behavior
- the primary proof surface is deterministic governed-route verification, not a product-facing manual route

## Decision 4

Local target sync must preserve developer state rather than skipping dirty checkouts by default.

Reason:
- `skipped_dirty_checkout` keeps merge truth incomplete locally
- the replacement route must preserve both tracked and untracked changes safely and audibly

## Decision 5

If preserve-sync-restore cannot complete safely, fail closed.

Reason:
- local developer state is higher priority than forcing a convenient fast-forward narrative
- recovery evidence must be durable so the operator can continue without guessing
