# Develop Workflow Contract

Use this file as the frozen internal route contract for Slice A.

## Command Routing

- `help` returns `invoker-guide.md` plus lane-status summary when present
- `settings` reads or writes `.codex/develop/settings.json`
- `status` resolves slice truth from committed artifacts first, then receipt, then merge truth, then projections
- `implement` validates prerequisites and returns the bounded Slice B unavailable message
- `fix` validates prerequisites and returns the bounded Slice C unavailable message

## Governor Contract

`develop-governor.mjs` owns these commands:

- `validate-prerequisites`
- `validate-integrity`
- `check-lane-conflict`

Each returns structured JSON with:

- `status`
- `findings`
- `blocker`

## Truth Hierarchy

`develop status` resolves fields in this priority order:

1. committed feature-local artifacts
2. `closeout-receipt.v1.json`
3. merge truth
4. lane projections

Committed truth wins over projections.

## Status Output Contract

At minimum include:

- slice identity
- current stage
- current status
- current blocker
- latest durable event
- latest review verdicts
- whether human input is required
- next expected transition
- `truth_sources`

Do not use fake progress percentages.

## Settings Handling

Reject unknown keys.
Persist validated settings atomically.
Append settings changes to `.codex/develop/settings-history.json`.
