# Lessons For MCP Boxing

Status: working context artifact
Date: 2026-04-08
Audience: contextless agent
Primary target: make the governed route stable enough for MCP boxing without letting the current hardening slice become too large

## Why This Report Exists

Recent governed closeout work exposed route failures that are easy to miss if an agent reads only one state file or one summary document.

This report is meant to save a new agent from rediscovering the same failures by hand.

It focuses on:

- what happened
- why it mattered
- what the real operator cost was
- what should be fixed now
- what should stay as an open loop for later

This report is intentionally human friendly:

- use slice names, file names, and commit SHAs only
- avoid long filesystem paths unless needed
- separate hard evidence from softer session observations

## Evidence Quality Guide

- Hard evidence: directly visible in repo files, state files, queue records, or git commits
- Soft evidence: observed during route execution and closeout work, but not fully captured as a single durable machine artifact

## Executive Recommendation

Do not turn `governed-approval-gates-and-local-sync-hardening` into a general "fix all governance debt" slice.

The merged recommendation from the current hardening work, the refreshed boxing review, and the live MCP boxing documents is:

1. finish `governed-approval-gates-and-local-sync-hardening`
2. keep it bounded to approval truth, split-review truth, pre-refresh, and local sync preserve-sync-restore
3. refresh `MCP-gaps.md` before treating it as planning authority
4. proceed with `mcp-boxing/slice-02-lane-admission-and-artifact-bridge`
5. before wiring full downstream implementation, review, and merge behind boxed `dev_team`, finish:
   - `governed-state-writer-serialization`
   - `implement-plan-provider-neutral-run-contract`

Reason:

- the current slice directly addresses the most dangerous route defects
- `slice-02-lane-admission-and-artifact-bridge` does not yet require full downstream execution, review, merge, or approval-gate retirement
- `governed-state-writer-serialization` and `implement-plan-provider-neutral-run-contract` are the cleanest prerequisites for the later boxed execution route
- broad route redesign now would slow progress and blur slice truth

## Why This Matters To MCP Boxing

`mcp-boxing/requirements.md` and `step2.md` do not require full downstream governed execution inside MCP dev yet.

But MCP boxing does require the existing governed route to be stable enough that it can later sit behind the boxed `dev_team` boundary without importing unsafe behavior.

The minimum stability bar before deeper migration is:

- approval truth cannot be bypassed
- split review cannot silently become final truth
- dirty local sync cannot produce silent local control-plane drift
- a contextless agent can tell what actually happened without reading five conflicting artifacts and guessing

## Lesson 1: Approval Truth Can Advance Past Real Gate Truth

### Context

The governed route can still move into merged or completed truth even when required human verification was never durably recorded.

That is a direct threat to future MCP boxing because a boxed department cannot safely expose "done" if the underlying gate truth is porous.

### Concrete Example

In `coo-live-executive-status-wiring`:

- `implement-plan-contract.md` required human verification
- `implement-plan-state.json` shows `human_verification_requested_at = null`
- `implement-plan-state.json` shows `human_testing.status = not_started`
- the same state still reached `merge_status = merged` and `feature_status = completed`

### Hard Evidence

- slice: `coo-live-executive-status-wiring`
- files:
  - `implement-plan-contract.md`
  - `implement-plan-state.json`

### Soft Evidence

- the route did not fail on its own
- the mismatch had to be noticed by comparing contract truth and state truth manually

### Pain Cost

- unsafe merge risk
- unsafe completion narrative
- a contextless agent cannot trust completion state without cross-checking the contract
- this increases review and closeout time because the route does not self-police the gate

### What We Want To Solve

- `merge-queue` must refuse landing when human verification is required but not durably satisfied
- `implement-plan` must refuse completion or closeout when human-verification truth is missing, stale, or contradicted

### Recommended Home

Fix now in `governed-approval-gates-and-local-sync-hardening`

