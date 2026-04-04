# implement-plan-provider-neutral-run-contract

## Implementation Objective

Upgrade the repo-owned `implement-plan` path so it exposes one versioned JSON-first execution contract for both `prepare` and `run`, keeps normal mode as the governed production route, and adds the durable identity, resume, reset, event, and KPI substrate required for later benchmarking work without weakening production behavior.

## Requested Scope

Implement Spec 1 only. Unify the runtime contract, worker-selection model, identity model, resumable state, reset semantics, and KPI/event persistence across `implement-plan`, the governed runtime helper, and only the minimal review-cycle references needed to keep routed review integration truthful.

## Non-Goals

Do not build the benchmark supervisor. Do not build Spec 2 or Spec 3. Do not add matrix execution, benchmark stop controls, or any shortcut that lets normal mode bypass machine verification, review-cycle, required human testing, merge-queue, or merge-complete closeout.

## Artifact Map

- context.md
- implement-plan-state.json
- implement-plan-contract.md
- implement-plan-execution-contract.v1.json
- implement-plan-pushback.md
- implement-plan-brief.md
- implementation-run/
- completion-summary.md

## Lifecycle

- active
- blocked
- completed
- closed
