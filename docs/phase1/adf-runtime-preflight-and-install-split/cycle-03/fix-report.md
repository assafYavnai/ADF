1. Failure Classes Closed

- The Windows cmd-trampoline front door is now durably proved for install and bounded launch-preflight, so `recommended_commands.install` and `recommended_commands.launch` no longer overclaim a route that lacks governed evidence.
- The launcher KPI proof validator now fails closed on mixed proof/production partitions, missing route coverage, and missing repair-step coverage instead of accepting a happy-path subset of the promised closure contract.

2. Route Contracts Now Enforced

- The Windows launcher front door `adf.cmd --runtime-preflight --json`, `adf.cmd --install`, and `adf.cmd [flags] [-- <COO args>]` is now covered by a governed proof bundle that exercises the same cmd-trampoline entry surfaces the runtime-preflight contract recommends to Windows non-bash agents.
- The governed proof bundle still proves the canonical direct-bash launcher routes in the same run, so the bash workflow shell contract and the Windows trampoline front door are aligned rather than traded off against each other.
- Step `08-kpi-proof` now validates proof-only partitions, required launcher route rows, and required repair-step coverage for both direct-bash and cmd-trampoline install and launch-preflight routes on Windows proof runs.
- Claimed supported route / route mutated / route proved now align as `adf.sh` plus `adf.cmd` launcher entry surfaces -> bounded install and launch-preflight repair -> proof-partition launcher telemetry -> fail-closed KPI query.

3. Files Changed And Why

- [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh): added governed cmd install and cmd launch proof steps, reused stale-artifact validation on those logs, and passed the Windows cmd-front-door expectation into the KPI proof step.
- [launcher-route-telemetry-proof-lib.mjs](/C:/ADF/tools/launcher-route-telemetry-proof-lib.mjs): added explicit route and repair-step coverage rules for direct-bash and cmd-trampoline proof validation.
- [launcher-route-telemetry-proof.mjs](/C:/ADF/tools/launcher-route-telemetry-proof.mjs): now uses the shared fail-closed validation logic and records whether the current proof run is expected to include cmd-front-door coverage.
- [launcher-route-telemetry-proof.test.mjs](/C:/ADF/tools/launcher-route-telemetry-proof.test.mjs): added targeted regression tests that reject mixed partitions and missing repair-step coverage.
- [completion-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md): updated the authoritative feature summary to reference the new cmd-front-door proof bundle and validator hardening.
- [fix-plan.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-03/fix-plan.md) and [fix-report.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-03/fix-report.md): recorded the route contract freeze and closure result for the split-verdict fix pass.

4. Sibling Sites Checked

- [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs)
- [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md)
- [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md)
- [adf.cmd](/C:/ADF/adf.cmd)
- [adf.sh](/C:/ADF/adf.sh)
- [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh)
- [launcher-route-telemetry-proof.mjs](/C:/ADF/tools/launcher-route-telemetry-proof.mjs)
- [launcher-route-telemetry-proof-lib.mjs](/C:/ADF/tools/launcher-route-telemetry-proof-lib.mjs)
- [launcher-route-telemetry-proof.test.mjs](/C:/ADF/tools/launcher-route-telemetry-proof.test.mjs)

5. Proof Of Closure

- [proof-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T080127Z-cycle03-cmd-frontdoor/proof-summary.md) reports `PASS` for direct-bash runtime-preflight, cmd runtime-preflight, direct-bash install, cmd install, direct-bash launch-preflight, cmd launch-preflight, KPI proof, and help.
- [04-cmd-install.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T080127Z-cycle03-cmd-frontdoor/04-cmd-install.log) proves stale artifacts rebuilt through `adf.cmd --install`, emitted no shell predicate failures, and preserved `Runtime preflight was entered through adf.cmd (windows-cmd-trampoline).`
- [07-cmd-launch-preflight-scripted.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T080127Z-cycle03-cmd-frontdoor/07-cmd-launch-preflight-scripted.log) proves the scripted normal launch succeeded through the Windows cmd trampoline after rebuilding stale artifacts.
- [08-kpi-proof.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T080127Z-cycle03-cmd-frontdoor/08-kpi-proof.log) shows `expect_cmd_frontdoor: true`, only `proof` partition rows, no missing operations, no missing route coverage, no missing repair coverage, and a valid result across both direct-bash and cmd-trampoline entry surfaces.
- Targeted validator regression test passed: `node tools/launcher-route-telemetry-proof.test.mjs`.
- Targeted syntax checks passed: `bash -n docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh`, `node --check tools/launcher-route-telemetry-proof-lib.mjs`, `node --check tools/launcher-route-telemetry-proof.mjs`, and `node --check tools/launcher-route-telemetry-proof.test.mjs`.
- Negative proof covered: the validator test rejects mixed proof/production partitions and rejects missing cmd repair-step coverage.
- Live/proof isolation check: proof partitioning and proof-run identifiers remain telemetry metadata only; the live launcher behavior is still exercised through the real `adf.sh` and `adf.cmd` entrypoints.

6. Remaining Debt / Non-Goals

- No additional route implementation work is currently known, but the split-verdict workflow still requires an auditor-only rerun before the reviewer approval can be combined into closure.
- No launcher redesign, Brain transport work, or generic telemetry-platform rewrite was introduced in this cycle.

7. Next Cycle Starting Point

- Start cycle 04 in `rejecting_lane_only` mode, carrying the cycle-03 reviewer approval forward and rerunning only the auditor lane against [proof-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T080127Z-cycle03-cmd-frontdoor/proof-summary.md), [08-kpi-proof.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T080127Z-cycle03-cmd-frontdoor/08-kpi-proof.log), and the updated feature summary.
- If the auditor approves, the next step is the required final `regression_sanity` pass from the previously approving reviewer lane; no new implementation work should be necessary unless that auditor rerun finds a genuinely new route gap.
