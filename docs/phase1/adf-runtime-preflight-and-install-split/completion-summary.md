1. Objective Completed

Implemented the launcher/bootstrap split and then closed the governed closeout gaps exposed by review-cycle: explicit install/bootstrap and bounded launch repair now rebuild stale existing artifacts truthfully, the Windows trampoline proof route now fails closed unless it captures real runtime-preflight JSON, Windows cmd-trampoline install and launch are now durably proved, and launcher-route KPI proof now fails closed on the live startup surfaces claimed by this slice.
- Repo-owned completion truth now matches the approved review and merged feature lifecycle.
- Final approved review now comes from cycle-04: the rerun auditor delta pass approved, then the carried-forward reviewer lane approved the required final `regression_sanity` pass on April 8, 2026.
- Final closeout reflects cycle-04 approved and closed and merge commit 7c3e3c92754f0dd6e52e46996286ca7d89c62df3.

2. Deliverables Produced

- Fast runtime-preflight route in [adf.sh](/C:/ADF/adf.sh) via [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs)
- Explicit install/bootstrap route in [adf.sh](/C:/ADF/adf.sh)
- Runtime/install state recording at `.codex/runtime/install-state.json` on successful install route execution
- Strengthened runtime-preflight schema with explicit control-plane entrypoint truth and Brain MCP availability/verification truth
- Bounded launcher-route KPI emitter in [launcher-route-telemetry.mjs](/C:/ADF/tools/launcher-route-telemetry.mjs) plus proof query in [launcher-route-telemetry-proof.mjs](/C:/ADF/tools/launcher-route-telemetry-proof.mjs)
- Shared fail-closed validator logic in [launcher-route-telemetry-proof-lib.mjs](/C:/ADF/tools/launcher-route-telemetry-proof-lib.mjs) plus targeted regression coverage in [launcher-route-telemetry-proof.test.mjs](/C:/ADF/tools/launcher-route-telemetry-proof.test.mjs)
- Hardened governed proof runner in [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh) that validates cmd JSON, proves cmd install and launch, forces stale-artifact repair proof, and captures proof-partition KPI evidence
- Refreshed governed proof bundles under [proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4) and [proof-runs/20260408T080127Z-cycle03-cmd-frontdoor](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T080127Z-cycle03-cmd-frontdoor)
- Reconciled the repo-owned completion artifacts to canonical main-root paths and merged closeout truth.
- Final review-only approval artifacts under [cycle-04](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-04) that closed the split verdict without further code changes.

3. Files Changed And Why

- [adf.sh](/C:/ADF/adf.sh): fixed the stale-build predicate names, added launcher-route telemetry emission, and tied runtime-preflight, install, and launch-preflight closeout truth to the real route execution path.
- [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh): replaced exit-code-only cmd proof with artifact validation, added cmd install and cmd launch proof, forced stale-artifact rebuild proof on both entry surfaces, and passed the stricter KPI validator contract into the bundle.
- [launcher-route-telemetry.mjs](/C:/ADF/tools/launcher-route-telemetry.mjs): emits bounded route telemetry with production/proof partitioning and proof-run metadata.
- [launcher-route-telemetry-proof-lib.mjs](/C:/ADF/tools/launcher-route-telemetry-proof-lib.mjs), [launcher-route-telemetry-proof.mjs](/C:/ADF/tools/launcher-route-telemetry-proof.mjs), and [launcher-route-telemetry-proof.test.mjs](/C:/ADF/tools/launcher-route-telemetry-proof.test.mjs): now validate direct-bash and cmd-front-door route coverage, reject mixed partitions, and reject missing repair-step coverage.
- [onion-live.ts](/C:/ADF/COO/requirements-gathering/live/onion-live.ts): removed a duplicate telemetry field that was blocking a truthful COO rebuild during stale-artifact proof.
- [implement-plan-contract.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-contract.md) and [completion-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md): updated the authoritative contract and closeout summary to match the live proof and KPI rule.
- [cycle-04/audit-findings.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-04/audit-findings.md), [cycle-04/review-findings.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-04/review-findings.md), and [cycle-04/fix-report.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-04/fix-report.md): record the review-only approval closeout that cleared the split verdict.

