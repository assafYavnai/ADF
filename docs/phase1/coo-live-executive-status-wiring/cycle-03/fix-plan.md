1. Failure Classes

- Partial live CEO-facing `/status` contract enforcement after model render.
- Under-specified final focus-choice policy when fewer than two concrete CEO options are evidenced.

2. Route Contracts

- Claimed supported route:
  `CLI /status -> printExecutiveStatus -> buildLiveExecutiveStatus -> renderStatusWithAgent -> ensureSupportedLiveStatusBody`
- End-to-end invariant:
  the default live CEO-facing route must either emit the approved CEO-facing contract directly or deterministically repair drift before anything reaches the CEO.
- Approved live CEO-facing contract:
  - opening summary
  - optional `**Delivery snapshot:**`
  - optional `**Recent landings:**`
  - exactly one `## Issues That Need Your Attention`
  - exactly one `## On The Table`
  - exactly one `## In Motion`
  - no `## What's Next`
  - no `Operational context:` footer
  - if the evidence supports at least two concrete next-focus options, a recommendation sentence plus exactly 3 numbered final options
  - if the evidence does not support at least two concrete next-focus options, no final choice block
- KPI Applicability: required
- KPI Route / Touched Path:
  `COO/briefing/status-render-agent.ts`, `COO/controller/executive-status.test.ts`, `COO/intelligence/prompt.md`, slice docs that describe the live contract
- KPI Raw-Truth Source:
  route tests, live status render output, existing status KPI counters and parity expectations
- KPI Coverage / Proof:
  route-level negative tests for malformed model output and reduced-option evidence, plus existing machine verification and live smoke compatibility
- KPI Production / Proof Partition:
  proof uses temp runtime roots and mocked LLM output; live route behavior remains the same production path through `buildLiveExecutiveStatus`
- Vision Compatibility:
  compatible because the fix makes the COO surface more predictable and less model-fragile without changing the bounded Phase 1 mission
- Phase 1 Compatibility:
  compatible because this stays inside the live COO runtime and does not widen into later-company autonomy
- Master-Plan Compatibility:
  compatible because it reduces executive ambiguity on the supported startup route
- Current Gap-Closure Compatibility:
  closes the remaining CEO-surface contract gap inside the company-level COO briefing route
- Later-Company Check:
  no
- Compatibility Decision:
  compatible
- Compatibility Evidence:
  the route stays evidence-first, company-first, Brain-backed, bounded in authority, and limited to the current slice surfaces
- Allowed mutation surfaces:
  `COO/briefing/status-render-agent.ts`, `COO/controller/executive-status.test.ts`, `COO/intelligence/prompt.md`, `docs/phase1/coo-live-executive-status-wiring/**`
- Forbidden shared-surface expansion:
  no new generic status schema, no review-cycle changes, no implement-plan changes, no broader trust/governance redesign
- Docs that must be updated:
  `docs/phase1/coo-live-executive-status-wiring/context.md`, `docs/phase1/coo-live-executive-status-wiring/completion-summary.md`

3. Sweep Scope

- `COO/briefing/status-render-agent.ts`
- `COO/controller/executive-status.ts`
- `COO/controller/executive-status.test.ts`
- `COO/intelligence/prompt.md`
- `docs/phase1/coo-live-executive-status-wiring/README.md`
- `docs/phase1/coo-live-executive-status-wiring/context.md`
- `docs/phase1/coo-live-executive-status-wiring/completion-summary.md`

4. Planned Changes

- Tighten post-render validation so it enforces opening-summary presence, exact-once required headings, required heading order, forbidden extra `##` sections, and final focus-choice cardinality.
- Tighten deterministic repair so it never emits an underfilled focus-choice block.
- Tighten focus-option synthesis so the live route only emits the final choice block when at least two concrete options are evidenced.
- Add route-level negative tests for malformed live-agent output and reduced-option evidence.
- Rebaseline slice docs and prompt text to make the focus-choice rule explicit.

5. Closure Proof

- Prove the route:
  `CLI /status -> buildLiveExecutiveStatus -> renderStatusWithAgent -> ensureSupportedLiveStatusBody`
- Required negative proof:
  - missing opening summary is repaired
  - duplicate required heading is repaired
  - reordered required headings are repaired
  - extra numbered final choice is repaired
  - one-concrete-option evidence does not emit a fake second concrete option
- Live/proof isolation checks:
  keep proof in temp runtime roots and preserve the real prompt-backed live render path
- Targeted regression checks:
  `tsx --test COO/controller/executive-status.test.ts COO/briefing/executive-brief.test.ts`
  `npm.cmd run build`

6. Non-Goals

- No change to the internal 4-section executive brief.
- No redesign of Brain hard-stop, operating table, or trust governance.
- No change to implement-plan or review-cycle.
- No broader wording overhaul beyond the live contract clarification needed for this route.
