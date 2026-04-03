# ADF Phase Gates and Next-Phase Design — Implementation-Ready Contract

## Purpose

This document is the implementation-ready contract for moving work safely from phase to phase in the ADF delivery lane.

It defines:

- exact gate behavior
- exact pass / block / pushback decisions
- exact next-phase design obligations
- exact required gate artifacts
- exact pushback routing
- exact local-resolution rules
- exact proof required before a phase may hand off

This file is intended to be executable as an operating contract by planners, workflow implementors, orchestrators, reviewers, and gate-enforcement agents.

---

# 1. Mission

Make phase transitions safe, explicit, and machine-usable.

Each phase must do **two jobs**:

1. produce its own valid output artifact
2. shape the next phase so that the next phase can start without hidden guessing

The system must favor:

- local resolution first
- explicit blocking instead of silent drift
- CEO escalation only for real business decisions
- next-phase readiness over artifact-only completion

---

# 2. Scope

## In scope

This contract governs:

- phase transition logic
- handoff readiness checks
- gate artifacts
- pushback artifacts
- next-phase briefs
- per-phase transition obligations
- local-fix vs pushback rules

## Out of scope

This contract does **not** define the internal domain logic of each phase in detail.
That belongs to the individual phase implementation plans.

This contract only defines how phases **finish**, **hand off**, **block**, and **design forward**.

---

# 3. Required variables

Implementations of this contract must use variables, not hardcoded paths.

Required variables:

- `project_root`
- `phase_number`
- `feature_slug`
- `feature_root = <project_root>/docs/phase<phase_number>/<feature_slug>/`
- `phase_artifacts_root = <feature_root>/phase-artifacts/`
- `phase_name`
- `next_phase_name`

---

# 4. Required folder layout

```text
<feature_root>/
  phase-artifacts/
    phase-00/
      gate-decision.json
      gate-decision.md
      next-phase-brief.json
      next-phase-brief.md
      gate-proof.md
      pushback.md
    phase-01/
      ...
    phase-02/
      ...
```

Rules:

- every phase gets its own subfolder under `phase-artifacts/`
- `pushback.md` is created only when the phase blocks
- `gate-decision.json`, `gate-decision.md`, `next-phase-brief.json`, `next-phase-brief.md`, and `gate-proof.md` are mandatory on pass
- if both pass artifacts and a blocking pushback exist for the same final state, treat the state as inconsistent and fail conservatively

---

# 5. Core concepts

## 5.1 Local resolution

A problem must be fixed locally and immediately when fixing it does **not** change:

- business intent
- success meaning
- testing meaning
- scope boundary
- priority
- effort/risk expectation
- phase interface contract
- lane interface contract

## 5.2 Pushback

A phase must push back when:

- a required input is missing
- the current artifact is too weak to continue safely
- continuing would force a meaningful assumption
- a blocking contradiction remains
- the next phase would be forced to invent business or contract truth

## 5.3 CEO escalation

A blocker may bubble to the CEO only when it requires:

- a business decision
- a business tradeoff
- scope change
- priority change
- effort/risk acceptance
- clarification of intent or success meaning

No technical phase may escalate directly to the CEO without going through the COO-facing pushback path.

---

# 6. Mandatory gate artifacts

## 6.1 Gate Decision

### Required files

- `gate-decision.json`
- `gate-decision.md`

### Required JSON shape

```json
{
  "artifact_type": "gate_decision",
  "phase_number": 0,
  "phase_name": "string",
  "feature_slug": "string",
  "input_artifacts": [
    "string"
  ],
  "gate_status": "passed | blocked | pushed_back",
  "decision_summary": "string",
  "local_fixes_applied": [
    "string"
  ],
  "blocking_issues": [
    {
      "id": "string",
      "type": "missing_input | ambiguity | contradiction | business_decision | contract_gap | dependency_gap | sequencing_gap | invalid_artifact",
      "description": "string",
      "blocking_scope": "local | previous_phase | ceo_via_coo",
      "resolved_locally": false
    }
  ],
  "pushback_target": "none | previous_phase | coo | ceo_via_coo",
  "next_phase_allowed": true,
  "next_phase_name": "string | null",
  "proof_refs": [
    "string"
  ]
}
```

### Required Markdown sections

1. `# Gate Decision`
2. `## Phase`
3. `## Input Artifacts`
4. `## Local Fixes Applied`
5. `## Blocking Issues`
6. `## Gate Status`
7. `## Pushback Target`
8. `## Next Phase Allowed`
9. `## Proof References`

---

## 6.2 Next-Phase Brief

### Required files

- `next-phase-brief.json`
- `next-phase-brief.md`

### Required purpose

This artifact tells the next phase exactly what it is receiving, what is already fixed, what is still explicit, and what it must not guess.

### Required JSON shape

