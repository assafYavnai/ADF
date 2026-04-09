1. Implementation Objective

Create the first public `develop` skill shell with help, settings, status, and deterministic governor surfaces as the boxed governed implementation entry point for ADF.

This slice delivers:

- a thin public SKILL.md entry point
- a develop entry script handling help, settings, status, and guarded implement/fix stubs
- a deterministic governor script that validates prerequisites and integrity without LLM involvement
- a setup detection helper
- reference documentation for invokers (guide, templates, settings contract, KPI contract)
- truthful status rendering using the committed truth hierarchy
- manifest registration

This slice does not deliver full A-to-Z implement orchestration, worker spawning, review-cycle delegation, merge-queue delegation, or MCP bridge work.

2. Slice Scope

- `skills/develop/SKILL.md` -- public entry point, under 100 lines, routes to entry script
- `skills/develop/scripts/` -- entry script, governor script, setup helper (exact filenames frozen below)
- `skills/develop/references/invoker-guide.md` -- help text returned by `develop help`
- `skills/develop/references/artifact-templates.md` -- contract.md and context.md templates with validation rules
- `skills/develop/references/settings-contract.md` -- allowed settings surface and schema
- `skills/develop/references/kpi-contract.md` -- KPI model definition for later slices
- `skills/develop/references/workflow-contract.md` -- frozen internal route contract for command routing, governor behavior, truth hierarchy, status rendering, settings handling, and guarded stub behavior
- `skills/develop/agents/openai.yaml` -- agent interface definition
- `skills/manifest.json` -- register develop skill entry
- `.codex/develop/settings.json` -- settings persistence (created by entry script at runtime)
- `.codex/develop/setup.json` -- setup detection output (created by setup helper at runtime)
- `docs/phase1/develop-shell-help-settings-status-governor/**` -- slice artifacts

Frozen script names for this slice:

- `skills/develop/scripts/develop-helper.mjs` -- entry script
- `skills/develop/scripts/develop-governor.mjs` -- deterministic governor
- `skills/develop/scripts/develop-setup-helper.mjs` -- setup detection

These names are frozen by this contract. Names for later-slice scripts (lane runner, etc.) are not frozen here.

3. Required Deliverables

D-01: `skills/develop/SKILL.md`
- Public entry point under 100 lines.
- Routes invoker commands to `develop-helper.mjs`.
- Documents the five public v1 commands: help, implement, fix, status, settings.
- States that `develop` is the only public implementation skill.
- States that internal engines (implement-plan, review-cycle, merge-queue) are not public.

D-02: `skills/develop/scripts/develop-helper.mjs`
- Entry script handling command dispatch for: help, implement, fix, status, settings.
- `help`: reads and returns `references/invoker-guide.md` content plus current lane statuses if any exist.
- `settings`: reads, validates, persists, and returns settings from `.codex/develop/settings.json`.
- `status`: reads truthful status using the truth hierarchy defined below. Returns structured JSON plus human-readable output.
- `implement`: calls governor `validate-prerequisites`. If valid, returns structured message: "implement orchestration not yet available -- arrives in Slice B." Does not spawn workers.
- `fix`: calls governor `validate-prerequisites`. If valid, returns structured message: "fix path not yet available -- arrives in Slice C." Does not spawn workers.
- Imports from `develop-governor.mjs` and `develop-setup-helper.mjs`.
- Integrates with `governed-feature-runtime.mjs` for heading validation (`validateHeadingContract`), JSON I/O (`readJson`, `writeJsonAtomic`), and locking (`withLock`).

