1. Implementation Objective

Harden repo-owned `implement-plan`, `merge-queue`, and shared governed-runtime helpers so approved-commit freeze, canonical root vs execution root, blocked-request recovery, clean target sync, and human-facing failure output are deterministic and no longer depend on post-approval tracked-file rewrites.

2. Slice Scope

- Strengthen repo-owned `implement-plan` authorities under [implement-plan](/C:/ADF/skills/implement-plan) so merge-ready handoff freezes the approved feature-branch commit automatically and stores operational handoff data in `.codex` local state instead of depending on mutable tracked feature artifacts.
- Strengthen repo-owned `merge-queue` authorities under [merge-queue](/C:/ADF/skills/merge-queue) so enqueue and process-next derive handoff data from local operational state, fetch and validate the exact approved SHA before merge, support retry or requeue of blocked entries, and report failures in a human-facing operator shape.
- Strengthen shared workflow runtime helpers under [governed-feature-runtime.mjs](/C:/ADF/skills/governed-feature-runtime.mjs) only where canonical-root inference and structured subprocess failure reporting are truly shared.
- Keep the slice bounded to:
  - deterministic helper behavior
  - workflow contracts and prompt templates
  - local `.codex` operational state shape
  - feature artifacts required to keep the slice truthful

3. Required Deliverables

- `implement-plan-helper.mjs` state and index behavior that:
  - distinguishes canonical repo root from execution repo root
  - keeps committed feature-state paths canonical to the repo root instead of temporary worktree paths
  - freezes `approved_commit_sha` automatically when `merge-ready` is recorded
  - stores enough local operational handoff data in `.codex/implement-plan/features-index.json` for merge-queue to run without depending on post-push tracked-doc mutations
- `merge-queue-helper.mjs` behavior that:
  - fetches the target base ref and feature ref before merge
  - proves the approved SHA exists locally before merge
  - proves the approved SHA is still reachable from the fetched feature ref before merge
  - supports `retry-request` for blocked entries
  - supports `requeue-request` when a blocked request must be replaced or superseded
  - preserves prior blocked history instead of forcing manual queue JSON edits
  - uses a clean target-sync worktree or equivalent clean local checkout path when the shared root checkout is dirty or on a different branch
  - stops rewriting tracked feature artifacts after enqueue, process, block, or merge success
- Human-facing operator failure output for queue/helper failures that includes:
  - what failed
  - whether merge landed
  - whether local operational state was updated
  - the next safe action
- Updated repo-owned workflow contracts and prompt templates for `implement-plan` and `merge-queue` so the documented behavior matches the helper behavior.
- Updated feature artifacts for this stream, including the normalized contract, brief, state, and completion summary.

4. Allowed Edits

- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
- [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs)
- [SKILL.md](/C:/ADF/skills/merge-queue/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/merge-queue/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/merge-queue/references/prompt-templates.md)
- [merge-queue-helper.mjs](/C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs)
- [governed-feature-runtime.mjs](/C:/ADF/skills/governed-feature-runtime.mjs)
- This feature root under [implement-plan-review-cycle-kpi-enforcement](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement)
- Supporting governance notes under [docs/v0/context](/C:/ADF/docs/v0/context) only if required to keep the new workflow rule chain explicit

5. Forbidden Edits

- Do not widen into COO runtime KPI route changes or new product telemetry work.
- Do not redesign unrelated workflow engines beyond approved-commit handoff, queue recovery, canonical roots, clean target sync, and human-facing closeout reporting.
- Do not weaken KPI gating or human-facing reporting rules already established for `implement-plan` and `review-cycle`.
- Do not reintroduce dependence on mutable tracked feature artifacts after approval or merge just to keep local queue state updated.
- Do not silently replace deterministic helper enforcement with prompt-only guidance where the helper can enforce the rule directly.

6. Acceptance Gates

1. `implement-plan` records `approved_commit_sha` automatically when `merge-ready` is recorded and refuses that transition when no truthful `last_commit_sha` exists.
2. `implement-plan` keeps committed feature-state paths canonical to the repo root while still remembering the execution repo root and feature worktree path as operational metadata.
3. `.codex/implement-plan/features-index.json` stores enough per-feature operational handoff data to let `merge-queue` derive:
   - base branch
   - feature branch
   - worktree path
   - approved commit SHA
   - canonical feature root
