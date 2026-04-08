# Requirements

## Approval Gates

1. `merge-queue` must refuse landing when a slice requires human verification and durable human-verification truth is not present.
2. `implement-plan` must fail closeout or completion when human-verification truth is missing, stale, or contradicted by state/artifacts.
3. Post-human code changes that alter approved human-facing behavior must invalidate prior human approval until a new explicit approval is recorded.
4. Split review verdicts must not be promotable to `merge_ready`, `merged`, or `completed` truth.

## Sync Policy

5. The governed feature worktree must refresh origin truth before implementation begins or resumes.
6. The merge route must refresh origin/base truth before landing.
7. Local target synchronization after merge must preserve tracked and untracked local changes, sync the target branch, then restore the preserved local state.
8. If restore fails or conflicts, the route must fail closed, preserve the local changes durably, and emit recovery evidence instead of silently dropping or overwriting anything.

## Proof

9. Proof must cover clean local sync, dirty tracked sync, dirty untracked sync, and restore-failure handling.
10. Proof must cover negative cases for:
    - required human verification missing
    - human approval stale after post-human change
    - split review verdict promoted incorrectly
11. The exact approved-SHA landing rule must remain intact.
