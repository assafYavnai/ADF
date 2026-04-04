# coo-live-executive-status-wiring

## Target Local Folder
C:/ADF/docs/phase1/coo-live-executive-status-wiring/README.md

## Feature Goal
Wire the merged `COO/briefing/**` executive-brief read model into the live COO runtime so the CEO can get a real business-level status surface that answers what needs attention, what is on the table, what is moving, and what is next.

## Why This Slice Exists Now
- The executive-brief package is merged, but it is still not wired into the active COO runtime, CLI, or controller.
- Phase 1 still lacks a strong live answer to "what is on our table?"
- The user should be able to ask for live COO status without receiving an internal-state dump.

## Requested Scope
Build the live executive/status surface around the merged briefing package.

This slice must:
- create a live source-facts adapter that reads current COO state into `BriefSourceFacts`
- consume at least these source families when present:
  - active COO threads / onion state
  - finalized requirement artifacts
  - CTO-admission artifacts when present
  - implement-plan feature truth when present
- keep the internal 4 briefing sections from live data for parity truth:
  - Issues That Need Your Attention
  - On The Table
  - In Motion
  - What's Next
- keep the internal 4-section brief as derived parity truth, but allow the CEO-facing live surface to normalize that internal brief into a more scan-friendly executive shape when the live route needs stronger provenance/freshness/confidence exposure
- add a bounded status window that records the last COO status update and verifies recent feature-slice activity in git since that window
- expose the live brief through the COO surface:
  - startup summary and/or status command, following existing CLI conventions
- keep the briefing layer derived-only; do not write back into source truth
- degrade gracefully when one source family is missing, instead of failing the whole status surface

