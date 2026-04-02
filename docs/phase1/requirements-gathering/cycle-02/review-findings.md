1. Closure Verdicts

- `Closed` Post-handoff onion ownership when the gate is disabled.
  enforced route invariant: persisted onion state keeps the thread onion-owned for gate enforcement even after `handoff_ready` clears `active_workflow`.
  evidence shown: the controller now gates on persisted onion state before classification, classifier context carries persisted ownership, and the committed proof shows a `handoff_ready` thread returning the explicit gate block with `workflow=requirements_gathering_onion` and `gate_status=disabled`.
  missing proof: None for the controller-entry route under proof.
  sibling sites still uncovered: CLI bootstrap itself is still uncovered, but that is a separate failure class below.
  whether the patch is route-complete or endpoint-only: route-complete for the controller-entry disabled-gate route.

- `Closed` Frozen-thread recovery visibility after `handoff_ready`.
  enforced route invariant: once the onion is frozen, the persisted thread surface used for later COO/context recovery must still expose the approved human scope and frozen ownership.
  evidence shown: thread serialization no longer drops onion state when `active_workflow` is `null`, unit coverage now asserts frozen-thread serialization, and the regenerated success artifact includes persisted workflow ownership plus approved snapshot identity in the serialized thread output.
  missing proof: None for the persisted-thread recovery surface under the controller-entry route.
  sibling sites still uncovered: None material inside the thread/context surface that was audited.
  whether the patch is route-complete or endpoint-only: route-complete for the persisted-thread recovery surface.

- `Partial` Full CLI-entry route closure.
  enforced route invariant: if the runtime capability is documented as `CLI -> controller -> classifier -> requirements_gathering_onion -> ... -> telemetry`, the closing proof must enter through the CLI bootstrap and cover its gate/bootstrap/shutdown behavior.
  evidence shown: docs are now truthful that the current proof enters through `controller.handleTurn`, not the CLI bootstrap, and the committed proof remains controller-entry only.
  missing proof: no committed evidence exercises CLI arg/env gate resolution, scripted stdin routing, `runScriptedSession`, telemetry sink replay, or CLI shutdown/outbox behavior.
  sibling sites still uncovered: `COO/controller/cli.ts` bootstrap, `replayPersistedMetrics`, and shutdown drain/spool paths.
  whether the patch is route-complete or endpoint-only: endpoint-only against the full CLI runtime route.

- `Partial` Finalized-artifact supersession after reopen.
  enforced route invariant: if a frozen scope reopens, the prior finalized requirement must stop serving as current durable truth before a corrected handoff can proceed.
  evidence shown: the live adapter attempts governed archive on reopen, the committed supersession proof now shows the reopen route stays `blocked`, clears the thread’s finalized requirement pointer, keeps onion ownership active, and records the failed `superseded_requirement_archive` receipt.
  missing proof: there is still no proof of a successful governed supersession/archive path, because the underlying memory-engine lock policy rejects mutation of locked requirement rows.
  sibling sites still uncovered: the locked-row mutation policy in the memory engine and any downstream consumer path that treats the still-locked historical row as current truth.
  whether the patch is route-complete or endpoint-only: partial route closure; it now fails closed truthfully, but the successful supersession path is still not closed.

2. Remaining Root Cause

- Two boundary contracts are still only partially enforced: the real CLI front door is still a runtime capability without matching end-to-end proof, and reopened finalized requirements still lack a governed supersession policy that can revoke or replace locked durable truth once scope changes.

3. Next Minimal Fix Pass

- `CLI scripted entry -> cli bootstrap -> controller -> telemetry shutdown/replay`
  what still breaks: the repo still cannot claim proof-bearing closure for the full supported CLI route.
  what minimal additional layers must change: add a narrow CLI-entry integration proof and adjust docs only if that proof still does not exist.
  what proof is still required: committed evidence for CLI/env gate resolution, scripted stdin routing into the onion lane, durable thread/telemetry output, and CLI shutdown or outbox replay behavior.

- `handoff_ready requirement -> reopen scope -> governed supersession of prior locked artifact`
  what still breaks: reopening now blocks truthfully, but the prior locked requirement row still cannot be archived or superseded through the current governed mutation path.
  what minimal additional layers must change: add a focused memory-engine supersession/archive policy for locked finalized requirements, then keep the existing onion adapter and proof route aligned with that policy.
  what proof is still required: committed evidence that reopening either archives or explicitly supersedes the prior locked artifact, preserves truthful thread state, and leaves downstream durable truth pointing only at the current requirement state.
