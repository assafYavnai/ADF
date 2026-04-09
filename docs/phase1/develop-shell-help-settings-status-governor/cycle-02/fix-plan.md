1. Failure Classes To Close

- `STATUS_TRUTH_HIERARCHY_OMITS_SUMMARY_ONLY_COMMITTED_TRUTH`
- `SETTINGS_SCHEMA_VALIDATION_ACCEPTS_CONTRACT_INVALID_TYPES`
- `SETUP_HELPER_CAPABILITY_DETECTION_DRIFTS_FROM_AUTHORITY`
- `STATUS_HUMAN_VERIFICATION_TRUTH_MISMATCH` (derivative of previous status-invariant failures)

2. Route Contract Freeze

- Failure class: `STATUS_TRUTH_HIERARCHY_OMITS_SUMMARY_ONLY_COMMITTED_TRUTH`
- claimed supported route: `invoker -> develop-helper status -> feature-local artifacts -> truthful status output`
- end-to-end invariant: `completion-summary.md` must be accepted as authoritative committed truth in slices with no state/receipt, before projection fallback.
- KPI Applicability: Required.
- KPI Route / Touched Path: `develop status` -> `skills/develop/scripts/develop-helper.mjs` and `docs/phase1/<slug>/completion-summary.md`.
- KPI Raw-Truth Source: `implement-plan-contract.md`, `workflow-contract.md`, `implement-plan-state.json`, `closeout-receipt.v1.json`, committed `completion-summary.md`.
- KPI Coverage / Proof: V-18 status branch proof for summary-only truth, state truth, receipt truth, projection-only fallback, and no_known_state.
- KPI Production / Proof Partition: live worktree feature `docs/phase1` route + isolated temporary fixture proof roots.
- KPI Non-Applicability Rationale: not applicable; KPI required.
- KPI Exception Owner / Expiry / Production Status / Compensating Control: None.
- Vision Compatibility: Compatible.
- Phase 1 Compatibility: Compatible.
- Master-Plan Compatibility: Compatible.
- Current Gap-Closure Compatibility: Compatible.
- Later-Company Check: no.
- Compatibility Decision: Compatible.
- Compatibility Evidence: contract lines in `implement-plan-contract.md` and current Slice A status proof plan.
- allowed mutation surfaces: `skills/develop/scripts/develop-helper.mjs`
- forbidden shared-surface expansion: no new shared state channels.
- docs that must be updated: `skills/develop/references/workflow-contract.md` if status truth phrasing needs to be made explicit.

- Failure class: `SETTINGS_SCHEMA_VALIDATION_ACCEPTS_CONTRACT_INVALID_TYPES`
- claimed supported route: `invoker -> develop-helper settings -> .codex/develop/settings.json -> persisted settings history`
- end-to-end invariant: settings payloads must reject invalid types for bounded model/effort strings and `max_review_cycles` integers.
- KPI Applicability: Required.
- KPI Route / Touched Path: `develop settings` -> `skills/develop/scripts/develop-helper.mjs` -> `.codex/develop/settings.json` / `.codex/develop/settings-history.json`.
- KPI Raw-Truth Source: `settings-contract.md`, `implement-plan-contract.md`, route output, written settings files.
- KPI Coverage / Proof: V-05 V-06 plus explicit invalid-type and post-rejection state stability checks.
- KPI Production / Proof Partition: live worktree settings writes + isolated fixture writes.
- KPI Non-Applicability Rationale: not applicable; KPI required.
- KPI Exception Owner / Expiry / Production Status / Compensating Control: None.
- Vision Compatibility: Compatible.
- Phase 1 Compatibility: Compatible.
- Master-Plan Compatibility: Compatible.
- Current Gap-Closure Compatibility: Compatible.
- Later-Company Check: no.
- Compatibility Decision: Compatible.
- Compatibility Evidence: strict schema rejection path in settings command and persisted history semantics.
- allowed mutation surfaces: `skills/develop/scripts/develop-helper.mjs`
- forbidden shared-surface expansion: no relaxation of validation semantics.
- docs that must be updated: none if existing contract already states field types.

- Failure class: `SETUP_HELPER_CAPABILITY_DETECTION_DRIFTS_FROM_AUTHORITY`
- claimed supported route: `invoker -> develop-setup-helper write-setup -> .codex/develop/setup.json -> downstream defaults`
- end-to-end invariant: setup helper must mirror the established setup-helper pattern and match runtime-preflight authority for tool availability and access/runtime fields.
- KPI Applicability: Required.
- KPI Route / Touched Path: `develop-setup-helper.mjs write-setup` and `.codex/develop/setup.json`.
- KPI Raw-Truth Source: `adf.cmd --runtime-preflight --json`, `skills/implement-plan/scripts/implement-plan-setup-helper.mjs`, `.codex/develop/setup.json`.
- KPI Coverage / Proof: setup-write syntax and schema checks plus direct parity check of preflight vs setup tool availability and access/runtime fields.
- KPI Production / Proof Partition: live setup writes in the worktree and fixture-host parity check.
- KPI Non-Applicability Rationale: not applicable; KPI required.
- KPI Exception Owner / Expiry / Production Status / Compensating Control: None.
- Vision Compatibility: Compatible.
- Phase 1 Compatibility: Compatible.
- Master-Plan Compatibility: Compatible.
- Current Gap-Closure Compatibility: Compatible.
- Later-Company Check: no.
- Compatibility Decision: Compatible.
- Compatibility Evidence: parity against implement-plan setup-helper implementation and live preflight output.
- allowed mutation surfaces: `skills/develop/scripts/develop-setup-helper.mjs`
- forbidden shared-surface expansion: no helper fields beyond established Slice A setup contract.
- docs that must be updated: none if existing references already describe required setup fields.

