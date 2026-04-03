# implement-plan-verification-and-approval-flow

## Implementation Objective

Upgrade implement-plan so it enforces machine verification planning, human verification planning, explicit testing-phase handoff messaging, and a production-level execution flow of implementation -> machine-test loop -> review-cycle -> human approval loop when required -> final sanity review-cycle only when code changed after human approval.

## Requested Scope

Focus on C:/ADF/skills/implement-plan/** and any directly dependent contract or prompt files needed to keep handoff into review-cycle coherent. Add hard integrity-gate requirements for machine and human verification plans. Add human testing handoff message format. Keep the workflow compact and autonomous.

## Non-Goals

Do not redesign unrelated ADF product workflows. Do not widen scope into general refactors of review-cycle beyond the minimum contract/prompt changes required for coherent handoff.

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
