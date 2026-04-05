1. Failure Classes

- First-run provider resolution drift for Claude-targeted implementor lanes.
- Shared helper and authoritative contract drift for newly accepted Claude worker/runtime enums.

2. Route Contracts

- Failure class: First-run provider resolution drift for Claude-targeted implementor lanes.
  - Claimed supported route: runtime preflight and setup defaults -> worker selection -> prepare output -> live execution contract -> persisted state for a fresh feature with no prior continuity.
  - End-to-end invariant: when setup or overrides select a Claude worker/runtime, the helper must emit and persist `provider=claude` truthfully on the first run, not only after a later continuity round-trip.
  - KPI Applicability: not required.
  - KPI Route / Touched Path: None.
  - KPI Raw-Truth Source: None.
  - KPI Coverage / Proof: None.
  - KPI Production / Proof Partition: None.
  - KPI Non-Applicability Rationale: this is worker-selection/runtime truth plumbing and does not change feature KPI capture or KPI projection behavior.
  - Vision Compatibility: compatible with ADF's requirement for truthful governed execution and explicit runtime authority.
  - Phase 1 Compatibility: compatible with bounded Phase 1 workflow/runtime hardening.
  - Master-Plan Compatibility: compatible with governed implementation flow, truthful operator control, and reusable helper contracts.
  - Current Gap-Closure Compatibility: supports the Phase 1 workflow-governance and runtime-stability gap by keeping helper continuity truthful across provider transitions.
  - Later-Company Check: no.
  - Compatibility Decision: compatible.
  - Compatibility Evidence: the route only hardens provider truth for the already-approved helper selection path and does not widen into autonomous staffing or later-company behavior.
  - Allowed mutation surfaces: `skills/implement-plan/scripts/implement-plan-helper.mjs`, tightly scoped verification artifacts, and slice docs.
  - Forbidden shared-surface expansion: no redesign of worker lifecycle, no new provider platform, no benchmark/merge queue changes.
  - Docs that must be updated: slice context, completion summary, implement-plan setup contract, review-cycle setup/workflow contracts if their allowed values are widened in code.

- Failure class: Shared helper and authoritative contract drift for newly accepted Claude worker/runtime enums.
  - Claimed supported route: shared governed runtime enums -> implement-plan helper/setup validation -> review-cycle helper/setup validation -> authoritative repo-owned setup/workflow contracts.
  - End-to-end invariant: every shared helper and authoritative contract that validates or documents worker/runtime/access values must agree on the supported enum surface and on provider-specific nullable reasoning metadata.
  - KPI Applicability: not required.
  - KPI Route / Touched Path: None.
  - KPI Raw-Truth Source: None.
  - KPI Coverage / Proof: None.
  - KPI Production / Proof Partition: None.
  - KPI Non-Applicability Rationale: this route governs worker execution metadata, not KPI collection or reporting.
  - Vision Compatibility: compatible with truthful governance and shared-runtime stability.
  - Phase 1 Compatibility: compatible with bounded helper/runtime hardening.
  - Master-Plan Compatibility: compatible with source-of-truth discipline and governed execution reuse.
  - Current Gap-Closure Compatibility: supports workflow/runtime stabilization by preventing helper-contract drift.
  - Later-Company Check: no.
  - Compatibility Decision: compatible.
  - Compatibility Evidence: the change stays inside shared governed helper surfaces already in scope and only aligns code/docs/validators on accepted values.
  - Allowed mutation surfaces: `skills/governed-feature-runtime.mjs`, `skills/review-cycle/scripts/**`, `skills/implement-plan/references/**`, `skills/review-cycle/references/**`, slice docs.
  - Forbidden shared-surface expansion: no new worker platform abstraction, no redesign of review-cycle orchestration, no provider-specific business logic.
  - Docs that must be updated: implement-plan setup contract, review-cycle setup contract, review-cycle workflow contract, slice context, completion summary.

3. Sweep Scope

- `skills/implement-plan/scripts/implement-plan-helper.mjs`
- `skills/governed-feature-runtime.mjs`
- `skills/review-cycle/scripts/review-cycle-setup-helper.mjs`
- `skills/review-cycle/scripts/review-cycle-helper.mjs`
- `skills/implement-plan/references/setup-contract.md`
- `skills/review-cycle/references/setup-contract.md`
- `skills/review-cycle/references/workflow-contract.md`
- Fresh prepare proof for `phase1/governed-state-writer-serialization`

4. Planned Changes

- Add one provider-resolution helper so explicit runtime/access/model truth can infer `provider` when shell-env detection is absent.
- Use that helper in first-run worker selection and live execution contract projection.
- Extend review-cycle helper/setup enum validators to accept the same Claude worker/runtime values already accepted by the shared governed runtime.
- Update the authoritative setup/workflow contracts so they truthfully describe the widened enum surface and nullable reasoning metadata.

5. Closure Proof

- `node --check` on every touched helper/runtime script.
- Fresh `implement-plan-helper.mjs get-settings --project-root C:/ADF` proof that the Claude setup remains truthful and `preferred_implementor_reasoning_effort` stays null.
- Fresh `implement-plan-helper.mjs prepare --project-root C:/ADF --phase-number 1 --feature-slug governed-state-writer-serialization ...` proof that:
  - `implementor_lane.provider` is `claude`
  - `execution_contract.invoker_runtime.provider` is `claude`
  - `execution_contract.worker_selection.defaults.provider` is `claude`
  - `reasoning_effort` remains null for the Claude lane
- Negative proof that Codex-shaped values are still accepted by review-cycle validators and that adding Claude enums does not invalidate artifact-only or Codex paths.
- Live/proof isolation check: proof uses the real helper commands and on-disk contracts, not ad hoc JSON editing.

6. Non-Goals

- Do not redesign worker lifecycle orchestration.
- Do not add provider-specific review-cycle auto-selection heuristics beyond the truthful enum/validation surface needed for closure.
- Do not modify merge-queue, benchmark supervisor, or COO runtime behavior.
