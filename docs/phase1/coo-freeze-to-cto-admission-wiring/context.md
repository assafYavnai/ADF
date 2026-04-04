# coo-freeze-to-cto-admission-wiring — Context

## Purpose
This slice makes the live COO freeze path produce real CTO-admission artifacts from the merged `COO/cto-admission/**` package.

## Why It Exists
- The packet builder exists but is still standalone.
- The COO can already freeze finalized requirements.
- The missing seam is the live handoff from finalized requirement to technical admission truth.

## Key Constraints
- Keep the change narrow and additive.
- Do not build a full CTO queue or scheduler.
- Do not auto-spawn implement-plan in this slice.
- Make `pending decision` explicit instead of pretending the packet is fully admitted.

## Design Decisions
- The live admission seam runs only after the finalized requirement artifact has been durably published and locked. The freeze route does not fabricate CTO-admission artifacts from a provisional or failed publish path.
- The adapter maps the real `RequirementArtifact` into the existing packet-builder contract without widening the requirements artifact schema. Deterministic defaults are:
  - `feature_slug`: slugified approved topic
  - `requirement_artifact_source`: `memory://finalized-requirement/<memory-id>` when the live publish succeeded, otherwise the handoff does not run
  - `business_priority`: `medium` until a live COO-owned priority signal exists
  - `claimed_scope_paths`: the live thread scope path
  - `non_goals` and `boundaries`: copied directly from explicit onion boundaries
  - `suggested_execution_mode`: derived deterministically from derivation blockers and major-part count
- Admission artifact paths are persisted as repo-relative paths under `docs/phase1/<feature-slug>/...` so the thread state remains durable and portable across worktrees.
- The durable admission state is COO-owned and explicit. The live route persists:
  - builder `outcome`
  - explicit `status`
  - explicit decision fields
  - artifact paths
  - packet KPI snapshot
  - slice KPI rollups for latency, buckets, counts, parity, write completeness, and production/proof separation
- The truth rule is enforced in state resolution:
  - `decision=null` means `admission_pending_decision`, even when the packet builder returns `outcome="admitted"`
  - explicit `admit`, `defer`, and `block` decisions are separate from the packet-builder outcome
  - artifact-persist failures fail closed as `admission_build_failed` while preserving the original packet-builder outcome in `outcome`
- When a previously frozen onion scope reopens, the old CTO-admission state is reset to `admission_not_started` instead of remaining falsely current.
- The minimal decision-update seam rewrites the persisted `cto-admission-decision.template.json` and `cto-admission-summary.md`, then updates the durable COO-owned admission state and counters.
- Controller serialization now exposes CTO-admission status, decision, outcome, and artifact paths so downstream readers can see the live handoff truth without reopening raw JSON.

## Verification Notes
- Focused proof coverage exists for:
  - build failed
  - artifact persist failed
  - pending decision
  - explicit admit
  - explicit defer
  - explicit block
  - latency percentile and slow-bucket rollups
  - production/proof handoff isolation
  - live freeze-path wiring into `thread.workflowState.onion.cto_admission`

## Dependency Note
This slice should land before the live executive/status wiring slice, because the status surface should be able to read real admission-state truth if available.
