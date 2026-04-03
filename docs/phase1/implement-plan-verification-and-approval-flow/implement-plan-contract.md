1. Implementation Objective

Upgrade the repo-owned `implement-plan` skill so it hard-requires explicit machine-verification planning and human-verification planning before execution, enforces the approved implementation flow of implementation -> machine-test loop -> review-cycle -> human testing/approval when required -> post-approval sanity review-cycle only when code changed after human approval, and keeps the workflow compact and autonomous. Align `review-cycle` only where needed so verdicts and sanity handoff are explicit and unambiguous.

2. Slice Scope

- Strengthen [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md), [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md), [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md), and [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs).
- Add hard plan-integrity checks for:
  - a machine verification plan
  - a human verification plan with `Required: true|false`
  - detailed human testing instructions when `Required: true`
- Encode the approved flow and closeout rules in implement-plan artifacts, prompts, helper validation, and completion reporting.
- Make the human-testing handoff explicitly announce the testing phase and require a fixed-shape message with implementation summary, test sequence, expected results, and `APPROVED` / `REJECTED: <comments>` response contract.
- Update only the minimum `review-cycle` contracts/prompts/helpers needed to:
  - show explicit `APPROVED` / `REJECTED` verdicts in surfaced reports
  - preserve route-level review-cycle behavior while supporting the new post-human-approval sanity pass semantics
- Update feature artifacts for this stream and any skill-local docs/contracts materially affected by the new behavior.

3. Required Deliverables

- A tightened normalized implementation contract shape that fails integrity when either verification plan is missing.
- Implement-plan prompt and workflow changes that require:
  - machine verification plan on every slice
  - human verification plan on every slice
  - detailed human test instructions when human verification is required
  - explicit testing-phase handoff message
- Implement-plan helper validation changes that treat missing machine or human verification planning as hard-stop pushback.
- Implement-plan flow contract changes that explicitly describe:
  - implementation -> machine-test loop
  - review-cycle gate before human testing when human verification is required
  - human rejection loop with machine retest on every code change
  - post-human-approval sanity review-cycle only when code changed after human approval
  - the rule that post-approval sanity fixes must preserve approved human-facing behavior, or else human approval becomes stale
- Review-cycle prompt/contract/output changes that surface `APPROVED` / `REJECTED` clearly in the surfaced header and in the report body.
- Updated completion reporting that distinguishes:
  - machine verification evidence
  - human verification requirement/status
  - review-cycle verdicts
  - final closeout state
- End-to-end proof that the skill still prepares, validates, and closes out truthfully after the upgrade.

4. Allowed Edits

- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
- [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs)
- Minimal aligned updates under [review-cycle](/C:/ADF/skills/review-cycle) only where required for verdict surfacing, sanity-pass closure, or artifact/report contract consistency
- This feature root under [implement-plan-verification-and-approval-flow](/C:/ADF/docs/phase1/implement-plan-verification-and-approval-flow)

5. Forbidden Edits

- Do not widen the slice into installer refactors, cross-LLM packaging changes, or unrelated repo layout work.
- Do not redesign unrelated ADF product workflows.
- Do not rewrite review-cycle as a general framework or weaken its existing exact-heading, split-verdict, immediate-report, or closeout/resume contracts.
- Do not add vague policy prose where short enforceable rules are sufficient.
- Do not weaken truthful access-mode/runtime reporting or artifact-validity enforcement.
- Do not implement speculative agent naming changes in this slice.

6. Acceptance Gates

1. `implement-plan` `prepare` or `run` hard-stops when the normalized contract or equivalent authority set does not include an explicit machine verification plan.
2. `implement-plan` `prepare` or `run` hard-stops when the normalized contract or equivalent authority set does not include an explicit human verification plan.
3. The human verification plan must always state `Required: true` or `Required: false`.
4. When `Required: true`, the human verification plan must include:
   - explicit statement that the implementation is in the testing phase
   - short executive summary of the implemented behavior
   - exact test steps
   - expected results
   - evidence or observations to report back
   - exact response contract using `APPROVED` or `REJECTED: <comments>`
5. Machine verification remains mandatory for every code-changing slice and is rerun after each code fix before the slice may advance.
6. The approved flow is encoded and documented as:
   - implementation -> machine-test loop -> review-cycle
   - if human verification is not required and review-cycle approves, close normally
   - if human verification is required, hand off to human testing only after review-cycle approves
   - if human rejects, fix -> rerun machine verification -> return to human testing
   - after human approval, run sanity review-cycle only if code changed after human approval
   - if a post-approval sanity fix changes approved human-facing behavior, require human retest instead of silent closeout
7. Review-cycle surfaced reports clearly show `APPROVED` or `REJECTED` in the surfaced header, as the first line inside the report body, and as the final verdict line in the report body.
8. Completion reporting and feature state stay truthful about machine verification, human verification, review-cycle verdicts, and closeout eligibility.
9. The updated skills still validate exact headings and preserve current closeout/resume behavior.

7. Observability / Audit

- The contract must make it obvious whether machine verification is planned, executed, and passed.
- The contract must make it obvious whether human verification is required, pending, passed, or not required.
- Any human-testing handoff must clearly indicate that the slice is at the testing phase.
- The feature artifacts and summaries must distinguish review approval from machine proof and from human approval.
- Review-cycle report surfacing must expose verdict state without requiring the reader to infer it from prose.
- State transitions and completion summary must remain truthful when the slice is waiting on machine verification, waiting on human testing, waiting on sanity review, blocked, or complete.

8. Dependencies / Constraints

- Preserve the current short exact-heading artifact contracts and current helper-based validity checks.
- Preserve `post_send_to_review`, `review_until_complete`, and `review_max_cycles` semantics, extending them only as needed for the approved flow.
- Keep the human loop simple and bounded; do not add bureaucratic extra artifacts when existing plan and completion artifacts can carry the contract.
- The first review-cycle remains the route-closure gate before human testing when human verification is required.
- The post-human-approval sanity pass is a second review-cycle pass that exists to confirm production-level closure after approved human-visible behavior, not to reopen scope casually.
- The final sanity loop may only skip human retest when fixes do not change approved human-facing behavior.

9. Non-Goals

- No installer or mirror-management changes.
- No direct-runtime-from-repo wiring changes.
- No agent-name or thread-slug naming refactor.
- No broad redesign of review-cycle artifact layout.
- No unrelated feature-stream cleanup.

10. Source Authorities

- [README.md](/C:/ADF/docs/phase1/implement-plan-verification-and-approval-flow/README.md)
- [context.md](/C:/ADF/docs/phase1/implement-plan-verification-and-approval-flow/context.md)
- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
- [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs)
- [SKILL.md](/C:/ADF/skills/review-cycle/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/review-cycle/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/review-cycle/references/prompt-templates.md)
- [skills-repo-migration-plan.md](/C:/ADF/docs/skills-repo-migration-plan.md)
