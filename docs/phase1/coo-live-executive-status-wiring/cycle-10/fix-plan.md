1. Failure Classes

- The cycle-09 approved commit `a5f24c36bfbb9076a1b8c9f92219b76a04370ae7` is blocked in merge-queue because this slice's governed artifacts no longer merge cleanly onto current `main`.
- Any truthful blocker fix will create a successor candidate commit, which makes the existing cycle-09 approval stale for final landing.
- The current blocked-merge state and completed cycle-09 approval truth exist locally in the feature worktree and must be preserved durably on-branch before the slice can move to the next review pass.

2. Route Contracts

- Supported product route to preserve: `CLI /status -> printExecutiveStatus -> buildLiveExecutiveStatus -> renderStatusWithAgent -> invoke(primary codex | fallback claude) -> ensureSupportedLiveStatusBody`.
- Supported closeout route to repair: `approved feature branch -> merge-queue -> main/origin/main -> mark-complete`.
- Product invariant: `shared/llm-invoker/invoker.ts` must continue to send the Codex prompt through stdin, not argv, and the bounded fallback proof in `shared/llm-invoker/invoker.test.ts` must remain intact.
- Closeout invariant: the successor candidate must merge cleanly against current `main`, and its governed artifacts must truthfully preserve cycle-09 approval history, cycle-10 rejection history, and the blocked merge evidence without inventing a completed landing.
- Allowed mutation surfaces:
  - `docs/phase1/coo-live-executive-status-wiring/implement-plan-state.json`
  - `docs/phase1/coo-live-executive-status-wiring/review-cycle-state.json`
  - `docs/phase1/coo-live-executive-status-wiring/implement-plan-execution-contract.v1.json`
  - `docs/phase1/coo-live-executive-status-wiring/implementation-run/legacy-normal-phase1-coo-live-executive-status-wiring-2026-04-08T14-17-03.526Z/*`
  - `docs/phase1/coo-live-executive-status-wiring/cycle-10/*`
  - merge metadata required to integrate current `main` into the feature branch
- Forbidden shared-surface expansion:
  - no `skills/implement-plan/*`, `skills/review-cycle/*`, or `skills/merge-queue/*` edits
  - no changes to unrelated feature streams
  - no new COO behavior or formatting changes outside the already-approved transport fix

3. Sweep Scope

- `docs/phase1/coo-live-executive-status-wiring/implement-plan-state.json`
- `docs/phase1/coo-live-executive-status-wiring/review-cycle-state.json`
- `docs/phase1/coo-live-executive-status-wiring/implement-plan-execution-contract.v1.json`
- `docs/phase1/coo-live-executive-status-wiring/implementation-run/legacy-normal-phase1-coo-live-executive-status-wiring-2026-04-08T14-17-03.526Z/execution-contract.v1.json`
- `docs/phase1/coo-live-executive-status-wiring/implementation-run/legacy-normal-phase1-coo-live-executive-status-wiring-2026-04-08T14-17-03.526Z/run-projection.v1.json`
- `docs/phase1/coo-live-executive-status-wiring/cycle-10/*`
- `shared/llm-invoker/invoker.ts`
- `shared/llm-invoker/invoker.test.ts`

4. Planned Changes

- Durably commit the current blocked-merge truth and cycle-10 review artifacts on the feature branch so the branch is no longer carrying uncommitted governed state.
- Integrate current `main` into the feature branch and resolve only this slice's governed-artifact conflicts, preserving the already-approved `/status` transport/test behavior.
- Keep `shared/llm-invoker/invoker.ts` and `shared/llm-invoker/invoker.test.ts` unchanged unless the integration itself forces a minimal reconciliation; if forced, keep the route bounded to the already-approved stdin transport and fallback proof.
- Produce a successor candidate commit that is mergeable, truthfully marked as replacing the blocked approved candidate, and ready for a fresh review cycle rather than fictional completion.

5. Closure Proof

- `git merge origin/main` (or equivalent truthful integration) completes on the feature branch with no remaining conflicts.
- `git diff --name-only a5f24c36bfbb9076a1b8c9f92219b76a04370ae7..HEAD -- shared/llm-invoker` shows no unintended widening beyond the already-approved transport/test surface.
- `node --check shared/llm-invoker/invoker.ts`
- `node --check shared/llm-invoker/invoker.test.ts`
- `tsx --test --test-concurrency=1 --test-force-exit --test-reporter=spec shared/llm-invoker/invoker.test.ts`
- Fresh live COO status smoke on the successor candidate using the same `adf.cmd -- --status --scope-path assafyavnai/adf/phase1` route.
- `fix-report.md` captures the exact successor candidate SHA and states that another approval cycle is required before merge-queue resume.

6. Non-Goals

- No merge-queue helper or implement-plan helper changes.
- No manual edits to stale root governed artifacts outside the helper-driven route.
- No new CEO-facing status behavior, formatting, or scope expansion.
- No claim that cycle-10 completes final closeout; this cycle only repairs the blocked candidate and hands the successor head to the next review pass.