## Lesson 2: Split Review Truth Can Leak Into Final Truth

### Context

The governed route still allows a slice to look effectively approved even when the final review result is not a clean dual approval.

This is especially dangerous for contextless agents because "review finished" can be mistaken for "review approved."

### Concrete Example

In `coo-live-executive-status-wiring`:

- `review-cycle-state.json` for cycle 07 shows `auditor = reject`
- the same cycle shows `reviewer = approve`
- despite that split verdict, the slice still reached merged and completed truth

### Hard Evidence

- slice: `coo-live-executive-status-wiring`
- files:
  - `review-cycle-state.json`
  - `implement-plan-state.json`

### Soft Evidence

- the route looked superficially green enough until the review-cycle details were inspected
- an agent could easily mistake "review-cycle completed" for "all approval gates cleared"

### Pain Cost

- partial approval can be misread as final approval
- merge and completion become less trustworthy
- future boxed department status would inherit the same ambiguity

### What We Want To Solve

- split review verdicts must never become:
  - `merge_ready`
  - `merged`
  - `completed`

### Recommended Home

Fix now in `governed-approval-gates-and-local-sync-hardening`

## Lesson 3: Dirty Local Sync Is Not A Safe Optional Step

### Context

`skipped_dirty_checkout` preserves local dirt, but it also allows the local control plane to lag behind the real merge result.

That might be acceptable as a temporary operational escape hatch, but it is not a stable long-term governed route.

### Concrete Examples

Example A:

- `coo-live-executive-status-wiring`
- `implement-plan-state.json` ended with `local_target_sync_status = skipped_dirty_checkout`

Example B:

- `governed-implementation-route-hardening`
- `queue.json` recorded `local_target_sync_status = skipped_dirty_checkout`
- remote merge and closeout succeeded
- local control-plane truth still needed a later repair and explicit `mark-complete`

### Hard Evidence

- slices:
  - `coo-live-executive-status-wiring`
  - `governed-implementation-route-hardening`
- files:
  - `implement-plan-state.json`
  - `queue.json`

### Soft Evidence

- what should have been a short governed closeout turned into a repair session
- the operator had to reconcile local state after merge instead of trusting the route to finish itself

### Pain Cost

- slower closeout
- stale local state
- higher risk of agents trusting outdated local projections
- poor fit for boxed service boundaries, because the system cannot cleanly say whether local truth is current

### What We Want To Solve

- replace skip-without-sync with preserve-sync-restore
- preserve tracked and untracked changes
- sync the target branch
- restore local state explicitly
- fail closed if restore conflicts or cannot complete safely

### Recommended Home

Fix now in `governed-approval-gates-and-local-sync-hardening`

## Lesson 4: One Slice Can Expose Multiple Conflicting Truth Projections

### Context

A contextless agent cannot assume that one projection is authoritative.

The route currently exposes several overlapping views:

- `implement-plan-state.json`
- `review-cycle-state.json`
- `features-index.json`
- `queue.json`
- `completion-summary.md`

When these drift, the agent must reconstruct truth instead of reading it.

### Concrete Examples

Example A:

- `coo-live-executive-status-wiring`
- `implement-plan-state.json` shows `completed / merged / marked_complete`
- `features-index.json` still shows `active / merge_in_progress / merge_started`

Example B:

- `governed-implementation-route-hardening`
- remote merge and closeout existed
- local index and worktree projections still needed explicit reconciliation before final completion truth

### Hard Evidence

- slices:
  - `coo-live-executive-status-wiring`
  - `governed-implementation-route-hardening`
- files:
  - `implement-plan-state.json`
  - `features-index.json`
  - `queue.json`

### Soft Evidence

- a new agent cannot safely stop after reading one state file
- the real closeout flow required checking multiple files before trusting the route

### Pain Cost

- more time spent on forensic validation
- harder future MCP adapter design because the service boundary needs a canonical answer
- higher chance of incorrect reporting to the invoker

