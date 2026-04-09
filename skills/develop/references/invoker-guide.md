# Develop Invoker Guide

`develop` is the public governed front door for implementation work in ADF.
In Slice A it gives you the public shell, settings persistence, truthful status, and deterministic validation.

## Required Intake Artifacts

Prepare the target slice under `docs/phase<N>/<feature-slug>/`:

- `implement-plan-contract.md` with the required 10 headings
- `context.md` with the slice context and source references

Templates and validation rules live in:

- `skills/develop/references/artifact-templates.md`

## Public v1 Commands

- `develop help`
  Returns this guide plus any current lane-status summary.
- `develop settings [json]`
  Reads the current bounded model settings or persists a validated settings payload.
- `develop status <slice>`
  Reads truthful slice state from committed artifacts first, then closeout receipt, then merge truth, then live projections.
- `develop implement <slice>`
  Runs prerequisite validation and then returns the Slice B not-yet-available message.
- `develop fix <slice>`
  Runs prerequisite validation and then returns the Slice C not-yet-available message.

## Settings Surface

Settings are bounded to model and effort selection plus the review-cycle cap.
Governance behavior is not overridable.

Contract:

- `skills/develop/references/settings-contract.md`

## Status Truth Hierarchy

`develop status` consults sources in this order:

1. committed feature-local artifacts
2. `closeout-receipt.v1.json`
3. merge truth
4. lane projections under `.codex/develop/lanes/`

If projections disagree with committed truth, committed truth wins.

## Approval

Slice A does not bypass governed approval.
Human verification remains required where the slice contract says so.

## Not Public

- direct helper commands
- public reset or step-level mutation
- direct public merge or review controls
- direct completion mutation
