# implement-plan-review-cycle-kpi-enforcement

## Implementation Objective

Enforce the system-wide KPI instrumentation rule across `implement-plan` and `review-cycle` so applicable implementation slices cannot close without explicit KPI coverage, KPI proof, or an approved time-bounded exception.

## Requested Scope

Tighten `implement-plan` and `review-cycle` contracts, prompt templates, helper validation, and closeout reporting so KPI applicability, KPI contract freezing, KPI closure verdicts, and temporary exception handling become explicit workflow gates instead of soft guidance.

## Non-Goals

Do not widen into COO runtime KPI route changes, dashboard/reporting UI, or unrelated workflow redesign outside KPI gating and human-facing report quality for these skills.

## Artifact Map

- context.md
- implement-plan-state.json
- implement-plan-contract.md
- implement-plan-pushback.md
- implement-plan-brief.md
- implementation-run/
- completion-summary.md

## Lifecycle

- active
- blocked
- completed
- closed
