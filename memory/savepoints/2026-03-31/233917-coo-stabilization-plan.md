# COO Stabilization Direction

## Metadata
- created_at: 2026-03-31T23:39:37.4559371+03:00
- workspace: C:/ADF
- save_root: C:/ADF/memory/savepoints
- previous_savepoint: none
- boundary_confidence: high

## Highlighted Topic
The discussion shifted from archaeology of the partial COO implementation into a concrete management decision: the current COO should not be restarted or pushed straight into onion implementation, but instead stabilized first as a trustworthy Phase 1 continuity and requirements-shaping component.

## Discussion Summary
We inspected the partial COO lane, the original Step 1 and Step 2 plan trail, and the later drift into ARB and implementation-engine work. The conclusion was that the architectural foundation is mostly right, but the actual COO runtime is still a fragile prototype. We then created independent review and audit prompts for the COO, received both reports, and used them to change the plan from onion-first to stabilization-first. The saved COO completion plan now treats the current COO as salvageable but not yet mature, and defines a focused maturation path built around persistence truth, recovery truth, memory truth, observability truth, and capability honesty before any onion-lane completion work continues.

## Decisions Made
- Keep the existing COO architectural foundation; do not start over.
- Do not mechanically continue the old COO Step 2 plan.
- Do not move to onion implementation yet.
- Treat the current COO as a salvageable prototype, not a ready foundation.
- Run a COO stabilization slice before continuing Phase 1 COO lane work.
- Use the review and audit reports as the gating evidence for the new COO plan.
- Finish the COO in this order: stabilization, then onion lane, then requirement artifact, then requirement freeze/handoff.
- Record the current management direction in `docs/phase1/adf-phase1-coo-completion-plan.md`.
- Create a reusable `context-savepoint` skill so future discussion checkpoints can be written on demand.

## Open Loops
- Translate the accepted COO review and audit findings into a concrete execution plan with work packages and acceptance gates.
- Decide when to push the updated Phase 1 docs and COO plan to origin.
- Implement the COO stabilization slice:
- persistence truth
- recovery truth
- memory truth
- observability truth
- capability honesty
- After stabilization, resume the onion-lane and requirement-artifact work.

## Next Likely Steps
- Turn the stabilization-first COO plan into an execution plan.
- Prioritize fixes for broken decision logging, broken rule/governance writes, scope resolution, resume/recovery, memory relevance, and telemetry sink truth.
- Re-run focused validation on the stabilized COO before resuming onion implementation.
- Push the updated docs once the current checkpoint is accepted.

## Referenced Files
- docs/phase1/README.md
- docs/phase1/adf-phase1-discussion-record.md
- docs/phase1/adf-phase1-high-level-plan.md
- docs/phase1/adf-phase1-coo-completion-plan.md
- docs/v0/context/requirements-gathering-onion-model.md
- docs/v0/context/step1-scaffolding-plan.md
- docs/v0/context/step2-intelligence-plan.md
- docs/v0/context/step2-final-checkpoint.md
- docs/v0/context/step2f-run010-postmortem.md
- COO/controller/loop.ts
- COO/controller/thread.ts
- COO/controller/cli.ts
- COO/controller/memory-engine-client.ts
- COO/context-engineer/context-engineer.ts
- COO/classifier/classifier.ts
- components/memory-engine/src/services/search.ts
- components/memory-engine/src/services/scope.ts
- components/memory-engine/src/tools/decision-tools.ts
- components/memory-engine/src/tools/governance-tools.ts

## User Prompts
1. Check the partial of ADF COO, compare it with the earlier 12-factor-agents and memory-stack start, and determine where the COO lane currently stands.
2. Argue that the first step should be to fully implement the 12-factor + memory-stack foundation before the onion implementation, with the phase done when nothing is lost, the COO conversation feels natural, and a requirement-list artifact can be created.
3. Ask why the memory stack should not be completed fully if it is the foundation of the system.
4. Request that the revised discussion and decisions be written down.
5. Ask which plan doc the COO was originally created from and where implementation stopped, hoping git would contain breadcrumbs.
6. Ask whether the old plan should be completed, whether a new plan is needed, whether the current COO model is usable, and whether the right move is to start over.
7. Request a prompt for an independent code review of the COO with no reference to the old plan.
8. Request the matching prompt for an independent operational audit of the COO.
9. Ask to create a new plan to finish the COO implementation.
10. Ask to save that new COO plan to file so it does not get lost.
11. Provide the external COO code-review report.
12. Provide the external COO audit report.
13. Ask to update the plan with the new findings and decisions and make it solid enough to mature the COO component.
14. Ask for a skill that can save all information since the last save point with prompts, answers, topic, summary, and decisions.
15. Ask to install `PyYAML`.
16. Ask to upgrade `pip`.
17. Invoke `$context-savepoint` to save the current checkpoint.

## Assistant Responses
1. Reported that the 12-factor/memory-stack foundation is partially real: controller, thread model, context engineer, Brain client, and CLI exist, but requirements-gathering runtime and feature-function runtime are still mostly declarative or missing.
2. Agreed with the destination but reframed the first step as finishing the ADF continuity foundation first, then building the onion lane and the requirement artifact on top of it.
3. Clarified that the goal is full ADF continuity foundation, not literal reproduction of every legacy memory-stack layer; the ADF-adapted model should be completed, while replaced or deprecated legacy layers should not drive Phase 1 work.
4. Updated the Phase 1 docs to capture the revised continuity-first direction and done criteria.
5. Traced the implementation history to `step2-intelligence-plan.md`, showed that Step 1 and Step 2a+2b landed, a small part of 2g landed, but the real stop point was before Phase 2f COO roles and before a full governed COO lane existed.
6. Recommended not starting over and not resuming the old plan mechanically; instead, keep the working foundation and supersede the old execution order with a new continuity-first, onion-first plan.
7. Wrote a strict, plan-independent COO code-review prompt.
8. Wrote a matching COO operational audit prompt focused on truthfulness, recoverability, and actual capability.
9. Created a high-level COO completion plan centered on continuity, onion conversation, requirement artifact, and requirement freeze/handoff.
10. Saved that COO completion plan to `docs/phase1/adf-phase1-coo-completion-plan.md`.
11. Accepted the code-review findings and concluded the current COO is not operationally ready as a durable CEO<->COO conversation layer.
12. Accepted the audit findings and concluded the current COO is only a salvageable prototype, not a trustworthy management or recovery surface.
13. Rewrote the COO completion plan into a stabilization-first plan with keep/fix/defer, maturity gates, and sequencing that blocks onion work until stabilization passes.
14. Used the skill-creator workflow to create a reusable `context-savepoint` skill under the Codex skills directory.
15. Installed `PyYAML` and verified the skill validator could run successfully.
16. Upgraded `pip` to 26.0.1 and verified the installed version.
17. Started this savepoint write because no previous `latest.json` existed, so this became the first recorded savepoint.
