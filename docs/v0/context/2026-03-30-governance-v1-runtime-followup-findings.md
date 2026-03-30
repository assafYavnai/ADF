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
