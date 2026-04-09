1. Failure Classes

- Primary Codex transport still appends the full `/status` prompt into argv, which can overflow Windows command length and fail before response validation, leaving the CEO-facing route without a result.
- Primary transport fallback behavior is unproven on reopened head: we need fresh evidence that a primary `codex` launch failure recovers through configured fallback rather than leaving a partially accepted state.
- Cycle-07 artifacts are stale for this reopened head and cannot be used as closure proof for cycle-08.

2. Route Contracts

- Supported route for this pass: `CLI /status -> printExecutiveStatus -> buildLiveExecutiveStatus -> renderStatusWithAgent -> invoke(primary codex | fallback claude) -> ensureSupportedLiveStatusBody`.
- Primary transport invariant to restore: the Codex launch must not append the full CEO prompt to argv on Windows.
- Fallback invariant to prove: a primary `codex` launch failure must still invoke configured `claude` fallback with the same prompt payload and return a valid response.
- Live route invariant to preserve: the reopened COO `/status` route must still render a supported CEO-facing status body after the transport repair.

3. Sweep Scope

- `shared/llm-invoker/invoker.ts`
- `shared/llm-invoker/invoker.test.ts`
- `docs/phase1/coo-live-executive-status-wiring/cycle-08/*`

4. Planned Changes

- Change Codex invocation from argv prompt payload to stdin transport in `runCodexCommand` using the CLI-supported prompt token (`-`) and `stdinText`.
- Add regression tests that execute the shared invoker on this branch with controlled fake `codex` / `claude` CLIs to prove:
  - large prompt is not present in spawned arguments,
  - large prompt is present in stdin payload (or equivalent logged evidence),
  - fallback is attempted and accepted after primary launch failure.
- Add cycle-08 fresh proof artifacts only after verification:
  - `fix-report.md`
  - a current-head live `/status` smoke capture for this reopened branch.

5. Closure Proof

- `tsx --test shared/llm-invoker/invoker.test.ts` must include:
  - one passing regression that shows the primary Codex path does not include the prompt on argv,
  - one passing regression that shows primary-launch failure and fallback `claude` success both occur and return a fallback response.
- `node --check shared/llm-invoker/invoker.ts`
- `node --check shared/llm-invoker/invoker.test.ts`
- Fresh route proof:
  - `./adf.sh -- --status --scope-path assafyavnai/adf/phase1` from worktree head
  - capture output file in `cycle-08/fix-report.md` with pass/fail status for live CEO-facing smoke.

6. Non-Goals

- No status-contract rewrite.
- No implement-plan/review-cycle/merge-queue edits.
- No provider architecture refactor beyond minimal Codex transport and recovery-proofing.
