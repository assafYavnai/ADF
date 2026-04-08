# implement-plan-review-cycle-vision-master-plan-gating

## Implementation Objective

Enforce explicit Vision / Phase 1 / Master-Plan compatibility gating across `implement-plan` and `review-cycle` so no bounded slice can advance or close without proving it fits `docs/VISION.md`, `docs/PHASE1_VISION.md`, `docs/PHASE1_MASTER_PLAN.md`, and the active Phase 1 gap-closure plan.

## Requested Scope

Tighten the repo-owned `implement-plan` and `review-cycle` contracts, prompt templates, helper validation, and closeout reporting so mission compatibility becomes a real workflow gate instead of a soft expectation. The governed workflows must force every slice to name the authority set it read, freeze an explicit compatibility decision, reject later-company work from active implementation, and require route-level review findings to judge compatibility explicitly.

## Non-Goals

Do not widen into COO runtime/product-route changes, dashboard/reporting UI, merge-queue redesign, memory-engine redesign, or unrelated workflow refactors outside bounded compatibility gating for these two skills.

## Artifact Map

- context.md
- implement-plan-contract.md
- implement-plan-state.json
- implement-plan-pushback.md
- implement-plan-brief.md
- implementation-run/
- completion-summary.md

## Lifecycle

- active
- blocked
- completed
- closed
