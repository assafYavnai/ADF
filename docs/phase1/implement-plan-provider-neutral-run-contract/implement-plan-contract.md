1. Implementation Objective

Upgrade the repo-owned `implement-plan` execution path so `prepare` and `run` share one versioned JSON-first execution contract that supports `normal` and `benchmarking` run modes, provider-neutral worker selection, durable resumable identity and state, explicit reset semantics, append-only eventing, and KPI capture from the governed production route itself.

2. Slice Scope

- Strengthen [implement-plan](/C:/ADF/skills/implement-plan) so the helper materializes:
  - a stable feature-root execution contract at `implement-plan-execution-contract.v1.json`
  - a run-scoped contract snapshot under `implementation-run/<run-id>/`
  - a run-scoped mutable projection under `implementation-run/<run-id>/run-projection.v1.json`
  - append-only attempt event logs under `implementation-run/<run-id>/events/<attempt-id>/`
- Keep the slice bounded to the repo-owned helper/runtime/contract layer:
  - [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
  - [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
  - [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
  - [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs)
  - [governed-feature-runtime.mjs](/C:/ADF/skills/governed-feature-runtime.mjs)
  - minimal aligned review-cycle reference updates only where routed review integration or resume identity must stay truthful
- Preserve the existing governed normal route:
  - implementation
  - machine verification
  - review-cycle when required
  - human testing when required
  - merge-queue
  - completed only after truthful merge success
- Add benchmarking-mode fields only as shared substrate. Do not build supervisor orchestration or benchmark-only execution shortcuts.

3. Required Deliverables

- One versioned JSON execution contract shared by `prepare` and `run`, with a stable repo-owned path plus run-scoped snapshot.
- `run_mode` support for `normal` and `benchmarking`.
- Provider-neutral worker-selection resolution with invoker-runtime inheritance and explicit override fields for provider, runtime, model, reasoning effort, and access mode.
- Durable identity separation for:
  - feature identity
  - run identity
  - attempt identity
  - worker identity
  - lane identity when applicable
- Durable resumable state that can recover from run projections after interruption or feature-state damage.
- Explicit reset semantics that create a new attempt from implementation while preserving prior attempt history.
- KPI primitives emitted from the governed normal route itself:
  - per-step timing
  - per-governance-call timing
  - estimated token/cost capture when available
  - verification outcomes
  - review/self-fix counts
  - blocker classification
  - terminal status
- Updated workflow authorities and prompt references that truthfully describe the new contract and persistence model.
- Proof artifacts under this feature stream showing contract materialization, run-mode handling, overrides, resume/reset behavior, KPI/event emission, and failure paths.

4. Allowed Edits

- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
- [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs)
- [SKILL.md](/C:/ADF/skills/review-cycle/SKILL.md) only where required for routed review truth, resume identity, or benchmark-safe reference alignment
- [workflow-contract.md](/C:/ADF/skills/review-cycle/references/workflow-contract.md) only where required for routed review truth, resume identity, or benchmark-safe reference alignment
- [prompt-templates.md](/C:/ADF/skills/review-cycle/references/prompt-templates.md) only where required for routed review integration truth
- [SKILL.md](/C:/ADF/skills/merge-queue/SKILL.md) only if a minimal wording alignment is required for truthful integration
- [governed-feature-runtime.mjs](/C:/ADF/skills/governed-feature-runtime.mjs)
- Minimal aligned shared helper/runtime files under `C:/ADF/skills` that own shared state, locks, events, identity, or setup validation
- This feature root under [implement-plan-provider-neutral-run-contract](/C:/ADF/docs/phase1/implement-plan-provider-neutral-run-contract)

5. Forbidden Edits

- Do not implement the benchmark supervisor, matrix execution, or suite/lane stop commands.
- Do not create separate incompatible schemas for normal and benchmarking.
- Do not let normal mode bypass machine verification, route-level review, required human testing, merge-queue, or merge-complete closeout.
- Do not add a benchmark-only KPI scorer or synthetic score layer.
- Do not collapse worker runtime into control-plane runtime.
- Do not redesign merge-queue beyond the minimum needed for truthful integration.
- Do not weaken the rule that approval on the feature branch is merge-ready, not completed.
- Do not broaden the slice into COO runtime product work or unrelated workflow redesign.

6. Acceptance Gates

KPI Applicability: not required
KPI Route / Touched Path: Not applicable for this meta-governance slice. The slice changes repo-owned workflow/runtime contracts rather than a separate product route.
KPI Raw-Truth Source: Not applicable for a new product KPI route; this slice instead strengthens how `implement-plan` captures KPI truth for governed implementation routes.
KPI Coverage / Proof: Helper proof artifacts must show the governed route now emits durable step/governance/verification/blocker/terminal KPI primitives.
KPI Production / Proof Partition: Proof artifacts for this slice may live under this feature stream, but the runtime design must clearly keep future production KPI truth sourced from governed route execution rather than a separate proof-only scorer.
KPI Non-Applicability Rationale: This slice is repo-owned workflow/runtime governance. It does not itself ship a new product route that requires separate product KPI instrumentation to claim production completeness.
KPI Exception Owner: Not applicable.
KPI Exception Expiry: Not applicable.
KPI Exception Production Status: Not applicable.
KPI Compensating Control: Not applicable.
Vision Compatibility: This slice strengthens durable execution, governance, resumability, and route truth inside the Phase 1 delivery startup instead of adding a later-company function.
Phase 1 Compatibility: This slice directly improves the reviewed implementation lane by making execution state, resume, and closeout more machine-consumable and operationally disciplined.
Master-Plan Compatibility: This slice reduces operational ambiguity in feature execution, review routing, and completion truth without widening beyond the current Phase 1 mission.
Current Gap-Closure Compatibility: This slice closes the remaining implementation-lane governance gap around durable execution contract/state, provider-neutral worker control, and benchmark-safe persistence substrate.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: The current gap plan already states that `implement-plan`, `review-cycle`, and `merge-queue` form the governed implementation route. This slice hardens that route with one machine-consumable execution contract, explicit identity boundaries, event-first persistence, and truthful merge-complete closeout semantics.

1. `prepare` and `run` must share one stable versioned JSON execution contract path at the feature root, with the same schema used for both normal and benchmarking mode.
2. Normal mode remains the governed production route and must not allow benchmark-style shortcuts.
3. `benchmarking` fields may exist in the same contract, but this slice must stop short of benchmark supervision or matrix execution.
4. Worker selection must be provider-neutral and must support explicit overrides for provider, runtime, model, reasoning effort, and access mode.
5. When overrides are absent, worker selection must inherit truthful invoker/runtime defaults.
6. Feature identity, run identity, attempt identity, worker identity, and lane identity must remain distinct and durable.
7. Reset must create a new attempt from implementation and preserve prior attempt history rather than erasing it.
8. Append-only event files plus run-scoped projections must exist so future benchmark-driven review-cycle parallelism is not dependent on one unsafe shared whole-file mutation path.
9. The helper must be able to repair/recover execution runs conservatively from run projections when the legacy feature state is missing or damaged.
10. Completion remains legal only after truthful merge success.

Machine Verification Plan
- Run `node --check C:/ADF/skills/governed-feature-runtime.mjs`.
- Run `node --check C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`.
- Run `git diff --check` on the changed source set.
- Run targeted helper smoke verification that proves:
  - contract parsing and materialization
  - `run_mode=normal` governed route preparation
  - `run_mode=benchmarking` contract materialization without supervisor execution
  - invoker-runtime inheritance
  - explicit provider/runtime/model/reasoning/access overrides
  - resume after interruption via persisted run projection / state reuse
  - reset semantics create a new attempt and preserve prior attempt history
  - KPI/event emission updates the run projection truthfully
  - failure paths still push back or fail closed
- Refresh installed skills with `manage-skills install` / `manage-skills check` if repo-owned source changes materially affect generated installs.

Human Verification Plan
- Required: false
- Reason: this slice changes repo-owned workflow/runtime contracts, helper behavior, and feature artifacts. Closure should be proven through machine verification and governed review rather than a separate manual product-testing handoff.

7. Observability / Audit

- The stable feature-root execution contract must expose the selected route policy, worker-selection policy, identity envelope, benchmarking substrate, and artifact paths.
- Run projections must expose current attempt state, resume checkpoint, KPI summary, and durable artifact locations without requiring callers to reconstruct everything from the legacy feature-state file.
- Attempt event logs must be append-only JSON records with run/attempt identity so later reduction is possible without unsafe shared whole-file state mutation.
- The compatibility feature state remains important for current callers, but it must be treated as a projection/cache rather than the only source of execution truth.
- Route reports and completion reports must remain human-facing and concise even while the underlying runtime becomes more machine-consumable.

8. Dependencies / Constraints

- Preserve the existing `implement-plan` integrity gate and closeout truths.
- Preserve routed `review-cycle` integration and merge-queue ownership of truthful merge landing.
- Preserve worker/runtime truth from [governed-feature-runtime.mjs](/C:/ADF/skills/governed-feature-runtime.mjs).
- Preserve the review-cycle authority state already aligned to merge commit `9839399`.
- Keep the control plane distinct from the worker runtime.
- Brain capture is required by repo policy, but this Codex runtime lacks exposed Brain MCP tools, so durable decisions for this slice must be captured in repo-backed artifacts.

9. Non-Goals

- No benchmark supervisor implementation.
- No benchmark matrix or suite orchestration.
- No new operator stop surface for normal mode.
- No benchmark-only score layer.
- No merge-queue redesign beyond truthful integration.
- No unrelated repo-wide workflow rewrite.

10. Source Authorities

- [README.md](/C:/ADF/docs/phase1/implement-plan-provider-neutral-run-contract/README.md)
- [context.md](/C:/ADF/docs/phase1/implement-plan-provider-neutral-run-contract/context.md)
- [VISION.md](/C:/ADF/docs/VISION.md)
- [PHASE1_VISION.md](/C:/ADF/docs/PHASE1_VISION.md)
- [PHASE1_MASTER_PLAN.md](/C:/ADF/docs/PHASE1_MASTER_PLAN.md)
- [adf-phase1-current-gap-closure-plan.md](/C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md)
- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
- [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs)
- [SKILL.md](/C:/ADF/skills/review-cycle/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/review-cycle/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/review-cycle/references/prompt-templates.md)
- [SKILL.md](/C:/ADF/skills/merge-queue/SKILL.md)
- [governed-feature-runtime.mjs](/C:/ADF/skills/governed-feature-runtime.mjs)
