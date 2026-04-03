# ADF Phase 0 Readiness Check and Phase 1 Requirement Freeze — Implementation-Ready Plan

## Purpose

This document is the implementation-ready operating contract for building and/or executing the first two post-COO phases of the requirement pipeline:

- **Phase 0 — COO Shaping Readiness Check**
- **Phase 1 — Requirement Contract Freeze**

This version is intentionally **execution-ready**, not just descriptive.

It defines:

- exact scope
- exact required artifacts
- exact artifact fields
- exact per-phase steps
- exact local-fix rules
- exact pushback rules
- exact pass/fail gates
- exact proof required
- exact implementor output contract

---

# 1. Mission

Start from the current COO onion model and make the output usable by an automatic delivery lane.

The system should behave like this:

1. CEO talks to COO at a high level only.
2. COO shapes business meaning and produces a **Finalized Requirement Packet**.
3. Phase 0 validates that the packet is truly ready.
4. Phase 1 converts it into a **Frozen Requirement Contract** without changing meaning.
5. If the issue can be fixed locally, fix it locally.
6. If a real business ambiguity remains, push back through COO and bubble to CEO only when needed.
7. Do not allow hidden assumptions to enter later phases.

---

# 2. Scope

## In scope

This plan covers:

- Phase 0 artifact validation and freeze-readiness enforcement
- local repairs that do not change business meaning
- explicit pushback when Phase 0 is not ready
- Phase 1 normalization and freezing into a machine-usable contract
- explicit blocking of silent business assumptions
- proof artifacts showing why a phase passed or pushed back

## Out of scope

This plan does **not** implement:

- Phase 2 technical preflight
- solution contract / design
- execution planning
- implementation lanes
- integration/finalization/postmortem
- self-learning, self-healing, self-improvement logic

---

# 3. Required variables

Implementations of this plan must not hardcode project-specific paths.

Use these logical variables:

- `project_root`
- `phase_number`
- `feature_slug`
- `feature_root = <project_root>/docs/phase<phase_number>/<feature_slug>/`
- `requirements_root = <feature_root>/requirements/`

Recommended default for Phase 1:
- `phase_number = 1`

---

# 4. Required folder layout

```text
<feature_root>/
  README.md
  context.md
  requirements/
    finalized-requirement-packet.json
    finalized-requirement-packet.md
    phase-0-proof.md
    phase-0-pushback.md
    frozen-requirement-contract.json
    frozen-requirement-contract.md
    requirements-traceability.md
    phase-1-proof.md
    phase-1-pushback.md
```

Rules:

- `requirements/` must be created if missing.
- Pushback artifacts are created only when the phase blocks.
- If both pushback and success artifacts already exist for the same phase, treat that as inconsistent state and fail conservatively.

---

# 5. Core artifacts

## 5.1 Finalized Requirement Packet

### Required file names

- `requirements/finalized-requirement-packet.json`
- `requirements/finalized-requirement-packet.md`

### Required JSON shape

```json
{
  "artifact_type": "finalized_requirement_packet",
  "feature_slug": "string",
  "feature_name": "string",
  "business_intent": "string",
  "user_facing_goal": "string",
  "human_success_view": "string",
  "human_testing_view": "string",
  "major_scope_items": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "priority": "required | optional"
    }
  ],
  "boundaries": [
    "string"
  ],
  "non_goals": [
    "string"
  ],
  "constraints": [
    "string"
  ],
  "acceptance_examples": [
    {
      "id": "string",
      "title": "string",
      "scenario": "string",
      "expected_outcome": "string"
    }
  ],
  "open_decisions": [
    {
      "id": "string",
      "question": "string",
      "status": "resolved | open | blocking",
      "notes": "string"
    }
  ],
  "priority": "string | null",
  "effort_risk_appetite": "string | null",
  "freeze_state": {
    "status": "approved | blocked",
    "approval_source": "string",
    "approval_notes": "string"
  },
  "source_context": {
    "origin": "coo_onion",
    "thread_or_artifact_ref": "string | null"
  }
}
```

### Required Markdown sections

`finalized-requirement-packet.md` must contain exactly these headings in this order:

1. `# Finalized Requirement Packet`
2. `## Feature`
3. `## Business Intent`
4. `## User-Facing Goal`
5. `## Human Success View`
6. `## Human Testing View`
7. `## Major Scope Items`
8. `## Boundaries`
9. `## Non-Goals`
10. `## Constraints`
11. `## Acceptance Examples`
12. `## Open Decisions`
13. `## Freeze State`

---

## 5.2 Frozen Requirement Contract

### Required file names

- `requirements/frozen-requirement-contract.json`
- `requirements/frozen-requirement-contract.md`

### Required JSON shape

