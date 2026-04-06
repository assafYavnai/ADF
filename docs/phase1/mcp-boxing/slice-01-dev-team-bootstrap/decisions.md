# Slice 01 Decisions Log

Status: active temporary repo-local decision log  
Scope: `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap`  
Purpose: preserve explicit decisions until they can be migrated into Brain.

## Decision D-001 — Department identity

Decision: `dev_team` is the boxed R&D / implementation department being introduced by the MCP boxing initiative.

Status: accepted

Why: the implementation function needs to stop existing as open repo-local operational skills and start existing as an internal company function.

## Decision D-002 — Governance leader identity

Decision: `VPRND` is the governance layer and first callable leader for `dev_team`.

Status: accepted

Why: the department needs a clear authority layer that owns sequencing, handoffs, state truth, and policy, instead of exposing raw engines directly.

## Decision D-003 — Internal team model

Decision: `dev_team` will be internally structured into at least these teams:

- design team
- development team
- review team
- integration team

Status: accepted

Why: this maps the current implementation engines into company functions and avoids turning `dev_team` into one undifferentiated monolith.

## Decision D-004 — Slice 01 purpose

Decision: Slice 01 is the department bootstrap slice, not the full implementation-lane migration slice.

Status: accepted

Why: Phase 1 needs the authority structure first. The raw engines already exist in substantial form; the missing piece is the boxed front door and governance shape.

## Decision D-005 — First live route

Decision: the first live route exposed by `VPRND` is the setup / initialization route.

Status: accepted

Why: the first production need is to install department settings, establish the working roots, and seed team ownership before attempting full downstream execution.

## Decision D-006 — Required setup API baseline

Decision: the setup API must include at minimum:

- `repo_root`
- `implementation_lanes_root`

Status: accepted

Why: these are the minimum settings explicitly required to install the department in a real repo and define where implementation lanes will live.

Note: additional department roots may be introduced by the implementation only when they are required for a truthful boxed department shell.

## Decision D-007 — Commit identity policy

Decision: commits made for the department bootstrap layer should be attributable to `VPRND`, and later lane-specific commits should use team-member identities derived from the feature slug.

Status: accepted

Why: the target audit model requires deep traceability by team role.

Examples of intended later identities:

- `<feature-slug>-designer`
- `<feature-slug>-developer`
- `<feature-slug>-reviewer`
- `<feature-slug>-integrator`

## Decision D-008 — Testing mode for Slice 01

Decision: Slice 01 uses machine-facing verification only.

Status: accepted

Why: this slice establishes infrastructure, department shell behavior, and setup routing. It does not yet require a human-facing product test.

## Decision D-009 — Decision logging rule

Decision: all decisions for this slice must be written explicitly into this file and marked as decisions.

Status: accepted

Why: Brain is not available from this environment, so repo-local explicit decisions are required to avoid silent assumptions.
