1. Implementation Objective

Rework the COO live `/status` route so the default CEO-facing brief is a compact executive synthesis instead of a raw operational dump, while preserving evidence truth, active-slice visibility, and the bounded Phase 1 COO behavior already approved for this slice.

2. Slice Scope

- `COO/briefing/status-render-agent.ts`
- `COO/briefing/live-source-adapter.ts`
- `COO/controller/executive-status.ts`
- `COO/intelligence/prompt.md`
- tightly scoped tests for the same route
- `docs/phase1/coo-live-executive-status-wiring/**`

3. Required Deliverables

- CEO-facing `/status` brief with aggregate-first rendering
- issue grouping by systemic root cause instead of per-slice repetition
- short context-evidence lines for decision issues
- a detail-drill-down option in final focus choices
- truthful visibility for active plan-only slices so they do not disappear from COO status
- updated slice docs and review artifacts

4. Allowed Edits

- `COO/briefing/**`
- `COO/controller/**`
- `COO/intelligence/**`
- `docs/phase1/coo-live-executive-status-wiring/**`
- route-local tests that verify this behavior

5. Forbidden Edits

- `skills/implement-plan/**`
- `skills/review-cycle/**`
- `skills/merge-queue/**`
- unrelated slice folders
- broad COO architecture restarts
- memory-engine redesign

6. Acceptance Gates

KPI Applicability: required

KPI Route / Touched Path: `COO/controller/executive-status.ts`, `COO/briefing/status-render-agent.ts`, `COO/briefing/live-source-adapter.ts`

KPI Raw-Truth Source: live COO status output, route-local parity checks, and the route-local tests that exercise grouped issues, focus options, and active-slice visibility

KPI Coverage / Proof: prove that the default CEO brief groups duplicate findings, includes evidence-bridge counts, offers a detail option when hidden detail exists, and does not hide the active governed slice from COO status

KPI Production / Proof Partition: proof-only from the feature worktree plus route-local tests and a live `/status` smoke render from the worktree

KPI Non-Applicability Rationale: None.

KPI Exception Owner: None.

KPI Exception Expiry: None.

KPI Exception Production Status: None.

KPI Compensating Control: None.

Vision Compatibility: compatible. This keeps the COO as the company operating surface while making its CEO brief more decision-ready and more truthful about live work.

Phase 1 Compatibility: compatible. The slice stays inside the bounded Phase 1 COO runtime and improves briefing quality without widening into later-company autonomy.

Master-Plan Compatibility: compatible. The work strengthens the real COO management seam instead of bypassing the approved runtime route.

Current Gap-Closure Compatibility: compatible. The fix closes the current gap where the live CEO brief is verbose, repetitive, and incomplete about active governed work.

Later-Company Check: no

Compatibility Decision: compatible

Compatibility Evidence: the route remains derived-only, evidence-first, and CEO-facing; the change compresses display while preserving governed truth and active-slice visibility.

post_send_to_review: true

review_until_complete: true

review_max_cycles: 3

Machine Verification Plan:
- `node --check COO/briefing/status-render-agent.ts`
- `node --check COO/briefing/live-source-adapter.ts`
- `node --check COO/controller/executive-status.ts`
- `npm.cmd run build` from `COO/`
- `npx.cmd tsx COO/controller/executive-status.test.ts`
- `./adf.sh -- --status --scope-path assafyavnai/adf/phase1` from the feature worktree

Human Verification Plan:
- Required: true
- IMPLEMENTATION COMPLETE AND READY FOR YOUR TESTING
- Executive summary of implemented behavior:
  - the CEO-facing `/status` brief now renders as a compact executive synthesis instead of the old operational dump
  - duplicate KPI findings are grouped into one systemic decision issue with context-evidence counts
  - active plan-only governed slices stay visible in COO status instead of disappearing when only implement-plan truth is available
- IMPLEMENTATION IS READY FOR TESTING
- Exact testing sequence:
  - from the feature worktree run `./adf.sh -- --status --scope-path assafyavnai/adf/phase1`
  - read only the CEO-facing brief, not the raw evidence pack
  - confirm the brief shows `Bottom line`, `Delivery health`, `Issues that need a decision`, `Parked / waiting`, and `Recommendation` in that order
  - confirm the main body shows at most two decision issues
  - confirm duplicate KPI findings are grouped into one systemic issue
  - confirm each decision issue includes a short evidence-bridge count
  - confirm the final focus options include `Show detailed breakdown` when hidden detail exists
  - confirm the active governed slice is not silently dropped from COO status
- Expected results:
  - the brief starts with `Bottom line` and `Delivery health`
  - the main body shows at most 2 decision issues
  - duplicate KPI findings are grouped into one systemic issue
  - each decision issue includes a short evidence-bridge count
  - the final focus options include a detail-drill-down option when hidden detail exists
  - the active governed slice is not silently dropped from COO status
- Evidence to report back:
  - paste the rendered brief
  - state whether it is scan-friendly and decision-ready
- Response contract:
  - `APPROVED`
  - `REJECTED: <comments>`

7. Observability / Audit

- Preserve existing live-status parity telemetry
- Keep evidence-based issue grouping deterministic enough that the fallback renderer tells the same story as the model-backed renderer
- Do not hide active governed work just because only implement-plan truth is available

8. Dependencies / Constraints

- Brain unavailability must still fail closed on the rebased COO route
- The CEO-facing brief must stay data-driven; no slice-specific hardcoded report text
- The deterministic fallback must match the same executive contract as the model-backed path
- The fix must stay bounded to this route and this slice

9. Non-Goals

- repairing the implement-plan KPI closeout bug itself
- changing review-cycle or merge-queue behavior
- redesigning unrelated COO surfaces
- building a second canonical operating table outside the current derived route

10. Source Authorities

- `docs/phase1/coo-live-executive-status-wiring/README.md`
- `docs/phase1/coo-live-executive-status-wiring/context.md`
- `docs/phase1/coo-live-executive-status-wiring/cycle-07/audit-findings.md`
- `docs/phase1/coo-live-executive-status-wiring/cycle-07/fix-plan.md`
- `COO/briefing/status-render-agent.ts`
- `COO/briefing/live-source-adapter.ts`
- `COO/controller/executive-status.ts`
