# ARB Consolidated Open Findings

Date: 2026-03-31
Status: active consolidated findings

Related docs:

- [agent-role-builder-governance-workplan.md](C:/ADF/docs/v0/context/agent-role-builder-governance-workplan.md)
- [2026-03-30-governance-v1-audit-findings.md](C:/ADF/docs/v0/context/2026-03-30-governance-v1-audit-findings.md)
- [2026-03-30-governance-v1-runtime-followup-findings.md](C:/ADF/docs/v0/context/2026-03-30-governance-v1-runtime-followup-findings.md)
- [step2-run017-postmortem.md](C:/ADF/docs/v0/context/step2-run017-postmortem.md)
- [step2-run018-report.md](C:/ADF/docs/v0/context/step2-run018-report.md)

External review source:

- Codex agent `019d3dd7-893f-7313-b90c-64eabd28e2bc`

## Purpose

Consolidate the still-open items from:

- audit findings
- external implementation review
- run 018 live evidence
- follow-up discussion after run 018

This note is the current authoritative summary of:

- what Step 1 already closed
- what is still open before ARB run 19

## Current State

The lane has now proven one live positive-path governed run at:

- [agent-role-builder-self-role-018](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-self-role-018)

That run is useful evidence, but it does not close the remaining correctness, audit, telemetry, and terminology gaps listed below.

## Findings Status

### Closed in Step 1

#### 1. Final-round leader legality fail-closed gap

Status:

- closed in Step 1

Resolution:

- terminal-status legality now normalizes invalid leader `pushback` / `resume_required` when only non-material work remains
- invalid `frozen` and `frozen_with_conditions` normalization remains in place
- final rounds no longer drift to `resume_required` purely because minor/suggestion-only work remains

#### 2. Split-verdict final sanity enforcement

Status:

- closed in Step 1

Resolution:

- when the last rejecting reviewer becomes `approved` or true `conditional`, the lane now schedules one final `regression_sanity` pass for the previously approving reviewer
- freeze is blocked until that sanity pass completes

#### 3. `conditional` semantics ambiguity

Status:

- closed in Step 1

Resolution:

- `conditional` now means acceptable now with only non-blocking recommendations or deferred minor risks
- any blocking/major conceptual group under `conditional` is normalized back to `reject`

#### 4. Resume-package identity validation

Status:

- closed in Step 1

Resolution:

- resume-package validation now requires both `role_slug` and `request_job_id`
- cross-job resume state import for the same role now blocks cleanly

#### 5. `resume.session_registry_path` recovery support

Status:

- closed in Step 1

Resolution:

- `resume.session_registry_path` is now a real supplemental recovery input
- `resume_package_path` still owns artifact/reviewer state
- a newer session registry can now provide fresher provider handles for resume without discarding the governed resume package

#### 6. Session-handle reuse auditability

Status:

- closed in Step 1

Resolution:

- session-registry load now validates provider/model identity before marking a handle as loaded
- mismatches are recorded explicitly as ignored-provider or ignored-model drift
- durable registry writes now happen before the in-memory active-handle map is advanced

#### 8. Duplicate-job startup audit gap

Status:

- closed in Step 1

Resolution:

- the duplicate-job / existing-`result.json` guard now writes a structured startup incident before blocking

#### 10. Current engine naming is misleading and blocks architectural clarity

Status:

- closed in Step 1 for the active lane

Resolution:

- active lane naming is now:
  - `shared/rules-compliance-enforcer`
  - `shared/self-learning-engine`
- loader-level compatibility aliases remain temporarily so the lane can migrate without breaking older references in one jump
- the future runtime-healing surface remains a separate planned engine: `self-repair-engine`

### Still Open

#### 7. Telemetry and KPI reporting are still not truthful enough

Status:

- implemented in Step 2, live validation pending

Resolution:

- explicit llm-attempt telemetry now exists for board review, `self-learning-engine`, and `rules-compliance-enforcer`
- telemetry now aggregates:
  - llm call counts and failures
  - provider failures
  - reviewer success/error counts
  - estimated token in/out
  - estimated cost
  - session reuse economics
  - per-engine latency and failure summaries
- zero-round blocked runs no longer fabricate reviewer reuse savings

Run 018 evidence:

- [run-telemetry.json](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-self-role-018/runtime/run-telemetry.json)
- [cycle-postmortem.json](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-self-role-018/cycle-postmortem.json)

Remaining gap:

- run 19 / 20 still needs to validate that these KPI surfaces are truthful under a fresh live run

### 9. Run 018 exposed value, but not enough learning-cycle proof

Status:

- open

What run 018 proved:

- review -> learning evidence ran every round
- split-verdict savings were real
- rules-compliance revision flow converged
- provider sessions were captured and resumed within the run

What run 018 did not prove:

- quality of newly learned rules
- future-run promotion quality, because all three learning artifacts had `new_rules: []`
- rules cleanup / retirement behavior
- live KPI coverage on the new telemetry baseline

### 11. A true runtime self-heal path still does not exist

Status:

- implemented in Step 3 for bounded mechanical incidents, broader self-heal still open

Problem:

- ADF mission says self-learning, self-healing, self-improving
- the current lane has:
  - some learning
  - bounded governance hardening
  - partial session resume
- but no explicit runtime incident-repair engine

Impact:

- runtime faults still rely on narrow retries, inline overrides, or blocking behavior rather than a governed self-repair path

Step 3 freeze:

- `self-repair-engine` V1 is now frozen as a narrow mechanical slice
- the first repairable classes are:
  - supplemental `session-registry.json` missing or malformed on resume
  - provider CLI failures for board review, parse auto-fix, `self-learning-engine`, and `rules-compliance-enforcer`
- malformed resume packages, governance corruption, and semantic review disagreements remain non-repairable and must escalate explicitly
- `llm-tool-builder` is used for governed tool registration, while the executable runtime is implemented directly in `tools/self-repair-engine`

Delivered in Step 3:

- `tools/self-repair-engine` now exists as the explicit bounded runtime self-heal surface
- `agent-role-builder` now uses it for:
  - supplemental session-registry regeneration on resume
  - one bounded cold-start retry after provider CLI failures in board review
  - one bounded cold-start retry after provider CLI failures in parse auto-fix
  - one bounded cold-start retry after provider CLI failures in `self-learning-engine`
  - one bounded cold-start retry after provider CLI failures in `rules-compliance-enforcer`
- each repair attempt now writes explicit artifacts under `runtime/self-repair-engine/`

Remaining gap:

- the broader runtime self-heal vision is still open beyond these bounded mechanical classes

### 12. Rules GC is not implemented, but is now a required direction

Status:

- open

Discussion decision:

- rules GC should exist
- it should be a real metrics-driven lifecycle engine, not silent deletion
- it should run in the background, not as a blocking run step

Required inputs for GC:

- per-rule usage data
- per-rule hit/match frequency
- per-rule revision influence
- false-positive or reverted-rule evidence
- merge or supersede candidates
- scoring / quality signals

Required safety model:

- run snapshots remain immutable
- GC works from telemetry/history
- rulebook promotion must use version/hash checks
- no mid-run source mutation

### 13. Artifact quality itself is not yet being rated

Status:

- implemented in Step 2, live validation pending

Resolution:

- cycle postmortem now writes:
  - artifact quality score
  - quality band
  - cost-per-quality summary
  - latency-per-quality summary

Remaining gap:

- the first meaningful comparison is still deferred to the run 19 / 20 sanity pass and the later replay of run 01 on current code

## Frozen Discussion Decisions

These decisions came from the latest discussion and should now be treated as the current direction unless explicitly changed.

### Terminology

- `component-repair-engine` -> `rules-compliance-enforcer`
- `learning-engine` -> `self-learning-engine`
- add `self-repair-engine`
- later add `rules-gc`

### Reviewer semantics

- `conditional` means acceptable now with non-blocking recommendations only
- any remaining required fix means the reviewer is still effectively `reject`

### Split-verdict closeout

- skip already-approving reviewers during revision rounds
- when the rejecting reviewer becomes `approved` or true `conditional`, rerun only the previously approving reviewer for one final sanity check
- do not freeze before that sanity step

### Leader authority

- keep it simple for now
- leader must not hand off/freeze before reviewer approvals are in place
- no general leader-only acceptance of unresolved minor fixes

### Validation strategy

- do not revert code
- replay older run baselines such as run 01 on current code under a new job id
- use higher budget for the deep validation pass, but still keep it bounded

## Conclusion

The lane is no longer in the "basic viability unknown" state.

It has:

- one real convergent live run
- enough evidence to identify the next bottlenecks
- enough discussion decisions to freeze the next implementation direction

But it is still not ready for the final high-confidence replay run until the open issues above are addressed.

## Pre-Run 19 Delta From Latest Audit And Review

These findings were accepted after the Step 3 implementation review and the latest pre-run audit.

### 14. `self-repair-engine` records fake provider-failure incidents on clean success

Status:

- closed in Step 3A

Problem:

- the current wrapper records `provider_cli_failure` incident/result artifacts even when the primary invocation succeeds and no repair was needed
- the wrapper also emits successful `self-repair-engine` tool telemetry for that no-op path

Resolution:

- clean primary success through the wrapper now returns without writing `runtime/self-repair-engine/` artifacts
- the wrapper no longer emits `self-repair-engine` telemetry on no-op success paths

### 15. Reviewer KPI truth is still incomplete

Status:

- closed in Step 3A

Problem:

- reviewer success/error KPI logic still depends on free-form `ParticipantRecord.verdict`
- successful reviewer records store raw provider response text, not a normalized reviewer outcome

Resolution:

- reviewer participant records now persist normalized `reviewer_status` alongside the raw provider response text
- KPI aggregation now uses normalized reviewer outcome when present instead of guessing from raw JSON text

### 16. Engine latency attribution is still double-counting wrapped work

Status:

- closed in Step 3A

Problem:

- engine latency is currently aggregated across overlapping `llm` and `tool` events for the same underlying work

Resolution:

- engine summaries now use wall-clock `tool_latency_ms` when available and fall back to raw `llm_latency_ms` only when no tool wrapper timing exists
- `major_bottleneck_engine` now reflects wall-clock engine dominance instead of summed overlapping wrapper-plus-LLM latency

### 17. Supplemental session-registry repair can still fail open

Status:

- closed in Step 3A

Problem:

- if supplemental session-registry repair itself fails, the lane currently logs the failure and silently degrades to cold-start resume
- the current repair path also rewrites the supplied external registry path directly instead of materializing repaired runtime state under the current run

Resolution:

- supplemental session-registry repair now materializes repaired state under the current run instead of mutating the supplied external path
- if supplemental repair itself fails, the run now blocks cleanly with governed evidence instead of silently degrading to cold-start resume

## Run 019 Delta

Run 019 at:

- [agent-role-builder-self-role-019](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-self-role-019)

is useful, but only as partial evidence because it ran on commit `f357725`, before Step 3A landed in `4853dab`.

Accepted findings from the artifact inspection:

1. the real runtime blocker was leader terminal-status semantics, not raw infrastructure failure
2. the round-2 leader output attempted `frozen_with_conditions` with:
   - `arbitration_used=false`
   - `arbitration_rationale=null`
   - no unresolved items
   which the shared parser still rejected, even though the frozen reviewer-policy direction now allows `frozen_with_conditions` from true reviewer `conditional` closeout without mandatory arbitration
3. run 019's 15 `self-repair-engine` attempt folders are stale evidence from the pre-Step-3A wrapper behavior, not trustworthy proof of 15 real provider outages
4. current pre-replay work must therefore focus on:
   - leader status semantics alignment
   - minor-only `pushback` legality
   - split-verdict closeout enforcement re-verification
   - current-baseline re-verification that no-op self-repair artifacts stay absent

### 18. Run 019 terminal-status semantics mismatch

Status:

- closed in Step 4A

Resolution:

- shared leader parsing no longer requires arbitration evidence for every `frozen_with_conditions`
- `frozen_with_conditions` is now legal when no reviewer rejects and at least one true `conditional` or deferred minor item remains
- `arbitration_used=true` is now limited to actual minor-only arbitration on `frozen_with_conditions`, and is rejected on other statuses

### 19. Minor-only leader `pushback` could still force materiality

Status:

- closed in Step 4A

Resolution:

- board legality now derives repair state from normalized reviewer status plus review/self-check/compliance evidence
- explicit reviewer `reject` still remains material even if the associated conceptual groups are minor-only
- leader `pushback` alone no longer forces `resume_required` or `blocked` when the real unresolved state is non-material

### 20. In-flight telemetry still advertised future postmortem artifacts

Status:

- closed in Step 4A

Resolution:

- board phase telemetry no longer writes `run_postmortem_path` before `run-postmortem.json` exists

## In-Flight Review And Audit Delta

These findings were accepted while the replay run and a fresh-eye review were in progress. They do not change the earlier completed steps, but they do reopen the pre-replay hardening list.

### 21. Reviewer `error` can still freeze illegally

Status:

- open

Problem:

- reviewer transport/parse/runtime failures are converted into reviewer-local `error`
- leader synthesis drops those failed reviewer verdicts
- repair-state derivation still treats only explicit `reject` as approval-blocking
- terminal legality can therefore still allow `frozen` or `frozen_with_conditions` when the live reviewer state is effectively:
  - one reviewer `approved`
  - one reviewer `error`

Impact:

- the lane can still freeze while a reviewer slot never produced a usable governed approval
- this contradicts the frozen policy that freeze/handoff may happen only after reviewer approvals are in place

Accepted evidence:

- [board.ts](C:/ADF/tools/agent-role-builder/src/services/board.ts)
- [engine.ts](C:/ADF/shared/governance-runtime/engine.ts)
- [2026-03-31-arb-next-steps-workplan.md](C:/ADF/docs/v0/context/2026-03-31-arb-next-steps-workplan.md)

### 22. Repaired provider failures still disappear from core LLM economics

Status:

- open

Problem:

- when a primary provider call fails and `self-repair-engine` succeeds with one cold-start retry, the returned invocation result reflects only the repaired success path
- KPI aggregation still derives:
  - `llm_call_count`
  - `llm_failure_count`
  - `provider_failures`
  - token estimates
  - estimated cost
  - session spinup/resume economics
  from emitted `llm` attempts only
- that means the failed primary attempt can disappear from the main economics even though repair telemetry exists

Impact:

- replay analysis can still understate instability, retry cost, and real provider economics
- this is a KPI-truth blocker, not just a nice-to-have metric improvement

Accepted evidence:

- [index.ts](C:/ADF/tools/self-repair-engine/src/index.ts)
- [self-repair.ts](C:/ADF/tools/agent-role-builder/src/services/self-repair.ts)
- [run-telemetry.ts](C:/ADF/tools/agent-role-builder/src/services/run-telemetry.ts)
- [board.ts](C:/ADF/tools/agent-role-builder/src/services/board.ts)
- [role-generator.ts](C:/ADF/tools/agent-role-builder/src/services/role-generator.ts)

### 23. Cycle-postmortem `fallback_count` is still too narrow

Status:

- open

Problem:

- cycle postmortem still derives `fallback_count` only from board participant records
- broader engine telemetry can already record fallback-aware LLM attempts for:
  - `rules-compliance-enforcer`
  - `self-learning-engine`
  - future wrapped engines

Impact:

- postmortem fallback reporting can still understate the real amount of fallback behavior outside board participant records

### 24. Final sanity fan-out still drifts for larger reviewer rosters

Status:

- open

Problem:

- current final sanity routing reruns all previously approving reviewers
- the frozen discussion rule was narrower: rerun only the previously approving reviewer
- the request schema still allows `4` or `6` reviewers

Impact:

- larger rosters can still cost more and behave differently than the currently frozen simple closeout rule

### 25. Mixed source/dist loading remains an operational drift risk

Status:

- residual risk

Problem:

- `shared-module-loader.ts` is source-first and cwd-sensitive
- `shared-imports.ts` and `resume-state.ts` still pin key imports to `shared/dist`

Impact:

- stale dist builds or cwd drift can still produce inconsistent runtime behavior without changing source

### 26. Real provider CLI teardown on Windows is still not validated

Status:

- residual risk

Problem:

- managed timeout teardown is covered only by synthetic child-process tests
- there is still no real Codex/Claude/Gemini CLI process-tree teardown validation on Windows

Impact:

- the replay still depends on synthetic confidence for this part of the runtime contract

### 27. Codex still depends on `bash -c` on Windows

Status:

- residual risk

Problem:

- Codex invocation on Windows still depends on `bash -c`

Impact:

- the replay still assumes that shell dependency is present and operationally stable

### 28. Terminal result status is overloaded and hard to read

Status:

- open

Problem:

- the current top-level result still overloads one `status` field with multiple meanings:
  - run completion state
  - artifact governance state
  - effective review outcome
  - resume semantics
- this makes successful runs read as if `frozen` were a process/runtime state instead of an artifact-finalization state
- it also makes blocked and resume-required cases harder to classify mechanically without parsing free-form reason text

Discussion decision:

- split the result model into explicit human-readable fields
- prefer explicit string values over `null`
- use `"none"` instead of null-like empty state for error/status placeholders

Target shape:

- `run_status`
  - `complete | blocked | failed`
- `artifact_status`
  - `draft | frozen | frozen_with_conditions | pushback`
- `review_status`
  - `approved | approved_with_conditions | pushback | not_completed`
- `error_code`
  - stable machine code or `"none"`
- `resume_required`
  - `true | false`
- `resumable`
  - `true | false`
- keep `status_reason` as the human-readable explanation

Example for the successful replay:

- `run_status = "complete"`
- `artifact_status = "frozen"`
- `review_status = "approved"`
- `error_code = "none"`
- `resume_required = false`
- `resumable = false`

Impact:

- run reports become human-readable without losing machine utility
- replay/postmortem analysis no longer has to infer whether `frozen` means runtime completion or artifact finalization
- blocked and resume cases become easier to group and compare mechanically

## Additional Test Gaps

These gaps were confirmed by the latest review and audit and should remain visible until covered explicitly.

1. No test asserts that reviewer `error` blocks `frozen` and `frozen_with_conditions`.
2. No test covers `error -> approved/conditional` recovery and whether final sanity is required afterward.
3. No test pins bare-`conditional` semantics.
4. No test proves that repaired provider failures are counted in core LLM economics instead of disappearing behind the retry.
5. No test proves that cycle-postmortem `fallback_count` covers non-board engines, or explicitly documents that it does not.
6. No real provider CLI teardown test exists on Windows; current coverage is still the synthetic Node child-tree case.
7. No test pins the new split status model once it is implemented (`run_status`, `artifact_status`, `review_status`, `error_code`, `resume_required`, `resumable`).
