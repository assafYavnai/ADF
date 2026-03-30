# Agent Role Builder Governance V1 Frozen Design

Status: frozen V1 pilot design
Scope: `tools/agent-role-builder` only
Purpose: break the design-review loop by freezing the smallest enforceable governance design for the pilot path.

## V1 Scope

V1 includes only:

- one shared `governance-runtime` module
- one pilot consumer: `agent-role-builder`
- one immutable per-run governance snapshot
- one snapshot-aware review-config wrapper for the pilot
- one `PilotGovernanceContext` boundary
- one canonical `governance-incident.json` artifact
- one runtime legality helper used by the board

V1 does not include:

- `meta_policy`
- non-rulebook governance classification
- governance-specific `pushback`
- proposal artifact system
- source governance mutation
- shared-engine API redesign
- ad-hoc runner migration
- future component rollout design

## Exact Runtime Authority Inputs

Governed files:

- `shared_contract`: `shared/learning-engine/review-contract.json`
- `component_contract`: `tools/agent-role-builder/review-contract.json`
- `component_rulebook`: `tools/agent-role-builder/rulebook.json`
- `component_review_prompt`: `tools/agent-role-builder/review-prompt.json`

Authority docs:

- `docs/v0/review-process-architecture.md`
- `docs/v0/architecture.md`

Rules:

- This is the complete V1 authority set.
- No `domain_contract` in V1.
- No `meta_policy` in V1.
- V1 does not override shared-contract roster timing. Because `shared_contract.roster_requirements.validation_phase = "request_validation"`, roster validation stays in pre-snapshot request validation.
- V1 allows one bootstrap exception before snapshot creation: `shared/governance-runtime` may read only `shared_contract.roster_requirements` from the repo-root shared contract in order to drive request-time roster validation.
- V1 freezes roster pair validation through a `shared/governance-runtime` adapter for the current shared contract version. That adapter reads the machine-readable count rules plus the current `required_pair_shape` contract text and enforces the current live meaning: reviewer slots must form complete adjacent Codex+Claude pairs.
- V1 does not claim that `required_pair_shape` is a general machine-readable schema. It freezes only the current contract-version adapter for this pilot.
- If that bootstrap read of the shared contract fails because the file is missing, unreadable, or invalid JSON, the run must fail closed before snapshot creation under the bootstrap incident rule below. The pilot must not fall back to hardcoded roster semantics.
- Snapshot creation must rewrite copied governance JSON so any path that points to one of the frozen V1 authority inputs points to the snapshot copy, not the repo-root source.
- Post-snapshot validation must compare `component_review_prompt.source_authority_paths` and `component_contract.source_authority_paths` by authority identity, not raw string equality: every rewritten snapshot path must map back to exactly one of the two frozen authority-doc repo paths above, and the resulting repo-path set must match exactly.

## Minimal V1 Data Model

### GovernanceSnapshot

- `snapshot_id`
- `component`
- `governed_files[]`: `kind`, `repo_path`, `snapshot_path`, `source_sha256`, `snapshot_sha256`
- `authority_docs[]`: `repo_path`, `snapshot_path`, `source_sha256`, `snapshot_sha256`

Hash semantics:

- `source_sha256` identifies the repo-root source file that snapshot creation read
- `snapshot_sha256` identifies the rewritten snapshot copy that downstream V1 consumers actually use
- prompt/contract snapshot copies are expected to differ from source bytes because embedded authority refs are rewritten to snapshot-local paths

### PilotGovernanceContext

- snapshot paths only
- snapshot-built review runtime config
- no repo-root governance paths exposed outside `shared/governance-runtime`

### GovernanceBinding

- `snapshot_id`
- `snapshot_manifest_path`

`snapshot_manifest_path` always means the path to `governance-snapshot.json`.

### GovernanceIncident

- `governance_binding` or `null` during bootstrap snapshot failure
- `stage`
- `faults[]`
- `status: "blocked"`
- `intended_snapshot_manifest_path` only when `governance_binding` is `null`

### Result Extension

- `governance_binding`
- `learning_artifact: { path, effect: "future_run_candidate" } | null`

## Hard Boundary

After snapshot creation:

- only `shared/governance-runtime` may know repo-root governance or authority-doc paths
- `validator.ts`, `board.ts`, and `role-generator.ts` must receive `PilotGovernanceContext`
- no pilot module may reconstruct governance source paths locally

