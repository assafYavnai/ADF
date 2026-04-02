# Candidate Frozen Requirement Contract

Candidate shadow only. Mirrors the authoritative Phase 1 contract shape, but Phase 0 is still open and this contract is not frozen.

## Identity

- Feature slug: `requirements-gathering`
- Feature name: `requirements-gathering`
- Source packet ref: `requirements/candidate-finalized-requirement-packet-basis.json`

## Intent

- Business intent: Review the requirements-gathering implementation end to end.
- User-facing goal: Review the requirements-gathering implementation end to end, with emphasis on the live COO onion integration route, persistence, telemetry, recovery, documentation, and proof.

## Functional Requirements

1. `FR-001` - The supported requirements-gathering route shall remain explicit and bounded as `CLI -> controller -> classifier -> requirements_gathering_onion -> thread workflow state + governed requirement persistence -> COO response -> telemetry`.
2. `FR-002` - The standard COO CLI bootstrap shall always use the real invoker path in normal operation and shall not accept proof-only deterministic parser updates unless explicit proof mode is enabled.
3. `FR-003` - A `handoff_ready` onion thread with persisted onion state shall remain onion-owned for follow-up gating and routing even when `active_workflow` is `null`.
4. `FR-004` - Frozen-thread serialization and recovery shall preserve workflow ownership, freeze status, approved snapshot identity, and approved human scope details after `handoff_ready`.
5. `FR-005` - The route shall create and lock a finalized requirement artifact only from an explicitly approved onion snapshot with explicit scope and no blocking ambiguity.
6. `FR-006` - If explicit scope is missing at handoff time, the route shall block the durable handoff and report the failure truthfully instead of persisting a finalized requirement artifact.
7. `FR-007` - When a frozen scope reopens, the prior locked finalized requirement artifact shall be retired through the governed supersession path before a replacement handoff proceeds.
8. `FR-008` - Route-level telemetry and workflow audit shall durably record the real route behavior, including `handle_turn` workflow metadata, onion operation records, LLM calls, replayed outbox events, and shutdown behavior.
9. `FR-009` - Proof artifacts shall cover the reviewed route claims through committed runtime evidence rather than endpoint-only shortcuts or mocked bootstrap behavior.
10. `FR-010` - Documentation and proof reports shall describe the actual proved route boundaries, supersession behavior, and live-vs-proof bootstrap behavior truthfully.

## Acceptance Checks

1. `AC-001` - A CLI-entry proof run with onion enabled proves gate resolution, scripted stdin routing, persisted thread output, telemetry replay and shutdown behavior, and truthful CLI-entry artifacts.
2. `AC-002` - Resuming a `handoff_ready` thread with onion disabled returns the explicit gate block, preserves thread truth, and records `workflow=requirements_gathering_onion` with `gate_status=disabled`.
3. `AC-003` - A serialized `handoff_ready` thread still exposes persisted workflow ownership, freeze status, approved snapshot identity, and approved human scope details.
4. `AC-004` - Approved freeze with explicit scope creates and locks the finalized requirement artifact through governed persistence and leaves truthful receipts.
5. `AC-005` - Approved freeze without explicit scope blocks the durable handoff, does not persist a finalized requirement artifact, and reports the failure truthfully.
6. `AC-006` - Reopen -> governed supersession -> reapprove retires the old locked artifact from current truth and creates a locked replacement finalized requirement artifact.
7. `AC-007` - Standard CLI execution refuses or ignores proof-only parser-update injection unless explicit proof mode is enabled, while guarded proof mode still produces deterministic CLI route artifacts.
8. `AC-008` - Updated docs and proof reports explicitly separate live production bootstrap behavior from proof-only bootstrap behavior and do not overclaim route closure.

## Boundaries

- Use the task summary and current repo state to keep the fix route-level and tight.
- Review the requirements-gathering implementation end to end, with emphasis on the live COO onion integration route, persistence, telemetry, recovery, documentation, and proof.

## Non-Goals

- Do not redesign the full controller architecture.
- Do not widen into downstream CTO implementation workflows.
- Do not redesign shared telemetry or the shared LLM invoker unless a real route defect forces it.
- Do not rebuild the dormant onion engine from scratch unless a concrete integration defect requires a targeted correction.
- No controller-loop redesign.
- No onion workflow redesign.
- No telemetry schema redesign.
- No broad test-framework rewrite.

## Constraints

- The supported runtime route under review is `CLI -> controller -> classifier -> requirements_gathering_onion -> thread workflow state + governed requirement persistence -> COO response -> telemetry`.
- Gate controls remain `ADF_ENABLE_REQUIREMENTS_GATHERING_ONION`, `--enable-onion`, and `--disable-onion`.
- The governed supersession route is intentionally narrow: only COO-owned locked finalized requirement artifacts can be retired this way.
- The standard COO CLI bootstrap must always use the real invoker path in normal operation and must not accept proof-only deterministic parser updates unless an explicit test-only mode is enabled.

## Assumptions

None.

## Unresolved Business Decisions

None.

## Freeze State

- Status: `blocked`
- Reason: Phase 0 for `requirements-gathering` is not authoritatively closed yet: no explicit feature-stream freeze approval or finalized-requirement-packet exists, and `cycle-03` remains open on production-vs-proof CLI bootstrap isolation.
