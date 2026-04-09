# Production Plan: Governance Path Hardening

## Objective

Fix the governance path from `implement-plan` initiation through merge-to-main closeout so that future slices land cleanly without post-merge artifact repair.

This plan is intentionally route-complete, not endpoint-driven.
It is derived from:

- live code behavior in `implement-plan`, `merge-queue`, and `review-cycle`
- repeated review feedback on earlier plan drafts
- the recurring repo failure pattern where the claimed route, the mutated route, and the proved route drift apart

Backfill of already-landed feature streams is a separate bounded follow-up after the runtime path is hardened.

---

## Why Prior Revisions Failed

Earlier revisions kept finding new sibling defects because they mostly repaired the visible endpoint while leaving the underlying defect class alive.

The recurring meta-failure was:

1. the route was described one way in docs
2. the route was mutated a different way in code
3. the proof plan still verified an older or narrower route

That created repeated review/fix loops.

This plan is designed to stop that pattern by freezing:

- truth classes
- field ownership
- artifact ownership
- route boundaries
- authority planes
- contradiction gates
- hostile-case proofs

---

## Primary Root Causes

These are the root causes the implementation and review must keep using as a search lens.
If a future change reintroduces any of them, that change is defective even if the immediate endpoint looks correct.

### 1. Authority-plane collapse

The system keeps collapsing distinct questions into one:

- What is authoritative for reads?
- Where does the authoritative copy physically live?
- Which checkout stages the commit?
- What proves the truth survived remotely?

Those are four different planes:

1. truth source
2. storage root
3. commit workspace
4. remote durability proof

Most historical governance bugs came from treating one of those planes as a proxy for another.

### 2. Hybrid fields and hybrid artifacts

Several fields and artifacts have been used for more than one meaning.
That creates sibling defects because one site treats a value as lifecycle truth while another treats the same value as operational residue, execution progress, or a compatibility alias.

Examples of dangerous categories:

- runtime-derived value treated as persisted truth
- compatibility alias treated as first-class authority
- review evidence treated as lifecycle authority
- execution progress treated as merge-route status
- projections or caches treated as source truth

### 3. Incomplete ownership expansion

A field is not fully planned when only the obvious writer is fixed.
It must also be expanded through:

- all writers
- all readers
- all validators
- all derivation paths
- all migration paths
- all recovery paths
- all status/reporting consumers

If one of those still carries old semantics, the defect class is still alive.

### 4. Proxy evidence replacing first-class evidence

The route has repeatedly inferred "what probably happened" from nearby clues:

- current checkout branch
- stale local refs
- overloaded `last_commit_sha`
- free-form closeout commit identity inference

The hardened route must prefer first-class evidence and block on ambiguity rather than guessing.

### 5. Semantic drift after model changes

When the model changes in one section but old meaning survives in another section, implementation becomes non-deterministic.

This plan therefore requires a contradiction sweep across:

- ownership tables
- invariants
- phase steps
- verification plan
- failure isolation
- backward compatibility notes
- helper usage docs

One concept must have one meaning everywhere.

---

## Scope

### In scope

- `implement-plan` runtime path after `prepare`
- `merge-queue` enqueue, process-next, resume-blocked, closeout handoff
- `review-cycle` state/evidence boundary
- feature-local state
- canonical cache writers
- closeout commit/push behavior
- route validators
- schema normalization and legacy handling needed to keep the new route safe

### Out of scope for the core hardening slice

- bulk backfill of all existing feature streams
- Brain hygiene and review-finding lifecycle cleanup
- operational doc cleanup unrelated to the governance route

Those remain separate bounded follow-up work after the runtime path is correct.

---

## Non-negotiable Design Decisions

These decisions are frozen by this plan.

1. `reconciliation_sha` is runtime-derived only.
   - It is never stored in the persisted feature state schema.
   - It is recovered only from durable git evidence on `origin/<base_branch>`.

