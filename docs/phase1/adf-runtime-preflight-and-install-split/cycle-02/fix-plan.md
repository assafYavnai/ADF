1. Failure Classes

- Install/bootstrap and bounded launch repair call stale-build predicates by the wrong names, so live repair can report success after a shell error instead of truthfully rebuilding stale existing artifacts.
- The governed proof runner can still certify the Windows trampoline route without durable `adf.cmd --runtime-preflight --json` proof because step 02 accepts process exit without validating the expected JSON artifact.
- The launcher routes added and refactored by this slice still lack explicit KPI instrumentation and proof for `--runtime-preflight`, `--install`, and normal launch preflight, so closeout remains open under the locked KPI governance rule.

2. Route Contracts

- Failure class: Install/bootstrap and bounded launch repair call stale-build predicates by the wrong names, so live repair can report success after a shell error instead of truthfully rebuilding stale existing artifacts.
  - claimed supported route: `./adf.sh --install` and normal `./adf.sh` startup -> `run_auto_repair_flow` -> `run_memory_engine_repair_lane` / `run_coo_repair_lane` -> install-state recording -> runtime-preflight or launch preflight passes on repaired artifacts
  - end-to-end invariant: stale-or-missing memory-engine and COO artifacts must trigger the real repair lanes, must not emit undefined-command shell errors, and must not record install success before the bounded repair work actually succeeds.
  - KPI Applicability: required
  - KPI Route / Touched Path: launcher runtime routes in `adf.sh` for explicit `--install`, explicit `--runtime-preflight`, bounded normal launch preflight, and the bounded repair substeps they own
  - KPI Raw-Truth Source: raw launcher-route telemetry rows under the real launcher entrypoints plus proof-bundle logs captured through those same entrypoints
  - KPI Coverage / Proof: proof-partition telemetry for runtime-preflight, install, launch preflight, and repair substeps, plus live proof logs that deliberately make existing artifacts stale and show the correct build lanes run without shell errors
  - KPI Production / Proof Partition: production launcher runs default to `telemetry_partition=production`; governed proof runs must set `telemetry_partition=proof` and preserve a distinct proof-run identifier so proof never silently counts as production truth
  - KPI Non-Applicability Rationale: Not applicable because this slice changes live launcher routes and their runtime behavior
  - KPI Exception Owner: Not applicable.
  - KPI Exception Expiry: Not applicable.
  - KPI Exception Production Status: Not applicable.
  - KPI Compensating Control: Not applicable.
  - Vision Compatibility: Compatible. The fix tightens truthful startup authority instead of widening into later-company workflow autonomy.
  - Phase 1 Compatibility: Compatible. This is bounded launcher/bootstrap truthfulness work inside the active Phase 1 scope.
  - Master-Plan Compatibility: Compatible. The fix preserves explicit runtime preflight, explicit install/bootstrap repair, and bounded fail-closed startup behavior.
  - Current Gap-Closure Compatibility: Compatible. It closes the active startup-truth and governed-closeout gap in the ADF Phase 1 launcher slice.
  - Later-Company Check: no
  - Compatibility Decision: compatible
  - Compatibility Evidence: the feature README, context, bootstrap docs, and architecture authority all define this slice as Phase 1 startup truth work on the real launcher routes rather than a later-company expansion.
  - allowed mutation surfaces: `adf.sh`, `docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh`, new bounded telemetry helpers under `tools/`, and this feature's proof/report artifacts plus directly affected authoritative docs
  - forbidden shared-surface expansion: no Brain transport redesign, no launcher-mode redesign, no package-policy redesign, no generic telemetry-platform rewrite, and no unrelated COO behavior work
  - docs that must be updated: `docs/phase1/adf-runtime-preflight-and-install-split/cycle-02/fix-plan.md`, `docs/phase1/adf-runtime-preflight-and-install-split/cycle-02/fix-report.md`, `docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-contract.md`, `docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md`, and refreshed proof artifacts under `proof-runs/`

