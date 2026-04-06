# Feature Context

## Feature

- phase_number: 1
- feature_slug: mcp-boxing/slice-01-dev-team-bootstrap
- project_root: C:/ADF
- feature_root: C:/ADF/docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap
- current_branch: implement-plan/phase1/mcp-boxing-slice-01-dev-team-bootstrap

## Task Summary

Create Slice 1 for MCP boxing by standing up the boxed `dev_team` department skeleton, its `VPRND` governance layer, the MCP server foundation, build/package baseline, internal team placeholders, and the first setup API that installs department settings such as repo root and implementation lanes root, while preserving an explicit invoker approval gate before merge to `main`.

## Scope Hint

Keep this slice focused on department bootstrap only. Build the first callable `dev_team` shell, the first bounded setup route, department-owned state and audit identity policy, and the documentation needed to make this the clean new front door. Do not yet migrate the full implementation, review, or integration behavior behind the shell.

## Non-Goals

Do not yet wire the full end-to-end implementation route. Do not yet remove legacy skills. Do not yet convert Brain into a binary-backed boxed component. Do not yet move final downstream ownership under CTO.

## Discovered Authorities

- [feature-readme] C:/ADF/docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/README.md
- [feature-decisions] C:/ADF/docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/decisions.md
- [feature-requirements] C:/ADF/docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/requirements.md
- [feature-contract] C:/ADF/docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/implement-plan-contract.md
- [phase-scope] C:/ADF/docs/phase1/mcp-boxing/scope.md
- [phase-requirements] C:/ADF/docs/phase1/mcp-boxing/requirements.md
- [phase-step] C:/ADF/docs/phase1/mcp-boxing/step1.md
- [vision] C:/ADF/docs/VISION.md
- [phase-vision] C:/ADF/docs/PHASE1_VISION.md
- [phase-plan] C:/ADF/docs/PHASE1_MASTER_PLAN.md
- [phase-gap-plan] C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md
- [current-engine] C:/ADF/skills/implement-plan/SKILL.md
- [current-engine] C:/ADF/skills/review-cycle/SKILL.md
- [current-engine] C:/ADF/skills/merge-queue/SKILL.md
- [bootstrap] C:/ADF/AGENTS.md

## Notes

- This context file is intentionally human-seeded before the first `implement-plan` run so the slice starts with explicit scope and decisions.
- `main` is the repo default branch, and slice merge language should use `main` rather than `master`.
- `adf.cmd --doctor` verified Brain connectivity and audit writes, but the direct `project-brain` MCP tool surface is not exposed in this runtime, so this slice uses a repo-local decisions log that can be migrated later.

## Implementation Notes

- The `dev_team` department shell is implemented as an MCP server under `components/dev-team/`, following the same pattern as `components/memory-engine/` (Brain).
- State is persisted as a file-based JSON model at a configurable directory (defaulting to `.dev-team-state/` relative to the component, overridable via `DEV_TEAM_STATE_DIR` env var).
- The department shell is fully isolated from `skills/`, `COO/`, `tools/`, and `memory-engine/` - verified by an automated isolation test.
- The MCP server exposes two tools: `devteam_setup` and `devteam_status`. Later slices will add `devteam_implement`, `devteam_resume`, `devteam_cancel`, etc.
- The build uses the same TypeScript/ES2022/Node16 pattern as `memory-engine`.
- 14 machine-facing tests verify schemas, identity, state persistence, setup route, status surface, tool definitions, and isolation.