- Failure class: `STATUS_HUMAN_VERIFICATION_TRUTH_MISMATCH`
- claimed supported route: `invoker -> develop-helper status -> implement-plan state human verification channel -> returned summary`
- end-to-end invariant: human input requirement and next transition must reflect actual ADF status states (`pending`, `approved`, `rejected`, `stale`, `not_required`).
- KPI Applicability: Required.
- KPI Route / Touched Path: `develop status` -> `skills/develop/scripts/develop-helper.mjs` and implement-plan state fields (`active_run_status`, `human_verification_status`).
- KPI Raw-Truth Source: `implement-plan-helper.mjs`, `implement-plan-state.json`, status output.
- KPI Coverage / Proof: explicit fixture proof for each terminal human-verification state family, including `pending`.
- KPI Production / Proof Partition: live helper behavior and fixture-based targeted checks.
- KPI Non-Applicability Rationale: not applicable; KPI required.
- KPI Exception Owner / Expiry / Production Status / Compensating Control: None.
- Vision Compatibility: Compatible.
- Phase 1 Compatibility: Compatible.
- Master-Plan Compatibility: Compatible.
- Current Gap-Closure Compatibility: Compatible.
- Later-Company Check: no.
- Compatibility Decision: Compatible.
- Compatibility Evidence: status payload branch mapping and next-transition logic tied to `humanInputRequired` truth model.
- allowed mutation surfaces: `skills/develop/scripts/develop-helper.mjs`
- forbidden shared-surface expansion: no extra status fields or transitions outside contract.
- docs that must be updated: none if workflow docs already define status transitions.

3. Sweep Scope

- Primary scope: `skills/develop/scripts/develop-helper.mjs` and `skills/develop/scripts/develop-setup-helper.mjs`.
- Sibling validation surfaces: sibling functions in `develop-helper.mjs` that touch settings defaults, status truth, and lane lookup.
- Sibling authority path: `skills/implement-plan/scripts/implement-plan-setup-helper.mjs` for pattern matching and `implement-plan-helper.mjs` for status model alignment.
- Proof scope: live worktree feature states under `docs/phase1`, temporary fixture feature directories, and current `.codex/develop/*` files.
- Negative scope: reject and verify malformed settings payload types, pending human-verification fixtures, and cross-phase projection collisions.

4. Closure Proof

- `node --check` on touched helper scripts.
- `node skills/develop/scripts/develop-helper.mjs status --project-root C:/ADF --phase-number 1 --feature-slug implementation-benchmark-wiring-gate` (summary-only closed slice expected truth).
- Positive status fixtures:
  - state file with `implement-plan-state.json`
  - receipt-only fixture
  - projection-only fixture in same phase
  - missing slice fixture for `no_known_state`
- Negative status fixtures:
  - same-slug projection from different phase must not be used.
- Settings fixture set:
  - valid string update accepted (`implementor_model`, `implementor_effort`, `auditor_model`, `auditor_effort`, `reviewer_model`, `reviewer_effort`, `max_review_cycles`)
  - invalid `implementor_model: 5`
  - invalid `implementor_effort: 5`
  - invalid `max_review_cycles: "5"` and `max_review_cycles: -1`
  - state stability check after rejection.
- Setup fixture set:
  - run `node skills/develop/scripts/develop-setup-helper.mjs write-setup --project-root C:/ADF`
  - run `adf.cmd --runtime-preflight --json`
  - compare `llm_tools` and runtime/access fields for parity.
- Route-provenance check:
  - claimed route (`develop status` and setup/settings) equals proof route used in above commands.

5. Regression Forecast / Shared-Surface Check

- Settings schema tightening may block legacy persisted invalid values; check no non-string model/effort fields are serialized to settings after patch.
- status summary changes may alter client expectations; capture updated truth fields only for documented states and keep transition mapping deterministic.
- setup helper parity changes may change previously written setup defaults; require lock/overwrite behavior consistent with existing helper.
- Shared setup/settings surfaces:
  - Who may set: only `develop settings` and `develop-setup-helper` paths.
  - Who must not set: raw callers bypassing schema checks or preflight authority.
  - Misuse vectors: direct mutation of `.codex/develop/setup.json` and `.codex/develop/settings.json` without matching route schema.
