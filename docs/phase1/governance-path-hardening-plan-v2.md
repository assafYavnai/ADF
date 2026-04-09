# Fix implement-plan Governance Path: A-to-Z Sweep (v2)

## Context

The implement-plan governance path from feature initiation through merge-to-main has accumulated systemic defects that compound with each slice. The implementor post-mortem for `coo-live-executive-status-wiring`, audit findings (cycles 08-10), run post-mortems (010, 017, 018), and two executive plan reviews confirm: the product bugs are straightforward, but governance closeout repair consumes most cycle time. The backlog grows instead of shrinking.

**Root cause is not field overload — it is split physical authority.** The system has two physical roots (repo root + worktree), multiple active writers (implement-plan, review-cycle, merge-queue), no frozen authority matrix, and raw git operations where governed helpers should be used. Field-splitting alone cannot fix a system that still reads from whichever copy happens to exist at runtime.

**Goal**: One sweep that fixes wrong-code-landing risks first, then truth-model defects, then closeout governance, then validation — so every subsequent slice lands cleanly without manual reconciliation.

---

## Issues Addressed (Complete, Verified Against Live Code)

### Wrong-Code-Landing Risks (fix first)

| ID | Issue | Evidence | Severity |
|----|-------|----------|----------|
| A | **Stale-fetch authorization bypass** — merge-queue `processNextRequest()` continues with cached local refs if `git fetch` fails but local branch exists | merge-queue-helper.mjs:367-368, condition only blocks if BOTH fetch fails AND no local ref | Critical |
| B | **Mutable base-branch authority** — `detectDefaultBaseBranch()` resolves from mutable checkout state via `detectCurrentBranch()` before falling back to origin/HEAD | governed-feature-runtime.mjs:733-735 | Critical |

### Split Physical Authority (fix second)

| ID | Issue | Evidence | Severity |
|----|-------|----------|----------|
| C | **Worktree vs repo-root split reads** — `update-state`, `record-event`, `mark-complete`, `validate-closeout-readiness` all prefer worktree copy when it exists, creating two physical truth sources for the same feature | implement-plan-helper.mjs lines 1126, 1407, 1728, 2130 — identical `resolveFeatureWorktreePath()` + conditional pattern at all four | Critical |
| D | **Stale worktree artifacts after merge** — no worktree retirement/supersession rule, so post-merge reads can still pick up pre-merge worktree state | No retirement logic found in any command | Critical |
| E | **Duplicated global caches** — `features-index.json` and `agent-registry.json` exist in both repo root and worktrees (13 worktree-local index files, 30 worktree-local registry files found) | buildPaths() derives paths from projectRoot, worktree creates parallel copies | High |

### Truth Model Defects (fix third)

| ID | Issue | Evidence | Severity |
|----|-------|----------|----------|
| F | **`last_commit_sha` overloaded** — serves as review closeout, approved, merge, and reconciliation SHA. 13 streams have last==merge, 6 have last==approved, 3 have a third distinct value | Live artifact inspection across landed features | Critical |
| G | **SHA stored without normalization** — abbreviated SHAs (`80c5ccb`, `fb6a90f`) persisted, no `git cat-file` validation (unlike review-cycle which validates) | implement-plan-helper.mjs:1241, 1519 vs review-cycle-helper.mjs:788, 909 | High |
| H | **No artifact authority precedence** — 5 artifact files can disagree with no documented rule for which wins | Implementor report + 12 of 26 feature streams have mismatched implement-plan vs review-cycle SHAs | Critical |
| I | **Mixed truth domains** — `syncLegacyNormalStateFromRun()` overwrites lifecycle-facing state from run/attempt data; structured events can author fields they shouldn't own | implement-plan-helper.mjs:4382 | High |
| J | **review-cycle persists its own `last_commit_sha`** — separate writer, separate semantics, not coordinated with implement-plan | review-cycle-helper.mjs:788, 909 | High |
| K | **Feature state writer skips locking** — `writeImplementPlanState()` uses `skipLock: true` | implement-plan-helper.mjs:281 | High |

### Closeout Governance (fix fourth)

