1. Findings
- Overall Verdict: APPROVED
- Both cycle-01 findings are closed with route-complete evidence, positive and negative proof, live/proof isolation, and deterministic KPI closure.

Finding area: Proof partition contamination of live CTO-admission artifact root
  - Status: closed
  - Evidence shown:
    - `COO/cto-admission/live-handoff.ts` lines 943-955: `validateProofArtifactIsolation` is called inside `persistAdmissionArtifacts` (line 511) before any filesystem write. When `partition === "proof"`, it checks `looksLikeAdfCheckoutRoot` against three repo-root markers (`AGENTS.md`, `COO/package.json`, `components/memory-engine/package.json`). If all markers are present, it returns a fail-closed error message and the entire persistence path short-circuits with no artifact writes.
    - `COO/cto-admission/live-handoff.ts` lines 957-961: `looksLikeAdfCheckoutRoot` uses `Promise.all` on `REPO_ROOT_MARKERS` with `pathExists`, returning true only when all three markers exist. This is the correct heuristic for both checkouts and worktrees.
    - The guard is placed at the `persistAdmissionArtifacts` seam, not at the CLI or a single endpoint. This means any caller that reaches the persistence contract (CLI bootstrap, live onion, or any future caller) is guarded at the route-level seam, not just one endpoint.
  - Positive proof in tests:
    - `live-handoff.test.ts` line 204: "proof handoff fails closed on a real ADF checkout root" creates a temp dir with all three repo-root markers, calls `handoffFinalizedRequirementToCtoAdmission` with `partition: "proof"`, and asserts:
      - `status === "admission_build_failed"` (line 224)
      - `outcome === "admitted"` (the packet was built, only persistence was blocked) (line 225)
      - `last_error` matches `/isolated temp project root/i` (line 226)
      - `artifact_paths.request_json === null` (line 227)
      - `kpi.admission_artifact_persist_failure_count === 1` (line 228)
      - receipt action is `enforce_proof_root_isolation` (line 229)
    - `onion-live.test.ts` line 239: "proof freeze approval fails closed on a repo-like project root" exercises the full route from onion live handler through the handoff seam with `telemetryPartition: "proof"` and a repo-like root, and asserts:
      - `cto_admission.status === "admission_build_failed"` (line 345)
      - `cto_admission.outcome === "admitted"` (line 346)
      - `cto_admission.last_error` matches `/isolated temp project root/i` (line 347)
      - persistence receipt with `kind === "cto_admission_artifact_persist"` and `success === false` (lines 349-351)
      - response matches `/CTO admission build failed/i` (line 353)
  - Negative proof:
    - `live-handoff.test.ts` line 230-233: explicitly asserts that `docs/phase1/coo-freeze-to-cto-admission-wiring/cto-admission-request.json` does NOT exist on disk after proof-mode handoff on a repo-like root.
    - `onion-live.test.ts` lines 354-357: same negative disk assertion on the live onion integration route.
  - Live/proof isolation shown:
    - Production handoffs (tests at lines 100, 155, 260, 291, 313, 335 of `live-handoff.test.ts`) use temp roots without repo markers and succeed with artifacts on disk.
    - Proof handoffs on repo-like roots fail closed. Proof handoffs on isolated temp roots (the KPI test at line 335, `partition: "proof"` at line 369) succeed because the root is not repo-like.
    - This proves the guard blocks proof-on-real-root while allowing both production persistence and proof-on-isolated-temp persistence.
  - KPI closure state: Closed. `admission_artifact_persist_failure_count` is incremented on proof-root rejection (line 228). All other KPIs continue to operate correctly per existing tests.
  - Claimed routes proved: the route `proof-mode -> live onion freeze -> CTO admission handoff -> fail closed on real root` is proved at both the handoff unit level and the onion integration level.

