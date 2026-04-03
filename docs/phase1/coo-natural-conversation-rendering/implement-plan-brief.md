1. Implementation Objective

Replace raw slot-dump CEO-facing onion replies with natural operator-style replies derived from existing onion/readiness/approval/blocker truth while preserving governance, explicit freeze approval, and the finalized requirement artifact route.

2. Exact Slice Scope

- Own the CEO-facing response composition in `COO/requirements-gathering/live/onion-live.ts`.
- Add pure conversation-state derivation and rendering helpers under `COO/requirements-gathering/engine/`.
- Sweep sibling proof surfaces and thread/CLI output expectations so the route stays coherent.
- Keep persistence, artifact derivation, freeze logic, and controller routing behavior intact unless a minimal adjustment is required for proof.

3. Inputs / Authorities Read

- `docs/phase1/coo-natural-conversation-rendering/README.md`
- `docs/phase1/coo-natural-conversation-rendering/context.md`
- `docs/phase1/coo-natural-conversation-rendering/implement-plan-contract.md`
- `docs/phase1/requirements-gathering/context.md`
- `docs/phase1/onion-live-integration-report.md`
- `docs/v0/architecture.md`
- `COO/requirements-gathering/live/onion-live.ts`
- `COO/requirements-gathering/contracts/onion-artifact.ts`
- `COO/requirements-gathering/contracts/onion-live.ts`
- `COO/requirements-gathering/contracts/onion-state.ts`
- `COO/requirements-gathering/engine/clarification-policy.ts`
- `COO/requirements-gathering/engine/freeze-check.ts`
- `COO/requirements-gathering/engine/readiness-check.ts`
- `COO/controller/thread.ts`
- `COO/requirements-gathering/onion-lane.test.ts`
- `tests/integration/onion-route.runtime-proof.ts`

4. Required Deliverables

- `conversation-state.ts` with typed derived presentation states.
- `conversation-renderer.ts` with natural CEO-facing rendering for those states.
- Refactored live onion response path using the derived presentation layer.
- Targeted unit/integration proof for the required state behaviors and regression coverage for requirement artifact flow.
- Authoritative docs update for the source-of-truth vs derived-presentation split.
- Updated feature artifacts and truthful closeout summary.

5. Forbidden Edits

- Do not redesign the onion reducer/state machine.
- Do not reorder onion layers or weaken the freeze gate.
- Do not persist conversation state as a new source of truth.
- Do not widen into unrelated controller, CTO, queue, or `/status` work.
- Do not introduce speculative shared surfaces or generic tone rewrites.

6. Integrity-Verified Assumptions Only

- The current defect is in CEO-facing response rendering on the live onion route, primarily `buildCeoResponse`.
- The internal `working_artifact.scope_summary` and thread serialization are still valid internal/state surfaces and must remain truthful.
- The feature root `docs/phase1/coo-natural-conversation-rendering/` is the authoritative slice root and had no prior continuity artifacts before this prepare run.
- The resolved strongest truthful worker lane for this slice is `codex_cli_full_auto_bypass` on `codex_cli_exec`.
- The current runtime defect around missing direct Brain MCP exposure was bounded-repaired through `adf.cmd --doctor`, which passed Brain connectivity/audit checks locally.

7. Explicit Non-Goals

- No `/status` implementation.
- No new persisted conversation-state model.
- No global COO response overhaul outside requirements-gathering onion.
- No review-cycle workflow optimization.
- No Brain schema work unless forced by a proven blocker.

8. Proof / Verification Expectations

- Unit tests for derived conversation states and renderer behaviors.
- Route-level proof through `tests/integration/onion-route.runtime-proof.ts`.
- Regression proof that requirement artifact create/finalize behavior still works.
- Proof that TTY output and pipe/test-proof mode remain usable after the response change.
- Build/typecheck and targeted tests from the repo’s supported commands.

9. Required Artifact Updates

- `docs/phase1/coo-natural-conversation-rendering/implement-plan-state.json`
- `docs/phase1/coo-natural-conversation-rendering/implement-plan-contract.md`
- `docs/phase1/coo-natural-conversation-rendering/implement-plan-brief.md`
- `docs/phase1/onion-live-integration-report.md`
- `docs/phase1/requirements-gathering/context.md`
- `docs/phase1/coo-natural-conversation-rendering/completion-summary.md`
- any review-cycle artifacts created after implementation handoff

10. Closeout Rules

- Use the strongest truthful worker mode available and record it in artifacts/commit body.
- Verify before writing `completion-summary.md`.
- Commit and push all code, docs, and feature artifacts together.
- Hand the same feature stream to `review-cycle` with `until_complete=true` and `max_cycles=8`.
- Stop truthfully if implementation, verification, git closeout, or review-cycle hits a real blocker.
