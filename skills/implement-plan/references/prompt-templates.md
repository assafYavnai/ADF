# Implement-Plan Prompt Templates

Global output discipline for all worker-facing or checker-facing prompts:

- obey the exact required section headings
- do not add a preamble
- do not add a postscript
- do not claim proof that is not backed by a concrete file, command, runtime observation, or other persisted evidence
- if a required artifact is missing or malformed, treat that as a blocker inside the required sections instead of guessing
- if a section would otherwise be empty, write `None.`

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
