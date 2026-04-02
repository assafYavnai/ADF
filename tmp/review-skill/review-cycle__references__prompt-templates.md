# Prompt Templates

If you run nested `codex exec` reviewers, keep the prompt body short and point the reviewer to files on disk. Do not paste large artifacts inline when the files already exist.

## Auditor prompt template

Use this exact output contract:

```text
Re-review/audit the code after fixes to the last report were introduced, then create exactly 3 sections:

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
- status: live defect / regression / historical debt / policy edge case

2. Conceptual Root Cause
State the system-level causes that created the issues.
Group findings by missing contract or policy, not by file.
Explain what route-level invariant was missing or unenforced.

3. High-Level View Of System Routes That Still Need Work
List the end-to-end routes that still need attention.
For each route include:
- why endpoint-only fixes will fail
- the minimal layers that must change to close the route
- explicit non-goals, so scope does not widen into general refactoring
- what done looks like operationally

Important:
- Do not stop at the cited endpoint.
- Sweep for sibling instances of the same failure class in one pass.
- Prefer the smallest route-contract fix that closes the class.
```

## Reviewer prompt template

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
- whether the patch is route-complete or endpoint-only

2. Remaining Root Cause
State what system-level contract or policy is still missing or only partially enforced.

3. Next Minimal Fix Pass
List only the smallest end-to-end routes that still need changes.
For each one, state:
- what still breaks
- what minimal additional layers must change
- what proof is still required

Reject the fix as incomplete if:
- it patches cited lines but not sibling instances of the same failure class
- it changes behavior without proving the invariant end to end
- it widens scope into broad refactoring without necessity
- it treats historical debt as if it were a live route closure
```

## Implementor prompt template

Use this exact output contract before and after coding:

```text
Look at the audit from a system-route view.
Your job is to close the reported failure classes across the full code path, without widening scope into broad refactoring.
You must also update all materially affected authoritative documentation in the same cycle, and you must run under the strongest available autonomous access mode supported by the current Codex runtime so the workflow does not stall on permission prompts.

Before coding, output exactly 4 short blocks:

1. Failure Classes To Close
Name each failure class in one line.

2. Route Contracts To Enforce
For each failure class, state the invariant that must hold end to end.

3. Sweep Scope
List the upstream/downstream and sibling paths you will inspect so this is not an endpoint-only patch.

4. Closure Proof
List the exact tests, runtime evidence, DB queries, persisted artifacts, or shutdown behavior you will produce to prove closure.

Then execute the plan.

Rules:
- Do not patch only the cited lines.
- Inspect sibling sites for the same failure class.
- Prefer the smallest contract change that closes the route.
- Preserve current architecture unless a broader change is required to enforce the contract.
- Treat live defects, regressions, historical debt, and policy edge cases differently.
- A fix is not done until proof exists.
- Do not treat the cited files as the scope of the bug. Treat them as evidence of a failure class, then sweep the full route and sibling sites for the same contract break.
- Update all materially affected authoritative docs, including design docs, context docs, architecture docs, specs, runbooks, and related project documents.

At the end, output exactly:

1. Contracts now enforced
2. Files changed and why
3. Sibling sites checked
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
- major files changed
- sibling sweep performed
- verification evidence
- documentation updated
- why those docs changed
- setup reused, refreshed, or auto-created
- artifact folder path
- remaining debt / non-goals
```
