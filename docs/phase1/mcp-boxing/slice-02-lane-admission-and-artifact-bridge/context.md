# Feature Context

## Feature

- phase_number: 1
- feature_slug: mcp-boxing/slice-02-lane-admission-and-artifact-bridge
- project_root: C:/ADF
- feature_root: C:/ADF/docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge
- current_branch: main

## Task Summary

Create Slice 02 for MCP boxing by defining the ADF-facing feature package contract under `features_root`, adding the first real lane-admission route for `dev_team`, making MCP dev verify that ADF-side input artifacts are committed and pushed before lane admission, keeping deep operational artifacts in the private MCP dev lane store, and publishing `implementation-summary.json` back to the ADF feature package.

## Scope Hint

Keep this slice focused on intake, feature package verification, private-lane admission, and the machine-facing implementation summary bridge back to ADF. Do not yet broaden into full downstream development, review, or merge execution.

## Sequencing Rule

This slice is the next boxing step after the current route-hardening preconditions, not the slice that solves all remaining governance debt.

Before widening this slice, re-check:

- `governed-approval-gates-and-local-sync-hardening`
- `MCP-gaps.md`

The intended sequence is:

1. finish `governed-approval-gates-and-local-sync-hardening`
2. use this slice for lane admission and artifact bridging only
3. later, before boxed `dev_team` owns real downstream implementation, review, and merge, finish:
   - `governed-state-writer-serialization`
   - `implement-plan-provider-neutral-run-contract`

Do not silently convert Slice 02 into the later downstream execution slice.

## Non-Goals

Do not yet wire full development execution, live review-cycle execution, live merge execution, legacy skill retirement, or Brain boxing.

## Brain Context Rule

Brain connectivity is mandatory on the ADF side.

Relevant Brain-derived context must be carried inline in `context.md` with source references.
No Brain means hard stop.

## Known Pre-Implementation Findings

These findings matter to this slice because they explain what must already be true, what remains unsafe, and what should stay out of scope.

### Fix now elsewhere, not in this slice

- `governed-approval-gates-and-local-sync-hardening` owns:
  - required human-verification truth before merge
  - stale human approval invalidation
  - split-review truth hardening
  - pre-resume and pre-merge refresh
  - preserve-sync-restore for dirty local sync

### Do not absorb here unless absolutely required

- full projection unification across:
  - `implement-plan-state.json`
  - `review-cycle-state.json`
  - `features-index.json`
  - `queue.json`
  - `completion-summary.md`
- generic completion-summary regeneration
- COO structure cleanup
- KPI pattern cleanup
- unrelated helper parity cleanup from `MCP-gaps.md`

### Why this matters

- Slice 02 only needs a stable enough governed route to admit lanes and publish a machine-facing summary
- Step 2 explicitly keeps full downstream development execution, review, merge, and full approval-gate implementation out of scope
- widening this slice into governance cleanup would slow boxing and blur ownership

## Rich Context Artifacts To Read

Read these before implementation:

- `MCP-gaps.md`
- `governed-approval-gates-and-local-sync-hardening/lessons-for-mcp-boxing.md`
- `governed-approval-gates-and-local-sync-hardening/context.md`

What they tell you:

- why approval truth and local sync truth are the immediate hardening target
- why Slice 02 can proceed without solving every governance debt
- why later boxed downstream execution still needs additional hardening after Slice 02

## Important Current-State Example

Do not assume the quickest projection is the safest projection.

Example:

- `mcp-boxing/slice-01-dev-team-bootstrap` is completed and merged in its slice-local `implement-plan-state.json`
- but local control-plane projections can still lag in some workspaces

When projections disagree:

1. trust slice-local main truth first
2. use git truth second
3. treat stale control-plane projections as local drift until proven otherwise

## Discovered Authorities

- [feature-readme] C:/ADF/docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge/README.md
- [feature-decisions] C:/ADF/docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge/decisions.md
- [feature-requirements] C:/ADF/docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge/requirements.md
- [feature-contract] C:/ADF/docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge/contract.md
- [precondition-lessons] C:/ADF/docs/phase1/governed-approval-gates-and-local-sync-hardening/lessons-for-mcp-boxing.md
- [precondition-context] C:/ADF/docs/phase1/governed-approval-gates-and-local-sync-hardening/context.md
- [boxing-gap-report] C:/ADF/docs/phase1/MCP-gaps.md
- [phase-scope] C:/ADF/docs/phase1/mcp-boxing/scope.md
- [phase-step1] C:/ADF/docs/phase1/mcp-boxing/step1.md
- [phase-step2] C:/ADF/docs/phase1/mcp-boxing/step2.md
- [phase-requirements] C:/ADF/docs/phase1/mcp-boxing/requirements.md
- [phase-plan] C:/ADF/docs/PHASE1_MASTER_PLAN.md
- [phase-gap-plan] C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md
- [current-engine] C:/ADF/skills/implement-plan/SKILL.md
- [current-engine] C:/ADF/skills/implement-plan/references/workflow-contract.md
- [current-engine] C:/ADF/skills/review-cycle/SKILL.md
- [current-engine] C:/ADF/skills/merge-queue/SKILL.md
- [bootstrap] C:/ADF/AGENTS.md
- [bootstrap] C:/ADF/docs/bootstrap/cli-agent.md
- [template] C:/ADF/docs/phase1/mcp-boxing/templates/implement-plan-orchestrator-prompt-template.md
- [template-addendum] C:/ADF/docs/phase1/mcp-boxing/templates/implement-plan-orchestrator-template-bash-launch-addendum.md

## Notes

- This context file is intentionally seeded before the first `implement-plan` run so the slice starts with explicit ADF ↔ MCP dev contract assumptions.
- `decisions.md` in this slice is a temporary bridge artifact for implementation context from this environment to the local machine. It is not the normal long-term replacement for Brain.
- The preferred durable memory target is Brain, but contextless implementation must still work from repo-backed truth when the Brain MCP tool surface is missing from a given runtime.
