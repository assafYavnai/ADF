# Fix implement-plan Governance Path: A-to-Z Sweep (v3)

## Context

The implement-plan governance path from feature initiation through merge-to-main has accumulated systemic defects that compound with each slice. The implementor post-mortem for `coo-live-executive-status-wiring`, audit findings (cycles 08-10), run post-mortems (010, 017, 018), and three executive plan reviews confirm: the product bugs are straightforward, but governance closeout repair consumes most cycle time. The backlog grows instead of shrinking.

**Root cause is not field overload — it is split physical authority.** The system has two physical roots (repo root + worktree), multiple active writers (implement-plan, review-cycle, merge-queue), no frozen authority matrix, and raw git operations where governed helpers should be used.

**Goal**: One sweep (Phases 0-5) that fixes the runtime governance path so every subsequent slice lands cleanly. Backfill of existing streams is a separate bounded follow-up.

---

## v3 Changes From v2 (review tightening)

1. **Canonical-root rule simplified to one invariant** — `merge_status != "not_ready"` → repo-root is canonical. No active_run_status mixing.
2. **Eliminated `closeout_commit_sha`** — only `reconciliation_sha` exists. One field, one commit, one meaning.
3. **Canonical-root discovery fails closed** — if canonical project root cannot be resolved, cache writes fail rather than silently writing to worktree.
4. **Backfill separated** — Phase 6 is now an explicitly separate bounded follow-up, not part of the core runtime fix.
5. **review-cycle boundary is a frozen contract rule** — written in `skills/review-cycle/references/workflow-contract.md`, not just inline comments.
6. **validate-pre-commit checks physical authority** — fails if worktree is being read as authority when repo-root should be canonical.
7. **`fresh_base_ref_sha` persisted in queue request record** — consumed by closeout/readiness checks, documented in merge-queue contract.
8. **`.superseded` marker backward compat** — no marker on old worktrees = "legacy/unresolved"; repo-root still wins after merge_status leaves `not_ready`.
9. **Phase 1 canonical-root selector is non-circular** — reads repo-root state first (always exists), then decides whether worktree state is also needed. Covers all 6 full-pattern sites + 3 partial sites.
10. **`reconciliation_sha` persisted via post-commit state update** — not inside the committed artifacts. No hidden second commit needed.
11. **Closeout stages feature root + canonical cache paths** — `.codex/implement-plan/features-index.json` and `.codex/implement-plan/agent-registry.json` are explicitly included.
12. **Fixed governed-feature-runtime.mjs path** — actual location is `C:/ADF/skills/governed-feature-runtime.mjs`, not under `skills/implement-plan/scripts/`.
13. **Added `skills/review-cycle/references/workflow-contract.md` and `skills/merge-queue/references/workflow-contract.md`** to modified-files list.

---

## Issues Addressed (Complete, Verified Against Live Code)

### Wrong-Code-Landing Risks (fix first)

| ID | Issue | Evidence | Severity |
|----|-------|----------|----------|
| A | **Stale-fetch authorization bypass** — merge-queue continues with cached local refs if `git fetch` fails but local branch exists | merge-queue-helper.mjs:367-368 | Critical |
| B | **Mutable base-branch authority** — `detectDefaultBaseBranch()` resolves from mutable checkout state | governed-feature-runtime.mjs:733-735 | Critical |

### Split Physical Authority (fix second)

| ID | Issue | Evidence | Severity |
|----|-------|----------|----------|
| C | **Worktree vs repo-root split reads** — 6 full-pattern sites prefer worktree when it exists | implement-plan-helper.mjs lines 1126, 1407, 1563, 1728, 2071, 2130 | Critical |
| D | **Stale worktree artifacts after merge** — no retirement/supersession rule | No retirement logic in any command | Critical |
| E | **Duplicated global caches** — features-index.json and agent-registry.json exist in both roots | 13 worktree-local index files, 30 worktree-local registry files | High |

### Truth Model Defects (fix third)

