# Candidate Requirements Traceability

## Source Packet

- Candidate source packet basis: `requirements/candidate-finalized-requirement-packet-basis.json`
- Reviewed feature-stream sources:
  - `docs/phase1/requirements-gathering/README.md`
  - `docs/phase1/requirements-gathering/context.md`
  - `docs/phase1/requirements-gathering/cycle-01/review-findings.md`
  - `docs/phase1/requirements-gathering/cycle-01/audit-findings.md`
  - `docs/phase1/requirements-gathering/cycle-01/fix-report.md`
  - `docs/phase1/requirements-gathering/cycle-02/review-findings.md`
  - `docs/phase1/requirements-gathering/cycle-02/audit-findings.md`
  - `docs/phase1/requirements-gathering/cycle-02/fix-report.md`
  - `docs/phase1/requirements-gathering/cycle-03/review-findings.md`
  - `docs/phase1/requirements-gathering/cycle-03/audit-findings.md`
  - `docs/phase1/requirements-gathering/cycle-03/fix-plan.md`
  - `docs/phase1/onion-live-integration-report.md`
  - `tests/integration/artifacts/onion-route-proof/report.json`

## Scope Item To Functional Requirement Map

- `scope-live-route` -> `FR-001`, `FR-002`, `FR-003`
- `scope-persistence` -> `FR-005`, `FR-006`, `FR-007`
- `scope-telemetry` -> `FR-008`
- `scope-recovery` -> `FR-003`, `FR-004`
- `scope-documentation` -> `FR-010`
- `scope-proof` -> `FR-002`, `FR-008`, `FR-009`, `FR-010`

## Acceptance Example To Acceptance Check Map

- `ex-cli-bootstrap` -> `AC-001`, `AC-008`
- `ex-gate-disabled-followup` -> `AC-002`
- `ex-frozen-thread-recovery` -> `AC-003`
- `ex-finalized-create-lock` -> `AC-004`
- `ex-no-scope-fail-closed` -> `AC-005`
- `ex-reopen-supersession` -> `AC-006`
- `ex-proof-isolation` -> `AC-007`, `AC-008`

## Boundaries And Non-Goals Mapping

- Boundary `Use the task summary and current repo state to keep the fix route-level and tight.` -> preserved in `candidate-frozen-requirement-contract.md` under `## Boundaries`.
- Boundary `Review the requirements-gathering implementation end to end, with emphasis on the live COO onion integration route, persistence, telemetry, recovery, documentation, and proof.` -> preserved in `candidate-frozen-requirement-contract.md` under `## Boundaries` and `## Intent`.
- Non-goals from `context.md` and `cycle-03/fix-plan.md` -> preserved in `candidate-frozen-requirement-contract.md` under `## Non-Goals`.
- Runtime route, gate controls, governed supersession narrowness, and proof-mode isolation rule -> preserved in `candidate-frozen-requirement-contract.md` under `## Constraints`.

## Unresolved Business Decisions

None. The remaining blockers are upstream phase-closure and local technical-fix blockers, not new business-decision blockers.

## Notes On Local Repairs

- Split the mixed requested scope into six candidate major scope items.
- Converted scattered review-focus and proof-obligation prose into candidate `human_success_view` and `human_testing_view` fields.
- Split combined route claims into ten candidate functional requirements.
- Converted explicit reviewed proof scenarios into seven candidate acceptance examples and eight candidate acceptance checks.
- Preserved boundaries, non-goals, and constraints without widening the feature scope.
