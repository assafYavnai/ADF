# Prompt Templates

If you run nested `codex exec` reviewers, keep the prompt body short and point the reviewer to files on disk. Do not paste large artifacts inline when the files already exist.

Global output discipline for every worker:

- obey the exact required section headings
- do not add a preamble
- do not add a postscript
- do not claim proof that is not pointed to by a concrete file, test, command output, runtime observation, or DB evidence
- if claimed route, mutated route, and proved route differ, name the mismatch instead of smoothing it over
- if a required input artifact is missing or malformed, treat that as a blocker inside the required sections instead of guessing
- if a section is empty, write `None.` under that heading instead of inventing content

## Auditor prompt template

Use this exact output contract:

```text
Audit the current implementation state from a system-route view.

If a prior cycle fix-report exists, treat it as context, not as proof that closure already happened.

Create exactly 3 sections:

1. Findings
List current findings, highest severity first.
For each finding include:
- failure class
- broken route invariant in one sentence
- exact route (A -> B -> C)
- exact file/line references
- concrete operational impact
- sweep scope: what sibling paths/components must be checked for the same pattern
- closure proof: what tests/runtime evidence/DB proof must exist before this can be called closed
- shared-surface expansion risk: none / present and where
- negative proof required: what sibling or adjacent misuse must be disproved
- live/proof isolation risk: none / present and why
- claimed-route vs proved-route mismatch risk: none / present and why
- status: live defect / regression / historical debt / policy edge case

If there are no findings, write:
- None.

2. Conceptual Root Cause
State the system-level causes that created the issues.
Group findings by missing contract or policy, not by file.
Explain what route-level invariant was missing or unenforced.

If there is no remaining root cause, write:
- None.

3. High-Level View Of System Routes That Still Need Work
List the end-to-end routes that still need attention.
For each route include:
- what must be frozen before implementation
- why endpoint-only fixes will fail
- the minimal layers that must change to close the route
- explicit non-goals, so scope does not widen into general refactoring
- what done looks like operationally

If no routes still need work, write:
- None.

Important:
- Do not stop at the cited endpoint.
- Sweep for sibling instances of the same failure class in one pass.
- Prefer the smallest route-contract fix that closes the class.
- Do not treat the cited files as the scope of the bug.
- Do not mark something closed just because the previous cycle said it was fixed.
```

## Reviewer prompt template

When this lane is being used for the final split-verdict `regression_sanity` pass, the invoker must say so explicitly and constrain the review to regressions introduced since that lane last approved.

Use this exact output contract:

```text
Review the implementation against the audit as a route-closure review, not a diff review.

Create exactly 3 sections:

1. Closure Verdicts
For each audited failure class, mark:
- Closed / Partial / Open

And include:
- enforced route invariant
- evidence shown
- missing proof
- sibling sites still uncovered
- whether broader shared power was introduced and whether that was justified
- whether negative proof exists where required
- whether live-route vs proof-route isolation is shown
- claimed supported route / route mutated / route proved
- whether the patch is route-complete or endpoint-only

If there are no audited failure classes left open or partial, write:
- None.

2. Remaining Root Cause
State what system-level contract or policy is still missing or only partially enforced.

If no root cause remains, write:
- None.

3. Next Minimal Fix Pass
List only the smallest end-to-end routes that still need changes.
For each one, state:
- what still breaks
- what minimal additional layers must change
- what proof is still required

If no further fix pass is required, write:
- None.

Reject the fix as incomplete if:
- it patches cited lines but not sibling instances of the same failure class
- it changes behavior without proving the invariant end to end
- it introduces broader shared power without naming who may and may not use it
- it changes a shared surface without negative proof
- the proved route does not match the claimed supported route
- proof seams, toggles, or harness knobs contaminate the live route
- it widens scope into broad refactoring without necessity
- it treats historical debt as if it were a live route closure
- it claims closure without concrete proof
```

## Implementor prompt template

Use this exact output contract before and after coding:

```text
Look at the audit from a system-route view.
Your job is to close the reported failure classes across the full code path, without widening scope into broad refactoring.
You must also update all materially affected authoritative documentation in the same cycle, and you must run under the strongest available autonomous access mode supported by the current Codex runtime so the workflow does not stall on permission prompts.

Before coding, output exactly 5 short blocks:

1. Failure Classes To Close
Name each failure class in one line.

If there is nothing to close, write:
None.

2. Route Contract Freeze
For each failure class, state:
- claimed supported route
- end-to-end invariant
- allowed mutation surfaces
- forbidden shared-surface expansion
- docs that must be updated

If there is no remaining contract gap, write:
None.

3. Sweep Scope
List the upstream/downstream and sibling paths you will inspect so this is not an endpoint-only patch.

If no sweep is needed, write:
None.

4. Closure Proof
List the exact tests, runtime evidence, DB queries, persisted artifacts, or shutdown behavior you will produce to prove closure.
Include the route you will prove, and include negative proof plus live/proof isolation checks when required.

If no proof is required because nothing changes, write:
None.

5. Regression Forecast / Shared-Surface Check
For each likely regression, state the targeted check that will guard it.
If the fix adds or broadens any env var, schema field, `workflow_status` or lifecycle field, controller argument, generic create/update path, shared helper behavior, or reusable mutation surface, also state:
- who may set it
- who must not set it
- what sibling routes or callers could misuse it

If none, write:
None.

Then execute the plan.

Rules:
- Do not patch only the cited lines.
- Inspect sibling sites for the same failure class.
- Prefer the smallest contract change that closes the route.
- Preserve current architecture unless a broader change is required to enforce the contract.
- Treat live defects, regressions, historical debt, and policy edge cases differently.
- A fix is not done until proof exists.
- Do not begin code changes until `fix-plan.md` exists and freezes the same contract.
- Happy-path proof is insufficient for shared-surface changes.
- If claimed route, mutated route, and proved route do not line up, stop and call the route still open.
- Check for proof or test seams contaminating live bootstrap, and for env or harness knobs that silently alter production behavior.
- Do not treat the cited files as the scope of the bug. Treat them as evidence of a failure class, then sweep the full route and sibling sites for the same contract break.
- Update all materially affected authoritative docs, including design docs, context docs, architecture docs, specs, runbooks, and related project documents.
- Create or update `fix-plan.md` before code changes when implementation is required.
- Create or update `fix-report.md` only after verification evidence exists.
- If a required upstream artifact is missing or malformed, stop and report that fact inside the required output blocks rather than guessing.

At the end, output exactly:

1. Contracts now enforced
2. Files changed and why
3. Sibling/shared sites checked
4. Proof of closure
5. Non-goals intentionally left untouched
```

## fix-plan.md format

Create `fix-plan.md` with exactly these sections:

```text
1. Failure Classes
2. Route Contracts
3. Sweep Scope
4. Planned Changes
5. Closure Proof
6. Non-Goals
```

Rules:

- each heading must appear exactly once
- headings must appear in the listed order
- if a section is empty, write `None.` under it
- `1. Failure Classes` must name the failure classes to close, and must normalize a broad or mixed task into route-level failure classes before coding
- `2. Route Contracts` must freeze claimed supported route, end-to-end invariants, allowed mutation surfaces, forbidden shared-surface expansion, and docs to update
- `3. Sweep Scope` must name upstream/downstream siblings, adjacent routes, and shared callers or surfaces to inspect
- `4. Planned Changes` must stay minimal and must name any new power being introduced on a shared surface
- `5. Closure Proof` must state the route to prove, the negative proof required for shared-surface changes, live/proof isolation checks, and the targeted regression checks

## fix-report.md format

Create `fix-report.md` with exactly these sections:

```text
1. Failure Classes Closed
2. Route Contracts Now Enforced
3. Files Changed And Why
4. Sibling Sites Checked
5. Proof Of Closure
6. Remaining Debt / Non-Goals
7. Next Cycle Starting Point
```

Rules:

- each heading must appear exactly once
- headings must appear in the listed order
- if a section is empty, write `None.` under it
- do not claim closure without concrete evidence in section 5
- section 5 must name the proved route, include negative proof when a shared surface changed, and call out live/proof isolation checks when those mattered
- if claimed supported route, mutated route, and proved route do not match, treat that as remaining open work instead of closure

## Commit message format

Use this exact structure:

```text
title:
review-cycle(<feature_slug>): phase<phase_number> cycle-<NN> close route-level defects

body:
- task summary
- failure classes addressed
- route contracts enforced
- execution access mode used for auditor/reviewer/implementor
- whether any execution was recreated to upgrade access mode
- worker runtime and control-plane runtime when they differ
- major files changed
- sibling sweep performed
- verification evidence
- documentation updated
- why those docs changed
- setup reused, refreshed, or auto-created
- artifact folder path
- remaining debt / non-goals
```