| ID | Issue | Evidence | Severity |
|----|-------|----------|----------|
| L | **Raw git in closeout** — `commitAndPushFeatureCloseout()` does git add/commit/push directly instead of governance helpers | merge-queue-helper.mjs:890-922 | Critical |
| M | **No single reconcile command** — implementors manually sequence `update-state` + `record-event` + hand-fixes | Implementor report | Critical |
| N | **Closeout on dirty checkout** — unrelated work interferes with reconciliation | Implementor report | High |
| O | **Hardcoded closeout commit message** — not governance-shaped | merge-queue-helper.mjs:906 | Low |

### Validation Gaps (fix fifth)

| ID | Issue | Evidence | Severity |
|----|-------|----------|----------|
| P | **No pre-commit drift validator** — contradictory artifacts committed silently | Implementor report | High |
| Q | **Stale error fields survive completion** — completed features carry old merge-conflict messages in `last_error` | Live artifact inspection | Medium |
| R | **Contradictory slice history** — earlier slices claim worktree-exclusive writes, later claim repo-root closeout truth, no explicit retirement | Multiple completion-summary.md files | Medium |

### Operational Noise (fix last)

| ID | Issue | Evidence | Severity |
|----|-------|----------|----------|
| S | **Brain memory duplication** — 30+ identical "sync to brain" entries | Brain search | Medium |
| T | **50 open findings never triaged** | Brain findings list | Medium |
| U | **Stale open discussions** from mid-March | Brain discussion list | Medium |
| V | **No `update-state` vs `record-event` usage docs** | Implementor report | Medium |

---

## Phase 0: Route Authority Contract (Issues A, B — wrong-code-landing blockers)

**Why first**: These are the only defects that can land wrong code on main. Everything else is truth-model or closeout quality. Fix these before anything else.

### Changes

**File: `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`**

1. **Fix stale-fetch bypass (line 367-368)** — Change the fetch-failure condition from:
   ```js
   if (fetchResult.status !== 0 && !gitRefExists(controlProjectRoot, "refs/heads/" + selected.base_branch))
   ```
   to fail-closed:
   ```js
   if (fetchResult.status !== 0) {
     return await failQueuedRequest(..., "Fetch failed for " + selected.base_branch + ". Refusing to merge against potentially stale refs.");
   }
   ```
   A merge must NEVER proceed without fresh refs, regardless of local cache state.

2. **Store fresh-ref proof** — After successful fetch, capture the fetched ref SHA and store it in the request as `fresh_base_ref_sha`. Use this explicitly in the merge-base ancestry check (line 372) and worktree creation (line 399) instead of deriving `baseRef` from local state.

**File: `C:/ADF/skills/implement-plan/scripts/governed-feature-runtime.mjs`**

3. **Fix mutable base-branch authority (line 733-735)** — Change `detectDefaultBaseBranch()` to:
   ```js
   function detectDefaultBaseBranch(projectRoot) {
     return detectOriginHeadBranch(projectRoot) ?? "main";
   }
   ```
   Remove `detectCurrentBranch()` from the resolution chain. The current checkout branch must NEVER determine target lane. If origin/HEAD is unavailable, use "main" as hard default. Document this as a frozen invariant.

4. **Add base-branch persistence rule** — Once `base_branch` is written to implement-plan-state.json during `prepare`, it becomes immutable for that feature's lifecycle. Add a guard in `update-state` that rejects attempts to change `base_branch` after it has been set.

**File: `C:/ADF/skills/implement-plan/references/workflow-contract.md`**

5. **New section: "Route Authority Invariants"** — Document:
   - Merge authorization requires fresh-fetched refs. Stale local refs are never sufficient.
   - Base-branch is resolved from `origin/HEAD`, never from current checkout state.
   - Base-branch is immutable once persisted in feature state.
   - `approved_commit_sha` is the sole pre-merge landing authority.
   - `merge_commit_sha` is the sole merge-result truth.

---

## Phase 1: Resolve Split Physical Authority (Issues C, D, E)

**Why second**: The system currently has two physical roots for the same feature's lifecycle truth. Every subsequent phase (SHA fields, reconcile, closeout) depends on knowing which root is canonical.

### Changes

**File: `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`**

