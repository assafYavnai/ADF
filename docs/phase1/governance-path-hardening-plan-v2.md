# Fix implement-plan Governance Path: A-to-Z Sweep

## Context

The implement-plan governance path from feature initiation through merge-to-main has accumulated systemic defects that compound with each slice. The implementor post-mortem for `coo-live-executive-status-wiring`, audit findings (cycles 08-10), run post-mortems (010, 017, 018), and five executive plan reviews confirm: the product bugs are straightforward, but governance closeout repair consumes most cycle time. The backlog grows instead of shrinking.

**Root cause**: Split physical authority across four planes — truth source, storage root, commit workspace, and remote durability proof — combined with multiple uncoordinated writers and no frozen ownership model. Prior plan revisions fixed individual endpoints but left sibling defects alive in the same class, causing repeated review cycles.

**Goal**: One sweep (Phases 0-5) that fixes the runtime governance path. Backfill is a separate bounded follow-up. This revision was rebuilt from a complete field/artifact ownership model rather than patching prior text.

**Review history**: Full diff of all prior review cycles is in git history. This revision does not carry forward stale wording — it was rewritten from the ownership model below.

---

## Artifact & Field Ownership Model

This model is the single source from which every phase, invariant, verification step, and backward-compat rule is derived. If a section contradicts this model, this model wins.

### Truth Classes

| Class | Definition | Durability | Example |
|-------|-----------|------------|---------|
| **Committed lifecycle truth** | Stored in feature-local artifacts, pushed to origin | Survives fresh clone | `approved_commit_sha`, `merge_status`, `feature_status` |
| **Committed execution truth** | Append-only execution events, pushed to origin | Survives fresh clone | Structured events under `implementation-run/` |
| **Runtime-derived truth** | Deterministically recoverable from committed evidence | Must be re-derived after clone | `reconciliation_sha` (from git log), `last_commit_sha` (from SHA matrix) |
| **Committed operational residue** | Stored in committed state but not authoritative for lifecycle decisions | Survives clone but readers must not treat as lifecycle truth | `local_target_sync_status`, `last_error` |
| **Local operational hint** | Valid only in current checkout, not committed | Lost on fresh clone | `.superseded` marker, `fresh_base_ref_sha` (in-process only) |
| **Projection/cache** | Aggregated from authoritative sources, rebuildable | Can be deleted and rebuilt | `features-index.json`, `agent-registry.json`, `run-projection.v1.json` |
| **Human-readable output** | Documentation, never authoritative over machine state | Committed but not truth | `completion-summary.md` |
| **Review-only evidence** | Verdict/approval facts from review-cycle | Committed but scoped | `review-cycle-state.json` (verdicts only) |

### Field Ownership Matrix

