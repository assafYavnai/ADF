# Develop Boxed Front-Door Implementation Plan

Status: approved  
Date: 2026-04-09  
Owner: CEO  
Scope: reviewed implementation plan for the `develop` boxed skill program

---

## Context

ADF's current implementation flow requires invokers to internalize a ~300-line orchestration prompt, manually coordinate three internal engines, and manage governance state across `implement-plan`, `review-cycle`, and `merge-queue`. This creates three systemic problems:

1. **Agents bypass the governed route** because the complexity is too high.
2. **Implementations are half-baked** because error handling falls between the cracks.
3. **COO cannot reliably use the system** because too much operational knowledge leaks to invokers.

The `develop` skill replaces all of this with a simple verb-based interface that boxes all internal orchestration. It becomes the **only public skill** for governed implementation. The existing `implement-plan`, `review-cycle`, and `merge-queue` skills become **internal engines** hidden behind the box.

**Key design principle (CEO directive):** Governance is deterministic script logic. LLMs may summarize, classify, and generate compact prompts, but never own lifecycle truth.

---

## Authoritative Sources

| Document | Commit / Path | Role |
|----------|---------------|------|
| Architecture proposal | `docs/phase1/develop-boxed-front-door-architecture-proposal.md` | Target model, 4-layer architecture, enforcement model |
| Delivery plan | `docs/phase1/develop-boxed-front-door-delivery-plan.md` | Committed rollout phases, acceptance criteria |
| Slice 0 README | `docs/phase1/governed-canonical-closeout-receipt/README.md` | Closeout receipt overview |
| Slice 0 context | `docs/phase1/governed-canonical-closeout-receipt/context.md` | Root cause + design direction |
| Slice 0 contract | `docs/phase1/governed-canonical-closeout-receipt/implement-plan-contract.md` | Receipt schema, canonicalization rules, acceptance gates |
| Slice 0 addendum | `docs/phase1/governed-canonical-closeout-receipt/implementation-addendum.md` | Boundary rules |

---

## Non-Negotiable Policy Rules

1. **Script governs.** Deterministic script logic owns all lifecycle truth decisions. LLMs are workers inside the box, never the authority.
2. **`develop` is the only public implementation skill.** `implement-plan`, `review-cycle`, and `merge-queue` are internal engines.
3. **Final lifecycle truth** comes from governed feature-local artifacts (`implement-plan-state.json`, `closeout-receipt.v1.json`, `completion-summary.md`) plus merge truth. Lane-state, heartbeat, KPI, and error files are operational projections, not final lifecycle truth.
4. **Disk KPI persistence is required.** Brain persistence is optional / best-effort.
5. **Reviewer reports must be surfaced immediately and verbatim** before any fix work begins.
6. **Invokers need only `contract.md` and `context.md`** as intake artifacts.
7. **Public step-level reset is not part of v1.** If reset is mentioned at all, it must be internal/admin-only and attempt-based.
8. **Internal mutating calls fail closed** when invoked outside the governor.

---

## Public v1 Command Surface

| Command | Purpose |
|---------|---------|
| `develop help` | Usage guide, intake templates, current lane statuses |
| `develop implement <slice>` | Full governed A-to-Z implementation |
| `develop fix <slice>` | Fix a rejected slice via delta-only to existing implementor |
| `develop status <slice>` | Show lane status, progress, blockers, verdicts |
| `develop settings <json>` | View or override model/effort settings |

**Not public in v1:** step-level reset, direct helper actions, direct merge/review controls, direct completion mutation.

### Input Artifact Contract

Before calling `develop implement`, invoker creates under `docs/phase<N>/<feature-slug>/`:

1. **`contract.md`** -- Frozen implementation contract (existing 10-heading structure).
2. **`context.md`** -- Brain-derived context with source references.

The governor validates this package before starting implementation. `develop help` teaches how to create these with templates and validation rules.

### Settings Model

Invoker can change model selection via `develop settings`. Governance behavior is not overridable. Settings are persisted to disk. Schema:

- `implementor_model`, `implementor_effort`
- `auditor_model`, `auditor_effort`
- `reviewer_model`, `reviewer_effort`
- `max_review_cycles`
- `human_verification_hold` (from contract)

---

## Architecture: 4-Layer Model