2. `last_commit_sha` is a compatibility view only.
   - It is never directly authored by the hardened route.
   - New write paths must not accept it as authority input.
   - Any legacy use is confined to migration or read-time hydration.

3. Execution progress and merge-route status must not share one authoritative field.
   - Introduce an explicit persisted execution-domain field.
   - Remove merge-queue authority over execution-domain status.
   - Keep any broad compatibility status as a derived view only.

4. `implement-plan-state.json` is a heterogeneous container.
   - Artifact-level labels never override field-level ownership.
   - Readers must consult the field contract, not assume the whole file is one truth class.

5. Commit workspace is staging material, not authority.
   - Canonical truth is reconciled first.
   - The workspace receives a mirrored copy only for staging the governed commit.
   - The workspace copy must never become a second source of truth.

6. All derived or recovered truth must fail closed.
   - zero results -> block
   - multiple results -> block
   - stale or wrong-root proof -> block
   - no guessing

7. Backward compatibility is a full design surface, not a footnote.
   - old worktrees
   - old state schema
   - old summaries
   - old cache locations
   - legacy compatibility aliases
   all require explicit authority, normalization, retirement, and proof rules.

---

## Truth Classes

Every field and artifact must belong to exactly one primary truth class.
If a value needs two classes, split it.

| Truth class | Definition | Durability | Example |
| --- | --- | --- | --- |
| Committed lifecycle truth | Persisted feature state used for lifecycle decisions | survives fresh clone | `approved_commit_sha`, `merge_commit_sha`, `merge_status`, `feature_status`, `base_branch` |
| Committed execution truth | Persisted execution/run state and append-only execution events | survives fresh clone | structured events, new persisted execution status |
| Runtime-derived truth | Deterministically recovered from committed evidence | re-derived after clone | `reconciliation_sha`, compatibility `last_commit_sha`, derived route status |
| Committed operational residue | Persisted for operator visibility but not lifecycle authority | survives fresh clone but cannot drive lifecycle truth | `local_target_sync_status`, `last_error` |
| Local operational hint | Valid only in the local checkout or process | not durable | `.superseded`, in-process `fresh_base_ref_sha` |
| Projection/cache | Rebuildable aggregate of authoritative sources | rebuildable | `features-index.json`, `agent-registry.json`, `run-projection.v1.json` |
| Review-only evidence | Review verdict/approval facts scoped to review-cycle | survives fresh clone but not lifecycle authority | `review-cycle-state.json` verdict fields |
| Human-readable output | Documentation generated from machine state | survives fresh clone but never authoritative | `completion-summary.md` |

---

## Persisted Schema vs Hydrated Runtime View

This split is mandatory.
It is the main defense against semantic overload.

### Persisted feature state schema

Persist only values that are authoritative or intentionally retained as committed operational residue.

Persisted lifecycle fields:

- `approved_commit_sha`
- `merge_commit_sha`
- `review_closeout_sha`
- `base_branch`
- `merge_status`
- `feature_status`

Persisted execution fields:

- `execution_status` (new authoritative execution-domain field)
- run timestamps / attempt state / last completed execution step

Persisted operational residue:

- `local_target_sync_status`
- `last_error`

Not persisted in the hardened schema:

- `reconciliation_sha`
- `last_commit_sha`
- `active_run_status` as an authoritative field

### Hydrated runtime view

Hydrated on read by helper/status/reporting code only:

- `reconciliation_sha`
- compatibility `last_commit_sha`
- compatibility `active_run_status`
- derived route summaries

Hydrated values may be emitted in helper output for compatibility, but they are never authoritative inputs to state transitions.

---

## Field Ownership Matrix

This is the governing field contract.

