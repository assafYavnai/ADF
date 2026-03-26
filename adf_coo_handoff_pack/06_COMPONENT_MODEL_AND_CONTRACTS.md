# Component Model and Contracts

## Why this matters
One of the explicit architecture decisions was that new ADF building blocks must adhere to contracts and stop scattering their structure across the repo.

This file captures the agreed direction.

## Principle
Every major ADF component type must have:
- a clear root folder
- a clear contract
- a defined set of source files
- a defined set of build artifacts
- a defined set of runtime artifacts
- a defined test surface
- a defined audit/learning surface where relevant

## Preliminary component types
These are the known building blocks we explicitly discussed or strongly implied:

- controller
- roles
- tools
- councils / boards
- MCP services
- adapters
- schemas / contracts
- runtime state
- audit / learning artifacts

## Tool contract direction
From our discussion:
- tools should no longer be scattered arbitrarily
- each tool should live under a coherent tool-owned folder
- docs/spec/schemas/tests/examples/runtime artifacts should have a defined home
- tool families should be updated coherently

## Role contract direction
From our discussion:
- role packages should be created through a dedicated role tool
- role artifacts should use slug-prefixed names
- role docs and role contract JSON should remain aligned

## Controller contract direction
Still to be defined in detail, but must include at least:
- ingress contract
- turn state contract
- classifier output contract
- workflow selection contract
- closeout contract

## Expected outcome
This component-contract work should lead directly to the **new ADF folder structure** for migrated infrastructure.

That folder structure is a next-step architecture definition item, not yet frozen in this package.
