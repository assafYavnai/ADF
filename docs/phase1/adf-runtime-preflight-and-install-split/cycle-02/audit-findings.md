1. Findings
- Overall Verdict: REJECTED
- failure class: Explicit install/bootstrap and bounded launch repair do not truthfully repair stale builds.
- broken route invariant in one sentence: The `--install` and bounded auto-repair route are supposed to repair missing or stale COO and memory-engine artifacts, but the live shell path calls undefined build predicates and can report success after a shell error.
- exact route (A -> B -> C): `./adf.sh --install` or normal launch preflight -> `run_auto_repair_flow` -> `run_coo_repair_lane` / `run_memory_engine_repair_lane` -> install-state record + runtime-preflight pass.
- exact file/line references: [README.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md#L24), [context.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/context.md#L32), [architecture.md](/C:/ADF/docs/v0/architecture.md#L19), [adf.sh](/C:/ADF/adf.sh#L650), [adf.sh](/C:/ADF/adf.sh#L657), [adf.sh](/C:/ADF/adf.sh#L666), [adf.sh](/C:/ADF/adf.sh#L676), [adf.sh](/C:/ADF/adf.sh#L692), [03-install.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408/03-install.log#L1).
- concrete operational impact: Stale-but-existing COO or memory-engine builds can bypass rebuild, `install-state.json` can still be recorded, and normal launch can proceed on stale artifacts while the proof bundle still reports install success.
- KPI applicability: Applicable; this is a live technical-preflight/bootstrap truthfulness route under Phase 1.
- KPI closure state: Open.
- KPI proof or exception gap: The proof bundle shows a shell error on the install route and provides no negative proof that stale existing artifacts are rebuilt before install success is recorded.
- Compatibility verdict: Incompatible against the Vision/Phase 1/Master-Plan/Gap-Closure chain because it violates truthful technical preflight and truthful proof requirements in [PHASE1_MASTER_PLAN.md](/C:/ADF/docs/PHASE1_MASTER_PLAN.md#L21), [architecture.md](/C:/ADF/docs/v0/architecture.md#L19), [architecture.md](/C:/ADF/docs/v0/architecture.md#L45), and [README.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md#L68).
- sweep scope: Check both COO and memory-engine repair labels and repair lanes, plus every caller of `run_auto_repair_flow`, especially install and normal launch in [adf.sh](/C:/ADF/adf.sh#L685) and [adf.sh](/C:/ADF/adf.sh#L692).
- closure proof: Live bash evidence must show `./adf.sh --install` and bounded launch repair rebuilding deliberately stale-but-existing COO and memory-engine artifacts with no `command not found`, followed by a clean runtime-preflight; no DB proof is required.
- shared-surface expansion risk: none.
- negative proof required: Disprove the sibling misuse where stale existing artifacts in either lane skip rebuild while install still records success.
- live/proof isolation risk: present because the bundle already records a shell error yet still ends the step as PASS.
- claimed-route vs proved-route mismatch risk: present because the claimed route is “repair missing or stale dependency/build prerequisites,” while the proved route only shows a mostly healthy environment and still emits an undefined-command error.
- status: live defect.

- failure class: Governed closeout proof falsely marks the Windows trampoline runtime-preflight route as proved.
- broken route invariant in one sentence: Cycle closure required real Windows trampoline proof, but the bundle marks step `02-cmd-runtime-preflight` as PASS even though the log contains no runtime-preflight JSON or launcher output.
- exact route (A -> B -> C): `run-proof-sequence.sh` -> `step_cmd_runtime_preflight` -> `cmd.exe` -> `adf.cmd --runtime-preflight --json` -> proof summary used for route closeout.
- exact file/line references: [fix-plan.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-01/fix-plan.md#L51), [fix-report.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-01/fix-report.md#L52), [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh#L76), [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh#L119), [proof-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408/proof-summary.md#L10), [02-cmd-runtime-preflight.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408/02-cmd-runtime-preflight.log#L1), [02-cmd-runtime-preflight.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408/02-cmd-runtime-preflight.log#L4), [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs#L148).
- concrete operational impact: Review-cycle cannot close truthfully on this bundle, and future trampoline regressions can hide behind a false PASS because the proof route accepts exit status without validating that the claimed JSON proof exists.
- KPI applicability: Applicable; this is the closure-proof and technical-preflight evidence route for a supported launcher path.
- KPI closure state: Partial.
- KPI proof or exception gap: Bash-route proof exists, but the required Windows trampoline proof is absent and no exception was declared; the summary asserts PASS on non-proof.
- Compatibility verdict: Incompatible against the Vision/Phase 1/Master-Plan/Gap-Closure chain because the authority chain requires truthful route proof before closeout in [README.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md#L68), [architecture.md](/C:/ADF/docs/v0/architecture.md#L45), and [fix-plan.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-01/fix-plan.md#L51).
- sweep scope: Check `run_step`, `step_cmd_runtime_preflight`, proof-summary generation, and any sibling proof bundle steps that can pass without validating expected route artifacts.
- closure proof: A new governed bundle must show actual `adf.cmd --runtime-preflight --json` output in step 02 with `control_plane.kind=windows-cmd-trampoline`, and the proof runner must fail when the expected JSON is absent or unparsable; no DB proof is required.
- shared-surface expansion risk: none.
- negative proof required: Disprove the sibling misuse where an empty or banner-only cmd log can still be recorded as PASS.
- live/proof isolation risk: present because the proof surface currently diverges from the launcher surface and can certify a route it did not capture.
- claimed-route vs proved-route mismatch risk: present because the bundle claims the Windows trampoline route was run and proved, while the saved log shows only a cmd banner and prompt.
- status: live defect.

2. Conceptual Root Cause
- Missing repair-lane contract enforcement: the route froze stale-build detection in one set of helpers but did not enforce the same contract in the actual repair executors, so install/launch can declare success without truthfully rebuilding stale artifacts.
- Missing proof-artifact validity policy: the closure workflow treats process exit as sufficient evidence and does not validate that required route artifacts actually exist and match the claimed supported path before marking PASS.

3. High-Level View Of System Routes That Still Need Work
- Route: explicit install/bootstrap plus bounded launch auto-repair.
- what must be frozen before implementation: one authoritative stale-build contract for COO and memory-engine that is used identically by repair detection, repair execution, and pass/fail reporting.
- why endpoint-only fixes will fail: patching only the install wrapper or only the status label leaves the shared repair executor path broken for normal launch and the sibling memory-engine lane.
- the minimal layers that must change to close the route: [adf.sh](/C:/ADF/adf.sh#L647), [adf.sh](/C:/ADF/adf.sh#L661), [adf.sh](/C:/ADF/adf.sh#L671), [adf.sh](/C:/ADF/adf.sh#L692), plus targeted shell proof that exercises stale existing artifacts.
- explicit non-goals, so scope does not widen into general refactoring: no doctor redesign, no package-policy redesign, no launcher-mode expansion, no Brain transport changes.
- what done looks like operationally: stale-but-existing COO and memory-engine artifacts are rebuilt under `--install` and bounded launch repair, no shell errors appear, install state is recorded after successful repair, and runtime-preflight passes on the repaired state.

- Route: Windows trampoline proof and truthful governed closeout.
- what must be frozen before implementation: step 02 must be defined as “capture real `adf.cmd --runtime-preflight --json` output or fail,” with content validation rather than exit-code-only success.
- why endpoint-only fixes will fail: patching the summary text or rerunning the current script still allows false PASS outcomes because the proof runner itself accepts non-proof.
- the minimal layers that must change to close the route: [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh#L69), [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh#L111), [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh#L119), and the next governed proof bundle artifact under [proof-runs](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs).
- explicit non-goals, so scope does not widen into general refactoring: no shell-contract redesign, no doc-only closeout, no reopen of unrelated launcher behavior if `adf.cmd` itself remains sound.
- what done looks like operationally: the governed bundle contains real Windows trampoline JSON proof, the proof runner rejects empty or banner-only logs, and the closeout evidence exactly matches the routes the docs and fix plan claim are supported.

Final Verdict: REJECTED