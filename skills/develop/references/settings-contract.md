# Develop Settings Contract

Persist settings at `.codex/develop/settings.json`.

Schema:

- `schema_version`: integer, must be `1`
- `implementor_model`: string
- `implementor_effort`: string
- `auditor_model`: string
- `auditor_effort`: string
- `reviewer_model`: string
- `reviewer_effort`: string
- `max_review_cycles`: positive integer

Validation rules:

- unknown keys are rejected
- governance behavior is not overridable
- `schema_version` must be `1`
- `max_review_cycles` must be a positive integer
- existing persisted `schema_version: 1` settings are validated before return; invalid or partial persisted values are repaired to defaults plus contract-valid fields so invalid siblings are not preserved.

History:

- append each successful change to `.codex/develop/settings-history.json`
- each entry records timestamp, previous value, new value, and source
