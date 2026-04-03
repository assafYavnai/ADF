1. Implementation Objective

Build a production-ready conversation-state projection and natural CEO-facing response renderer for the live `requirements_gathering_onion` route so COO replies stop leading with raw slot labels while preserving governance, explicit freeze approval, existing onion truth state, and existing requirement-artifact behavior.

2. Slice Scope

- Live route in scope: `CLI -> controller -> classifier -> requirements_gathering_onion -> onion state/readiness facts -> derived conversation state -> natural response render -> CLI/thread output`
- Primary implementation surfaces:
  - `COO/requirements-gathering/live/onion-live.ts`
  - `COO/requirements-gathering/engine/conversation-state.ts`
  - `COO/requirements-gathering/engine/conversation-renderer.ts`
- Supporting read-only / proof-adjacent surfaces to check and touch only if required:
  - `COO/requirements-gathering/contracts/onion-live.ts`
  - `COO/requirements-gathering/contracts/onion-artifact.ts`
  - `COO/requirements-gathering/contracts/onion-state.ts`
  - `COO/requirements-gathering/engine/clarification-policy.ts`
  - `COO/requirements-gathering/engine/freeze-check.ts`
  - `COO/requirements-gathering/engine/readiness-check.ts`
  - `COO/controller/thread.ts`
  - `COO/requirements-gathering/onion-lane.test.ts`
  - `tests/integration/onion-route.runtime-proof.ts`
- Material documentation scope:
  - `docs/phase1/onion-live-integration-report.md`
  - `docs/phase1/requirements-gathering/context.md`
  - any new authoritative feature-root docs needed for the two-layer model

3. Required Deliverables

- Add a pure derived conversation-state layer for CEO-facing onion responses.
- Add a pure natural-response renderer that consumes derived conversation state instead of raw `scope_summary` lines.
- Refactor the live onion response composition to use the new derivation/rendering layer without changing onion persistence truth.
- Preserve one-question-at-a-time clarification, explicit freeze approval, freeze/reopen behavior, and requirement artifact derivation/finalization behavior.
- Add automated coverage for:
  - unclear intent -> exactly one smallest next question
  - clear intent but missing detail -> natural reflection plus one next question
  - ready for approval -> natural recap plus explicit confirmation/freeze check
  - approved/frozen -> confirmation without reopening scope
  - blocked -> clear blocker plus next safe move
  - regression proof for existing requirement artifact flow
- Update authoritative docs to explain the two-layer model: onion/internal truth state vs derived conversation state.
- Produce truthful implementation artifacts, verification evidence, commit/push closeout, and handoff into `review-cycle`.

4. Allowed Edits

- Add pure derivation and rendering helpers under `COO/requirements-gathering/engine/`.
- Refactor CEO-facing onion response composition in `COO/requirements-gathering/live/onion-live.ts`.
- Add non-persistent TypeScript types used only for derived rendering.
- Add or update targeted tests and live-route proof expectations.
- Update materially affected authoritative docs and feature artifacts.
- Make small CLI/output adjustments only if required to keep TTY and pipe/test-proof output usable.

5. Forbidden Edits

- Do not redesign the onion state machine.
- Do not reorder onion layers.
- Do not add a second persisted conversation-state truth model unless an unavoidable exception is proven and documented.
- Do not broaden this into a global COO tone rewrite.
- Do not change unrelated workflows.
- Do not introduce speculative refactors.
- Do not add new env vars, flags, or generic shared mutation surfaces unless proven necessary.
- Do not touch `/status` implementation in this slice.

6. Acceptance Gates

- Default CEO-facing onion replies no longer expose raw internal slot-style labels as the primary response.
- COO still asks exactly one smallest next question when clarification is needed.
- When intent is clear, COO reflects the request naturally in human language before the next question when needed.
- When approval/freeze is appropriate, COO asks for explicit confirmation and does not silently freeze.
- When blocked, COO explains the blocker clearly and gives the next safe move without pretending readiness.
- Conversation state stays derived from existing onion/readiness/approval/blocker facts and is not stored as a second source of truth.
- Existing requirement artifact creation/finalization flow still works.
- Existing freeze/approval behavior still works.
- TTY output and pipe/test-proof output remain usable.
- Materially affected authoritative docs are updated.
- Implementation and feature artifacts are committed and pushed.
- Review-cycle closes cleanly or stops truthfully with the blocker surfaced.

7. Observability / Audit

- Prove the supported live route, not only isolated helper behavior.
- Keep thread persistence, telemetry, and finalized requirement persistence truthful.
- Preserve existing onion operation telemetry unless a minimal additive proof need requires a targeted update.
- Keep proof-vs-live route isolation intact; no proof-only seam may contaminate ordinary live behavior.
- Record the strongest truthful worker mode used and keep worker/runtime closeout evidence in feature artifacts.

8. Dependencies / Constraints

- `OnionState` and approved snapshot remain the workflow source of truth.
- `WorkingScopeArtifact.scope_summary` may remain as an internal artifact/serialization surface, but not as the default CEO-facing response format.
- Derived conversation state must come only from existing onion truth, readiness, approval/freeze, and blocker facts.
- Existing requirement-artifact derivation and finalization logic must remain behaviorally intact.
- The slice must stay bounded to the requirements-gathering onion lane.
- Use the authoritative feature root `docs/phase1/coo-natural-conversation-rendering/` for all continuity artifacts.

9. Non-Goals

- No `/status` command implementation.
- No automated requirement-to-implementation bridge.
- No phase engine, queue, or CTO workflow work.
- No global conversational rewrite outside this onion lane.
- No Brain schema changes unless absolutely required and separately justified.
- No review-cycle optimization work in this slice.

10. Source Authorities

- `docs/phase1/coo-natural-conversation-rendering/README.md`
- `docs/phase1/coo-natural-conversation-rendering/context.md`
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
