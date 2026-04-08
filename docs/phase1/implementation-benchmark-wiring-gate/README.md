# implementation-benchmark-wiring-gate

## Implementation Objective

Implement Spec 3: create the strict compatibility audit/remediation gate that verifies whether the Spec 1 provider-neutral `implement-plan` substrate and the Spec 2 benchmark supervisor skill — both already on main — truly speak the same contract and runtime semantics without hidden bridge logic.

Sequencing Note: Spec 2 was originally intended to remain off main until Spec 3 passed. Spec 2 is now already merged. Spec 3 therefore acts as a post-merge compatibility gate for the current repo state. If Spec 3 fails, the truthful outcome is remediation or rollback decision — not silent acceptance. If Spec 3 passes, the benchmark path is compatibility-cleared for production use.

## Requested Scope

A narrow compatibility and validation layer, plus the feature artifacts needed to drive governed implementation and fail-closed compatibility checks against the Spec 1 + Spec 2 combination already on main.

## Non-Goals

- Repairing missing Spec 1 or Spec 2 behavior inside Spec 3
- Hidden adapter or shim logic
- Partial wiring or partial merge on failed compatibility
- A new worker runtime or supervisor runtime

## Artifact Map

- context.md
- implement-plan-contract.md
- implementation-run/
- completion-summary.md

## Lifecycle

- active
- blocked
- completed
- closed
