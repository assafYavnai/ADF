# implement-plan-review-cycle-kpi-enforcement

## Implementation Objective

Continue the workflow-governance hardening slice so `implement-plan` and `merge-queue` handle approved-commit freeze, canonical root vs execution root, blocked-request recovery, clean target sync, and human-facing failure output deterministically without dirtying tracked feature artifacts after approval.

## Requested Scope

Tighten repo-owned `implement-plan`, `merge-queue`, and shared governed-runtime helpers so:

- `merge-ready` freezes the approved feature-branch commit automatically
- local operational handoff data lives in `.codex` state instead of depending on mutable tracked docs
- `merge-queue` fetches and validates the exact approved SHA before landing it
- blocked queue entries can be retried or requeued without manual JSON surgery
- dirty root checkouts do not make a successful merge look failed
- user-facing failure output stays short, structured, and actionable

## Non-Goals

Do not widen into COO runtime KPI route changes, product telemetry work, or broad workflow redesign outside approved-commit handoff, merge-queue recovery, canonical state roots, and truthful closeout reporting.

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