| ID | Issue | Evidence | Severity |
|----|-------|----------|----------|
| F | **`last_commit_sha` overloaded** — 13 streams last==merge, 6 last==approved, 3 distinct third value | Live artifact inspection | Critical |
| G | **SHA stored without normalization** — abbreviated SHAs persisted, no validation | implement-plan-helper.mjs:1241, 1519 | High |
| H | **No artifact authority precedence** — 12/26 streams have mismatched SHAs | Implementor report + live inspection | Critical |
| I | **Mixed truth domains** — structured events overwrite lifecycle fields | implement-plan-helper.mjs:4382 | High |
| J | **review-cycle has separate uncoordinated SHA writer** | review-cycle-helper.mjs:788, 909 | High |
| K | **Feature state writer skips locking** | implement-plan-helper.mjs:281 | High |

### Closeout Governance (fix fourth)

| ID | Issue | Evidence | Severity |
|----|-------|----------|----------|
| L | **Raw git in closeout** — git add/commit/push directly | merge-queue-helper.mjs:890-922 | Critical |
| M | **No single reconcile command** | Implementor report | Critical |
| N | **Closeout on dirty checkout** | Implementor report | High |

### Validation Gaps (fix fifth)

| ID | Issue | Evidence | Severity |
|----|-------|----------|----------|
| O | **No pre-commit drift validator** | Implementor report | High |
| P | **Stale error fields survive completion** | Live artifact inspection | Medium |
| Q | **No physical authority validation** | v3 review finding | High |

### Operational Noise (separate follow-up)

| ID | Issue | Evidence | Severity |
|----|-------|----------|----------|
| R | Brain duplication, untriaged findings, stale discussions | Brain search | Medium |
| S | No helper usage docs | Implementor report | Medium |

---

## Frozen Invariants (apply everywhere)

These rules are stated once and reused by every phase:

**I-1. Canonical Root Rule:**
- Before `merge_status` leaves `not_ready`: worktree may be canonical for active execution artifacts
- Once `merge_status` is anything other than `not_ready`: repo-root is canonical for all lifecycle truth
- Once feature is completed or reconciled: worktree is never authoritative again
- `.superseded` marker is an accelerator; absence means "legacy/unresolved" — repo-root still wins per the merge_status rule above

**I-2. SHA Authority Matrix:**
```
approved_commit_sha   → sole pre-merge landing authority (set by implement-plan)
merge_commit_sha      → merge-result truth (set by merge-queue only)
review_closeout_sha   → review-cycle closeout artifact commit
reconciliation_sha    → post-merge closeout/reconciliation commit on target
last_commit_sha       → DERIVED compatibility alias only, never directly authored
```

**I-3. Review-Cycle Boundary:**
- review-cycle-state.json contributes verdict and approval evidence ONLY
- implement-plan-state.json owns lifecycle truth
- review-cycle `last_commit_sha` is never lifecycle authority

**I-4. Fresh-Ref Rule:**
- Merge authorization requires a fresh-fetched base ref. Stale local refs are never sufficient.
- `fresh_base_ref_sha` is persisted in the queue request record and consumed by closeout/readiness checks.

**I-5. Base-Branch Immutability:**
- `base_branch` is resolved from `origin/HEAD` (never checkout state) and becomes immutable once persisted in feature state.

---

## Phase 0: Route Authority Contract (Issues A, B)

**Why first**: These can land wrong code on main. Fix before anything else.

### Changes

**File: `skills/merge-queue/scripts/merge-queue-helper.mjs`**

1. **Fail-closed fetch (line 367-368)** — Change to:
   ```js
   if (fetchResult.status !== 0) {
     return await failQueuedRequest(..., "Fetch failed. Refusing to merge against potentially stale refs.");
   }
   ```

2. **Persist `fresh_base_ref_sha`** — After successful fetch, capture `git rev-parse origin/<base_branch>` and store in the queue request record. Use this SHA explicitly in merge-base check (line 372) and worktree creation (line 399) instead of deriving from local state.

**File: `skills/governed-feature-runtime.mjs`** (actual path, not under implement-plan/scripts/)

3. **Fix base-branch resolution (line 733-735)** — Remove `detectCurrentBranch()` from chain:
   ```js
   function detectDefaultBaseBranch(projectRoot) {
     return detectOriginHeadBranch(projectRoot) ?? "main";
   }
   ```

4. **Base-branch immutability guard** — In implement-plan-helper.mjs `update-state`, reject changes to `base_branch` after initial set.

**File: `skills/merge-queue/references/workflow-contract.md`**

