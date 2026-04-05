1. Failure Classes Closed

- Closed: tracked local operational setup files are no longer part of normal repo history for `review-cycle`, and governed merge closeout now rejects approved branch deltas that add or modify `.codex/*/setup.json`.

2. Route Contracts Now Enforced

- `review-cycle` setup at `.codex/review-cycle/setup.json` is documented as local operational state that may be recreated or refreshed locally but must not be committed.
- `merge-queue enqueue` rejects approved commits whose branch delta against the target base branch adds or modifies `.codex/*/setup.json`.
- `merge-queue process-next` re-checks the same branch delta before merge as a second guard.
- The one-time repo cleanup path is preserved by allowing pure deletion of the previously tracked setup file.

3. Files Changed And Why

- `.codex/review-cycle/setup.json`: removed from source control so worktree-local review setup stops participating in merges.
- `skills/merge-queue/scripts/merge-queue-helper.mjs`: added branch-delta inspection and local-setup guard at enqueue and process time.
- `skills/merge-queue/SKILL.md`: documented the new rejection rule and the allowed one-time deletion.
- `skills/merge-queue/references/workflow-contract.md`: documented that enqueue and process both reject added or modified `.codex/*/setup.json`.
- `skills/review-cycle/SKILL.md`: documented that review-cycle setup is local operational state.
- `skills/review-cycle/references/workflow-contract.md`: documented the local-only setup rule and removed setup artifacts from cycle commit expectations.
- `skills/review-cycle/references/setup-contract.md`: documented that `setup.json` is local operational state and must not be committed.
- `docs/phase1/review-cycle-setup-merge-safety/*`: captured the feature contract, context, and cycle proof for this slice.

4. Sibling Sites Checked

- `.codex/*/setup.json` pattern, not only `.codex/review-cycle/setup.json`
- `merge-queue` entry surfaces: `enqueue` and `process-next`
- review-cycle setup authority docs and helper recreation path
- local generated skill installs through `skills/manage-skills.mjs`

5. Proof Of Closure

- `node --check skills/merge-queue/scripts/merge-queue-helper.mjs` passed.
- `git diff --check` passed with no patch-format errors.
- Historical bad pattern: a temporary commit `72067c5eec4cec9ed09c8f1e053cce3754b182e6` that added `.codex/review-cycle/setup.json` was rejected by `merge-queue-helper.mjs enqueue` with the message `Cannot merge approved commit ... adds or modifies local operational setup files...`.
- Allowed migration path: `git diff --name-status main -- .codex` on this branch reported `D .codex/review-cycle/setup.json`, which is the only allowed setup-path delta.
- Local recreation: `review-cycle-setup-helper.mjs write-setup` recreated `.codex/review-cycle/setup.json` under the worktree, and `git status --short --branch` remained clean because the file is ignored and no longer tracked.
- Generated installs: `node skills/manage-skills.mjs install` and `node skills/manage-skills.mjs check` both completed without errors.
- Claimed supported route / route mutated / route proved: all three align on local review-cycle setup recreation plus merge-queue rejection of added or modified `.codex/*/setup.json`.

6. Remaining Debt / Non-Goals

- The separate implement-plan bug that writes new feature docs into the main checkout before worktree creation still exists and was intentionally left out of this slice.
- No broader `.codex` artifact cleanup was attempted.

7. Next Cycle Starting Point

- None. Review approval is sufficient for this slice.
- Next governed step after this cycle is feature-branch approval handoff, then merge-queue when requested.
