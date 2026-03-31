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