## Allowed Edits
- COO/briefing/**
- COO/controller/** where the live status surface must be wired
- COO/requirements-gathering/** only for read-shape helpers or additive adapters
- docs/phase1/coo-live-executive-status-wiring/**
- tightly scoped tests for the above

## Forbidden Edits
- no implement-plan changes
- no review-cycle changes
- no merge-queue changes
- no queue scheduler buildout
- no unrelated onion-behavior redesign
- no broad memory-engine redesign
- no edits to other slice folders

## Required Deliverables
- a live `BriefSourceFacts` adapter for the COO runtime
- a real status/startup surface that renders the executive brief from live state
- a runtime-only last-status-update / git-verification window for the COO live surface
- graceful handling of partial/missing sources
- proof tests for the internal 4-section parity path and the CEO-facing live status window
- context.md
- completion-summary.md

## Status Surface Rules
- the output must stay business-level, not a raw state dump
- the CEO-facing live render must stay scan-friendly instead of collapsing into dense prose or raw section dumps
- every material CEO-facing claim must make provenance, freshness, and confidence visible enough to distinguish direct truth from derived, fallback, ambiguous, or unavailable conclusions
- the COO surface must show the current status update time, the previous status update time when known, and whether git comparison since that prior update is available
- if git shows recent feature-slice activity since the previous COO update and that work is absent from the current surface, the COO must raise a red flag instead of silently dropping it
- blocked items must appear in `Issues That Need Your Attention`
- `On The Table` must include unresolved work that is shaping or awaiting decision
- `In Motion` must reflect active live work
- `What's Next` must stay concise and forward-looking
- if CTO-admission artifacts are not present yet, the surface must still render shaping and implementation truth cleanly

## Production KPI / Audit Matrix Requirements
Define explicit KPIs for this slice:
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

Audit rules:
- the executive brief remains derived-only
- parity mismatches must be visible and countable
- missing-source cases must remain distinguishable from empty-state cases
- the live status surface must not silently drop blocked or attention-worthy items

## Acceptance Gates
- KPI Applicability: required
- KPI Route / Touched Path: `CLI/startup summary/status surface -> COO/controller live status wiring -> COO/briefing live source-facts adapter -> executive brief renderer -> KPI emission`
- KPI Raw-Truth Source: shared telemetry rows emitted by the real COO CLI/status path for production and proof partitions, plus deterministic proof tests for source adaptation/render parity
- KPI Coverage / Proof:
  - prove the live status surface through the real COO CLI/status entry surface and its startup/status rendering path
  - prove full-source, partial-source, and empty-source rendering
  - prove parity counters, missing-source counters, latency buckets, and freshness age reporting
  - prove production/proof isolation when proof inputs coexist with production inputs
- KPI Production / Proof Partition:
  - production invocations must emit production-partition telemetry
  - proof and test invocations must emit proof-partition telemetry
  - rollups and closeout evidence must keep proof truth distinguishable from production truth
- KPI Non-Applicability Rationale: not applicable because KPI instrumentation is required for this live CEO-facing status surface
- KPI Exception Owner: none
- KPI Exception Expiry: none
- KPI Exception Production Status: none
- KPI Compensating Control: none
- the COO runtime can render the executive brief from live data
- the internal 4-section brief remains available in the correct order for parity proof, while the CEO-facing live render may normalize that brief into a more human-scannable shape
- the status surface stays business-level and concise
- blocked items surface concretely in `Issues`
- missing source families degrade gracefully instead of crashing the surface
- tests prove rendering across mixed live-state scenarios

## Machine Verification Plan
- run targeted tests for live source adaptation and status rendering
- validate that the surface works with full sources, partial sources, and empty sources
- validate parity counters and freshness metrics
- validate that no source mutation occurs during brief generation
- validate that the last-status window persists between runs and that git-backed context-drop red flags surface when expected

## Human Verification Plan
- Required: true
- Reason: this slice creates a real CEO-facing runtime surface and should be checked for usefulness and readability
- IMPLEMENTATION COMPLETE AND READY FOR YOUR TESTING
- Executive summary of implemented behavior:
  - the COO startup/status surface renders a live executive update derived from active threads, finalized requirements, CTO-admission truth when present, implement-plan truth when present, and a bounded git comparison against the previous COO status update
  - missing source families degrade gracefully and remain visibly distinguishable from truly empty-state results
- IMPLEMENTATION IS READY FOR TESTING
- Exact testing sequence:
  - run `./adf.sh -- --status --scope-path assafyavnai/adf/phase1` from the feature worktree
  - read the opening paragraph, then the `Status window`, then `What landed`, optional `What is moving`, optional `What stands out`, and `What needs your attention now`
  - if this is the first status run in that worktree, run the same command a second time so the COO has a previous-status baseline to compare against
  - confirm the `Status window` shows:
    - the current COO update time
    - the previous COO update time when available
    - whether the git coverage check is derived from commit history, timestamp fallback, or unavailable
    - whether any red-flag note is raised about recent git-touched feature work missing from the current COO surface
  - confirm each landed item remains easy to scan and includes timing, review count, token cost, key issue, and an evidence note
  - confirm the output stays business-level and does not dump raw state objects or internal field names
  - confirm missing CTO-admission inputs do not break the surface and that shaping/implementation truth still renders cleanly
- Expected results:
  - the surface is readable, concise, and useful for CEO triage
  - the status window makes it clear what time frame the COO checked and whether git-backed context verification succeeded
  - the surface remains stable when some source families are missing
  - the output reflects live runtime truth instead of static fixtures
- Evidence to report back:
  - whether the brief was understandable and decision-useful
  - any section or landed item that felt misleading, noisy, or incomplete
  - whether the status window was understandable and whether it exposed enough provenance for the comparison frame
  - whether any recent git-touched feature work appeared to be missing from the current COO surface
- Response contract:
  - `APPROVED`
  - `REJECTED: <comments>`
- IMPLEMENTATION COMPLETE AND READY FOR YOUR TESTING

## Non-Goals
- no full queue manager
- no CTO admission generation in this slice
- no downstream implementation orchestration changes
- no adaptive personalization engine beyond what is minimally needed for the live surface

## Scope Claim
This slice owns only:
- COO/briefing/**
- the minimum controller/runtime wiring needed for a real live status surface
- docs/phase1/coo-live-executive-status-wiring/**
- tightly scoped tests for the same path

## Execution Route Update
This slice must run through the full governed path:
- implement-plan prepares or reuses the dedicated feature worktree
- implementation runs on the feature branch inside that worktree
- machine verification passes
- review-cycle runs when configured
- human verification runs because this is a real CEO-facing surface
- the approved feature-branch commit is handed to merge-queue
- the slice is marked complete only after merge-queue records merge success truthfully

## Change Request 01 - Evidence-Normalized CEO Surface And Git Verification

Human verification showed that the original live-route plan was too narrow in two ways:
- it assumed the CEO-facing surface could stay as a direct 4-section render
- it did not verify whether context had drifted since the previous COO status update

This slice now carries the following bounded deviation:
- the internal 4-section brief remains the parity and audit truth
- the live CEO-facing surface uses a scan-friendly executive shape with an explicit `Status window`
- the controller compares recent git activity since the previous COO status update and raises a red flag when a recently touched feature slice is missing from the current COO surface
- the comparison baseline is stored only in runtime state under `.codex/runtime/`; the broader context-gathering tool remains unchanged in this slice

## Commit Rules
- commit only slice-local changes
- push only the feature-branch changes produced by implement-plan
- do not manually merge to main or master
- final completion is allowed only after merge-queue lands the approved commit and implement-plan marks the slice complete truthfully
