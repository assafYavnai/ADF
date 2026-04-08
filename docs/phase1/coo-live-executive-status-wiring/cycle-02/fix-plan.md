1. Failure Classes

- Live CEO-facing `/status` route contract drift between the actual agent-rendered surface, the deterministic fallback, the tests, and the slice docs.
- Recent-landings freshness drift on the live agent evidence pack, where all completed work is labeled as recent.
- Git status-window anchor mutation before a CEO-visible successful status render.

2. Route Contracts

- Failure class: live CEO-facing `/status` route contract drift.
  - Claimed supported route: `CLI /status -> buildLiveExecutiveStatus -> normalizeLiveExecutiveSurface / buildStatusEvidencePack -> renderStatusWithAgent -> validated CEO-facing status body`.
  - End-to-end invariant: the real live `/status` route must preserve one explicit CEO-facing contract from evidence normalization through final output. For this cycle, the supported live contract is the currently human-approved surface:
    - opening summary
    - `**Recent landings:**`
    - `## Issues That Need Your Attention`
    - `## On The Table`
    - `## In Motion`
    - recommendation sentence plus 3 closing focus options
    - no separate `## What's Next`
    - no operational footer on the default live surface
  - KPI Applicability: required.
  - KPI Route / Touched Path: `COO/controller/executive-status.ts`, `COO/briefing/status-render-agent.ts`, `COO/controller/executive-status.test.ts`.
  - KPI Raw-Truth Source: emitted visibility metrics plus route tests and live smoke output.
  - KPI Coverage / Proof: agent-path tests must prove the supported live headings and recommendation block; deterministic fallback and docs must align to that same supported route.
  - KPI Production / Proof Partition: proof tests run in proof partition; live smoke remains a production-shaped route smoke without test-only seams.
  - Vision Compatibility: compatible. This keeps the COO as a human-facing executive operator instead of widening into later-company autonomy.
  - Phase 1 Compatibility: compatible. The change stays inside bounded COO governance/status behavior.
  - Master-Plan Compatibility: compatible. The fix restores trustworthy company-level executive visibility.
  - Current Gap-Closure Compatibility: compatible. This closes the CEO-facing status route drift without widening into unrelated architecture.
  - Later-Company Check: no.
  - Compatibility Decision: compatible.
  - Compatibility Evidence: the CEO already accepted the current 3-section live surface as good enough for now; this cycle freezes and proves that exact route instead of silently drifting between 3-section and 4-section variants.
  - Allowed mutation surfaces: `COO/briefing/**`, `COO/controller/**`, `docs/phase1/coo-live-executive-status-wiring/**`, tightly scoped tests.
  - Forbidden shared-surface expansion: no trust-model redesign, no new autonomous execution behavior, no implement-plan or review-cycle engine changes.
  - Docs that must be updated: `docs/phase1/coo-live-executive-status-wiring/README.md`, `docs/phase1/coo-live-executive-status-wiring/context.md`, `docs/phase1/coo-live-executive-status-wiring/completion-summary.md`, `COO/briefing/INTEGRATION.md`.

- Failure class: recent-landings freshness drift.
  - Claimed supported route: `buildLiveExecutiveStatus -> normalizeLiveExecutiveSurface / buildStatusEvidencePack -> renderStatusWithAgent -> Recent landings summary`.
  - End-to-end invariant: only features inside the bounded recent-landings window may appear in `Recent landings` or be counted as recent delivery in the company summary.
  - KPI Applicability: required.
  - KPI Route / Touched Path: `COO/briefing/live-executive-surface.ts`, `COO/briefing/status-render-agent.ts`, `COO/controller/executive-status.test.ts`.
  - KPI Raw-Truth Source: feature completion timestamps from live source facts.
  - KPI Coverage / Proof: proof must show stale completed features are excluded from the live agent evidence pack and the final CEO-facing message.
  - KPI Production / Proof Partition: proof-only fixtures use bounded synthetic timestamps; live route behavior must reuse the same recency helper.
  - Vision Compatibility: compatible.
  - Phase 1 Compatibility: compatible.
  - Master-Plan Compatibility: compatible.
  - Current Gap-Closure Compatibility: compatible.
  - Later-Company Check: no.
  - Compatibility Decision: compatible.
  - Compatibility Evidence: this is a bounded correction to executive visibility truth, not a product-scope expansion.
  - Allowed mutation surfaces: `COO/briefing/**`, `COO/controller/executive-status.test.ts`, slice docs.
  - Forbidden shared-surface expansion: no new generic freshness platform.
  - Docs that must be updated: the slice docs if they still claim broader recent-landings truth than the code proves.

