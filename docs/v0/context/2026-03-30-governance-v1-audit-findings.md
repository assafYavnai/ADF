# Governance V1 Audit Findings

Date: 2026-03-30
Status: analysis frozen, implementation follow-up not started

Related docs:

- [agent-role-builder-governance-v1-frozen-design.md](C:/ADF/docs/v0/context/agent-role-builder-governance-v1-frozen-design.md)
- [2026-03-30-governance-v1-runtime-followup-findings.md](C:/ADF/docs/v0/context/2026-03-30-governance-v1-runtime-followup-findings.md)
- [2026-03-30-bom-question-followup.md](C:/ADF/docs/v0/context/2026-03-30-bom-question-followup.md)
- [agent-role-builder-governance-research-and-findings.md](C:/ADF/docs/v0/context/agent-role-builder-governance-research-and-findings.md)

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
- the run summary still blurs “what round N reviewed” with “what the run later contained”

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

## Conclusion

The remaining work is now mostly about fail-closed behavior and audit precision.

The main architecture decisions are already sufficiently frozen for the pilot.

What remains is implementation hardening:

- broaden startup audit
- tighten rulebook governance validation
- make round evidence canonical in summaries
- add invariant coverage so these regressions stop recurring