1. **Define the canonical read rule** — Add a `resolveCanonicalStatePaths()` function that implements:
   - **During implementation** (active_run_status in [implementation_running, verification_pending]): worktree is canonical for code and artifacts being actively written
   - **After review approval** (active_run_status in [merge_ready, merge_queued, merge_in_progress, closeout_pending, completed]): repo-root is canonical for lifecycle state
   - **Rule**: Once `merge_status` is set to anything other than `not_ready`, lifecycle reads MUST come from repo root, not worktree

2. **Refactor the four worktree-read locations** (lines 1126, 1407, 1728, 2130) — Replace the current pattern:
   ```js
   const worktreeExists = detectCurrentBranch(worktreePath) !== null;
   const artifactPaths = worktreeExists ? buildPaths(worktreePath, ...) : paths;
   ```
   with:
   ```js
   const artifactPaths = resolveCanonicalStatePaths(paths, input, existingState);
   ```
   where `resolveCanonicalStatePaths` applies the rule from (1) above.

3. **Add worktree retirement after merge** — In `mark-complete`, after setting `feature_status = "completed"`, add a step that writes a `.superseded` marker file to the worktree's feature artifact directory. All future reads check for this marker: if present, the worktree copy is dead and repo-root is the only valid source.

4. **Fix global cache duplication** — In `syncFeaturesIndex()` and `syncAgentRegistry()`, always write to the canonical project-root paths, never to worktree-local paths. If the current `paths.projectRoot` is a worktree, resolve the canonical project root from the worktree's git metadata (`git worktree list --porcelain` to find the main worktree).

**File: `C:/ADF/skills/implement-plan/references/workflow-contract.md`**

5. **New section: "Physical Authority Rule"** — Document:
   - Worktree is the write target during active implementation only
   - After merge_status leaves `not_ready`, repo-root is canonical
   - `.superseded` marker in worktree means that copy is dead
   - Global caches (features-index, agent-registry) are ONLY written to canonical project root

---

## Phase 2: Split SHA Fields + Normalize + Authority Matrix (Issues F, G, H, I, J, K)

**Why third**: With physical authority resolved, the data model can now be tightened without ambiguity about which copy is being fixed.

### Changes

**File: `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`**

1. **Bump `IMPLEMENT_PLAN_STATE_SCHEMA_VERSION` to 3** (line 205)

2. **Add explicit SHA fields to `buildInitialState()`** (~line 2788):
   ```
   review_closeout_sha: null
   reconciliation_sha: null
   ```
   `approved_commit_sha` and `merge_commit_sha` already exist. `last_commit_sha` becomes a derived compatibility alias only.

