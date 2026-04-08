# Slice 01 Decisions Log

Status: active temporary repo-local decision log  
Scope: `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap`  
Purpose: preserve explicit decisions until they can be migrated into Brain.

## Decision D-001 - Department identity

Decision: `dev_team` is the boxed R&D / implementation department being introduced by the MCP boxing initiative.

Status: accepted

Why: the implementation function needs to stop existing as open repo-local operational skills and start existing as an internal company function.

## Decision D-002 - Governance leader identity

Decision: `VPRND` is the governance layer and first callable leader for `dev_team`.

Status: accepted

Why: the department needs a clear authority layer that owns sequencing, handoffs, state truth, and policy, instead of exposing raw engines directly.

## Decision D-003 - Internal team model

Decision: `dev_team` will be internally structured into at least these teams:

- design team
- development team
- review team
- integration team

Status: accepted

Why: this maps the current implementation engines into company functions and avoids turning `dev_team` into one undifferentiated monolith.

## Decision D-004 - Slice 01 purpose

Decision: Slice 01 is the department bootstrap slice, not the full implementation-lane migration slice.

Status: accepted

Why: Phase 1 needs the authority structure first. The raw engines already exist in substantial form; the missing piece is the boxed front door and governance shape.

## Decision D-005 - First live route

Decision: the first live route exposed by `VPRND` is the setup / initialization route.

Status: accepted

Why: the first production need is to install department settings, establish the working roots, and seed team ownership before attempting full downstream execution.

## Decision D-006 - Required setup API baseline

Decision: the setup API must include at minimum:

- `repo_root`
- `implementation_lanes_root`

Status: accepted

Why: these are the minimum settings explicitly required to install the department in a real repo and define where implementation lanes will live.

Note: additional department roots may be introduced by the implementation only when they are required for a truthful boxed department shell.

## Decision D-007 - Commit identity policy

Decision: commits made for the department bootstrap layer should be attributable to `VPRND`, and later lane-specific commits should use team-member identities derived from the feature slug.

Status: accepted

Why: the target audit model requires deep traceability by team role.

Examples of intended later identities:

- `<feature-slug>-designer`
- `<feature-slug>-developer`
- `<feature-slug>-reviewer`
- `<feature-slug>-integrator`

## Decision D-008 - Testing mode for Slice 01

Decision: Slice 01 uses machine-facing verification only.

Status: accepted

Why: this slice establishes infrastructure, department shell behavior, and setup routing. It does not yet require a human-facing product test.

## Decision D-009 - Decision logging rule

Decision: all decisions for this slice must be written explicitly into this file and marked as decisions.

Status: accepted

Why: Brain is not available from this environment, so repo-local explicit decisions are required to avoid silent assumptions.

## Decision D-010 - Invoker approval hold

Decision: after implementation, review, and process-compliance verification, this slice must stop at an explicit invoker approval gate before merge or completion truth is recorded.

Status: accepted

Why: Slice 01 is required to preserve the dual approval model and must not silently merge or silently mark completed.

## Decision D-011 - Target-branch terminology

Decision: this slice uses `main` as the target branch term in documentation, reports, and route contracts.

Status: accepted

Why: the repo default branch is `main`, and the governed route must describe branch targets truthfully.

## Decision D-012 - Component location

Decision: the `dev_team` department shell lives under `components/dev-team/`, alongside `components/memory-engine/` (Brain).

Status: accepted

Why: `components/` is the established home for MCP server components in the repo. This placement makes `dev_team` a peer of Brain and positions both for later binary-backed packaging under the same pattern.

## Decision D-013 - State persistence model

Decision: department state is persisted as a single JSON file (`dev-team-state.json`) under a configurable directory, defaulting to `.dev-team-state/` relative to the component root, overridable via `DEV_TEAM_STATE_DIR` environment variable.

Status: accepted

Why: file-based JSON persistence keeps the bootstrap slice simple, inspectable, and database-free. The configurable directory allows tests to use isolated temp directories and production to place state in a well-known operational path.

## Decision D-014 - MCP tool naming

Decision: MCP tools for the department use the prefix `devteam_` (e.g. `devteam_setup`, `devteam_status`).

Status: accepted

Why: this follows the flat tool-name convention from the MCP protocol, keeps tool names short and grep-friendly, and clearly scopes them to the department.

## Decision D-015 - Isolation boundary

Decision: the `dev_team` component must not import from `skills/`, `COO/`, `tools/`, or `memory-engine/`. This is enforced by an automated test.

Status: accepted

Why: the department shell must be a self-contained boxed component. Cross-component imports would break the boxing model and make later binary packaging impossible.
