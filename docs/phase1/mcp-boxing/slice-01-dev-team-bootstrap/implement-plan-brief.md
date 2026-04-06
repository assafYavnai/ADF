1. Implementation Objective

Implement Slice 01 for MCP boxing by standing up the boxed `dev_team` department bootstrap in the governed feature worktree, with `VPRND` as the first callable governance leader, a truthful setup or initialization API, durable department state, a truthful status surface, internal team placeholders, and an explicit invoker approval hold before any merge to `main`.

2. Exact Slice Scope

- Create the first repo-owned `dev_team` department shell in this feature worktree.
- Introduce the `VPRND` governance-layer surface and first setup route.
- Add the MCP server foundation and build or package baseline needed for the boxed department shell.
- Add placeholders for design, development, review, and integration teams.
- Add a durable department-owned state model for identity, settings truth, team ownership baseline, and lane visibility baseline.
- Add a truthful status or progress surface for bootstrap state, including readiness and invoker-approval hold visibility when required.
- Preserve the dual approval or rejection model and the explicit pre-merge invoker approval gate if current governed route behavior would otherwise auto-progress.
- Update materially affected authoritative docs for this slice.

3. Inputs / Authorities Read

- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/README.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/context.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/decisions.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/requirements.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/implement-plan-contract.md`
- `docs/phase1/mcp-boxing/requirements.md`
- `docs/phase1/mcp-boxing/scope.md`
- `docs/phase1/mcp-boxing/step1.md`
- `docs/VISION.md`
- `docs/PHASE1_VISION.md`
- `docs/PHASE1_MASTER_PLAN.md`
- `docs/phase1/adf-phase1-current-gap-closure-plan.md`
- `AGENTS.md`
- `skills/implement-plan/SKILL.md`
- `skills/review-cycle/SKILL.md`
- `skills/merge-queue/SKILL.md`

4. Required Deliverables

- A real `dev_team` department shell.
- A real `VPRND` governance-layer entry surface.
- A first setup or initialization API that includes at minimum `repo_root` and `implementation_lanes_root`.
- A durable department-owned state model.
- A truthful status or progress surface for bootstrap state.
- Internal team placeholders for design, development, review, and integration.
- Documented audit identity policy for `VPRND` and later feature-scoped team members.
- Any governed-route changes strictly required to preserve the explicit invoker approval hold before merge.

5. Forbidden Edits

- Do not yet migrate the full end-to-end implementation lane.
- Do not yet wire the complete development -> review -> integration execution path.
- Do not yet retire legacy skills wholesale.
- Do not yet box Brain.
- Do not yet complete final CTO-managed orchestration.
- Do not broaden this slice into a full company re-architecture.
- Do not weaken existing governed-route invariants.
- Do not merge or mark the feature completed.

6. Integrity-Verified Assumptions Only

- The governed feature branch is `implement-plan/phase1/mcp-boxing-slice-01-dev-team-bootstrap`.
- The governed feature worktree is `C:/ADF/.codex/implement-plan/worktrees/phase1/mcp-boxing/slice-01-dev-team-bootstrap`.
- The repo default target branch is `main`.
- `implement-plan` prepare passed after the contract was normalized and now requires a Claude implementor lane under `claude --dangerously-skip-permissions`.
- Review-cycle must later run with the fixed Codex review lanes.
- Human verification is not required for this slice, but invoker approval before merge is required.

7. Explicit Non-Goals

- No full `implement` route in this slice.
- No full downstream worker orchestration in this slice.
- No skill retirement program in this slice.
- No Brain boxing in this slice.
- No final CTO hierarchy wiring in this slice.

8. Proof / Verification Expectations

Machine Verification:
- Run targeted build, test, and smoke checks for the new `dev_team` department shell and any touched governed-route surfaces.
- Prove the setup route accepts and persists `repo_root` and `implementation_lanes_root`.
- Prove the status surface reports truthful bootstrap state.
- Prove the slice remains bootstrap-only and does not silently broaden into downstream route migration.
- If you touch governed-route closeout behavior, prove the explicit invoker approval hold is preserved before merge.

Human Verification: not required

9. Required Artifact Updates

- `docs/phase1/mcp-boxing/requirements.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/README.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/context.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/decisions.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/requirements.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/implement-plan-contract.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/completion-summary.md` if you produce it truthfully
- Any execution-contract, run-projection, or governed-route proof artifacts only if your implementation materially changes those runtime surfaces

10. Closeout Rules

- Human testing: not required
- Review-cycle: required after implementation and machine verification
- Post-human-approval sanity pass: not applicable unless later review fixes introduce human-facing behavior
- Final completion: only after review closure, explicit invoker approval, governed merge, and truthful completion updates
