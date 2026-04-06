1. Failure Classes

- FC1: under-modeled department state/status contract
- FC2: route-truth divergence across governed execution artifacts

2. Route Contracts

- FC1
- claimed supported route: `devteam_setup -> department state -> devteam_status`
- end-to-end invariant: a lane persisted in department state must preserve gate-specific rejection, invoker-approval-hold, and resume-checkpoint truth through the `devteam_status` surface without collapsing to a generic status
- KPI Applicability: not required
- KPI Route / Touched Path: none
- KPI Raw-Truth Source: none
- KPI Coverage / Proof: machine verification only
- KPI Production / Proof Partition: proof only
- KPI Non-Applicability Rationale: Slice 01 is still bootstrap infrastructure and does not claim KPI closure for the live governed implementation route
- Vision Compatibility: Compatible
- Phase 1 Compatibility: Compatible
- Master-Plan Compatibility: Compatible
- Current Gap-Closure Compatibility: Compatible
- Later-Company Check: no
- Compatibility Decision: compatible
- Compatibility Evidence: the slice preserves the boxed implementation front door, keeps the work bootstrap-only, and extends the department-owned contract only enough to represent required gate truth
- allowed mutation surfaces: `components/dev-team/src/schemas/state.ts`, `components/dev-team/src/services/status.ts`, `components/dev-team/src/tools/status-tools.ts`, `components/dev-team/src/smoke.test.ts`, slice docs
- forbidden shared-surface expansion: no new MCP tools, no setup API changes, no changes to identity or team placeholder contracts
- docs that must be updated: `README.md`, `implement-plan-contract.md`

- FC2
- claimed supported route: `implement-plan execution -> machine verification -> review-cycle dispatch -> execution projections / completion summary`
- end-to-end invariant: all feature artifacts must report the same current lifecycle stage: implementation completed, machine verification completed, review cycle in progress
- KPI Applicability: not required
- KPI Route / Touched Path: none
- KPI Raw-Truth Source: none
- KPI Coverage / Proof: artifact truth plus machine verification
- KPI Production / Proof Partition: proof only
- KPI Non-Applicability Rationale: the fix closes state/reporting truth for the bootstrap slice rather than a live KPI-bearing production route
- Vision Compatibility: Compatible
- Phase 1 Compatibility: Compatible
- Master-Plan Compatibility: Compatible
- Current Gap-Closure Compatibility: Compatible
- Later-Company Check: no
- Compatibility Decision: compatible
- Compatibility Evidence: the fix closes governed execution truth inside the current feature artifacts without broadening into general workflow redesign
- allowed mutation surfaces: feature-local `implement-plan-state.json`, `run-projection.v1.json`, `completion-summary.md`, feature-local execution contracts
- forbidden shared-surface expansion: no schema version changes, no route-policy changes, no worker binding changes, no resume semantic changes
- docs that must be updated: `completion-summary.md`

3. Sweep Scope

- `components/dev-team/src/schemas/state.ts`
- `components/dev-team/src/services/status.ts`
- `components/dev-team/src/tools/status-tools.ts`
- `components/dev-team/src/smoke.test.ts`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/README.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/implement-plan-contract.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/completion-summary.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/implement-plan-state.json`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/implement-plan-execution-contract.v1.json`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/implementation-run/run-7495dfac-a270-4287-a340-ba31ec60b3f2/execution-contract.v1.json`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/implementation-run/run-7495dfac-a270-4287-a340-ba31ec60b3f2/run-projection.v1.json`

4. Planned Changes

- FC1: extend `LaneEntry.status` with gate-aware values and add optional `gate_context` so gate-specific state can persist truthfully
- FC1: extend `DepartmentStatus` and `devteam_status` to surface gate context without collapsing to generic lane status
- FC1: add smoke coverage for gate-state schema validity, persistence round-trip, projection truth, and setup-route non-interference
- FC2: update feature-local governed execution artifacts so implementation and machine verification are recorded as completed before review handoff
- FC2: update feature-local execution contracts so `integrity.next_safe_move` reflects review in progress instead of pre-implementation guidance

5. Closure Proof

- `npm.cmd --prefix components/dev-team run build`
- `npm.cmd --prefix components/dev-team test`
- round-trip persistence proof for `review_rejected`, `awaiting_invoker_approval`, and `resume_ready`
- negative proof that invalid lane statuses are rejected
- negative proof that `devteam_status` preserves gate-aware statuses and `gate_context`
- negative proof that `devteam_setup` does not create or mutate lanes
- grep proof that feature artifacts no longer report `implementation` or `machine_verification` as `not_started`
- artifact proof that `completion-summary.md`, `implement-plan-state.json`, `run-projection.v1.json`, and execution contracts agree on review in progress

6. Non-Goals

- No full `devteam_implement` route
- No skill retirement
- No Brain boxing
- No final CTO orchestration
- No merge
- No schema version bump on execution contracts
- No route-policy or resume-policy changes
