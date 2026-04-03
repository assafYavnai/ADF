1. Implementation Objective

Implement the approved `implement-plan` workflow upgrade so every bounded slice must declare machine verification and human verification before coding, the human-testing handoff is explicit and fixed-shape, and the skill closes through machine proof, review-cycle, and human approval truthfully instead of treating code completion as sufficient.

2. Exact Slice Scope

- `implement-plan` contracts, prompts, helper validation, and completion reporting under [implement-plan](/C:/ADF/skills/implement-plan).
- Minimal `review-cycle` contract/prompt/helper alignment under [review-cycle](/C:/ADF/skills/review-cycle) for explicit `APPROVED` / `REJECTED` surfacing and the post-human-approval sanity pass rules.
- Feature artifacts under [implement-plan-verification-and-approval-flow](/C:/ADF/docs/phase1/implement-plan-verification-and-approval-flow).

3. Inputs / Authorities Read

- [README.md](/C:/ADF/docs/phase1/implement-plan-verification-and-approval-flow/README.md)
- [context.md](/C:/ADF/docs/phase1/implement-plan-verification-and-approval-flow/context.md)
- [implement-plan-contract.md](/C:/ADF/docs/phase1/implement-plan-verification-and-approval-flow/implement-plan-contract.md)
- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/implement-plan/references/prompt-templates.md)
- [implement-plan-helper.mjs](/C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs)
- [SKILL.md](/C:/ADF/skills/review-cycle/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/review-cycle/references/workflow-contract.md)
- [prompt-templates.md](/C:/ADF/skills/review-cycle/references/prompt-templates.md)

4. Required Deliverables

- Hard integrity-gate enforcement for `Machine Verification Plan` and `Human Verification Plan`.
- Required `Human Verification Plan` truth field `Required: true|false`, with detailed user test instructions when `true`.
- Implement-plan workflow wording and closeout logic for:
  - implementation -> machine-test loop
  - review-cycle gate before human testing
  - human rejection -> code fix -> machine retest -> human retest
  - post-human-approval sanity review-cycle only when code changed after human approval
  - stale-human-approval rule when a later fix changes approved human-facing behavior
- Explicit testing-phase user handoff message contract.
- Explicit `APPROVED` / `REJECTED` surfacing in `review-cycle` reports and summaries.
- Updated completion summary fields and verification evidence expectations.

5. Forbidden Edits

- Do not widen into installer, repo-mirror, or agent-name work.
- Do not weaken exact heading contracts or current review-cycle closeout/resume behavior.
- Do not replace route-level review-cycle judgment with generic prose-only approval.
- Do not add broad framework abstractions beyond what the two skills need.

6. Integrity-Verified Assumptions Only

- The current `implement-plan` helper only enforces generic deliverables/scope/acceptance signals and does not yet hard-stop on missing machine or human verification planning.
- The current `implement-plan` prompt contracts do not yet force a distinct human-testing handoff message or required `Required: true|false` human verification declaration.
- The current `review-cycle` reports are still easy to read without an explicit top-line verdict, so verdict surfacing needs strengthening.
- The approved workflow intentionally separates machine proof, route-level review, and human approval.
- Minimal aligned `review-cycle` changes are acceptable in this slice because the new `implement-plan` flow depends on explicit sanity-pass and verdict semantics.

7. Explicit Non-Goals

- No unrelated product feature work.
- No global installer behavior changes.
- No skill family expansion beyond the approved verification/approval flow.
- No speculative UX changes beyond the explicit testing-phase handoff and verdict surfacing.

8. Proof / Verification Expectations

- Helper validation proof showing missing verification plans now fail with pushback.
- Positive prepare/run proof showing a valid contract passes integrity and brief generation.
- Machine verification on modified helpers and scripts, including `node --check`.
- Targeted smoke checks for review handoff flags and any new summary/verdict outputs.
- If helper or contract behavior changes materially, regenerate and validate the local installed Codex skill output.

9. Required Artifact Updates

- [implement-plan-contract.md](/C:/ADF/docs/phase1/implement-plan-verification-and-approval-flow/implement-plan-contract.md)
- [implement-plan-brief.md](/C:/ADF/docs/phase1/implement-plan-verification-and-approval-flow/implement-plan-brief.md)
- [implement-plan-state.json](/C:/ADF/docs/phase1/implement-plan-verification-and-approval-flow/implement-plan-state.json)
- [completion-summary.md](/C:/ADF/docs/phase1/implement-plan-verification-and-approval-flow/completion-summary.md)
- The relevant `implement-plan` and `review-cycle` contract/prompt/helper files

10. Closeout Rules

- Keep the slice bounded to planning/verification/approval workflow changes.
- Update state/events as the slice moves from integrity pass to brief ready, implementation, verification, and closeout.
- Commit the planning artifacts before code changes.
- After implementation, run machine verification before any review handoff.
- Use `review-cycle` with `until_complete=true` for the implementation closeout path when the slice is ready.
- Do not mark the feature complete until completion artifacts are valid and git closeout succeeded.
