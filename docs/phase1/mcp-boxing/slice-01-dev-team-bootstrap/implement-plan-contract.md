1. Implementation Objective

Stand up the first boxed `dev_team` department shell for ADF Phase 1 by introducing the MCP server foundation, `VPRND` governance layer, internal team placeholders, first department-owned setup route, and initial department state and audit identity model. Keep this slice narrowly focused on making `dev_team` real as the new intended front door, without yet migrating the full implementation, review, and integration route behind it.

2. Slice Scope

- Create the first repo-owned `dev_team` department shell inside ADF as the new boxed R&D department surface.
- Introduce `VPRND` as the governance-layer owner for this department.
- Establish the internal team map for at least:
  - design team
  - development team
  - review team
  - integration team
- Build the MCP server foundation and the basic build/package skeleton needed for this department to exist as a real boxed component.
- Implement the first bounded setup route owned by `VPRND`.
- Ensure the setup route includes at minimum:
  - `repo_root`
  - `implementation_lanes_root`
- Add the first department-owned state model for settings, lane visibility baseline, and team ownership baseline.
- Add the first documentation routing for this department so it can become the intended implementation front door.
- Seed the commit identity policy for department and team-member attribution so later slices can produce deep audit trails.
- Keep the current governed engines as the baseline source for later migration, but do not yet migrate their full downstream behavior into this slice.

3. Required Deliverables

- A real `dev_team` department shell.
- A real `VPRND` governance-layer entry surface for `dev_team`.
- A stable internal team placeholder model for design, development, review, and integration.
- A first setup / initialization API owned by `VPRND`.
- A first department-owned settings model that installs at minimum:
  - `repo_root`
  - `implementation_lanes_root`
- Department-owned persistent state for at least:
  - settings truth
  - department identity
  - team ownership baseline
  - active lane visibility baseline
- A first progress or status surface that lets the invoker inspect department bootstrap truthfully.
- A documented commit identity policy that supports:
  - `VPRND`-owned bootstrap commits
  - later feature-scoped team-member commits such as `<feature-slug>-developer` and `<feature-slug>-reviewer`
- Slice documentation that clearly positions `dev_team` as the new intended front door for governed implementation work.

4. Allowed Edits

- New `dev_team` department source under the ADF repo
- New MCP-facing department files required for `dev_team`
- New build/package files required for the boxed department shell
- New department-state files or helpers required for truthful bootstrap behavior
- Minimal documentation routing updates needed to introduce `dev_team`
- This feature root under `C:/ADF/docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap`
- Minimal aligned updates to current skills or bootstrap docs only when required to reference the new department entry path truthfully

5. Forbidden Edits

- Do not yet migrate the full end-to-end implementation lane.
- Do not yet wire the complete development -> review -> integration execution path.
- Do not yet remove legacy skills.
- Do not yet convert Brain into a boxed binary-backed component.
- Do not yet complete final CTO-managed orchestration.
- Do not broaden this slice into a full company re-architecture.
- Do not weaken current governed-route invariants already established elsewhere.

6. Acceptance Gates

1. `dev_team` exists as a real department surface inside ADF.
2. `VPRND` exists as the governance-layer owner and first callable leader for `dev_team`.
3. The department exposes a first bounded setup route.
4. The setup route installs at minimum `repo_root` and `implementation_lanes_root`.
5. The department persists truthful bootstrap state for settings and team ownership baseline.
6. The department exposes a truthful status/progress surface for its bootstrap state.
7. The department has explicit placeholders for design, development, review, and integration teams.
8. The slice documents the intended commit identity model for `VPRND` and later feature-scoped team members.
9. The resulting department shell is clearly positioned for later wiring of the full implementation route without needing to be re-conceived.
10. The slice remains machine-verifiable without requiring human-facing product testing.
11. The architecture preserves gate-specific rejection and resume behavior for future human testing and for the immediate invoker approval hold. Evidence: `LaneEntry.status` enum includes `review_rejected`, `awaiting_invoker_approval`, and `resume_ready` with per-lane `gate_context`; `devteam_status` projects these without collapsing; smoke tests prove round-trip persistence and negative proof against collapse.
12. Merge to `main` and final completion truth stop until explicit invoker approval is recorded after implementation, review, and compliance verification.