D-03: `skills/develop/scripts/develop-governor.mjs`
- Deterministic governance script. No LLM calls. No LLM-generated lifecycle truth.
- Exports functions for each governor command:
  - `validatePrerequisites({ projectRoot, phaseNumber, featureSlug })` -- returns `{ status: "pass"|"fail", findings: [...], blocker: null|"..." }`
    - Checks: contract.md exists at `docs/phase<N>/<feature-slug>/implement-plan-contract.md`
    - Checks: contract.md has all 10 required headings in order (uses `CONTRACT_HEADINGS` from helper or governed-feature-runtime)
    - Checks: context.md exists at `docs/phase<N>/<feature-slug>/context.md` and is non-empty
    - Checks: feature is not in a terminal lifecycle state (completed, closed) unless `feature_status_override` is provided
    - Checks: no conflicting active lane for this feature slug
  - `validateIntegrity({ projectRoot, phaseNumber, featureSlug })` -- returns same shape
    - Checks: KPI Applicability field is present in Acceptance Gates
    - Checks: all required KPI sub-fields present when applicability is `required` or `temporary exception approved`
    - Checks: compatibility section complete (Vision, Phase 1, Master-Plan, Current Gap-Closure, Later-Company Check, Compatibility Decision, Compatibility Evidence)
    - Checks: `Compatibility Decision` is `compatible` (blocks if not)
    - Checks: `Later-Company Check` is not `yes` (blocks if yes)
    - Checks: Machine Verification Plan is present and non-empty
    - Checks: Human Verification Plan is present with explicit `Required: true` or `Required: false`
  - `checkLaneConflict({ projectRoot, phaseNumber, featureSlug })` -- returns same shape
    - Checks: no active lane under `.codex/develop/lanes/` for this feature slug
- All functions are synchronous or async with no LLM dependency. Returns are structured JSON only.

D-04: `skills/develop/scripts/develop-setup-helper.mjs`
- Detects runtime capabilities (CLI availability, access modes) following the existing `implement-plan-setup-helper.mjs` pattern.
- Writes setup state to `.codex/develop/setup.json`.
- Setup state is operational, not committed truth.

D-05: `skills/develop/references/invoker-guide.md`
- Structured help text covering:
  - What `develop` does (single-paragraph overview)
  - Required intake artifacts (`contract.md`, `context.md`) with locations and rules
  - The five public v1 commands with usage and expected behavior
  - Template locations (points to `artifact-templates.md`)
  - How status works (truth hierarchy explanation for invokers)
  - How approval works (invoker approval is always required in v1)
  - What happens when human verification is required
  - What is not public (no direct helper access, no public reset)

D-06: `skills/develop/references/artifact-templates.md`
- Template for `contract.md` with all 10 required headings in order, including the Acceptance Gates sub-labels
- Template for `context.md` with required fields (phase_number, feature_slug, base_branch, feature_branch, task_summary, authoritative sources, constraints, expected touch points)
- Validation rules for each heading

D-07: `skills/develop/references/settings-contract.md`
- Schema definition for `.codex/develop/settings.json`:
  - `schema_version` (integer, must be 1)
  - `implementor_model` (string, default from setup)
  - `implementor_effort` (string, default "high")
  - `auditor_model` (string, default from setup)
  - `auditor_effort` (string, default "high")
  - `reviewer_model` (string, default from setup)
  - `reviewer_effort` (string, default "high")
  - `max_review_cycles` (positive integer, default 5)
- Validation rules: unknown keys rejected, governance fields not overridable, schema_version must match

D-08: `skills/develop/references/kpi-contract.md`
- KPI model definition for the `develop` skill (consumed by later slices, defined now for contract stability):
  - Timing families: total_elapsed, preparation, implementation, verification, review, fix_cycles, human_verification_wait, invoker_approval_wait, merge
  - Count families: review_cycles, fix_cycles, verification_attempts, verification_failures, review_rejections, human_rejections, invoker_rejections
  - Quality families: first_pass_review_approved, first_pass_verification, files_changed, lines_added, lines_removed, defect_classes
  - Outcome: completed, blocked, failed, cancelled
  - Persistence rule: disk required at `.codex/develop/lanes/<lane-id>/kpi.json`, Brain optional/best-effort
- This deliverable defines the model. KPI capture implementation is Slice B scope.

D-09: `skills/develop/references/workflow-contract.md`
- Frozen internal route contract for the develop skill. This is the single authoritative reference for:
  - Command routing: how each public command (help, implement, fix, status, settings) maps to entry script behavior
  - Governor command behavior: what each governor function checks, its input/output contract, and structured return shape
  - Truth hierarchy: the priority order for status and finalize sources (committed feature-local > closeout receipt > merge truth > lane projections), and the rule that committed truth wins over projections
  - Guarded stub behavior: what `implement` and `fix` do in Slice A (validate prerequisites, then report unavailability)
  - Status rendering contract: required output fields (slice identity, stage, status, blocker, last event, verdicts, human input required, next transition), prohibition on fake progress percentages
  - Settings handling contract: schema, validation rules, persistence path, rejected keys behavior, append-only history logging