```json
{
  "artifact_type": "frozen_requirement_contract",
  "feature_slug": "string",
  "feature_name": "string",
  "source_packet_ref": "requirements/finalized-requirement-packet.json",
  "intent": {
    "business_intent": "string",
    "user_facing_goal": "string"
  },
  "functional_requirements": [
    {
      "id": "string",
      "statement": "string",
      "priority": "required | optional",
      "source_scope_item_ids": ["string"]
    }
  ],
  "acceptance_checks": [
    {
      "id": "string",
      "statement": "string",
      "source_example_ids": ["string"]
    }
  ],
  "boundaries": [
    "string"
  ],
  "non_goals": [
    "string"
  ],
  "constraints": [
    "string"
  ],
  "assumptions": [
    {
      "id": "string",
      "statement": "string",
      "type": "technical_local_only"
    }
  ],
  "unresolved_business_decisions": [
    {
      "id": "string",
      "question": "string",
      "status": "blocking"
    }
  ],
  "freeze_state": {
    "status": "frozen | blocked",
    "reason": "string"
  }
}
```

### Required Markdown sections

`frozen-requirement-contract.md` must contain exactly these headings in this order:

1. `# Frozen Requirement Contract`
2. `## Identity`
3. `## Intent`
4. `## Functional Requirements`
5. `## Acceptance Checks`
6. `## Boundaries`
7. `## Non-Goals`
8. `## Constraints`
9. `## Assumptions`
10. `## Unresolved Business Decisions`
11. `## Freeze State`

---

## 5.3 Traceability artifact

### Required file

- `requirements/requirements-traceability.md`

### Required purpose

This file proves that Phase 1 preserved meaning rather than reinterpreting it.

### Required sections

1. `# Requirements Traceability`
2. `## Source Packet`
3. `## Scope Item To Functional Requirement Map`
4. `## Acceptance Example To Acceptance Check Map`
5. `## Boundaries And Non-Goals Mapping`
6. `## Unresolved Business Decisions`
7. `## Notes On Local Repairs`

---

## 5.4 Proof artifacts

### Required files

- `requirements/phase-0-proof.md`
- `requirements/phase-1-proof.md`

These are mandatory on success.

### Required sections for `phase-0-proof.md`

1. `# Phase 0 Proof`
2. `## Inputs Used`
3. `## Readiness Checks Performed`
4. `## Local Repairs Applied`
5. `## Blocking Issues Found`
6. `## Gate Decision`
7. `## Output Artifacts`

### Required sections for `phase-1-proof.md`

1. `# Phase 1 Proof`
2. `## Inputs Used`
3. `## Normalization Steps Performed`
4. `## Local Repairs Applied`
5. `## Blocking Issues Found`
6. `## Traceability Evidence`
7. `## Gate Decision`
8. `## Output Artifacts`

---

## 5.5 Pushback artifacts

### Required files when blocked

- `requirements/phase-0-pushback.md`
- `requirements/phase-1-pushback.md`

### Required sections

1. `# Pushback`
2. `## Phase`
3. `## Blocking Issues`
4. `## What Was Fixed Locally`
5. `## What Still Requires Upstream Resolution`
6. `## Pushback Target`
7. `## Minimum Required Response`

---

# 6. Phase 0 — exact execution steps

## Phase 0 objective

Validate that the COO shaping lane has actually produced a requirement packet strong enough for automatic downstream handling.

## Exact execution sequence

### Step 0.1 — load or build working packet
- load `finalized-requirement-packet.json` if it already exists
- if only prose or onion summary exists, derive the packet from the current COO output
- do not invent missing business meaning while doing so

### Step 0.2 — validate structure
Check all required fields exist and are non-empty where required.

Fail/block if:
- feature name missing
- business intent missing
- goal missing
- human success view missing
- human testing view missing
- no major scope items
- no freeze state
- freeze state not approved

### Step 0.3 — run readiness checks
Check:

1. intent clarity
2. success clarity
3. scope clarity
4. testing clarity
5. decision clarity
6. freeze clarity

### Step 0.4 — apply local repairs
Allowed local repairs:
- wording cleanup
- deduplication
- splitting combined bullets
- structure cleanup
- grouping cleanup
- converting scattered notes into proper fields
- removing contradictions only when the correct meaning is already explicit in the source

### Step 0.5 — determine blockers
Create a blocker list.

A blocker exists when:
- continuing would force a business assumption
- freeze approval is absent
- success/testing meaning is too vague
- a boundary/non-goal is clearly missing and materially affects downstream meaning
- an open decision is still blocking

### Step 0.6 — decide
If blockers remain:
- create `phase-0-pushback.md`
- create/update `phase-0-proof.md`
- do not create Phase 1 artifacts
- status = blocked

If no blockers remain:
- write both packet files
- write `phase-0-proof.md`
- status = passed

## Phase 0 pushback target rules

Pushback target is:
- `CEO via COO` when a business decision or intent clarification is required
- never directly to technical downstream phases

## Phase 0 definition of done

Phase 0 is done only if:
- packet JSON exists and is valid
- packet Markdown exists and matches
- proof file exists
- no blocking ambiguity remains
- freeze approval is explicit

