1. Failure Classes Closed

- CEO brief contract drift is closed on the live route. The default COO `/status` output now renders as an aggregate-first executive brief instead of a raw operational dump.
- Duplicate systemic KPI findings are closed as a rendering failure class. Repeated per-slice KPI gap findings now collapse into one bounded decision issue with an evidence bridge derived from counts.
- Active governed slice visibility is closed on the status route. Open implement-plan work that is relevant to the current scope no longer disappears from the executive brief when it is not yet executing.
- Non-KPI issue classification drift is closed. Review-evidence gaps and other route-local issue classes remain distinct instead of being collapsed into the KPI bucket by global company state.

2. Route Contracts Now Enforced

- Claimed supported route: `CLI /status -> printExecutiveStatus -> buildLiveExecutiveStatus -> buildStatusEvidencePack -> renderStatusWithAgent -> ensureSupportedLiveStatusBody`, with deterministic fallback routed through the same executive contract.
- End-to-end invariant: the default CEO-facing COO brief must stay bounded to `Bottom line -> Delivery health -> Issues that need a decision -> Parked / waiting -> Recommendation`, with a compact decision-oriented tone and no raw per-slice issue wall.
- Grouping invariant: systemic issues are grouped by root cause and rendered once with a short evidence bridge such as `X of Y recent landings are affected`, rather than repeated once per slice.
- Visibility invariant: active governed slices in the current scope remain visible in the brief even when they are not currently executing, so the COO surface does not silently miss present work.
- Classification invariant: route-local issue classes remain distinct; global KPI background state cannot relabel unrelated review-governance issues.
- Focus-option invariant: the brief offers recommended next actions plus `Show detailed breakdown` when hidden detail exists, without hardcoding specific issue titles, counts, or slice names.
- KPI Applicability: required.
- KPI Proof: the live `/status` smoke now shows a bounded executive brief with one grouped cost issue, a separate review-evidence issue, visible parked active-slice context, and a `Show detailed breakdown` option.

3. Files Changed And Why

- `COO/briefing/status-render-agent.ts`
  - adds the executive synthesis layer, grouping/ranking logic, route-local issue classification fix, and the bounded CEO-facing output contract used by both live and fallback rendering
- `COO/briefing/live-source-adapter.ts`
  - keeps relevant open implement-plan slices visible in the source facts so active governed work cannot disappear from the brief
- `COO/briefing/status-governance.ts`
  - strengthens governed-context handling that feeds grouped and visibility-aware issue synthesis
- `COO/controller/executive-status.ts`
  - wires the live controller path through the new executive contract and preserves parity across live rendering and supported fallback behavior
- `COO/controller/status-window.ts`
  - adds current-worktree visibility checks so present slice activity can be surfaced truthfully
- `COO/controller/executive-status.test.ts`
  - adds route-level regression proof for grouped systemic issues, distinct non-KPI classification, and the bounded executive brief contract
- `COO/intelligence/prompt.md`
  - updates the LLM rendering instructions so the model-backed route follows the same executive contract instead of drifting back to an operational field report
- `docs/phase1/coo-live-executive-status-wiring/cycle-07/*`
  - records the governed findings, plan, live proof, reviewer closure, and this fix report for the cycle-07 closeout

4. Sibling Sites Checked

- `COO/briefing/status-render-agent.ts`
- `COO/briefing/live-source-adapter.ts`
- `COO/briefing/status-governance.ts`
- `COO/controller/executive-status.ts`
- `COO/controller/status-window.ts`
- `COO/controller/executive-status.test.ts`
- `COO/intelligence/prompt.md`
- `docs/phase1/coo-live-executive-status-wiring/cycle-07/live-status-output.md`

5. Proof Of Closure

- TypeScript syntax checks passed for the touched route files:
  - `node --check COO/briefing/status-render-agent.ts`
  - `node --check COO/briefing/live-source-adapter.ts`
  - `node --check COO/controller/executive-status.ts`
- Product build passed:
  - `cmd /c npm.cmd run build` from `COO/`
- Targeted route tests passed:
  - `tsx --test controller/executive-status.test.ts`
- Live route smoke passed and was saved to `docs/phase1/coo-live-executive-status-wiring/cycle-07/live-status-output.md`
- Live proof shows the intended closure conditions:
  - the brief opens with a short bottom line
  - delivery health is aggregate-only rather than a recent-landings dump
  - duplicate KPI findings are grouped into one systemic `Cost auditability gap`
  - the non-KPI `Review evidence gap` remains distinct
  - `Coo Live Executive Status Wiring` remains visible under `Parked / waiting`
  - `Show detailed breakdown` is offered as a drill-down option instead of forcing weeds into the default brief

6. Remaining Debt / Non-Goals

- This cycle does not fix the underlying implement-plan KPI closeout persistence bug; it only reports that route problem more coherently and truthfully in the COO brief.
- This cycle does not restore missing review evidence for previously landed slices; it keeps that issue visible as a separate decision item.
- This cycle does not widen the COO surface into a hardcoded reporting template; the brief remains derived from live governed facts and must adapt as counts and sources change over time.
- Merge and final slice closeout are still outside this artifact and must be completed through the governed `review-cycle` and `implement-plan` route.

7. Next Cycle Starting Point

- None expected if cycle-07 closeout is accepted. The next governed step should be review-cycle state closeout, then normal feature-branch commit/push, then merge/implement-plan completion.