3. **Add SHA normalization** — New function `canonicalizeSha(projectRoot, sha)`:
   - If `sha` is null/empty, return null
   - Run `git rev-parse <sha>` to get full 40-char SHA
   - If that fails, run `git cat-file -t <sha>` to verify existence (matching review-cycle's pattern at line 788)
   - If both fail, reject with error
   - Apply this in every SHA write path: `update-state` (line 1241), `record-event` (line 1519), `mark-complete` (line 1754), and the new fields

4. **State normalization for v2→v3 migration** (~line 2700):
   - Default new fields to `null`
   - Derive `last_commit_sha` from: `reconciliation_sha ?? merge_commit_sha ?? approved_commit_sha ?? review_closeout_sha`
   - Canonicalize existing SHAs on load if they appear abbreviated (opportunistic migration)

5. **SHA authority matrix** — Freeze as code constants and document:
   ```
   approved_commit_sha  → sole pre-merge landing authority
   merge_commit_sha     → merge-result truth (set by merge-queue only)
   review_closeout_sha  → review-cycle closeout artifact commit
   reconciliation_sha   → post-merge closeout/reconciliation commit on target
   last_commit_sha      → compatibility alias, DERIVED ONLY, never directly set by new code
   ```

6. **Update `markComplete()` (line 1754)** — Prefer `merge_commit_sha` over legacy `last_commit_sha`:
   ```js
   const commitSha = input.mergeCommitSha ?? next.merge_commit_sha ?? input.lastCommitSha ?? next.last_commit_sha ?? null;
   ```

7. **Remove `skipLock: true` from `writeImplementPlanState()`** (line 281) — Use the feature-level lock. The historical justification ("implement-plan is sequential") is not a durable invariant.

8. **Narrow structured-events authority domain** in `syncLegacyNormalStateFromRun()` (~line 4382):
   - Structured events own: `active_run_status`, `run_timestamps`, `attempt.*` fields, `last_completed_step` (for run/attempt steps only)
   - Structured events do NOT own: `merge_status`, `merge_commit_sha`, `approved_commit_sha`, `feature_status`, `base_branch`, `local_target_sync_status`
   - These lifecycle fields are only set by explicit lifecycle commands (update-state, mark-complete, merge-queue callbacks)

**File: `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`**

9. **`persistMergedFeatureCloseout()` (line 856)** — Change `last_commit_sha: mergeCommitSha` to `merge_commit_sha: mergeCommitSha`. Let helper derive `last_commit_sha`.

10. **`markImplementPlanComplete()` call (line 860)** — Pass `--merge-commit-sha` instead of positional `lastCommitSha`.

**File: `C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs`**

11. **Narrow review-cycle's SHA scope** (lines 788, 909):
   - review-cycle-state.json's `last_commit_sha` is redefined as review-cycle-local operational state only
   - It must NOT be treated as peer lifecycle authority with implement-plan-state.json
   - Add a comment at both write locations documenting this boundary
   - When implement-plan reads review-cycle-state for governance truth evaluation, it reads verdict/approval fields but ignores `last_commit_sha`

**File: `C:/ADF/skills/implement-plan/references/workflow-contract.md`**

12. Update schema docs with all four explicit SHA fields, derivation rule, normalization requirement, and domain-narrowed structured-events rule.

---

## Phase 3: Reconcile Command + Artifact Precedence (Issues H, M)

**Why fourth**: With physical authority and SHA model fixed, reconcile can now work reliably.

### Changes

**File: `C:/ADF/skills/implement-plan/references/workflow-contract.md`**

1. **New section: "Artifact Authority Precedence"**:
   ```
   Run truth:
     1. Merge-backed governed facts + append-only structured events (highest)
     2. run-projection.v1.json (derived from events)
     3. implement-plan-execution-contract.v1.json (frozen route contract)
   
   Lifecycle truth:
     4. implement-plan-state.json (explicit lifecycle facts from update-state/mark-complete/merge-queue)
   
   Review truth:
     5. review-cycle-state.json (verdict and approval evidence ONLY)
   
   Human-readable:
     6. completion-summary.md (NEVER authoritative over machine-readable state)
   ```

2. **New section: "Helper Command Usage"**:
   - `update-state`: lifecycle transitions
   - `record-event`: execution/run facts
   - `reconcile`: post-merge truth alignment (reads all, fixes all, reports all)
   - `commit-closeout`: governed commit+push of closeout artifacts

**File: `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`**

3. **New command: `reconcile`** — Accepts: `--project-root`, `--phase-number`, `--feature-slug`, `--merge-commit-sha`, `--reconciliation-sha`, `--base-branch`

   Under feature lock, atomically:
   1. Resolve canonical state paths (using Phase 1 rule — repo-root for post-merge)
   2. Load all artifact files from canonical source
   3. Apply precedence rules per domain:
      - Run truth: events → projection → contract → state
      - Lifecycle truth: explicit facts in canonical state
      - Review truth: verdicts only from review-cycle-state
   4. For each field, emit: `{ field, authoritative_source, old_value, new_value, action: "repaired"|"confirmed"|"blocked" }`
   5. Clean stale fields: `last_error` if feature is completed, stale language in completion-summary
   6. Recompute all derived fields (especially `last_commit_sha` from precedence chain)
   7. Write reconciled state atomically
   8. Sync features-index and agent-registry to canonical project root
   9. If worktree exists and feature is completed/merged, write `.superseded` marker
   10. Return full contradiction report with per-field provenance

**File: `C:/ADF/skills/implement-plan/SKILL.md`**

4. Document `reconcile` in helper scripts section.

---

## Phase 4: Governed Closeout + Ephemeral Checkout (Issues L, N, O)

**Why fifth**: With reconcile available, closeout becomes: reconcile → validate → commit → push, all governed.

### Changes

**File: `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`**

1. **New command: `commit-closeout`** — Accepts: `--project-root`, `--phase-number`, `--feature-slug`, `--base-branch`, `--merge-commit-sha`

   Steps:
   1. Refuse if fresh-ref proof is stale or absent (check `base_branch` ref age or require `--fresh-base-ref-sha`)
   2. Refuse if `--base-branch` differs from persisted `base_branch` in state (immutable from Phase 0)
   3. Call `reconcileSlice()` internally
   4. Call `validatePreCommit()` internally — fail if contradictions found
   5. Stage ONLY feature artifact root: `git add --all -- <relative-feature-root>`
   6. Create governed commit with message: `docs(phase<N>/<feature-slug>): governed closeout [merge:<merge_sha_short>]`
   7. Push to `origin/<base-branch>`
   8. Record `reconciliation_sha` (= this commit's SHA) in state
   9. If worktree exists, write `.superseded` marker
   10. Return `{ closeout_commit_sha, reconciliation_sha, push_status, contradictions_repaired: [...] }`

   Transaction rule: `reconciliation_sha` IS the closeout commit SHA. One name, one commit, one meaning.

**File: `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`**

2. **Replace `commitAndPushFeatureCloseout()` (line 890)** — Delete the raw git implementation. Replace with a call to:
   ```
   node C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs commit-closeout ...
   ```

3. **Simplify `persistMergedFeatureCloseout()` (line 835)**:
   - Keep `updateImplementPlanFeatureState()` (line 847) for merge_status/merge_commit_sha
   - Keep `markImplementPlanComplete()` (line 860)
   - Replace `commitAndPushFeatureCloseout()` with `commit-closeout` call
   - After return, update state with `reconciliation_sha` from result

4. **Ephemeral checkout preference** — In `chooseCloseoutProjectRoot()`, if main checkout is dirty, use merge worktree with `preserveMergeWorktree = true`. `commit-closeout` must not infer target branch from checkout state (it uses the persisted `base_branch` from Phase 0).

**File: `C:/ADF/skills/implement-plan/SKILL.md`**

5. Update closeout section: "Closeout commits, merges, and pushes MUST go through `commit-closeout`. Raw git operations in the closeout path are prohibited."

---

## Phase 5: Pre-Commit Drift Validator (Issues P, Q, R)

**Why sixth**: The safety net that catches anything the prior phases missed.

### Changes

**File: `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`**

1. **New command: `validate-pre-commit`** — Cross-checks all artifact files:
   - Review-cycle completion status vs implement-plan-state review gate
   - Terminal checkpoint wording in completion-summary vs state
   - All four SHA fields internally consistent
   - Merge truth consistent (merge_commit_sha ↔ merge_status ↔ local_target_sync_status)
   - If structured events exist, run-truth fields match event-derived values
   - Lifecycle fields NOT authored by structured events
   - `last_error` is null if feature is completed (Issue Q)
   - No contradictory slice history (check completion-summary doesn't claim both worktree-exclusive and repo-root models, Issue R)
   - Returns: `{ valid, contradictions: [{ field, expected, actual, source_a, source_b }] }`

2. **Wire into `commit-closeout`** — Already specified in Phase 4 step 4.

3. **Wire into `validateCloseoutReadinessBeforeMerge()`** in merge-queue-helper.mjs — Call `validate-pre-commit` after existing readiness checks. Contradictions become blockers.

**File: `C:/ADF/skills/implement-plan/references/workflow-contract.md`**

4. **New section: "Hostile-State Proofs Required"** — Document the cases that validation must catch:
   - Fetch failure with stale refs present
   - Wrong checkout branch as base_branch
   - Merged-but-unsynced completion
   - Terminal event before merge-backed truth
   - Stale feature-root contract after mutation
   - Stale worktree artifacts after merge

---

## Phase 6: Operational Noise Reduction + Backfill (Issues S, T, U, V)

**Why last**: Documentation and hygiene. No runtime risk.

### Changes

**File: `C:/ADF/skills/implement-plan/SKILL.md`**

1. **Brain Sync Policy**: Brain sync ONCE per closeout, use `semantic_dedup: true`, no boilerplate.

2. **Helper Usage Guide**: When to use `update-state` vs `record-event` vs `reconcile` vs `commit-closeout`.

**File: `C:/ADF/skills/implement-plan/references/workflow-contract.md`**

3. **Review Findings Lifecycle**: Triage within same cycle, rename opaque titles, archive after 2 cycles.

4. **Stale Artifact Hygiene**: Review open discussions >14 days during closeout, close stale loops.

5. **Explicit Model Retirement Note**: State that worktree-exclusive write model from earlier slices is superseded by the canonical-root-after-merge model introduced in Phase 1. Earlier completion-summary claims are historical context, not active policy.

### Backfill Pass

6. **Run `reconcile` on all 26 feature streams** — The repo already has 12 mismatched implement-plan vs review-cycle SHAs, 13 worktree-local index files, and mixed abbreviated SHAs. Run reconcile to converge old slices to new model. This is bounded: reconcile only writes to canonical project root and reports what it changed.

---

## Files Modified (Complete)

| File | Phases | Nature |
|------|--------|--------|
| `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs` | 0,2,4,5 | Fail-closed fetch, explicit SHA fields, delegate closeout to governance helper, wire validation |
| `C:/ADF/skills/implement-plan/scripts/governed-feature-runtime.mjs` | 0 | Fix base-branch resolution to use origin/HEAD only |
| `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs` | 1,2,3,4,5 | Canonical read rule, SHA fields+normalization, remove skipLock, narrow events domain, add reconcile/commit-closeout/validate-pre-commit |
| `C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs` | 2 | Narrow SHA scope documentation, boundary comments |
| `C:/ADF/skills/implement-plan/references/workflow-contract.md` | 0,1,2,3,4,5,6 | Authority invariants, physical authority rule, SHA matrix, precedence, helper usage, hostile proofs, retirement notes |
| `C:/ADF/skills/implement-plan/SKILL.md` | 3,4,6 | Document new commands, closeout policy, brain sync, helper usage |

---

## Verification Plan

### Per-Phase Verification

1. **Phase 0**: Create a test scenario where `git fetch` fails but local ref exists → verify merge is blocked. Change checkout branch → verify base_branch still resolves from origin/HEAD.

2. **Phase 1**: With a feature in merge_queued state, verify reads come from repo-root not worktree. With a completed feature, verify `.superseded` marker is written. Verify features-index/agent-registry are only in canonical project root.

3. **Phase 2**: Load a v2 state → verify v3 migration defaults. Store an abbreviated SHA → verify it gets canonicalized to 40 chars. Verify `last_commit_sha` is always derived, never directly set.

4. **Phase 3**: Create a feature with known contradictions → run reconcile → verify all fields aligned and report lists every correction with provenance.

5. **Phase 4**: Run full enqueue → process-next → closeout → verify closeout goes through `commit-closeout`, `reconciliation_sha` is set, worktree is superseded.

6. **Phase 5**: Create contradictory artifacts → verify validator catches each type. Verify completed feature has null `last_error`.

### Integration Proof (Hostile Cases)

- Fetch failure with stale refs → merge blocked
- Checkout on wrong branch → base_branch unaffected
- Merged-but-unsynced completion → reconcile handles
- Stale worktree copy after merge → reads go to repo root
- Abbreviated SHA in old state → canonicalized on load
- Concurrent feature state writes → serialized through lock

### Backfill Proof

- Run reconcile on all 26 streams → report convergence results → verify no manual repair needed

---

## Failure Isolation

Each phase leaves the system in a consistent state if work stops:
- **Phase 0 alone**: Wrong-code-landing risk eliminated. All existing closeout behavior unchanged.
- **Phase 1 alone** (after 0): Canonical read rule prevents split-authority confusion. Worktrees still work for active implementation.
- **Phase 2 alone** (after 0-1): Richer, normalized SHA fields. `last_commit_sha` still populated for backward compat.
- **Phase 3 alone** (after 0-2): `reconcile` available for manual or governed use.
- **Phase 4 alone** (after 0-3): Closeout delegated to governance. Merge-queue error handling catches failures.
- **Phase 5 alone** (after 0-4): Pre-commit checks block bad commits (fail-safe).
- **Phase 6**: Documentation + backfill. No runtime behavior change.
