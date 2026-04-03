1. Findings

Overall Verdict: REJECTED

- failure class: merge-approval-bypass
  broken route invariant in one sentence: The merge queue must only accept an explicitly approved commit, but enqueue currently falls back to the feature's last implementation commit even when no approval has been recorded.
  exact route (A -> B -> C): implement-plan approval gate -> merge-queue enqueue -> process-next merge to target branch
  exact file/line references: [merge-queue-helper.mjs](/C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs):202, [merge-queue-helper.mjs](/C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs):204, [workflow-contract.md](/C:/ADF/skills/merge-queue/references/workflow-contract.md):43
  concrete operational impact: Any caller that can enqueue a feature with only `last_commit_sha` populated can land an unreviewed or pre-approval commit onto the target branch.
  sweep scope: enqueue callers, implement-plan approval-state handoff, and any other queue entry points that derive merge authority from feature state
  closure proof: prove enqueue rejects a state that has `last_commit_sha` but no `approved_commit_sha`, and prove a state with `approved_commit_sha` still enqueues and lands the exact approved commit
  shared-surface expansion risk: present and where: the public merge-queue enqueue surface accepts merge authority from shared feature state
  negative proof required: show that sibling callers cannot queue a merge from unapproved feature state or by relying on `last_commit_sha`
  live/proof isolation risk: none
  claimed-route vs proved-route mismatch risk: present and why: the current smoke proves only a happy approved path and never proves that the unapproved route is blocked
  status: live defect

- failure class: same-lane-merge-serialization-breach
  broken route invariant in one sentence: A target branch lane must have at most one in-progress merge at a time, but `process-next` can start another queued request on the same lane while a prior request is already in progress.
  exact route (A -> B -> C): queue lane with queued requests -> process-next selection -> temporary merge worktree landing
  exact file/line references: [merge-queue-helper.mjs](/C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs):286, [merge-queue-helper.mjs](/C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs):288, [merge-queue-helper.mjs](/C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs):504, [workflow-contract.md](/C:/ADF/skills/merge-queue/references/workflow-contract.md):36
  concrete operational impact: Repeated or concurrent processors can overlap two merges onto the same target branch, breaking FIFO lane semantics and reintroducing integration conflicts the queue was supposed to serialize away.
  sweep scope: queue selection logic, lane status reporting, process-next callers, and any logic that interprets `in_progress` requests
  closure proof: prove that a lane with one `in_progress` request does not start another request on the same branch, while a different branch lane can still be selected independently
  shared-surface expansion risk: present and where: the shared merge processor controls all target-branch landing behavior
  negative proof required: show that a second same-branch request remains queued while another request in that lane is `in_progress`
  live/proof isolation risk: none
  claimed-route vs proved-route mismatch risk: present and why: current proof covers only a single clean merge and does not prove FIFO serialization once one request is already active
  status: live defect

2. Conceptual Root Cause

- The merge lane contract is documented, but enqueue and selection policy still trust convenience state (`last_commit_sha`) and global oldest-request selection instead of enforcing the lane-level authority and serialization invariants directly in helper code.
- The current proof strategy validates the happy merge path only. It does not require negative proof for shared merge surfaces, so approval bypass and same-lane overlap remained invisible.

3. High-Level View Of System Routes That Still Need Work

- Route: implement-plan approval -> merge-queue enqueue -> merge landing
  what must be frozen before implementation: only `approved_commit_sha` authorizes queue entry; `last_commit_sha` is implementation evidence, not merge authority
  why endpoint-only fixes will fail: patching only the enqueue call site without sweeping state-derived fallbacks will leave another path that can still promote an unapproved commit
  the minimal layers that must change to close the route: merge-queue enqueue logic, merge-queue contract/docs, and proof that approval-less state is rejected
  explicit non-goals, so scope does not widen into general refactoring: do not redesign implement-plan approval flow or broader git lifecycle state
  what done looks like operationally: enqueue rejects unapproved state, accepts approved state, and the landed commit is exactly the approved commit

- Route: queued same-branch requests -> process-next -> merge worktree landing
  what must be frozen before implementation: one `in_progress` request per `base_branch` lane; FIFO continues only after that request resolves
  why endpoint-only fixes will fail: changing only summary output or queue status text will not stop a second processor from selecting the same branch lane
  the minimal layers that must change to close the route: merge-queue request selection logic, queue-state proof, and lane-level verification coverage
  explicit non-goals, so scope does not widen into general refactoring: do not build a distributed worker scheduler or cross-branch global arbitration system
  what done looks like operationally: while one branch lane is `in_progress`, another same-branch request stays queued; once that lane clears, the next queued request becomes eligible

Final Verdict: REJECTED
