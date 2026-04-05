# coo-live-executive-status-wiring

## Objective
Rebaseline the existing live-status slice into a bounded Phase 1 COO operator that is:
- company-first
- evidence-first
- Brain-backed
- investigation-capable
- trust-aware
- CEO-facing in language

This slice does not restart the COO architecture. It extends the stabilized COO runtime and the existing live executive-status foundation.

## Why This Slice Exists
- Wiring the briefing package into `/status` was necessary, but not sufficient.
- The CEO needs a COO that cross-checks evidence before briefing upward, not a surface-value reporter.
- Phase 1 still needs a company-level operating table, anomaly investigation, and bounded trust judgment without widening into a later-phase autonomous COO.

## Rebased Product Contract
This slice now owns the bounded Phase 1 COO status route that:
- gathers evidence from workspace reality, canonical lifecycle artifacts, Brain, and supporting docs before concluding
- cross-checks suspicious surfaced facts instead of repeating them raw
- investigates whether anomalies are acceptable legacy gaps, suspicious, contradicted, or not provable
- maintains a lightweight derived operating table for active decisions, risks, blocked handoffs, recurring issues, and CEO-attention items
- maintains a bounded derived trust layer for workers, components, and routes
- records deep-audit findings, trust changes, and tracked COO issues through Brain-backed runtime writes
- fails closed when Brain is unavailable

## Current Runtime Responsibilities

### 1. Live executive brief wiring
- the merged `COO/briefing/**` package is wired into the real COO runtime
- the internal executive brief still keeps the 4 executive sections as derived operating truth
- the default live CEO-facing surface now freezes the currently approved company-first contract:
  - opening summary
  - optional `**Delivery snapshot:**`
  - optional `**Recent landings:**`
  - `Issues That Need Your Attention`
  - `On The Table`
  - `In Motion`
  - recommendation sentence plus final focus options
- the live CEO-facing surface uses a strict evidence pack plus the COO model for final wording rather than a hardcoded prose template
- the live route validates that contract after model rendering and falls back deterministically if the model drifts outside it

### 2. Evidence gathering and cross-checking
- gathers evidence from:
  - direct workspace/thread reality
  - finalized requirement truth
  - CTO-admission truth when present
  - implement-plan truth
  - git comparison since the previous COO status update
- classifies claims as:
  - `direct_source`
  - `derived_from_sources`
  - `fallback_missing_source`
  - `ambiguous`
  - `unavailable`
- does not collapse missing source into empty state

### 3. Investigation and anomaly handling
- suspicious facts are investigated before briefing upward
- example: `0 review cycles` is interpreted against route timing and slice-folder governance evidence
- elapsed lifecycle timestamps are never flattened into active implementation time unless proven
- git-touched feature-slice work missing from the current COO surface raises a red flag

### 4. Company operating table
- the route is company-first by default
- current thread is shown as context, not as the whole answer
- shaping, awaiting decision, admitted, blocked, in motion, next, and tracked COO issues are derived from evidence rather than hand-maintained as primary truth
- tracked COO issues also carry a prepared handoff id and task summary so the COO can move straight into implement-plan after approval without reopening the same investigation

### 5. Deep audit and trust
- first run performs a deep audit when no valid baseline exists
- later deep audits trigger on bounded signals such as suspicious findings, git red flags, staleness pressure, and trust transitions
- trust applies to workers, components, and routes
- trust only changes how much suspicion/checking pressure the COO applies; it never overrides stronger evidence
- nothing is exempt from spot checks or later deep audits

### 6. Brain hard-stop rule
- Brain is the primary durable memory for this rebased COO path
- if Brain is unavailable, the COO must hard stop
- no warning-only degraded status, trust, or audit conclusion is allowed on the rebased path

## Evidence Hierarchy
When sources disagree, trust in this order:
1. direct workspace reality
2. canonical lifecycle artifacts
3. docs and Brain
4. worker claims, summaries, and KPI surfaces
5. derived trust ledger

