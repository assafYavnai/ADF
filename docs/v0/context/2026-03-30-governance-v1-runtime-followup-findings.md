# Governance V1 Runtime Follow-Up Findings

Date: 2026-03-30
Status: accepted findings, implementation sequence frozen

Related design:

- [agent-role-builder-governance-v1-frozen-design.md](C:/ADF/docs/v0/context/agent-role-builder-governance-v1-frozen-design.md)

Related BOM note:

- [2026-03-30-bom-question-followup.md](C:/ADF/docs/v0/context/2026-03-30-bom-question-followup.md)

## Purpose

Capture the post-V1 implementation review findings that remain after the snapshot-hash fix, and freeze the execution order for the next repair pass.

This note exists because the work had reached a point where:

- some runtime bugs were already confirmed in the live governed path
- BOM support was identified as worthwhile but was still a separate resilience feature
- combining both in one change would make the audit trail weaker

## Accepted Runtime Findings

### 1. Reviewer parse failure policy is internally inconsistent

Accepted.

Current code in `tools/agent-role-builder/src/services/board.ts` still models a reviewer-local `error` lane and excludes `error` from normal verdict aggregation, but `parseReviewerResponse()` now throws `BoardBlockedError` for reviewer pre-validation and parse failure after auto-fix failure.

That leaves the board with two incompatible policies:

- reviewer parse failure is board-fatal
- reviewer parse failure is reviewer-local and should degrade one slot

The next implementation pass must choose one policy and make the code internally consistent.

### 2. Repair bundle authority mirroring is unsafe for absolute snapshot paths on Windows

Accepted.

`tools/agent-role-builder/src/services/role-generator.ts` passes snapshot authority paths through directly, and `shared/component-repair-engine/engine.ts` mirrors them with `join(authorityDir, sourcePath)`.

That is only safe for repo-relative paths.

When `outputDir` is absolute, the repair bundle can end up with invalid or misleading authority mirror paths under `bundle/authority/...`.

The next implementation pass must normalize bundle authority paths explicitly and preserve source provenance separately in the manifest.

### 3. Round-level review evidence is still not round-stable

Accepted.

`review.json` is written before `learning.json` and `diff-summary.json` exist, so the current existence checks avoid false refs but still leave round evidence incomplete even on successful rounds.

Also, `artifact_markdown` and `self_check` still point at run-root files that are only written later in the outer orchestration path.

That means a round artifact still cannot reliably identify the exact file set that round reviewed.

The next implementation pass must make the per-round artifact references round-stable and truthful.

## Accepted BOM/Audit Findings

### 1. The earlier BOM note was useful but incomplete

Accepted.

The BOM-sensitive surface is larger than the first note recorded. In particular, the follow-up implementation should treat these as part of the real parse surface:

- `tools/agent-role-builder/src/services/board.ts`
- `shared/component-repair-engine/engine.ts`

### 2. The BOM request-file failure escaped the audit trail because it happened before the run context existed

Accepted.

`tools/agent-role-builder/src/index.ts` parses the request file before the governed run context, governance snapshot, and incident-writing path exist.

So a BOM-triggered parse failure fell through the outer CLI fatal path instead of producing a governed incident artifact.

That is an audit-gap finding, not just a convenience finding.

## Frozen Execution Order

The next work should happen in this order:

1. record BOM findings and runtime review findings in context
2. fix the live runtime bugs only
3. update context with the bug-fix implementation notes and commit
4. implement BOM support as a separate deterministic-healing change
5. update context with BOM implementation notes and commit
6. run tests after both commits

## Why The Work Is Split

The split is intentional.

Runtime bug fixes and BOM support should not land together because they are different classes of change:

- runtime bug fixes repair current governed-path correctness
- BOM support adds deterministic ingress resilience and bootstrap audit coverage

Keeping them separate improves:

- review clarity
- blame isolation
- rollback safety
- audit trace readability

## What The Later BOM Change Must Include

The BOM work should not just add `stripBom()` calls opportunistically.

It should introduce a deterministic ingress-normalization mechanism with audit visibility, especially for pre-run failures.

Minimum expectation:

- bootstrap-visible audit for request-file normalization or failure
- deterministic normalization only
- no silent semantic changes
- explicit tests for request, governance, review, learning, and repair parse points

## Runtime Bug-Fix Implementation Notes

Status: implemented after this note was frozen for sequencing

The runtime bug-fix pass intentionally did not include BOM support.

Implemented changes:

