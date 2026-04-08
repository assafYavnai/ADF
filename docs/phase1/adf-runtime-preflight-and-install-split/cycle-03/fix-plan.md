1. Failure Classes

- Windows cmd-trampoline install and launch are still claimed by `recommended_commands.install` and `recommended_commands.launch`, but the governed proof bundle only proves the cmd front door for runtime-preflight.
- The launcher KPI proof validator still accepts a happy-path subset of the promised closure contract instead of failing closed on non-proof partitions or missing repair-step coverage.

2. Route Contracts

- Failure class: Windows cmd-trampoline install and launch are still claimed by `recommended_commands.install` and `recommended_commands.launch`, but the governed proof bundle only proves the cmd front door for runtime-preflight.
  - claimed supported route: Windows-native control plane -> `adf.cmd --runtime-preflight --json` -> `recommended_commands.install` / `recommended_commands.launch` -> `adf.cmd --install` and `adf.cmd [flags] [-- <COO args>]` -> `adf.cmd` trampoline -> `adf.sh` install / bounded launch preflight
  - end-to-end invariant: if Windows non-bash agents are told to use `adf.cmd` for install and launch, the governed proof bundle and route-level telemetry must include durable cmd-trampoline evidence for those same entry surfaces rather than only the direct-bash route.
  - KPI Applicability: required
  - KPI Route / Touched Path: launcher runtime-preflight, explicit install, and bounded normal launch preflight on both direct-bash and windows-cmd-trampoline entry surfaces, plus their bounded repair substeps
  - KPI Raw-Truth Source: proof-partition launcher telemetry rows keyed to the governed proof-run id plus durable proof logs for the cmd entry surfaces
  - KPI Coverage / Proof: governed proof must capture `adf.cmd --install` and a scripted `adf.cmd --built -- --test-proof-mode` run, and the KPI query must show `entrypoint=adf.cmd` / `control_plane_kind=windows-cmd-trampoline` for install, launch-preflight, and their repair-step telemetry
  - KPI Production / Proof Partition: all governed proof rows must stay on `telemetry_partition=proof`; proof rows must not count as production truth
  - KPI Non-Applicability Rationale: Not applicable because this failure class is about an actively claimed live launcher route
  - KPI Exception Owner: Not applicable.
  - KPI Exception Expiry: Not applicable.
  - KPI Exception Production Status: Not applicable.
  - KPI Compensating Control: Not applicable.
  - Vision Compatibility: Compatible. This keeps startup-truth claims aligned with the real launcher front door instead of broadening scope.
  - Phase 1 Compatibility: Compatible. This is still bounded Phase 1 launcher/bootstrap truth work.
  - Master-Plan Compatibility: Compatible. The change tightens claimed-route versus proved-route truth on the supported launcher entry surfaces.
  - Current Gap-Closure Compatibility: Compatible. It closes the remaining governed-closeout gap for Windows launcher entrypoint truth.
  - Later-Company Check: no
  - Compatibility Decision: compatible
  - Compatibility Evidence: the bootstrap docs, feature contract, and KPI rule already tell Windows non-bash agents to trust `recommended_commands.*`, so the proof bundle must either prove those cmd routes or the claim stays open.
  - allowed mutation surfaces: `docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh`, `tools/launcher-route-telemetry-proof*.mjs`, targeted test files under `tools/`, this feature's proof artifacts, and directly affected feature docs
  - forbidden shared-surface expansion: no launcher redesign, no new control-plane mode, no generic telemetry-platform rewrite, and no unrelated COO behavior work
  - docs that must be updated: `docs/phase1/adf-runtime-preflight-and-install-split/cycle-03/fix-plan.md`, `docs/phase1/adf-runtime-preflight-and-install-split/cycle-03/fix-report.md`, `docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md`, and refreshed proof artifacts under `proof-runs/`

