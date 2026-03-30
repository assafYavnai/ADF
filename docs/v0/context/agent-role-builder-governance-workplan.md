# Agent-Role-Builder Governance Workplan

Date: 2026-03-30
Status: active workplan

Related docs:

- [agent-role-builder-governance-v1-frozen-design.md](C:/ADF/docs/v0/context/agent-role-builder-governance-v1-frozen-design.md)
- [2026-03-30-governance-v1-runtime-followup-findings.md](C:/ADF/docs/v0/context/2026-03-30-governance-v1-runtime-followup-findings.md)
- [2026-03-30-bom-question-followup.md](C:/ADF/docs/v0/context/2026-03-30-bom-question-followup.md)
- [2026-03-30-governance-v1-audit-findings.md](C:/ADF/docs/v0/context/2026-03-30-governance-v1-audit-findings.md)
- [step2-run017-postmortem.md](C:/ADF/docs/v0/context/step2-run017-postmortem.md)
- [agent-role-builder-governance-research-and-findings.md](C:/ADF/docs/v0/context/agent-role-builder-governance-research-and-findings.md)

## Purpose

This is the authoritative open-items workplan for the governance pilot and the adjacent runtime issues discovered during the same session.

Use this file to prevent gaps between:

- design
- implementation
- review findings
- postmortem findings
- deferred future work

## Current State

### V1

`V1` is implemented and hardened.

That includes:

- immutable governance snapshot for the `agent-role-builder` pilot
- snapshot-local authority rewrites
- blocked-only governance faults in the pilot
- BOM-tolerant ingress with audit trail
- V1 hardening fixes from the audit round

### Validation status

`V1` is not yet considered fully validated by a live end-to-end `agent-role-builder` run.

That validation is intentionally deferred until the runtime is mature enough that the run is not expected to fail for known non-governance reasons.

## Scope-Control Rules

These rules exist because earlier design rounds widened scope repeatedly.

Until a later version explicitly changes them:

1. one primary consumer only: `agent-role-builder`
2. no ad-hoc/code-review lane rollout
3. no `llm-tool-builder` or COO rollout as part of this workplan unless a later version explicitly names it
4. no shared-engine API redesign unless a later version explicitly names it
5. no source-governance self-heal
6. no meta-policy execution in the review hot path
7. no non-rulebook governance routing or proposal lifecycle work
8. no KPI or dashboard expansion before the runtime is stable enough to measure

## Update Discipline

After every implementation step:

1. update this workplan with:
   - status change
   - what landed
   - what remains
   - any newly discovered findings
2. commit the code and context update together if they belong to the same step
3. push immediately after the commit
4. do not begin the next step until the workplan reflects the new state

If a new finding appears:

- first try to place it inside an existing version and sub-step
- only create a new version if the finding truly changes scope

## Version Map

### V1.1 Revision Path Unblock

Purpose:

- make the live `agent-role-builder` revision path mature enough for a real run

Open items:

1. remove or neutralize `shared-imports.ts` divergence that keeps dropping canonical invoker fixes
2. restore reliable Codex revision invocation in the active `agent-role-builder` path
3. add a regression guard so the copied/shared boundary cannot silently lose the same fix again

Primary source:

- [step2-run017-postmortem.md](C:/ADF/docs/v0/context/step2-run017-postmortem.md)

Sub-steps:

1. identify every active `agent-role-builder` call path still using copied invoker logic
2. restore the canonical temp-file prompt handling in the live revision path
3. add a guard:
   - test
   - diff check
   - generation step
   - or another mechanical enforcement
4. record the result and remaining risk in context

Acceptance target:

- revision no longer fails because the copied invoker reverted to stdin or otherwise diverged from the canonical fixed path

### V1.2 Revision Recovery And Resume Correctness

Purpose:

- prevent recoverable revision failures from blocking too early
- preserve prior review state across resumed runs

Open items:

1. define and implement the minimum revision-failure recovery path
2. add provider fallback where a provider-specific failure is recoverable
3. carry prior reviewer status into resumed runs instead of resetting all reviewers to pending

Primary source:

- [step2-run017-postmortem.md](C:/ADF/docs/v0/context/step2-run017-postmortem.md)

Sub-steps:

1. freeze the minimum fixer/fallback contract for the revision lane only
2. decide the exact fallback order for provider-specific failure
3. implement the recovery path without widening into a generalized fixer platform
4. load reviewer status from resume state
5. verify that resumed runs skip already-satisfied reviewer work unless sanity checks require otherwise

Acceptance target:

- recoverable revision/provider failure does not immediately hard-stop the run
- resumed runs preserve reviewer status correctly

### V1.3 Live Validation And Learning Verification