KPI Applicability: not required
KPI Route / Touched Path: None. Slice 01 is bootstrap infrastructure for a new boxed department shell and does not yet move the live governed implementation lane behind `dev_team`.
KPI Raw-Truth Source: None. This slice is not claiming KPI closure for a production implementation route yet.
KPI Coverage / Proof: None. Machine verification in this slice proves bootstrap behavior, package/build baseline, and truthful state or status surfaces rather than production KPI closure.
KPI Production / Proof Partition: Proof only. This slice verifies the new department bootstrap in isolation before later slices wire the live implementation route through `dev_team`.
KPI Non-Applicability Rationale: Slice 01 creates the department shell, setup route, state model, and status surface, but it does not yet replace the production implementation front door or claim KPI closure for the later governed implementation route.
KPI Exception Owner: None.
KPI Exception Expiry: None.
KPI Exception Production Status: None.
KPI Compensating Control: None.
Vision Compatibility: Compatible. This slice turns implementation into a real department surface with governance, durable state, and later worker structure, which directly strengthens the virtual-company model rather than adding an isolated agent trick.
Phase 1 Compatibility: Compatible. The slice builds the implementation startup by making the emerging CTO / implementation function more bounded, auditable, and operationally durable without broadening into unrelated departments.
Master-Plan Compatibility: Compatible. This work strengthens implementation admission and execution ownership, improves operational clarity, and stays inside the active Phase 1 mission instead of smuggling in later-company breadth.
Current Gap-Closure Compatibility: Compatible. The slice supports Gap D by introducing a department shell shaped for multiple lanes and durable state, and it supports the future COO -> CTO seam by giving later admission work a boxed implementation target.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: `docs/phase1/mcp-boxing/scope.md` defines `dev_team` as the first boxed implementation department and positions it as the new intended front door for governed work. `docs/phase1/mcp-boxing/step1.md` explicitly scopes this step to authority shape, bounded entry surfaces, durable state, and bootstrap-only delivery. This contract keeps the slice bootstrap-only, preserves later CTO layering, and does not broaden into full downstream route migration or non-R&D department boxing.

Machine Verification Plan
- Run machine-facing verification for the new `dev_team` source and its bootstrap helpers.
- Verify the department can be initialized through the new setup route.
- Verify setup state persists truthfully and can be read back.
- Verify status/progress surfaces reflect the installed bootstrap state truthfully.
- Verify the build/package path for the department shell succeeds at the level implemented by this slice.
- Verify the department shell remains isolated from unrelated downstream execution behavior not yet included in this slice.

Human Verification Plan
- Required: false
- Reason: this slice creates the boxed department shell, governance layer, setup route, and bootstrap state. It is infrastructure-first and machine-facing only.

7. Observability / Audit

- The bootstrap state must make it obvious whether the department is initialized or not.
- The stored settings must make the installed repo root and implementation lanes root truthfully visible.
- The status surface must make it clear which team placeholders exist and whether the department shell is ready for later slices.
- The audit model must make the intended `VPRND` bootstrap ownership and later feature-scoped team identities explicit in documentation and state.
- The status and route model must make it clear whether the slice is awaiting invoker approval, rejected at a gate, or ready to resume from that gate without losing route truth. This is now enforced by the `LaneStatus` enum (`review_rejected`, `awaiting_invoker_approval`, `resume_ready`) and the `gate_context` field on `LaneEntry`, surfaced truthfully through `devteam_status`.

8. Dependencies / Constraints

- Stay aligned with `docs/phase1/mcp-boxing/scope.md` and `docs/phase1/mcp-boxing/step1.md`.
- Treat current `implement-plan`, `review-cycle`, and `merge-queue` behavior as baseline engine sources for later migration, not as the final department shape.
- Keep Slice 01 narrow and bootstrap-only.
- Preserve the future ability to support multiple implementation lanes and review cycles in parallel.
- Keep the department shell compatible with later binary-backed packaging.
- Keep the first API surface bounded and stable.

9. Non-Goals

- No full `implement` route in this slice.
- No full downstream worker orchestration in this slice.
- No legacy skill retirement in this slice.
- No Brain boxing in this slice.
- No final CTO hierarchy wiring in this slice.

10. Source Authorities

- [README.md](/C:/ADF/docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/README.md)
- [context.md](/C:/ADF/docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/context.md)
- [decisions.md](/C:/ADF/docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/decisions.md)
- [requirements.md](/C:/ADF/docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/requirements.md)
- [scope.md](/C:/ADF/docs/phase1/mcp-boxing/scope.md)
- [requirements.md](/C:/ADF/docs/phase1/mcp-boxing/requirements.md)
- [step1.md](/C:/ADF/docs/phase1/mcp-boxing/step1.md)
- [VISION.md](/C:/ADF/docs/VISION.md)
- [PHASE1_VISION.md](/C:/ADF/docs/PHASE1_VISION.md)
- [PHASE1_MASTER_PLAN.md](/C:/ADF/docs/PHASE1_MASTER_PLAN.md)
- [adf-phase1-current-gap-closure-plan.md](/C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md)
- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [SKILL.md](/C:/ADF/skills/review-cycle/SKILL.md)
- [SKILL.md](/C:/ADF/skills/merge-queue/SKILL.md)