| Field | Truth class | Sole writer | Allowed readers | Notes |
| --- | --- | --- | --- | --- |
| `approved_commit_sha` | committed lifecycle truth | `implement-plan update-state` | merge-queue enqueue/process-next, mark-complete, validators | sole pre-merge landing authority |
| `merge_commit_sha` | committed lifecycle truth | `merge-queue process-next` only | mark-complete, reconcile, status, validators | sole merge-result truth |
| `review_closeout_sha` | committed lifecycle truth | `implement-plan update-state` | reconcile, status | explicit review closeout evidence |
| `base_branch` | committed lifecycle truth | `implement-plan prepare` only | all merge and closeout routes | immutable after initial set |
| `merge_status` | committed lifecycle truth | merge-queue only | canonical-root decision, validators, status | merge-route truth only |
| `feature_status` | committed lifecycle truth | implement-plan lifecycle commands | all status and completion logic | feature lifecycle truth only |
| `execution_status` | committed execution truth | implement-plan only | execution state machine, status renderers | new authoritative execution-domain status |
| `active_run_status` | runtime-derived compatibility view | never directly written | legacy readers only | derived from `execution_status`, `merge_status`, and `feature_status` |
| `reconciliation_sha` | runtime-derived truth | never directly written | reconcile, status, compatibility hydration | recovered from durable git evidence only |
| `last_commit_sha` | runtime-derived compatibility view | never directly written | legacy readers only | derived from `reconciliation_sha ?? merge_commit_sha ?? approved_commit_sha ?? review_closeout_sha` |
| `local_target_sync_status` | committed operational residue | merge-queue sync path | mark-complete guard, status | never lifecycle authority |
| `last_error` | committed operational residue | shared governed error-write helper used by validators and route failure handlers | status, debugging | cleared on successful completion reconcile |
| `fresh_base_ref_sha` | local operational hint | in-process `process-next` only | merge-base and worktree creation in same execution | never persisted |

### Review-cycle boundary

`review-cycle-state.json` contributes:

- verdict
- approval evidence
- review lane status

It does not contribute:

- lifecycle truth
- merge truth
- commit authority

`review-cycle last_commit_sha` is local operational state for review-cycle only and must never be consumed as lifecycle authority by implement-plan.

### Status-field split

To eliminate hybrid semantics:

- add `execution_status` as the only persisted execution-domain status
- stop merge-queue from writing `active_run_status`
- compute compatibility `active_run_status` on read from authoritative inputs

This closes the current class of bug where one field is used as both execution progress and merge-route state.

---

## Artifact Ownership Matrix

| Artifact | Truth class | Sole writer(s) | Storage root | Lock | Notes |
| --- | --- | --- | --- | --- | --- |
| `implement-plan-state.json` | heterogeneous container with field-level ownership | implement-plan governed state writer; merge-queue only through bounded implement-plan update calls | canonical feature root per invariant I-1 | feature lock | field-level contract always wins |
| `review-cycle-state.json` | review-only evidence | review-cycle | feature root | none | no lifecycle authority |
| structured execution events | committed execution truth | implement-plan record-event route | feature run directory | append-only discipline | execution domain only |
| `run-projection.v1.json` | projection/cache | implement-plan | feature run directory | none | rebuildable |
| `execution-contract.v1.json` | committed execution truth | implement-plan prepare | feature root and per-run copy | none | input contract, not lifecycle override |
| `completion-summary.md` | human-readable output | implementation agent, normalize command | feature root | none | never authoritative |
| `features-index.json` | projection/cache | implement-plan sync | canonical project root only | project lock | rebuildable, never written from worktree root |
| `agent-registry.json` | projection/cache | implement-plan sync | canonical project root only | project lock | rebuildable, never written from worktree root |
| `.superseded` | local operational hint | mark-complete, reconcile, commit-closeout | worktree feature dir only | none | local hint only, never committed |

---

## Four Authority Planes

Every changed route must answer all four questions separately.

| Plane | Required question |
| --- | --- |
| Truth source | Which copy is authoritative for reads? |
| Storage root | Where does the authoritative copy physically live? |
| Commit workspace | Which checkout stages the governed commit? |
| Remote durability proof | What proves the truth survived remotely? |

