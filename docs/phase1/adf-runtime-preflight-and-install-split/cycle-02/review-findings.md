1. Closure Verdicts

Overall Verdict: REJECTED

- Runtime-preflight control-plane or execution-shell truth: Partial
enforced route invariant: `--runtime-preflight --json` must truthfully expose workflow-shell versus control-plane truth on both claimed entry surfaces so agents can choose quoting and path behavior without guessing.
evidence shown: direct-bash proof includes `control_plane.kind=direct-bash` and `entrypoint=adf.sh` in [01-runtime-preflight.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408/01-runtime-preflight.log#L18) and [04-runtime-preflight-post-install.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408/04-runtime-preflight-post-install.log#L18); the bootstrap contract consumes those fields in [AGENTS.md](/C:/ADF/AGENTS.md#L8), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md#L35), and [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md#L37); unit coverage asserts both direct-bash and Windows-trampoline values in [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs#L75) and [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs#L182).
missing proof: the bundle claims Windows trampoline PASS in [proof-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408/proof-summary.md#L10), but [02-cmd-runtime-preflight.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408/02-cmd-runtime-preflight.log#L1) contains only the Windows banner and prompt, not JSON. The proof runner still routes `cmd.exe /c` through [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh#L119) without producing a durable `adf.cmd` proof artifact.
KPI applicability: Applicable.
KPI closure state: Open.
missing KPI proof or incomplete exception details: this slice adds new live startup routes and refactors a production path, so KPI proof is required by [kpi-instrumentation-requirement.md](/C:/ADF/docs/v0/kpi-instrumentation-requirement.md#L15); the bundle contains no route-level KPI evidence, no production-vs-proof partition evidence, no truthful CLI-entry KPI proof, and no temporary exception with owner, expiry, production status, and compensating control required by [kpi-instrumentation-requirement.md](/C:/ADF/docs/v0/kpi-instrumentation-requirement.md#L60), [kpi-instrumentation-requirement.md](/C:/ADF/docs/v0/kpi-instrumentation-requirement.md#L64), and [kpi-instrumentation-requirement.md](/C:/ADF/docs/v0/kpi-instrumentation-requirement.md#L107).
Compatibility verdict: Compatible.
Vision Compatibility: Compatible.
Phase 1 Compatibility: Compatible.
Master-Plan Compatibility: Compatible.
Current Gap-Closure Compatibility: Compatible.
Compatibility Evidence: [VISION.md](/C:/ADF/docs/VISION.md), [PHASE1_VISION.md](/C:/ADF/docs/PHASE1_VISION.md), [PHASE1_MASTER_PLAN.md](/C:/ADF/docs/PHASE1_MASTER_PLAN.md), [adf-phase1-current-gap-closure-plan.md](/C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md), [README.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md), and [context.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/context.md) all keep this slice inside Phase 1 startup truthfulness work rather than later-company breadth.
sibling sites still uncovered: the proof harness path in [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh#L115), [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh#L119), and [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh#L140), plus the missing durable `adf.cmd` JSON artifact.
whether broader shared power was introduced and whether that was justified: No broader shared power was introduced.
whether negative proof exists where required: Partial; negative proof exists only in unit tests at [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs#L182), not in the live proof bundle.
whether live-route vs proof-route isolation is shown: Partial; the direct-bash live route is shown, but the trampoline proof route is not actually shown.
claimed supported route / route mutated / route proved: claimed supported route is `./adf.sh --runtime-preflight --json` plus `adf.cmd --runtime-preflight --json`; route mutated spans [adf.sh](/C:/ADF/adf.sh), [adf.cmd](/C:/ADF/adf.cmd), [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs), [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs), [AGENTS.md](/C:/ADF/AGENTS.md), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md), [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md), and [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh); the proved route in the new bundle is direct-bash JSON only.
whether the patch is route-complete or endpoint-only: Not route-complete.

- Runtime-preflight Brain MCP availability or verification truth: Partial
enforced route invariant: `--runtime-preflight --json` must expose Brain route availability versus doctor-level verification truth without claiming full Brain health, on the supported entry surfaces agents are told to trust.
evidence shown: direct-bash proof includes `brain_mcp.availability_status=available` and `verification_status=doctor_required` in [01-runtime-preflight.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408/01-runtime-preflight.log#L111) and [04-runtime-preflight-post-install.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408/04-runtime-preflight-post-install.log#L111); docs require those fields in [AGENTS.md](/C:/ADF/AGENTS.md#L8), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md#L40), and [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md#L42); unit coverage asserts both available and blocked states in [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs#L81) and [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs#L219).
missing proof: the new bundle still does not preserve a Windows-trampoline JSON artifact and does not carry live blocked or unverified Brain-route proof on the claimed supported route.
KPI applicability: Applicable.
KPI closure state: Open.
missing KPI proof or incomplete exception details: the same KPI gap remains open for this live route; no telemetry proof or valid temporary exception exists.
Compatibility verdict: Compatible.
Vision Compatibility: Compatible.
Phase 1 Compatibility: Compatible.
Master-Plan Compatibility: Compatible.
Current Gap-Closure Compatibility: Compatible.
Compatibility Evidence: [VISION.md](/C:/ADF/docs/VISION.md), [PHASE1_VISION.md](/C:/ADF/docs/PHASE1_VISION.md), [PHASE1_MASTER_PLAN.md](/C:/ADF/docs/PHASE1_MASTER_PLAN.md), [adf-phase1-current-gap-closure-plan.md](/C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md), [README.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md), and [context.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/context.md) keep this work within the active startup-authority mission.
sibling sites still uncovered: the missing durable `adf.cmd` proof artifact and the absence of live blocked-state proof beyond unit fixtures.
whether broader shared power was introduced and whether that was justified: No broader shared power was introduced.
whether negative proof exists where required: Partial; blocked-state proof exists only in unit tests at [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs#L219), not in the live bundle.
whether live-route vs proof-route isolation is shown: Partial; doctor-versus-preflight separation is shown in direct-bash proof and docs, but not across the full claimed supported route.
claimed supported route / route mutated / route proved: claimed supported route is both launcher entrypoints into runtime-preflight; route mutated spans the helper, docs, tests, and proof runner; the proved route in the bundle is direct-bash only.
whether the patch is route-complete or endpoint-only: Not route-complete.

- Additional route defect exposed by the proof bundle: Explicit install/bootstrap truthfulness: Open
enforced route invariant: `--install` must be the explicit repair/bootstrap route and must complete truthfully without shell errors or hidden predicate breaks.
evidence shown: [03-install.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408/03-install.log#L1) records `coo_needs_build: command not found`, yet [03-install.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408/03-install.log#L7) still claims `ADF install/bootstrap OK`; the live script defines `needs_coo_build` at [adf.sh](/C:/ADF/adf.sh#L203) but calls the misspelled `coo_needs_build` at [adf.sh](/C:/ADF/adf.sh#L650) and [adf.sh](/C:/ADF/adf.sh#L666).
missing proof: there is no clean install-route artifact free of shell errors, and no proof that the stale COO build predicate executes truthfully after the typo is corrected.
KPI applicability: Applicable.
KPI closure state: Open.
missing KPI proof or incomplete exception details: no route-level KPI evidence or valid temporary exception exists for `--install`.
Compatibility verdict: Compatible.
Vision Compatibility: Compatible.
Phase 1 Compatibility: Compatible.
Master-Plan Compatibility: Compatible.
Current Gap-Closure Compatibility: Compatible.
Compatibility Evidence: [VISION.md](/C:/ADF/docs/VISION.md), [PHASE1_VISION.md](/C:/ADF/docs/PHASE1_VISION.md), [PHASE1_MASTER_PLAN.md](/C:/ADF/docs/PHASE1_MASTER_PLAN.md), [adf-phase1-current-gap-closure-plan.md](/C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md), [README.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md), and [context.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/context.md).
sibling sites still uncovered: the same typo remains at both [adf.sh](/C:/ADF/adf.sh#L650) and [adf.sh](/C:/ADF/adf.sh#L666).
whether broader shared power was introduced and whether that was justified: No broader shared power was introduced.
whether negative proof exists where required: No.
whether live-route vs proof-route isolation is shown: Yes; the defect is on the live `./adf.sh --install` route captured in the bundle itself.
claimed supported route / route mutated / route proved: claimed supported route is explicit install/bootstrap via the launcher; route mutated is [adf.sh](/C:/ADF/adf.sh); the proved route in the bundle is a live bash install run that still emits a shell error, and `adf.cmd --install` is not proved.
whether the patch is route-complete or endpoint-only: Not route-complete.

2. Remaining Root Cause

- The slice fixed most schema, doc, and unit-test gaps, but the closure contract is still only partially enforced at route level: the proof harness treats step success as proof even when the claimed Windows-trampoline JSON was not captured, the live install route still contains a duplicated undefined-function predicate, and KPI closure for the new startup routes is still absent. That leaves startup authority improved, but not truthfully closeable.

3. Next Minimal Fix Pass

- Windows trampoline runtime-preflight proof route.
what still breaks: the proof bundle claims `adf.cmd` coverage without preserving any `adf.cmd --runtime-preflight --json` output.
what minimal additional layers must change: [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh) and only the minimal wrapper or path-construction needed to make `cmd.exe` execute the generated `.cmd` file truthfully.
what proof is still required: a durable [02-cmd-runtime-preflight.log](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408/02-cmd-runtime-preflight.log) containing JSON that proves `control_plane.kind=windows-cmd-trampoline`, `entrypoint=adf.cmd`, and `brain_mcp.*`.

- Explicit install/bootstrap route.
what still breaks: `--install` emits `coo_needs_build: command not found` and the same typo remains in the live build predicate.
what minimal additional layers must change: [adf.sh](/C:/ADF/adf.sh) only, fixing both typo sites.
what proof is still required: a clean `03-install` proof log with no shell errors and a matching post-install runtime-preflight artifact.

- KPI closure for startup routes.
what still breaks: the feature still lacks the required KPI proof, or a valid temporary exception, for `--runtime-preflight`, `--install`, and the normal launch preflight refactor.
what minimal additional layers must change: the minimal startup telemetry or closeout surfaces that own launcher-route KPI evidence, or a written temporary-exception artifact.
what proof is still required: real CLI-entry KPI evidence with production-versus-proof isolation, or a temporary exception that names owner, expiry, production status, and compensating control.

Final Verdict: REJECTED