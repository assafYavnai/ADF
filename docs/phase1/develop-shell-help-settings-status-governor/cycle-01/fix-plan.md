1. Failure Classes

- `PUBLIC_FRONT_DOOR_NOT_IMPLEMENTED`
- `DETERMINISTIC_GOVERNOR_AND_TRUTH_ROUTE_NOT_IMPLEMENTED`

2. Route Contracts

- Failure class: `PUBLIC_FRONT_DOOR_NOT_IMPLEMENTED`
- claimed supported route: `invoker -> skill manifest -> develop help|settings|status|implement|fix`
- end-to-end invariant: invokers must enter implementation workflow only via a public `develop` boundary that maps commands to deterministic handlers and does not expose raw `implement-plan`/`review-cycle`/`merge-queue` for primary flow.
- KPI Applicability: required
- KPI Route / Touched Path: `develop help`, `develop settings`, `develop status`, and manifest-based skill dispatch to `C:/ADF/skills/develop/**`
- KPI Raw-Truth Source: command dispatch JSON and artifact state under `docs/phase1/develop-shell-help-settings-status-governor/` and `skills/manifest.json`
- KPI Coverage / Proof: V-04 and V-21 must pass plus manual user-facing command confirmation that `develop` is discoverable and actionable.
- KPI Production / Proof Partition: production path is real invoker calls in `C:/ADF`; proof path is isolated fixture-feature checks under `docs/phase1/develop-shell-help-settings-status-governor/`
- KPI Non-Applicability Rationale: not applicable; KPI required.
- KPI Exception: none
- Vision Compatibility: compatible
- Phase 1 Compatibility: compatible
- Master-Plan Compatibility: compatible
- Current Gap-Closure Compatibility: compatible
- Later-Company Check: no
- Compatibility Decision: compatible
- Compatibility Evidence: `develop-shell-help-door` delivery plan and existing architecture proposal define this as Slice A mandatory front-door layer.
- allowed mutation surfaces: `skills/develop/SKILL.md`, `skills/develop/agents/openai.yaml`, `skills/develop/references/*.md`, `skills/manifest.json`
- forbidden shared-surface expansion: no broad orchestration surfaces, no MCP bridge, no review-cycle/merge-queue delegation paths in Slice A.
- docs that must be updated: `skills/develop/*`, `skills/manifest.json`, `docs/phase1/develop-shell-help-settings-status-governor/cycle-01/fix-report.md`

- Failure class: `DETERMINISTIC_GOVERNOR_AND_TRUTH_ROUTE_NOT_IMPLEMENTED`
- claimed supported route: `invoker -> develop helper -> develop governor -> status/setting/state surfaces -> committed feature artifacts`
- end-to-end invariant: prerequisite/integrity/lane-conflict checks and status truth synthesis are deterministic and script-owned with live operational projection fallback and committed truth precedence.
- KPI Applicability: required
- KPI Route / Touched Path: `develop settings`, `develop status`, and governor validation outputs under `develop-helper.mjs`, `develop-governor.mjs`, `develop-setup-helper.mjs`
- KPI Raw-Truth Source: `implement-plan-contract.md`, `implement-plan-state.json`, optional `closeout-receipt.v1.json`, git merge ancestry, and `.codex/develop/*`
- KPI Coverage / Proof: V-09..V-20 must pass, including proof that closed-state truth from committed artifacts and merge truth outranks lane projections.
- KPI Production / Proof Partition: production route = real feature directories under `docs/phase1`; proof route uses local fixtures and isolated temp feature directories.
- KPI Non-Applicability Rationale: not applicable; KPI required.
- KPI Exception: none
- Vision Compatibility: compatible
- Phase 1 Compatibility: compatible
- Master-Plan Compatibility: compatible
- Current Gap-Closure Compatibility: compatible
- Later-Company Check: no
- Compatibility Decision: compatible
- Compatibility Evidence: slice contract and delivery plan require deterministic governance and truth hierarchy in Layer 2.
- allowed mutation surfaces: `skills/develop/scripts/develop-helper.mjs`, `skills/develop/scripts/develop-governor.mjs`, `skills/develop/scripts/develop-setup-helper.mjs`, `skills/develop/references/workflow-contract.md`, `skills/develop/references/settings-contract.md`, `skills/develop/references/kpi-contract.md`, `skills/develop/references/artifact-templates.md`, `skills/develop/references/invoker-guide.md`, `.codex/develop/*`
- forbidden shared-surface expansion: no internal engine spawn in Slice A; no new lifecycle truth channels outside these bounded files.
- docs that must be updated: `skills/develop/*`, `docs/phase1/develop-shell-help-settings-status-governor/cycle-01/fix-report.md`

