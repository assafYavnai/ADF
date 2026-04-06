# ADF Phase 1 MCP Boxing Requirements

Status: proposed baseline requirements
Last updated: 2026-04-06
Owner: COO

## Initiative Requirements

- `dev_team` is the first boxed R&D / implementation department inside ADF Phase 1.
- `dev_team` becomes the intended front door for governed implementation work, even while later slices still reuse existing internal engines behind that boundary.
- The boxed design must preserve worktree-only execution, governed review before closeout, governed merge before completion truth, durable run state, resumability, truthful audit, and safe parallel execution.
- The department shape must support multiple implementation lanes and review cycles in parallel.
- The department must expose truthful status or progress to the invoker without requiring direct control of internal worker lanes.
- The shell must stay compatible with later binary-backed packaging and later CTO control above `dev_team`.
- Repo branch language for this initiative must use `main`, not `master`.

## Step 1 Boundaries

- Step 1 is bootstrap-only and must not broaden into full downstream implementation migration.
- Step 1 establishes the bounded department surface, initial state model, initial API routes, audit identity baseline, and documentation routing needed to make `dev_team` real.
- Step 1 may reuse current governed implementation engines as future internal machinery, but it must not rewrite or retire those engines wholesale.

## Slice 01 Link

- Slice 01 is the bootstrap slice for this initiative.
- Slice-specific mandatory requirements live in `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/requirements.md`.

## Source Authorities

- `docs/phase1/mcp-boxing/scope.md`
- `docs/phase1/mcp-boxing/step1.md`
- `docs/VISION.md`
- `docs/PHASE1_VISION.md`
- `docs/PHASE1_MASTER_PLAN.md`
- `docs/phase1/adf-phase1-current-gap-closure-plan.md`
