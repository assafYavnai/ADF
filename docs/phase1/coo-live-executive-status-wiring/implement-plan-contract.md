1. Implementation Objective

Wire the merged `COO/briefing/**` and `COO/table/**` read models into the live COO runtime so the CEO can request one trustworthy business-level status surface that answers what needs attention, what is on the table, what is moving, and what is next from current runtime truth.

2. Slice Scope

- `COO/briefing/**` for the live source-facts adapter, renderer-facing wiring, and KPI additions needed for the live executive brief surface
- `COO/table/**` only for additive exports, helpers, or KPI alignment needed to consume the merged table read model as the runtime table substrate
- `COO/controller/**` only where the startup summary and/or status command must call the live status path
- `COO/requirements-gathering/**` only for read-shape helpers or additive adapters needed to read live shaping truth
- tightly scoped tests for the live source adapter, live rendering path, KPI evidence, and proof/production partition handling
- `docs/phase1/coo-live-executive-status-wiring/**` for contract, context, brief, and completion artifacts

3. Required Deliverables

- a live `BriefSourceFacts` adapter for the COO runtime
- a runtime status command and/or startup summary that renders the executive brief from live COO state
- live consumption of the merged `COO/table/**` package instead of controller-local table duplication
- graceful handling for partial or missing source families without mutating source truth
- KPI and audit coverage for:
  - `live_exec_brief_build_latency_ms` with p50, p95, p99
  - slow status-build buckets over 1s, 10s, and 60s
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

- `C:/ADF/COO/briefing/**`
- `C:/ADF/COO/table/**` only for additive integration or KPI-alignment changes
- `C:/ADF/COO/controller/**` where the live status surface must be wired
- `C:/ADF/COO/requirements-gathering/**` only for read-shape helpers or additive adapters
- `C:/ADF/docs/phase1/coo-live-executive-status-wiring/**`
- tightly scoped tests for the above

5. Forbidden Edits

- no implement-plan changes
- no review-cycle changes
- no merge-queue changes
- no queue scheduler buildout
- no second table model or queue model
- no unrelated onion-behavior redesign
- no broad memory-engine redesign
- no edits to other slice folders

6. Acceptance Gates

1. The COO runtime can render the executive brief from live data.
2. The live status surface consumes `COO/table/**` as the table substrate instead of reimplementing queue logic inside the controller.
3. The 4 sections always appear in this order:
   - `Issues That Need Your Attention`
   - `On The Table`
   - `In Motion`
   - `What's Next`
4. The surface stays business-level and concise.
5. Blocked items surface concretely in `Issues That Need Your Attention`.
6. Missing source families degrade gracefully instead of crashing the surface.
7. Tests prove rendering across mixed live-state scenarios and prove the path stays derived-only.

## KPI Applicability

KPI Applicability: required
KPI Route / Touched Path: `COO/controller CLI startup summary and status command -> live source-facts adapter -> COO/briefing build/render path -> COO/table-derived table substrate -> shared telemetry emission`
KPI Raw-Truth Source: shared telemetry rows emitted by the real COO CLI/status runtime path for production and proof partitions, plus targeted proof tests for source adaptation, parity, and derived-only behavior
KPI Coverage / Proof: real COO CLI/status-entry proof, targeted rendering proof for full-source, partial-source, and empty-source cases, parity and missing-source counter proof, freshness-age proof, and production/proof partition coexistence proof
KPI Production / Proof Partition: production invocations emit production-partition telemetry; proof and test invocations emit proof-partition telemetry; closeout evidence keeps proof rows distinct from production truth

## Vision / Phase 1 / Master-Plan / Gap-Closure Compatibility

Vision Compatibility: Directly advances the leadership-surface goal by giving the CEO a live business-readable COO status answer instead of a raw internal dump.
Phase 1 Compatibility: This is core Phase 1 COO surface work that connects existing derived models to the active runtime without widening into later-company functions.
Master-Plan Compatibility: Closes the live status gap that still separates merged read-model packages from the real COO route and keeps the work bounded to the active implementation chain.
Current Gap-Closure Compatibility: Directly closes Gap A and also closes the runtime half of Gap C by consuming the merged company-table read model as part of the live surface.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: The executive brief and company-table packages already exist on main, but the runtime still lacks the live surface that the Phase 1 story requires. This slice wires the existing truth surfaces into the real COO route instead of building new speculative components.

## Machine Verification Plan

- run targeted tests for the live source adapter and status rendering path
- validate rendering with full sources, partial sources, and empty sources
- validate parity counters, missing-source counters, and freshness metrics
- validate that brief generation and table generation do not mutate any source truth
- validate production/proof partition handling and coexistence proof
- validate that the status surface consumes normalized table truth instead of duplicating table logic in the controller
- run `git diff --check` on the changed source set

## Human Verification Plan

- Required: true
- Reason: this slice creates a real CEO-facing runtime surface and should be checked for usefulness and readability
- IMPLEMENTATION COMPLETE AND READY FOR YOUR TESTING
- Executive summary of implemented behavior:
  - the COO startup/status surface renders a live 4-section executive brief derived from active threads, finalized requirements, CTO-admission truth when present, and implement-plan truth when present
  - `On The Table` is driven by the merged company-table read model, not controller-local duplication
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
- the table package remains derived-only and must not write back into source truth
- missing-source cases must remain distinguishable from empty-state cases
- blocked or attention-worthy items must not be silently dropped
- parity mismatches must be visible and countable through the required KPI counters
- the runtime must make it visible whether the table source family was available, empty, or missing

8. Dependencies / Constraints

- read from active COO thread/onion state when present
- read finalized requirement artifacts when present
- read CTO-admission artifacts when present, but degrade gracefully if they do not exist yet
- read implement-plan feature truth when present
- consume the merged `COO/table/**` package instead of reimplementing a second queue model
- keep the output business-level and concise rather than dumping raw state
- keep the live briefing and table layers derived-only
- do not widen into queue ownership, broad onion redesign, or memory-engine redesign

9. Non-Goals

- no implement-plan, review-cycle, or merge-queue redesign
- no queue scheduler buildout
- no unrelated onion-behavior redesign
- no broad memory-engine redesign
- no CTO-admission artifact generation in this slice
- no duplicate standalone table package

10. Source Authorities

- `C:/ADF/docs/phase1/coo-live-executive-status-wiring/README.md`
- `C:/ADF/docs/phase1/coo-live-executive-status-wiring/context.md`
- `C:/ADF/docs/phase1/company-table-queue-read-model/README.md`
- `C:/ADF/docs/phase1/coo-executive-brief-read-model/completion-summary.md`
- `C:/ADF/docs/phase1/coo-freeze-to-cto-admission-wiring/completion-summary.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`

11. Implementor Defaults

- Preferred Worker Provider: `claude`
- Preferred Worker Runtime: `claude_code_exec`
- Preferred Worker Access Mode: `claude_code_skip_permissions`
- Preferred Worker Model: `claude-opus-4-6`
- Preferred Implementor Model: `claude-opus-4-6`
- Preferred Throttle: `max`
- Preferred Reasoning Effort: not separately configured for this Claude route

12. Closeout Rules

- run machine verification before review handoff
- use review-cycle after implementation
- human verification is mandatory before merge
- commit and push feature-branch changes before merge-queue handoff
- do not mark complete until review closure, human approval, and merge-queue closeout succeed truthfully
