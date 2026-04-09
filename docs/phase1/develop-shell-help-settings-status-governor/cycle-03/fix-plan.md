1. Failure Classes

- `SETTINGS_PERSISTED_STATE_INGRESS_NOT_VALIDATED`

2. Route Contracts

- Failure class: `SETTINGS_PERSISTED_STATE_INGRESS_NOT_VALIDATED`
- claimed supported route: `invoker -> develop-helper settings -> persisted settings state -> bounded settings response/write`
- end-to-end invariant: `develop settings` must not treat an existing invalid `schema_version: 1` settings file as authoritative bounded state; reads must repair invalid persisted state to defaults plus contract-valid fields, and writes must not preserve invalid sibling fields.
- KPI Applicability: Required.
- KPI Route / Touched Path: `skills/develop/scripts/develop-helper.mjs` settings read/write path and `.codex/develop/settings.json`.
- KPI Raw-Truth Source: `skills/develop/references/settings-contract.md`, `skills/develop/references/workflow-contract.md`, live `develop settings` output, and persisted settings/history files.
- KPI Coverage / Proof: existing invalid read, existing invalid plus partial valid update, existing invalid plus full valid replacement, and existing valid read/write stability.
- KPI Production / Proof Partition: production route is the live worktree `develop settings` path; proof uses temporary invalid persisted settings restored after the pass.
- KPI Non-Applicability Rationale: not applicable; KPI required.
- KPI Exception Owner / Expiry / Production Status / Compensating Control: None.
- Vision Compatibility: Compatible.
- Phase 1 Compatibility: Compatible.
- Master-Plan Compatibility: Compatible.
- Current Gap-Closure Compatibility: Compatible.
- Later-Company Check: no.
- Compatibility Decision: Compatible.
- Compatibility Evidence: the only remaining live defect is persisted-settings ingress on the bounded Slice A settings surface; fixing it keeps the route script-authoritative without widening scope.
- allowed mutation surfaces: `skills/develop/scripts/develop-helper.mjs`, `docs/phase1/develop-shell-help-settings-status-governor/cycle-03/fix-report.md`
- forbidden shared-surface expansion: no new config store, no silent new override path, no status/setup/helper redesign outside the settings ingress route.
- docs that must be updated: `docs/phase1/develop-shell-help-settings-status-governor/cycle-03/fix-report.md`

3. Sweep Scope

- `ensureSettings()` existing-settings fast path in `skills/develop/scripts/develop-helper.mjs`
- `handleSettings()` merge/write path in `skills/develop/scripts/develop-helper.mjs`
- `validateSettingsPayload()` and any new persisted-document validator used by reads and merged writes
- `.codex/develop/settings.json` and `.codex/develop/settings-history.json` behavior as observed through the live helper route

4. Planned Changes

- Add a persisted-settings normalizer that retains only contract-valid fields and defaults missing/bad values from setup defaults.
- Change the settings read path to repair invalid existing `schema_version: 1` persisted settings before returning them, instead of returning raw values as authoritative.
- Change the settings write path so partial updates apply to repaired state, so invalid existing siblings cannot survive a successful write.

5. Closure Proof

- `node --check skills/develop/scripts/develop-helper.mjs`
- live `develop settings` read against a temporary invalid persisted settings file must repair and return `status: "ok"` with invalid fields removed.
- live `develop settings` partial valid update against invalid persisted settings must keep invalid sibling fields from persisting.
- live `develop settings` full valid replacement against invalid persisted settings must succeed and produce a bounded settings document
- live `develop settings` valid read/write stability against a valid persisted document must remain intact
- negative proof: invalid persisted fields must not survive a successful write path
- live/proof isolation: restore the original settings/history files after the verification pass so the proof does not leave synthetic state behind

6. Non-Goals

- No new settings schema fields
- No setup-helper or status-route changes in this cycle
- No Slice B/C orchestration work
- No merge-queue, review-cycle engine, or Brain-route changes
