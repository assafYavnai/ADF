# slice-01-dev-team-bootstrap

## Implementation Objective

Stand up the boxed `dev_team` department skeleton for ADF Phase 1, establish `VPRND` as the governance layer and first callable department leader, create the MCP server foundation and build/package baseline, define the internal team placeholders, and implement the first department setup route so later slices can wire real design, development, review, and integration work through this boxed surface.

## Requested Scope

Focus on creating the first production-level department shell for `dev_team` and the first bounded API route for setup. Reuse the current governed implementation model as the long-term engine source, but do not yet migrate the full implementation, review, or merge route in this slice. Seed the team model, department-owned state model, commit identity policy, explicit invoker approval hold, and slice documentation needed to call `implement-plan` for this work cleanly.

## Non-Goals

Do not yet wire full end-to-end `implement` behavior. Do not yet remove legacy skills. Do not yet convert Brain to a boxed binary. Do not yet complete final CTO orchestration. Do not yet attempt full production routing of every downstream lane.

## Implementation Status

Slice 01 implementation is complete and pending governed review-cycle closeout. Invoker approval will be requested only after review, machine verification, and process-compliance verification are closed truthfully.

### Deliverables

| Deliverable | Location | Status |
|---|---|---|
| `dev_team` department shell (MCP server) | `components/dev-team/` | Implemented |
| `VPRND` governance-layer entry surface | `components/dev-team/src/server.ts` | Implemented |
| Setup route (`devteam_setup`) | `components/dev-team/src/tools/setup-tools.ts` | Implemented |
| Status route (`devteam_status`) | `components/dev-team/src/tools/status-tools.ts` | Implemented |
| Department state model | `components/dev-team/src/schemas/state.ts` | Implemented |
| Identity/audit policy | `components/dev-team/src/schemas/identity.ts` | Implemented |
| Team placeholders (design, development, review, integration) | `components/dev-team/src/teams/registry.ts` | Implemented |
| State persistence | `components/dev-team/src/services/state.ts` | Implemented |
| Machine verification (14 tests, 7 suites) | `components/dev-team/src/smoke.test.ts` | Passing |

### Department Entry Point

`dev_team` is the intended front door for governed implementation work. It is exposed as an MCP server at `components/dev-team/` and owned by `VPRND`.

Tools exposed:
- `devteam_setup` - install department settings (`repo_root`, `implementation_lanes_root`)
- `devteam_status` - inspect department bootstrap state, team ownership, lane visibility, and identity policy

### Commit Identity Policy

- Bootstrap commits: attributed to `VPRND`
- Feature-scoped commits: `<feature-slug>-<role>` (e.g. `mcp-boxing-slice-01-developer`)
- Supported roles: designer, developer, reviewer, integrator

## Artifact Map

- context.md
- decisions.md
- requirements.md
- implement-plan-contract.md
- implement-plan-state.json
- implement-plan-pushback.md
- implement-plan-brief.md
- implementation-run/
- completion-summary.md

## Lifecycle

- active
- blocked
- completed
- closed
