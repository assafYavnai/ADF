1. Failure Classes Closed

- The live COO `/status` route no longer sends the full CEO prompt through the Codex argv path, so the Windows command-length failure class is closed on reopened head.
- Primary-launch fallback behavior is now freshly proved for cycle-08: a failed `codex` launch falls through to `claude` and returns a fallback response instead of leaving the route without an answer.
- Cycle-07 proof reuse is no longer required for this regression. Cycle-08 now has current-head invoker proof plus a fresh live `/status` smoke artifact.

2. Route Contracts Now Enforced

- Supported route for this pass: `CLI /status -> printExecutiveStatus -> buildLiveExecutiveStatus -> renderStatusWithAgent -> invoke(primary codex | fallback claude) -> ensureSupportedLiveStatusBody`.
- Primary Codex transport invariant: the prompt is passed on stdin and the argv payload ends with the CLI stdin token `-` rather than the full prompt body.
- Fallback invariant: when the primary Codex launch fails before response parsing, the configured Claude fallback is still invoked with the same prompt payload on stdin and can return a valid response.
- Live route invariant: the reopened COO `/status` command still renders a supported CEO-facing status body after the transport repair.

3. Files Changed And Why

- `shared/llm-invoker/invoker.ts`
  - changes Codex invocation from argv prompt transport to stdin transport by appending `-` and passing `stdinText`
- `shared/llm-invoker/invoker.test.ts`
  - adds child-process-backed regression proof for the Codex stdin transport and the Codex-to-Claude fallback path
  - uses explicit Node-backed fake CLI shims on Windows so the proof does not depend on ambient PATH resolution
  - marks the env-mutating tests non-concurrent because they rewrite process PATH during the proof
- `docs/phase1/coo-live-executive-status-wiring/cycle-08/status-smoke.txt`
  - captures the fresh reopened-head COO `/status` smoke output used for cycle-08 closeout proof

4. Sibling Sites Checked

- `shared/llm-invoker/invoker.ts`
- `shared/llm-invoker/invoker.test.ts`
- `COO/controller/executive-status.ts`
- `docs/phase1/coo-live-executive-status-wiring/cycle-08/status-smoke.txt`
- `docs/phase1/coo-live-executive-status-wiring/cycle-08/fix-plan.md`

5. Proof Of Closure

- Syntax checks passed:
  - `node --check shared/llm-invoker/invoker.ts`
  - `node --check shared/llm-invoker/invoker.test.ts`
- Fresh invoker regression proof passed:
  - `tsx --test --test-concurrency=1 --test-force-exit --test-reporter=spec shared/llm-invoker/invoker.test.ts`
  - Result: 3 tests passed, 0 failed
  - Proof covered:
    - primary Codex launch arguments do not contain the long prompt
    - primary Codex launch receives the prompt on stdin
    - fallback Claude launch also receives the prompt on stdin after a simulated primary-launch failure
- Fresh live COO smoke passed:
  - `./adf.cmd -- --status --scope-path assafyavnai/adf/phase1 > docs/phase1/coo-live-executive-status-wiring/cycle-08/status-smoke.txt 2>&1`
  - Result: command exited 0 and rendered a supported CEO-facing `# COO Executive Status` body in `status-smoke.txt`

6. Remaining Debt / Non-Goals

- This cycle does not change the COO status contract itself beyond restoring transport reliability on the existing route.
- This cycle does not alter provider-selection policy; it only proves the already-configured fallback path behaves correctly when the primary launch fails.
- In this runtime, plain `tsx --test shared/llm-invoker/invoker.test.ts` did not terminate cleanly after reporting. The closure proof therefore used the same test file with `--test-concurrency=1 --test-force-exit` so the pass result is truthful and bounded to the reopened regression.

7. Next Cycle Starting Point

- Review cycle should resume from the existing cycle-08 rejecting-lane follow-up using this fix report and `status-smoke.txt` as the fresh proof set.