| Field | Truth Class | Sole Writer | Allowed Readers | Physical Root | Remote Proof | Proposed Change |
|-------|------------|-------------|-----------------|---------------|-------------|-----------------|
| `approved_commit_sha` | Committed lifecycle | implement-plan `update-state` | merge-queue enqueue, process-next, closeout validation, mark-complete | Feature root in state.json | origin/feature-branch ancestry | No change — already correct |
| `merge_commit_sha` | Committed lifecycle | merge-queue `process-next` only | implement-plan mark-complete, closeout, status | Feature root in state.json | origin/base-branch ancestry | No change — already correct |
| `review_closeout_sha` | Committed lifecycle | implement-plan `update-state` (new) | reconcile, status | Feature root in state.json | origin/feature-branch ancestry | **New field** |
| `reconciliation_sha` | **Runtime-derived** | Never written to artifacts | reconcile, status (derive from git log) | Not stored — derived from `git log --grep` on base branch after merge_commit_sha | origin/base-branch commit message pattern | **New field, Option A** |
| `last_commit_sha` | **Runtime-derived** (compatibility alias) | Never directly authored by new code | Legacy callers only | Derived on read from SHA precedence chain | Derived from other fields | **Change: derived-only** |
| `base_branch` | Committed lifecycle | implement-plan `prepare` (set once) | All merge-queue operations, closeout, status | Feature root in state.json | refs/remotes/origin/{base_branch} | **Change: immutable after set, derived from origin/HEAD not checkout** |
| `merge_status` | Committed lifecycle | merge-queue (all transitions) | implement-plan canonical-root decision, mark-complete, status | Feature root in state.json | Implicit in state on origin | No change to semantics |
| `feature_status` | Committed lifecycle | implement-plan lifecycle commands only | Everywhere | Feature root in state.json | State on origin | No change |
| `active_run_status` | Committed lifecycle | implement-plan only (sole writer; structured events contribute via `syncLegacyNormalStateFromRun()` inside implement-plan, not as an independent writer) | State machine driver | Feature root in state.json | State on origin | **Change: events inform run-step values through implement-plan's sync function; events never write state directly** |
| `local_target_sync_status` | Committed operational residue | merge-queue sync step | mark-complete eligibility check (but not lifecycle authority) | Feature root in state.json | Committed but not authoritative | No change to storage; **readers must not treat as lifecycle truth** |
| `last_error` | Committed operational residue | Multiple (validation failures, git errors) | Status, debugging (but not lifecycle authority) | Feature root in state.json | Committed but not authoritative | **Change: cleared on completion by reconcile** |
| `fresh_base_ref_sha` | **In-process ephemeral** (not persisted anywhere) | merge-queue `process-next` (new) | merge-base check, worktree creation within same execution | In-memory only — not in queue, not in state | Not stored | **New, ephemeral to process-next execution only** |

### Artifact Ownership Matrix

| Artifact | Truth Class | Sole Writer(s) | Physical Root | Lock | Durability |
|----------|------------|-----------------|---------------|------|------------|
| `implement-plan-state.json` | Committed lifecycle | implement-plan GSW, merge-queue via update-state | Feature root (canonical per I-1) | Feature-slug lock | Pushed to origin |
| `review-cycle-state.json` | Review-only evidence | review-cycle skill | Feature root | None (no contention) | Pushed to origin |
| `run-projection.v1.json` | Projection/cache | implement-plan | Per-run dir under feature root | None | Rebuildable |
| `execution-contract.v1.json` | Committed execution | implement-plan prepare | Feature root + per-run copy | None | Pushed to origin |
| `completion-summary.md` | Human-readable output | Implementation agent, normalize command | Feature root | None | Pushed to origin |
| `features-index.json` | Projection/cache | implement-plan sync (project-level lock) | Canonical project root only | `features-index` lock | Rebuildable |
| `agent-registry.json` | Projection/cache | implement-plan sync (project-level lock) | Canonical project root only | `agent-registry` lock | Rebuildable |
| `.superseded` marker | Local operational | mark-complete, reconcile, commit-closeout | Worktree feature dir | None | Not pushed — local hint only |

### Four Authority Planes

Every artifact and transition must be evaluated across all four:

| Plane | Question | Rule |
|-------|----------|------|
| **Truth source** | Which copy is authoritative for reads? | Per I-1: repo-root once `merge_commit_sha != null` |
| **Storage root** | Where does the authoritative copy physically live? | Feature root under canonical project root |
| **Commit workspace** | Which checkout stages the governed commit? | Whichever is clean (merge worktree or synced main) |
| **Remote durability** | What proves the truth survived? | origin/base-branch ancestry for merge/closeout commits |

---

## Frozen Invariants

Derived from the ownership model. If a phase or section contradicts these, the invariant wins.

**I-1. Canonical Root Rule:**

*Truth source* (which copy is authoritative for reads):
- Before `merge_commit_sha` exists (null): worktree is canonical for active execution artifacts
- Once `merge_commit_sha != null`: repo-root is canonical for all lifecycle truth
- Pre-merge states (`ready_to_queue`, `queued`, `in_progress`, `blocked`) do NOT flip authority — the feature is not yet merge-backed
- `.superseded` is a local operational hint that accelerates the decision; its absence means "legacy/unresolved" — repo-root still wins if `merge_commit_sha != null`
- Scope: only applies to post-prepare governed routes

