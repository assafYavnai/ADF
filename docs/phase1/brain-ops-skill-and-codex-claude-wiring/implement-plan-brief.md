# Implementor Brief

Implement the new `brain-ops` skill and the minimal ADF bootstrap/install wiring that makes it the canonical operational path for Brain work when Codex or Claude agents are working inside ADF.

## Exact Scope

- add `skills/brain-ops/`
- register it in `skills/manifest.json`
- update `docs/bootstrap/cli-agent.md` so Brain operations point to the skill instead of requiring rediscovery
- refresh generated Codex and Claude installs through `manage-skills`

## Required Behavior

- the skill must keep assistant-side `project-brain` MCP as the preferred path when actually exposed
- the skill must expose the supported repo fallback path through the built Brain client route
- the helper must support real Brain operations that contextless agents need: connect, search/read, capture, and trust management
- the skill must not rely on raw DB access or a new unsupported integration

## Non-Goals

- do not redesign Brain
- do not add a new standalone guide doc
- do not edit installed user skill copies by hand
- do not widen into COO product behavior

## Minimum Proof

- `node --check` on the helper
- Brain connect smoke
- helper read/search smoke
- one controlled proof write plus verification read/search and truthful trust management or cleanup
- `manage-skills install/check` for Codex and Claude
