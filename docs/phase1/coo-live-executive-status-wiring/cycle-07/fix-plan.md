1. Failure Classes

- CEO brief contract drift: the default `/status` output is a field report instead of a compact executive synthesis.
- Duplicate systemic findings: repeated per-slice KPI gap findings are rendered as separate issues instead of one grouped decision item.
- Active-slice visibility gap: governed slices that are open in implement-plan but not yet "in motion" can disappear from the COO brief.
- Motion wording drift: the brief can say nothing is active when nothing is executing, which is too broad for a CEO-facing summary.

2. Route Contracts

- Claimed supported route: `CLI /status -> printExecutiveStatus -> buildLiveExecutiveStatus -> buildStatusEvidencePack -> renderStatusWithAgent -> ensureSupportedLiveStatusBody`, with deterministic fallback through `renderDeterministicStatusBriefing`.
- End-to-end invariant: the default COO brief must stay aggregate-first, CEO-readable, evidence-backed, and bounded to the approved section order `Bottom line -> Delivery health -> Issues that need a decision -> Parked / waiting -> Recommendation`.
- KPI Applicability: required.
- KPI Route / Touched Path: `COO/controller/executive-status.ts`, `COO/briefing/status-render-agent.ts`, `COO/briefing/live-source-adapter.ts`, `COO/intelligence/prompt.md`.
- KPI Raw-Truth Source: live `/status` render from the feature worktree plus route-local tests validating section shape, issue grouping, focus options, and active-slice visibility.
- KPI Coverage / Proof: prove the CEO brief groups duplicate findings, includes short evidence bridges, offers `Show detailed breakdown` when hidden detail exists, and keeps active governed slices visible without expanding into raw dump output.
- KPI Production / Proof Partition: proof comes from route-local TypeScript checks, `COO` build, targeted status tests, and a real worktree `/status` smoke run. No harness-only proof is sufficient.
- Vision Compatibility: compatible. The change keeps the COO as the company operating surface and improves how it briefs the CEO without widening into later-company autonomy.
- Phase 1 Compatibility: compatible. The slice stays inside bounded Phase 1 COO behavior and strengthens the management surface rather than replacing it.
- Master-Plan Compatibility: compatible. The work improves the real COO reporting seam instead of bypassing the approved runtime route.
- Current Gap-Closure Compatibility: compatible. The fix closes the live executive briefing quality gap and the active-slice visibility gap in the current COO surface.
- Later-Company Check: no.
- Compatibility Decision: compatible.
- Compatibility Evidence: the route remains derived-only and evidence-first; the change compresses presentation, preserves governed truth, and makes active slice visibility explicit without hardcoding a slice-specific report.
- Allowed mutation surfaces: `COO/briefing/**`, `COO/controller/**`, `COO/intelligence/**`, route-local tests, and `docs/phase1/coo-live-executive-status-wiring/**`.
- Forbidden shared-surface expansion: no implement-plan, review-cycle, merge-queue, or unrelated COO architecture changes.
- Docs to update: `docs/phase1/coo-live-executive-status-wiring/implement-plan-contract.md`, cycle-07 artifacts, completion summary if approval closeout reaches that point.

3. Sweep Scope

- Inspect the live render path, deterministic fallback path, accepted-body parity checks, and focus-option generation so the CEO contract stays aligned on both model-backed and deterministic routes.
- Inspect active-slice sourcing from implement-plan/open work so plan-only slices do not vanish before human review or merge.
- Inspect grouped issue synthesis so KPI/systemic findings collapse by root cause rather than by landed slice.
- Inspect motion summary wording so the brief distinguishes "not executing" from "nothing active at all."

4. Planned Changes

- Add an executive briefing synthesis layer that derives bottom line, delivery health, grouped decision issues, parked/waiting items, recommendation, and focus options from the governed evidence pack.
- Update the live source adapter so open implement-plan slices remain visible even when they are not yet marked as active execution.
- Make the deterministic fallback use the same executive contract as the model-backed route.
- Tighten the prompt so the LLM path follows the same compact CEO-facing shape instead of reverting to an operational dump.
- Narrow the motion wording so zero executing items does not read like zero active work overall.
- No new shared power is introduced; the changes stay route-local to COO status rendering.

5. Closure Proof

- Prove route: `./adf.sh -- --status --scope-path assafyavnai/adf/phase1` from the feature worktree shows the executive section order, grouped issues, short evidence bridges, `Show detailed breakdown`, and active-slice visibility.
- Targeted checks:
  - `node --check COO/briefing/status-render-agent.ts`
  - `node --check COO/briefing/live-source-adapter.ts`
  - `node --check COO/controller/executive-status.ts`
  - `npm.cmd run build` from `COO/`
  - `tsx --test COO/controller/executive-status.test.ts`
- Negative proof: confirm the route no longer repeats the KPI gap per landed slice and does not emit extra operational sections in the default CEO brief.
- Live/proof isolation: confirm the same contract is enforced by both the prompt-backed live route and the deterministic fallback, rather than relying on a test-only template.
- Regression checks: verify focus options remain evidence-gated, parked/waiting items stay compact, and the brief still remains data-driven instead of slice-hardcoded.

6. Non-Goals

- Fixing the implement-plan KPI closeout bug itself.
- Rewriting review-cycle or merge-queue behavior.
- Rebuilding the COO operating table architecture outside this slice.
- Hardcoding specific issue titles, counts, or slice names into the brief.
