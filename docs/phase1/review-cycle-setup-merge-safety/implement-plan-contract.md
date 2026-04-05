1. Implementation Objective

Prevent merge conflicts caused by tracked worktree-local governance setup files. `review-cycle` setup must remain local operational state under `.codex/`, not committed source, and governed merge closeout must reject approved commits that try to carry `.codex/*/setup.json` changes.

2. Slice Scope

- Remove the tracked repo copy of `.codex/review-cycle/setup.json` so future worktrees regenerate it locally instead of merging conflicting worktree paths.
- Keep the live review-cycle setup path the same: `<repo_root>/.codex/review-cycle/setup.json`.
- Update review-cycle contracts/docs so that setup is explicitly local operational state, auto-created or refreshed when missing, and never a mergeable source artifact.
- Add a deterministic merge-queue guard that rejects approved commits whose branch delta adds or modifies `.codex/*/setup.json`, while allowing the one-time tracked-file removal.
- Surface that guard truthfully in merge-queue skill/reference docs so the governed flow matches runtime behavior.

3. Required Deliverables

- delete tracked `.codex/review-cycle/setup.json` from source control
- merge-queue helper validation that blocks enqueue and process when the approved branch delta adds or modifies `.codex/*/setup.json`
- truthful rejection message that names the offending path(s)
- updated review-cycle docs explaining setup.json is local-only operational state
- updated merge-queue docs explaining local setup-file commits are rejected before merge
- feature-stream artifacts for this slice

4. Allowed Edits

- `C:/ADF/.codex/review-cycle/setup.json`
- `C:/ADF/skills/review-cycle/SKILL.md`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`
- `C:/ADF/skills/review-cycle/references/setup-contract.md`
- `C:/ADF/skills/merge-queue/SKILL.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`
- `C:/ADF/docs/phase1/review-cycle-setup-merge-safety/**`

5. Forbidden Edits

- do not redesign review-cycle execution reuse, reviewer routing, or implementor prompting
- do not redesign merge-queue lane ordering or merge strategy
- do not move setup to a second incompatible schema or a new public skill
- do not widen into `.codex` cleanup beyond the local setup-file merge hazard
- do not change product/runtime routes unrelated to governed workflow closeout

6. Acceptance Gates

1. A fresh checkout with no committed `.codex/review-cycle/setup.json` must still allow review-cycle to recreate setup locally when missing.
2. `merge-queue enqueue` must fail if the approved branch delta adds or modifies `.codex/*/setup.json`.
3. `merge-queue process-next` must also fail safely if a queued request that adds or modifies `.codex/*/setup.json` somehow reaches processing.
4. The failure message must identify the offending setup path(s) and explain they are local operational state.
5. Review-cycle docs must state that `.codex/review-cycle/setup.json` is local operational state and must not be committed.
6. No unrelated merge-queue or review-cycle behavior may change.

## KPI Applicability

KPI Applicability: not required
KPI Non-Applicability Rationale: This slice closes a governance merge-safety defect in local setup handling. It does not add or change a product runtime route that needs production KPI instrumentation.

## Vision / Phase 1 / Master-Plan / Gap-Closure Compatibility

Vision Compatibility: Strengthens durable governed execution by keeping local workflow state out of mergeable source history.
Phase 1 Compatibility: This is Phase 1 workflow-governance hardening. It supports the implementation/review/merge path and does not widen into later-company work.
Master-Plan Compatibility: This directly improves governed implementation closeout and reduces operational ambiguity caused by local-state merge conflicts.
Current Gap-Closure Compatibility: Supports Gap D parallel implementation safety by preventing cross-worktree governance-state collisions from reaching merge.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: The blocked merge on `implement-plan-provider-neutral-run-contract` was caused by a tracked worktree-local `.codex/review-cycle/setup.json` conflict, not by the feature code. Preventing local setup blobs from entering approved commits is the smallest truthful route fix.

## Machine Verification Plan

- run `node --check` on `skills/merge-queue/scripts/merge-queue-helper.mjs`
- run `git diff --check` on the changed source set
- smoke-check review-cycle local setup recreation by confirming setup is treated as missing or refreshable after the tracked file deletion
- smoke-check merge-queue guard with an approved branch delta that contains `.codex/*/setup.json`
- smoke-check the non-offending enqueue path still succeeds when the approved commit does not touch `.codex/*/setup.json`

## Human Verification Plan

- Required: false
- Reason: This slice is confined to internal governance/local-state handling and can be closed with deterministic helper checks plus review-cycle.

7. Observability / Audit

- merge-queue rejection output must name the offending `.codex/*/setup.json` path(s)
- review-cycle docs must explicitly say setup is local operational state
- fix-report proof must show both the rejection path and the allowed path

8. Dependencies / Constraints

- `.gitignore` already ignores `.codex/`, so the main source-control problem is the existing tracked file and any future forced-adds
- review-cycle setup regeneration must remain transparent to the invoker
- merge-queue must inspect the approved branch delta against its base branch, not just the tip commit title

9. Non-Goals

- no cleanup of every historical `.codex` artifact in the repo
- no redesign of implement-plan artifact placement in this slice
- no new benchmark or provider runtime behavior
- no human-testing route changes

10. Source Authorities

- `C:/ADF/docs/phase1/review-cycle-setup-merge-safety/README.md`
- `C:/ADF/docs/phase1/review-cycle-setup-merge-safety/context.md`
- `C:/ADF/skills/review-cycle/SKILL.md`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`
- `C:/ADF/skills/review-cycle/references/setup-contract.md`
- `C:/ADF/skills/merge-queue/SKILL.md`
- `C:/ADF/skills/merge-queue/references/workflow-contract.md`
- `C:/ADF/skills/merge-queue/scripts/merge-queue-helper.mjs`

11. Closeout Rules

- run review-cycle after implementation and machine verification
- keep the feature merge-ready only after review approval
- rely on merge-queue guardrails instead of manual normalization of local setup files
- do not mark complete until merge-queue lands truthfully