Shared engines keep current path-based APIs in V1, but callers may pass only snapshot paths from `PilotGovernanceContext`.

Before snapshot creation:

- only `shared/governance-runtime` may read the repo-root shared contract
- that pre-snapshot read is limited to the roster bootstrap described above
- `validator.ts` must not carry independent hardcoded roster semantics in V1

## Minimal V1 Control Flow

1. Pre-snapshot startup
- parse request
- run request-sanity validation
- read `shared_contract.roster_requirements` through `shared/governance-runtime` bootstrap loading
- run roster validation from those loaded shared-contract roster rules plus the current-contract roster adapter because the shared contract declares roster validation at `request_validation`
- do not perform governance-file validation yet

2. Snapshot creation
- copy the four governed files and two authority docs into a run-scoped snapshot directory
- rewrite the copied `review-prompt.json` and `review-contract.json` files themselves so embedded V1 authority refs point to snapshot-local files
- make those rewritten snapshot JSON files the only governance JSON files passed to downstream shared engines in V1
- hash all copied files
- write `governance-snapshot.json`

3. Post-snapshot governance validation
- validate snapshot governance files
- validate that copied `source_authority_paths` in both the review prompt and component contract resolve back to the frozen two-doc repo-path set

4. Build `PilotGovernanceContext`
- construct snapshot-only paths
- build snapshot-aware review runtime config

5. Pilot execution
- `validator.ts`, `board.ts`, and `role-generator.ts` use only `PilotGovernanceContext`
- shared engines receive snapshot paths only

6. Runtime legality
- the board calls one shared legality helper with live runtime inputs
- legality remains board-driven, not config-driven

7. Learning
- `learning.json` remains legacy rulebook-only evidence
- it does not affect the current run
- it is referenced from `result.json.learning_artifact`

8. Governance fault handling
- write `governance-incident.json`
- return clean `blocked`

## Snapshot-Aware Review Config

V1 adds one wrapper in `shared/governance-runtime`:

- `loadPilotReviewRuntimeConfig(ctx)`

It must:

- read snapshot copies, not repo-root files
- return the same config shape expected by current review prompt/parsing code
- validate and use the rewritten snapshot prompt/contract JSON
- treat the rewritten snapshot JSON files, not any repo-root originals, as the source of truth for downstream path-based consumers in V1
- reject any extra or missing authority doc identity in either copied governance file after resolving rewritten snapshot paths back to repo-path identity

The pilot must stop calling `shared/review-engine/config.ts` directly.

## Artifact Binding

Add one shared helper in `shared/governance-runtime`:

- `bindGovernance(payload, ctx)`

It injects:

```json
"governance_binding": {
  "snapshot_id": "...",
  "snapshot_manifest_path": "..."
}
```

### Bound Orchestrator Artifacts

- `governance-incident.json`
- `rounds/round-N/review.json`
- `result.json`
- `run-postmortem.json`
- `cycle-postmortem.json`

### Leaf Artifacts

These keep their current shapes in V1:

- `self-check.json`
- `rounds/round-N/compliance-map.json`
- `rounds/round-N/fix-items-map.json`
- `rounds/round-N/diff-summary.json`
- `rounds/round-N/learning.json`

They are bound indirectly through `artifact_refs` from bound orchestrator artifacts.

`self-check.json` remains a bare array in V1. It is not wrapped and does not get a top-level `governance_binding` field. Its binding comes only through an `audit.artifact_refs.self_check` reference from a bound orchestrator artifact.

In V1, that `audit.artifact_refs.self_check` target is pinned to the run-root artifact:

- `tools/agent-role-builder/runs/<job>/self-check.json`

It must not point to any repair-bundle copy such as `shared/component-repair-engine/.../bundle/self-check.json`.

In V1, `audit.artifact_refs.self_check` is mandatory in:

- `run-postmortem.json`
- `cycle-postmortem.json`

V1 does not require a general `artifact_refs` carrier in `result.json` or `review.json`.

### Fix Items Rule

`rounds/round-N/fix-items-map.json` is required only when the live contract requires it for that round and the board generated it.

No shared ComplianceMap or FixItemsMap schema change is required in V1.

## Bootstrap Rule

If failure happens before `governance-snapshot.json` is durably written:

