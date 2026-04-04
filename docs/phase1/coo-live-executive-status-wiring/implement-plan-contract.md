1. Implementation Objective

Wire the merged `COO/briefing/**` executive-brief package into the live COO runtime so the CEO can get a real business-level status surface that answers what needs attention, what is on the table, what is moving, and what is next from current live source truth.

2. Slice Scope

- `COO/briefing/**` for the live source-facts adapter, renderer-facing wiring, and KPI additions needed for the live executive brief surface
- `COO/controller/**` only where the startup summary and/or status command must call the live executive brief path
- `COO/requirements-gathering/**` only for read-shape helpers or additive adapters needed to read live shaping truth
- tightly scoped tests for the live source adapter, live rendering path, KPI evidence, and proof/production partition handling
- `docs/phase1/coo-live-executive-status-wiring/**` for contract, context, brief, and completion artifacts

3. Required Deliverables

- a live `BriefSourceFacts` adapter for the COO runtime
- a real startup summary and/or status surface that renders the executive brief from live COO state
- graceful handling for partial or missing source families without mutating source truth
- KPI and audit coverage for:
  - `live_exec_brief_build_latency_ms` with p50 / p95 / p99
  - slow status-build buckets over 1s / 10s / 60s
  - `live_exec_brief_render_success_count`
  - `live_exec_brief_render_failure_count`
  - `live_status_invocation_count`
  - `live_source_adapter_missing_source_count`
  - `issues_visibility_parity_count`
  - `table_visibility_parity_count`
  - `in_motion_visibility_parity_count`
  - `next_visibility_parity_count`
  - `live_source_freshness_age_ms`
  - partition/isolation proof when production and proof inputs coexist
- proof tests for the 4-section live rendering path and derived-only behavior
- `context.md` updates for meaningful design decisions
- `completion-summary.md`

4. Allowed Edits

- `COO/briefing/**`
- `COO/controller/**` where the live status surface must be wired
- `COO/requirements-gathering/**` only for read-shape helpers or additive adapters
- `docs/phase1/coo-live-executive-status-wiring/**`
- tightly scoped tests for the above

5. Forbidden Edits

- implement-plan changes
- review-cycle changes
- merge-queue changes
- queue scheduler buildout
- unrelated onion-behavior redesign
- broad memory-engine redesign
- edits to other slice folders

6. Acceptance Gates

KPI Applicability: required

KPI Route / Touched Path: `CLI/startup summary/status surface -> COO/controller live status wiring -> COO/briefing live source-facts adapter -> executive brief renderer -> KPI emission`

KPI Raw-Truth Source: shared telemetry rows emitted by the real COO CLI/status path for production and proof partitions
- shared telemetry rows emitted by the real COO CLI/status path for production and proof partitions
- deterministic targeted tests that prove source adaptation, rendering parity, and derived-only behavior

KPI Coverage / Proof: real COO CLI/status entry proof plus targeted source-adapter/rendering proof
- prove the live status surface through the real COO CLI/status entry surface and the live startup/status rendering path
- prove full-source, partial-source, and empty-source rendering behavior
- prove visibility parity counters and missing-source counters
- prove latency percentile and slow-bucket reporting
- prove freshness-age reporting
- prove production/proof isolation when proof inputs coexist with production inputs

KPI Production / Proof Partition: production invocations emit production-partition telemetry and proof/test invocations emit proof-partition telemetry
- production invocations emit production-partition telemetry
- proof and test invocations emit proof-partition telemetry
- rollups and closeout evidence keep proof rows distinct from production truth

KPI Non-Applicability Rationale: not applicable because KPI instrumentation is required for this live CEO-facing runtime surface

KPI Exception Owner: none

KPI Exception Expiry: none

KPI Exception Production Status: none

KPI Compensating Control: none

Machine Verification Plan:
- run targeted tests for the live source adapter and status rendering path
- validate rendering with full sources, partial sources, and empty sources
- validate parity counters, missing-source counters, and freshness metrics
- validate that brief generation does not mutate any source truth
- validate production/proof partition handling and coexistence proof

Human Verification Plan:
- Required: true
- Reason: this slice creates a real CEO-facing runtime surface and should be checked for usefulness and readability
- IMPLEMENTATION COMPLETE AND READY FOR YOUR TESTING
- Executive summary of implemented behavior:
  - the COO startup/status surface renders a live 4-section executive brief derived from active threads, finalized requirements, CTO-admission truth when present, and implement-plan truth when present
  - missing source families degrade gracefully and remain visibly distinguishable from empty-state results
- IMPLEMENTATION IS READY FOR TESTING
- Exact testing sequence:
  - launch the COO through the normal CLI path
  - inspect the startup summary and the status command output
  - confirm the four sections appear in this order: `Issues That Need Your Attention`, `On The Table`, `In Motion`, `What's Next`
  - confirm blocked work appears in `Issues`, unresolved shaping or awaiting-decision work appears in `On The Table`, active live work appears in `In Motion`, and concise forward-looking work appears in `What's Next`
  - confirm the output stays business-level and does not dump raw state or JSON
  - confirm missing CTO-admission truth does not break the surface and that shaping plus implementation truth still render cleanly
- Expected results:
  - the brief is readable, concise, and useful for CEO triage
  - the four sections stay ordered and populated appropriately for the live state
  - the surface remains stable when one or more source families are missing
- Evidence to report back:
  - whether the brief was understandable and decision-useful
  - any section that felt misleading, noisy, or incomplete
  - whether any blocked item, table item, in-motion item, or next-step item was missing or misplaced
- Response contract:
  - `APPROVED`
  - `REJECTED: <comments>`
- IMPLEMENTATION COMPLETE AND READY FOR YOUR TESTING

7. Observability / Audit

- the executive brief remains derived-only and must not write back into source truth
- missing-source cases must remain distinguishable from empty-state cases
- blocked or attention-worthy items must not be silently dropped
- parity mismatches must be visible and countable through the required KPI counters
- review-cycle status, machine verification status, and human verification status must remain truthful in slice artifacts
- worktree state, merge status, and target-sync status must remain truthful in feature state and completion artifacts

8. Dependencies / Constraints

- read from active COO thread/onion state when present
- read finalized requirement artifacts when present
- read CTO-admission artifacts when present, but degrade gracefully if they do not exist yet
- read implement-plan feature truth when present
- keep the output business-level and concise rather than dumping raw state
- keep the live briefing layer derived-only
- do not widen into queue ownership, broad onion redesign, or memory-engine redesign

9. Non-Goals

- no implement-plan, review-cycle, or merge-queue redesign
- no queue scheduler buildout
- no unrelated onion-behavior redesign
- no broad memory-engine redesign
- no CTO-admission artifact generation in this slice
- no edits to other slice folders

10. Source Authorities

- `C:/ADF/docs/phase1/coo-live-executive-status-wiring/README.md`
- `C:/ADF/docs/phase1/coo-live-executive-status-wiring/context.md`
- `C:/ADF/docs/v0/architecture.md`
- `C:/ADF/docs/v0/kpi-instrumentation-requirement.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
