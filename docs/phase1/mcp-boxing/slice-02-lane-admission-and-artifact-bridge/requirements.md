# Slice 02 Requirements

Status: active slice requirements baseline  
Scope: `docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge`

## Purpose

This file records the high-level requirements that define Slice 02.

## Requirement S2-R-001 — ADF feature package contract surface

Status: active Slice 02 requirement

ADF and MCP dev must integrate through a defined feature package surface inside the repo.

The package path is:

- `<features_root>/<scope>/<feature-slug>/`

Rules:

- `features_root` comes from setup
- `scope` is optional
- `scope` is one grouping segment only in this slice
- invoker does not pass a free-form full feature path to MCP dev

## Requirement S2-R-002 — Minimum ADF intake artifacts

Status: active Slice 02 requirement

The minimum required ADF intake artifacts are:

- `contract.md`
- `context.md`

Rules:

- `contract.md` is the frozen intake contract
- `context.md` contains relevant Brain-derived context inline with source references
- `README.md` is optional
- `decisions.md` is not part of the normal intake contract

## Requirement S2-R-003 — Brain connectivity rule

Status: active Slice 02 requirement

Brain connectivity is mandatory on the ADF side.

Rules:

- no Brain means hard stop
- `decisions.md` is not a fallback for missing Brain
- `decisions.md` may be used only as a temporary bridge artifact from this environment to the implementation environment

## Requirement S2-R-004 — Preflight / preparation API

Status: active Slice 02 requirement

MCP dev must provide a preflight / preparation API for ADF-facing agents.

That API must expose a static guidance document that includes:

- required files
- template links
- at least one example feature package
- validation rules

Agents must read that guidance before preparing a feature package.

## Requirement S2-R-005 — Commit verification before lane admission

Status: active Slice 02 requirement

Invoker owns the commit and push of the ADF-side feature package.

MCP dev must verify that those artifacts are committed and pushed before lane admission.

## Requirement S2-R-006 — Private lane artifact separation

Status: active Slice 02 requirement

Deep operational artifacts must remain in the private MCP dev lane store, not in the main repo feature package.

The ADF feature package is the contract and review surface.
The private lane store is the execution and audit surface.

## Requirement S2-R-007 — Machine-facing summary bridge

Status: active Slice 02 requirement

MCP dev must publish back a machine-facing summary artifact to the ADF feature package.

Required output for this slice:

- `implementation-summary.json`

That summary must carry stable references back to private-lane truth.
