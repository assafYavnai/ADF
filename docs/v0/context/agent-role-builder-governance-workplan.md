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

For planning purposes:

- `V1` means implemented and hardened
- live validation is a later bounded step, not part of the frozen V1 implementation scope

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

## Workplan Completeness Rule

This workplan is not considered complete just because the current implementation pass is done.

It stays active until:

1. every deferred item is either:
   - implemented
   - explicitly reclassified into a later version
   - or explicitly closed as no longer needed
2. deferred items remain listed under an owning version so they cannot disappear between steps
3. a later implementation step does not silently drop an older deferred item from the plan

If an item is deferred, the deferment must stay visible in this file.

## Version Map

### V2A Revision Path Unblock

Status:

- implemented

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

Execution note:

- `V2A` is implementation-ready from the CEO perspective and does not require new input
- current live evidence shows the active `agent-role-builder` path still imports `invoke` from the copied [shared-imports.ts](C:/ADF/tools/agent-role-builder/src/shared-imports.ts)
- that copied file still uses Codex stdin prompt delivery, while the canonical [invoker.ts](C:/ADF/shared/llm-invoker/invoker.ts) uses temp-file prompt delivery
- this step is therefore frozen to:
  1. patch the live copied invoker path so it matches the canonical Codex delivery behavior
  2. add one regression guard that will fail if the copied Codex implementation falls out of sync again
  3. keep provider fallback, resume carry-forward, and broader module-boundary redesign out of scope

Implementation note:

1. the live copied Codex path in [shared-imports.ts](C:/ADF/tools/agent-role-builder/src/shared-imports.ts) now matches the canonical temp-file prompt delivery pattern from [invoker.ts](C:/ADF/shared/llm-invoker/invoker.ts)
2. a focused regression test now fails if the copied `callCodex()` path drops:
   - prompt temp-file creation
   - bash shell-file loading
   - prompt-file cleanup
   - or if it reintroduces stdin prompt delivery
3. this unblocks the known revision-path regression without widening into provider fallback or broader shared-boundary redesign

Validation:

1. `tools/agent-role-builder/node_modules/.bin/tsx.cmd --test tools/agent-role-builder/src/shared-imports.codex-sync.test.ts`
2. `npx tsc -p tsconfig.json --noEmit` in [tools/agent-role-builder](C:/ADF/tools/agent-role-builder)

Remaining risk deferred beyond `V2A`:

- the copied/shared module boundary still exists
- broader elimination of manual-copy drift remains `V3A`

### V2B Bounded ARB Validation

Status:

- executed, follow-up required

Purpose:

- run `agent-role-builder` only when the runtime is bounded and auditable enough that the result is useful

Open items:

1. execute a bounded real `agent-role-builder` run from the current baseline
2. verify multi-round behavior rather than only startup and unit invariants
3. verify learning lifecycle behavior from real artifacts
4. keep the run bounded so it cannot drift into uncontrolled retry/resume behavior

Primary source:

- [step2-run017-postmortem.md](C:/ADF/docs/v0/context/step2-run017-postmortem.md)
- [2026-03-30-governance-v1-audit-findings.md](C:/ADF/docs/v0/context/2026-03-30-governance-v1-audit-findings.md)

Sub-steps:

1. run a clean bounded smoke on current `main`
2. bound it explicitly:
   - one cycle only
   - explicit round cap
   - hard wall-clock timeout
   - no auto-resume chaining
   - no rule promotion
3. inspect revision, repair, learning, and closeout artifacts
4. classify the result into:
   - mature enough to continue
   - blocked by remaining runtime stabilization work

Acceptance target:

- one truthful bounded validation run with a useful postmortem, regardless of whether the run fully converges

Execution note:

- `V2B` does not require new CEO input
- the bounded validation run must avoid uncontrolled canonical writes while still exercising the real `agent-role-builder` path
- the validation shape is frozen to:
  1. use a copied request file derived from the self-role request
  2. redirect `required_outputs` to a bounded temporary canonical-output tree
  3. cap review rounds to the minimum useful value for this pass
  4. run one cycle only
  5. set a hard wall-clock timeout
  6. do not auto-chain into resume
  7. inspect the postmortem and artifact truth before deciding whether `V2C` or `V2D` comes next

