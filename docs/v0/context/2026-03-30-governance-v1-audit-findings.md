# Governance V1 Audit Findings

Date: 2026-03-30
Status: V1 fix round implemented locally, tests passed

Related docs:

- [agent-role-builder-governance-v1-frozen-design.md](C:/ADF/docs/v0/context/agent-role-builder-governance-v1-frozen-design.md)
- [2026-03-30-governance-v1-runtime-followup-findings.md](C:/ADF/docs/v0/context/2026-03-30-governance-v1-runtime-followup-findings.md)
- [2026-03-30-bom-question-followup.md](C:/ADF/docs/v0/context/2026-03-30-bom-question-followup.md)
- [agent-role-builder-governance-research-and-findings.md](C:/ADF/docs/v0/context/agent-role-builder-governance-research-and-findings.md)

External review corroboration:

- Codex agent `019d3dd7-893f-7313-b90c-64eabd28e2bc`

Implementation baseline reviewed:

- `b54c464` Record governance V1 runtime and BOM follow-up findings
- `dce786c` Fix governance V1 runtime error and evidence handling
- `4571c11` Add BOM-tolerant JSON ingress with audit trail
- `a5f6947` Checkpoint before bootstrap and snapshot follow-up fixes
- `db2866c` Fix bootstrap ingress incident naming
- `eee6934` Normalize governance snapshot authority paths

## Purpose

Capture the next-layer audit findings after the frozen V1 pilot, runtime bug-fix pass, BOM-support pass, and the two small follow-up fixes.

This note exists to freeze:

- what is still wrong at a high level
- which parts are now recommendations rather than architecture questions
- what should be fixed before broader rollout or new governance features

## High-Level Findings

### 1. Startup audit is still not fully closed

Accepted.

Current startup audit reliably covers raw request JSON parse failure, but not every other pre-run failure class.

Remaining uncovered or inconsistently covered cases include:

- unreadable request file before request ingress normalization completes
- shared-module load failure before request processing fully enters the governed path
- request schema validation failure after JSON parse but before the run becomes a normal governed execution

High-level impact:

- some startup failures still degrade to raw CLI fatal behavior instead of a structured startup incident artifact
- the audit trail is better than before, but not complete

### 2. The rulebook is required authority, but not yet fully fail-closed

Accepted.

The pilot snapshot and board treat the rulebook as required governance input, but current handling still only guarantees:

- file exists
- file is readable
- file is parseable JSON

It does not yet guarantee a valid governed rulebook shape before execution proceeds.

High-level impact:

- malformed rulebook structure can degrade into an empty or partial working rule set instead of blocking as invalid governance
- this weakens the initial rule sweep, learning context, and authority integrity

### 3. Run-level round evidence is still less precise than round-local evidence

Accepted.

The detailed round artifact path is much better than before, but the run-level postmortem still summarizes some round evidence using latest run-root files rather than the exact round-local snapshots.

High-level impact:

- `review.json` is more trustworthy than the run-level summary for exact round evidence
- the run summary still blurs "what round N reviewed" with "what the run later contained"

### 4. Relative traversal-style authority inputs are not yet fail-closed

Accepted.

Current snapshot-path hardening rejects absolute paths outside the repo root, but relative traversal-style inputs such as `../outside.json` are still accepted as non-absolute values and then joined into the snapshot tree.

High-level impact:

- snapshot authority boundaries are stronger than before, but not fully closed
- a caller can still attempt repo escape through relative traversal inputs unless the caller surface is otherwise trusted

## Open Questions

These are now policy/placement questions, not broad architecture questions.

### 1. How broad should bootstrap audit be?

Question:

- should every pre-run failure produce a structured startup incident
- or only request-ingress failures

Recommendation:

- make bootstrap audit universal for pre-run blocked failures

### 2. Where should rulebook validation live?

Question:

- during governance snapshot creation
- or later during board startup

Recommendation:

- validate at snapshot time
- treat invalid rulebook shape as invalid governance, not as board-local degradation

### 3. Is repo-root cwd a temporary operator contract or a bug to remove now?

Question:

- should CLI invocation from repo root remain an accepted requirement for V1
- or should the loader be made cwd-agnostic now

Recommendation:

- keep repo-root cwd as an explicit temporary contract for the current pilot
- remove the dependency in a separate hardening pass rather than widening this pass again

### 4. How strict should authority path boundaries be?

Question:

- is blocking absolute out-of-repo paths enough
- or should relative `..` escape-style paths also be rejected everywhere

Recommendation:

- reject both absolute out-of-repo paths and relative escape-style paths

### 5. What is the canonical source of round evidence?

Question:

- may run-level summaries point at final run-root files
- or must they point at the exact round-local files the round actually used

Recommendation:

- make round-local evidence canonical everywhere

## Recommended Next Fixes

Recommended order:

1. universal startup incident coverage for every pre-run blocked failure
2. rulebook schema validation during governance snapshot creation
3. round-postmortem artifact refs aligned with round-local evidence
4. explicit rejection of authority path escapes
5. invariant tests for all of the above

