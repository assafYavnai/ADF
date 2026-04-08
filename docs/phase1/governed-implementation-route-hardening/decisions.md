# Decisions

## D-001 Use One Bounded Feature Stream

This hardening bundle is implemented as one Phase 1 feature stream, `governed-implementation-route-hardening`, because the reported failures came from one contiguous governed route: prepare -> implement -> review -> merge -> closeout.

## D-002 Freeze A Source Contract Before Worker Execution

The baseline slice docs and normalized contract must be committed and pushed on the feature branch before the implementation worker starts. The worker should implement against a frozen contract, not against ephemeral commentary.

## D-003 Prefer Live Authorities Over Historical Sweep Churn

The required `master` -> `main` cleanup applies to live authoritative templates and docs first. Frozen historical evidence is out of scope unless a file still acts as an active source of truth for the governed route.

## D-004 Review Is Still Required Even Without Human Testing

Human verification is not required for this slice, but governed review is still required because the slice changes route helpers, contract sources, and closeout semantics that can affect later slices broadly.

## D-005 Blocked-Merge Recovery Must Become Productized

Manual merge worktrees are not the intended product path. The route must gain a governed blocked-merge resume or resolve capability inside `merge-queue` tooling and docs.

## D-006 Implementor Fix Cycles Must Reuse Continuity

The feature will codify that fix cycles reuse the same implementor execution when valid, and that worker messages for normal repair use findings artifact paths plus a short instruction instead of a fresh long prompt.

## D-007 Requirement-Freeze Guarding Belongs In Implement-Plan

The add/add authoritative requirements conflict from Slice 01 is treated as an integrity problem, not just a merge-time inconvenience. The route should push back earlier when authoritative requirement files are being introduced independently on base and feature.