If two planes are silently treated as the same thing, the route is not hardened.

---

## Frozen Invariants

### I-1. Canonical root rule

- Before `merge_commit_sha` exists, the feature worktree is authoritative for active execution artifacts on post-prepare routes.
- Once `merge_commit_sha != null`, repo-root feature artifacts are authoritative for lifecycle truth.
- Pre-merge queue states do not flip authority by themselves.
- `.superseded` is a local accelerator only. Its absence never overrides `merge_commit_sha`.

### I-2. Commit workspace mirror rule

- `commit-closeout` reconciles canonical state first.
- Only after reconcile succeeds may it mirror canonical feature artifacts and canonical caches into the commit workspace.
- The workspace copy is staging material only.
- If workspace copy and canonical root diverge, canonical root wins.
- No later reader or validator may treat the workspace mirror as a second truth source.

### I-3. Domain-scoped precedence only

There is no single global priority ladder.

Execution domain:

- structured events
- execution projections
- persisted execution compatibility state

Lifecycle domain:

- explicit lifecycle fields in canonical feature state

Review domain:

- verdict and approval evidence only

Non-authoritative outputs:

- caches
- summaries
- compatibility views

No domain may silently override another.
Cross-domain contradictions block and surface; they do not auto-resolve by ladder simplification.

### I-4. Derived values are read-only

- `reconciliation_sha` is derived-only
- `last_commit_sha` is derived-only
- compatibility `active_run_status` is derived-only

New write paths must not accept these as authoritative inputs.

### I-5. Base-branch immutability

- `base_branch` is resolved from `origin/HEAD`, never from checkout state
- it is set once during `prepare`
- `resume-blocked` cannot retarget the lane

### I-6. Fresh-ref rule

- merge authorization requires a successful fetch
- no stale local fallback
- any temporary fresh-base ref evidence is scoped to the current `process-next` execution only

### I-7. Closeout uniqueness rule

At most one governed closeout commit may exist per merged feature route.

If recovery finds:

- zero candidates -> block
- more than one candidate -> block

The route must not guess.

### I-8. Mixed-container rule

`implement-plan-state.json` may contain multiple field classes, but field-level ownership always wins.
No reader may infer truth class from the file name alone.

### I-9. Compatibility is a controlled bridge

Legacy fields and legacy worktree artifacts may be read for normalization.
They may not regain authority after normalization.

---

## Forbidden Defect Classes

If implementation introduces any of these, the route is still defective even if the immediate endpoint appears fixed.

1. Mutable authority derived from local checkout state
2. Authority-bearing field with more than one unfrozen writer
3. Derived alias accepted as a direct writer input
4. Runtime-derived truth without explicit zero-result and multi-result blocking
5. Cache or registry write from non-canonical root
6. Workspace mirror treated as authority
7. Validator that checks one authority plane while ignoring siblings
8. Route mutation without corresponding proof-plan mutation
9. Backward compatibility path that restores retired authority

---

## Recovery Identity for `reconciliation_sha`

`reconciliation_sha` must be recovered from durable remote proof, not local `HEAD`.

The governed closeout commit must carry stable trailers:

- `Governance-Action: closeout`
- `Governance-Feature: phase<N>/<feature-slug>`
- `Governance-Merge-SHA: <full merge commit sha>`

Recovery rule:

- query only `origin/<base_branch>`
- match all three trailers
- require exactly one matching commit
- zero or more than one is blocking ambiguity

This is stronger than using a loose subject-line grep and keeps the derivation route deterministic.

---

## Mandatory Route Inventory Before Coding

Before implementation begins, expand every authority-bearing field and artifact across all affected routes.

### Writers, readers, validators, derivations, and recovery surfaces to audit

Implement-plan:

- `prepare`
- `update-state`
- `record-event`
- `reset-attempt`
- `mark-complete`
- `normalize-completion-summary`
- `validate-closeout-readiness`
- state load and normalization
- state hydration for status/reporting
- `reconcile`
- `commit-closeout`
- `validate-pre-commit`
- features-index sync
- agent-registry sync

Merge-queue:

- `enqueue`
- `process-next`
- `resume-blocked`
- `validateCloseoutReadinessBeforeMerge`
- `persistMergedFeatureCloseout`
- closeout workspace selection

Review-cycle:

- state writes
- verdict/approval readers
- any helper or doc path that still implies review-cycle commit authority

Status/reporting:

- helper JSON output
- summary generators
- index builders
- any direct state-file readers found by repo-wide search

### Repo-wide search gate

Before Phase 1 implementation starts, run a repo-wide search for at least:

- `detectCurrentBranch(`
- `last_commit_sha`
- `active_run_status`
- `review-cycle-state.json`
- `features-index.json`
- `agent-registry.json`
- `git log`
- `origin/HEAD`
- worktree-root artifact path selection

No phase is complete until all sibling authority sites in scope are accounted for.

---

## Implementation Phases

## Phase 0: Contract Freeze and Contradiction Gate

Purpose:

- freeze the ownership model
- freeze the route inventory
- stop semantic drift before code changes start

Changes:

1. Update `skills/implement-plan/references/workflow-contract.md` with the truth classes, field ownership, artifact ownership, four authority planes, and frozen invariants from this plan.
2. Update `skills/merge-queue/references/workflow-contract.md` with base-branch immutability, fresh-ref rules, closeout durability rules, and blocked-lane restrictions.
3. Update `skills/review-cycle/references/workflow-contract.md` to freeze the review-only evidence boundary and explicitly de-authorize review-cycle commit fields as lifecycle truth.
4. Add a mandatory contradiction gate to the plan delivery checklist:
   - ownership tables vs phase steps
   - claimed route vs mutated route vs proved route
   - invariants vs backward compatibility notes
   - verification vs implementation route
   - persisted schema vs hydrated view
   - recovery rules vs durability rules

Proof obligations:

- one concept has one meaning in all docs
- all changed routes and sibling branches are listed
- any remaining internal contradiction blocks implementation start

## Phase 1: Wrong-code-landing blockers

Purpose:

Remove any route that can land the wrong code on main before deeper refactors begin.

Changes:

1. In `skills/merge-queue/scripts/merge-queue-helper.mjs`, remove stale-ref fallback after failed fetch.
2. In `skills/governed-feature-runtime.mjs`, resolve default base branch from `origin/HEAD` only.
3. In `skills/implement-plan/scripts/implement-plan-helper.mjs`, reject `base_branch` mutations after initial set.
4. In `skills/merge-queue/scripts/merge-queue-helper.mjs`, remove `resume-blocked` lane retargeting.
5. Keep any fresh base ref evidence in-process only. Do not persist it into queue state or feature state.

Proof obligations:

- fetch failure with local refs present blocks
- wrong checkout branch does not affect `base_branch`
- blocked request cannot change lane

Failure isolation:

- if work stops here, wrong-code-landing risk is removed even though the old closeout path still exists

## Phase 2: Physical authority and canonical storage

Purpose:

Resolve split physical authority before changing field semantics.

Changes:

1. Add `resolveCanonicalStatePaths()` to `skills/implement-plan/scripts/implement-plan-helper.mjs`.
2. Refactor all full-pattern worktree-preference sites to use canonical-root resolution.
3. Refactor partial sites so worktree paths remain execution-time references only, never authority selectors.
4. Make cache writers resolve canonical project root only and fail closed if canonical resolution fails.
5. Keep `.superseded` as a local-only hint written in the worktree feature directory only.
6. Ensure post-merge readers never regain worktree authority even when stale worktree artifacts still exist.

Proof obligations:

- queued feature with no `merge_commit_sha` reads from worktree
- feature with `merge_commit_sha` reads from repo-root
- cache writes from worktree context resolve to canonical root or fail
- `.superseded` absence does not beat `merge_commit_sha`

Failure isolation:

- if work stops here, the route has one physical authority source even though older schema semantics still remain

## Phase 3: State model hardening and semantic split

Purpose:

Eliminate hybrid field semantics and separate persisted schema from runtime hydration.

Changes:

1. Bump the persisted state schema version.
2. Add `review_closeout_sha` as explicit committed lifecycle truth.
3. Add `execution_status` as the only persisted execution-domain status.
4. Remove persisted authority semantics for:
   - `reconciliation_sha`
   - `last_commit_sha`
   - `active_run_status`
5. Hydrate compatibility `last_commit_sha` and compatibility `active_run_status` on read only.
6. Remove merge-queue writes to `active_run_status`; merge-queue writes only its owned lifecycle fields.
7. Narrow event sync so structured events influence execution-domain fields only through implement-plan-owned sync logic.
8. Normalize SHAs through a single canonicalization function.
9. Remove direct writer acceptance of `--last-commit-sha` in new code paths.
10. Migrate old states by:
    - reading legacy `last_commit_sha` only to infer missing explicit fields when unambiguous
    - reading legacy `active_run_status` only to map execution-domain values into `execution_status`
    - refusing to let legacy aliases regain authority after normalization

Proof obligations:

- persisted schema contains no `reconciliation_sha`
- new writers do not set `last_commit_sha`
- merge-queue no longer writes execution-domain status
- old states normalize correctly without restoring alias authority

Failure isolation:

- if work stops here, state semantics are cleaner and safer even before reconcile/closeout refactor lands

## Phase 4: Domain-scoped reconcile and multi-plane validation

Purpose:

Create one governed repair path and one validator that reasons across all authority planes.

Changes:

1. Add `reconcile` to `skills/implement-plan/scripts/implement-plan-helper.mjs`.
2. Make reconcile:
   - resolve canonical root first
   - load artifacts from canonical source
   - apply domain-scoped precedence, not a global ladder
   - block on cross-domain contradictions instead of silently overriding
   - clear stale `last_error` on successful completion
   - hydrate derived `reconciliation_sha` and compatibility `last_commit_sha`
   - sync caches to canonical root only
   - write `.superseded` as local hint when appropriate
3. Add `validate-pre-commit` and make it check:
   - truth-source correctness
   - physical-authority correctness
   - remote-durability correctness
   - derivation ambiguity correctness
   - backward compatibility normalization correctness
4. Wire validator into:
   - `commit-closeout`
   - merge-queue readiness checks

Proof obligations:

- reconcile repairs same-domain contradictions with provenance
- cross-domain contradictions block and surface
- validator fails on wrong-root, wrong-plane, stale, or ambiguous proof

Failure isolation:

- if work stops here, a governed repair path exists and bad states are fail-safe blocked

## Phase 5: Governed closeout and remote durability

Purpose:

Replace raw closeout git with a governed, remotely provable closeout route.

Changes:

1. Add `commit-closeout` to `skills/implement-plan/scripts/implement-plan-helper.mjs`.
2. Sequence it strictly:
   1. reconcile canonical root
   2. choose commit workspace
   3. mirror reconciled canonical feature artifacts and canonical caches into workspace
   4. validate workspace mirror
   5. stage feature root and canonical caches
   6. create governed closeout commit with stable trailers
   7. push to `origin/<base_branch>`
   8. on success, return runtime-derived `reconciliation_sha`
   9. write local `.superseded` hint best-effort
3. Remove raw `git add/commit/push` closeout logic from `merge-queue`.
4. Make recovery of `reconciliation_sha` use `origin/<base_branch>`, never local `HEAD`.
5. Enforce the closeout uniqueness rule:
   - exactly one matching remote closeout commit per merged feature route
   - extra candidates are blocking defects, not tie-break candidates to silently choose from