Purpose:

- run the real `agent-role-builder` flow only after known runtime blockers are addressed

Open items:

1. execute a fresh live `agent-role-builder` run from the current baseline
2. verify multi-round behavior rather than only startup and unit invariants
3. verify learning lifecycle behavior from real artifacts

Primary sources:

- [step2-run017-postmortem.md](C:/ADF/docs/v0/context/step2-run017-postmortem.md)
- [2026-03-30-governance-v1-audit-findings.md](C:/ADF/docs/v0/context/2026-03-30-governance-v1-audit-findings.md)

Sub-steps:

1. run a clean end-to-end smoke on current `main`
2. inspect revision, repair, learning, and closeout artifacts
3. verify whether `learning.json` remains evidence-only or feeds the next-run candidate path exactly as intended
4. write a validation note and classify any new failures into:
   - remaining V1.x work
   - V2 work

Acceptance target:

- one truthful end-to-end `agent-role-builder` validation run with postmortem and next actions recorded

### V2A Runtime Boundary Cleanup

Purpose:

- remove the structural causes of repeated regressions in the shared/runtime boundary

Open items:

1. eliminate or mechanically generate manual shared-module copies such as `shared-imports.ts`
2. reduce cwd-sensitive assumptions where they remain in shared runtime paths
3. unify guarded path/provenance handling where snapshot and repair bundle logic overlap

Primary sources:

- [step2-run017-postmortem.md](C:/ADF/docs/v0/context/step2-run017-postmortem.md)
- [2026-03-30-governance-v1-audit-findings.md](C:/ADF/docs/v0/context/2026-03-30-governance-v1-audit-findings.md)

Sub-steps:

1. inventory copied shared logic and live consumers
2. choose one boundary strategy:
   - direct shared import
   - generated copy
   - build-time sync
3. land the smallest change that removes the recurring copy-divergence failure mode
4. harden remaining repo-root/cwd assumptions if still needed

Acceptance target:

- canonical shared fixes cannot silently disappear in copied tool-local modules

### V2B Governance And Learning Expansion

Purpose:

- expand beyond the frozen V1 pilot only after the pilot is stable

Open items:

1. meta-policy routing
2. non-rulebook governance routing
3. domain-contract and broader lane rollout
4. proposal lifecycle beyond `learning.json` evidence
5. future-run rule promotion/application contract

Primary sources:

- [agent-role-builder-governance-research-and-findings.md](C:/ADF/docs/v0/context/agent-role-builder-governance-research-and-findings.md)
- [agent-role-builder-governance-v1-frozen-design.md](C:/ADF/docs/v0/context/agent-role-builder-governance-v1-frozen-design.md)

Sub-steps:

1. freeze one narrow consumer and one routing surface
2. define explicit non-goals before implementation
3. avoid re-opening cross-tool rollout in the same pass

Acceptance target:

- governance expansion happens deliberately, not as bleed-over from pilot hardening

### V2C Observability, KPI, And Broader Audit Expansion

Purpose:

- add richer measurement only after runtime correctness is stable enough to measure

Open items:

1. KPI definitions
2. broader logging model
3. cross-tool normalization/healing reporting
4. dashboard or aggregated reporting shape

Primary sources:

- [2026-03-30-governance-v1-audit-findings.md](C:/ADF/docs/v0/context/2026-03-30-governance-v1-audit-findings.md)
- [2026-03-30-bom-question-followup.md](C:/ADF/docs/v0/context/2026-03-30-bom-question-followup.md)

Sub-steps:

1. define what must be measured
2. decide which metrics are audit-critical versus operational only
3. add the minimum shared reporting model that does not widen runtime semantics

Acceptance target:

- observability grows after correctness, not instead of correctness

## Immediate Recommended Order

Do the next work in this order:

1. `V1.1` Revision Path Unblock
2. `V1.2` Revision Recovery And Resume Correctness
3. `V1.3` Live Validation And Learning Verification
4. `V2A` Runtime Boundary Cleanup
5. `V2B` Governance And Learning Expansion
6. `V2C` Observability, KPI, And Broader Audit Expansion

## Explicit Non-Goals Right Now

Not part of the current next step:

- broad live validation before the known revision/runtime blockers are addressed
- ad-hoc/code-review lane migration
- rollout to other governed components
- full shared-engine API redesign
- generalized self-heal platform
- KPI and dashboard work

## Workplan Close Condition For The Current Lane

The current lane stops being "V1 follow-up" only when:

1. the live `agent-role-builder` run is mature enough to complete a truthful end-to-end validation pass
2. the result is recorded in context
3. the remaining work is no longer about pilot stabilization, but about deliberate expansion
