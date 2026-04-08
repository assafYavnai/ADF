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

## Detailed Gate Requirements

### Requirement S1-R-001 - Invoker approval is required before merge and completion

Status: active Slice 01 requirement

Even though Slice 01 does not yet implement the full downstream delivery route, the department model created in this slice must preserve the rule that:

- merge must not happen without invoker approval that the slice is complete
- completion status must not be final before that approval exists

#### Required future behavior preserved by Slice 01

Before final merge into `main` and `origin/main`, the invoker must receive a detailed report and explicitly approve the slice as complete.

That report must include at minimum:

- commits produced
- steps taken
- operation summary
- review cycle count
- KPI summary
- explicit approval request

#### Why this belongs in Slice 01

Slice 01 is creating the boxed department shell and its first state model.

That shell must be designed from the beginning to support:

- final invoker approval as a first-class gate
- rejection from that gate
- truthful resume after that gate rejects

### Requirement S1-R-002 - Dual rejection model must be preserved in the state model

Status: active Slice 01 requirement

The department shell created in Slice 01 must not collapse all rejection into one generic state.

The state and route model must preserve the future ability to distinguish at minimum:

- rejection from human testing
- rejection from invoker approval

#### Why this belongs in Slice 01

If the boxed department shell starts with a single undifferentiated rejection model, later approval-gate truth will be harder to add cleanly.

So even before the full downstream route is implemented, Slice 01 must preserve the architecture needed for gate-specific rejection and resume behavior.

## Verification And Closeout

- Run machine verification for the department shell, setup route, state persistence, status surface, and build/package baseline implemented by this slice.
- Close the governed review cycle truthfully before requesting invoker approval.
- Run a process-compliance verification pass before asking for invoker approval.
- Stop at the invoker approval gate with merge still pending.

## Decision Link

These slice requirements should be read together with:

- `docs/phase1/mcp-boxing/requirements.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/decisions.md`

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