5. Document `fresh_base_ref_sha` as a persisted request field with schema and consumption points.

**File: `skills/implement-plan/references/workflow-contract.md`**

6. New section: "Route Authority Invariants" documenting I-1 through I-5.

---

## Phase 1: Resolve Split Physical Authority (Issues C, D, E)

**Why second**: Every subsequent phase depends on knowing which root is canonical.

### Changes

**File: `skills/implement-plan/scripts/implement-plan-helper.mjs`**

1. **Non-circular canonical-root selector** — New function `resolveCanonicalStatePaths(paths, input)`:
   - **Always** read repo-root state first (it always exists after prepare)
   - Check `merge_status` from repo-root state
   - If `merge_status === "not_ready"` AND worktree exists AND no `.superseded` marker → worktree is canonical
   - Otherwise → repo-root is canonical
   - If canonical root cannot be resolved → fail closed with error (never silently fall back to worktree for cache writes)

   This is non-circular because the decision input (repo-root state) is independent of the decision output (which paths to use).

2. **Refactor ALL 6 full-pattern worktree-preference sites** (lines 1126, 1407, 1563, 1728, 2071, 2130) — Replace:
   ```js
   const worktreeExists = detectCurrentBranch(worktreePath) !== null;
   const artifactPaths = worktreeExists ? buildPaths(worktreePath, ...) : paths;
   ```
   with:
   ```js
   const artifactPaths = resolveCanonicalStatePaths(paths, input);
   ```

3. **Also update 3 partial sites** (lines 562, 727, 946) — These store worktree paths in state. Add comments that these are execution-time references, not authority sources.

4. **Worktree retirement** — In `mark-complete`, after `feature_status = "completed"`, write `.superseded` marker to worktree feature artifact directory.
   - **Backward compat**: Old worktrees without marker are treated as "legacy/unresolved" — repo-root still wins per I-1 (merge_status rule).

5. **Canonical global cache writes** — In `syncFeaturesIndex()` and `syncAgentRegistry()`:
   - Resolve canonical project root via `git worktree list --porcelain` if current projectRoot is a worktree
   - If resolution fails → fail closed (do not write to worktree path)
   - Always write to canonical project root only

**File: `skills/implement-plan/references/workflow-contract.md`**

6. New section: "Physical Authority Rule" documenting I-1 with the non-circular resolution algorithm.

---

## Phase 2: Split SHA Fields + Normalize + Authority Matrix (Issues F, G, H, I, J, K)

**Why third**: With physical authority resolved, the data model can be tightened without ambiguity.

### Changes

**File: `skills/implement-plan/scripts/implement-plan-helper.mjs`**

1. **Bump `IMPLEMENT_PLAN_STATE_SCHEMA_VERSION` to 3** (line 205)

2. **Add explicit SHA fields** to `buildInitialState()` (~line 2788):
   ```
   review_closeout_sha: null
   reconciliation_sha: null
   ```
   `approved_commit_sha` and `merge_commit_sha` already exist. `last_commit_sha` = derived alias.

3. **SHA normalization** — New function `canonicalizeSha(projectRoot, sha)`:
   - null/empty → null
   - `git rev-parse <sha>` → full 40-char SHA
   - Fallback: `git cat-file -t <sha>` to verify (matching review-cycle pattern)
   - If both fail → reject with error
   - Apply in ALL SHA write paths: `update-state` (line 1241), `record-event` (line 1519), `mark-complete` (line 1754), new fields

4. **v2→v3 state migration** (~line 2700):
   - Default new fields to `null`
   - Derive `last_commit_sha` from: `reconciliation_sha ?? merge_commit_sha ?? approved_commit_sha ?? review_closeout_sha`
   - Opportunistically canonicalize abbreviated SHAs on load

5. **Freeze SHA authority matrix as code constants** (I-2)

6. **Update `markComplete()` (line 1754)** — Prefer `merge_commit_sha`:
   ```js
   const commitSha = input.mergeCommitSha ?? next.merge_commit_sha ?? input.lastCommitSha ?? next.last_commit_sha ?? null;
   ```

7. **Remove `skipLock: true`** from `writeImplementPlanState()` (line 281)

