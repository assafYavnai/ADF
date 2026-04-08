# ADF Phase 1 MCP Boxing Step 2

Status: proposed baseline step  
Last updated: 2026-04-06  
Owner: COO  
Step name: lane admission, ADF contract surface, and implementation summary bridge

## Purpose

This step activates the first real intake and lane-admission behavior for `dev_team`.

It builds the contract surface between ADF and MCP dev so ADF can prepare a feature package, MCP dev can verify and freeze that package, admit a private implementation lane, and later publish a machine-facing implementation summary back to ADF without polluting the main repo with deep operational artifacts.

## Why This Step Comes Next

Step 1 establishes the boxed department shell and its first setup route.

Step 2 makes the department usable for real implementation admission while still keeping full downstream implementation execution out of scope.

The key move in this step is to separate:

- the ADF-facing feature package inside the repo
- the private MCP dev lane store outside the repo

## Step Goal

At the end of this step:

1. ADF has a canonical feature package surface under a configured `features_root`
2. MCP dev can admit a real lane from that feature package
3. the design team becomes the first active internal working team
4. MCP dev can verify that ADF-side input artifacts are committed and pushed before lane start
5. private lane artifacts stay outside the main repo
6. MCP dev can publish a machine-facing implementation summary back to the ADF feature package

## High-Level Contract Surface

### ADF-facing feature path

The ADF-facing feature package path is:

- `<features_root>/<scope>/<feature-slug>/`

Rules:

- `features_root` comes from MCP dev setup
- `scope` is optional
- if no scope is used, the feature path may collapse to `<features_root>/<feature-slug>/`
- `scope` is one grouping segment only in this step

### Private MCP dev lane store

Deep operational artifacts do not live in the main repo feature package.

They remain in the private MCP dev lane store under the configured `implementation_lanes_root`.

## Minimum ADF Input Package

The minimum required ADF input package is:

- `contract.md`
- `context.md`

Rules:

- `contract.md` is the frozen authoritative feature contract for MCP dev intake
- `context.md` contains relevant Brain-derived context inline, with source references
- Brain connectivity is mandatory on the ADF side; no Brain means hard stop
- `decisions.md` is not a normal intake artifact; it may exist only as a temporary bridge while preparing implementation context from this environment to the local machine
- `README.md` is optional and not required for lane admission

## Templates And Preparation Guidance

This step introduces a preflight/preparation API for ADF-facing agents.

That API should expose a static guidance document that includes:

- required files
- links to templates
- at least one good example feature package
- validation rules

Agents must read that guidance before preparing a feature package.

## Published Output Back To ADF

MCP dev publishes back to the ADF feature package only the governed machine-facing summary artifacts required for ADF review and approval.

In this step, the required output is:

- `implementation-summary.json`

## Commit Responsibility Rule

- invoker is responsible for committing and pushing ADF-side feature package artifacts
- MCP dev verifies that those artifacts are committed and pushed before lane admission
- MCP dev does not own those ADF-side commits

## What This Step Does Not Yet Require

This step does not yet require:

- full downstream development execution
- live review-cycle execution under the new lane model
- live merge execution under the new lane model
- full approval-gate implementation
- legacy skill retirement
- Brain boxing

## Deliverable Shape

This step should leave behind:

1. the ADF-facing feature package contract
2. the first lane-admission route for MCP dev
3. the private-lane artifact separation rule
4. the first governed implementation summary bridge back into ADF
5. enough structure to let the next slice wire real development execution into the admitted lane

## Practical Rule

This file defines the Step 2 baseline only.

The narrower implementation slice for this step is defined under:

- `docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge/`
