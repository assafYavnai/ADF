1. Failure Classes

- Prompt-backed `/status` issue parity was still narrower than the normalized live issue surface.

2. Route Contracts

- Claimed supported route: `buildExecutiveBrief -> normalizeLiveExecutiveSurface -> buildStatusEvidencePack -> renderStatusWithAgent -> ensureSupportedLiveStatusBody -> assessSupportedLiveStatusBody -> emitParityMetric`.
- End-to-end invariant: the prompt-backed live `Issues` route must use the same authoritative issue source as the normalized CEO-facing surface, including brief-derived blocked items and governance-added attention.
- KPI Applicability: required.
- KPI Route / Touched Path: `COO/briefing/status-render-agent.ts`, `COO/controller/executive-status.ts`, `COO/controller/executive-status.test.ts`.
- KPI Raw-Truth Source: accepted CEO-facing `Issues` body plus the normalized live issue surface used to seed prompt evidence.
- KPI Coverage / Proof: prompt-backed negative proof for brief-generated blocked issues with no governance attention, plus accepted-body parity telemetry on the live route.
- KPI Production / Proof Partition: unchanged. Proof stays under temp roots and telemetry partition `proof`; production uses the same live route logic.
- Vision Compatibility: Compatible.
- Phase 1 Compatibility: Compatible.
- Master-Plan Compatibility: Compatible.
- Current Gap-Closure Compatibility: Compatible.
- Later-Company Check: no autonomy expansion, no second company truth system, no planner widening.
- Compatibility Decision: compatible bounded route fix.
- Compatibility Evidence: this closes the remaining sibling accepted-body issue parity gap inside the owned status-render route.
- Allowed mutation surfaces: `COO/briefing/status-render-agent.ts`, `COO/controller/executive-status.ts`, `COO/controller/executive-status.test.ts`, `docs/phase1/coo-live-executive-status-wiring/README.md`, `docs/phase1/coo-live-executive-status-wiring/context.md`, `docs/phase1/coo-live-executive-status-wiring/completion-summary.md`.
- Forbidden shared-surface expansion: no implement-plan changes, no review-cycle changes, no merge-queue changes, no redesign of the internal brief.
- Docs that must be updated: `README.md`, `context.md`, `completion-summary.md`.

3. Sweep Scope

- `COO/briefing/status-render-agent.ts`
- `COO/controller/executive-status.ts`
- `COO/controller/executive-status.test.ts`
- `COO/briefing/live-executive-surface.ts`
- slice docs that freeze accepted-body parity

4. Planned Changes

- Make the prompt-backed issue evidence pack reuse the full normalized live issue surface instead of governance-only attention.
- Keep focus-option and fallback behavior aligned with the enriched issue set without widening other sections.
- Add prompt-backed negative proof for brief-generated blocked issues with no governance attention.
- Update docs so they name the authoritative issue-source unification explicitly.

5. Closure Proof

- `tsx --test COO/controller/executive-status.test.ts COO/briefing/executive-brief.test.ts`
- `npm.cmd run build`
- live prompt-backed smoke: `tsx.cmd controller/cli.ts --scope assafyavnai/adf --enable-onion --status --scope-path assafyavnai/adf/phase1`
- Negative proof:
  - prompt-backed body with `No immediate issues.` while `brief.issues` contains a blocked item and `governance.additionalAttention` is empty must be repaired
  - accepted-body `issues_visibility_parity_count` must now reflect the full authoritative issue set
- Live/proof isolation: prove on the prompt-backed route, not only deterministic fallback.

6. Non-Goals

- None.
