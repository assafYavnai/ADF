# Context: develop-shell-help-settings-status-governor

## Feature Metadata

- phase_number: 1
- feature_slug: develop-shell-help-settings-status-governor
- base_branch: main
- feature_branch: implement-plan/phase1/develop-shell-help-settings-status-governor
- depends_on: governed-canonical-closeout-receipt (Slice 0, must be merged on main before this slice begins)

## Task Summary

Create the first public `develop` skill shell -- the thin public entry point, deterministic governor, help surface, settings persistence, and truthful status rendering -- as the foundation for the boxed governed implementation front door defined in the committed architecture proposal and delivery plan.

This is Slice A of the `develop` boxed front-door rollout. Slice 0 (`governed-canonical-closeout-receipt`) must be merged before this slice begins because `develop status` and later finalize/reporting depend on the canonical closeout receipt substrate.

## Why This Slice Exists

The committed delivery plan (`docs/phase1/develop-boxed-front-door-delivery-plan.md`) defines a phased rollout:

- Slice 0: canonical closeout substrate (prerequisite)
- **Slice A: shell, help, settings, status, and governance** (this slice)
- Slice B: full implement orchestration
- Slice C: fix path, parallel lanes, bounded recovery
- Slice D: MCP bridge and retirement

Slice A creates the public boundary and governance layer that all later slices build on. Without it, there is no `develop` command surface, no governor to enforce the box, and no truthful status rendering.

## Authoritative Sources

1. `docs/phase1/develop-boxed-front-door-architecture-proposal.md` -- target model, 4-layer architecture, enforcement model, public command surface, status model, intake model
2. `docs/phase1/develop-boxed-front-door-delivery-plan.md` -- committed rollout phases, Slice A scope, command surface, governance surface, KPI model, report surfacing rule
3. `docs/phase1/develop-boxed-front-door-implementation-plan.md` -- reviewed implementation plan with truth hierarchy, policy decisions, and acceptance criteria
4. `docs/phase1/governed-canonical-closeout-receipt/README.md` -- Slice 0 overview
5. `docs/phase1/governed-canonical-closeout-receipt/context.md` -- Slice 0 root cause and design direction
6. `docs/phase1/governed-canonical-closeout-receipt/implement-plan-contract.md` -- receipt schema and canonicalization rules
7. `docs/phase1/governed-canonical-closeout-receipt/implementation-addendum.md` -- boundary rules, relationship to develop

## Design Direction

### Public command surface (Slice A subset)

| Command | Slice A behavior |
|---------|-----------------|
| `develop help` | Returns structured guide: what develop does, required intake artifacts, template locations, valid commands, settings surface, how status and approval work, human verification explanation |
| `develop settings <json>` | Persists and reads model/effort settings to `.codex/develop/settings.json` |
| `develop status <slice>` | Reads truthful status from committed feature-local artifacts, closeout receipt when present, and merge truth. Supplements with lane operational projections. Applies truth hierarchy: committed > receipt > merge > projections |
| `develop implement <slice>` | Validates prerequisites via governor. If valid, reports "implement orchestration not yet available -- arrives in Slice B." Does not spawn workers or run implementation. |
| `develop fix <slice>` | Validates prerequisites via governor. If valid, reports "fix path not yet available -- arrives in Slice C." Does not spawn workers or run fixes. |

### Deterministic governor

The governor is a script (no LLM). It owns prerequisite validation and integrity checking. It returns structured JSON with status, findings, and blocker fields. Governor commands for Slice A:

- `validate-prerequisites`: contract.md exists with 10 required headings, context.md non-empty, feature not completed/closed, no conflicting lane
- `validate-integrity`: KPI fields present when required, compatibility gates complete, deliverables stated, authority freeze check
- `check-lane-conflict`: no duplicate active lanes per feature slug

Later slices add: `run-verification`, `validate-closeout`.

### Truth hierarchy for status rendering

`develop status` must read from these sources in this priority order:

1. **Committed feature-local state** -- `implement-plan-state.json`, `completion-summary.md`, and other governed artifacts under `docs/phase<N>/<feature-slug>/`. This is final lifecycle truth.
2. **`closeout-receipt.v1.json`** -- When present, canonical post-merge receipt. Authoritative for commit roles, merge evidence, reconciliation status.
3. **Merge truth** -- Whether the approved commit SHA landed on the target branch.
4. **Lane operational projections** -- `lane-state.json`, `heartbeat.json`, `kpi.json`, `errors.json` under `.codex/develop/lanes/<lane-id>/`. Live operational views only.

**If operational projections disagree with committed feature-local closeout truth, committed feature-local closeout truth wins.**

### Settings model

Persisted at `.codex/develop/settings.json`. Invoker can change model selection only. Governance behavior is not overridable.

Schema fields:
- `schema_version` (integer, starts at 1)
- `implementor_model` (string)
- `implementor_effort` (string)
- `auditor_model` (string)
- `auditor_effort` (string)
- `reviewer_model` (string)
- `reviewer_effort` (string)
- `max_review_cycles` (positive integer)

### Setup detection

A setup helper detects runtime capabilities and writes `.codex/develop/setup.json`. This mirrors the existing `implement-plan-setup-helper.mjs` pattern. Setup is operational state, not committed truth.

## Constraints

- Slice 0 (`governed-canonical-closeout-receipt`) must be merged on `main` before this slice begins.
- This slice must not implement full A-to-Z orchestration, worker spawning, review-cycle delegation, merge-queue delegation, or MCP bridge work.
- `develop` is the only public implementation skill. The existing `implement-plan`, `review-cycle`, and `merge-queue` remain as internal engines.
- Governance is deterministic script logic. LLMs do not own lifecycle truth.
- Public step-level reset is not part of v1.
- Internal mutating calls must fail closed outside the governor.

## Expected Touch Points

- `C:/ADF/skills/develop/` (new skill directory -- all new files)
- `C:/ADF/.codex/develop/` (new operational state directory)
- `C:/ADF/skills/manifest.json` (register develop skill)
- `C:/ADF/docs/phase1/develop-shell-help-settings-status-governor/**` (slice artifacts)
- Integration with `skills/governed-feature-runtime.mjs` for heading validation, JSON I/O, lock utilities (exact import paths provisional -- the slice contract freezes what is needed)
