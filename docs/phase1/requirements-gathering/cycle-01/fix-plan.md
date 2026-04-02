1. Failure Classes

- Frozen-thread onion ownership can fail open after `handoff_ready` when the gate is disabled and `active_workflow` is already cleared.
- Handoff-ready recovery can lose the approved onion meaning in thread/context surfaces even though the frozen onion state still exists on disk.
- The documented live-route closure overstates proof coverage for CLI entry, telemetry lifecycle, and reopened finalized-artifact supersession.

2. Route Contracts

- Any thread with persisted onion workflow state that still requires onion-owned correction or reopen behavior must route through the onion gate contract even after `handoff_ready`.
- A frozen onion thread must preserve the approved onion snapshot or an equivalent structured frozen-scope surface in the durable recovery/context path.
- Route-complete closure claims must be backed by proof that actually enters through the claimed route stages and exercises the persisted artifact lifecycle they describe.

3. Sweep Scope

- [`COO/controller/loop.ts`](../../../COO/controller/loop.ts)
- [`COO/classifier/classifier.ts`](../../../COO/classifier/classifier.ts)
- [`COO/controller/thread.ts`](../../../COO/controller/thread.ts)
- [`COO/context-engineer/context-engineer.ts`](../../../COO/context-engineer/context-engineer.ts)
- [`COO/requirements-gathering/live/onion-live.ts`](../../../COO/requirements-gathering/live/onion-live.ts)
- [`COO/controller/cli.ts`](../../../COO/controller/cli.ts)
- [`tests/integration/onion-route.runtime-proof.ts`](../../../tests/integration/onion-route.runtime-proof.ts)
- [`COO/controller/thread.test.ts`](../../../COO/controller/thread.test.ts)
- [`docs/phase1/onion-live-integration-report.md`](../../onion-live-integration-report.md)
- [`docs/v0/architecture.md`](../../../docs/v0/architecture.md)
- [`docs/v0/components-and-layers.md`](../../../docs/v0/components-and-layers.md)
- [`docs/v0/context/requirements-gathering-onion-model.md`](../../../docs/v0/context/requirements-gathering-onion-model.md)

4. Planned Changes

- Tighten controller/classifier routing so persisted frozen onion threads cannot bypass onion ownership solely because `active_workflow` was cleared.
- Preserve an LLM-visible frozen-scope surface for `handoff_ready` onion threads in thread/context serialization without redesigning the thread model.
- Add narrow route-level proof for disabled-gate frozen-thread follow-up, reopened finalized-artifact supersession, and the actual supported route wording.
- Trim or correct docs where they currently overstate proof coverage.

5. Closure Proof

- Route-level integration proof showing a frozen onion thread under disabled gate is blocked truthfully and still tagged as onion-owned in telemetry.
- Route-level integration proof showing a reopened or corrected frozen thread either archives/supersedes the previously locked requirement artifact or fails closed with explicit persistence receipts.
- Thread/context proof showing post-handoff recovery still exposes approved onion meaning without relying on transient session context.
- Updated unit coverage for frozen-thread serialization behavior and any affected routing branches.

6. Non-Goals

- No controller architecture redesign.
- No thread-store rewrite.
- No dormant onion engine redesign.
- No shared telemetry redesign beyond the narrow evidence needed for route-proof closure.
- No downstream CTO or implementation-lane expansion.

7. Implementation Checklist (cycle-01 pass)

- Update controller gate ownership detection so persisted onion threads fail closed when gate-disabled, including `handoff_ready` threads with `active_workflow=null`.
- Update classifier routing context inputs so persisted onion ownership is explicit even after `handoff_ready`.
- Update thread serialization to keep an LLM-visible frozen-scope summary for persisted onion threads after handoff.
- Add/extend unit coverage in `COO/controller/thread.test.ts` for frozen-thread serialization surfaces.
- Extend runtime proof in `tests/integration/onion-route.runtime-proof.ts` to cover:
  - gate-disabled follow-up on a `handoff_ready` thread
  - reopen/supersession archive path for previously locked requirement artifacts
- Refresh proof artifacts and align `docs/phase1/onion-live-integration-report.md` with the new evidence.
- Update authoritative architecture/component/context docs to remove closure overstatements and reflect the proved route boundaries.
- Write `docs/phase1/requirements-gathering/cycle-01/fix-report.md` only after tests/proof artifacts are regenerated and validated.
