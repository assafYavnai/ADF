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

- implemented on current `main`

Name:

- `self-repair-engine`

Creation approach:

- create with tool-builder and wire it explicitly into the lane

Frozen V1 slice:

1. use `llm-tool-builder` only for governed tool registration and bootstrap tool-contract ownership
2. implement the executable runtime directly in `tools/self-repair-engine`
3. keep the first repairable classes narrow and mechanical:
   - supplemental `session-registry.json` missing or malformed on resume
   - provider CLI failures during:
     - board reviewer / leader invocation
     - parse auto-fix invocation
     - `self-learning-engine`
     - `rules-compliance-enforcer`
4. use one explicit incident/result artifact path under each run:
   - `runtime/self-repair-engine/`
5. permit only bounded repair actions in V1:
   - backup + regenerate compatible supplemental session registry state
   - one explicit cold-start relaunch after provider CLI failure
6. treat these as non-repairable in V1:
   - malformed resume package
   - governance snapshot / authority corruption
   - semantic review verdict disagreements
7. keep out of scope for this slice:
   - semantic governance rewriting
   - source-governance mutation
   - broad cross-tool rollout
   - generalized background fixer orchestration
   - repair of canonical promoted artifacts

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
- `llm-tool-builder` registration exists for `self-repair-engine`
- `agent-role-builder` routes the mechanical classes in this frozen slice through `self-repair-engine`
- non-repairable classes escalate with explicit `self-repair-engine` incident artifacts instead of ad hoc handling

Delivered in this step:

- `tools/self-repair-engine` now exists as a governed registered tool with:
  - bootstrap role
  - tool contract written through `llm-tool-builder`
  - direct runtime implementation in `src/index.ts`
- `agent-role-builder` now routes these mechanical classes through `self-repair-engine`:
  - supplemental `session-registry.json` missing or malformed on resume
  - provider CLI failures for:
    - board reviewer and leader calls
    - parse auto-fix calls
    - `self-learning-engine`
    - `rules-compliance-enforcer`
- `self-repair-engine` now writes explicit per-attempt artifacts under:
  - `runtime/self-repair-engine/`
- bounded repair behavior in V1 is now:
  - backup + regenerate supplemental session registry state
  - one explicit cold-start relaunch after provider CLI failure
  - explicit escalation artifact for non-repairable or still-failing cases

Validation completed for this step:

- `tools/self-repair-engine` TypeScript compile passed
- `tools/self-repair-engine` unit tests passed
- `agent-role-builder` TypeScript compile passed
- `shared` TypeScript compile passed
- `agent-role-builder` self-repair wrapper test passed

### Step 3A. Pre-run 19 telemetry and repair truthfulness delta

Goal:

- close the remaining audit-truth gaps found after Step 3 so run 19 becomes worth running

Status:

- implemented on current `main`

In scope:

- stop `self-repair-engine` from writing incident/result artifacts on clean success
- stop `self-repair-engine` wrapper telemetry from recording no-op repair events
- make reviewer KPI counting use normalized reviewer outcomes instead of raw provider response strings
- remove double-counted engine latency from bottleneck attribution
- make supplemental session-registry repair fail closed and keep repaired runtime state under the current run

Acceptance:

- clean provider calls leave no repair artifacts and no repair KPI events
- reviewer success/error counts are truthful on the live board data model
- per-engine latency attribution does not double-count wrapped work
- supplemental session-registry repair either succeeds into run-local state or blocks/escalates explicitly

Delivered in this step:

- `self-repair-engine` clean primary success no longer writes incident/result artifacts
- the ARB self-repair wrapper no longer emits repair telemetry for no-op success paths
- reviewer participant records now persist normalized `reviewer_status` for KPI truth
- reviewer KPI aggregation now keys off normalized reviewer outcome instead of raw provider response text when available
- per-engine `total_latency_ms` and `major_bottleneck_engine` now use wall-clock wrapper time when present instead of summing overlapping wrapper and LLM latencies
- supplemental session-registry repair now writes repaired state under the current run
- supplemental session-registry repair failure now blocks explicitly instead of silently degrading to cold-start resume

Validation completed for this step:

- `tools/self-repair-engine` targeted tests passed
- `agent-role-builder` self-repair targeted tests passed
- `agent-role-builder` run telemetry targeted tests passed
- `agent-role-builder` TypeScript compile passed
- `tools/self-repair-engine` TypeScript compile passed
- `shared` TypeScript compile passed

### Step 4. Run 19 and maybe 20 as bounded sanity runs

Goal:

- validate the current lane after steps 1 to 3A

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

Status update after run 019 on commit `f357725`:

- run 019 is now treated as stale validation evidence for `self-repair-engine` and KPI truth because it predates Step 3A (`4853dab`)
- the next execution slice before the long replay is a battle-readiness delta, not another immediate live rerun

#### Step 4A. Pre-replay battle-readiness delta

Goal:

- close the remaining correctness and audit gaps before the unattended replay of the run 01 baseline

Status:

- implemented on current `main`

Frozen scope:

1. unify leader terminal-status semantics across prompt, parser, board legality, and runtime closeout:
   - `approved` reviewers only -> `frozen`
   - no `reject`, at least one true `conditional` -> `frozen_with_conditions`
   - `arbitration_used=true` becomes optional evidence for `frozen_with_conditions`, not a mandatory precondition
2. remove any remaining logic where leader `pushback` itself forces materiality when the actual unresolved set is minor-only
3. keep split-verdict closeout exactly as frozen:
   - skip already-approving reviewers during repair rounds
   - when the rejecting reviewer becomes `approved` or true `conditional`, rerun only the previously approving reviewer as final sanity
4. re-verify that `self-repair-engine` leaves no artifacts or KPI events on clean success paths on the current code baseline
5. include narrow telemetry/audit hardening that materially affects unattended replay analysis

Acceptance:

- the run 019 round-2 leader output shape becomes legal on current semantics when it reflects true reviewer conditionals with no reject verdicts
- leader `pushback` no longer forces `resume_required` or `blocked` on minor-only unresolved work
- split-verdict final-sanity behavior remains mechanically enforced
- no-op repair artifacts remain absent on clean success paths

After this step:

- do not rerun the stale run 019 job
- replay the run 01 baseline under a new job id with a 10-cycle cap or until approved

Delivered in this step:

- shared leader prompt and parser semantics are now aligned:
  - `frozen` = all reviewers approved
  - `frozen_with_conditions` = no reviewer rejects and at least one true `conditional` or deferred minor item remains
  - `arbitration_used=true` is now optional evidence for `frozen_with_conditions`, not a mandatory precondition
  - arbitration evidence is now rejected on statuses other than `frozen_with_conditions`
- board legality no longer lets leader `pushback` force materiality by itself when the actual reviewer/checklist state is minor-only
- reviewer `reject` still remains material even when the associated findings are only minor, so freeze cannot bypass an explicit rejecting reviewer
- in-flight board telemetry no longer advertises `run-postmortem.json` before that file exists

Validation completed for this step:

- shared review-engine leader parser tests passed
- shared governance-runtime legality tests passed
- `agent-role-builder` board legality tests passed
- `shared` TypeScript compile passed
- `agent-role-builder` TypeScript compile passed

#### Step 4B. Pre-replay legality and economic-truth delta

Goal:

- close the last correctness and KPI-truth blockers identified by the in-flight review and audit before trusting the run 01 replay

Status:

- open

Frozen scope:

1. make reviewer `error` explicitly approval-blocking for terminal legality:
   - freeze must not be legal while any active reviewer slot remains `error`
   - choose one explicit policy:
     - short-circuit before leader synthesis
     - or represent missing approval in legality so freeze fail-closes
2. make repaired provider failures visible in the main LLM economics:
   - failed primary attempt
   - repaired retry attempt
   - true provider/session cost
   - true provider-failure count
3. align cycle-postmortem `fallback_count` with the broader engine telemetry surface
4. freeze the intended large-roster final-sanity behavior:
   - either one designated prior approver
   - or all prior approvers
   and then implement/test exactly that policy
5. split terminal result semantics into explicit fields:
   - `run_status`
   - `artifact_status`
   - `review_status`
   - `error_code`
   - `resume_required`
   - `resumable`
   - use `"none"` instead of null-like empty state where no error/status code applies
6. add the missing tests that make the replay results trustworthy

Acceptance:

- `approved + error` or `conditional + error` can no longer terminate as `frozen` or `frozen_with_conditions`
- repaired provider failures appear in the main economics instead of disappearing behind self-repair success
- cycle postmortem fallback reporting matches the chosen telemetry surface
- final-sanity behavior is mechanically defined for `2`, `4`, and `6` reviewer rosters
- terminal artifacts no longer overload one `status` field with run/artifact/review meaning
- new tests cover the freeze-on-error, repaired-failure KPI, and split-status-result paths

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

Precondition:

- Step 4B must be closed first, otherwise the replay may still be audit-interesting but not trustable as a correctness/economics baseline

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

### Step 9. Enforcer runtime-shape decision

Goal:

- decide the permanent `rules-compliance-enforcer` review shape from measured evidence, not theory

Status:

- in experiment

Frozen policy:

- keep both active experiment tracks for now:
  - `per-rule`
  - `grouped-by-relevance`
- do not collapse to one path until more data exists
- continue using the locked run 01 baseline fixture and the shared KPI model for comparable tests

Current `live-002` interpretation:

- time winner: `grouped-by-relevance`
- cost winner: `grouped-by-relevance`
- quality winner: `per-rule`

Likely implementation direction to test next:

- support explicit optimization profiles instead of one hardcoded path:
  - `speed`
  - `cost`
  - `quality`

Current provisional mapping:

- `speed` -> `grouped-by-relevance`
- `cost` -> `grouped-by-relevance`
- `quality` -> `per-rule`

Important note:

- this mapping is provisional only
- more experiments may later separate `cost` from `speed`

Acceptance:

- enough experiments exist to justify a stable implementation choice
- grouped plus targeted second-pass coverage has been tested
- the runtime optimization-profile design is either frozen or explicitly rejected

### Step 10. Enforcer loop convergence experiments

Goal:

- move from first-pass review economics to full `review -> fix -> review` convergence testing without the governance layer

Status:

- frozen for implementation

Required rules:

1. use the same core engines as ARB where possible
2. keep the governance layer out of the test harness
3. persist and reuse provider sessions across cycles
4. run all scenario variants in parallel
5. maximize shared reusable components between tests

Experiment groups:

- Group A:
  - `per-rule-full`
  - `grouped-full`
- Group B:
  - `per-rule-shrinking`
  - `grouped-shrinking`
- Group C:
  - `per-rule-learning`
  - `grouped-learning`

Frozen intent:

- Group A tests full-loop speed against the current live path
- Group B tests whether shrinking active rules keeps enough quality at lower effort
- Group C tests whether learning should enter the loop only after the second failed review

Acceptance:

- the shared loop-test core exists
- all six scenario variants can run from the same locked baseline fixture
- session resume works across cycles
- result artifacts are comparable across all variants

Live `002` result:

- completed after fixing Windows prompt-size failure by switching reviewer tasks to file-backed bundles
- all 6 scenarios then ran in parallel successfully
- `grouped-full` beat `per-rule-full` on both time and final findings
- `grouped-shrinking` is the current speed/cost leader
- `per-rule-shrinking` is the current quality leader by a small margin
- `self-learning-engine` did not justify its added overhead in this slice

Current recommendation:

- treat `grouped-shrinking` as the leading production candidate
- keep `per-rule-shrinking` as the quality-mode candidate
- do not collapse to one permanent path yet; gather more evidence before freezing implementation

Next sandbox expansion:

- move off the weak run-01 fixture and onto the stronger `implementation-engine` role draft
- run the next 4-scenario matrix in true parallel:
  - `grouped-full-implementation`
  - `grouped-shrinking-implementation`
  - `grouped-targeted-shrinking-implementation`
  - `per-rule-shrinking-implementation`
- use the grouped-targeted variant to test whether the historically weak grouped rules can be pulled into focused per-rule review without giving back most of the runtime gain
- keep learning out of this next group until the stronger artifact proves it is still needed

Live result:

- `grouped-shrinking-implementation` approved the stronger implementation-engine role draft in `17m 58.7s` over `3` cycles
- `grouped-full-implementation` also approved, but slower at `27m 15.9s`
- `grouped-targeted-shrinking-implementation` approved, but did not justify its extra complexity or time at `30m 29.9s`
- `per-rule-shrinking-implementation` hit `cycle_cap` with `3` residual findings after `40m 54.7s`

Current implication:

- keep `grouped-shrinking` as the leading non-ARB production candidate
- do not adopt the targeted hybrid yet
- treat the missing governed companion contract package for `implementation-engine` as the next sandbox blocker before deciding any live ARB change

Next sandbox readiness matrix:

- freeze the chosen shape to `grouped-shrinking`
- run only readiness checks from now on:
  - role + contract pair
  - final full sanity sweep
  - forced checkpoint/resume
  - repeatability across 3 batches
- execute 4 scenarios in parallel per batch and repeat the batch 3 times
- track this under:
  - `docs/v0/context/2026-03-31-grouped-shrinking-readiness-plan.md`

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
6. Step 4B closed:
   - reviewer `error` freeze legality fixed
   - repaired provider-failure economics fixed
   - fallback-count scope fixed or explicitly frozen
   - final-sanity policy for larger rosters fixed and tested
   - terminal status model split into explicit run/artifact/review/error/resume fields

## Close Condition

This next-step plan is complete only when:

1. Steps 1 through 8 are either implemented or explicitly reclassified
2. the replay baseline run has been executed
3. `rules-gc` V1 direction is frozen from real data, not only discussion
