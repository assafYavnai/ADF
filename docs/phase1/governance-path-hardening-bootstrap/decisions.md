# Governance Path Hardening Bootstrap Decisions

Status: active temporary repo-local decision log
Scope: `C:/ADF/docs/phase1/governance-path-hardening-bootstrap`
Purpose: preserve the frozen governance-path hardening decisions until the repaired route can capture and enforce them durably.

## Decision D-001 - Keep the default feature slug

Decision: use `governance-path-hardening-bootstrap`.

Status: accepted

Why: the slug states both the topic and the manual-bootstrap nature of the first landing without introducing a second naming debate.

## Decision D-002 - First landing is manually governed

Decision: the first landing for this slice is not allowed to self-certify through the current `implement-plan` / `merge-queue` closeout route.

Status: accepted

Why: that route is the subject under repair. It may inform the design, but it cannot be the final authority for its own first hardening landing.

## Decision D-003 - Phase 0 is a real gate

Decision: Phase 0 contract freeze and contradiction review must complete before any production code change starts.

Status: accepted

Why: prior revisions drifted because code started while ownership, proof, and backward-compat semantics were still fluid.

## Decision D-004 - Truth classes stay explicit

Decision: the slice must preserve the truth classes from `governance-path-hardening-plan-v2.md` as first-class contract material.

Status: accepted

Why: authority-plane collapse repeatedly came from treating lifecycle truth, execution truth, operational residue, caches, and review evidence as interchangeable.

## Decision D-005 - Persisted schema and hydrated runtime view stay split

Decision: the hardened route must treat persisted feature state and hydrated compatibility views as separate models.

Status: accepted

Why: hybrid persisted fields were a core source of route ambiguity and proof drift.

## Decision D-006 - `reconciliation_sha` remains runtime-derived only

Decision: `reconciliation_sha` is never persisted in the hardened feature schema.

Status: accepted

Why: the route must recover it from durable remote proof, not from local convenience caches.

## Decision D-007 - `last_commit_sha` remains compatibility-only

Decision: `last_commit_sha` is not a new writer authority anywhere in the hardened path.

Status: accepted

Why: it is a compatibility bridge only. Allowing it back into writer authority would restore the same hybrid-field defect class this slice is meant to remove.

## Decision D-008 - Execution-domain status must be explicit

Decision: execution progress must have its own authoritative persisted field, and compatibility `active_run_status` must remain derived only.

Status: accepted

Why: merge/lifecycle truth and execution-domain truth are different domains and must stop sharing one writable status field.

## Decision D-009 - Workspace mirrors are staging only

Decision: mirrored workspace artifacts may exist only for governed staging and must never be treated as source truth.

Status: accepted

Why: canonical truth and commit staging are separate authority planes.

## Decision D-010 - Precedence stays domain-scoped

Decision: no global priority ladder may be used to auto-resolve cross-domain contradictions.

Status: accepted

Why: the old global-ladder instinct is exactly what made caches, review evidence, and compatibility aliases leak into lifecycle authority.

## Decision D-011 - Ambiguity blocks fail closed

Decision: zero-result, multi-result, stale-proof, and wrong-root recovery paths must block instead of guessing.

Status: accepted

Why: proxy evidence and guesswork repeatedly produced routes that looked fixed at the endpoint while remaining unsafe by class.

## Decision D-012 - Backward compatibility is first-class

Decision: legacy states, old worktrees, old summaries, old cache locations, and compatibility aliases all require explicit normalization and retirement rules inside this slice.

Status: accepted

Why: leaving backward compatibility as a footnote is how retired authority silently comes back through the side door.

## Decision D-013 - Trust restoration requires a follow-up dogfood pass

Decision: the route is not considered trusted again until the hardened path itself can take a later slice through prepare, review, merge, and closeout without manual repair.

Status: accepted

Why: this effort is not done when the code looks correct; it is done when the governance route proves it can operate cleanly.

## Decision D-014 - The bootstrap seed stays machine-blocked until approval

Decision: the seeded operational artifacts preserve `brief_ready` only as the last truthful pre-implementation checkpoint, while live operational state stays `blocked` until manual bootstrap approval is recorded.

Status: accepted

Why: manual bootstrap contract approval before code starts is not the same thing as the governed post-implementation `review_cycle`, and documentary-only approval would still let current helper logic proceed into implementation.

## Decision D-015 - One artifact owns bootstrap approval

Decision: `implement-plan-pushback.md` is the sole authoritative record for bootstrap approval status, approver, approval time, and approval basis.

Status: accepted

Why: the bootstrap hold must have one durable approval surface. Spreading approval across README edits, comments, or ad hoc state patches would recreate the same planner-completeness failure this slice is meant to remove.