8. **Narrow structured-events domain** in `syncLegacyNormalStateFromRun()` (~line 4382):
   - Events own: `active_run_status`, `run_timestamps`, `attempt.*`, `last_completed_step` (run/attempt steps only)
   - Events do NOT own: `merge_status`, `merge_commit_sha`, `approved_commit_sha`, `feature_status`, `base_branch`, `local_target_sync_status`

**File: `skills/merge-queue/scripts/merge-queue-helper.mjs`**

9. **`persistMergedFeatureCloseout()` (line 856)** — `merge_commit_sha: mergeCommitSha` (not `last_commit_sha`)

10. **`markImplementPlanComplete()` (line 860)** — Pass `--merge-commit-sha`

**File: `skills/review-cycle/scripts/review-cycle-helper.mjs`**

11. **Add boundary comments** at lines 788 and 909 documenting that review-cycle `last_commit_sha` is operational, not lifecycle authority

**File: `skills/review-cycle/references/workflow-contract.md`**

12. **Freeze review-cycle boundary as contract rule** (I-3):
   - "review-cycle-state.json contributes verdict and approval evidence only"
   - "last_commit_sha in review-cycle-state is operational/local, not lifecycle authority"
   - "implement-plan reads verdict/approval fields but ignores review-cycle last_commit_sha"

**File: `skills/implement-plan/references/workflow-contract.md`**

13. Update schema docs: SHA fields, derivation rule, normalization, domain-narrowed events rule

---

## Phase 3: Reconcile Command + Artifact Precedence (Issues H, M)

**Why fourth**: With physical authority and SHA model fixed, reconcile can work reliably.

### Changes

**File: `skills/implement-plan/references/workflow-contract.md`**

1. **New section: "Artifact Authority Precedence"**:
   ```
   Run truth:
     1. Merge-backed governed facts + append-only structured events (highest)
     2. run-projection.v1.json (derived from events)
     3. implement-plan-execution-contract.v1.json (frozen route contract)
   Lifecycle truth:
     4. implement-plan-state.json (explicit lifecycle facts)
   Review truth:
     5. review-cycle-state.json (verdict/approval evidence ONLY per I-3)
   Human-readable:
     6. completion-summary.md (NEVER authoritative over machine-readable state)
   ```

2. **New section: "Helper Command Usage"**:
   - `update-state`: lifecycle transitions
   - `record-event`: execution/run facts
   - `reconcile`: post-merge truth alignment
   - `commit-closeout`: governed commit+push of closeout artifacts

**File: `skills/implement-plan/scripts/implement-plan-helper.mjs`**

3. **New command: `reconcile`** — Accepts: `--project-root`, `--phase-number`, `--feature-slug`, `--merge-commit-sha`, `--reconciliation-sha`, `--base-branch`

   Under feature lock, atomically:
   1. Resolve canonical state paths (repo-root first per Phase 1 rule)
   2. Load all artifact files from canonical source
   3. Apply precedence rules per domain
   4. Per field emit: `{ field, authoritative_source, old_value, new_value, action: "repaired"|"confirmed"|"blocked" }`
   5. Clean stale fields: `last_error` if completed, stale completion-summary language
   6. Recompute derived fields (`last_commit_sha` from precedence chain)
   7. Write reconciled state atomically
   8. Sync features-index and agent-registry to **canonical project root**
   9. If worktree exists and feature is completed/merged, write `.superseded` marker
   10. Return full contradiction report with per-field provenance

**File: `skills/implement-plan/SKILL.md`**

4. Document `reconcile` in helper scripts section.

---

## Phase 4: Governed Closeout + Ephemeral Checkout (Issues L, N)

**Why fifth**: With reconcile available, closeout = reconcile → validate → commit → push, all governed.

### Changes

**File: `skills/implement-plan/scripts/implement-plan-helper.mjs`**

