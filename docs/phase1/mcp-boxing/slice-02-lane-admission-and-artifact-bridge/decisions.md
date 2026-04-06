# Slice 02 Decisions Bridge

Status: active temporary bridge artifact  
Scope: `docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge`

## Purpose

This file carries the decisions from the current planning discussion into the implementation environment.

It is a temporary bridge artifact.
It is not the normal replacement for Brain.

## Decision D-201 — ADF-facing feature package path

Decision: the ADF-facing feature package path is:

- `<features_root>/<scope>/<feature-slug>/`

Status: accepted

Rules:

- `features_root` comes from setup
- `scope` is optional
- `scope` is one grouping segment only for now
- if no scope is used, the path may collapse to `<features_root>/<feature-slug>/`

## Decision D-202 — Minimum ADF input artifacts

Decision: the minimum required ADF input artifacts are:

- `contract.md`
- `context.md`

Status: accepted

Rules:

- `contract.md` is the frozen authoritative intake artifact
- `context.md` contains relevant Brain-derived context inline with source references
- `README.md` is optional
- `decisions.md` is not a normal intake artifact

## Decision D-203 — Brain rule

Decision: Brain connectivity on the ADF side is mandatory.

Status: accepted

Rules:

- no Brain means hard stop
- `decisions.md` is not a fallback for missing Brain
- `decisions.md` may exist only as a temporary bridge artifact while moving decisions from this environment to the implementation environment

## Decision D-204 — Preparation guidance delivery

Decision: MCP dev must expose a preflight / preparation API for ADF-facing agents.

Status: accepted

That API must provide a static guidance document that includes:

- required files
- links to templates
- at least one example feature package
- validation rules

Agents must read that guidance before preparing a feature package.

## Decision D-205 — ADF-side artifact commit rule

Decision: invoker owns the commit and push of ADF-side feature package artifacts.

Status: accepted

Rules:

- MCP dev verifies that ADF-side feature package artifacts are committed and pushed before lane admission
- MCP dev does not own those ADF-side commits

## Decision D-206 — Published summary output

Decision: MCP dev publishes back only machine-facing summary output to the ADF feature package.

Status: accepted

Required output for this slice:

- `implementation-summary.json`

## Decision D-207 — Artifact reference rule

Decision: ADF-visible summary outputs must carry stable references to private-lane truth.

Status: accepted

At minimum the summary should reference:

- `lane_id`
- `artifact_snapshot_id`
- `worktree_ref`
- `related_commit_shas`

## Decision D-208 — Commit ownership model

Decision: ADF-side contract artifacts are not governed commits.

Status: accepted

Rules:

- invoker commits the ADF-side feature package
- MCP dev verifies commit and push state before lane admission
- MCP dev team identities apply to private lane artifacts and later downstream work, not to the initial ADF-side feature package commit