The trust ledger guides suspicion. It never outranks stronger evidence.

## Allowed Edits
- `COO/briefing/**`
- `COO/controller/**`
- `COO/requirements-gathering/**` only for additive read-shape helpers
- `docs/phase1/coo-live-executive-status-wiring/**`
- tightly scoped tests for the above

## Forbidden Edits
- implement-plan changes
- review-cycle changes
- merge-queue changes
- queue scheduler buildout
- unrelated onion redesign
- broad memory-engine redesign
- edits to other slice folders

## Required Deliverables
- rebased runtime implementation on top of the existing slice
- company-first CEO-facing `/status` and status-only startup surface
- derived operating-table layer
- bounded deep-audit / trust / tracked-issue layer
- Brain-backed runtime persistence for rebased COO findings and trust changes
- Brain hard-stop enforcement
- updated COO prompt and Phase 1 wording
- proof/tests
- truthful `completion-summary.md`

## Status Surface Rules
- keep the output business-level
- keep the approved live CEO-facing contract visible and stable
- preserve graceful degradation for partial source families
- make provenance, freshness, and confidence visible enough for leadership judgment
- let the COO model formulate the briefing naturally from strict evidence rather than slot-filled prose
- blocked items must surface in `Issues`
- unresolved shaping / governance / decision items must surface in `On The Table`
- active live work must surface in `In Motion`
- concise forward moves must surface through the recommendation sentence and final focus options
- trust and audit details should stay exception-first, not a permanent dump
- the internal 4-section brief and operational context remain available as derived route truth even though the default live CEO-facing surface does not print a separate footer

## KPI / Audit Matrix
Required telemetry:
- `live_exec_brief_build_latency_ms`
- `live_exec_brief_render_success_count`
- `live_exec_brief_render_failure_count`
- `live_status_invocation_count`
- `live_source_adapter_missing_source_count`
- `issues_visibility_parity_count`
- `table_visibility_parity_count`
- `in_motion_visibility_parity_count`
- `next_visibility_parity_count`
- `live_source_freshness_age_ms`

Audit rules:
- executive brief, operating table, baseline, and trust stay derived-only
- missing-source cases stay distinguishable from empty state
- blocked or attention-worthy items cannot disappear silently
- no fake Brain-backed conclusion is allowed
- tracked COO issues and ready handoffs must survive restart through Brain-backed writes plus local derived continuity

## Human Verification
Required: true

Test from the feature worktree:
```bash
./adf.sh -- --status --scope-path assafyavnai/adf/phase1
```

Verify:
- the COO speaks in business language
- the approved live CEO-facing sections are present:
  - `Issues That Need Your Attention`
  - `On The Table`
  - `In Motion`
  - recommendation sentence plus focus options
- landed items are easy to scan
- missing or fallback evidence stays visible
- Brain hard-stop behavior is explicit if Brain is unavailable
- any git-backed dropped-context red flag is easy to understand

## Change Request 01
Previously approved in this slice:
- keep the internal 4-section brief as parity truth
- allow a scan-friendly live executive render around that brief
- add a bounded git/status window for dropped-context detection

## Change Request 02
Rebased in this slice:
- the COO live-status route is no longer just status compression
- it now owns bounded situational awareness, anomaly investigation, operating-table continuity, trust-aware briefing, and Brain hard-stop enforcement
- this remains bounded to Phase 1 COO governance and does not create a second canonical company database

## Non-Goals
- no architecture restart
- no second canonical company truth system
- no full autonomous COO
- no auto-launch into execution
- no queue scheduler buildout
- no broad company staffing/department expansion
- no broad dashboard product work

## Execution Route
- implement-plan prepares or reuses the dedicated feature worktree
- implementation happens on the feature branch in that worktree
- machine verification passes
- human verification passes
- review-cycle reruns on the rebased head
- merge-queue lands the approved branch
- only then can the slice be marked complete truthfully
