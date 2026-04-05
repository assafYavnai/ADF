1. Implementation Objective

Create the required wiring and compatibility gate that proves the upgraded `implement-plan` path and the new benchmarking skill speak the same contract, support the same runtime semantics, and can be integrated without ad hoc bridge logic.

2. Slice Scope

- This slice is the merger gate. It must dry-run and hard-verify contract/version compatibility, mode behavior, event/KPI semantics, resume/reset semantics, and stop conditions before benchmark wiring is allowed to land on `master`.
- Keep normal mode and benchmarking mode inside one contract vocabulary rather than splitting into separate incompatible schemas.
- Keep the slice bounded to repo-owned workflow/runtime authorities and this feature root.
- Preserve the current governed route truths already established in `implement-plan`, `review-cycle`, and `merge-queue`.
- Update only the minimum aligned docs/prompts/helpers needed to make the new behavior truthful, resumable, and production-safe.

3. Required Deliverables

- A strict compatibility gate that validates JSON schema version, required fields, mode behavior, provider/runtime override behavior, event model compatibility, KPI semantics, Brain sink semantics, resume/reset semantics, and stop behavior across Spec 1 and Spec 2.
- Dry-run compatibility checks that prove the benchmark skill can consume Spec 1 contracts, that required live push channels can open when requested, that lane planning works, and that KPI or Brain sink policy is enforced truthfully.
- Hard-stop reporting when either side is missing a required capability or when either side makes incompatible assumptions.
- No hidden bridge logic: the wiring slice may verify and report, but it may not quietly reinterpret incompatible contracts.
- A merge gate decision model that allows integration only when Spec 1 is on `master`, Spec 2 implements its required behavior, and compatibility checks all pass.

4. Allowed Edits

- A narrow repo-owned compatibility or validation layer under `C:/ADF/skills` or `C:/ADF/docs` as needed for the gate
- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md) and related workflow docs only where compatibility expectations must be frozen or clarified
- The benchmark skill docs/contracts only where compatibility expectations must be frozen or clarified
- Minimal shared helper/runtime validation code required to execute dry-run contract compatibility checks
- This feature root under `/C:/ADF/docs/phase1/implementation-benchmark-wiring-gate`

5. Forbidden Edits

- Do not fix missing Spec 1 or Spec 2 behavior by adding silent adapters here.
- Do not reinterpret terminal states so incompatible systems appear compatible.
- Do not make the wiring layer another supervisor or another worker runtime.
- Do not allow partial pass or best-effort merge when required compatibility fails.

6. Acceptance Gates

1. Spec 1 and Spec 2 agree on the same versioned JSON contract and mode semantics.
2. The benchmark skill consumes the Spec 1 contract without hidden shims or side assumptions.
3. Dry-run compatibility can prove event delivery policy, KPI sink policy, Brain sink policy, lane planning, and resume/reset registry behavior.
4. Any required mismatch produces a hard-stop with exact missing or divergent features named.
5. Integration is allowed only when the full compatibility gate passes.

Machine Verification Plan
- Run `node --check` on every modified helper or runtime script.
- Run `git diff --check` on the changed source set.
- Run targeted helper or workflow dry-run smoke checks for the new contract fields, route behavior, and failure paths.
- Refresh and validate installed skill targets with `manage-skills install/check` when source changes materially affect generated installs.
- Capture proof artifacts under this feature stream.

Human Verification Plan
- Required: false
- Reason: this is internal workflow/governance work. Truthful route proof comes from machine verification, governed review, and durable artifacts rather than a separate human-facing product test.

7. Observability / Audit

- Compatibility reports must name each checked capability, pass/fail result, and exact mismatch cause.
- Dry-run artifacts must be easy to inspect and must clearly separate contract mismatch from environment/bootstrap mismatch.
- The final gate result must say whether merge is allowed now, blocked pending Spec 1 work, or blocked pending Spec 2 work.

8. Dependencies / Constraints

- This slice is the merger gate, not a repair layer.
- Keep it fail-closed and machine-checkable.
- Reuse the same contract vocabulary and terminal statuses rather than inventing compatibility-only synonyms.

9. Non-Goals

- Do not implement missing Spec 1 or Spec 2 behavior inside the wiring layer.
- Do not create compatibility shims that hide contract divergence.
- Do not partial-wire or partially merge on missing requirements.
- Do not broaden this slice into another orchestration engine.

10. Source Authorities

- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [SKILL.md](/C:/ADF/skills/review-cycle/SKILL.md)
- [SKILL.md](/C:/ADF/skills/merge-queue/SKILL.md)
- [governed-feature-runtime.mjs](/C:/ADF/skills/governed-feature-runtime.mjs)
- [README.md](/C:/ADF/docs/phase1/implementation-benchmark-wiring-gate/README.md)
- [context.md](/C:/ADF/docs/phase1/implementation-benchmark-wiring-gate/context.md)
