# governance-path-hardening-bootstrap

## Implementation Objective

Convert `C:/ADF/docs/phase1/governance-path-hardening-plan-v2.md` into the repo-native, execution-ready implementation slice that will harden the full governance path from `implement-plan prepare` through merge-to-main closeout.

This is the bootstrap/manual-governance landing for that effort. It freezes the exact route contract, phase order, proof burden, and trust-restoration bar so Phase 0 and Phase 1 implementation can start without another planning rewrite.

## Bootstrap / Manual Governance Mode

- This slice is intentionally seeded manually because `implement-plan`, `merge-queue`, and closeout governance are themselves in scope and cannot certify their own first landing.
- Slice creation, production implementation, verification, approval, and the first merge for this feature are manually governed.
- Current `implement-plan`, `review-cycle`, and `merge-queue` helpers are authoritative source material to repair, but they are not sufficient final authority for closing this slice.
- The first landing must stop for manual review before any code changes start.
- The seeded operational artifacts intentionally freeze the slice in repo-native `blocked` state after the brief is written. The last truthful executable checkpoint remains `brief_ready`, but current helpers must encounter a machine-enforced manual-bootstrap hold until approval is recorded.
- `bootstrap-approval.v1.json` is the sole bootstrap approval record for clearing that hold. Until that record is stamped approved, the slice must not reopen to implementation and must not advertise `review_pending`, `review_requested`, or a governed `review-cycle` handoff before real post-implementation review exists.
- Trust may return to the governed route only after the acceptance gates in this slice are proven on the repaired path.

## Why This Slice Exists Now

- `governance-path-hardening-plan-v2.md` already froze the route-level design, but implementation still needs a repo-native slice contract and exact artifact set.
- Earlier governance hardening passes kept fixing visible endpoints while leaving authority-plane collapse, hybrid fields, proxy evidence, and proof drift alive.
- The first trustworthy landing must therefore be route-complete and manually governed, not helper-closeout driven.

## Requested Scope

Core implementation surfaces:

- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/merge-queue/**`
- `C:/ADF/skills/review-cycle/**`
- `C:/ADF/skills/governed-feature-runtime.mjs`
- targeted `C:/ADF/skills/tests/**` needed to prove the hardened route
- authoritative workflow docs/contracts under `C:/ADF/skills/**/references/**`
- this feature root under `C:/ADF/docs/phase1/governance-path-hardening-bootstrap/**`

In-scope route branches:

- prepare -> active worktree execution before merge
- review-ready -> merge-ready handoff
- enqueue / process-next / blocked resume
- merged-but-not-completed closeout
- canonical-root reconcile and cache/index sync
- legacy-state hydration / migration / recovery
- status/reporting consumers that read governance fields or artifacts

Explicitly deferred:

- bulk Phase 6 backfill across historical streams
- broad Brain hygiene cleanup
- unrelated COO product/runtime work
- general doc cleanup outside the governance route

## Required Deliverables

- repo-native slice docs that freeze truth classes, field ownership, artifact ownership, four authority planes, frozen invariants, implementation order, hostile-case proofs, and definition of done
- a single bootstrap approval record in `bootstrap-approval.v1.json` that is the only authority allowed to clear the initial manual-bootstrap hold
- a Phase 0 contract-freeze pass that updates the workflow contracts and contradiction gates before production code changes
- a Phase 1 wrong-code-landing pass that removes stale-ref fallback, checkout-derived base-branch authority, and blocked-lane retargeting before deeper refactors
- an explicit route inventory covering writers, readers, validators, derivation paths, migration paths, recovery paths, and status consumers
- explicit proof obligations for negative paths, ambiguity blocking, backward compatibility, workspace-mirror authority isolation, and contradiction sweeps
- exact trust-restoration criteria for when `implement-plan` can be used again on a follow-up dogfood slice without manual repair

## Allowed Edits

- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/merge-queue/**`
- `C:/ADF/skills/review-cycle/**`
- `C:/ADF/skills/governed-feature-runtime.mjs`
- tightly scoped route-owned tests under `C:/ADF/skills/tests/**`
- authoritative route contracts and skill docs only where required to keep the hardened route truthful
- this feature root under `C:/ADF/docs/phase1/governance-path-hardening-bootstrap/**`

## Forbidden Edits

- no production code changes in this bootstrap/manual-governance creation pass
- no bulk Phase 6 backfill inside the runtime hardening slice
- no persisted writes of runtime-derived fields as a convenience cache
- no writable restoration of compatibility aliases
- no collapse from domain-scoped precedence back to a single global ladder
- no use of workspace mirrors, caches, or projections as source truth
- no manual state mutation as the intended product fix
- no broad architecture restart of unrelated COO/runtime surfaces

## Acceptance Gates

1. Phase 0 freezes truth classes, field ownership, artifact ownership, four authority planes, backward-compatibility rules, and contradiction gates without internal contradiction.
2. Phase 1 removes wrong-code-landing blockers: stale-ref fallback, checkout-derived `base_branch`, and blocked-lane retargeting.
3. Canonical root selection becomes consistent across all in-scope read/write paths.
4. Persisted schema and hydrated runtime view are explicitly separated.
5. `reconciliation_sha` is runtime-derived only and recovered from remote durability proof.
6. `last_commit_sha` is no longer a writable authority path.
7. merge-queue no longer writes execution-domain status.
8. Domain-scoped `reconcile` exists and blocks cross-domain contradictions instead of auto-resolving them.
9. Validation covers truth source, physical authority, remote durability, ambiguity, and backward-compat normalization.
10. Governed closeout is remotely provable, uniqueness-checked, and fail-safe on push failure.
11. A follow-up dogfood slice can run through prepare, implementation, review, merge, and closeout without manual artifact repair or manual state mutation.

## Implementation Order

1. Phase 0: contract freeze and contradiction gate
2. Phase 1: wrong-code-landing blockers
3. Phase 2: physical authority and canonical storage
4. Phase 3: state model hardening and semantic split
5. Phase 4: domain-scoped reconcile and multi-plane validation
6. Phase 5: governed closeout and remote durability
7. Phase 6: backfill, retirement, and cleanup as a separate follow-up after the runtime path is proven

## Artifact Map

- `README.md`
- `context.md`
- `requirements.md`
- `decisions.md`
- `implement-plan-contract.md`
- `implement-plan-state.json`
- `implement-plan-pushback.md`
- `implement-plan-brief.md`
- `bootstrap-approval.v1.json`
- `implement-plan-execution-contract.v1.json`
- `implementation-run/`

## Lifecycle

- active
- blocked
- completed
- closed