Implementation note:

1. a bounded validation run was executed at:
   - [agent-role-builder-v2b-bounded-001](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-v2b-bounded-001)
2. the run exercised:
   - governance snapshot creation
   - round 0 review
   - learning output
   - revision-r0 repair bundle
   - partial round 1 execution
3. the run did not reach truthful terminal closeout before the outer timeout:
   - no `result.json`
   - no `cycle-postmortem.json`
4. the most useful artifact produced was:
   - [run-postmortem.json](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-v2b-bounded-001/run-postmortem.json)

Classification:

- `V2B` proved the live path is functionally deeper than startup-only checks
- `V2B` did not yet prove mature terminal behavior under bounded execution
- this makes `V2C` the right next step before broader retry/expansion work

### V2C Minimal Telemetry Baseline

Status:

- implemented

Purpose:

- ensure we do not lose operational memory when focus later moves to another component

Open items:

1. define the minimum run telemetry contract
2. capture the fields required for future audit and comparison
3. keep this smaller than a KPI/dashboard system

Primary sources:

- [2026-03-30-governance-v1-audit-findings.md](C:/ADF/docs/v0/context/2026-03-30-governance-v1-audit-findings.md)
- [2026-03-30-bom-question-followup.md](C:/ADF/docs/v0/context/2026-03-30-bom-question-followup.md)

Sub-steps:

1. freeze the minimum fields:
   - run id
   - commit sha
   - config or mode
   - stop reason
   - rounds attempted and completed
   - reviewer success and error counts
   - provider failures
   - fallback used or not
   - learning artifact written or not
   - duration
   - terminal status
   - postmortem path
2. decide where these fields live so they remain easy to compare later
3. add only what is required for audit continuity, not a broad KPI system

Acceptance target:

- future runs leave enough stable telemetry that the project does not lose operational memory when focus shifts

Execution note:

- `V2C` does not require new CEO input
- this step is not a KPI/dashboard build
- it is a minimum run-telemetry and closeout baseline for the live `agent-role-builder` lane
- the implementation should prefer one small authoritative run-telemetry artifact that is updated during execution rather than adding many new log surfaces
- the telemetry baseline should survive partial runs well enough that an externally stopped run still leaves useful state on disk

Implementation note:

1. the live lane now writes one authoritative telemetry artifact at:
   - `runtime/run-telemetry.json`
2. the telemetry file is updated at:
   - startup
   - governance-ready checkpoint
   - round-start checkpoint
   - run-postmortem checkpoint
   - terminal closeout
3. the file now carries the frozen minimum fields:
   - run id
   - commit sha
   - execution mode
   - current phase
   - terminal status
   - stop reason
   - rounds attempted/completed
   - reviewer success/error counts
   - provider failure counts
   - fallback used
   - learning artifact written or not
   - governance snapshot path
   - result/postmortem artifact refs

Validation:

1. [run-telemetry.test.ts](C:/ADF/tools/agent-role-builder/src/services/run-telemetry.test.ts) passes
2. package compile passes in [tools/agent-role-builder](C:/ADF/tools/agent-role-builder)
3. a governed blocked-run smoke wrote:
   - [run-telemetry.json](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-v2c-telemetry-smoke-001/runtime/run-telemetry.json)
   - [cycle-postmortem.json](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-v2c-telemetry-smoke-001/cycle-postmortem.json)

Outcome:

- minimum telemetry is now in place before focus shifts to other components
- broader KPI/dashboard work remains `V3C`

### V2D Revision Recovery And Resume Correctness

Status:

- implemented with narrowed scope

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

Execution note:

- `V2D` does not require new CEO input
- the older postmortem finding about revision fallback is now only partially current:
  - the revision repair path already uses a Codex-to-Claude fallback in [role-generator.ts](C:/ADF/tools/agent-role-builder/src/services/role-generator.ts)
- the real missing gap is resume carry-forward:
  1. resume-package state is written but not loaded back into the live run
  2. reviewer status still initializes to `pending` for every resumed run
  3. resumed runs do not reuse the latest markdown from the resume package