- This file prevents implementor drift between SKILL.md, develop-helper.mjs, develop-governor.mjs, and reference docs by freezing internal route semantics in one place.

D-10: `skills/develop/agents/openai.yaml`
- Agent interface definition for the develop skill, following existing skill patterns in manifest.json.

D-11: `skills/manifest.json` update
- Register `develop` skill with:
  - skill name: `develop`
  - SKILL.md path
  - script paths
  - reference paths
  - agent definition path

D-12: Status truth hierarchy implementation in `develop-helper.mjs`
- `develop status` must read from sources in this priority order:
  1. Committed feature-local state: `implement-plan-state.json`, `completion-summary.md`, and other governed artifacts under `docs/phase<N>/<feature-slug>/`
  2. `closeout-receipt.v1.json`: when present, authoritative for commit roles, merge evidence, reconciliation status
  3. Merge truth: whether the approved commit SHA landed on the target branch (via git ancestry check)
  4. Lane operational projections: `.codex/develop/lanes/<lane-id>/lane-state.json`, `heartbeat.json` -- live operational views only
- If operational projections disagree with committed feature-local closeout truth, committed feature-local closeout truth wins.
- Status output must include: slice identity, current stage, current status, current blocker (if any), latest durable event, latest review verdicts (if available), whether human input is required, next expected transition.
- Status must not use fake progress percentages.
- When no lane exists and no feature-local state exists, report "no known state for this slice."
- When `closeout-receipt.v1.json` is absent (Slice 0 not yet merged for older slices), status falls back to feature-local state and merge truth only, without error.

4. Allowed Edits

- `C:/ADF/skills/develop/**` (all new files)
- `C:/ADF/.codex/develop/**` (runtime state, created by scripts)
- `C:/ADF/skills/manifest.json` (add develop registration)
- `C:/ADF/docs/phase1/develop-shell-help-settings-status-governor/**` (slice artifacts)
- Read-only integration with `C:/ADF/skills/governed-feature-runtime.mjs` (import utilities, do not modify)
- Read-only integration with `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs` (import heading constants, do not modify)

5. Forbidden Edits

- No changes to `C:/ADF/skills/implement-plan/**` (except read-only imports of constants)
- No changes to `C:/ADF/skills/review-cycle/**`
- No changes to `C:/ADF/skills/merge-queue/**`
- No changes to `C:/ADF/skills/brain-ops/**`
- No changes to `C:/ADF/skills/benchmark-suite/**`
- No changes to `C:/ADF/skills/governed-feature-runtime.mjs`
- No changes to `C:/ADF/skills/benchmark-runtime.mjs`
- No changes to `C:/ADF/AGENTS.md` (Slice D scope)
- No changes to `C:/ADF/components/**`
- No full A-to-Z implement orchestration logic
- No worker spawning or LLM invocation for lifecycle decisions
- No review-cycle delegation as a working production route
- No merge-queue delegation as a working production route
- No MCP bridge work
- No public step-level reset surface
- No generic governance cleanup beyond what this slice requires
- No redesign of existing engines
- No unrelated refactors in other Phase 1 slices

6. Acceptance Gates

KPI Applicability: required

KPI Route / Touched Path: `develop help`, `develop settings`, `develop status`, governor prerequisite validation, governor integrity validation, lane conflict check, settings persistence, status truth hierarchy rendering

KPI Raw-Truth Source: command output structure (structured JSON + human-readable), settings file on disk, governor validation results, status rendering against committed feature-local state and operational projections, prerequisite rejection output for malformed contracts

KPI Coverage / Proof: deterministic proof that help returns structured guide, settings persist and read correctly, governor rejects malformed contracts and missing prerequisites, status reads from the correct truth hierarchy, guarded implement/fix stubs validate before reporting unavailability, no lifecycle truth leaks from operational projections

KPI Production / Proof Partition: production path is the real `develop` command surface against actual feature directories under `docs/phase1/`; proof path uses isolated test feature directories with known contract/context artifacts and controlled feature-local state to verify each command independently

KPI Non-Applicability Rationale: Not used because KPI Applicability is required for this slice.

KPI Exception Owner: Not used because KPI Applicability is required and no temporary exception is approved.

