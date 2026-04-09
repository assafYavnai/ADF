Cycle 04 fix execution and proof.

Fix Objective
- Repair-triggered writes from invalid persisted `schema_version: 1` settings in `develop settings` now route through the same bounded mutation path as explicit writes and always append truthful history with source `develop settings`.

Plan Status
- Replaced write-on-read repair behavior with `updateSettingsDocument(...)` in `skills/develop/scripts/develop-helper.mjs`.
- `ensureSettings(...)` now returns both repaired settings and the original invalid persisted payload (`repair`) when validation fails but repair is possible.
- Both repair-only reads and payload updates now persist via the shared helper that writes settings and appends history together.
- Updated `skills/develop/references/settings-contract.md` to codify source attribution for repair-mutation history writes.

Verification Evidence
Executed in:
- `C:/ADF/.codex/implement-plan/worktrees/phase1/develop-shell-help-settings-status-governor`
- temporary backups and restoration of `.codex/develop/settings.json` and `.codex/develop/settings-history.json` around verification runs.

1) repair-only read history append
- Inputs:
  - settings persisted as invalid payload: `{"schema_version":1,"implementor_model":5,"rogue":"bad"}`
  - history preloaded as `[]`
- Invocation:
  - `node skills/develop/scripts/develop-helper.mjs settings`
- Evidence:
  - history count `0->1` (delta `1`)
  - `status=ok`
  - history source `develop settings`
  - previous_value `implementor_model` was `5` and contained `rogue`
  - new_value model repaired to `gpt-5.3-codex-spark`

2) invalid persisted state plus payload update history truth
- Inputs:
  - settings persisted as invalid payload: `{"schema_version":1,"implementor_model":5,"rogue":"bad"}`
  - history seeded with one prior baseline entry
- Invocation:
  - `node skills/develop/scripts/develop-helper.mjs settings '{"implementor_effort":"low","max_review_cycles":2}'`
- Evidence:
  - history count `1->2` (delta `1`)
  - `status=ok`
  - history source `develop settings`
  - previous_value model `5` with `rogue`
  - new_value included `implementor_effort=low`, `max_review_cycles=2`

3) valid no-op read leaves history unchanged
- Inputs:
  - settings valid
  - history seeded with one entry
- Invocation:
  - `node skills/develop/scripts/develop-helper.mjs settings`
- Evidence:
  - history count `1->1` (delta `0`)
  - `status=ok`

4) develop status truth-only unaffected
- Invocation:
  - `node skills/develop/scripts/develop-helper.mjs status --phase-number 1 --feature-slug develop-shell-help-settings-status-governor`
- Evidence:
  - `current_stage=implementation_running`
  - `current_status=active`
  - `next_expected_transition=machine_verification`
  - did not depend on settings-route history behavior

Integrity Check
- `node --check skills/develop/scripts/develop-helper.mjs` passed.

Resolution
- `cycle-04/fix-report.md` written after proof.