*Commit workspace* (which checkout creates the governed commit):
- Closeout may execute from merge worktree or synced main (whichever is clean)
- `commit-closeout` reconciles canonical state first, THEN copies reconciled state into commit workspace, THEN validates the workspace copy
- Commit workspace is NOT an authority source — it is a staging mirror of already-reconciled canonical truth
- Workspace copy does NOT create a second truth source — it is consumed by the commit and then irrelevant

**I-2. SHA Authority Matrix:**
```
approved_commit_sha   → Committed lifecycle truth. Set by implement-plan. Sole pre-merge landing authority.
merge_commit_sha      → Committed lifecycle truth. Set by merge-queue only. Sole merge-result truth.
review_closeout_sha   → Committed lifecycle truth. Set by implement-plan. Review-cycle closeout artifact commit.
reconciliation_sha    → Runtime-derived truth. NEVER stored in artifacts. Derived from git log on base branch.
last_commit_sha       → Runtime-derived compatibility alias. NEVER directly authored. Derived on read:
                         reconciliation_sha ?? merge_commit_sha ?? approved_commit_sha ?? review_closeout_sha
```

**I-3. Review-Cycle Boundary:**
- review-cycle-state.json contributes verdict and approval evidence ONLY
- implement-plan-state.json owns lifecycle truth
- review-cycle `last_commit_sha` is local operational state, never lifecycle authority
- `evaluateCloseoutGovernanceTruth()` reads verdict/approval fields, ignores review-cycle `last_commit_sha`

**I-4. Fresh-Ref Rule:**
- Merge authorization requires a successful `git fetch`. Stale local refs are never sufficient.
- `fresh_base_ref_sha` is captured after fetch and used within that `process-next` execution. It is ephemeral — not persisted in queue state, not consumed by later operations.

**I-5. Base-Branch Immutability:**
- `base_branch` is resolved from `origin/HEAD` (never checkout state), set once during `prepare`, and immutable for the feature's lifecycle.
- merge-queue `resume-blocked` cannot retarget to a different base branch. To change lane, cancel and re-enqueue.

**I-6. `reconciliation_sha` Recovery:**
- Derived via: `git log --format=%H --grep="governed closeout \[merge:<merge_commit_sha_short>\]" <merge_commit_sha>..origin/<base_branch> -- <feature-root>`
- **Success**: exactly one result
- **Zero results**: closeout commit missing or message pattern corrupted → block, surface error
- **Multiple results**: ambiguous → use first direct descendant of `merge_commit_sha` on base branch. If still ambiguous → block, surface error
- **Never guess**. Ambiguity is a first-class failure mode.

---

## Forbidden Defect Classes

Every phase must be checked against these. If a change introduces any of these, it is a defect regardless of which endpoint it fixes.

1. **Mutable route authority from local checkout state** — any field or decision derived from `git branch --show-current` or equivalent
2. **Field authored by more than one tool without frozen ownership** — violates sole-writer rule in ownership matrix
3. **Derived alias still writable directly** — `last_commit_sha` must never be set, only computed
4. **Runtime-derived truth not fail-closed on ambiguity** — zero or multiple candidates must block
5. **Cache or shared registry written from non-canonical root** — caches go to canonical project root only
6. **Validator checks one domain but ignores sibling domains** — every validator must check all four authority planes
7. **Proxy evidence replacing first-class evidence** — inferring "what probably happened" instead of proving "what did happen"
8. **Route widened without reopening route contract and proof plan** — every changed route gets a proof obligation

---

## Phase 0: Route Authority (Wrong-Code-Landing Blockers)

**Issues**: Stale-fetch bypass (merge-queue-helper.mjs:367), mutable base-branch (governed-feature-runtime.mjs:733), resume-blocked lane retargeting (merge-queue-helper.mjs:516-549)

**File: `skills/merge-queue/scripts/merge-queue-helper.mjs`**

1. **Fail-closed fetch** (line 367-368) — `if (fetchResult.status !== 0)` → block request. No stale-ref fallback.

2. **Capture `fresh_base_ref_sha`** — After fetch, `git rev-parse origin/<base_branch>`. Use in merge-base check (line 372) and worktree creation (line 399). Ephemeral to this process-next execution.