- this step is therefore frozen to:
  1. extend the resume package with the minimum reviewer-status state
  2. load resume-package state when `request.resume` is present
  3. initialize resumed runs from the latest markdown and reviewer-status state
  4. keep broader fixer-platform expansion out of scope

Implementation note:

1. resumed runs now load `latest_markdown_path` and `reviewer_status` from `resume-package.json`
2. the board now seeds reviewer slots from loaded resume state instead of resetting every slot to `pending`
3. the next `resume-package.json` carries forward:
   - merged `round_files`
   - accumulated `rounds_completed`
   - final reviewer status from the current run
4. invalid or mismatched resume packages now block cleanly before board execution instead of failing later in the run

Validation:

1. [resume-state.test.ts](C:/ADF/tools/agent-role-builder/src/services/resume-state.test.ts) passes
2. [shared-imports.codex-sync.test.ts](C:/ADF/tools/agent-role-builder/src/shared-imports.codex-sync.test.ts) still passes
3. `npx tsc -p tsconfig.json --noEmit` in [tools/agent-role-builder](C:/ADF/tools/agent-role-builder) passes

### V3A Runtime Boundary Cleanup

Status:

- first structural slice implemented

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

Execution note:

- `V3A` does not require new CEO input for the first slice
- the first structural slice is narrower than the full boundary-cleanup bucket:
  1. replace the copied invoker/provenance implementation in [shared-imports.ts](C:/ADF/tools/agent-role-builder/src/shared-imports.ts) with a thin bridge to canonical shared modules
  2. keep a tiny local telemetry-buffer shim only, because the current run-telemetry path still reads buffered events locally
  3. keep cwd hardening, broader shared-module import redesign, and other copied surfaces out of scope for this slice
- this slice is accepted when:
  1. `agent-role-builder` no longer owns a duplicated LLM invoker implementation
  2. the Codex regression guard still passes
  3. package compile still passes

Implementation note:

1. [shared-imports.ts](C:/ADF/tools/agent-role-builder/src/shared-imports.ts) is now a thin bridge over canonical shared modules instead of owning its own invoker/provenance implementation
2. the only local logic retained there is the minimal telemetry-buffer shim still used by the current run-telemetry path
3. the regression guard now verifies:
   - shared invoker source and built `shared/dist` both keep temp-file Codex prompt delivery
   - `shared-imports.ts` remains a bridge and does not reintroduce local `callCodex()` logic

Validation:

1. [shared-imports.codex-sync.test.ts](C:/ADF/tools/agent-role-builder/src/shared-imports.codex-sync.test.ts) passes
2. [resume-state.test.ts](C:/ADF/tools/agent-role-builder/src/services/resume-state.test.ts) still passes
3. `npx tsc -p tsconfig.json --noEmit` in [tools/agent-role-builder](C:/ADF/tools/agent-role-builder) passes
4. `npx tsc -p tsconfig.json` in [shared](C:/ADF/shared) passes

### V3B Governance And Learning Expansion

Status:

- frozen for first narrow slice

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

Execution note:

- `V3B` requires no new CEO input for the first narrow slice
- to prevent scope creep, the first slice is frozen to:
  1. one consumer only: `agent-role-builder`
  2. one routing surface only: `component_rulebook`
  3. one effect only: future-run rule promotion/application contract
  4. no source `rulebook.json` mutation; application must happen through a run-local promoted rulebook plus one audit artifact
- explicitly out of scope for this slice:
  1. meta-policy execution
  2. non-rulebook routing
  3. domain-contract rollout
  4. cross-tool rollout
  5. broader proposal lifecycle

### V3C Observability, KPI, And Broader Audit Expansion

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

1. `V2A` Revision Path Unblock
2. `V2B` Bounded ARB Validation
3. `V2C` Minimal Telemetry Baseline
4. `V2D` Revision Recovery And Resume Correctness
5. `V3A` Runtime Boundary Cleanup
6. `V3B` Governance And Learning Expansion
7. `V3C` Observability, KPI, And Broader Audit Expansion

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

1. `V2A` through `V2C` are complete
2. the live `agent-role-builder` run is mature enough to produce a bounded truthful validation result
3. the remaining work is no longer about pilot stabilization, but about deliberate expansion