4. `merge-queue` fetches the base ref and feature ref before merge and blocks the request if the approved SHA cannot be found locally after fetch.
5. `merge-queue` blocks the request if the approved SHA is not reachable from the fetched feature ref.
6. `merge-queue` exposes first-class `retry-request` and `requeue-request` actions so blocked entries do not require manual queue JSON repair.
7. `merge-queue` preserves request history for blocked or requeued entries instead of overwriting the evidence of failure.
8. `merge-queue` no longer rewrites tracked feature artifacts after enqueue, process, block, or merge success; post-approval operational closeout lives in local `.codex` state.
9. Dirty shared-root checkouts do not downgrade a successful merge into an ambiguous failure state; the helper either fast-forwards the shared root safely or records a truthful clean-worktree sync result.
10. Queue/helper failure output stays human-facing and clearly states the current outcome, blocker, and next safe action instead of collapsing to a generic helper-failed message.
11. `KPI Applicability: not required`
12. `KPI Route / Touched Path: not required for this workflow-only slice; the touched production-like paths are repo-owned skill helpers and workflow docs, not COO runtime routes`
13. `KPI Raw-Truth Source: local workflow helper behavior and local `.codex` operational state under C:/ADF/.codex`
14. `KPI Coverage / Proof: targeted helper smoke checks must prove merge-ready approved-SHA freeze, exact-SHA fetch and reachability validation, blocked-request retry/requeue, and local closeout without tracked post-approval rewrites`
15. `KPI Production / Proof Partition: proof runs in isolated feature and merge-queue worktrees; the fix must keep local operational `.codex` closeout separate from committed tracked artifacts`
16. `KPI Non-Applicability Rationale: this slice hardens internal workflow orchestration and local state management; it does not add or change a COO production route that requires new KPI telemetry instrumentation`
17. `KPI Exception Owner: None.`
18. `KPI Exception Expiry: None.`
19. `KPI Exception Production Status: None.`
20. `KPI Compensating Control: None.`
21. `Machine Verification Plan`
    - `node --check` on modified helper and runtime files
    - targeted `implement-plan-helper.mjs` smoke proving merge-ready freezes `approved_commit_sha`
    - targeted `merge-queue-helper.mjs` smoke proving:
      - missing approved SHA is blocked
      - missing fetched feature ref is blocked
      - unreachable approved SHA is blocked
      - blocked entries can be retried
      - requeue creates a new queued entry without erasing the blocked request
    - targeted queue processing smoke proving successful merge processing updates local `.codex` operational state without dirty tracked feature artifacts
- `Human Verification Plan`
  - `Required: false`
  - Reason: this slice changes internal workflow helpers and local orchestration semantics rather than a separate user-facing product route; machine verification and truthful artifact review are the right closure gates here.

7. Observability / Audit

- The workflow must make approved-commit authority explicit instead of silently falling back to `last_commit_sha`.
- The workflow must make it visible whether queue state comes from canonical local operational state or from tracked feature artifacts.
- Queue failure output must name the exact missing proof:
  - missing approved SHA
  - missing fetched feature ref
  - approved SHA not reachable from feature ref
  - shared-root sync skipped in favor of clean-worktree sync
- Feature artifacts and final reports must stay human-facing:
  - lead with outcome
  - separate findings and next actions
  - avoid dense wall-of-text failure dumps

8. Dependencies / Constraints

- Preserve the KPI governance rule in [kpi-instrumentation-requirement.md](/C:/ADF/docs/v0/kpi-instrumentation-requirement.md).
- Preserve the human-facing reporting rule recorded in [2026-04-03-human-facing-reporting-rule.md](/C:/ADF/docs/v0/context/2026-04-03-human-facing-reporting-rule.md).
- Keep `implement-plan` as the feature-slice integrity and handoff owner.
- Keep `merge-queue` as the exact-SHA landing and local operational closeout owner.
- Do not rely on Brain MCP writes because the current runtime still lacks the `project-brain` MCP tool surface.
- Keep the fix compatible with the dirty shared root checkout currently present at `C:/ADF`.

9. Non-Goals

- No COO runtime KPI code changes.
- No dashboard or analytics UI work.
- No broad review-cycle redesign.
- No git history rewriting or destructive cleanup of unrelated user work.
- No new workflow artifact family beyond the existing feature docs plus local `.codex` operational state already owned by these skills.

10. Source Authorities

- [README.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/README.md)
- [context.md](/C:/ADF/docs/phase1/implement-plan-review-cycle-kpi-enforcement/context.md)
- [kpi-instrumentation-requirement.md](/C:/ADF/docs/v0/kpi-instrumentation-requirement.md)
- [2026-04-03-human-facing-reporting-rule.md](/C:/ADF/docs/v0/context/2026-04-03-human-facing-reporting-rule.md)
- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
- [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs)
- [SKILL.md](/C:/ADF/skills/merge-queue/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/merge-queue/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/merge-queue/references/prompt-templates.md)
- [merge-queue-helper.mjs](/C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs)
- [governed-feature-runtime.mjs](/C:/ADF/skills/governed-feature-runtime.mjs)
