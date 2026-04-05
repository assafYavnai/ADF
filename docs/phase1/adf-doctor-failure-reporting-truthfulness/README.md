# adf-doctor-failure-reporting-truthfulness

## Target Local Folder
C:/ADF/docs/phase1/adf-doctor-failure-reporting-truthfulness/README.md

## Feature Goal
Make `adf.cmd --doctor` and `./adf.sh --doctor` report failing repair and verification steps truthfully, including the real exit code and failure stage, so operators can trust doctor output.

## Why This Slice Exists Now

- doctor currently reports some failing repair steps as `exit code 0`
- that breaks operator trust in the runtime verification surface
- the defect sits in the bootstrap and repair path that all future work depends on

## Requested Scope

Keep this slice tightly focused on doctor failure capture, reporting, and bounded proof.

This slice must:

- fix the failing-step exit-code capture path in `adf.sh`
- keep stage, incident, and printed report output aligned with the real failure
- preserve existing success-path behavior
- add or update targeted proof if needed so the failure does not regress silently

## Allowed Edits

- `adf.sh`
- `tools/agent-runtime-preflight.mjs` only if a minimal contract note or output alignment is required
- `tools/doctor-brain-*.mjs` only if a minimal additive proof hook is strictly required
- targeted tests or smoke scripts for doctor failure reporting
- `docs/phase1/adf-doctor-failure-reporting-truthfulness/**`

## Forbidden Edits

- no broad bootstrap redesign
- no new doctor feature work unrelated to truthful failure reporting
- no implement-plan, review-cycle, or merge-queue changes
- no unrelated Brain behavior changes

## Required Deliverables

- truthful exit-code reporting for failed doctor repair and verification steps
- aligned stage, incident, and printed report output
- targeted proof or test coverage for a failing doctor step
- context.md
- implement-plan-contract.md
- completion-summary.md

## Acceptance Gates

- a failing doctor step reports its real nonzero exit code
- printed doctor output, incident artifacts, and stage reporting agree on the failure truth
- success-path doctor behavior remains unchanged

## Machine Verification Plan

- run a bounded failing doctor-step smoke path or targeted test that proves the real exit code is preserved
- run a success-path smoke check if the slice touches success-path reporting logic
- run `git diff --check` on the changed source set

## Human Verification Plan

- Required: false
- Reason: this is a bounded operational truth fix, not a human-facing product surface

## Non-Goals

- no bootstrap architecture redesign
- no unrelated doctor or Brain feature work
- no product-route changes
