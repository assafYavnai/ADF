# Governed Implementation Route Hardening Requirements

Status: active feature requirements
Last updated: 2026-04-06
Owner: COO
Scope: `docs/phase1/governed-implementation-route-hardening`

## Mandatory Requirements

- `review-cycle` must state and preserve implementor continuity across rejection or fix cycles.
- `review-cycle` must not start a new implementor prompt thread for a normal fix cycle when the existing implementor execution is still valid.
- `review-cycle` must send only the rejected report or findings artifact paths plus a short fix instruction for normal rejection-driven repair.
- `review-cycle` must prevent opening cycle `N+1` unless there are new diffs since the approved cycle or the invoker explicitly requests reopen.
- `merge-queue` must document and support a governed blocked-merge resume or resolve path.
- Blocked merges must remain inside the governed route rather than falling back to manual merge worktrees as the intended product behavior.
- `implement-plan` must fail closeout if generated artifacts still contain stale pre-merge or in-progress language after `mark-complete`.
- `implement-plan` must guard against independent authoritative requirement introduction on both base and feature when those files are required slice authorities.
- `cli-agent.md` must make bash-on-Windows launch and sibling-worker invocation examples more operationally explicit.
- Active authoritative sources must use `main`, not `master`, for the intended default branch language.

## Required Stale-Language Validation

At minimum, `implement-plan` post-closeout validation must reject artifacts that still contain:

- `not_ready`
- `closeout_pending`
- `review_cycle in progress`
- `approval-pending`

Equivalent stale closeout language that misstates the route status is also in scope.

## Required Deliverables

- updated `review-cycle` skill and contract guidance
- updated `merge-queue` skill and workflow contract guidance
- updated `merge-queue-helper.mjs` blocked-merge recovery tooling
- updated `implement-plan` skill and workflow contract guidance for requirement freeze
- updated `implement-plan-helper.mjs` closeout validation
- updated `cli-agent.md` operational examples
- targeted tests proving the new behavior
- repo-source branch-language cleanup for live authoritative templates and docs

## Machine Verification

- targeted `skills/tests` execution for the new behavior
- `node --check` on modified helpers
- `git diff --check`
- targeted scans proving `main` normalization on active authorities

## Human Verification

Required: false

Reason:
The slice is route and documentation hardening that should be provable through helper tests, syntax checks, and source inspection.