### What We Want To Solve

Solve now:

- do not allow merge or completion to advance when approval truth is stale
- do not allow local sync to become an unbounded source of control-plane drift

Open loop for later:

- define a canonical closeout receipt or canonical post-merge truth source

### Recommended Home

- safety-gate part: fix now in `governed-approval-gates-and-local-sync-hardening`
- full projection unification: later open loop

## Lesson 5: Completion Summaries Are Useful, But They Are Not Safe Route Truth

### Context

`completion-summary.md` is a human-facing artifact.

It becomes dangerous if later closeout logic preserves stale lifecycle wording instead of regenerating lifecycle sections from current state.

### Concrete Example

For `governed-implementation-route-hardening`:

- merged closeout truth existed
- state was reconciled to `completed / merged / marked_complete`
- but summary text still preserved stale lifecycle phrasing from earlier route stages

### Hard Evidence

- slice: `governed-implementation-route-hardening`
- files:
  - `completion-summary.md`
  - `implement-plan-state.json`
- git evidence:
  - merge commit `253d5c0`
  - closeout commit `dd17128`

### Soft Evidence

- the summary looked authoritative to a human reader
- the state file was needed to understand what really happened

### Pain Cost

- human readers can leave with the wrong story
- contextless agents can over-trust text summaries
- future MCP status bridges should not treat human summaries as the primary truth source

### What We Want To Solve

Solve now:

- keep text summaries out of gate decisions

Open loop for later:

- regenerate lifecycle-sensitive sections from current state instead of preserving prior wording

### Recommended Home

Later open loop, unless the current slice needs a minimal targeted guard to prevent unsafe final wording from affecting route decisions

## Lesson 6: Gap Reports Go Stale Faster Than Governed Branches Move

### Context

`MCP-gaps.md` is useful, but it can become stale quickly around active governed branches and recently merged hardening slices.

### Concrete Example

`MCP-gaps.md` still describes `governed-implementation-route-hardening` as an unmerged dependency.

Current repo truth now shows:

- `governed-implementation-route-hardening` is completed
- the global feature index records it as completed
- merge and closeout commits already exist

### Hard Evidence

- file:
  - `MCP-gaps.md`
- slice:
  - `governed-implementation-route-hardening`
- files:
  - `implement-plan-state.json`
  - `features-index.json`

### Soft Evidence

- a contextless agent using the gap report alone could start from the wrong premise and waste time re-investigating closed work

### Pain Cost

- wasted analysis time
- wrong sequencing decisions
- confusion about whether the hardening branch is still a dependency

### What We Want To Solve

- refresh `MCP-gaps.md` before using it as planning authority for the next boxing steps

### Recommended Home

Separate documentation cleanup or open loop, not part of the current hardening slice

## Lesson 7: Step-01 Can Be Complete Even When Local Control-Plane Projections Lag

### Context

The boxed `dev_team` bootstrap work is already complete on `main`, but a contextless agent can still be misled by stale local control-plane projections.

This matters because Slice 02 depends on a truthful reading of what Step 01 already accomplished.

### Concrete Example

For `mcp-boxing/slice-01-dev-team-bootstrap`:

- the slice-local `implement-plan-state.json` on `origin/main` shows `completed / merged / marked_complete`
- the merge commit is `c92d074`
- the approved feature commit is `6e0ca59`
- but a local `.codex/implement-plan/features-index.json` projection can still show the slice as active or merge-blocked in some workspaces if that control-plane state has not been reconciled

### Hard Evidence

- slice: `mcp-boxing/slice-01-dev-team-bootstrap`
- files:
  - `implement-plan-state.json`
  - `completion-summary.md`
- git evidence:
  - merge commit `c92d074`

### Soft Evidence

- contextless agents often start from the global feature index because it is quick to read
- that shortcut is unsafe when the control plane is stale and the slice-local main truth is newer

### Pain Cost

