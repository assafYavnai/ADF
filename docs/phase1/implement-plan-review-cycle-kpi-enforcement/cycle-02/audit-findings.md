1. Findings

Overall Verdict: REJECTED

Finding 1

failure class: stale fetched-ref authorization bypass  
broken route invariant in one sentence: `merge-queue` must fail closed unless the target base ref and containing feature ref were fetched successfully for this run, but `process-next` continues on stale local refs when fetch fails.  
exact route (A -> B -> C): `merge-queue enqueue -> process-next fetch base/feature refs -> merge worktree merge/push`  
exact file/line references: [merge-queue-helper.mjs:513](/c/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-review-cycle-kpi-enforcement/skills/merge-queue/scripts/merge-queue-helper.mjs#L513), [merge-queue-helper.mjs:525](/c/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-review-cycle-kpi-enforcement/skills/merge-queue/scripts/merge-queue-helper.mjs#L525), [merge-queue-helper.mjs:547](/c/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-review-cycle-kpi-enforcement/skills/merge-queue/scripts/merge-queue-helper.mjs#L547), [merge-queue-helper.mjs:1093](/c/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-review-cycle-kpi-enforcement/skills/merge-queue/scripts/merge-queue-helper.mjs#L1093), [workflow-contract.md:81](/c/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-review-cycle-kpi-enforcement/skills/merge-queue/references/workflow-contract.md#L81), [implement-plan-contract.md:72](/c/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-review-cycle-kpi-enforcement/docs/phase1/implement-plan-review-cycle-kpi-enforcement/implement-plan-contract.md#L72), [completion-summary.md:9](/c/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-review-cycle-kpi-enforcement/docs/phase1/implement-plan-review-cycle-kpi-enforcement/completion-summary.md#L9)  
concrete operational impact: a blocked network or remote failure can still let the queue merge against a stale `origin/<base_branch>` or stale local/remote feature ref, so post-review closeout can report success for a route that was not re-proved against the latest authority.  
KPI applicability: not required for the workflow-only slice itself; the defect breaks the governed KPI-closure handoff route this slice claims to harden.  
KPI closure state: Open  
KPI proof or exception gap: the contract requires fetched-ref proof and the summary claims exact-SHA fetch validation, but there is no fail-closed path or recorded negative proof for “fetch failed while stale refs already existed locally.”  
Compatibility verdict: Incompatible against the Vision, Phase 1, Master-Plan, and Gap-Closure authority chain because merge authorization still depends on cached local git state instead of fresh route proof.  
sweep scope: `skills/merge-queue/scripts/merge-queue-helper.mjs`, `skills/merge-queue/references/workflow-contract.md`, `skills/merge-queue/SKILL.md`, and this feature’s closeout docs that currently claim the fetch/validation route is closed.  
closure proof: a targeted smoke must force `git fetch origin <base_branch>` and `git fetch origin <feature_branch>` to fail while stale refs still exist locally, and `process-next` must block before worktree-add, merge, or push.  
shared-surface expansion risk: present in the shared `process-next` path for every merge lane.  
negative proof required: disprove that stale `origin/<base_branch>` or local `<feature_branch>` refs can satisfy reachability and allow merge after a fetch failure.  
live/proof isolation risk: present because current proof covers happy-path and missing-ref cases, not failing-fetch-with-cached-ref cases.  
claimed-route vs proved-route mismatch risk: present because the code only validates local availability after a best-effort fetch, while the docs claim fetched-ref validation.  
status: live defect

Finding 2

failure class: mutable checkout authority leak  
broken route invariant in one sentence: base-branch authority must be deterministic and independent of the shared-root checkout branch, but default base-branch resolution currently follows the mutable current branch.  
exact route (A -> B -> C): `implement-plan prepare/load-state -> .codex features-index handoff -> merge-queue enqueue/process-next target lane`  
exact file/line references: [governed-feature-runtime.mjs:572](/c/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-review-cycle-kpi-enforcement/skills/governed-feature-runtime.mjs#L572), [implement-plan-helper.mjs:405](/c/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-review-cycle-kpi-enforcement/skills/implement-plan/scripts/implement-plan-helper.mjs#L405), [implement-plan-helper.mjs:1227](/c/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-review-cycle-kpi-enforcement/skills/implement-plan/scripts/implement-plan-helper.mjs#L1227), [implement-plan-helper.mjs:1290](/c/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-review-cycle-kpi-enforcement/skills/implement-plan/scripts/implement-plan-helper.mjs#L1290), [merge-queue-helper.mjs:224](/c/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-review-cycle-kpi-enforcement/skills/merge-queue/scripts/merge-queue-helper.mjs#L224), [workflow-contract.md:351](/c/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-review-cycle-kpi-enforcement/skills/implement-plan/references/workflow-contract.md#L351), [implement-plan-contract.md:66](/c/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-review-cycle-kpi-enforcement/docs/phase1/implement-plan-review-cycle-kpi-enforcement/implement-plan-contract.md#L66), [completion-summary.md:33](/c/ADF/.codex/implement-plan/worktrees/phase1/implement-plan-review-cycle-kpi-enforcement/docs/phase1/implement-plan-review-cycle-kpi-enforcement/completion-summary.md#L33)  
concrete operational impact: if the shared root is on the wrong branch, a new feature can persist the wrong `base_branch`, queue into the wrong lane, and merge approved work into the wrong target branch; in this worktree `origin/HEAD` is absent, so the current-branch fallback is the active authority path.  
KPI applicability: not required for the workflow-only slice itself; the defect still breaks the governed closeout authority chain that is supposed to keep KPI applicability and closure routing deterministic after review approval.  
KPI closure state: Open  
KPI proof or exception gap: the proof set shows canonical-root reads and queue happy-path checks, but nothing proves base-branch resolution stays correct when the shared root is dirty on a non-target branch or when `origin/HEAD` is unavailable.  
Compatibility verdict: Incompatible against the Vision, Phase 1, Master-Plan, and Gap-Closure authority chain because branch-target authority still depends on mutable operator checkout state.  
sweep scope: `skills/governed-feature-runtime.mjs` plus every `detectDefaultBaseBranch(...)` caller in `implement-plan` and `merge-queue`, and any docs/examples that promise deterministic branch handoff.  
closure proof: a targeted smoke must run with the shared root on a feature or detached branch, with `origin/HEAD` missing or divergent, and show that prepare/enqueue still freeze the intended target branch rather than the current checkout branch.  
shared-surface expansion risk: present because the bug sits in a shared runtime helper and propagates into both `implement-plan` and `merge-queue`.  
negative proof required: disprove that changing the shared-root checkout branch changes persisted `base_branch` or queue lane selection.  
live/proof isolation risk: present because current proof assumes a benign shared-root branch state that the contract explicitly says cannot be trusted.  
claimed-route vs proved-route mismatch risk: present because the contracts require deterministic branch resolution, but the implementation delegates that authority to current checkout state and the proof never exercises the hostile branch-state case.  
status: live defect

2. Conceptual Root Cause

Cause 1

missing contract or policy: fresh-ref proof was written as a route requirement, but helper control flow still treats fetch success as advisory. The invariant that review approval must be re-proved against freshly fetched base and feature refs before merge was not enforced fail-closed.

Cause 2

missing contract or policy: target-branch authority was never frozen to a stable source. The new shared helper conflates “current checkout branch” with “default base branch,” so closeout still depends on mutable shared-root operator state instead of canonical workflow authority.

3. High-Level View Of System Routes That Still Need Work

Route 1

what must be frozen before implementation: successful fetch of the target base ref and the feature ref that is supposed to contain `approved_commit_sha`.  
why endpoint-only fixes will fail: patching only the reachability check or only the human-facing error text still leaves stale local refs able to authorize a merge.  
the minimal layers that must change to close the route: `skills/merge-queue/scripts/merge-queue-helper.mjs`, the matching `merge-queue` workflow contract wording, and a smoke that proves fetch failure blocks even when cached refs exist.  
explicit non-goals, so scope does not widen into general refactoring: no queue-schema redesign, no review-cycle redesign, no telemetry work.  
what done looks like operationally: any fetch failure blocks the request, preserves queue evidence, creates no merge/push side effects, and success only occurs after reachability is proved against freshly fetched refs.

Route 2

what must be frozen before implementation: canonical target-branch authority that does not vary with the shared-root checkout branch.  
why endpoint-only fixes will fail: fixing only `merge-queue enqueue` or only `implement-plan prepare` still leaves another caller able to persist the wrong `base_branch` into features-index or queue state.  
the minimal layers that must change to close the route: `skills/governed-feature-runtime.mjs`, all `detectDefaultBaseBranch(...)` callers in `implement-plan` and `merge-queue`, plus targeted proof for hostile shared-root branch state.  
explicit non-goals, so scope does not widen into general refactoring: no broader worktree redesign, no review-cycle multi-cycle changes, no unrelated git cleanup.  
what done looks like operationally: the same feature stream resolves the same `base_branch` from any shared-root branch state, queues into the intended lane, and can only merge into that lane.

Final Verdict: REJECTED