## Recommended Invariant Tests

Before broader rollout or new governance features, add narrow tests for:

1. every pre-run blocked failure writes a startup incident artifact
2. invalid governed rulebook shape blocks before round 0
3. no accepted authority path escapes repo bounds
4. run-postmortem round refs match round-local review evidence
5. every referenced artifact exists at write time

## External Review Delta

The external review mostly corroborated this audit rather than replacing it.

Accepted additions from the external review:

- startup audit gap explicitly includes unreadable request files, not only schema-invalid or shared-module failures
- relative traversal-style authority inputs are a real remaining fail-closed gap

Corroborated findings already present in this audit:

- startup audit is incomplete
- run-postmortem round snapshots are not round-stable

Findings still unique to this audit after external review:

- required rulebook governance is not yet fully fail-closed on shape validation

## Conclusion

The remaining work is now mostly about fail-closed behavior and audit precision.

The main architecture decisions are already sufficiently frozen for the pilot.

What remains is implementation hardening:

- broaden startup audit
- tighten rulebook governance validation
- make round evidence canonical in summaries
- fully close authority path boundaries
- add invariant coverage so these regressions stop recurring

## Frozen V1 Fix Round

The next implementation pass for V1 is intentionally narrow.

In scope now:

1. universal startup incident coverage for every pre-run blocked failure
2. governed rulebook shape validation during governance snapshot creation
3. run-postmortem round snapshots must use round-local artifact refs for `artifact_markdown` and `self_check`
4. relative traversal-style authority paths must fail closed
5. invariant tests for the above

Explicitly out of this V1 fix round:

- ad-hoc/code-review lane rollout
- generalized KPI or observability expansion
- provider-fallback fixer orchestration
- resume-state carry-forward
- broader workspace/module-boundary redesign

## Post-V1 Versioning Correction

The next work should not be labeled `V1.x`.

Corrected interpretation:

- `V1` is implemented and hardened
- `V1` live validation is deferred until the runtime is mature enough to run `agent-role-builder` in a bounded, useful way
- the next implementation work starts at `V2`

Why this correction matters:

- calling the next work `V1.x` implies the frozen V1 implementation is still unfinished
- the real remaining issue is runtime maturity and bounded validation, not unfinished V1 design scope

## V2 And Later Candidate Push

The next versions should be split narrowly to avoid the same scope creep that happened earlier in design review.

### V2A Runtime Unblock

Source:

- [step2-run017-postmortem.md](C:/ADF/docs/v0/context/step2-run017-postmortem.md)

Candidate scope:

- unblock the real `agent-role-builder` revision path
- stop canonical invoker fixes from being lost in copied/shared boundaries

### V2B Bounded ARB Validation

Source:

- [step2-run017-postmortem.md](C:/ADF/docs/v0/context/step2-run017-postmortem.md)

Candidate scope:

- run `agent-role-builder` for one bounded validation cycle
- keep it auditable and capped:
  - one cycle only
  - explicit round cap
  - hard timeout
  - no auto-resume chaining
  - no rule promotion

### V2C Minimal Telemetry Baseline

Candidate scope:

- capture the minimum run telemetry needed so future work does not lose operational memory
- defer full KPI or dashboard work

Minimum direction:

- run id
- commit sha
- mode/config
- stop reason
- rounds attempted/completed
- reviewer success/error counts
- provider failures
- fallback used or not
- learning artifact written or not
- duration
- terminal status
- postmortem path

### V2D Recovery And Resume Correctness

Source:

- [step2-run017-postmortem.md](C:/ADF/docs/v0/context/step2-run017-postmortem.md)

Candidate scope:

- define the minimum fixer/provider-fallback contract for the revision lane
- carry prior reviewer status into resumed runs

### V3 Candidate Push

Only after `V2` stabilization and bounded validation:

1. module-boundary / manual-copy elimination beyond the immediate unblock path
2. governance and learning expansion beyond the frozen pilot
3. broader KPI, observability, and aggregated reporting

Deferred rationale:

- current need is runtime maturity and bounded validation
- broad observability or governance expansion should not outrun the pilot runtime

## V1 Fix Round Implementation Note

The frozen V1 fix round has now been implemented.

Landed behavior:

1. startup incidents now cover the missing pre-run blocked cases:
   - unreadable request file
   - request schema validation failure
   - shared governance runtime bootstrap failure
2. governed rulebook shape is now validated during governance snapshot creation instead of degrading later in the board
3. run-postmortem round snapshots now use round-local `artifact_markdown` and `self_check` refs rather than mutable run-root files
4. relative traversal-style authority paths such as `..` now fail closed during governance snapshot path normalization

Validation completed:

1. targeted startup-ingress tests passed
2. targeted round artifact-ref tests passed
3. targeted governance-runtime path and rulebook-validation tests passed
4. `tsc --noEmit` passed for `tools/agent-role-builder`
5. `tsc --noEmit` passed for `shared`

This closes the frozen V1 fix round. Remaining items after this point should be treated as new follow-up work, not as unfinished scope from the frozen pass.
