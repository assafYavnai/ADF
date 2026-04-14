# Reset State

Status: active operational truth
Last updated: 2026-04-14

## Current stage

Stage 1 — reset control pack bootstrapped

## Current objective

Freeze the repo-resident reset truth so new agents/sessions stop drifting.

## Current approved direction

- use `adf-v2/reset/` as the active reset control pack
- rewrite top truth before destructive cleanup
- classify carry-over before archive/delete work
- keep legacy/v1 reference available until classification is frozen

## Current blocker

Top truth is not yet rewritten.
The reset pack exists, but `MISSION-STATEMENT.md`, `VISION.md`, and `PHASE1.md` are still scaffolds or pending refactor.

## Current next step

Decide whether to migrate the current top-truth files directly into the reset pack first, or refactor them before migration.

## Current non-goal

Do not start archive/delete/project-brain cleanup yet.

## Current operator note

Until `AGENTS.md` is patched, new sessions should manually enter through:
- `adf-v2/README.md`
- `adf-v2/reset/README.md`