3. Sweep Scope

- `skills` scope: `C:/ADF/skills/develop/**` (new front-door files only).
- Project manifest scope: `C:/ADF/skills/manifest.json`.
- Authority scope: `CONTRACT_HEADINGS`, `validateHeadingContract`, `readJson`, `writeJsonAtomic`, and `withLock` imported from governed runtime modules.
- Contract scope: `C:/ADF/docs/phase1/develop-shell-help-settings-status-governor/` feature artifacts and required `implement-plan-state.json`, `implement-plan-contract.md`.
- Sibling operational scope: existing live feature states in `C:/ADF/docs/phase1/` and `.codex/develop/lanes/**` to ensure projection-vs-committed precedence holds.
- Negative proof scope: unknown keys in `develop settings`, conflicting proof/prod lanes, and contract heading regressions in sibling artifacts.

4. Planned Changes

- Add `C:/ADF/skills/develop/SKILL.md` and `C:/ADF/skills/develop/agents/openai.yaml` with strict Slice A command surface.
- Add `C:/ADF/skills/develop/references/invoker-guide.md`, `artifact-templates.md`, `settings-contract.md`, `kpi-contract.md`, and `workflow-contract.md`.
- Add `C:/ADF/skills/develop/scripts/develop-helper.mjs` command dispatcher for `help`, `settings`, `status`, `implement`, and `fix`.
- Add `C:/ADF/skills/develop/scripts/develop-setup-helper.mjs` to produce `.codex/develop/setup.json` and `.codex/develop/setup.json` validation fields.
- Add `C:/ADF/skills/develop/scripts/develop-governor.mjs` implementing deterministic `validatePrerequisites`, `validateIntegrity`, and `checkLaneConflict` with explicit failure shapes.
- Add `.codex/develop/settings.json`, `.codex/develop/settings-history.json`, `.codex/develop/setup.json`, and empty `.codex/develop/lanes/` scaffolding when settings or status is first invoked.
- Update `C:/ADF/skills/manifest.json` with a `develop` entry matching existing skill manifest schema.
- Implement truth-ordered `develop status` rendering in helper and tests for `implement-plan-state.json` vs projection vs receipt precedence.

5. Closure Proof

- V-01, V-02, and V-03 node syntax checks for the three new scripts.
- V-04 by running `develop help` and confirming all guide sections and command surface details are present.
- V-05 and V-06 by calling settings set/get with valid and unknown keys and checking `settings-history.json` append.
- V-09..V-12 by calling governor prereq commands for missing/malformed/matched contract and context cases.
- V-13, V-14, V-15 by validating `validate-integrity` failure/success combinations from contract fields.
- V-16 and V-17 by invoking `develop implement|fix` against a valid fixture and confirming no spawn occurs and proper unavailable messages return after prerequisite checks.
- V-18, V-19, V-20 by status projection-vs-authority fixture proving committed truth precedence and receipt handling.
- V-21 by manifest inspection verifying `develop` registration completeness.
- V-22 with `git -C C:/ADF diff --check` and no trailing whitespace for new files.
- claimed-route/proved-route check: supported route (public develop boundary + deterministic governor) is identical to proof route; no undocumented bypass path is used.

6. Non-Goals

- Full implementation orchestration, worker spawning, review-cycle delegation, merge-queue delegation, and MCP bridge work.
- Parallel lane support and step-level reset surfaces.
- KPI persistence plumbing to Brain (Slice B).
- Retrofitting `implement-plan`, `review-cycle`, `merge-queue` internals.
- Any edits outside Slice A scope in other feature slices unless required by required docs updates for registration and bounded proof.