- wrong sequencing for boxing work
- wasted time re-checking whether Step 01 is really done
- higher chance that Slice 02 tries to re-open bootstrap concerns that are already complete

### What We Want To Solve

Solve now:

- teach contextless agents to trust feature-local main truth over stale local control-plane projections when they conflict

Open loop for later:

- canonicalize which projection is the official default answer for boxed-department status

### Recommended Home

- immediate operator guidance: `MCP-gaps.md` and `slice-02-lane-admission-and-artifact-bridge/context.md`
- full projection unification: later open loop

## What To Fix Now

These are the highest-value fixes to do now:

1. human-verification merge blocking
2. stale human-approval invalidation
3. split-review truth hardening
4. pre-resume origin refresh
5. pre-merge origin refresh
6. local sync preserve-sync-restore
7. fail-closed restore recovery evidence

These are already aligned with the current slice contract and should not be split out unless the slice becomes technically stuck.

## What To Defer As Open Loops

These should stay out of the current slice unless they become unavoidable:

1. full projection unification across all governed artifacts
2. full completion-summary lifecycle regeneration
3. general cleanup of setup-helper inconsistencies from `MCP-gaps.md`
4. COO structural cleanup
5. KPI pattern cleanup
6. orphaned tools cleanup
7. general Brain or provenance fixes unrelated to the governed route

## Path To MCP Phase 2

For this report, "MCP Phase 2" means the later point where boxed `dev_team` begins to own real downstream governed execution rather than just intake and lane admission.

The clean path is:

1. finish `governed-approval-gates-and-local-sync-hardening`
2. complete `mcp-boxing/slice-02-lane-admission-and-artifact-bridge`
3. land `governed-state-writer-serialization`
4. land `implement-plan-provider-neutral-run-contract`
5. only then cut the downstream boxing slice that wires real implementation, review, merge, and approval handling behind `dev_team`

Why:

- Step 2 explicitly keeps full downstream execution out of scope
- later boxed execution needs stable state writes and a machine-facing run contract
- forcing those into the current hardening slice would make it too large and less reviewable

## Suggested Brain Open Loops

If Brain capture is available later, the following open loops are worth recording:

1. canonical post-merge closeout receipt for governed slices
2. projection drift between feature-local state and global feature index
3. completion-summary lifecycle regeneration from state
4. gap-report freshness discipline before boxing planning
5. route timing metrics for "implementation time vs closeout repair time"
6. projection drift between Slice 01 boxing truth and local control-plane status views
7. preconditions for the later boxed downstream execution slice:
   - stable governed state writes
   - provider-neutral machine-facing run contract

## Brain Capture Status

This runtime still does not expose the `project-brain` MCP write surface.

That means this report is currently the repo-backed fallback context artifact.

If a later session exposes Brain write tools, this report should be summarized there as:

- one reviewed lesson set for MCP boxing preconditions
- one reviewed sequencing decision for Slice 02 and later downstream boxing
- one reviewed open-loop set for projection unification and summary regeneration

## Best Path Forward

For a contextless agent, the best path forward is:

1. use `governed-approval-gates-and-local-sync-hardening` as the bounded fix slice
2. do not widen it into general governance cleanup
3. treat the lessons in this report as the reason that slice exists
4. finish that slice before attempting deeper migration of `implement-plan` behavior into MCP dev
5. refresh `MCP-gaps.md`
6. then continue with `mcp-boxing/slice-02-lane-admission-and-artifact-bridge`

For the later downstream boxing slice, do not start by reopening `coo-live-executive-status-wiring`.
That slice is real debt, but it is not the critical path to making `dev_team` safe enough for boxed lane admission.

## Bottom Line

The main lesson is simple:

The route is strong enough to implement work, but still too fragile at approval truth and local sync truth.

Those two failure families are the right things to solve now.

Everything broader should be treated as a later open loop unless it blocks that bounded hardening work directly.