Finding area: Feature-root identity derived from topic text instead of stable scope slug
  - Status: closed
  - Evidence shown:
    - `COO/cto-admission/live-handoff.ts` lines 891-919: `resolveFeatureSlug` first calls `resolveFeatureSlugFromScopePath`. If a scope path is present, the last path segment is extracted, validated, and returned as the slug. Topic slugification is only the fallback when no scope path exists.
    - `resolveFeatureSlugFromScopePath` (lines 902-919) splits the scope path on `/` or `\`, takes the last segment, validates it matches `[a-z0-9._-]+`, and returns it lowercased. If the last segment contains special characters, it falls through to `slugifyFeatureSlug` on that segment (not the topic).
    - The `featureSlug` is computed once at line 130 and used for both the artifact-path computation (line 134) and the builder input (line 148 via `buildLiveAdmissionInput` line 463). This ensures the request payload `feature_slug`, the persisted `artifact_paths.feature_root`, and the actual disk path all stay aligned to the same scope-derived value.
  - Positive proof in tests:
    - `live-handoff.test.ts` line 155: "handoff derives the feature root from scope path when the topic text differs" provides `scopePath: "assafyavnai/adf/coo-live-executive-status-wiring"` with a mismatched topic `"Live COO Executive Status Wiring"`. Asserts:
      - `feature_slug === "coo-live-executive-status-wiring"` (line 171)
      - `artifact_paths.feature_root === "docs/phase1/coo-live-executive-status-wiring"` (line 172)
      - `artifact_paths.request_json === "docs/phase1/coo-live-executive-status-wiring/cto-admission-request.json"` (lines 173-176)
      - The persisted request JSON `feature_slug === "coo-live-executive-status-wiring"` (line 179)
    - This directly proves that a scope-path-derived slug controls the feature root even when the topic text is different.
  - Negative proof:
    - The test at line 155 IS the negative proof: it proves the topic text "Live COO Executive Status Wiring" (which would slugify to "live-coo-executive-status-wiring") cannot redirect artifacts away from the scope-derived root "coo-live-executive-status-wiring".
  - Live/proof isolation: not applicable to this finding (as noted in cycle-01).
  - KPI closure state: Closed. The scope-derived slug flows through the entire route including KPI paths.
  - Claimed routes proved: the route `scope path -> scope-derived feature slug -> deterministic docs/phase1/<feature-slug>` is proved with a mismatch case.

2. Conceptual Root Cause
- Finding 1 (proof partition contamination of live CTO-admission artifact root): CLOSED.
  Evidence: `validateProofArtifactIsolation` guard in `persistAdmissionArtifacts` at `live-handoff.ts:511` catches proof-on-real-root at the route-level seam. Positive proof in `live-handoff.test.ts:204` and `onion-live.test.ts:239`. Negative disk proof at `live-handoff.test.ts:230` and `onion-live.test.ts:354`. Guard is route-complete because it sits inside the shared persistence function, not at a single endpoint. Fix landed in commit 597f32c, merged to main via c978b84.

- Finding 2 (feature-root identity derived from topic text instead of stable scope slug): CLOSED.
  Evidence: `resolveFeatureSlug` at `live-handoff.ts:891` prefers the last scope-path segment when present, with topic slugification only as fallback. Positive proof of scope/topic mismatch at `live-handoff.test.ts:155`. The single computation at line 130 feeds both the disk path and the request payload, ensuring alignment. Fix landed in commit 597f32c, merged to main via c978b84.

3. High-Level View Of System Routes That Still Need Work
- None. The fixes are tightly scoped to the two cycle-01 findings and do not introduce new route-level defects. All system routes are closed.
- Sibling sites checked:
  - The live onion caller at `onion-live.ts:820-827` passes `scopePath: input.scopePath` (from `input.thread.scopePath`) and `partition: input.config.telemetryPartition` correctly into the handoff. No sibling caller bypasses the scope-path or partition forwarding.
  - The controller thread serialization at `thread.ts:330-343` correctly surfaces CTO-admission status, decision, outcome, and artifact paths from the workflow state without re-deriving paths.
  - The `onion-live.ts` contracts at `contracts/onion-live.ts:54` use `CtoAdmissionThreadState` from `live-state.ts` for the `cto_admission` field, so the state model flows through the full route without schema divergence.
  - The `resetCtoAdmissionThreadState` function at `live-handoff.ts:87-120` preserves `feature_root` from the previous state but nulls artifact paths, which is correct for scope-reopen scenarios.
- Design decision documentation: `context.md` lines 38-39 explicitly document both contracts: "The deterministic CTO-admission feature root resolves from the live scope-path slug when a scope path exists" and "Proof partition persistence fails closed on repo-like ADF checkout or worktree roots."

Final Verdict: APPROVED