- write `governance-incident.json`
- set `governance_binding: null`
- set `intended_snapshot_manifest_path`
- include the bootstrap fault that prevented roster bootstrap or snapshot creation
- return clean `blocked`

## Implementation Order

1. Add `shared/governance-runtime/`
- snapshot builder
- `PilotGovernanceContext`
- snapshot-aware review-config wrapper
- `GovernanceBinding`
- `GovernanceIncident`
- binding helper

2. Split startup in `tools/agent-role-builder/src/index.ts`
- pre-snapshot request sanity and shared-contract-driven roster validation
- snapshot creation
- post-snapshot governance validation only

3. Rewire pilot modules to require `PilotGovernanceContext`
- `tools/agent-role-builder/src/services/validator.ts`
- `tools/agent-role-builder/src/services/board.ts`
- `tools/agent-role-builder/src/services/role-generator.ts`

4. Route bound orchestrator artifact writing through the shared helper

5. Remove same-run rulebook mutation in `tools/agent-role-builder/src/services/board.ts`

6. Add `result.json.learning_artifact`

7. Extract legality helper and keep it board-driven with live runtime inputs

Add a testing gate after each step.

## Acceptance Criteria

- V1 authority set is exactly four governed files plus two authority docs.
- V1 contains no `meta_policy` references.
- V1 contains no non-rulebook governance classification behavior.
- V1 preserves the shared-contract roster timing by validating roster requirements during pre-snapshot request validation.
- Pre-snapshot roster validation is driven by bootstrap-loaded `shared_contract.roster_requirements` plus the governance-runtime adapter for the current shared contract version, not by independent hardcoded rules in pilot code.
- If the shared contract cannot be read or parsed during roster bootstrap, the run fails closed before snapshot creation with `governance-incident.json` and `governance_binding: null`.
- Snapshot creation rewrites copied governance JSON so embedded V1 authority refs point only to snapshot-local files.
- Downstream V1 consumers receive the rewritten snapshot governance JSON files, not repo-root originals.
- The snapshot-aware wrapper rejects any extra or missing authority doc identity in either copied governance file after resolving rewritten snapshot paths back to repo-path identity.
- After snapshot creation, mutating repo-root governance or authority docs does not affect the run.
- No pilot module accesses repo-root governance or authority-doc paths directly after snapshot creation.
- All bound orchestrator artifacts carry identical `governance_binding`.
- `run-postmortem.json` and `cycle-postmortem.json` both carry `audit.artifact_refs.self_check` pointing to the run-root `self-check.json`, not any repair-bundle copy.
- Governance faults in the pilot always return clean `blocked` plus `governance-incident.json`.
- `result.json` carries an explicit `learning_artifact` reference.
- `learning.json` has no same-run effect.

## Implementation Verification Notes

Implementation verification on 2026-03-30 confirmed the core snapshot path is working in the pilot:

- smoke-run snapshot creation wrote `governance-snapshot.json`
- copied `review-prompt.json` and `review-contract.json` were rewritten to snapshot-local authority paths
- bound orchestrator artifacts carried the same `governance_binding`
- `audit.artifact_refs.self_check` pointed to the run-root `self-check.json`

The same verification also exposed three implementation issues that must be fixed to satisfy the frozen V1 behavior:

- pre-snapshot roster-governance failures must write `governance-incident.json`, not fall through the generic validation-error path
- `result.json.learning_artifact` must be emitted only when `rounds/round-N/learning.json` was actually written
- the learning engine needs bounded cleanup for the observed malformed `new_rules[*].applies_to` string-to-array mismatch so the governed run does not fail on that known shape drift alone

Follow-up implementation conclusion:

- those three verification issues were fixed in the pilot implementation
- the snapshot manifest now carries both source and snapshot hashes so provenance and effective-authority integrity are not conflated
- out-of-scope ad-hoc/code-review-lane files were removed again to keep the committed V1 surface aligned with the frozen non-goals

First-run note:

- the component rulebook is part of the required V1 authority set
- a missing `tools/agent-role-builder/rulebook.json` is a blocked governance failure
- the supported zero-prior-rule first-run state is an existing valid rulebook file with an empty `rules` array

## Explicit Non-Goals

- `meta_policy`
- non-rulebook classification
- governance-specific `pushback`
- proposal artifact system
- source governance mutation
- shared-engine API redesign
- ad-hoc runner migration
- future rollout planning