3. **Block resume-blocked lane migration** (line 516-549) — Remove `input.baseBranch` override. Blocked requests can get new `approved_commit_sha` but cannot change `base_branch`. Lane retarget requires cancel + re-enqueue.

**File: `skills/governed-feature-runtime.mjs`**

4. **Fix base-branch resolution** (line 733) — `detectOriginHeadBranch(projectRoot) ?? "main"`. Remove `detectCurrentBranch()` from chain.

**File: `skills/implement-plan/scripts/implement-plan-helper.mjs`**

5. **Base-branch immutability guard** — In `update-state`, reject changes to `base_branch` after initial set.

**File: `skills/implement-plan/references/workflow-contract.md`**

6. Document I-4, I-5, and the route authority invariants.

**Proof obligations**: Fetch failure + stale refs → blocked. Wrong checkout branch → base_branch unaffected. Resume-blocked with new base_branch → rejected.

---

## Phase 1: Physical Authority

**Issues**: 6 full-pattern worktree-preference sites (lines 1126, 1407, 1563, 1728, 2071, 2130), 3 partial sites (562, 727, 946), no worktree retirement, duplicated global caches

**File: `skills/implement-plan/scripts/implement-plan-helper.mjs`**

1. **Non-circular canonical-root selector** — `resolveCanonicalStatePaths(paths, input)`:
   - Read repo-root `merge_commit_sha` (always exists after prepare — this phase only covers post-prepare routes)
   - If `merge_commit_sha` is null AND worktree exists AND no `.superseded` → worktree canonical
   - If `merge_commit_sha` is non-null → repo-root canonical
   - If resolution fails → fail closed

2. **Refactor all 6 full-pattern sites** — Replace worktree-preference conditional with `resolveCanonicalStatePaths()`.

3. **Annotate 3 partial sites** (562, 727, 946) — Comment that these are execution-time worktree references, not authority sources.

4. **Worktree retirement** — `mark-complete` writes `.superseded` (local operational, not committed). Old worktrees without marker: repo-root wins via `merge_commit_sha` rule.

5. **Canonical-only cache writes** — `syncFeaturesIndex()` and `syncAgentRegistry()` resolve canonical project root via `git worktree list --porcelain`. Fail closed if resolution fails.

**File: `skills/implement-plan/references/workflow-contract.md`**

6. Document I-1 with the four-plane model.

**Proof obligations**: Feature in queued state → worktree still canonical. Feature with merge_commit_sha → repo-root canonical. Old worktree without `.superseded` → repo-root wins. Cache write from worktree → resolves to canonical root or fails.

---

## Phase 2: SHA Model + Truth Domains

**Issues**: `last_commit_sha` overload (13/6/3 split across streams), no SHA normalization, review-cycle uncoordinated writer, skipLock, mixed truth domains

**File: `skills/implement-plan/scripts/implement-plan-helper.mjs`**

1. **Bump schema to v3** (line 205)

2. **Add field**: `review_closeout_sha: null` (committed lifecycle truth per ownership model). `reconciliation_sha` is NOT added to the persisted schema — it is runtime-derived per I-6 and hydrated on read, never stored on disk.

3. **SHA normalization** — `canonicalizeSha(projectRoot, sha)`: `git rev-parse` → 40-char, fallback `git cat-file -t`, reject on failure. Applied at ALL write paths: lines 1241, 1519, 1754, new fields.

4. **v2→v3 migration** — Default new fields to null. Derive `last_commit_sha` per I-2. Opportunistically canonicalize abbreviated SHAs on load.

5. **Freeze I-2 as code constants**

6. **`markComplete()` (line 1754)** — `input.mergeCommitSha ?? next.merge_commit_sha ?? input.lastCommitSha ?? next.last_commit_sha`

7. **Remove `skipLock: true`** (line 281) — Use feature-level lock.

8. **Narrow structured-events domain** (`syncLegacyNormalStateFromRun()` ~line 4382):
   - Events own: `active_run_status`, `run_timestamps`, `attempt.*`, `last_completed_step` (run/attempt steps)
   - Events do NOT own: `merge_status`, `merge_commit_sha`, `approved_commit_sha`, `feature_status`, `base_branch`, `local_target_sync_status`

