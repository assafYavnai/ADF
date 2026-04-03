# 1. Implementation Objective

Build a standalone CEO-facing executive brief read model under COO/briefing/** that derives a focused 4-section brief from existing source truth, with full KPI instrumentation, fixture proof, and production/proof isolation — without runtime wiring.

# 2. Exact Slice Scope

- COO/briefing/types.ts — BriefSourceFacts, ExecutiveBrief, section item types, KPI types
- COO/briefing/builder.ts — buildExecutiveBrief() derives brief from source facts
- COO/briefing/renderer.ts — renderExecutiveBrief() produces the 4-section text output
- COO/briefing/kpi.ts — KPI collection and reporting for brief operations
- COO/briefing/fixtures/*.ts — 4 fixture scenarios
- COO/briefing/executive-brief.test.ts — proof tests for all fixtures and parity checks
- COO/briefing/INTEGRATION.md — future wiring note
- docs/phase1/coo-executive-brief-read-model/** — plan artifacts

# 3. Inputs / Authorities Read

- Thread shape from COO/controller/thread.ts
- OnionState, OpenDecision from COO/requirements-gathering/contracts/onion-state.ts
- OnionWorkflowThreadState, lifecycle status from COO/requirements-gathering/contracts/onion-live.ts
- Feature README and context from docs/phase1/coo-executive-brief-read-model/

# 4. Required Deliverables

- Typed read model (types.ts)
- Brief builder (builder.ts)
- Brief renderer (renderer.ts)
- KPI instrumentation (kpi.ts)
- 4 fixture scenarios (fixtures/)
- Proof tests (executive-brief.test.ts)
- Integration note (INTEGRATION.md)

# 5. Forbidden Edits

- COO/controller/cli.ts, loop.ts
- COO/requirements-gathering/live/onion-live.ts
- shared/telemetry/**
- components/memory-engine/**
- Any other slice folders

# 6. Integrity-Verified Assumptions Only

- Thread and event shapes are stable and available for read-only use
- OnionState and OpenDecision shapes are stable
- The brief is a pure derived read model — no writes back to source
- No runtime wiring needed — the brief package is self-contained with fixtures

# 7. Explicit Non-Goals

- No CLI command
- No startup summary wiring
- No memory-engine persistence changes
- No adaptive personalization
- No queue or CTO state model

# 8. Proof / Verification Expectations

Machine Verification Plan:
- Run `node --test COO/briefing/executive-brief.test.ts` (or equivalent)
- All 4 fixture cases must render deterministically
- Typecheck passes for all new files
- Parity checks verify section counts match source facts

Human Verification Requirement: false

# 9. Required Artifact Updates

- docs/phase1/coo-executive-brief-read-model/context.md — update with implementation decisions
- docs/phase1/coo-executive-brief-read-model/completion-summary.md — fill at closeout
- docs/phase1/coo-executive-brief-read-model/implement-plan-state.json — update lifecycle

# 10. Closeout Rules

- Human testing is NOT required
- Review-cycle runs only if post_send_to_review=true (currently false)
- Post-human-approval sanity pass is NOT required
- Final completion happens only after merge-queue merge success
- completion-summary.md must report merge status and sync status truthfully