KPI Exception Expiry: Not used because KPI Applicability is required and no temporary exception is approved.

KPI Exception Production Status: Not used because KPI Applicability is required and no temporary exception is approved.

KPI Compensating Control: Not used because KPI Applicability is required and no temporary exception is approved.

Vision Compatibility: Compatible. This creates the public governed implementation entry point. It does not widen into later-company autonomy or redesign existing engines.

Phase 1 Compatibility: Compatible. The slice is the first step of the committed Phase 1 `develop` rollout plan.

Master-Plan Compatibility: Compatible. It improves the startup's ability to box and govern implementation without introducing a second truth system.

Current Gap-Closure Compatibility: Compatible. It creates the public surface that closes the gap between raw internal skill exposure and a properly boxed implementation front door.

Later-Company Check: no

Compatibility Decision: compatible

Compatibility Evidence: The delivery plan commits to this exact slice scope. The architecture proposal defines the 4-layer model that this slice implements at Layers 1 and 2. The shell is bounded, additive, and does not modify existing engines.

Machine Verification Plan:

- V-01: `node --check C:/ADF/skills/develop/scripts/develop-helper.mjs` -- syntax valid
- V-02: `node --check C:/ADF/skills/develop/scripts/develop-governor.mjs` -- syntax valid
- V-03: `node --check C:/ADF/skills/develop/scripts/develop-setup-helper.mjs` -- syntax valid
- V-04: `develop help` returns structured output containing: command list, intake artifact description, template reference, settings surface, status explanation, approval explanation
- V-05: `develop settings '{"implementor_model":"test-model"}'` persists to `.codex/develop/settings.json` and `develop settings` reads it back with the updated value
- V-06: `develop settings '{"unknown_key":"value"}'` is rejected with structured error
- V-07: `develop status --phase-number 1 --feature-slug governed-canonical-closeout-receipt` returns truthful status from committed feature-local state for an existing completed slice
- V-08: `develop status --phase-number 1 --feature-slug nonexistent-slice` returns "no known state for this slice" without error
- V-09: Governor `validate-prerequisites` rejects when contract.md is missing -- returns structured fail with finding "contract.md not found"
- V-10: Governor `validate-prerequisites` rejects when contract.md has missing headings -- returns structured fail listing which headings are missing
- V-11: Governor `validate-prerequisites` rejects when context.md is missing or empty -- returns structured fail
- V-12: Governor `validate-prerequisites` passes for a well-formed contract.md and non-empty context.md
- V-13: Governor `validate-integrity` rejects when Compatibility Decision is not `compatible` -- returns structured fail
- V-14: Governor `validate-integrity` rejects when Later-Company Check is `yes` -- returns structured fail
- V-15: Governor `validate-integrity` passes for a fully compliant Acceptance Gates section
- V-16: `develop implement --phase-number 1 --feature-slug test-slice --task-summary "test"` with valid contract/context runs prerequisite validation and returns structured "not yet available" message (does not spawn workers)
- V-17: `develop fix --phase-number 1 --feature-slug test-slice --fix-instruction "test"` with valid contract/context runs prerequisite validation and returns structured "not yet available" message (does not spawn workers)
- V-18: Status truth hierarchy proof: create a test feature directory with both `implement-plan-state.json` (showing status "completed") and a contradictory `.codex/develop/lanes/` projection (showing status "implementing"). Verify `develop status` reports "completed" (committed truth wins over projection).
- V-19: Status behavior without `closeout-receipt.v1.json`: verify status renders correctly from feature-local state alone, without error, when no receipt is present.
- V-20: Status behavior with `closeout-receipt.v1.json`: verify status includes receipt-sourced fields (commit roles, merge evidence) when receipt is present.
- V-21: Manifest registration: `skills/manifest.json` includes a structurally valid develop entry. Verify by reading the file and confirming the develop skill object contains required fields (skill name, SKILL.md path, script paths, reference paths, agent definition path) consistent with the pattern used by existing skills in the same manifest.
- V-22: `git -C C:/ADF diff --check` -- no whitespace errors in new files

Human Verification Plan:

Required: true

Reason: This is the first public `develop` command surface. An invoker (human or COO agent) must manually verify that the help output is clear, the status output is readable and truthful, and the settings surface works as documented. The deterministic governor is machine-verifiable, but the invoker-facing output quality requires human judgment.