```json
{
  "artifact_type": "next_phase_brief",
  "from_phase_number": 0,
  "from_phase_name": "string",
  "to_phase_name": "string",
  "feature_slug": "string",
  "handoff_artifacts": [
    "string"
  ],
  "artifact_strength_summary": "string",
  "safe_assumptions_for_next_phase": [
    "string"
  ],
  "explicit_non_assumptions": [
    "string"
  ],
  "remaining_non_blocking_ambiguities": [
    "string"
  ],
  "blocking_ambiguities": [
    "string"
  ],
  "local_decisions_made_here": [
    "string"
  ],
  "decisions_explicitly_not_made_here": [
    "string"
  ],
  "required_next_phase_checks": [
    "string"
  ],
  "required_next_phase_proof": [
    "string"
  ]
}
```

### Required Markdown sections

1. `# Next Phase Brief`
2. `## From Phase`
3. `## To Phase`
4. `## Handoff Artifacts`
5. `## Artifact Strength Summary`
6. `## Safe Assumptions For Next Phase`
7. `## Explicit Non-Assumptions`
8. `## Remaining Non-Blocking Ambiguities`
9. `## Blocking Ambiguities`
10. `## Local Decisions Made Here`
11. `## Decisions Explicitly Not Made Here`
12. `## Required Next Phase Checks`
13. `## Required Next Phase Proof`

---

## 6.3 Gate Proof

### Required file

- `gate-proof.md`

### Required sections

1. `# Gate Proof`
2. `## Inputs Used`
3. `## Validation Steps Performed`
4. `## Local Repairs Performed`
5. `## Blocking Issues Evaluated`
6. `## Why The Gate Passed Or Blocked`
7. `## Handoff Readiness Evidence`
8. `## Output Artifacts`

---

## 6.4 Pushback artifact

### Required file when blocked

- `pushback.md`

### Required sections

1. `# Pushback`
2. `## Phase`
3. `## Blocking Issues`
4. `## What Was Fixed Locally`
5. `## Why The Phase Cannot Continue`
6. `## Pushback Target`
7. `## Minimum Required Resolution`
8. `## Restart Condition`

---

# 7. Standard gate execution sequence

Every phase transition must use this sequence:

## Step 7.1 — Load inputs
- load required input artifacts for the current phase
- validate that the artifacts exist and are structurally valid
- do not treat malformed artifacts as usable

## Step 7.2 — Validate phase completion
Check whether the current phase’s own output artifact is structurally complete and semantically strong enough.

## Step 7.3 — Apply local fixes
Apply all local fixes that do not change business intent or cross-phase contract meaning.

## Step 7.4 — Scan for blockers
Build a structured blocker list.

## Step 7.5 — Classify blockers
Each blocker must be classified as:
- local
- previous_phase
- coo
- ceo_via_coo

## Step 7.6 — Decide gate outcome
Possible outcomes:
- `passed`
- `blocked`
- `pushed_back`

## Step 7.7 — Produce artifacts
If passed:
- write gate-decision
- write next-phase-brief
- write gate-proof

If blocked/pushed back:
- write gate-decision
- write gate-proof
- write pushback
- do not write next-phase-brief as if handoff is valid

## Step 7.8 — Stop or hand off
If blocked:
- stop
- do not silently continue

If passed:
- allow handoff into the next phase

---

# 8. General pass rules

A phase may pass only if all are true:

1. current phase output artifact exists
2. current phase artifact is structurally valid
3. current phase artifact is semantically strong enough for the next phase
4. local-fixable issues were already fixed
5. no blocking ambiguity remains
6. no blocked business decision is hidden
7. next-phase-brief is complete
8. gate-proof exists

---

# 9. General block rules

A phase must block if any are true:

1. required input artifact missing
2. required input artifact malformed
3. current phase output too weak
4. blocker remains after local repair
5. next phase would have to guess
6. current artifact contradicts earlier approved truth
7. a decision required from CEO/COO remains unresolved

---

# 10. Pushback routing matrix

## Push back to previous phase when:
- current phase input is weak
- missing structure from upstream
- missing explicit decisions that upstream phase should have captured
- unresolved contradictions introduced upstream

## Push back to COO when:
- a business clarification is required but should still be handled in the COO lane
- the issue is still in the requirement/business-definition boundary

## Bubble to CEO via COO when:
- a true business decision is required
- priority must change
- scope must change
- effort/risk appetite must be confirmed
- success meaning must be redefined

## Never push directly to a technical downstream phase
A downstream phase is not the place to repair upstream business ambiguity.

---

# 11. What each phase must design for the next phase

Every phase must answer these exact design-forward questions before passing:

1. What artifact am I handing off?
2. Why is it strong enough?
3. What did I fix locally?
4. What did I intentionally not decide here?
5. What can the next phase safely assume?
6. What must the next phase not assume?
7. What checks must the next phase run immediately?
8. What proof must the next phase produce before it may pass?

These answers must appear in the **Next-Phase Brief**.