- Failure class: The launcher KPI proof validator still accepts a happy-path subset of the promised closure contract instead of failing closed on non-proof partitions or missing repair-step coverage.
  - claimed supported route: `run-proof-sequence.sh` -> `step_kpi_proof` -> `launcher-route-telemetry-proof.mjs` -> governed proof summary / review-cycle closeout
  - end-to-end invariant: step `06-kpi-proof` must fail unless the proof run contains only proof-partition launcher rows, all required top-level launcher operations, and the promised repair-step coverage for each exercised install and launch-preflight route.
  - KPI Applicability: required
  - KPI Route / Touched Path: launcher KPI proof query and validation logic for governed proof bundles
  - KPI Raw-Truth Source: telemetry rows in the `telemetry` table keyed by `proof_run_id`, plus a targeted validator regression test that exercises negative cases without writing production telemetry
  - KPI Coverage / Proof: the validator must reject non-proof partitions, reject missing route coverage, reject missing repair-step coverage, and be covered by a targeted automated test alongside a passing governed proof bundle
  - KPI Production / Proof Partition: proof bundles must validate proof-only partitions and reject production or mixed partitions for the active proof run
  - KPI Non-Applicability Rationale: Not applicable because this is the route that certifies KPI closure for the launcher slice
  - KPI Exception Owner: Not applicable.
  - KPI Exception Expiry: Not applicable.
  - KPI Exception Production Status: Not applicable.
  - KPI Compensating Control: Not applicable.
  - Vision Compatibility: Compatible. This hardens truthful closeout rather than expanding product scope.
  - Phase 1 Compatibility: Compatible. It is bounded route-proof enforcement for the active launcher slice.
  - Master-Plan Compatibility: Compatible. It enforces fail-closed proof on the actual startup route contract.
  - Current Gap-Closure Compatibility: Compatible. It closes the remaining KPI-proof enforcement gap from the rejected auditor pass.
  - Later-Company Check: no
  - Compatibility Decision: compatible
  - Compatibility Evidence: the cycle-02 fix-plan and KPI governance already require proof-partition truth and repair-step coverage; the validator must encode that policy directly.
  - allowed mutation surfaces: `tools/launcher-route-telemetry-proof.mjs`, a small shared validation helper under `tools/` if needed, a targeted proof-validator test, `run-proof-sequence.sh`, and directly affected feature docs or proof artifacts
  - forbidden shared-surface expansion: no telemetry schema redesign, no new DB tables, no generic proof framework, and no unrelated memory-engine telemetry work
  - docs that must be updated: `docs/phase1/adf-runtime-preflight-and-install-split/cycle-03/fix-plan.md`, `docs/phase1/adf-runtime-preflight-and-install-split/cycle-03/fix-report.md`, `docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md`, and refreshed proof artifacts under `proof-runs/`

3. Sweep Scope

- `tools/agent-runtime-preflight.mjs`, `docs/bootstrap/cli-agent.md`, `docs/bootstrap/vscode-agent.md`, and `adf.cmd` for the current Windows cmd front-door claim
- `docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh` for governed proof capture and summary text
- `tools/launcher-route-telemetry-proof.mjs` and any new targeted validator test under `tools/`
- `adf.sh` launcher telemetry emission paths for install, launch-preflight, and repair steps
- this feature's completion and fix-report artifacts so claimed route, mutated route, and proved route stay aligned

4. Planned Changes

- Extend the governed proof runner to capture durable cmd-trampoline install and scripted cmd launch-preflight logs on Windows hosts, with the same stale-artifact contract already enforced on the direct-bash bundle.
- Tighten the KPI proof validator so it requires proof-only partitions, required launcher route rows, and the expected repair-step coverage for the exercised install and launch-preflight routes.
- Add a small targeted validator regression test that proves missing repair-step coverage and mixed partitions fail closed.
- Update the cycle-03 fix report and completion summary to reference the widened cmd proof and the stricter KPI validation contract.
- New power introduced: none. The fix only hardens existing launcher proof and telemetry validation surfaces.

5. Closure Proof

- Prove `adf.cmd --runtime-preflight --json`, `adf.cmd --install`, and a scripted `adf.cmd --built -- --test-proof-mode` route inside the governed proof bundle, with durable logs saved under this feature's `proof-runs/` directory.
- Prove the direct-bash launcher routes still pass in the same governed bundle so the canonical bash route remains covered alongside the cmd trampoline front door.
- Prove KPI closure with a proof-partition telemetry query that now requires direct-bash and cmd launcher-route rows plus repair-step coverage for install and launch-preflight.
- Add a targeted automated test for the proof validator that fails on mixed proof/production partitions and fails on missing repair-step coverage.
- Negative proof required: the validator must reject a proof run if any row lands outside the `proof` partition or if any promised repair-step row is missing, and the cmd proof steps must fail if stale artifacts do not rebuild or if `command not found` reappears.
- Live/proof isolation checks: proof partitioning and proof-run identifiers must remain telemetry metadata only; the live launcher behavior must stay on the same `adf.sh` / `adf.cmd` routes.
- Targeted regression checks: `bash -n docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh`, `node --check tools/launcher-route-telemetry-proof.mjs`, `node --check tools/launcher-route-telemetry-proof.test.mjs`, `node tools/launcher-route-telemetry-proof.test.mjs`, and the refreshed governed proof bundle.

6. Non-Goals

- No Brain transport redesign.
- No launcher shell-contract redesign.
- No new launcher modes or alternate Windows entrypoints.
- No generic telemetry-platform rewrite or DB schema redesign.
- No unrelated COO conversation or workflow behavior changes.