---

# 7. Phase 1 — exact execution steps

## Phase 1 objective

Transform the approved business packet into a frozen, machine-usable requirement contract without changing approved meaning.

## Exact execution sequence

### Step 1.1 — load Phase 0 output
Required input:
- `finalized-requirement-packet.json`

If missing:
- fail and create `phase-1-pushback.md`
- pushback target = Phase 0 / COO shaping lane

### Step 1.2 — validate Phase 0 input
Block if:
- packet invalid
- packet freeze state not approved
- packet contains blocking open decisions
- packet is structurally too weak to normalize

### Step 1.3 — normalize scope into functional requirements
For each scope item:
- create one or more explicit functional requirements
- split compound requirements
- keep source references

### Step 1.4 — derive acceptance checks
For each acceptance example and human testing view:
- derive explicit acceptance checks
- do not weaken the testing meaning

### Step 1.5 — derive boundaries and non-goals
- preserve explicit non-goals
- preserve explicit boundaries
- if a boundary was implied but not explicit, do not invent it; block instead if needed

### Step 1.6 — record assumptions
Only technical-local assumptions are allowed here.
No business assumptions allowed.

### Step 1.7 — identify unresolved business decisions
Any business-significant unresolved decision must be:
- listed explicitly
- marked blocking
- preserved into the contract
- cause the gate to block

### Step 1.8 — create traceability artifact
Create `requirements-traceability.md` that maps:
- scope items → functional requirements
- examples → acceptance checks
- boundaries/non-goals → preserved contract sections

### Step 1.9 — decide
If blocking business ambiguity remains:
- create `phase-1-pushback.md`
- create/update `phase-1-proof.md`
- do not mark contract frozen
- status = blocked

If no blockers remain:
- write contract JSON
- write contract Markdown
- write traceability artifact
- write `phase-1-proof.md`
- status = frozen

## Phase 1 local fixes allowed

Allowed:
- structure normalization
- deduplication
- splitting combined lines
- explicit formatting
- mapping examples to checks
- turning packet wording into contract wording without changing meaning

Not allowed:
- inventing business meaning
- silently reprioritizing
- dropping requirements because they are hard
- converting optional into required or vice versa without explicit source basis
- weakening acceptance intent

## Phase 1 pushback target rules

Default target:
- back to Phase 0 / COO shaping lane

Bubble to CEO only if:
- a real business decision is required
- not because the contract writer wants a cleaner spec

## Phase 1 definition of done

Phase 1 is done only if:
- frozen contract JSON exists and is valid
- frozen contract Markdown exists and matches
- traceability file exists
- proof file exists
- no silent business assumptions were introduced
- freeze state is `frozen`

---

# 8. Gate rules

## Phase 0 pass gate

Pass only if:
- all required packet fields exist
- freeze approval is explicit
- success/test meaning is clear
- no blocking business ambiguity remains

## Phase 1 pass gate

Pass only if:
- packet is valid and approved
- contract preserves meaning
- acceptance checks are explicit
- non-goals are explicit
- blocking business ambiguity is absent
- traceability is complete

---

# 9. Failure handling

## If inputs are missing
Do not guess.
Create the phase pushback artifact and stop.

## If existing artifacts are malformed
Do not treat them as valid.
Repair locally if possible.
If not, block and push back.

## If JSON and Markdown versions disagree
JSON is the machine authority.
Repair Markdown to match if the meaning is already clear.
If not clear, block.

## If both pass and pushback artifacts exist
Treat the state as inconsistent.
Fail conservatively and require cleanup.

---

# 10. Implementor output contract

When using this plan to drive an implementor, require the implementor to return exactly these sections:

1. `Implementation Summary`
2. `Files Created Or Updated`
3. `Phase 0 Result`
4. `Phase 1 Result`
5. `Local Repairs Applied`
6. `Blocking Issues`
7. `Pushback Artifacts Created`
8. `Proof Artifacts Created`
9. `Definition Of Done Check`

Rules:
- no preamble
- no postscript
- if a section is empty, write `None.`
- do not claim pass unless the required artifacts actually exist

---

# 11. Review checklist

Reviewers should verify:

## Phase 0
- packet exists
- packet fields complete
- freeze explicit
- no hidden blockers
- proof file exists
- pushback artifact exists when blocked

## Phase 1
- contract exists
- contract preserves packet meaning
- acceptance checks explicit
- non-goals explicit
- no silent business assumptions
- traceability file complete
- proof file exists
- pushback artifact exists when blocked

---

# 12. Minimal success criteria

This implementation is successful when:

1. the COO output can be turned into a validated finalized-requirement-packet
2. Phase 0 blocks weak packets instead of letting them slip forward
3. Phase 1 turns strong packets into frozen-requirement-contract artifacts
4. local issues are fixed locally
5. true business ambiguities are bubbled up properly
6. proof artifacts exist for both pass and pushback paths