---

# 12. Phase-specific transition contract

## Phase 0 → Phase 1

### Required pass inputs
- finalized requirement packet exists
- freeze approval explicit
- no blocking business ambiguity remains

### Next-phase design obligation
Phase 0 must ensure Phase 1 can normalize the packet without business guessing.

### Required next-phase brief items
- exact approved business intent
- exact approved success/test meaning
- explicit boundaries/non-goals
- explicit remaining non-blocking ambiguity, if any
- explicit “do not guess” items

## Phase 1 → Phase 2

### Required pass inputs
- frozen requirement contract exists
- acceptance checks explicit
- non-goals explicit
- no unresolved blocking business decision remains

### Next-phase design obligation
Phase 1 must ensure Phase 2 can evaluate feasibility, dependencies, conflicts, and sequencing without guessing what the feature means.

### Required next-phase brief items
- functional requirements summary
- acceptance checks summary
- known non-goals
- explicit unresolved non-blocking assumptions
- what preflight must prove

## Phase 2 → Phase 3

### Required pass inputs
- preflight decision exists
- proceed/proceed-with-split explicitly chosen

### Next-phase design obligation
Phase 2 must ensure Phase 3 can build a technical route without inventing strategic direction.

### Required next-phase brief items
- allowed route direction
- split/sequencing decisions
- dependency and conflict summary
- major risk points
- what solution contract must settle

## Phase 3 → Phase 4

### Required pass inputs
- solution contract exists
- interfaces/ownership explicit enough

### Next-phase design obligation
Phase 3 must ensure Phase 4 can package execution without redesigning architecture.

### Required next-phase brief items
- work package candidates
- boundary candidates
- dependency candidates
- proof expectations

## Phase 4 → Phase 5

### Required pass inputs
- execution plan exists
- lane map exists

### Next-phase design obligation
Phase 4 must ensure Phase 5 can create build-ready packets for each lane.

### Required next-phase brief items
- lane boundaries
- allowed/blocked surfaces
- required outputs
- integration checkpoints

## Phase 5 → Phase 6

### Required pass inputs
- lane packets exist
- lane contracts bounded and explicit

### Next-phase design obligation
Phase 5 must ensure lane implementors can build without redesigning scope.

### Required next-phase brief items
- lane-local success criteria
- lane-local non-goals
- lane-local proof
- integration entrypoint

## Phase 6 → Phase 7

### Required pass inputs
- lane outputs exist
- lane proof exists

### Next-phase design obligation
Phase 6 must ensure integration can begin with bounded uncertainty.

### Required next-phase brief items
- lane outputs
- known interface risks
- unresolved cross-lane issues
- route proof expected at integration

## Phase 7 → Phase 8

### Required pass inputs
- release candidate exists
- route works end to end

### Next-phase design obligation
Phase 7 must ensure finalization can close the run cleanly.

### Required next-phase brief items
- complete evidence set
- docs delta
- remaining non-goals/debt
- closeout requirements

## Phase 8 → Phase 9

### Required pass inputs
- finalization packet exists

### Next-phase design obligation
Phase 8 must ensure postmortem can summarize real outcome without reconstructing the run.

### Required next-phase brief items
- actual result
- run summary
- blockers/friction
- deferred follow-ups

---

# 13. Failure handling

## Missing artifact
Create blocking gate decision + pushback and stop.

## Malformed artifact
Repair locally if safe.
If not safe, block and push back.

## Inconsistent artifact set
If both pass and pushback artifacts imply different final states, fail conservatively and require cleanup.

## Next phase would still guess
Block.
Do not hand off.

---

# 14. Review contract

Reviewers of a phase transition must verify:

1. current phase artifact is actually complete
2. local repairs were appropriate and non-invasive
3. blockers were classified correctly
4. no business ambiguity was hidden
5. gate decision reflects reality
6. next-phase brief is specific enough
7. gate proof contains real evidence
8. pushback exists when block occurred
9. next phase would not be forced to guess

---

# 15. Implementor output contract

When using this document to drive an implementor, require the implementor to return exactly these sections:

1. `Implementation Summary`
2. `Files Created Or Updated`
3. `Gate Artifacts Produced`
4. `Local Repairs Applied`
5. `Blocking Issues Found`
6. `Gate Decisions Reached`
7. `Pushbacks Created`
8. `Next-Phase Briefs Created`
9. `Definition Of Done Check`

Rules:
- no preamble
- no postscript
- if a section is empty, write `None.`
- do not claim pass unless required gate artifacts exist

---

# 16. Definition of done

This contract is successfully implemented when:

1. every phase transition can produce a valid gate decision
2. every passed phase produces a next-phase brief
3. blocked phases create pushback instead of drifting forward
4. local issues are fixed locally
5. CEO escalation occurs only for real business decisions
6. handoffs are proof-backed, not assumption-backed
7. the next phase can start without hidden guessing
