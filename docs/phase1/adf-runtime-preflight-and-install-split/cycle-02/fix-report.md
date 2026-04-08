1. Failure Classes Closed

- The live launcher repair route now uses the canonical stale-build predicates, so explicit install and bounded launch preflight rebuild stale existing COO and memory-engine artifacts instead of masking a shell error behind a success claim.
- The governed Windows trampoline proof route now fails closed unless the saved `adf.cmd --runtime-preflight --json` log is real parseable JSON with the expected `control_plane.kind` and `control_plane.entrypoint`.
- Launcher-route KPI closure is now backed by bounded route telemetry plus a proof-partition query for explicit runtime-preflight, explicit install, bounded launch preflight, and their repair substeps.

2. Route Contracts Now Enforced

- The supported install route `./adf.sh --install -> run_auto_repair_flow -> repair lanes -> install-state write -> runtime-preflight verify` now rebuilds stale artifacts truthfully, records repair telemetry, and only reports success after post-repair runtime-preflight passes.
- The supported normal launch route `./adf.sh --built -- --test-proof-mode -> launch preflight -> bounded repair -> runtime-preflight gate -> COO session` is now proved with deliberately stale artifacts and rejects hidden shell failures.
- The supported Windows trampoline proof route `cmd.exe -> adf.cmd --runtime-preflight --json` now has artifact validation rather than exit-code-only success, and the bundle preserves the real JSON evidence.
- KPI closure for this launcher slice is now route-based rather than narrative-only: proof runs stay on the `proof` partition, production remains the default partition, and proof rows are queried by `proof_run_id` instead of silently counting as production truth.

3. Files Changed And Why

- [adf.sh](/C:/ADF/adf.sh): fixed the stale-build predicate names, added bounded launcher-route telemetry emission, and attached route/repair telemetry to runtime-preflight, install, and launch-preflight execution paths.
- [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh): hardened cmd-proof validation, forced stale-artifact proof for install and launch preflight, and added KPI proof capture keyed to a proof-run id.
- [launcher-route-telemetry.mjs](/C:/ADF/tools/launcher-route-telemetry.mjs): added the bounded launcher KPI emitter with production/proof partition handling and proof-run metadata.
- [launcher-route-telemetry-proof.mjs](/C:/ADF/tools/launcher-route-telemetry-proof.mjs): added the proof query that verifies route coverage, partition isolation, and cmd trampoline presence.
- [onion-live.ts](/C:/ADF/COO/requirements-gathering/live/onion-live.ts): removed a stray duplicate telemetry field so truthful stale-build proof could complete a real COO rebuild.
- [implement-plan-contract.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-contract.md) and [completion-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md): updated the authoritative feature contract and closeout summary to reflect the enforced KPI and proof route.

4. Sibling Sites Checked

- [adf.sh](/C:/ADF/adf.sh)
- [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh)
- [launcher-route-telemetry.mjs](/C:/ADF/tools/launcher-route-telemetry.mjs)
- [launcher-route-telemetry-proof.mjs](/C:/ADF/tools/launcher-route-telemetry-proof.mjs)
- [onion-live.ts](/C:/ADF/COO/requirements-gathering/live/onion-live.ts)
- [completion-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md)
- [implement-plan-contract.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-contract.md)

5. Proof Of Closure

- [proof-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/proof-summary.md) reports `PASS` for all governed proof steps, including the new scripted launch-preflight and KPI proof steps.
- [02-cmd-runtime-preflight.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/02-cmd-runtime-preflight.log) now contains valid runtime-preflight JSON proving `control_plane.kind=windows-cmd-trampoline` and `entrypoint=adf.cmd`.
- [03-install.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/03-install.log) proves stale existing artifacts were rebuilt, emitted no `command not found`, and completed with `ADF install/bootstrap OK`.
- [05-launch-preflight-scripted.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/05-launch-preflight-scripted.log) proves bounded normal launch repair rebuilt stale artifacts and ended cleanly with `ADF preflight OK` and `Session ended.`.
- [06-kpi-proof.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/06-kpi-proof.log) proves twelve launcher-route telemetry rows landed on the `proof` partition, covers `launcher_runtime_preflight`, `launcher_install`, `launcher_launch_preflight`, and `launcher_repair_step`, and confirms the cmd trampoline runtime-preflight row exists.
- Verification checks passed: `bash -n adf.sh`, `bash -n docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh`, `node --check tools/launcher-route-telemetry.mjs`, `node --check tools/launcher-route-telemetry-proof.mjs`, and `npm --prefix COO run build`.
- Claimed supported route / route mutated / route proved: aligned as `adf.sh runtime/install/launch routes plus adf.cmd runtime-preflight trampoline -> bounded repair telemetry -> proof-partition KPI query`.

6. Remaining Debt / Non-Goals

- Review-cycle is not closed by this implementation pass alone; the next cycle still needs a fresh auditor and reviewer pass against the updated proof bundle and doc truth.
- No new merge-to-main work is required for this feature stream; the original implementation commits are already on `main` and this cycle only reconciles governed closeout truth.
- Non-goals remain unchanged: no Brain transport redesign, no new launcher modes, and no generic telemetry-platform rewrite outside the bounded launcher helper.

7. Next Cycle Starting Point

- Start cycle 03 by rerunning the full auditor and reviewer pair against [proof-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/proof-summary.md), [06-kpi-proof.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/06-kpi-proof.log), and the updated feature contract docs.
- If both lanes approve, close the review stream with no further launcher edits; if either lane rejects, the remaining work should be limited to the specific route or proof gap it names.
