1. Implementation Objective

Wire the live COO finalized-requirement freeze path into the existing `COO/cto-admission/**` package so the COO can build real persisted CTO-admission artifacts directly from the finalized requirement artifact, persist explicit admission lifecycle truth, and expose non-silent build failures without manual reinterpretation.

2. Slice Scope

- `COO/requirements-gathering/live/**` only where the live finalized requirement freeze path produces or forwards the authoritative finalized artifact into the admission seam
- `COO/controller/**` only where the live freeze path must call the admission seam or persist resulting admission-state truth
- `COO/cto-admission/**` for the live adapter, artifact persistence helpers, state/status derivation, KPI accounting, and minimal explicit decision update path
- `COO/requirements-gathering/contracts/**` only where the live finalized requirement contract needs narrow extension for the admission handoff or persisted status
- tightly scoped tests for the live finalized-requirement to admission route
- `docs/phase1/coo-freeze-to-cto-admission-wiring/**` for slice-local contract, context, and completion artifacts

3. Required Deliverables

- Live finalized-requirement to CTO-admission adapter or wiring path
- Deterministic persistence of:
  - `docs/phase1/<feature-slug>/cto-admission-request.json`
  - `docs/phase1/<feature-slug>/cto-admission-decision.template.json`
  - `docs/phase1/<feature-slug>/cto-admission-summary.md`
- Explicit persisted admission status model using:
  - `admission_not_started`
  - `admission_build_failed`
  - `admission_pending_decision`
  - `admission_admitted`
  - `admission_deferred`
  - `admission_blocked`
- Durable COO-owned state that records artifact paths and admission lifecycle facts
- Minimal explicit decision-update path for `admit`, `defer`, and `block`
- Proof tests for build-failed, pending-decision, blocked, deferred, and admitted paths
- Truthful `context.md` and `completion-summary.md`

4. Allowed Edits

- `COO/cto-admission/**`
- `COO/requirements-gathering/live/**`
- `COO/requirements-gathering/contracts/**`
- `COO/controller/**` only where the live freeze path must call the admission seam
- `docs/phase1/coo-freeze-to-cto-admission-wiring/**`
- tightly scoped tests for the above

5. Forbidden Edits

- implement-plan changes
- review-cycle changes
- merge-queue changes
- unrelated COO classifier redesign
- broad Brain redesign
- queue engine or scheduler buildout
- edits to other slice folders

6. Acceptance Gates

KPI Applicability: required
KPI Route / Touched Path: `COO/requirements-gathering/live/** -> COO/controller/** admission seam -> COO/cto-admission/** -> docs/phase1/<feature-slug>/cto-admission-*` plus durable COO-owned admission state persistence for status, artifact paths, lifecycle timestamps, and KPI facts.
KPI Raw-Truth Source: the live finalized requirement artifact, the persisted CTO-admission artifacts under the deterministic feature root, and the durable COO-owned admission state written by this slice.
KPI Coverage / Proof: targeted tests must prove build-failed, pending-decision, admitted, deferred, and blocked outcomes, deterministic artifact persistence and parseability, KPI counter updates, latency bucket accounting, admission status write completeness, requirement-to-artifact parity, and production/proof partition isolation.
KPI Production / Proof Partition: production uses the live finalized requirement artifact and the real deterministic feature-root artifact path; proof inputs use isolated fixtures, temp roots, or proof-specific paths that must not be counted as production truth.
KPI Non-Applicability Rationale: None. This slice touches a real production COO handoff route, so KPI applicability is required.
KPI Exception Owner: None.
KPI Exception Expiry: None.
KPI Exception Production Status: None.
KPI Compensating Control: None.

Machine Verification Plan
- run targeted tests for the live finalized-requirement to admission route and decision update path
- validate generated JSON artifacts parse cleanly
- validate artifact persistence under the correct feature root
- validate persisted admission statuses for build_failed, pending_decision, admitted, deferred, and blocked
- validate KPI counters, latency buckets, parity, and partition isolation for production and proof inputs

Human Verification Plan
- Required: false
- Reason: this slice wires an internal technical handoff seam and durable state model, not a new human-facing route

7. Observability / Audit

- The slice must make admission-build failures visible and auditable instead of silently swallowing them.
- The slice must keep `packet built successfully` distinct from final CTO decision states.
- `decision=null` in the persisted decision template must map to `admission_pending_decision`, not `admission_admitted`.
- KPI and audit evidence must cover:
  - `finalized_requirement_to_admission_latency_ms` with p50, p95, p99
  - slow handoff buckets over 1s, 10s, and 60s
  - `finalized_requirement_handoff_count`
  - `admission_artifact_build_success_count`
  - `admission_artifact_build_failed_count`
  - `admission_pending_decision_count`
  - `admission_admitted_count`
  - `admission_deferred_count`
  - `admission_blocked_count`
  - `admission_artifact_persist_failure_count`
  - `requirement_to_admission_artifact_parity_count`
  - `admission_status_write_completeness_rate`
- Proof artifacts and tests must make machine verification status, human verification requirement, review-cycle status, and merge/worktree state visible truthfully.

8. Dependencies / Constraints

- Use the real finalized requirement artifact from the live COO freeze path; do not re-invent a parallel input contract.
- Reuse the merged `COO/cto-admission/**` packet builder rather than rebuilding admission artifact generation.
- Keep the change narrow and additive; do not build a CTO queue manager, scheduler, or downstream implement-plan automation.
- Persist lifecycle truth explicitly; do not infer final admission from packet-builder output alone.
- Respect production/proof partitioning so proof traffic does not contaminate production KPI truth.

9. Non-Goals

- full CTO queue manager
- automatic downstream implement-plan spawn
- technical priority engine
- full design/planning/setup-analysis subphase buildout
- CEO-facing status surface in this slice

10. Source Authorities

- `docs/phase1/coo-freeze-to-cto-admission-wiring/README.md`
- `docs/phase1/coo-freeze-to-cto-admission-wiring/context.md`
- `docs/phase1/coo-cto-admission-packet-builder/context.md`
- current `COO/cto-admission/**` implementation
- current live finalized requirement freeze path under `COO/requirements-gathering/live/**`
