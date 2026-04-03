# Feature Context

## Feature

- phase_number: 1
- feature_slug: implement-plan-worktree-merge-queue
- project_root: C:/ADF
- feature_root: C:/ADF/docs/phase1/implement-plan-worktree-merge-queue
- current_branch: main

## Task Summary

Upgrade implement-plan to use per-feature git worktrees and hand approved slices to a queued merge skill that lands merges FIFO per target branch, marks completion only after merge, and auto-fetches the local target branch after successful landing.

## Scope Hint

Focus on repo-owned skills under C:/ADF/skills. Add worktree-aware implement-plan state and lifecycle handling, add a repo-owned merge skill with queued per-branch landing, and update installer/manifest wiring and truthful completion semantics. Keep the flow compact and exact.

## Non-Goals

Do not redesign unrelated ADF workflows or weaken current review-cycle contracts.

## Discovered Authorities

- [feature-readme] C:/ADF/docs/phase1/implement-plan-worktree-merge-queue/README.md
- [implement-plan-contract] C:/ADF/docs/phase1/implement-plan-worktree-merge-queue/implement-plan-contract.md
- [phase-doc] C:/ADF/docs/phase1/adf-phase-gates-and-next-phase-design-implementation-ready-contract.md
- [phase-doc] C:/ADF/docs/phase1/adf-phase0-readiness-and-phase1-implementation-ready-plan.md
- [phase-doc] C:/ADF/docs/phase1/adf-phase1-coo-completion-plan.md
- [phase-doc] C:/ADF/docs/phase1/adf-phase1-discussion-record.md
- [phase-doc] C:/ADF/docs/phase1/adf-phase1-high-level-plan.md
- [phase-doc] C:/ADF/docs/phase1/adf-phase1-onion-parallel-build-plan.md
- [phase-doc] C:/ADF/docs/phase1/adf-requirement-to-implementation-high-level-design.md
- [phase-doc] C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md
- [phase-doc] C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/context.md
- [phase-doc] C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-01/audit-findings.md
- [phase-doc] C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-01/fix-plan.md
- [phase-doc] C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-01/fix-report.md
- [phase-doc] C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/cycle-01/review-findings.md
- [phase-doc] C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-brief.md
- [phase-doc] C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-contract.md
- [phase-doc] C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/context.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-01/audit-findings.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-01/fix-plan.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-01/fix-report.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-01/review-findings.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-01/verification-evidence.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-02/audit-findings.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-02/fix-plan.md
- [phase-doc] C:/ADF/docs/phase1/bash-execution-enforcement/cycle-02/fix-report.md
- [project-doc] C:/ADF/docs/phase1/coo-kpi-instrumentation/context.md
- [project-doc] C:/ADF/docs/phase1/coo-natural-conversation-rendering/context.md
- [project-doc] C:/ADF/docs/phase1/coo-stabilization/context.md
- [project-doc] C:/ADF/docs/phase1/implement-plan-verification-and-approval-flow/context.md
- [project-doc] C:/ADF/docs/phase1/llm-skills-repo-migration/context.md
- [project-doc] C:/ADF/docs/phase1/requirements-gathering/context.md
- [project-doc] C:/ADF/docs/v0/architecture.md
- [project-doc] C:/ADF/docs/v0/context/agent-role-builder-governance-v1-frozen-design.md
- [project-doc] C:/ADF/docs/v0/context/context-cache-layer-ideas.md
- [project-doc] C:/ADF/docs/v0/review-process-architecture.md

## Notes

- This context file was created automatically during implement-plan prepare.