1. **New command: `commit-closeout`** — Accepts: `--project-root`, `--phase-number`, `--feature-slug`, `--base-branch`, `--merge-commit-sha`, `--fresh-base-ref-sha`

   Steps:
   1. Refuse if `--fresh-base-ref-sha` is absent or stale
   2. Refuse if `--base-branch` differs from persisted `base_branch` in state (I-5)
   3. Call `reconcileSlice()` internally
   4. Call `validatePreCommit()` internally — fail if contradictions
   5. Stage feature artifact root + canonical cache paths:
      - `git add --all -- <relative-feature-root>`
      - `git add -- .codex/implement-plan/features-index.json .codex/implement-plan/agent-registry.json`
   6. Create governed commit: `docs(phase<N>/<feature-slug>): governed closeout [merge:<merge_sha_short>]`
   7. Push to `origin/<base-branch>`
   8. **Post-commit state update** (NOT inside the committed artifacts):
      - `git rev-parse HEAD` → get the closeout commit SHA
      - Write `reconciliation_sha` into state via `update-state`
      - This is a local state update only — the SHA is persisted in state for future reads, but the committed artifacts in this push do NOT contain it (avoiding the circular dependency of needing the SHA before the commit exists)
   9. If worktree exists, write `.superseded` marker
   10. Return `{ reconciliation_sha, push_status, contradictions_repaired: [...] }`

   **Semantic rule**: `reconciliation_sha` is the ONLY field for the closeout commit. There is no separate `closeout_commit_sha`. One field, one commit, one meaning. Callers that previously used `closeout_commit_sha` should read `reconciliation_sha` instead.

**File: `skills/merge-queue/scripts/merge-queue-helper.mjs`**

2. **Delete `commitAndPushFeatureCloseout()`** (line 890-922) — Replace with call to:
   ```
   node skills/implement-plan/scripts/implement-plan-helper.mjs commit-closeout \
     --project-root <closeoutProjectRoot> \
     --phase-number <N> \
     --feature-slug <slug> \
     --base-branch <branch> \
     --merge-commit-sha <sha> \
     --fresh-base-ref-sha <sha>
   ```

3. **Simplify `persistMergedFeatureCloseout()` (line 835)**:
   - Keep `updateImplementPlanFeatureState()` (line 847) for merge_status/merge_commit_sha
   - Keep `markImplementPlanComplete()` (line 860)
   - Replace raw closeout with `commit-closeout` call
   - Read `reconciliation_sha` from result

4. **Ephemeral checkout** — `chooseCloseoutProjectRoot()` uses merge worktree when main is dirty. `commit-closeout` uses persisted `base_branch` (I-5), never infers from checkout state.

**File: `skills/implement-plan/SKILL.md`**

5. Closeout policy: "All closeout commits, merges, and pushes MUST go through `commit-closeout`. Raw git operations in the closeout path are prohibited."

---

## Phase 5: Pre-Commit Drift Validator (Issues O, P, Q)

**Why sixth**: Safety net that catches anything prior phases missed.

### Changes

**File: `skills/implement-plan/scripts/implement-plan-helper.mjs`**

1. **New command: `validate-pre-commit`** — Cross-checks:

   **Truth contradictions:**
   - Review-cycle completion status vs implement-plan-state review gate
   - Terminal checkpoint wording in completion-summary vs state
   - All four SHA fields internally consistent
   - Merge truth consistent (`merge_commit_sha` ↔ `merge_status` ↔ `local_target_sync_status`)
   - If structured events exist, run-truth fields match event-derived values
   - Lifecycle fields NOT authored by structured events
   - `last_error` is null if feature is completed (Issue P)

   **Physical authority violations (Issue Q):**
   - If `merge_status != "not_ready"` but worktree is being read as authority → fail
   - If feature is completed but worktree exists without `.superseded` marker → warn (legacy compat)
   - If features-index.json or agent-registry.json were written under a worktree path → fail

   Returns: `{ valid, contradictions: [{ field, expected, actual, source_a, source_b, category: "truth"|"physical_authority" }] }`

2. **Wire into `commit-closeout`** — already specified in Phase 4 step 4

3. **Wire into `validateCloseoutReadinessBeforeMerge()`** in merge-queue — contradictions become blockers

**File: `skills/implement-plan/references/workflow-contract.md`**

4. **New section: "Hostile-State Proofs Required"**:
   - Fetch failure with stale refs present
   - Wrong checkout branch as base_branch
   - Merged-but-unsynced completion
   - Terminal event before merge-backed truth
   - Stale worktree artifacts after merge
   - Global caches written under worktree path
   - Repo-root should be canonical but worktree still read as authority

---