4. Verification Evidence

- `bash -n adf.sh`
- `bash -n docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh`
- `node --check tools/launcher-route-telemetry-proof-lib.mjs`
- `node --check tools/launcher-route-telemetry.mjs`
- `node --check tools/launcher-route-telemetry-proof.mjs`
- `node --check tools/launcher-route-telemetry-proof.test.mjs`
- `node tools/launcher-route-telemetry-proof.test.mjs`
- `npm --prefix COO run build`
- [proof-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/proof-summary.md) shows `PASS` for authoritative bash runtime-preflight, Windows trampoline runtime-preflight, explicit install, post-install runtime-preflight, scripted launch preflight, KPI proof, and launcher help.
- [06-kpi-proof.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/06-kpi-proof.log) proves twelve launcher telemetry rows landed on the `proof` partition, required operations are all present, and the cmd trampoline runtime-preflight row exists.
- [proof-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T080127Z-cycle03-cmd-frontdoor/proof-summary.md) shows `PASS` for cmd install, cmd launch-preflight, and the stricter KPI proof step.
- [08-kpi-proof.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T080127Z-cycle03-cmd-frontdoor/08-kpi-proof.log) proves proof-only partitions, direct-bash and cmd-front-door route coverage, and complete repair-step coverage for install and launch-preflight.
- [cycle-04/audit-findings.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-04/audit-findings.md) and [cycle-04/review-findings.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-04/review-findings.md) both ended `Final Verdict: APPROVED`.
- `node tools/launcher-route-telemetry-proof.test.mjs` passed during the cycle-04 closeout pass.
- `node tools/launcher-route-telemetry-proof.mjs --repo-root C:/ADF --proof-run-id 20260408T080127Z-cycle03-cmd-frontdoor --expect-cmd-frontdoor true` passed during the cycle-04 closeout pass.
- `adf.cmd --runtime-preflight --json` passed during the cycle-04 closeout pass and still reported `control_plane.kind=windows-cmd-trampoline` with `entrypoint=adf.cmd`.
- Execution Contract / Run Projection Proof: repo-owned state, execution contract, and run projection now point at canonical C:/ADF artifact paths.
- Review-Cycle Status: cycle-04 approved and closed
- Merge Status: already landed on `main` / `origin/main` and reconciled to completed state after cycle-04 approval; no merge-queue replay was performed (closeout commit `7c3e3c92754f0dd6e52e46996286ca7d89c62df3`).
- Local Target Sync Status: fetched_only

5. Feature Artifacts Updated

- [README.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md)
- [context.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/context.md)
- [implement-plan-contract.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-contract.md)
- [completion-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md)
- [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh)
- [cycle-02/fix-plan.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-02/fix-plan.md)
- [cycle-02/fix-report.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-02/fix-report.md)
- [proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4)
- [cycle-03/fix-plan.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-03/fix-plan.md)
- [cycle-03/fix-report.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-03/fix-report.md)
- [proof-runs/20260408T080127Z-cycle03-cmd-frontdoor](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T080127Z-cycle03-cmd-frontdoor)
- [cycle-04/audit-findings.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-04/audit-findings.md)
- [cycle-04/review-findings.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-04/review-findings.md)
- [cycle-04/fix-report.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-04/fix-report.md)
- [implement-plan-state.json](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-state.json)
- [implementation-run](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implementation-run)
- `docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md`
- `docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-state.json`
- `docs/phase1/adf-runtime-preflight-and-install-split/implementation-run/`

6. Commit And Push Result

- Approved feature commit: 91d9919df3fa6c0724ab872aaf904a5c21221a7b
- Merge commit: 7c3e3c92754f0dd6e52e46996286ca7d89c62df3
- Push: success to origin/main
- Closeout note: Legacy already-landed feature reconciled to completed state after cycle-04 review approval; no merge-queue replay was performed.

7. Remaining Non-Goals / Debt

- No launcher-route defect remains open in review-cycle after the cycle-04 auditor approval and final reviewer regression-sanity approval.
- No Brain transport redesign, launcher-mode expansion, or generic telemetry-platform rewrite is part of this slice.