```
Layer 1: Public develop boundary (SKILL.md + entry script)
  - Parse public commands, show help, validate intake presence
  - Call the governor, render user-facing status
  - Intentionally thin

Layer 2: Deterministic governance script (the actual box)
  - Path resolution, runtime preflight, setup validation
  - Intake validation, run identity, attempt identity
  - Lock acquisition, state transitions, lane selection
  - Helper invocation, review/fix loop sequencing
  - Human verification gates, invoker approval gates
  - Merge sequencing, KPI/event emission
  - Truthful status synthesis
  - Governor-issued leases for internal mutating actions

Layer 3: Internal lane adapter
  - Compact prompt construction for workers
  - Worker selection from policy
  - Persistent lane reuse when valid
  - Collecting worker outputs into governed artifacts

Layer 4: Internal governed engines (unchanged)
  - implement-plan
  - review-cycle
  - merge-queue
```

**Enforcement:** All internal mutating actions require a valid governor lease (feature identity, run ID, attempt ID, allowed transitions, expiration). Calls outside the governor fail closed.

---

## Orchestration Flow: `develop implement <slice>` (9 Steps)

### Step 1: VALIDATE_PREREQUISITES (governor script, no LLM)
- Checks: `contract.md` exists with required headings, `context.md` non-empty, feature not completed/closed, no conflicting lane.
- Output: structured PASS or error with exactly what's missing.

### Step 2: INITIALIZE_LANE (governor script)
- Create lane operational state.
- Delegate to `implement-plan` engine: setup refresh, worktree, integrity gate, execution contract.
- If integrity fails: surface pushback, lane blocked.
- If passes: lane prepared, write first heartbeat.

### Step 3: RUN_IMPLEMENTATION (script spawns LLM worker)
- Spawn implementor worker with implementation brief.
- Worker runs in governed worktree, heartbeat updated each phase.
- Pass: lane -> verification_pending. Fail: lane -> implementation_failed.

### Step 4: MACHINE_VERIFICATION (governor script, no LLM)
- Execute verification commands from contract.
- Pass: lane -> review_pending. Fail: lane -> verification_failed.

### Step 5: REVIEW_CYCLE (script delegates to review-cycle engine)
- Auditor + reviewer run.
- **Reports surfaced immediately and verbatim** -- not collapsed into summary.
- Reject: FIX_CYCLE (delta-only to existing implementor, up to `max_review_cycles`).
- Exhausted: lane -> blocked. Approve: lane -> review_approved.

### Step 6: HUMAN_VERIFICATION_HOLD (conditional)
- Only if contract says `Human Verification Plan: Required: true`.
- Surface testing handoff, HOLD for APPROVED/REJECTED.
- Reject: FIX_CYCLE. Approve: lane -> human_verified.

### Step 7: INVOKER_APPROVAL_HOLD (always in public develop v1)
- **Policy decision:** Public `develop v1` adopts "always hold for invoker approval" as an intentional policy choice. This is stricter than the current committed delivery-plan wording (which says "when required by policy/contract"). Rationale: the boxed front door should never silently commit completion truth without the invoker's explicit sign-off. This supersedes the looser wording for the public `develop` surface only; internal/admin paths may retain the conditional policy.
- Generate detailed completion report (commits, steps, KPIs, sync status, approval request).
- HOLD until invoker explicitly approves.
- Reject: return to specific step. Approve: proceed.

### Step 8: GOVERNED_MERGE (script delegates to merge-queue engine)
- Enqueue exact approved commit SHA (not moving branch head), process-next.
- Success: lane -> merged. Blocked: lane -> merge_blocked.

### Step 9: FINALIZE (script)
- Validate closeout readiness.
- Consume `closeout-receipt.v1.json` (from Slice 0 substrate) for truthful post-merge reporting.
- Regenerate `completion-summary.md` from current state + receipt truth.
- Capture KPIs to disk (required) and Brain (best-effort).
- Lane -> completed, surface final report.

---

## Lane State Machine

```
develop implement
       |
  [initializing] --integrity fail--> [blocked]
       |
  [prepared]
       |
  [implementing] --fail--> [implementation_failed]
       |
  [verification_pending]
       |
  [verifying] --fail--> [verification_failed] --fix--> [implementing]
       |
  [review_pending]
       |
  [reviewing] --reject--> [review_rejected] --fix--> [implementing]
       |                                   --exhausted--> [blocked]
  [awaiting_human_verification]  (conditional)
       |
  [awaiting_invoker_approval]  (always)
       |
  [merging] --blocked--> [merge_blocked]
       |
  [completed]
```

Lane-state is an **operational projection**, not final lifecycle truth. Final truth comes from governed feature-local artifacts plus merge truth.

---

## KPI Model

Per-lane on disk (required). Brain persistence optional / best-effort.

**Timing:** total_elapsed, by-stage breakdown (preparation, implementation, verification, review, fix_cycles, human_verification_wait, invoker_approval_wait, merge).

**Counts:** review_cycles, fix_cycles, verification_attempts, verification_failures, review/human/invoker rejections.

