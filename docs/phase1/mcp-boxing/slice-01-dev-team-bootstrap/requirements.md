# Slice 01 Requirements

Status: active slice requirements
Last updated: 2026-04-06
Owner: COO
Scope: `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap`

## Mandatory Requirements

- `dev_team` is the boxed R&D / implementation department for this slice.
- `VPRND` is the governance layer and first callable leader for `dev_team`.
- Internal team placeholders must exist for design, development, review, and integration.
- Slice 01 is machine-facing only, and `Human Verification Plan` remains `Required: false`.
- The architecture must preserve the dual approval and rejection model for future human testing and for the immediate invoker approval gate.
- Even without human testing in this slice, the state and route model must preserve gate-specific rejection and resume behavior.
- Merge must not happen before explicit invoker approval in-thread.
- Final completion truth must not be recorded before explicit invoker approval in-thread.
- Bootstrap-layer commits for this slice must be attributable to `VPRND`.
- The audit identity model must preserve later feature-scoped team-member identities such as `<feature-slug>-designer`, `<feature-slug>-developer`, `<feature-slug>-reviewer`, and `<feature-slug>-integrator`.
- Repo target-branch language for this slice uses `main`.

## Bootstrap Scope Only

- Stand up the boxed department shell, MCP server foundation, build/package baseline, team placeholders, setup route, state model, status surface, and audit identity baseline.
- Do not broaden into the full downstream implementation department migration.
- Do not retire legacy skills in this slice.
- Do not box Brain in this slice.
- Do not complete final CTO orchestration in this slice.

## Required Deliverables

- A real `dev_team` department shell.
- A real `VPRND` entry surface.
- A first setup or initialization API that includes at minimum `repo_root` and `implementation_lanes_root`.
- A durable department-owned state model for identity, settings truth, team ownership baseline, and lane visibility baseline.
- A truthful status or progress surface for department bootstrap state.
- Documentation that positions `dev_team` as the intended front door for governed implementation work.
- A completion report package that includes commits produced, steps taken, operation summary, review cycle count, KPI summary, current slice status, and an explicit invoker approval request before merge.

## Verification And Closeout

- Run machine verification for the department shell, setup route, state persistence, status surface, and build/package baseline implemented by this slice.
- Close the governed review cycle truthfully before requesting invoker approval.
- Run a process-compliance verification pass before asking for invoker approval.
- Stop at the invoker approval gate with merge still pending.

## Source Authorities

- `docs/phase1/mcp-boxing/scope.md`
- `docs/phase1/mcp-boxing/requirements.md`
- `docs/phase1/mcp-boxing/step1.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/README.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/context.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/decisions.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/implement-plan-contract.md`
- `docs/VISION.md`
- `docs/PHASE1_VISION.md`
- `docs/PHASE1_MASTER_PLAN.md`
- `docs/phase1/adf-phase1-current-gap-closure-plan.md`
