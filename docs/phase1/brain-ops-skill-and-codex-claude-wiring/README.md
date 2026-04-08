# brain-ops-skill-and-codex-claude-wiring

## Implementation Objective

Create a production-grade repo-owned Brain operations skill under `skills/`, wire it into ADF CLI bootstrap for Codex and Claude, and refresh generated Codex and Claude installs so future ADF work can read, write, verify, and promote Brain entries without rediscovering the route.

## Why This Slice Exists Now

- Brain is real and operational in ADF, but the practical agent route is still too hard to discover quickly.
- Existing bootstrap docs over-emphasize the assistant-side `project-brain` MCP namespace and under-specify the already-supported repo path through the built Brain client and doctor scripts.
- Future MCP boxing work needs contextless agents to load and capture durable Brain context without repeating exploratory repo research.
- The repo already has a generated-install contract for skills. This slice should use that route instead of inventing a one-off doc-only fix.

## Requested Scope

- add one repo-owned Brain operations skill under `skills/`
- expose the supported Brain read/write/verify/promote route through that skill
- register the skill in the repo skill manifest
- wire the ADF CLI bootstrap to point Codex and Claude agents at the skill instead of forcing route rediscovery
- refresh generated skill installs for Codex and Claude through `manage-skills`
- keep the slice bounded to Brain operations, install wiring, and minimal bootstrap guidance

## Required Deliverables

- installable `brain-ops` skill package under `skills/brain-ops/`
- Brain helper entrypoint(s) that use the supported built Brain client route instead of raw DB access or ad-hoc imports
- skill guidance that tells agents when to prefer assistant MCP tools and when to use the repo fallback path
- bootstrap guidance that points ADF CLI agents to the skill for Brain operations
- manifest registration plus generated Codex and Claude install refresh/check proof
- durable proof that the skill can:
  - verify Brain connectivity
  - search/read Brain context
  - perform a controlled write
  - promote or manage trust truthfully

## Non-Goals

- no Brain server redesign
- no raw database access route
- no new standalone Brain guide doc outside the existing bootstrap surfaces
- no COO product-surface work
- no Gemini wiring unless the existing generated-install contract forces a minimal aligned change
- no edits to installed Codex or Claude skill copies by hand

## Artifact Map

- `README.md`
- `context.md`
- `requirements.md`
- `decisions.md`
- `implement-plan-contract.md`
- `implement-plan-brief.md`
- `implement-plan-state.json`
- `implement-plan-pushback.md`
- `implement-plan-execution-contract.v1.json`
- `implementation-run/`
- `completion-summary.md`

## Lifecycle

- active
- blocked
- completed
- closed