- Failure class: The governed proof runner can still certify the Windows trampoline route without durable `adf.cmd --runtime-preflight --json` proof because step 02 accepts process exit without validating the expected JSON artifact.
  - claimed supported route: `run-proof-sequence.sh` -> step 02 Windows trampoline entry -> `adf.cmd --runtime-preflight --json` -> durable log + summary + KPI proof used for review-cycle closeout
  - end-to-end invariant: step 02 must fail closed unless the saved log contains parseable runtime-preflight JSON whose control-plane truth matches `windows-cmd-trampoline` / `adf.cmd`, and the proof bundle must keep the real launcher output rather than banner-only noise.
  - KPI Applicability: required
  - KPI Route / Touched Path: governed launcher proof route for the same live launcher entrypoints
  - KPI Raw-Truth Source: proof-partition launcher telemetry rows keyed to the proof run plus the saved Windows trampoline log
  - KPI Coverage / Proof: step 02 must capture and validate actual JSON, and the proof bundle must include a KPI evidence log showing proof-partition route rows for the bash route, the cmd trampoline route, install, launch preflight, and repair substeps
  - KPI Production / Proof Partition: proof bundle telemetry must stay on the proof partition and must be queryable independently of production launcher telemetry
  - KPI Non-Applicability Rationale: Not applicable because this is the proof route that closes a live claimed launcher path
  - KPI Exception Owner: Not applicable.
  - KPI Exception Expiry: Not applicable.
  - KPI Exception Production Status: Not applicable.
  - KPI Compensating Control: Not applicable.
  - Vision Compatibility: Compatible. The fix tightens truthful proof instead of claiming routes that were not actually exercised.
  - Phase 1 Compatibility: Compatible. This is bounded closeout-proof hardening for the active launcher feature stream.
  - Master-Plan Compatibility: Compatible. It enforces claimed-route versus proved-route truth on the real supported launcher surfaces.
  - Current Gap-Closure Compatibility: Compatible. It closes the review-cycle proof gap that left the stream stuck at governed closeout.
  - Later-Company Check: no
  - Compatibility Decision: compatible
  - Compatibility Evidence: the review artifacts and completion summary already depend on this proof runner as the closure route, so step 02 cannot stay exit-code-only without violating the authority chain.
  - allowed mutation surfaces: `docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh`, new bounded proof or telemetry helpers under `tools/`, and the feature proof or report artifacts that consume the new evidence
  - forbidden shared-surface expansion: no new launcher shell contract, no alternate proof harness that bypasses `adf.cmd`, and no doc-only closeout claim
  - docs that must be updated: `docs/phase1/adf-runtime-preflight-and-install-split/cycle-02/fix-plan.md`, `docs/phase1/adf-runtime-preflight-and-install-split/cycle-02/fix-report.md`, `docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md`, and refreshed proof artifacts under `proof-runs/`

3. Sweep Scope

- `coo_repair_label`, `memory_engine_repair_label`, `run_coo_repair_lane`, `run_memory_engine_repair_lane`, `run_auto_repair_flow`, `run_install_route`, and `run_launch_preflight` in `adf.sh`
- launcher telemetry ownership surfaces touched by the real launcher routes, including the memory-engine telemetry insert path and proof-partition handling
- `run-proof-sequence.sh` helpers for runtime-preflight capture, cmd trampoline execution, deliberate stale-artifact setup, scripted normal launch proof, and proof-summary generation
- authoritative feature artifacts that still describe the launcher slice, especially `implement-plan-contract.md` and `completion-summary.md`

4. Planned Changes

- Replace the bad stale-build predicate calls in the bounded repair labels and executors with the canonical helper names already defined in `adf.sh`.
- Add one bounded launcher-route telemetry helper that emits route and repair-step KPI rows for the launcher entrypoints, defaults production runs to `telemetry_partition=production`, and routes governed proof runs to `telemetry_partition=proof` with a durable proof-run identifier.
- Add one bounded proof-query helper plus proof-runner validation so the proof bundle fails closed unless it captures parseable cmd JSON and a proof-partition KPI evidence log for the launcher routes exercised in the bundle.
- Strengthen the proof runner so install and normal launch proof deliberately make existing artifacts stale before execution, then assert that the real build-repair lanes run and that the route completes without hidden shell errors.
- New power introduced: none. The fix uses existing telemetry and launcher surfaces, with no new generic controller, env-policy, or runtime mode.

5. Closure Proof

- Prove the explicit runtime-preflight route on the authoritative bash entrypoint and on the Windows cmd trampoline entrypoint, with both logs validated as parseable runtime-preflight JSON.
- Prove the explicit install route by first making existing COO and memory-engine artifacts stale, then showing `./adf.sh --install` rebuilds them, records install state, emits proof-partition launcher telemetry, and completes without `command not found`.
- Prove the bounded normal launch preflight route by making existing artifacts stale again, running a scripted `./adf.sh --built -- --test-proof-mode` session that exits immediately, and showing launcher preflight repairs the stale artifacts before launch succeeds.
- Prove KPI closure with a proof-partition telemetry query keyed to the proof-run identifier, showing the launcher route rows and the production-vs-proof partition truth for the exercised launcher source-path prefix.
- Negative proof required: the proof runner must reject banner-only or empty cmd logs, install or launch proof must not pass if `build artifacts` never runs after the artifacts were deliberately made stale, and proof telemetry must not land on the production partition for the proof run.
- Live/proof isolation checks: proof-only partitioning and proof-run identifiers may appear only in launcher telemetry metadata; they must not alter the actual launcher behavior, shell contract, or runtime-preflight JSON semantics.
- Targeted regression checks: `bash -n adf.sh`, `bash -n docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh`, `node --check tools/launcher-route-telemetry.mjs`, `node --check tools/launcher-route-telemetry-proof.mjs`, the governed proof sequence, and a targeted sweep for the stale predicate names in `adf.sh`

6. Non-Goals

- No Brain transport redesign.
- No new launcher modes.
- No package-manager redesign.
- No generic telemetry-platform rewrite outside the bounded launcher helper.
- No unrelated COO conversation or workflow behavior changes.