## Phase 6: Operational Hygiene (Issues R, S) — SEPARATE BOUNDED FOLLOW-UP

**This phase is explicitly NOT part of the core runtime fix (Phases 0-5).** It is a separate bounded slice to be planned and executed after the runtime hardening lands and is verified.

### Scope (for future planning)

1. Brain sync dedup policy
2. Helper usage documentation (`update-state` vs `record-event` vs `reconcile` vs `commit-closeout`)
3. Review findings lifecycle (triage, rename, archive)
4. Stale discussion/loop hygiene
5. Model retirement note for worktree-exclusive vs repo-root slice history
6. Backfill pass: run `reconcile` on all 26 existing feature streams — bounded, with its own report

---

## Files Modified (Complete)

| File | Phases | Nature |
|------|--------|--------|
| `skills/merge-queue/scripts/merge-queue-helper.mjs` | 0,2,4,5 | Fail-closed fetch, fresh_base_ref_sha, explicit SHA fields, delegate closeout, wire validation |
| `skills/governed-feature-runtime.mjs` | 0 | Fix base-branch resolution to origin/HEAD only |
| `skills/implement-plan/scripts/implement-plan-helper.mjs` | 0,1,2,3,4,5 | Base-branch immutability, canonical-root selector (all 6+3 sites), SHA fields+normalization, remove skipLock, narrow events domain, add reconcile/commit-closeout/validate-pre-commit |
| `skills/review-cycle/scripts/review-cycle-helper.mjs` | 2 | Boundary comments at SHA write paths |
| `skills/review-cycle/references/workflow-contract.md` | 2 | Frozen review-cycle boundary contract rule (I-3) |
| `skills/merge-queue/references/workflow-contract.md` | 0 | fresh_base_ref_sha schema and request field docs |
| `skills/implement-plan/references/workflow-contract.md` | 0,1,2,3,4,5 | Authority invariants, physical authority rule, SHA matrix, precedence, helper usage, hostile proofs |
| `skills/implement-plan/SKILL.md` | 3,4 | Document new commands, closeout policy |

---

## Verification Plan

### Per-Phase

1. **Phase 0**: `git fetch` fails but local ref exists → merge blocked. Change checkout branch → base_branch resolves from origin/HEAD. Attempt to change persisted base_branch → rejected.

2. **Phase 1**: Feature in merge_queued state → reads from repo-root not worktree. Completed feature → `.superseded` written. Old worktree without marker → repo-root still wins. Canonical-root resolution fails → cache write fails closed. features-index only in canonical project root.

3. **Phase 2**: v2 state loads → v3 defaults. Abbreviated SHA → canonicalized to 40 chars. `last_commit_sha` always derived. Concurrent state writes → serialized (no skipLock).

4. **Phase 3**: Known contradictions → reconcile aligns all, reports per-field provenance.

5. **Phase 4**: Full enqueue → process-next → closeout → `reconciliation_sha` set via post-commit update. Staged files include feature root + canonical caches. Worktree superseded.

6. **Phase 5**: Contradictory artifacts → validator catches. Physical authority violation → validator catches. Completed feature with stale `last_error` → caught.

### Hostile Cases

- Fetch failure + stale refs → merge blocked
- Wrong checkout branch → base_branch unaffected
- Merged-but-unsynced → reconcile handles
- Stale worktree after merge → reads go to repo-root
- Abbreviated SHA → canonicalized
- Concurrent writes → serialized
- Canonical-root discovery fails → fail closed
- Old worktree without `.superseded` → repo-root wins per merge_status rule

---

## Failure Isolation

- **Phase 0 alone**: Wrong-code-landing risk eliminated. All existing closeout unchanged.
- **Phase 1 alone** (after 0): Split-authority resolved. Old worktrees without `.superseded` handled by merge_status rule fallback.
- **Phase 2 alone** (after 0-1): SHA model tightened. `last_commit_sha` still populated for compat.
- **Phase 3 alone** (after 0-2): `reconcile` available for manual or governed use.
- **Phase 4 alone** (after 0-3): Closeout fully governed. Merge-queue error handling catches failures.
- **Phase 5 alone** (after 0-4): Pre-commit checks block bad commits (fail-safe).
- **Phase 6**: Separate follow-up. No runtime impact on Phases 0-5.