**Quality:** first_pass_review_approved, first_pass_verification, files_changed, lines_added/removed, defect_classes.

**Outcome:** completed | blocked | failed | cancelled.

---

## Error Model

| Error Class | Lane Status |
|-------------|------------|
| PREREQUISITE_MISSING | (lane not created) |
| INTEGRITY_FAILED | blocked |
| WORKER_FAILED | implementation_failed |
| VERIFICATION_FAILED | verification_failed |
| REVIEW_EXHAUSTED | blocked |
| MERGE_BLOCKED | merge_blocked |

Each produces: structured lane state update, invoker-facing message, append-only error log entry.

---

## Rollout Order

### Slice 0: `governed-canonical-closeout-receipt` (PREREQUISITE)
**Status:** README, context, contract, and addendum committed on `origin/main`.
**Purpose:** Create canonical `closeout-receipt.v1.json` per feature, canonical repo-root rewrite after merge, completion-summary regeneration, explicit separation of runtime observations from committed truth.
**Why first:** The `develop` shell needs canonical committed closeout truth for status, finalize, and post-merge reporting. Slice A must not begin before Slice 0 is materially complete.
**Root cause addressed:** Four failure families -- merge-worktree path leakage, stale lifecycle wording survival, commit-role ambiguity, runtime observations blended with committed truth.

### Slice A: Shell + help + settings + status + governor
**Scope:** Public SKILL.md entry point, entry script (help, settings, status commands), governance script (prerequisite validation, integrity checks), setup detection/validation, reference docs (help text, intake templates, settings contract).
**Acceptance:** `develop help` returns structured guide with intake templates. `develop settings` persists and reads. `develop status` reads lane and feature state truthfully. Governor validates prerequisites and rejects malformed contracts.

### Slice B: Full implement orchestration
**Scope:** Implement command in entry script, lane step sequencer (the 9-step flow above), machine verification delegation, review-cycle engine delegation, human-verification hold, invoker-approval hold, merge-queue engine delegation, KPI capture, closeout receipt consumption.
**Dependencies:** Slice A + Slice 0 merged.
**Acceptance:** Full A-to-Z on one real slice. Approval holds work. KPIs captured to disk. Review reports surfaced verbatim. `closeout-receipt.v1.json` consumed for truthful post-merge reporting.

### Slice C: Fix path + parallel lanes + bounded recovery
**Scope:** Fix command in entry script, delta-only implementor resume, parallel feature lane support (per-feature locks, worktree isolation), internal admin-only attempt-based recovery surfaces.
**Acceptance:** Fix rejected slice with delta-only. Parallel features run safely without interference. No public step-level reset exposed.

### Slice D: MCP bridge + retirement path
**Scope:** `dev_team` MCP tool bridge to develop, status bridge, AGENTS.md migration to point at develop, retirement path for direct `implement-plan` invocation.
**Acceptance:** `devteam_implement` MCP tool delegates to develop. COO uses develop as standard path.

---

## File Structure (Indicative)

The following paths describe the target layout. Concrete module names are illustrative for implementor clarity; they may be adjusted during slice implementation as long as the architectural layers and governance boundaries are preserved.

```
C:/ADF/skills/develop/
  SKILL.md                              # Public entry point (<100 lines)
  references/
    invoker-guide.md                    # Help text (develop help output)
    artifact-templates.md               # contract.md / context.md templates
    settings-contract.md                # Allowed settings surface
    kpi-contract.md                     # KPI model definition
  scripts/
    (entry script)                      # Main: help, implement, fix, status, settings
    (governance script)                 # Deterministic governance checks (no LLM)
    (lane runner)                       # Per-lane step sequencer
    (setup helper)                      # Setup detection and validation
```

Operational state (projections, not lifecycle truth):
```
C:/ADF/.codex/develop/
  settings.json                         # Global settings
  lanes/
    <lane-id>/
      lane-state.json                   # Operational projection
      heartbeat.json                    # Live progress for invoker
      kpi.json                          # Per-lane metrics (disk required)
      errors.json                       # Append-only error log
      events/                           # Append-only event log
  locks/                                # File-based locks
  signals/                              # Stop signals
```

Updates to existing files (Slice D):
```
C:/ADF/skills/manifest.json             # Register develop skill
C:/ADF/AGENTS.md                        # Point to develop as implementation entry
```

---

## Governance Script Command Surface

All deterministic. No LLM. Each returns structured JSON with status, findings, and blocker fields. The governance script integrates with the shared governed runtime for heading constants, lock management, and JSON I/O -- exact import paths are provisional and will be pinned by the Slice A contract.

