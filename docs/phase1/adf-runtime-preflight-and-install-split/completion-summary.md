1. Objective Completed

Implemented the launcher/bootstrap split and then closed the governed closeout gaps exposed by review-cycle: explicit install/bootstrap and bounded launch repair now rebuild stale existing artifacts truthfully, the Windows trampoline proof route now fails closed unless it captures real runtime-preflight JSON, and launcher-route KPI proof now exists for the live startup surfaces claimed by this slice.

2. Deliverables Produced

- Fast runtime-preflight route in [adf.sh](/C:/ADF/adf.sh) via [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs)
- Explicit install/bootstrap route in [adf.sh](/C:/ADF/adf.sh)
- Runtime/install state recording at `.codex/runtime/install-state.json` on successful install route execution
- Strengthened runtime-preflight schema with explicit control-plane entrypoint truth and Brain MCP availability/verification truth
- Bounded launcher-route KPI emitter in [launcher-route-telemetry.mjs](/C:/ADF/tools/launcher-route-telemetry.mjs) plus proof query in [launcher-route-telemetry-proof.mjs](/C:/ADF/tools/launcher-route-telemetry-proof.mjs)
- Hardened governed proof runner in [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh) that validates cmd JSON, forces stale-artifact repair proof, and captures proof-partition KPI evidence
- Refreshed governed proof bundle under [proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4)

3. Files Changed And Why

- [adf.sh](/C:/ADF/adf.sh): fixed the stale-build predicate names, added launcher-route telemetry emission, and tied runtime-preflight, install, and launch-preflight closeout truth to the real route execution path.
- [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh): replaced exit-code-only cmd proof with artifact validation, forced stale-artifact install and launch proof, and added KPI proof capture.
- [launcher-route-telemetry.mjs](/C:/ADF/tools/launcher-route-telemetry.mjs): emits bounded route telemetry with production/proof partitioning and proof-run metadata.
- [launcher-route-telemetry-proof.mjs](/C:/ADF/tools/launcher-route-telemetry-proof.mjs): queries route telemetry by `proof_run_id` and verifies required operations plus cmd trampoline coverage.
- [onion-live.ts](/C:/ADF/COO/requirements-gathering/live/onion-live.ts): removed a duplicate telemetry field that was blocking a truthful COO rebuild during stale-artifact proof.
- [implement-plan-contract.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-contract.md) and [completion-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md): updated the authoritative contract and closeout summary to match the live proof and KPI rule.

4. Verification Evidence

- `bash -n adf.sh`
- `bash -n docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh`
- `node --check tools/launcher-route-telemetry.mjs`
- `node --check tools/launcher-route-telemetry-proof.mjs`
- `npm --prefix COO run build`
- [proof-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/proof-summary.md) shows `PASS` for authoritative bash runtime-preflight, Windows trampoline runtime-preflight, explicit install, post-install runtime-preflight, scripted launch preflight, KPI proof, and launcher help.
- [06-kpi-proof.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/06-kpi-proof.log) proves twelve launcher telemetry rows landed on the `proof` partition, required operations are all present, and the cmd trampoline runtime-preflight row exists.

5. Feature Artifacts Updated

- [README.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md)
- [context.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/context.md)
- [implement-plan-contract.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-contract.md)
- [completion-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md)
- [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh)
- [cycle-02/fix-plan.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-02/fix-plan.md)
- [cycle-02/fix-report.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-02/fix-report.md)
- [proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4)

6. Commit And Push Truth

- The original feature implementation commits `546f453`, `50aec53`, and `59dc2e5` are already ancestors of `main` and `origin/main`.
- This cycle is a governed closeout-reconciliation pass, not a new merge-to-main pass.
- Review-cycle state, not a fresh merge, is the authority for whether the cycle-02 remediation changes have completed git closeout.

7. Remaining Non-Goals / Debt

- Review-cycle still needs a fresh approval pass against the updated proof bundle before the stream can be treated as fully closed.
- No Brain transport redesign, launcher-mode expansion, or generic telemetry-platform rewrite is part of this slice.
