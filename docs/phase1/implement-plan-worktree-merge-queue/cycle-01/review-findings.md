1. Closure Verdicts

Overall Verdict: REJECTED

- failure class: merge-approval-bypass
  status: Open
  enforced route invariant: Not enforced. Queue entry still accepts `last_commit_sha` when no approved commit exists.
  evidence shown: [merge-queue-helper.mjs](/C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs):202-205 derives merge authority from `approved_commit_sha ?? last_commit_sha`.
  missing proof: No negative proof shows enqueue rejection when approval has not been recorded.
  sibling sites still uncovered: other enqueue callers that rely on feature-state derivation rather than an explicit approved commit
  whether broader shared power was introduced and whether that was justified: Broader shared power was introduced on the merge queue surface by allowing implementation state to function as merge authority, and it is not justified.
  whether negative proof exists where required: No.
  whether live-route vs proof-route isolation is shown: Yes for the happy path only; no isolation concern was shown, but rejection proof is missing.
  claimed supported route / route mutated / route proved: claimed route = approved commit queues and lands; route mutated = any feature with `last_commit_sha` can queue; route proved = only approved happy-path merge smoke
  whether the patch is route-complete or endpoint-only: Endpoint-only. It implements the happy path but leaves the approval boundary open.

- failure class: same-lane-merge-serialization-breach
  status: Open
  enforced route invariant: Not enforced. A lane with one `in_progress` request is still eligible for another same-branch selection.
  evidence shown: [merge-queue-helper.mjs](/C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs):286-297 marks one request `in_progress`, while [merge-queue-helper.mjs](/C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs):504-517 still selects any queued request without excluding lanes already in progress.
  missing proof: No proof covers two queued requests on the same base branch or shows that only one can run at a time.
  sibling sites still uncovered: status and queue orchestration paths that assume lane serialization but do not enforce it
  whether broader shared power was introduced and whether that was justified: Broader shared power was introduced in the shared merge processor by allowing concurrent same-lane landing attempts, and it is not justified.
  whether negative proof exists where required: No.
  whether live-route vs proof-route isolation is shown: Yes for the single-merge path only; the multi-request live route remains unproved.
  claimed supported route / route mutated / route proved: claimed route = FIFO per target branch lane; route mutated = global oldest queued request regardless of lane occupancy; route proved = one clean single-request merge
  whether the patch is route-complete or endpoint-only: Endpoint-only. It proves a clean merge but not the queue-lane invariant the feature claims to support.

2. Remaining Root Cause

- The merge queue still lacks hard route gates for approval authority and lane occupancy. The contract says those surfaces are controlled, but helper code does not enforce the same invariants before landing begins.

3. Next Minimal Fix Pass

- Fix pass: tighten enqueue authority
  what still breaks: unapproved feature state can still create a merge request
  what minimal additional layers must change: merge-queue enqueue helper plus the merge-queue contract/docs and state-hand-off evidence
  what proof is still required: a rejecting enqueue proof for missing `approved_commit_sha` and a passing proof for explicit approved commit flow

- Fix pass: enforce same-lane serialization
  what still breaks: a second request on the same base branch can start while another request is already `in_progress`
  what minimal additional layers must change: merge-queue lane selection logic plus queue-state verification coverage
  what proof is still required: same-lane blocking proof and cross-lane independence proof

Final Verdict: REJECTED