- Failure class: git status-window anchor mutation before success.
  - Claimed supported route: `buildLiveExecutiveStatus -> resolveStatusWindow -> prepareGovernedStatusContext / renderStatusWithAgent -> saveStatusUpdateAnchor after successful output`.
  - End-to-end invariant: the comparison anchor may advance only after a CEO-visible successful status render. Failed Brain hard-stop, agent failure, or render failure must leave the previous baseline untouched.
  - KPI Applicability: required.
  - KPI Route / Touched Path: `COO/controller/executive-status.ts`, `COO/controller/status-window.ts`, `COO/controller/executive-status.test.ts`.
  - KPI Raw-Truth Source: `.codex/runtime/coo-live-status-window.json` plus failure-path tests.
  - KPI Coverage / Proof: negative proof must show failed status attempts do not mutate the anchor; success proof must show the anchor updates after a successful render.
  - KPI Production / Proof Partition: proof uses temporary runtime roots only; live route uses the same persistence path helper.
  - Vision Compatibility: compatible.
  - Phase 1 Compatibility: compatible.
  - Master-Plan Compatibility: compatible.
  - Current Gap-Closure Compatibility: compatible.
  - Later-Company Check: no.
  - Compatibility Decision: compatible.
  - Compatibility Evidence: this is a route-correctness fix for company context visibility, not a redesign of git or runtime persistence.
  - Allowed mutation surfaces: `COO/controller/executive-status.ts`, `COO/controller/status-window.ts`, tests, slice docs.
  - Forbidden shared-surface expansion: no general audit daemon or git-history redesign.
  - Docs that must be updated: slice docs and completion summary if they currently overclaim the previous-status comparison behavior.

3. Sweep Scope

- `COO/briefing/status-render-agent.ts`
- `COO/briefing/live-executive-surface.ts`
- `COO/controller/executive-status.ts`
- `COO/controller/status-window.ts`
- `COO/controller/executive-status.test.ts`
- `COO/briefing/INTEGRATION.md`
- `docs/phase1/coo-live-executive-status-wiring/README.md`
- `docs/phase1/coo-live-executive-status-wiring/context.md`
- `docs/phase1/coo-live-executive-status-wiring/completion-summary.md`
- `docs/phase1/coo-live-executive-status-wiring/cycle-01/fix-report.md`

4. Planned Changes

- Add one explicit live-status render contract helper that both validates and normalizes the agent-rendered body to the currently approved CEO-facing surface.
- Reuse the existing recent-landings helper/window for the agent evidence pack instead of recomputing “recent” from every landed completion.
- Move status-window anchor persistence out of `resolveStatusWindow` and into the post-success path in `buildLiveExecutiveStatus`.
- Update tests so the supported live route is the proved route, including negative proof for stale landings and failed-render anchor persistence.
- Update slice docs and completion closeout artifacts so they freeze the same supported live route that the CEO actually approved.

5. Closure Proof

- `C:\\ADF\\.codex\\implement-plan\\worktrees\\phase1\\coo-live-executive-status-wiring\\COO\\node_modules\\.bin\\tsx.cmd --test controller\\executive-status.test.ts briefing\\executive-brief.test.ts`
- Route proof: agent-path tests that assert the supported live headings and closing focus block on the real live route contract.
- Negative proof: stale completed features do not appear in `Recent landings` or inflate recent delivery counts.
- Negative proof: failed Brain hard-stop or agent/render failure does not mutate `.codex/runtime/coo-live-status-window.json`.
- Success proof: successful status build updates the comparison anchor.
- Live/proof isolation check: proof-only fixtures stay under temp runtime roots; live smoke still uses the real CLI route with prompts enabled.
- Human-facing regression check: preserve the currently accepted live surface shape; if a fix requires reintroducing `## What's Next` or an operational footer, stop and return to fresh human verification.

6. Non-Goals

- None of the trust-model, deep-audit, or operating-table logic is being redesigned in this cycle.
- No implement-plan, merge-queue, review-cycle engine, or scheduler changes.
- No broader CLI/launcher redesign beyond the already-landed bounded launcher repair.
