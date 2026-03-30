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

This note is the current authoritative summary of what is still open before the next major implementation round.

## Current State

The lane has now proven one live positive-path governed run at:

- [agent-role-builder-self-role-018](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-self-role-018)

That run is useful evidence, but it does not close the remaining correctness, audit, telemetry, and terminology gaps listed below.

## Open Findings

### 1. Final-round leader legality is still not fail-closed

Status:

- open

Problem:

- illegal leader `pushback` on minor-only unresolved work can still drive the final round to `resume_required`
- the legality helper normalizes illegal `frozen` and `frozen_with_conditions`, but not illegal `pushback`

Impact:

- the lane can still end with the wrong terminal status and a misleading audit story

Why it matters:

- run 018 succeeded only because one illegal leader `frozen` was corrected inline
- that is evidence of useful override behavior, but also proof that terminal legality is still incomplete

### 2. Split-verdict final sanity is not enforced strongly enough

Status:

- open

Problem:

- the code still has a `regression_sanity` mode hook
- but the live loop can freeze in the same round that the last rejecting reviewer becomes `approved` or `conditional`
- this does not guarantee the authority requirement that the previously approving reviewer reruns one final sanity check

Impact:

- the split-verdict optimization can still skip the final regression-safety step

Discussion decision:

- keep split review optimization
- when the rejecting reviewer reaches `approved` or `conditional`, rerun only the previously approving reviewer for the final sanity check

### 3. `conditional` semantics are still too ambiguous

Status:

- open

Problem:

- `conditional` currently behaves like a non-reject in many places
- but in discussion it became clear that it is ambiguous whether `conditional` means:
  - usable now with non-blocking recommendations
  - or still requires a minor fix before handoff

Decision from discussion:

- tighten semantics
- `conditional` must mean:
  - usable now
  - no required fixes remain
  - only non-blocking recommendations or deferred minor risks remain

Impact:

- terminal-status rules, split-verdict logic, and postmortem interpretation all depend on this definition

### 4. Resume-package identity validation is incomplete

Status:

- open

Problem:

- resume-package mismatch checking currently validates `role_slug`
- it does not hard-require `request_job_id` equality

Impact:

- a rerun can import foreign markdown, reviewer state, learning state, or session state from another job with the same role

### 5. `resume.session_registry_path` is still not a true recovery input

Status:

- open

Problem:

- the request schema exposes `resume.session_registry_path`
- the live resume load path still depends on `resume_package_path`
- partial bounded runs can therefore capture session handles without being able to resume from them directly unless a resume package exists

Impact:

- nonterminal bounded stops can still strand usable session data

### 6. Session-handle load and reuse are not fully explicit/auditable

Status:

- open

Problem:

- session-registry load currently marks slot-key matches as loaded without validating provider/model identity
- the invoker can silently cold-start when a mismatched handle is passed
- registry-write failure after a successful invocation can also leave in-memory handle state ahead of durable state

Impact:

- runtime/session audit can claim persisted-session reuse even when the current call actually fell back to a fresh session

### 7. Telemetry and KPI reporting are still not truthful enough

Status:

- open

Problem:

- current telemetry still underreports or zeros out:
  - `llm_call_count`
  - `provider_failures`
  - `reviewer_success_count`
  - `reviewer_error_count`
  - token usage
  - cost
- zero-round blocked runs can also fabricate reviewer reuse savings

Run 018 evidence:

- [run-telemetry.json](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-self-role-018/runtime/run-telemetry.json)
- [cycle-postmortem.json](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-self-role-018/cycle-postmortem.json)

Impact:

- the lane cannot yet answer the CEO's real questions about cost, bottlenecks, session economics, or whether the output was worth the effort

### 8. Startup audit is improved but not fully universal

Status:

- open

Problem:

- many startup failures now produce startup incidents
- one known pre-run blocked path still bypasses structured startup audit:
  - duplicate job / existing `result.json`

Impact:

- not every pre-run blocked path is yet inside the audit envelope

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
- truthful KPI coverage

### 10. Current engine naming is misleading and blocks architectural clarity

Status:

- open

Discussion decision:

- rename `component-repair-engine` to `rules-compliance-enforcer`
- rename `learning-engine` to `self-learning-engine`
- introduce a separate `self-repair-engine`
- later introduce `rules-gc`

Why it matters:

- current names blur:
  - review-cycle artifact revision
  - runtime incident healing
  - rule extraction
  - rule lifecycle improvement

The current code history shows the existing engine was introduced as a governed revision engine, not a runtime incident fixer.

### 11. A true runtime self-heal path still does not exist

Status:

- open

Problem:

- ADF mission says self-learning, self-healing, self-improving
- the current lane has:
  - some learning
  - bounded governance hardening
  - partial session resume
- but no explicit runtime incident-repair engine

Impact:

- runtime faults still rely on narrow retries, inline overrides, or blocking behavior rather than a governed self-repair path

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

- open

Problem:

- the lane can now run
- but it still does not produce a stable answer to:
  - was the output worth the time, tokens, and operational complexity

Needed:

- end-of-run artifact quality scoring
- cost-versus-value comparison
- comparison against prior baseline runs

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
