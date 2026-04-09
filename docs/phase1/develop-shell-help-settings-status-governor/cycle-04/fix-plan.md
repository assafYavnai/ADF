1. Failure Classes

- `SETTINGS_PERSISTED_STATE_INGRESS_NOT_VALIDATED`

2. Route Contracts

- Failure class: `SETTINGS_PERSISTED_STATE_INGRESS_NOT_VALIDATED`
- claimed supported route: `invoker -> develop-helper settings -> persisted settings state -> bounded settings response/write`
- end-to-end invariant:
  - Repairs of invalid persisted `schema_version: 1` settings are write events, and each successful repair-mutation must append an entry to `.codex/develop/settings-history.json` with the pre-repair value, repaired/next value, and a governed source label.
  - The same invariant holds for `develop settings` reads and for payload writes that normalize an invalid base before applying a valid update.
- KPI Applicability: Required.
- KPI Route / Touched Path: `skills/develop/scripts/develop-helper.mjs` and `.codex/develop/settings{.json,-history.json}`.
- KPI Raw-Truth Source: live `develop settings` / `develop status` route outputs plus persisted settings/history files.
- KPI Coverage / Proof:
  - repair-only read must append history
  - invalid persisted state plus payload update must append truthful history
  - valid no-op read leaves history unchanged
  - develop status truth remains unchanged
- KPI Production / Proof Partition: live production worktree route invocation.
- Vision / Phase 1 / Master-Plan Compatibility: Compatible.
- Scope: bounded to `develop settings` ingress and history mutation behavior.

3. Planned Changes

- In `skills/develop/scripts/develop-helper.mjs`, remove write-through repair from the read-only ingress path.
- Replace it with a bounded persisted mutation helper that accepts:
  - `previous_value`
  - `next_value`
  - `source`
  and performs:
  - `settings.json` write
  - `.codex/develop/settings-history.json` append
- `ensureSettings()` should return invalid persisted content when repair is needed.
- `handleSettings()` should route all successful state mutations (repair-only and payload writes) through the new mutation helper so history is never bypassed.
- Keep `handleStatus()` unchanged.
- Update `skills/develop/references/settings-contract.md` to state that invalid persisted repair writes emit history entries with source label.

4. Closure Proof (Execution Plan)

- `node --check skills/develop/scripts/develop-helper.mjs`
- repair-only read proof:
  - seed `.codex/develop/settings.json` with invalid `schema_version: 1` payload
  - run `develop settings` read
  - assert `settings.json` is repaired and history length increases by 1
- invalid persisted + payload update proof:
  - seed invalid `settings.json`
  - run `develop settings '<payload>'`
  - assert persisted state is repaired and updated, history captures pre-repair prior and post-write next values
- valid no-op read proof:
  - seed valid `settings.json`
  - capture history length
  - run `develop settings` read
  - assert history length unchanged
- status isolation proof:
  - run `develop status --phase-number 1 --feature-slug develop-shell-help-settings-status-governor`
  - assert route truth still derived from committed-state sources (completed/active/etc. per current state)