**File: `skills/merge-queue/scripts/merge-queue-helper.mjs`**

9. Line 856: `merge_commit_sha: mergeCommitSha` (not `last_commit_sha`)
10. Line 860: Pass `--merge-commit-sha`

**File: `skills/review-cycle/scripts/review-cycle-helper.mjs`**

11. Boundary comments at lines 788 and 909

**File: `skills/review-cycle/references/workflow-contract.md`**

12. Freeze I-3 as contract rule

**File: `skills/implement-plan/scripts/implement-plan-helper.mjs`**

13. **Code-path enforcement** — `evaluateCloseoutGovernanceTruth()` explicitly ignores review-cycle `last_commit_sha`.

**File: `skills/implement-plan/references/workflow-contract.md`**

14. Schema docs for all fields per ownership matrix

**Proof obligations**: v2 state loads correctly. Abbreviated SHA canonicalized. `last_commit_sha` never directly set. Concurrent writes serialized. Events cannot set merge_status/merge_commit_sha. review-cycle last_commit_sha ignored in closeout evaluation.

---

## Phase 3: Reconcile + Artifact Precedence

**Issues**: No reconcile command, no precedence rules, stale fields survive completion

**File: `skills/implement-plan/references/workflow-contract.md`**

1. **Domain-scoped artifact precedence** (NOT a single global chain — each domain resolves independently):

   **Execution domain** (run/attempt/timestamp fields):
   - Structured events → run-projection → execution-contract → state compatibility fields
   - Only `reconcile` may propagate execution truth into lifecycle state

   **Lifecycle domain** (feature_status, merge_status, SHA fields, base_branch):
   - implement-plan-state.json explicit lifecycle facts only
   - Execution events cannot override lifecycle fields
   - merge-queue callbacks are the sole writer for merge_status/merge_commit_sha

   **Review domain** (verdicts, approval evidence):
   - review-cycle-state.json verdict/approval fields only
   - review-cycle `last_commit_sha` is NOT consumed as lifecycle truth

   **Cross-domain rule**: no domain may override another. If reconcile detects a field where execution truth contradicts lifecycle truth, it surfaces the contradiction as `"blocked"` — it does not auto-resolve across domain boundaries.

   **Non-authoritative artifacts** (projections, caches, summaries):
   - Never override any domain's truth
   - Rebuilt from authoritative sources

2. **Helper usage guide**: `update-state` (lifecycle), `record-event` (execution), `reconcile` (post-merge alignment), `commit-closeout` (governed closeout)

**File: `skills/implement-plan/scripts/implement-plan-helper.mjs`**

3. **`reconcile` command** — Under feature lock:
   1. Resolve canonical paths per I-1
   2. Load all artifacts from canonical source
   3. Apply precedence per domain (run truth, lifecycle truth, review evidence)
   4. Per field: `{ field, truth_class, authoritative_source, old_value, new_value, action }`
   5. Clean stale `last_error` if completed
   6. Recompute derived fields (`last_commit_sha`, attempt to derive `reconciliation_sha` per I-6)
   7. Write state atomically
   8. Sync caches to canonical project root
   9. Write `.superseded` if completed/merged and worktree exists
   10. Return contradiction report with per-field provenance

**File: `skills/implement-plan/SKILL.md`**

4. Document `reconcile`

**Proof obligations**: Known contradictions → all repaired with provenance. Stale `last_error` → cleared. `reconciliation_sha` → derived from git or surfaced as missing. Caches → canonical root only.

---

## Phase 4: Governed Closeout

**Issues**: Raw git in closeout (merge-queue-helper.mjs:890-922), dirty checkout interference

**File: `skills/implement-plan/scripts/implement-plan-helper.mjs`**

