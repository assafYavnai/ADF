# Implement-Plan Prompt Templates

Global output discipline for all worker-facing or checker-facing prompts:

- obey the exact required section headings
- do not add a preamble
- do not add a postscript
- do not claim proof that is not backed by a concrete file, command, runtime observation, or other persisted evidence
- if a required artifact is missing or malformed, treat that as a blocker inside the required sections instead of guessing
- if a section would otherwise be empty, write `None.`
- keep user-facing report artifacts human-facing and easy to scan instead of turning them into dense prose

## Integrity checker / pushback template

Use this exact output contract:

```text
Assess whether the implementation slice is ready for safe execution.

Use exactly 4 sections:

1. Integrity Verdict
Write exactly one of:
- PASS
- PUSHBACK

2. Missing / Weak / Unsafe Inputs
List every missing, weak, ambiguous, or unsafe input that prevents trustworthy implementation.
For each one include:
- issue class
- why it blocks or weakens implementation
- exact artifact or contract gap
- what authority or clarification would close it

If nothing is missing or weak, write:
- None.

3. Required Contract Repairs
List the minimum contract repairs needed before implementation can proceed.
Keep them bounded and product-slice specific.

If no repairs are needed, write:
- None.

4. Next Safe Move
State the next safe action.
Use one of:
- write pushback and stop
- materialize normalized contract and stop
- materialize normalized contract and proceed to implementor brief
- proceed to implementor brief
```

Rules:

- do not approve speculative refactoring
- do not accept missing deliverables, missing acceptance gates, or missing edit boundaries as good enough
- do not accept a slice that lacks `Machine Verification Plan`
- do not accept a slice that lacks `Human Verification Plan`
- do not accept a human verification plan that omits `Required: true|false`
- do not accept `Human Verification Plan` with `Required: true` when the slice is not configured to hand off to `review-cycle`
- if `Required: true`, do not pass a slice that lacks explicit testing-phase instructions, expected results, evidence to report back, and `APPROVED` / `REJECTED: <comments>` response guidance
- do not pass a slice that omits `KPI Applicability`
- do not pass a slice that says `KPI Applicability: required` or `KPI Applicability: temporary exception approved` but omits any of:
  - `KPI Route / Touched Path`
  - `KPI Raw-Truth Source`
  - `KPI Coverage / Proof`
  - `KPI Production / Proof Partition`
- do not pass a slice that says `KPI Applicability: not required` but omits `KPI Non-Applicability Rationale`
- do not pass a slice that uses `KPI Applicability: temporary exception approved` without:
  - `KPI Exception Owner`
  - `KPI Exception Expiry`
  - `KPI Exception Production Status`
  - `KPI Compensating Control`
- do not pass a slice that still requires business guessing
- treat `blocked` feature status as non-runnable until explicitly resolved

## Implementor worker template

Use this exact output contract before and after coding:

```text
Implement the bounded product slice exactly as described.
You are executing only after integrity verification passed.
Use only the trusted authorities and bounded scope provided.
You must update all materially affected authoritative documentation in the same slice.
You must not widen the slice into speculative refactoring.

Before coding, output exactly 5 sections:

1. Objective
State the exact implementation objective in one short paragraph.

2. Slice Scope
List the exact in-scope layers, files, and deliverables.

3. Forbidden Edits
List what must not be changed.

4. Proof Plan
List the exact tests, runtime checks, or artifacts you will produce.
Include:
- `Machine Verification Plan`
- `Human Verification Plan`
- whether human verification is required
- the exact testing-phase handoff message or artifact when human verification is required

5. Artifact Updates
List which docs, contracts, or state artifacts must be updated.

Then execute the implementation.

At the end, output exactly 5 sections:

1. Deliverables Completed
2. Files Changed And Why
3. Verification Evidence
4. Artifacts Updated
5. Non-Goals Left Untouched
```

Rules:

- use only integrity-verified assumptions
- do not broaden scope
- do not modify forbidden areas
- do not start code changes without a machine verification plan and a human verification plan
- if `Human Verification Plan` says `Required: true`, do not proceed unless the slice is configured to hand off to `review-cycle`
- if human verification is required, the implementation is not ready to close until the testing-phase handoff is prepared in the required fixed shape
- update authoritative docs when materially affected
- if a supposedly trusted input is malformed or contradictory, stop and say so instead of guessing

## Completion summary template

Create `completion-summary.md` with exactly these sections:

```text
1. Objective Completed
2. Deliverables Produced
3. Files Changed And Why
4. Verification Evidence
5. Feature Artifacts Updated
6. Commit And Push Result
7. Remaining Non-Goals / Debt
```

Rules:

- each heading must appear exactly once
- headings must appear in the listed order
- if a section is empty, write `None.`
- do not claim completion if commit or push failed
- section `4. Verification Evidence` must clearly distinguish:
  - `Machine Verification`
  - `Human Verification Requirement`
  - `Human Verification Status`
  - `Review-Cycle Status`
  - concrete evidence

## Normalized implementation contract template

Create `implement-plan-contract.md` with exactly these sections:

```text
1. Implementation Objective
2. Slice Scope
3. Required Deliverables
4. Allowed Edits
5. Forbidden Edits
6. Acceptance Gates
7. Observability / Audit
8. Dependencies / Constraints
9. Non-Goals
10. Source Authorities
```

Rules:

- headings must be exact
- headings must appear exactly once
- headings must appear in the listed order
- fenced code blocks do not count as valid heading locations
- if a section is unknown, do not invent content; fail integrity instead
- section `6. Acceptance Gates` must include exact sublabels:
  - `KPI Applicability`
  - `KPI Route / Touched Path`
  - `KPI Raw-Truth Source`
  - `KPI Coverage / Proof`
  - `KPI Production / Proof Partition`
  - `KPI Non-Applicability Rationale`
  - `KPI Exception Owner`
  - `KPI Exception Expiry`
  - `KPI Exception Production Status`
  - `KPI Compensating Control`
  - `Machine Verification Plan`
  - `Human Verification Plan`
- `KPI Applicability` must be exactly one of:
  - `required`
  - `not required`
  - `temporary exception approved`
- when `KPI Applicability` is `required` or `temporary exception approved`, the KPI route, raw-truth source, coverage or proof, and production or proof partition fields must contain explicit content
- when `KPI Applicability` is `not required`, `KPI Non-Applicability Rationale` must explain why the slice is outside the KPI rule
- when `KPI Applicability` is `temporary exception approved`, the exception owner, expiry, production status, and compensating control fields must contain explicit content, and the production status must keep the slice out of production-complete claims
- `Human Verification Plan` must include `Required: true` or `Required: false`
- if `Required: true`, `Human Verification Plan` must include:
  - explicit testing-phase language
  - executive summary of implemented behavior
  - exact test steps
  - expected results
  - evidence to report back
  - `APPROVED` / `REJECTED: <comments>` response contract
- section `7. Observability / Audit` must make review-cycle status, machine verification status, and human verification status truthfully visible
- section `7. Observability / Audit` must also make worktree and merge state truthfully visible when merge completion is required
- report artifacts created from this contract must stay human-facing: short sections, concise bullets where appropriate, and no dense wall-of-text output

## Pushback artifact template

Create `implement-plan-pushback.md` with exactly these sections:

```text
1. Integrity Verdict
2. Missing / Weak / Unsafe Inputs
3. Required Contract Repairs
4. Next Safe Move
```

Rules:

- the verdict must be `PUSHBACK`
- each heading must appear exactly once
- be concise and specific

## Brief artifact template

Create `implement-plan-brief.md` with exactly these sections:

```text
1. Implementation Objective
2. Exact Slice Scope
3. Inputs / Authorities Read
4. Required Deliverables
5. Forbidden Edits
6. Integrity-Verified Assumptions Only
7. Explicit Non-Goals
8. Proof / Verification Expectations
9. Required Artifact Updates
10. Closeout Rules
```

Rules:

- each heading must appear exactly once
- headings must appear in the listed order
- only include integrity-verified assumptions
- section `8. Proof / Verification Expectations` must restate the machine verification plan and the human verification requirement
- section `10. Closeout Rules` must say whether human testing is required, when review-cycle runs, and whether a post-human-approval sanity pass is required

## Help/get-settings/list-features output guidance

Help output should be concise and concrete.
It should include:

- skill purpose
- supported actions
- required inputs for `run`
- optional inputs
- transparent setup behavior summary
- current settings summary
- active/open feature summary
- mark-complete usage
- closed/completed protection note

`get-settings` output should include:

- project root
- setup validity
- preferred worker access mode
- preferred worker runtime
- preferred control-plane runtime
- preferred worker model and reasoning
- fallback mode
- capability summary

`list-features` output should include compact sections for:

- active
- blocked
- completed
- closed
