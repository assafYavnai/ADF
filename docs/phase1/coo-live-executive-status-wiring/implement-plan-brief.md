1. Implementation Objective

Wire the bounded live executive status surface so the COO can render a real four-section CEO brief from current thread/onion truth, finalized requirement truth, CTO-admission artifacts when available, and implement-plan truth.

2. Exact Slice Scope

- `COO/briefing/**` for live source adaptation, executive-brief derivation updates, and live KPI wiring
- `COO/controller/**` for the live status/startup surface entrypoint and runtime integration
- `COO/requirements-gathering/**` only for additive read-shape helpers if the live adapter needs them
- tightly scoped tests for live status rendering, source-family degradation, KPI emission, and partition/isolation proof
- `docs/phase1/coo-live-executive-status-wiring/**` for slice artifacts

3. Inputs / Authorities Read

- `docs/phase1/coo-live-executive-status-wiring/README.md`
- `docs/phase1/coo-live-executive-status-wiring/context.md`
- `docs/phase1/coo-live-executive-status-wiring/implement-plan-contract.md`
- `docs/v0/architecture.md`
- `docs/v0/kpi-instrumentation-requirement.md`
- `docs/PHASE1_MASTER_PLAN.md`
- existing `COO/briefing/**` read-model package
- existing `COO/table/source-adapters.ts` source normalization helpers as read-only reference/reuse

4. Required Deliverables

- live `BriefSourceFacts` adapter
- live status/startup rendering path
- graceful partial-source handling
- KPI emission and proof for the live path
- targeted tests
- updated slice docs and completion summary

5. Forbidden Edits

- implement-plan, review-cycle, or merge-queue changes
- queue scheduler buildout
- unrelated onion-behavior redesign
- broad memory-engine redesign
- edits to other slice folders

6. Integrity-Verified Assumptions Only

- finalized requirement truth can be read by exact memory id from live thread/onion state when Brain connectivity is available
- CTO-admission truth is optional today and can be read from deterministic slice artifact paths when present
- implement-plan truth should resolve from the shared project root when a feature worktree lacks its own `.codex/implement-plan` index
- the status route must stay derived-only and may emit telemetry, but may not mutate source truth

7. Explicit Non-Goals

- no CTO-admission artifact generation
- no queue manager or scheduler
- no broad controller redesign beyond the status surface
- no memory-engine schema or tool changes

8. Proof / Verification Expectations

Machine Verification Plan:
- targeted `node:test` coverage for live source adaptation and 4-section rendering
- proof that blocked items appear in `Issues`, shaping/admission items appear in `On The Table`, implementation items appear in `In Motion`, and concise forward items appear in `What's Next`
- proof that missing source families degrade cleanly and are counted
- proof that proof and production telemetry partitions remain isolated

Human Verification Requirement: true
- use the fixed testing-phase handoff from the contract once machine verification and review-cycle are done

9. Required Artifact Updates

- `docs/phase1/coo-live-executive-status-wiring/context.md`
- `docs/phase1/coo-live-executive-status-wiring/completion-summary.md`
- `docs/phase1/coo-live-executive-status-wiring/README.md` if the runtime contract changes materially

10. Closeout Rules

- human testing is required after machine verification and the configured review-cycle gate
- merge-ready state is not completion
- final completion happens only after merge-queue records merge success truthfully
- Brain/project-status write uses docs-only fallback unless a real approved Brain write path is available in this runtime