- reviewer parse/pre-validation failures are reviewer-local again instead of aborting the whole board immediately
- the leader no longer receives synthetic parse-error verdicts as normal review evidence
- if every active reviewer slot fails before producing a healthy verdict, the round blocks explicitly with a bug report
- parse-error verdicts are excluded from artifact-repair checklist generation and from review-issue counting
- round input snapshots are written before review, and round `review.json` is rewritten after `learning.json` / `diff-summary.json` so successful rounds carry stable refs
- round `artifact_markdown` and `self_check` refs now point to round-local snapshot files instead of later-overwritten run-root files
- repair-engine authority mirroring now normalizes absolute snapshot paths into safe bundle-local paths and records source-to-bundle mapping in the manifest

Validation at the bug-fix phase:

- `tsc -p shared/tsconfig.json --noEmit`
- `tsc -p tools/agent-role-builder/tsconfig.json --noEmit`

Deferred to the later BOM phase:

- request-file BOM tolerance
- governance file BOM tolerance
- review/learning/repair JSON BOM tolerance
- bootstrap healing/audit for pre-run normalization

## Governance Snapshot Path Follow-Up

Status: implemented after the BOM split, as a narrow V1 hardening fix

Runtime validation exposed one additional edge in the frozen V1 pilot:

- `shared/governance-runtime/engine.ts` assumed authority inputs were repo-relative when building snapshot mirror paths
- absolute paths inside the repo produced invalid nested snapshot paths

The implemented V1 boundary is now explicit:

- repo-relative authority inputs are accepted as-is
- absolute authority inputs inside the repo root are relativized before snapshot mirroring
- absolute authority inputs outside the repo root fail closed

Focused validation was added for:

1. absolute in-repo authority inputs produce repo-relative `repo_path` values in `governance-snapshot.json`
2. absolute out-of-repo authority inputs are rejected cleanly

## V2A Revision Path Unblock

Status: implemented after the version plan was corrected to treat `V1` as complete-but-not-live-validated

The active runtime still used the copied invoker path in [shared-imports.ts](C:/ADF/tools/agent-role-builder/src/shared-imports.ts), and that copied Codex implementation had drifted back to stdin prompt delivery even though the canonical [invoker.ts](C:/ADF/shared/llm-invoker/invoker.ts) already used temp-file prompt delivery.

Implemented change:

1. the copied `callCodex()` path in `tools/agent-role-builder/src/shared-imports.ts` now matches the canonical temp-file prompt-delivery behavior

Focused regression guard:

1. [shared-imports.codex-sync.test.ts](C:/ADF/tools/agent-role-builder/src/shared-imports.codex-sync.test.ts) verifies that the copied Codex path still includes:
   - prompt temp-file creation
   - bash shell-file loading
   - prompt-file cleanup
   - and does not reintroduce `proc.stdin.write(params.prompt)`

Validation:

1. `tools/agent-role-builder/node_modules/.bin/tsx.cmd --test tools/agent-role-builder/src/shared-imports.codex-sync.test.ts`
2. `npx tsc -p tsconfig.json --noEmit` in [tools/agent-role-builder](C:/ADF/tools/agent-role-builder)

Deferred beyond `V2A`:

- provider fallback
- resume carry-forward
- elimination of the manual copied/shared boundary

## V2B Bounded ARB Validation

Status: executed as one bounded validation cycle; not yet sufficient for terminal validation sign-off

Run artifact root:

- [agent-role-builder-v2b-bounded-001](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-v2b-bounded-001)

What the run proved:

1. the live path now gets past the old revision-path regression
2. the run completed round 0, wrote `learning.json`, built the `revision-r0` repair bundle, and started round 1
3. the bounded run therefore exercised more than startup-only or unit-only paths

What the run did not prove:

1. truthful terminal closeout under bounded execution
2. stable terminal artifact production when the outer run is stopped by timeout

Observed outcome:

1. [run-postmortem.json](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-v2b-bounded-001/run-postmortem.json) exists and captures round 0 truth
2. no [result.json](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-v2b-bounded-001/result.json) was written
3. no [cycle-postmortem.json](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-v2b-bounded-001/cycle-postmortem.json) was written
4. round 1 remained partial when the outer timeout hit

Classification:

- useful bounded validation
- not yet a terminal validation pass
- next step should be `V2C` minimum telemetry/closeout baseline before relying on repeated bounded runs for project memory

## V2C Minimum Telemetry Baseline

Status: implemented

Implemented artifact:

- `runtime/run-telemetry.json`

Implemented behavior:

1. startup writes the initial run telemetry file
2. governance-ready updates it after the snapshot is established
3. board round start updates it before long live review work begins
4. run-postmortem writes refresh it after completed rounds
5. terminal closeout writes refresh it with status, stop reason, and artifact refs

What this fixes:

- a run can now leave structured operational state even when focus later shifts away from `agent-role-builder`
- partial or externally stopped runs are less dependent on memory or ad hoc shell inspection

Focused validation:

1. [run-telemetry.test.ts](C:/ADF/tools/agent-role-builder/src/services/run-telemetry.test.ts) verifies reviewer counts and provider-failure aggregation
2. package compile passes in [tools/agent-role-builder](C:/ADF/tools/agent-role-builder)
3. governed smoke:
   - [agent-role-builder-v2c-telemetry-smoke-001](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-v2c-telemetry-smoke-001)
   - [run-telemetry.json](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-v2c-telemetry-smoke-001/runtime/run-telemetry.json)
   - [cycle-postmortem.json](C:/ADF/tools/agent-role-builder/runs/agent-role-builder-v2c-telemetry-smoke-001/cycle-postmortem.json)

## V2D Resume Carry-Forward

Status: implemented with the narrowed scope frozen in the workplan

What changed:

1. the active run now loads `resume-package.json` when `request.resume` is present
2. resumed runs seed their initial markdown from `latest_markdown_path`
3. resumed runs seed reviewer slot state from `reviewer_status` instead of resetting every reviewer to `pending`
4. the next `resume-package.json` now carries forward:
   - merged `round_files`
   - accumulated `rounds_completed`
   - current-run final reviewer status
5. invalid or mismatched resume packages now block cleanly before board execution

What remained out of scope:

1. broader fixer-platform expansion
2. shared-engine API redesign
3. live resume-cycle validation beyond unit/package validation

Focused validation:

1. [resume-state.test.ts](C:/ADF/tools/agent-role-builder/src/services/resume-state.test.ts) covers:
   - loading existing markdown
   - defaulting missing `reviewer_status`
   - carrying forward reviewer status, round files, and rounds completed
2. [shared-imports.codex-sync.test.ts](C:/ADF/tools/agent-role-builder/src/shared-imports.codex-sync.test.ts) still passes after the resume wiring
3. package compile passes in [tools/agent-role-builder](C:/ADF/tools/agent-role-builder)

## V3A Shared-Imports Bridge Slice

Status: implemented for the first structural cleanup slice

What changed:

1. [shared-imports.ts](C:/ADF/tools/agent-role-builder/src/shared-imports.ts) no longer owns a copied invoker/provenance implementation
2. the file now bridges to canonical shared modules
3. only the local telemetry-buffer shim remains there, because the current run-telemetry path still reads buffered events directly

What this fixes:

1. the repeated Codex/path regression no longer depends on manually keeping a full copied invoker in sync
2. the active tool path now consumes the canonical shared invoker/provenance implementation instead of a locally forked copy

What remained out of scope for this slice:

1. removing every other copied/shared boundary in the tool
2. cwd hardening across all shared runtime imports
3. broader build or workspace redesign

Focused validation:

1. [shared-imports.codex-sync.test.ts](C:/ADF/tools/agent-role-builder/src/shared-imports.codex-sync.test.ts) now verifies:
   - shared source and built `shared/dist` both keep temp-file Codex prompt delivery
   - `shared-imports.ts` remains a thin bridge and does not reintroduce local `callCodex()` logic
2. [resume-state.test.ts](C:/ADF/tools/agent-role-builder/src/services/resume-state.test.ts) still passes
3. package compile passes in [tools/agent-role-builder](C:/ADF/tools/agent-role-builder)
4. shared package build passes in [shared](C:/ADF/shared)

## V3B Resume-Only Rulebook Promotion Slice

Status: implemented for the first narrow governance-expansion slice

What changed:

1. resumed runs now resolve a prior learning artifact from the resume package
2. only `component_rulebook` proposals are applied
3. application happens through a run-local promoted rulebook at:
   - `runtime/promoted-rulebook.json`
4. the source `rulebook.json` remains unchanged
5. one audit artifact now records the decision at:
   - `runtime/rulebook-promotion.json`

What this fixes:

1. the future-run rule-application contract is now explicit instead of remaining only as `learning.json` evidence
2. resumed runs can benefit from prior learned rule proposals without same-run authority drift
3. missing or invalid prior learning evidence no longer leaves the behavior ambiguous; the promotion artifact records the fallback reason

What remained out of scope for this slice:

1. meta-policy execution
2. non-rulebook routing
3. domain-contract rollout
4. cross-tool rollout
5. broader proposal lifecycle

Focused validation:

1. [engine.test.ts](C:/ADF/shared/learning-engine/engine.test.ts) covers BOM-safe learning-output parsing and `applies_to` normalization
2. [rulebook-promotion.test.ts](C:/ADF/tools/agent-role-builder/src/services/rulebook-promotion.test.ts) covers:
   - promoted rulebook creation from prior learning output
   - clean fallback when no prior learning artifact exists
3. [resume-state.test.ts](C:/ADF/tools/agent-role-builder/src/services/resume-state.test.ts) now also covers fallback resolution of older resume packages without `latest_learning_path`
4. package compile passes in [tools/agent-role-builder](C:/ADF/tools/agent-role-builder)
5. shared package build passes in [shared](C:/ADF/shared)
