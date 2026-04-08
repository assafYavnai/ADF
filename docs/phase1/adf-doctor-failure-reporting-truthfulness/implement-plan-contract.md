1. Implementation Objective

Make `adf.cmd --doctor` and `./adf.sh --doctor` report failing repair and verification steps truthfully, including the real exit code and failure stage, so operators can trust doctor output.

2. Slice Scope

- `adf.sh` for doctor failure capture, stage handling, and printed report truth
- `tools/agent-runtime-preflight.mjs` only if a minimal contract note or output alignment is required
- `tools/doctor-brain-*.mjs` only if a minimal additive proof hook is strictly required
- targeted tests or smoke scripts for doctor failure reporting
- `docs/phase1/adf-doctor-failure-reporting-truthfulness/**` for contract, context, and completion artifacts

3. Required Deliverables

- truthful exit-code reporting for failed doctor repair and verification steps
- aligned stage, incident, and printed report output
- targeted proof or test coverage for a failing doctor step
- `context.md`
- `completion-summary.md`

4. Allowed Edits

- `C:/ADF/adf.sh`
- `C:/ADF/tools/agent-runtime-preflight.mjs` only if a minimal contract note or output alignment is required
- `C:/ADF/tools/doctor-brain-*.mjs` only if a minimal additive proof hook is strictly required
- targeted tests or smoke scripts for doctor failure reporting
- `C:/ADF/docs/phase1/adf-doctor-failure-reporting-truthfulness/**`

5. Forbidden Edits

- no broad bootstrap redesign
- no new doctor feature work unrelated to truthful failure reporting
- no implement-plan, review-cycle, or merge-queue changes
- no unrelated Brain behavior changes

6. Acceptance Gates

1. A failing doctor step reports its real nonzero exit code.
2. Printed doctor output, incident artifacts, and stage reporting agree on the failure truth.
3. Success-path doctor behavior remains unchanged.

## KPI Applicability

KPI Applicability: not required
KPI Non-Applicability Rationale: This slice repairs runtime-verification truth in the bootstrap path and does not add or change a production KPI route.

## Vision / Phase 1 / Master-Plan / Gap-Closure Compatibility

Vision Compatibility: Strengthens truthful runtime authority by making doctor output reliable for bootstrap and repair decisions.
Phase 1 Compatibility: This is bounded Phase 1 infrastructure hardening for the active runtime and implementation route.
Master-Plan Compatibility: Keeps the supported bootstrap and repair path trustworthy without widening into unrelated architecture work.
Current Gap-Closure Compatibility: Supports all current gap-closure work by restoring trust in the doctor surface used to verify runtime prerequisites.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: Current doctor output can claim a failed step exited with code 0 because the failure capture logic records the wrong status after an `if` compound command. This slice repairs that defect directly.

## Machine Verification Plan

- run a bounded failing doctor-step smoke path or targeted test that proves the real exit code is preserved
- run a success-path smoke check if the slice touches success-path reporting logic
- run `git diff --check` on the changed source set

## Human Verification Plan

- Required: false
- Reason: this is a bounded operational truth fix, not a human-facing product surface

7. Observability / Audit

- the printed doctor report, incident artifact, and stage reporting must all reflect the same real failure
- the captured exit code must come from the failing command rather than a wrapper compound command
- any proof artifact added in this slice must preserve the failing-stage context

8. Dependencies / Constraints

- preserve success-path output
- keep the fix bounded to doctor failure capture and reporting
- prove the failure truth with a deterministic failing path

9. Non-Goals

- no bootstrap architecture redesign
- no unrelated doctor or Brain feature work
- no product-route changes

10. Source Authorities

- `C:/ADF/docs/phase1/adf-doctor-failure-reporting-truthfulness/README.md`
- `C:/ADF/docs/phase1/adf-doctor-failure-reporting-truthfulness/context.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`

11. Implementor Defaults

- Preferred Worker Provider: `claude`
- Preferred Worker Runtime: `claude_code_exec`
- Preferred Worker Access Mode: `claude_code_skip_permissions`
- Preferred Worker Model: `claude-opus-4-6`
- Preferred Implementor Model: `claude-opus-4-6`
- Preferred Throttle: `max`
- Preferred Reasoning Effort: not separately configured for this Claude route

12. Closeout Rules

- run machine verification before review handoff
- use review-cycle after implementation
- keep failure proof explicit in closeout artifacts
- do not mark complete until review closure and merge-queue closeout succeed truthfully
