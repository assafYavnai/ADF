1. Findings

Overall Verdict: REJECTED

- failure class: Windows cmd-trampoline install/launch support is still overclaimed relative to the proved route.
- broken route invariant in one sentence: If Windows non-bash agents are told to treat `recommended_commands.install` and `recommended_commands.launch` as authoritative, the same `adf.cmd` entry surfaces must be proved or the claim must be narrowed.
- exact route (A -> B -> C): Windows-native agent/control plane -> `adf.cmd --runtime-preflight --json` -> `recommended_commands.install` / `recommended_commands.launch` -> `adf.cmd --install` / `adf.cmd [flags] [-- <COO args>]` -> `adf.cmd` trampoline -> `adf.sh` install / launch-preflight.
- exact file/line references: [agent-runtime-preflight.mjs:191](/C:/ADF/tools/agent-runtime-preflight.mjs#L191), [agent-runtime-preflight.mjs:201](/C:/ADF/tools/agent-runtime-preflight.mjs#L201), [cli-agent.md:45](/C:/ADF/docs/bootstrap/cli-agent.md#L45), [cli-agent.md:71](/C:/ADF/docs/bootstrap/cli-agent.md#L71), [vscode-agent.md:47](/C:/ADF/docs/bootstrap/vscode-agent.md#L47), [vscode-agent.md:52](/C:/ADF/docs/bootstrap/vscode-agent.md#L52), [adf.cmd:32](/C:/ADF/adf.cmd#L32), [02-cmd-runtime-preflight.log:129](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/02-cmd-runtime-preflight.log#L129), [run-proof-sequence.sh:245](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh#L245), [run-proof-sequence.sh:269](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh#L269), [06-kpi-proof.log:185](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/06-kpi-proof.log#L185), [06-kpi-proof.log:275](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/06-kpi-proof.log#L275).
- concrete operational impact: Windows-native agents are currently directed toward `adf.cmd` install/launch entrypoints without route-level proof on those same entry surfaces, so cmd-specific quoting/trampoline regressions can slip past closeout.
- KPI applicability: Applicable.
- KPI closure state: Partial.
- KPI proof or exception gap: The proof bundle closes `adf.cmd` only for runtime-preflight; install and launch-preflight KPI rows are still `entrypoint=adf.sh` / `control_plane_kind=direct-bash`, and no temporary exception narrows the Windows cmd claim.
- Compatibility verdict: Incompatible against the Vision, Phase 1, Master-Plan, Gap-Closure authority chain because the live bootstrap/runtime contract now claims a broader Windows front door than the proof bundle closes, which conflicts with [README.md:45](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md#L45), [README.md:68](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md#L68), and [kpi-instrumentation-requirement.md:64](/C:/ADF/docs/v0/kpi-instrumentation-requirement.md#L64).
- sweep scope: `recommended_commands.*`, both bootstrap docs, the proof runner, feature closeout docs, and any other route that treats `adf.cmd` as a proved launcher front door rather than just a trampoline.
- closure proof: Either prove `adf.cmd --install` and `adf.cmd [flags] [-- <COO args>]` with durable logs plus KPI rows showing `control_plane_kind=windows-cmd-trampoline`, or narrow the live contract so only runtime-preflight is claimed on the cmd front door.
- shared-surface expansion risk: none.
- negative proof required: Disprove the sibling misuse where direct-bash install/launch proof is treated as proof of the cmd-trampoline install/launch front door.
- live/proof isolation risk: present because the live contract advertises cmd install/launch while the proof bundle exercises only direct-bash for those routes.
- claimed-route vs proved-route mismatch risk: present because the claimed Windows front door extends through install/launch, but the proved route stops at runtime-preflight for `adf.cmd`.
- status: live defect.

- failure class: The KPI proof validator still encodes only a happy-path subset of the promised closure contract.
- broken route invariant in one sentence: Step `06-kpi-proof` must fail closed unless the proof run shows only proof-partition telemetry and all promised launcher route/repair-step coverage, but the validator only checks for some proof rows, three top-level operations, and a cmd runtime-preflight row.
- exact route (A -> B -> C): `run-proof-sequence.sh` -> `step_kpi_proof` -> `launcher-route-telemetry-proof.mjs` -> proof summary / review-cycle closeout.
- exact file/line references: [launcher-route-telemetry-proof.mjs:10](/C:/ADF/tools/launcher-route-telemetry-proof.mjs#L10), [launcher-route-telemetry-proof.mjs:59](/C:/ADF/tools/launcher-route-telemetry-proof.mjs#L59), [launcher-route-telemetry-proof.mjs:60](/C:/ADF/tools/launcher-route-telemetry-proof.mjs#L60), [launcher-route-telemetry-proof.mjs:78](/C:/ADF/tools/launcher-route-telemetry-proof.mjs#L78), [cycle-02/fix-plan.md:13](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-02/fix-plan.md#L13), [cycle-02/fix-plan.md:39](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-02/fix-plan.md#L39), [cycle-02/fix-plan.md:67](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-02/fix-plan.md#L67), [cycle-02/fix-plan.md:77](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-02/fix-plan.md#L77), [cycle-02/fix-plan.md:78](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-02/fix-plan.md#L78), [kpi-instrumentation-requirement.md:59](/C:/ADF/docs/v0/kpi-instrumentation-requirement.md#L59), [kpi-instrumentation-requirement.md:95](/C:/ADF/docs/v0/kpi-instrumentation-requirement.md#L95), [06-kpi-proof.log:5](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/06-kpi-proof.log#L5), [06-kpi-proof.log:25](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/06-kpi-proof.log#L25).
- concrete operational impact: A future proof run can still PASS step 06 while missing required `launcher_repair_step` coverage or while mixing proof and production rows under the same proof run, which makes KPI closeout non-authoritative.
- KPI applicability: Applicable.
- KPI closure state: Partial.
- KPI proof or exception gap: The current April 8, 2026 proof run is clean, but the validator does not actually enforce the negative-proof contract for production/proof isolation or repair-step completeness.
- Compatibility verdict: Incompatible against the Vision, Phase 1, Master-Plan, Gap-Closure authority chain because the locked KPI rule requires fail-closed proof for partition isolation and real route coverage, not just a green happy-path query.
- sweep scope: Any proof-query helper, closeout script, or review artifact that validates route telemetry by presence-only checks instead of enforcing the full partition and operation contract.
- closure proof: `launcher-route-telemetry-proof.mjs` must reject any non-`proof` partition row for the proof run and reject missing `launcher_repair_step` coverage, plus a targeted regression test or controlled proof-harness run must show those cases fail.
- shared-surface expansion risk: present in the shared telemetry metadata contract around `telemetry_partition` and `proof_run_id`.
- negative proof required: Show that mixed partitions and missing repair-step rows both force a nonzero exit from step 06.
- live/proof isolation risk: present because the validator does not itself enforce the production/proof boundary it is claiming to certify.
- claimed-route vs proved-route mismatch risk: present because the closeout contract promises proof-partition truth and repair-substep coverage, while the live validator does not require either for success.
- status: live defect.

2. Conceptual Root Cause

- Missing single route-claim contract for Windows entry surfaces: the bootstrap docs, runtime-preflight recommendations, feature closeout docs, and proof runner do not freeze one authoritative answer to “which launcher routes are actually supported via `adf.cmd` versus only via direct bash,” so the live claim drifted wider than the proved route.
- Missing fail-closed KPI-proof validator contract: the slice added telemetry and a query helper, but it did not encode the full closure policy into the validator itself, so proof still depends on human interpretation of a happy-path log instead of machine-enforced partition and coverage invariants.

3. High-Level View Of System Routes That Still Need Work

- Route: Windows non-bash control plane -> launcher front door -> install / launch-preflight.
- what must be frozen before implementation: one authoritative Windows contract for install and launch, either “`adf.cmd` is supported and must be proved” or “only runtime-preflight is supported via `adf.cmd`; install/launch remain direct-bash routes.”
- why endpoint-only fixes will fail: changing only the docs, only `recommended_commands`, or only the proof runner leaves the other surfaces still claiming a different route.
- the minimal layers that must change to close the route: [tools/agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs), [docs/bootstrap/cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md), [docs/bootstrap/vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md), and either the proof runner plus proof bundle or the live route claim.
- explicit non-goals, so scope does not widen into general refactoring: no shell-contract redesign, no Brain transport work, no new launcher modes, no doctor-route redesign unless its claim is also widened.
- what done looks like operationally: runtime-preflight output, bootstrap docs, KPI rows, and proof logs all name the same Windows entry surface for install and launch, with no wider claim left unproved.

- Route: proof-partition KPI closeout for launcher routes.
- what must be frozen before implementation: the exact step-06 pass/fail contract for partition isolation, required operations, and repair-substep coverage.
- why endpoint-only fixes will fail: updating the proof summary text or relying on a clean one-off log does not make the validator fail closed on the next contaminated run.
- the minimal layers that must change to close the route: [tools/launcher-route-telemetry-proof.mjs](/C:/ADF/tools/launcher-route-telemetry-proof.mjs), the governed proof runner at [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh), and a targeted regression test for the validator contract.
- explicit non-goals, so scope does not widen into general refactoring: no telemetry-platform rewrite, no DB schema redesign, no unrelated COO telemetry work.
- what done looks like operationally: step 06 exits nonzero when any proof-run row lands outside the `proof` partition or when promised repair-step coverage is absent, and a fresh governed bundle still passes cleanly on the intended route.

Final Verdict: REJECTED