| Command | Checks |
|---------|--------|
| validate-prerequisites | contract.md headings, context.md presence, lifecycle state, lane conflicts |
| validate-integrity | KPI fields, compatibility gates, deliverables, authority freeze |
| run-verification | Machine verification plan from contract |
| validate-closeout | Merge readiness, closeout receipt consumption |
| check-lane-conflict | No duplicate lanes per feature |

---

## Status and Finalize Truth Contract

### Truth hierarchy for `develop status` and post-merge reporting

`develop status` and Step 9 (FINALIZE) must read from the following sources in priority order:

1. **Committed feature-local state** -- `implement-plan-state.json`, `completion-summary.md`, and other governed artifacts under `docs/phase<N>/<feature-slug>/`. This is final lifecycle truth.
2. **`closeout-receipt.v1.json`** -- Canonical post-merge receipt emitted by Slice 0 substrate. Consumed for truthful post-merge reporting (commit roles, merge evidence, reconciliation status).
3. **Merge truth** -- Whether the approved commit SHA landed on the target branch.

Lane-state, heartbeat, KPI, and error files are **live operational views only**. They are useful for showing in-flight progress to the invoker, but they are not lifecycle truth. **If operational projections disagree with committed feature-local closeout truth, committed feature-local closeout truth wins.**

This hierarchy is the reason Slice 0 (`governed-canonical-closeout-receipt`) must land before the first public `develop` shell: the shell's status and finalize paths depend on the receipt substrate being available to read.

### Verbose status model

`develop status` must not use fake progress percentages. Show truthful stage vocabulary:

`validating_artifacts`, `pushback_required`, `worktree_prepared`, `implementing`, `machine_verifying`, `review_cycle_running`, `fixing`, `awaiting_human_verification`, `ready_for_merge`, `merging`, `completed`, `blocked`.

For each status, show minimum: current stage, status, last durable event, current blocker (if present), latest verdicts (if present), next expected transition.

---

## Acceptance Criteria (Overall Program)

1. Invokers use `develop implement <slice>` without internal helper knowledge.
2. Boxed route preserves governed review, merge, and completion truth.
3. Status is truthful and easy to read via `develop status`.
4. Multiple slices run in parallel safely (Slice C).
5. Internal mutating calls fail closed outside the governor.
6. Box is compatible with later MCP `dev_team` wrapper (Slice D).
7. Canonical `closeout-receipt.v1.json` consumed for truthful post-merge reporting.
8. Reviewer reports surfaced immediately and verbatim before fix work begins.
9. Invokers need only `contract.md` and `context.md` as intake artifacts.

---

## Verification

1. Syntax-check all new script files.
2. `develop help` returns structured guide with intake templates.
3. `develop settings` persists and reads correctly.
4. Governance script rejects malformed `contract.md`.
5. Full `develop implement` on one real slice (post Slice B).
6. KPIs captured to disk; Brain capture best-effort.
7. Invoker approval hold blocks merge until explicit approval.
8. Two parallel lanes run without interference (post Slice C).
9. Existing engine tests still pass (no engine behavior changed).
10. `closeout-receipt.v1.json` consumed for status and post-merge reporting (post Slice 0 + B).

---

## Key Existing Systems

### Core governed engines (fixed -- must remain behind the box)

These three engines are the committed internal lifecycle backbone. The `develop` box delegates to them; it does not replace or rewrite them.

| Engine | Current path | Role |
|--------|-------------|------|
| `implement-plan` | `skills/implement-plan/` | Prepare, state, events, worktree, complete |
| `review-cycle` | `skills/review-cycle/` | Audit, review, fix, closeout |
| `merge-queue` | `skills/merge-queue/` | FIFO merge, conflict handling, closeout validation |

### Likely integration points (illustrative / provisional)

The following modules are likely reuse candidates based on current codebase structure. Their exact paths and APIs are **not frozen by this plan** -- slice contracts will pin specific integration points when implementation begins.

- **Shared governed runtime** -- utilities for locks, JSON I/O, heading constants (currently in `skills/governed-feature-runtime.mjs`).
- **Benchmark runtime** -- lane/heartbeat/signal patterns that may inform the develop lane model (currently in `skills/benchmark-runtime.mjs`).
- **Brain operations** -- KPI persistence helper for best-effort Brain capture (currently in `skills/brain-ops/`).
- **Skill manifest** -- registration entry point (`skills/manifest.json`).

### Authoritative planning documents

| Document | Path |
|----------|------|
| Committed delivery plan | `docs/phase1/develop-boxed-front-door-delivery-plan.md` |
| Architecture direction | `docs/phase1/develop-boxed-front-door-architecture-proposal.md` |
| Slice 0 artifacts | `docs/phase1/governed-canonical-closeout-receipt/` |