1. **`commit-closeout` command** — Accepts: `--project-root`, `--phase-number`, `--feature-slug`, `--base-branch`, `--merge-commit-sha`

   Steps:
   1. Refuse if `--base-branch` differs from persisted state (I-5)
   2. Call `reconcileSlice()` on canonical project root first (ensures canonical truth is consistent before any copy)
   3. Determine commit workspace (merge worktree if main dirty, synced main otherwise)
   4. Copy reconciled canonical feature-root state AND canonical caches into commit workspace (workspace is now a mirror of already-reconciled truth)
   5. Call `validatePreCommit()` in commit workspace — fail if contradictions (catches any copy/sync errors)
   6. Stage: `git add --all -- <feature-root>` + `git add -- .codex/implement-plan/features-index.json .codex/implement-plan/agent-registry.json`
   7. Commit: `docs(phase<N>/<feature-slug>): governed closeout [merge:<merge_sha_short>]`
   8. Push to `origin/<base-branch>`
   9. On push failure → fail closed, do not record reconciliation_sha locally
   10. On push success → `reconciliation_sha` returned in-session; future reads derive per I-6
   11. Write `.superseded` if worktree exists
   12. Return `{ reconciliation_sha, push_status, contradictions_repaired }`

   **Crash analysis** (per step boundary):
   - After step 2 (reconcile on canonical), before copy → canonical state improved, workspace not yet touched, no harm
   - After step 4 (copy), before validate → workspace has a snapshot of canonical truth; if process dies, workspace is stale but canonical is consistent
   - After step 5 (validate), before commit → validation passed, commit not yet created, no harm
   - After step 6 (commit), before push → local commit exists in workspace but not durable; next reader cannot recover `reconciliation_sha` from origin (correct)
   - After step 7 (push), before `.superseded` → push landed, `.superseded` missing is harmless because `merge_commit_sha` rule governs authority
   - Multiple retry attempts → each governed closeout commit has unique merge SHA in message pattern; I-6 tie-break selects first descendant of `merge_commit_sha`

**File: `skills/merge-queue/scripts/merge-queue-helper.mjs`**

2. **Delete `commitAndPushFeatureCloseout()`** (line 890-922). Replace with `commit-closeout` call.

3. **Simplify `persistMergedFeatureCloseout()`** (line 835): update-state → mark-complete → commit-closeout.

**File: `skills/implement-plan/SKILL.md`**

4. Closeout policy: raw git prohibited in closeout path.

**Proof obligations**: Closeout from merge worktree stages canonical state (not stale workspace). Push failure → no false `reconciliation_sha`. `reconciliation_sha` recoverable from fresh clone via I-6 query (exactly one result). Staged files include feature root + caches.

---

## Phase 5: Drift Validator

**Issues**: No pre-commit validation, stale fields survive, no physical authority checks

**File: `skills/implement-plan/scripts/implement-plan-helper.mjs`**

1. **`validate-pre-commit` command** — Checks across all four authority planes:

   **Truth-source checks:**
   - Review-cycle completion vs implement-plan review gate
   - All SHA fields internally consistent per I-2
   - Merge truth consistent (`merge_commit_sha` ↔ `merge_status` ↔ `local_target_sync_status`)
   - Events own only run-truth fields, not lifecycle fields
   - `last_error` null if completed

   **Physical-authority checks:**
   - If `merge_commit_sha != null` but worktree is being read as authority → fail
   - If caches exist under worktree path → fail
   - If completed but worktree exists without `.superseded` → warn (legacy compat)

   **Remote-durability checks:**
   - `approved_commit_sha` must be ancestry of origin/feature-branch (if verifiable)
   - `merge_commit_sha` must be ancestry of origin/base-branch (if verifiable)

   Returns: `{ valid, contradictions: [{ field, expected, actual, source_a, source_b, plane: "truth"|"physical"|"remote" }] }`

2. Wired into `commit-closeout` (Phase 4 step 5) and `validateCloseoutReadinessBeforeMerge()` in merge-queue.

**File: `skills/implement-plan/references/workflow-contract.md`**

3. Hostile-state proof catalog: fetch failure, wrong branch, merged-but-unsynced, stale worktree, stale workspace, concurrent writes, push failure, ambiguous recovery.

**Proof obligations**: Each forbidden defect class from the list above has at least one hostile-case test. Validator catches truth, physical, and remote violations.

---

## Phase 6: Operational Hygiene — SEPARATE BOUNDED FOLLOW-UP

