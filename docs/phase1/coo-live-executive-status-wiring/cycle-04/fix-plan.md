1. Failure Classes

- Structural-only acceptance on the live CEO-facing `/status` body.

2. Route Contracts

- Claimed supported route: `CLI /status -> printExecutiveStatus -> buildLiveExecutiveStatus -> renderStatusWithAgent -> ensureSupportedLiveStatusBody`.
- End-to-end invariant: the accepted CEO-facing body must keep evidence-backed `Issues`, `On The Table`, `In Motion`, and `Recent landings` visible when they exist; structurally valid but evidence-dropping model output must be rejected or deterministically repaired.
- KPI Applicability: required.
- KPI Route / Touched Path: `COO/briefing/status-render-agent.ts`, `COO/controller/executive-status.ts`, `COO/controller/executive-status.test.ts`.
- KPI Raw-Truth Source: accepted live CEO-facing body plus the evidence pack that feeds the prompt-backed route.
- KPI Coverage / Proof: targeted negative proof for structurally valid but evidence-dropping model output; parity telemetry emitted from the accepted body rather than the internal brief; live prompt-backed smoke on the repaired route.
- KPI Production / Proof Partition: proof remains under temp roots and telemetry partition `proof`; live route logic stays identical between proof and production.
- Vision Compatibility: Compatible.
- Phase 1 Compatibility: Compatible.
- Master-Plan Compatibility: Compatible.
- Current Gap-Closure Compatibility: Compatible.
- Later-Company Check: no later-company autonomy, no second company truth system, no planner expansion.
- Compatibility Decision: compatible bounded route fix.
- Compatibility Evidence: this closes a live evidence-first contract gap inside the owned status route without widening into new workflow authority.
- Allowed mutation surfaces: `COO/briefing/status-render-agent.ts`, `COO/controller/executive-status.ts`, `COO/controller/executive-status.test.ts`, `docs/phase1/coo-live-executive-status-wiring/context.md`, `docs/phase1/coo-live-executive-status-wiring/completion-summary.md`.
- Forbidden shared-surface expansion: no implement-plan changes, no review-cycle changes, no merge-queue changes, no prompt-only fix, no redesign of the internal 4-section brief.
- Docs that must be updated: `docs/phase1/coo-live-executive-status-wiring/context.md`, `docs/phase1/coo-live-executive-status-wiring/completion-summary.md`.

3. Sweep Scope

- `COO/briefing/status-render-agent.ts`
- `COO/controller/executive-status.ts`
- `COO/controller/executive-status.test.ts`
- `COO/briefing/live-executive-surface.ts`
- slice docs that freeze the live CEO-facing contract

4. Planned Changes

- Add accepted-body parity checks for evidenced issue/table/in-motion/recent-landing content on the live CEO-facing route.
- Deterministically fall back to the supported evidence-based body when a structurally valid model render drops required evidence.
- Emit visibility parity telemetry from the accepted CEO-facing body on the prompt-backed route.
- Add negative proof for structurally valid but evidence-dropping model output and suspicious landing carry-through.
- Update slice docs to reflect accepted-body parity enforcement.

5. Closure Proof

- `tsx --test COO/controller/executive-status.test.ts COO/briefing/executive-brief.test.ts`
- `npm.cmd run build`
- live prompt-backed smoke: `tsx.cmd controller/cli.ts --scope assafyavnai/adf --enable-onion --status --scope-path assafyavnai/adf/phase1`
- Negative proof:
  - structurally valid render that says `No immediate issues` while issues exist must be repaired
  - structurally valid render that says `No open items` while table items exist must be repaired
  - structurally valid render that says `Nothing active` while in-motion items exist must be repaired
  - structurally valid render that under-reports recent landings or drops `see issue below` on suspicious landings must be repaired
- Telemetry proof: accepted-body parity metrics must reflect the final CEO-facing body, not the internal brief counts.
- Live/proof isolation: keep deterministic fallback and prompt-backed live route distinct; prove the repaired behavior on the prompt-backed route itself.

6. Non-Goals

- None.
