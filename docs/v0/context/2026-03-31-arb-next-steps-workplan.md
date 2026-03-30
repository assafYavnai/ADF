# ARB Next Steps Workplan

Date: 2026-03-31
Status: draft next-step execution plan

Related docs:

- [2026-03-31-arb-consolidated-open-findings.md](C:/ADF/docs/v0/context/2026-03-31-arb-consolidated-open-findings.md)
- [agent-role-builder-governance-workplan.md](C:/ADF/docs/v0/context/agent-role-builder-governance-workplan.md)
- [step2-run018-report.md](C:/ADF/docs/v0/context/step2-run018-report.md)

## Purpose

Freeze the next implementation order after:

- audit
- external review
- run 018
- follow-up architecture discussion

This is intentionally separated from the older governance workplan so the next execution round stays easy to scan.

## Scope-Control Rules

1. do not revert code to older run baselines
2. replay older run requests/artifacts on current code instead
3. keep validation runs bounded even when the budget is raised
4. no broad rollout to other tools/components during this slice
5. no silent rule deletion
6. no leader-only semantic handoff shortcuts

## Step Order

### Step 1. Terminology alignment and correctness fixes

Goal:

- clear the blocking correctness and terminology issues before broader telemetry or self-heal work

Status:

- implemented on current `main`

In scope:

- rename:
  - `component-repair-engine` -> `rules-compliance-enforcer`
  - `learning-engine` -> `self-learning-engine`
- update docs, prompts, contracts, code references, and context notes to use the new names
- fix the open correctness issues:
  - final-round legality fail-closed gap
  - split-verdict final sanity enforcement
  - `conditional` semantics alignment
  - resume-package `request_job_id` validation
  - `resume.session_registry_path` actual recovery support or explicit removal
  - session-handle mismatch auditability
  - duplicate-job startup incident path

Acceptance:

- naming is no longer architecturally misleading
- open correctness bugs above are closed

Delivered in this step:

- active shared-engine lane surfaces were renamed to:
  - `shared/rules-compliance-enforcer`
  - `shared/self-learning-engine`
- active `agent-role-builder` imports, runtime artifact paths, prompts, contract refs, and authority refs now use the new names
- legacy compatibility loader aliases remain in place so the current lane can transition without breaking older references in one jump
- final-round legality now fail-closes invalid leader `pushback` / `resume_required` when only non-material work remains
- split-verdict convergence now requires a final `regression_sanity` pass from the previously approving reviewer before freeze
- `conditional` semantics are now tightened to mean acceptable now with only non-blocking recommendations or deferred minor risks
- resume-package validation now requires `request_job_id` equality in addition to `role_slug`
- `resume.session_registry_path` is now a real supplemental recovery input for fresher session handles on resume
- session-handle load now validates provider/model identity explicitly and records mismatch status instead of silently pretending reuse
- duplicate-job startup guard now writes a structured startup incident before blocking

Validation completed for this step:

- `shared` TypeScript compile passed
- `agent-role-builder` TypeScript compile passed
- governance runtime legality tests passed
- invoker/session tests passed
- startup incident tests passed
- resume/session-registry tests passed
- board split-verdict/final-sanity tests passed

Frozen implementation slice:

1. rename the active shared-engine surfaces used by the lane:
   - `shared/component-repair-engine` -> `shared/rules-compliance-enforcer`
   - `shared/learning-engine` -> `shared/self-learning-engine`
2. update active lane imports, runtime artifact paths, prompts, contract refs, and current context docs to use the new names
3. keep this rename scoped to the current lane and shared runtime sources actually used by `agent-role-builder`
4. close the correctness gaps in the same slice:
   - final-round legality for illegal `pushback`
   - final sanity rerun after split-verdict convergence
   - tighter `conditional` semantics
   - resume-package `request_job_id` validation
   - real handling for `resume.session_registry_path`
   - explicit mismatch handling for session-handle/provider-model drift
   - startup incident for duplicate-job guard
5. keep out of scope for this slice:
   - KPI expansion
   - `self-repair-engine`
   - `rules-gc`
   - broad rollout to other tools/components

### Step 2. KPI and telemetry expansion

Goal:

- make the lane measurable enough to identify the real bottlenecks and future GC inputs

Status:

- implemented on current `main`

Required KPI families:

- run economics
- engine economics
- session economics
- convergence and quality
- rule lifecycle
- repair and resilience

Minimum additions:

- real token in/out
- estimated cost
- cold-start cost
- resumed-session cost
- per-engine latency and failure stats
- per-rule usage and influence metrics
- end-of-run artifact quality score
- cost-versus-value summary

Acceptance:

- postmortem answers what cost the run incurred
- where time went
- where tokens went
- what the major bottlenecks were
- whether the artifact was worth the effort

Delivered in this step:

- explicit LLM-attempt telemetry is now emitted for:
  - board reviewer and leader calls
  - `self-learning-engine`
  - `rules-compliance-enforcer`
- telemetry now tracks:
  - llm call count
  - llm failures
  - estimated tokens in/out
  - estimated cost
  - session status counts (`none`, `fresh`, `resumed`, `replaced`)
  - session latency by status
  - provider failures
- engine-level KPI summaries now exist for:
  - `board-review`
  - `self-learning-engine`
  - `rules-compliance-enforcer`
- rule-lifecycle-oriented metrics now aggregate:
  - rules checked
  - non-compliant rule hits
  - learning coverage hits
  - new rule proposals
- cycle postmortem now records:
  - major bottleneck engine
  - phase durations from `runtime/run-history.jsonl`
  - artifact quality score
  - cost-per-quality and latency-per-quality summaries
- zero-round reviewer reuse savings no longer fabricate reuse on blocked runs

Important note:

- token and cost reporting are now explicit heuristic estimates, not provider billing truth
- live validation of these KPI surfaces is deferred to run 19 / 20

### Step 3. `self-repair-engine` V1

Goal:

- add the first explicit self-healing engine for runtime incidents

Status:

- next active implementation slice

Name:

- `self-repair-engine`

Creation approach:

- create with tool-builder and wire it explicitly into the lane

In scope for V1:

- malformed or unreadable runtime artifacts
- missing generated artifacts
- provider CLI failures
- bounded relaunch / retry
- explicit incident and repair audit artifacts

Out of scope:

- semantic governance rewriting
- silent source-governance mutation
- broad cross-tool rollout

Acceptance:

- at least the mechanical runtime incident classes above can be repaired or escalated through one explicit engine path

### Step 4. Run 19 and maybe 20 as bounded sanity runs

Goal:

- validate the current lane after steps 1 to 3

Run shape:

- bounded
- explicit max rounds
- hard wall-clock timeout
- teardown guarantee
- full telemetry and postmortem

Purpose:

- sanity check the renamed engines
- verify correctness fixes
- verify KPI coverage
- verify `self-repair-engine` path under live conditions if incidents occur

### Step 5. Replay run 01 baseline on current code under a new job id

Goal:

- obtain a cleaner before/after comparison against an older baseline without reverting code

Rules:

- reuse the old request/artifact baseline
- new job id only
- preserve current code
- preserve current telemetry and audit model

Purpose:

- compare quality, convergence, latency, cost, and resilience against older behavior

### Step 6. Deep ARB validation run with higher budget

Goal:

- run a serious resilience/improvement validation after the earlier sanity passes

Important rule:

- higher budget, not unlimited

Boundaries:

- explicit max rounds
- explicit timeout
- explicit teardown
- full telemetry

Purpose:

- observe convergence under less artificial pressure
- measure true bottlenecks
- gather richer rule-lifecycle data

### Step 7. Full postmortem

Goal:

- review the improved lane from three angles

Required outputs:

- audit pass
- fresh-eye implementation review
- run analysis
- KPI analysis

Key questions:

- did the fixes remove the known correctness gaps
- did telemetry become truthful
- is the lane economically viable
- is the output worth the cost

### Step 8. `rules-gc` V1

Goal:

- begin the self-improving layer after real data exists

Name:

- `rules-gc`

Operating model:

- background process
- non-blocking to active runs
- explicit locking / compare-and-swap promotion
- proposal and audit artifacts

Inputs:

- per-rule KPIs from `rules-compliance-enforcer`
- proposal and coverage data from `self-learning-engine`
- run/postmortem evidence

Outputs:

- duplicate candidates
- merge candidates
- deprecation candidates
- supersession links
- promoted cleanup proposals

Acceptance:

- GC can improve rulebook hygiene without mutating active run snapshots or silently deleting rules

## Reviewer Policy To Freeze In Implementation

These discussion decisions should be implemented as part of Step 1.

### Conditional semantics

- `approved`: no required changes remain
- `reject`: at least one required change remains
- `conditional`: acceptable now; only non-blocking recommendations or deferred minor risks remain

### Split-verdict closeout

- during revision rounds, skip already-approving reviewers
- when the rejecting reviewer becomes `approved` or true `conditional`, rerun only the previously approving reviewer for one final sanity check
- freeze only after that sanity check passes

### Leader handoff

- leader must not freeze/hand off before reviewer approvals are in place
- no general leader-only resolution of unresolved minor issues

## Expected Deliverables Before Replay

Before Step 5 starts, the lane should have:

1. corrected correctness behavior
2. renamed engine terminology
3. truthful KPI surfaces
4. explicit `self-repair-engine` path
5. bounded-run validation evidence from run 19 or 20

## Close Condition

This next-step plan is complete only when:

1. Steps 1 through 8 are either implemented or explicitly reclassified
2. the replay baseline run has been executed
3. `rules-gc` V1 direction is frozen from real data, not only discussion