Not part of core runtime fix. Planned and executed after Phases 0-5 land and are verified.

Scope: Brain dedup, helper usage docs, findings triage lifecycle, stale discussion cleanup, model retirement notes, backfill reconcile on all 26 streams.

---

## Files Modified

| File | Phases | Nature |
|------|--------|--------|
| `skills/merge-queue/scripts/merge-queue-helper.mjs` | 0,2,4,5 | Fail-closed fetch, block lane retarget, explicit SHA fields, delegate closeout, wire validation |
| `skills/governed-feature-runtime.mjs` | 0 | Base-branch from origin/HEAD only |
| `skills/implement-plan/scripts/implement-plan-helper.mjs` | 0,1,2,3,4,5 | Base-branch immutability, canonical-root selector (9 sites), SHA fields+normalization, remove skipLock, narrow events domain, reconcile, commit-closeout, validate-pre-commit |
| `skills/review-cycle/scripts/review-cycle-helper.mjs` | 2 | Boundary comments |
| `skills/review-cycle/references/workflow-contract.md` | 2 | Frozen boundary contract (I-3) |
| `skills/merge-queue/references/workflow-contract.md` | 0 | Route authority docs |
| `skills/implement-plan/references/workflow-contract.md` | 0,1,2,3,4,5 | All invariants, ownership model, precedence, hostile proofs |
| `skills/implement-plan/SKILL.md` | 3,4 | New commands, closeout policy |

---

## Verification Plan

Each bullet proves the claimed route, not just the happy path.

**Phase 0**: Fetch fails + local ref exists → blocked. Checkout on wrong branch → base_branch from origin/HEAD. Persisted base_branch change attempt → rejected. Resume-blocked with new base_branch → rejected (must cancel + re-enqueue).

**Phase 1**: Feature with `merge_commit_sha == null` in queued state → worktree canonical. Feature with `merge_commit_sha != null` → repo-root canonical. Old worktree without `.superseded` + `merge_commit_sha` set → repo-root wins. Cache write from worktree context → resolves to canonical root or fails closed.

**Phase 2**: v2 state → v3 defaults. Abbreviated SHA → 40-char canonicalized. `last_commit_sha` derived, never set. `skipLock` removed → concurrent writes serialized. Events try to set `merge_status` → rejected. `evaluateCloseoutGovernanceTruth()` → ignores review-cycle `last_commit_sha`.

**Phase 3**: Known contradictions → reconcile repairs all, reports per-field provenance. `last_error` on completed feature → cleared. `reconciliation_sha` → derived from git per I-6 or surfaced as missing.

**Phase 4**: Reconcile runs on canonical root first → then copied to workspace → then validated in workspace → then staged and committed. Push failure → no false `reconciliation_sha`. Push success → `reconciliation_sha` returned in-session, recoverable from fresh clone via I-6. Staged files = feature root + caches. Crash after reconcile but before copy → canonical improved, workspace untouched. Crash after copy but before push → workspace stale, canonical consistent. Crash after push → `.superseded` missing is harmless.

**Phase 5**: Truth contradiction → caught. Physical authority violation (worktree read after merge) → caught. Cache under worktree path → caught. Completed feature with stale `last_error` → caught. Each forbidden defect class has a hostile-case proof.

**Backfill (Phase 6)**: Reconcile on all 26 streams → convergence report → no manual repair needed.

---

## Failure Isolation

- **Phase 0 alone**: Wrong-code-landing risk eliminated. All existing closeout unchanged.
- **Phase 1 alone** (after 0): Split-authority resolved. Pre-merge features unaffected. Old worktrees handled by `merge_commit_sha` rule.
- **Phase 2 alone** (after 0-1): SHA model tightened. `last_commit_sha` still populated via derivation.
- **Phase 3 alone** (after 0-2): `reconcile` available. Does not change any route unless called.
- **Phase 4 alone** (after 0-3): Closeout fully governed. Merge-queue error handling catches `commit-closeout` failures.
- **Phase 5 alone** (after 0-4): Pre-commit checks block bad commits. Fail-safe by design.
- **Phase 6**: Separate follow-up. No runtime impact.