Proof obligations:

- push failure does not create false durable closeout truth
- fresh clone can derive `reconciliation_sha` from remote proof
- workspace mirror never becomes a second truth source
- staging always reflects reconciled canonical state

Failure isolation:

- if work stops here, closeout is fully governed and durable proof no longer depends on local state

## Phase 6: Backfill, retirement, and cleanup

Purpose:

Converge existing streams and remove temporary compatibility bridges after the runtime route is proven.

Changes:

1. Run reconcile across all existing feature streams and produce a convergence report.
2. Rewrite or rebuild caches from canonical sources.
3. Remove or retire remaining direct file consumers of legacy aliases.
4. Remove temporary compatibility bridges once all in-repo readers are migrated.
5. Close model-retirement docs that previously claimed conflicting authority models.

Proof obligations:

- all existing streams converge without manual repair
- no repo-internal route still relies on persisted `last_commit_sha` or persisted `active_run_status`

This phase is intentionally separate from the runtime hardening release.

---

## Hostile-case Proof Matrix

Every hardened route must have explicit hostile-case coverage.

- fetch fails while stale local refs exist -> block
- local checkout on wrong branch -> base-branch authority unaffected
- blocked request tries to retarget lane -> reject
- feature queued but not merged -> worktree authoritative
- feature merged but stale worktree still exists -> repo-root authoritative
- cache write attempted from worktree root -> resolve to canonical root or fail
- old state file contains legacy `last_commit_sha` only -> normalize without restoring alias authority
- old state file contains legacy merge-route `active_run_status` -> map to owned lifecycle fields and derived compatibility view, not authoritative status
- reconcile sees execution-vs-lifecycle contradiction -> block, do not auto-resolve across domains
- closeout commit exists locally but push fails -> not durable, do not derive `reconciliation_sha`
- recovery query finds zero closeout commits -> block
- recovery query finds multiple closeout commits -> block
- workspace mirror becomes stale after copy -> canonical root still wins
- `.superseded` missing after successful push -> harmless, no authority regression

---

## Mandatory Final Contradiction Sweep

No implementation or revised plan is review-ready until this sweep passes.

Check for:

- old model wording surviving anywhere
- one field or artifact carrying two meanings
- phase steps contradicting ownership tables
- persisted schema contradicting hydrated view
- validation proving an older route than the route being changed
- backward-compat notes restoring retired authority
- recovery rules using local proof when remote proof is required
- workspace mirror described as anything stronger than staging material

If any contradiction remains, the plan is not ready for execution.

---

## Definition of Done

The runtime hardening is done only when all of the following are true:

1. Wrong-code-landing blockers are removed.
2. Canonical root selection is consistent across all in-scope read/write paths.
3. Persisted schema and hydrated runtime view are explicitly separated.
4. `reconciliation_sha` is runtime-derived only.
5. `last_commit_sha` is no longer a writable authority path.
6. merge-queue no longer writes execution-domain status.
7. Reconcile exists and is domain-scoped.
8. Validator covers truth source, physical authority, remote durability, and ambiguity.
9. Closeout is governed, remotely provable, and fail-safe on push failure.
10. A final contradiction sweep passes.

---

## Files In Scope

Core implementation files:

- `skills/implement-plan/scripts/implement-plan-helper.mjs`
- `skills/merge-queue/scripts/merge-queue-helper.mjs`
- `skills/governed-feature-runtime.mjs`
- `skills/review-cycle/scripts/review-cycle-helper.mjs`

Core contract files:

- `skills/implement-plan/references/workflow-contract.md`
- `skills/merge-queue/references/workflow-contract.md`
- `skills/review-cycle/references/workflow-contract.md`
- `skills/implement-plan/SKILL.md`

This plan file itself is part of the contract surface and must stay consistent with the implementation contracts.
