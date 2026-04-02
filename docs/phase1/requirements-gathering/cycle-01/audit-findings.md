1. Findings

1. `failure class: gate-disabled finalized-thread fail-open`
`broken route invariant in one sentence: a thread that still carries persisted onion state and a locked finalized requirement must not bypass the onion lane just because `active_workflow` was cleared at `handoff_ready`.`
`exact route: CLI (--disable-onion) -> controller.handleTurn -> thread.workflowState.onion persists but active_workflow is null -> classifier is told onion is disabled -> non-onion workflow path executes instead of fail-closed onion ownership.`
`exact file/line references: [onion-live.ts#L228](/C:/ADF/COO/requirements-gathering/live/onion-live.ts#L228), [loop.ts#L141](/C:/ADF/COO/controller/loop.ts#L141), [loop.ts#L194](/C:/ADF/COO/controller/loop.ts#L194), [loop.ts#L257](/C:/ADF/COO/controller/loop.ts#L257), [classifier.ts#L35](/C:/ADF/COO/classifier/classifier.ts#L35), [onion-route.runtime-proof.ts#L427](/C:/ADF/tests/integration/onion-route.runtime-proof.ts#L427), [onion-route.runtime-proof.ts#L541](/C:/ADF/tests/integration/onion-route.runtime-proof.ts#L541).`
`concrete operational impact: a CEO can resume a frozen requirements thread while the gate is off and get routed away from the onion contract, so correction/reopen turns are not truthfully blocked and the previously locked requirement can remain authoritative until a later manual cleanup.`
`sweep scope: controller gate checks, classifier routing rules, any resume entrypoint that uses `thread.workflowState.onion`, and the reopen/archive path in the live onion adapter.`
`closure proof: add a runtime proof where a `handoff_ready` thread receives a correction/reopen message with onion disabled and returns the explicit gate block, emits `handle_turn` telemetry with `workflow=requirements_gathering_onion` and `gate_status=disabled`, and never takes the direct COO route; add a companion proof that re-enabling and reopening archives the superseded locked requirement.`
`status: live defect`

2. `failure class: handoff-ready recovery serialization loses the approved onion state`
`broken route invariant in one sentence: persisted recovery for a frozen onion thread must keep the approved scope visible to later COO/context assembly, not collapse to a bare state-commit summary once `active_workflow` becomes null.`
`exact route: thread.workflowState.onion (handoff_ready) -> serializeForLLM -> context engineer assembleContext -> intelligence/respond / later follow-up turns.`
`exact file/line references: [onion-live.ts#L228](/C:/ADF/COO/requirements-gathering/live/onion-live.ts#L228), [thread.ts#L197](/C:/ADF/COO/controller/thread.ts#L197), [thread.ts#L211](/C:/ADF/COO/controller/thread.ts#L211), [thread.ts#L285](/C:/ADF/COO/controller/thread.ts#L285), [context-engineer.ts#L66](/C:/ADF/COO/context-engineer/context-engineer.ts#L66), [loop.ts#L781](/C:/ADF/COO/controller/loop.ts#L781), [thread.test.ts#L67](/C:/ADF/COO/controller/thread.test.ts#L67), [onion-route.runtime-proof.ts#L427](/C:/ADF/tests/integration/onion-route.runtime-proof.ts#L427), [e7ff7ea9-2e11-40b4-a751-3f2d217bb79f.txt#L1](/C:/ADF/tests/integration/artifacts/onion-route-proof/success-runtime/threads/e7ff7ea9-2e11-40b4-a751-3f2d217bb79f.txt#L1), [onion-live-integration-report.md#L20](/C:/ADF/docs/phase1/onion-live-integration-report.md#L20).`
`concrete operational impact: after a successful freeze, a later summary, review, or correction turn can be grounded only in a one-line checkpoint plus whatever the model or memory search happens to recover, instead of the persisted approved onion snapshot that the implementation claims is authoritative.`
`sweep scope: thread serialization, classifier routing context summarization, context-engineer prompt assembly, final-thread proof artifacts, and docs that claim persisted-thread recovery is truthful after handoff.`
`closure proof: the final thread recovery artifact or assembled prompt must include the approved onion snapshot or an equivalent structured frozen-scope surface after `handoff_ready`; add unit coverage for `serializeForLLM` on frozen threads and an integration proof that a resumed post-handoff turn can restate or correct the frozen scope truthfully without relying on recent-session proximity.`
`status: live defect`

2. Conceptual Root Cause

1. `missing post-handoff ownership contract`
The system treats `active_workflow` as the only signal that the onion lane still owns the thread. That contract is too weak once `handoff_ready` clears `active_workflow` but leaves `workflowState.onion`, the approved snapshot, and the locked requirement artifact in place. The route-level invariant that “frozen onion corrections/reopens are still onion-owned” is not enforced.

2. `missing handoff-ready recovery-surface contract`
The implementation persists rich onion state, but the LLM-visible recovery surface was only enforced for the active-workflow phase. Once the thread reaches `handoff_ready`, serialization, classifier context, and proof all fall back to checkpoint-level evidence instead of guaranteeing that the persisted approved scope remains available end to end.

3. High-Level View Of System Routes That Still Need Work

1. `Frozen-thread correction/reopen with onion disabled`
`why endpoint-only fixes will fail: changing only the CLI message or only the classifier prompt will still leave the controller guard, persisted-thread state, archive behavior, and telemetry route inconsistent.`
`the minimal layers that must change to close the route: controller gate detection, classifier/routing context for persisted onion state, live onion reopen/archive handling, and the integration proof/documentation.`
`explicit non-goals, so scope does not widen into general refactoring: no controller redesign, no new workflow type, no shared telemetry redesign.`
`what done looks like operationally: any correction/reopen turn on a frozen onion thread under a disabled gate is explicitly blocked, telemetry records it as an onion gate failure, and no stale locked requirement remains presented as current truth.`

2. `Handoff-ready persisted recovery for follow-up COO turns`
`why endpoint-only fixes will fail: patching docs or a single serializer branch is not enough if classifier/context assembly still ignores frozen onion state and the proof never exercises that route.`
`the minimal layers that must change to close the route: thread serialization, controller/classifier recovery context, context-engineer prompt assembly, and proof/tests for post-handoff follow-up turns.`
`explicit non-goals, so scope does not widen into general refactoring: no memory-engine schema change, no thread-store rewrite, no redesign of the dormant onion engine.`
`what done looks like operationally: after `handoff_ready`, the persisted thread artifact and assembled COO context still carry the approved onion meaning, and a later summary or correction turn can resume truthfully from disk-backed state rather than incidental short-term context.`
