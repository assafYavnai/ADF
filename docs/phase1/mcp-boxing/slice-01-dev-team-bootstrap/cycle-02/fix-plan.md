1. Failure Classes

- FC1: route-truth divergence across carried-forward verification artifacts

2. Route Contracts

- claimed supported route: `cycle-01 fix verification -> feature-root completion package -> cycle-02 review handoff`
- end-to-end invariant: every current authoritative proof-bearing surface under the feature root must report the same machine-verification baseline as the live `components/dev-team` test suite
- KPI Applicability: not required
- KPI Route / Touched Path: none
- KPI Raw-Truth Source: none
- KPI Coverage / Proof: live `npm.cmd --prefix components/dev-team run build` and `npm.cmd --prefix components/dev-team test` proof plus synchronized feature-root read models
- KPI Production / Proof Partition: proof only
- KPI Non-Applicability Rationale: Slice 01 remains a machine-facing bootstrap shell and this fix only repairs proof-package fidelity, not a live KPI-bearing production route
- Vision Compatibility: Compatible
- Phase 1 Compatibility: Compatible
- Master-Plan Compatibility: Compatible
- Current Gap-Closure Compatibility: Compatible
- Later-Company Check: no
- Compatibility Decision: compatible
- Compatibility Evidence: the fix is limited to current proof-bearing feature artifacts and does not broaden the boxed `dev_team` runtime, approval model, or downstream implementation scope
- allowed mutation surfaces: `README.md`, `completion-summary.md`, `implement-plan-state.json`, `implementation-run/run-7495dfac-a270-4287-a340-ba31ec60b3f2/run-projection.v1.json`, `cycle-02/fix-plan.md`, `cycle-02/fix-report.md`
- forbidden shared-surface expansion: no shared helper edits, no runtime MCP behavior edits, no schema or env-surface expansion, no rewrites of historical cycle evidence
- docs that must be updated: `README.md`, `completion-summary.md`, `cycle-02/fix-plan.md`, `cycle-02/fix-report.md`

3. Sweep Scope

- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/README.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/completion-summary.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/implement-plan-state.json`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/implementation-run/run-7495dfac-a270-4287-a340-ba31ec60b3f2/run-projection.v1.json`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/implement-plan-contract.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/implement-plan-execution-contract.v1.json`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/implementation-run/run-7495dfac-a270-4287-a340-ba31ec60b3f2/execution-contract.v1.json`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/context.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/cycle-01/review-findings.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/cycle-02/audit-findings.md`
- `docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap/cycle-02/review-findings.md`

4. Planned Changes

- Update the deliverables verification line in `README.md` from the stale 14/7 baseline to the current 20/8 baseline.
- Update the machine-verification proof line in `completion-summary.md` from the stale 14/7 baseline to the current 20/8 baseline.
- Update `machine_verification.note` and all carried-forward `verification_outcomes[].summary` fields in `implement-plan-state.json` to the current 20/8 baseline.
- Update `machine_verification.note` and all carried-forward `verification_outcomes[].summary` fields in `run-projection.v1.json` to the current 20/8 baseline.
- Create contract-valid `cycle-02/fix-plan.md` before edits and `cycle-02/fix-report.md` after proof exists.

5. Closure Proof

- route to prove: `cycle-01 fix verification -> feature-root completion package -> cycle-02 review handoff`
- KPI closure proof or exception state: KPI applicability remains `not required`; closure depends on live build/test proof plus synchronized current proof-bearing feature artifacts
- negative proof required: show that no current authoritative proof-bearing surface under the feature root still cites `14 tests` or `7 suites` after synchronization
- live/proof isolation checks: confirm the live `components/dev-team` runtime code remains unchanged and that only proof-bearing docs/read-model artifacts changed in this cycle
- targeted regression checks:
- `npm.cmd --prefix components/dev-team run build`
- `npm.cmd --prefix components/dev-team test`
- grep proof over current authoritative surfaces for `14 tests` and `7 suites`
- direct spot-check of `README.md`, `completion-summary.md`, `implement-plan-state.json`, and `run-projection.v1.json`

6. Non-Goals

- No full `devteam_implement` route
- No skill retirement
- No Brain boxing
- No final CTO orchestration
- No merge
- No historical cycle evidence rewrites
- No shared workflow-helper edits
