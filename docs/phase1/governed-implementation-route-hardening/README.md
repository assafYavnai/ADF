# governed-implementation-route-hardening

## Implementation Objective

Harden the governed implementation route so future implement-plan slices can move from slice-contract creation through implementation, review, blocked-merge recovery, and closeout with fewer orchestration failures and less operator guesswork.

## Why This Slice Exists Now

- Slice `mcp-boxing/slice-01-dev-team-bootstrap` exposed concrete friction in the current governed route.
- Some failures were prompt and documentation gaps.
- Other failures were real tooling gaps in `review-cycle`, `merge-queue`, and `implement-plan`.
- The goal of this slice is to convert those lessons into durable source-of-truth changes before the next implementation wave repeats them.

## Requested Scope

This slice is limited to the governed implementation route and its active authoritative sources.

In scope:

- `skills/review-cycle/SKILL.md`
- `skills/review-cycle/references/workflow-contract.md` when needed to freeze the same rule at contract level
- `skills/merge-queue/SKILL.md`
- `skills/merge-queue/references/workflow-contract.md`
- `skills/merge-queue/scripts/merge-queue-helper.mjs`
- `skills/implement-plan/SKILL.md`
- `skills/implement-plan/references/workflow-contract.md`
- `skills/implement-plan/scripts/implement-plan-helper.mjs`
- `docs/bootstrap/cli-agent.md`
- active authoritative templates and docs that still use `master` instead of `main`
- targeted tests that prove the route hardening truthfully

## Required Deliverables

- A hard rule in `review-cycle` that any rejection or fix cycle must reuse the same implementor execution and must not send a fresh long implementation prompt.
- A `review-cycle` guardrail that prevents creating cycle `N+1` unless there are new diffs since the approved cycle or the invoker explicitly requests reopen.
- A governed blocked-merge recovery route documented in `merge-queue`, with helper support that keeps blocked merges inside the governed route.
- `merge-queue-helper.mjs` support for resuming or resolving a blocked merge instead of falling back to manual merge worktrees as the intended workflow.
- `implement-plan-helper.mjs` closeout validation that fails when generated artifacts still contain stale pre-merge or in-progress language such as `not_ready`, `closeout_pending`, `review_cycle in progress`, or `approval-pending`.
- An implement-plan contract rule that authoritative initiative and slice requirements must already be frozen on `main`, or prepare must fail or push back when those authorities are being introduced independently on both base and feature.
- Stronger `cli-agent` bash-on-Windows examples for sibling worker invocation and quoting-safe launch patterns.
- A repo-wide live-source sweep that normalizes active template and documentation branch language from `master` to `main`.

## Allowed Edits

- `skills/review-cycle/**`
- `skills/merge-queue/**`
- `skills/implement-plan/**`
- `docs/bootstrap/cli-agent.md`
- active authoritative docs and templates that are part of the governed route
- targeted tests and fixtures directly required to prove this slice
- `docs/phase1/governed-implementation-route-hardening/**`

## Forbidden Edits

- no unrelated COO or product-runtime feature work
- no Brain MCP redesign
- no ad hoc manual merge-worktree workaround documented as the intended product path
- no historical artifact sweep across old completion summaries or frozen evidence unless a file is still an active authority
- no weakening of approval, review, merge, or closeout gates
- no scope expansion into general workflow redesign beyond the failures enumerated for this slice

## Machine Verification Plan

- targeted `skills/tests` coverage for:
  - review-cycle continuity and reopen guardrails
  - merge-queue blocked-merge resume or resolve flow
  - implement-plan stale-closeout validation
  - requirement-freeze integrity pushback when authoritative requirement files diverge across base and feature
- `node --check` for modified helper scripts
- `git diff --check`
- targeted source scans that prove active authoritative docs no longer use `master` where `main` is intended

## Human Verification Plan

Required: false

Reason:
This slice changes governed workflow helpers, contracts, and bootstrap docs. The required proof is deterministic machine verification and truthful artifact inspection.

## Non-Goals

- no full redesign of implement-plan, review-cycle, or merge-queue
- no migration of historical active features beyond the minimum truthful compatibility behavior required by the new route
- no changes to non-authoritative archived or historical artifacts just for wording cleanup
- no new product feature surfaces outside governed implementation workflow hardening

## Artifact Map

- README.md
- context.md
- requirements.md
- decisions.md
- implement-plan-contract.md
- implement-plan-state.json
- implement-plan-pushback.md
- implement-plan-brief.md
- implement-plan-execution-contract.v1.json
- implementation-run/
- completion-summary.md

## Lifecycle

- active
- blocked
- completed
- closed
