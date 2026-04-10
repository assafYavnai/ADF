# Feature Context

## Feature

- phase_number: 1
- feature_slug: governance-path-hardening-bootstrap
- project_root: C:/ADF
- feature_root: C:/ADF/docs/phase1/governance-path-hardening-bootstrap
- intended_feature_branch: implement-plan/phase1/governance-path-hardening-bootstrap
- intended_worktree_path: C:/ADF/.codex/implement-plan/worktrees/phase1/governance-path-hardening-bootstrap

## Bootstrap Startup Record

- `C:/ADF/AGENTS.md` read and followed.
- `C:/ADF/docs/bootstrap/cli-agent.md` read and followed.
- Required runtime preflight run via `C:/ADF/adf.cmd --runtime-preflight --json`.
- Required repair routes run via `C:/ADF/adf.cmd --install` and `C:/ADF/adf.cmd --doctor`.
- Current runtime truth:
  - `host_os=windows`
  - `workflow_shell=bash`
  - `execution_shell=unavailable`
  - `control_plane.kind=windows-cmd-trampoline`
  - `control_plane.entrypoint=adf.cmd`
  - `shell_contract.command_construction_mode=windows-nonbash-control-plane-into-bash`
  - `shell_contract.path_style=windows-native`
  - `brain_mcp.availability_status=available`
  - `brain_mcp.verification_status=doctor_required`
- `--doctor` confirmed the bash route is still defective, so this session used the documented repo-backed Brain fallback route instead of inventing a fake MCP surface.
- Brain fallback load completed through `node C:/ADF/skills/brain-ops/scripts/brain-ops-helper.mjs ...`.

## Problem Statement

`C:/ADF/docs/phase1/governance-path-hardening-plan-v2.md` already freezes the route-level repair model, but the repo still lacks the execution-ready slice artifacts that turn that plan into a bounded production implementation stream.

The route under repair currently suffers from the defect class described by the plan:

1. authority planes collapse into one another
2. hybrid fields and hybrid artifacts carry more than one meaning
3. ownership expansion stops at the obvious writer instead of all readers, validators, derivations, migrations, recovery paths, and status consumers
4. proxy evidence is accepted where first-class evidence should be required
5. docs, mutations, and proof drift apart after model changes

This slice exists to prevent another endpoint-only hardening pass.

## Manual Governance Reason

- `implement-plan`, `merge-queue`, and closeout governance are the code paths being repaired.
- Because those paths cannot yet certify their own first landing, the first implementation pass for this slice must remain manually governed from contract review through merge.
- The slice therefore seeds repo-native state and execution artifacts with an explicit blocked manual-bootstrap gate after brief creation. The last truthful implementation checkpoint remains `brief_ready`, but `feature_status` stays `blocked` until approval is recorded in `bootstrap-approval.v1.json`.

## Frozen Route-Level Decisions Carried Forward

The slice explicitly preserves these decisions from `governance-path-hardening-plan-v2.md`:

- truth classes are first-class design, not commentary
- field ownership is explicit and single-writer wherever authority exists
- artifact ownership is separate from field ownership
- every changed route must answer all four authority planes separately
- persisted feature schema and hydrated runtime view are distinct
- `reconciliation_sha` is runtime-derived only and recovered from durable remote proof
- `last_commit_sha` is a compatibility view only and never a new writer authority
- execution-domain status and merge/lifecycle status must stay split
- the workspace mirror is staging material only, never authority
- precedence is domain-scoped, not a global ladder
- ambiguity blocks fail closed instead of guessing
- backward compatibility is a first-class design surface
- contradiction gates, implementation-preflight, hostile-case proofs, and manual implementation review are mandatory

## Route Inventory From Code And Search Gate

### Core writers and mutators

Implement-plan:

- `prepare`
- `update-state`
- `record-event`
- `reset-attempt`
- `mark-complete`
- `normalize-completion-summary`
- `validate-closeout-readiness`
- state normalization and execution-run recovery
- features-index and agent-registry sync

Merge-queue:

- `enqueue`
- `process-next`
- `resume-blocked`
- `validateCloseoutReadinessBeforeMerge`
- `persistMergedFeatureCloseout`
- `commitAndPushFeatureCloseout`
- local target sync preserve/restore path

Review-cycle:

- `prepare`
- `update-state`
- `record-event`
- `normalize-closeout-artifacts`
- review verdict persistence
- review-cycle `last_commit_sha` validation and repair

Shared runtime:

- `C:/ADF/skills/governed-feature-runtime.mjs`
  - `detectCurrentBranch`
  - `detectDefaultBaseBranch`
  - `resolveCanonicalGitProjectRoot`
  - `governedStateWrite`

### Validators, derivation paths, recovery paths

- `implement-plan validate-closeout-readiness`
- `implement-plan mark-complete`
- legacy active-run projection sync inside `implement-plan-helper.mjs`
- recovery of execution runs from `implementation-run/*/run-projection.v1.json`
- merge-queue stale-merge guard
- merge-queue `.codex/*/setup.json` delta guard
- review-cycle git-object validation for `last_commit_sha`

### Status and reporting consumers discovered by repo-wide search

- `C:/ADF/COO/table/source-adapters.ts`
- `C:/ADF/COO/briefing/live-source-adapter.ts`
- `C:/ADF/COO/controller/executive-status.test.ts`
- `C:/ADF/skills/tests/closeout-readiness.test.mjs`
- `C:/ADF/skills/tests/merge-authority.test.mjs`
- `C:/ADF/skills/tests/merge-queue-resume-blocked.test.mjs`
- `C:/ADF/skills/tests/stale-merge-guard.test.mjs`
- `C:/ADF/skills/tests/governed-approval-gates.test.mjs`
- `C:/ADF/skills/tests/approved-commit-closeout-state-separation.test.mjs`

### Sibling route branches that implementation must treat as first-class

- active pre-merge worktree authority before `merge_commit_sha`
- queued and in-progress merge lanes
- blocked merge resume without lane retargeting
- merged but not yet completed closeout
- repo-root canonical authority after `merge_commit_sha`
- stale worktree artifacts after merge
- legacy state hydration for pre-hardening slices
- fresh-clone recovery of closeout truth from remote-only evidence
- status/reporting readers that still consume compatibility fields

## Implementation Ordering Rationale

The phases remain ordered exactly to preserve failure isolation:

1. Phase 0 freezes the contract before code changes can drift.
2. Phase 1 removes wrong-code-landing risk before broader refactors begin.
3. Phase 2 fixes physical authority before semantic field changes.
4. Phase 3 separates persisted schema from hydrated compatibility views.
5. Phase 4 adds domain-scoped reconcile plus multi-plane validation.
6. Phase 5 replaces raw closeout with remotely provable governed closeout.
7. Phase 6 backfill stays separate so runtime hardening can land without historical cleanup scope creep.

## Neighboring Slice Patterns Used

Artifact set, naming, and documentation style were checked against:

- `C:/ADF/docs/phase1/governed-approval-gates-and-local-sync-hardening`
- `C:/ADF/docs/phase1/governed-implementation-route-hardening`
- `C:/ADF/docs/phase1/governed-merge-closeout-chain-hardening`
- `C:/ADF/docs/phase1/approved-commit-closeout-state-separation`
- `C:/ADF/docs/phase1/mcp-boxing/slice-01-dev-team-bootstrap`

## Source Authorities Used

- `C:/ADF/AGENTS.md`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/docs/v0/architecture.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/governance-path-hardening-plan-v2.md`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
- `C:/ADF/skills/governed-feature-runtime.mjs`
- `C:/ADF/skills/review-cycle/scripts/review-cycle-helper.mjs`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`

## Notes

- This slice intentionally does not modify the hardening plan text. The plan already carries the route-level design decisions; this slice translates them into repo-native execution artifacts.
- The seeded operational artifacts intentionally preserve `brief_ready` only as the last truthful pre-implementation checkpoint. Live operational state stays `blocked` until the bootstrap approval record in `bootstrap-approval.v1.json` is stamped approved, and the slice does not advertise governed `review_cycle` state or use `last_error` to carry the hold.
