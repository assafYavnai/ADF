1. Failure Classes

- missing-review-cycle-gate-for-human-verification

2. Route Contracts

- claimed supported route: implement-plan plan freeze -> machine verification -> review-cycle -> human testing when required -> post-approval sanity review-cycle when needed
- end-to-end invariants:
  - `Human Verification Plan` with `Required: true` implies `post_send_to_review=true`
  - human testing cannot start before the first route-level review-cycle gate
- allowed mutation surfaces:
  - `C:/ADF/skills/implement-plan/SKILL.md`
  - `C:/ADF/skills/implement-plan/references/workflow-contract.md`
  - `C:/ADF/skills/implement-plan/references/prompt-templates.md`
  - `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- forbidden shared-surface expansion: do not widen into review-cycle state redesign or installer work
- docs to update:
  - implement-plan contract docs
  - this feature stream artifacts

3. Sweep Scope

- implement-plan SKILL and workflow wording
- implement-plan integrity checker / helper validation
- implement-plan prompt rules that describe legal flag combinations

4. Planned Changes

- add the missing hard-stop to the helper when human verification is required but post-review handoff is disabled
- align SKILL, workflow-contract, and prompt-templates so the same route invariant is explicit everywhere

5. Closure Proof

- prove route: `Human Verification Plan Required:true` + `post_send_to_review=false` -> helper prepare rejects
- negative proof: `Human Verification Plan Required:false` + `post_send_to_review=false` remains legal
- targeted regression checks:
  - `node --check` on modified helpers
  - helper smoke checks for invalid and valid flag combinations

6. Non-Goals

- No review-cycle framework rewrite
- No installer changes
- No human-testing artifact redesign beyond the already approved message shape