Testing phase: After machine verification passes, a human invoker must:
1. Run `develop help` and verify the output is clear, complete, and contains template references.
2. Run `develop settings '{"implementor_model":"gpt-5.3-codex-spark"}'` and verify persistence.
3. Run `develop status` against a known completed slice and verify truthful, readable output.
4. Run `develop status` against a known active slice (if available) and verify stage/status/blocker rendering.
5. Run `develop implement` against a valid slice and verify the "not yet available" message is clear.
6. Attempt to call governor functions directly (not through develop) and verify they work as standalone validation utilities.

Expected results: Help is scannable and complete. Settings persist correctly. Status is truthful per the truth hierarchy. Guarded stubs are clear about what is and is not available.

Evidence to report back: Screenshots or terminal output of each test step showing actual command output.

Response contract: APPROVED or REJECTED: <specific issues found>

7. Observability / Audit

- Every governor validation must produce structured JSON output (status, findings, blocker) that can be logged.
- Settings changes must be logged to `.codex/develop/settings-history.json` (append-only: timestamp, previous value, new value, source).
- Status rendering must include a `truth_sources` field listing which sources were consulted and which was authoritative for each reported field.
- Guarded implement/fix stubs must log that prerequisite validation was attempted and passed before returning "not yet available."

8. Dependencies / Constraints

- Slice 0 (`governed-canonical-closeout-receipt`) must be merged on `main` before this slice begins implementation.
- Must import heading constants from `implement-plan-helper.mjs` or `governed-feature-runtime.mjs` (read-only, do not modify those files).
- Must follow the manifest.json registration pattern established by existing skills.
- Settings persistence must use `writeJsonAtomic` from `governed-feature-runtime.mjs` or equivalent atomic write to prevent corruption.
- Governor must not make LLM calls. All validation is deterministic.
- `develop` is the only public implementation skill after this slice. However, this slice does not yet retire direct `implement-plan` usage (that is Slice D scope).

9. Non-Goals

- Full A-to-Z implement orchestration (Slice B)
- Worker spawning for implementation, audit, or review (Slice B)
- Review-cycle delegation as a working production route (Slice B)
- Merge-queue delegation as a working production route (Slice B)
- Fix path with delta-only resume (Slice C)
- Parallel lane support beyond conflict detection (Slice C)
- MCP bridge work (Slice D)
- Retirement of direct `implement-plan` public usage (Slice D)
- Public step-level reset
- Generic governance cleanup
- Redesign of existing engines
- Lane runner / step sequencer (Slice B)
- KPI capture implementation (Slice B -- this slice defines the KPI model in a reference doc but does not implement capture)
- Brain persistence integration (Slice B)

10. Source Authorities

- `C:/ADF/docs/phase1/develop-boxed-front-door-architecture-proposal.md`
- `C:/ADF/docs/phase1/develop-boxed-front-door-delivery-plan.md`
- `C:/ADF/docs/phase1/develop-boxed-front-door-implementation-plan.md`
- `C:/ADF/docs/phase1/governed-canonical-closeout-receipt/README.md`
- `C:/ADF/docs/phase1/governed-canonical-closeout-receipt/context.md`
- `C:/ADF/docs/phase1/governed-canonical-closeout-receipt/implement-plan-contract.md`
- `C:/ADF/docs/phase1/governed-canonical-closeout-receipt/implementation-addendum.md`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/references/prompt-templates.md`
- `C:/ADF/skills/governed-feature-runtime.mjs`
- `C:/ADF/skills/manifest.json`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`

11. Explicit Implementor Rule

The implementor must treat this contract as literal intent.

Do not widen Slice A into Slice B scope. Do not implement worker spawning, review-cycle delegation, merge-queue delegation, or full orchestration. Do not redesign existing engines.

The slice is done only when:
- `develop help` returns a structured invoker guide
- `develop settings` persists and reads correctly
- `develop status` renders truthful status using the committed truth hierarchy
- the governor rejects malformed contracts and missing prerequisites with structured output
- guarded `implement` and `fix` stubs validate prerequisites before reporting unavailability
- manifest registration is complete
- all machine verification steps pass
- human verification is approved
- no lifecycle truth leaks from operational projections into committed truth surfaces
