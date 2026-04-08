1. Objective Completed

Added 7-field Vision/Phase 1/Master-Plan/Gap-Closure compatibility gate to `implement-plan` and `review-cycle` workflows. Every implementation slice must now explicitly demonstrate authority-chain compatibility before implementation can start, and reviewers must judge compatibility before closure.

2. Deliverables Produced

- `COMPATIBILITY_GATE_CONTENT_LABELS` and `COMPATIBILITY_DECISION_ALLOWED_VALUES` constants in `implement-plan-helper.mjs`
- 3-part gate in `evaluateIntegrity()`: content fields, decision validation, later-company check
- Updated SKILL.md for both `implement-plan` and `review-cycle`
- Updated workflow-contract.md for both skills with "Vision / Phase 1 / Master-Plan compatibility gate" sections
- Updated prompt-templates.md for both skills with compatibility fields in integrity checker, normalized contract, auditor, reviewer, and implementor templates
- Review-cycle cycle-01 artifacts (audit, review, fix-plan, fix-report)

3. Files Changed And Why

- `skills/implement-plan/scripts/implement-plan-helper.mjs` — added constants and gate logic in `evaluateIntegrity()`
- `skills/implement-plan/SKILL.md` — documented 7-field gate in integrity gate rule
- `skills/implement-plan/references/workflow-contract.md` — added compatibility gate section with full authority references
- `skills/implement-plan/references/prompt-templates.md` — added 7 sublabels and validation rules
- `skills/review-cycle/SKILL.md` — added 7-field compatibility to fix-plan freeze
- `skills/review-cycle/references/workflow-contract.md` — added compatibility gate section
- `skills/review-cycle/references/prompt-templates.md` — added compatibility verdict to auditor/reviewer/implementor templates

4. Verification Evidence

- Machine Verification: 5 smoke checks pass (missing fails, valid passes, defer-later-company blocks, Later-Company Check: yes blocks, blocked-needs-user-decision blocks)
- Human Verification Requirement: Required
- Human Verification Status: APPROVED
- Review-Cycle Status: cycle-01 approved (both auditor and reviewer)
- Merge Status: merged to main
- Local Target Sync Status: main is up to date with origin/main
- Merge commit: 9839399

5. Feature Artifacts Updated

- `docs/phase1/implement-plan-review-cycle-vision-master-plan-gating/cycle-01/` — audit, review, fix-plan, fix-report
- `docs/phase1/implement-plan-review-cycle-vision-master-plan-gating/review-cycle-state.json`
- `docs/phase1/implement-plan-review-cycle-vision-master-plan-gating/completion-summary.md`

6. Commit And Push Result

- Implementation commit: 663175f (feature branch)
- Review cycle commit: 5e95cec (feature branch)
- Merge commit: 9839399 (main)
- Push: success to origin/main

7. Remaining Non-Goals / Debt

- No COO runtime changes
- No merge-queue redesign
- No memory-engine redesign
- No review-cycle-helper.mjs changes (gate enforcement is prompt/template-driven for review-cycle)
