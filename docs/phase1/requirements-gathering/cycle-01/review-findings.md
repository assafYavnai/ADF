1. Closure Verdicts

- `Closed` Silent freeze / silent business-guessing into the finalized requirement artifact.
  enforced route invariant: only an explicitly approved onion snapshot with resolved decisions can derive and persist a finalized requirement artifact, and missing scope must block durable handoff.
  evidence shown: the live adapter enforces approval, derivation readiness, governed create, and trust-level lock, and the committed proof shows both a successful locked requirement row and the no-scope blocked branch.
  missing proof: none for the create/lock/no-scope branch.
  sibling sites still uncovered: reopened-scope supersession is not covered by this verdict.
  whether the patch is route-complete or endpoint-only: route-complete for create/lock/no-scope.

- `Closed` Active onion thread continuation when the gate is disabled.
  enforced route invariant: an already-active onion thread must fail closed when the runtime gate is off, while preserving thread truth.
  evidence shown: the controller blocks resumed onion threads when the gate is disabled, persists the blocked turn, and the committed gate-disabled artifact shows preserved topic plus failed `handle_turn` telemetry.
  missing proof: none for the controller-level disabled-thread branch.
  sibling sites still uncovered: CLI flag/env gate source selection is not covered here.
  whether the patch is route-complete or endpoint-only: route-complete for the resumed active-thread branch.

- `Partial` Full documented live-route closure, including CLI bootstrap and telemetry lifecycle.
  enforced route invariant: if the supported route is claimed as `CLI -> controller -> classifier -> requirements_gathering_onion -> ... -> telemetry`, proof must enter through the CLI bootstrap, not only through `handleTurn`.
  evidence shown: the committed proof exercises controller, classifier, thread persistence, governed writes, and durable telemetry after injected config, and it proves checkpoint recovery across restarts.
  missing proof: no committed proof exercises CLI arg/env gate resolution, scripted stdin flow, telemetry sink bootstrap, `replayPersistedMetrics`, or CLI shutdown/outbox behavior; the proof script calls `handleTurn` directly.
  sibling sites still uncovered: CLI `--enable-onion` / env gating, telemetry outbox replay, and shutdown drain/spool paths.
  whether the patch is route-complete or endpoint-only: endpoint-only against the documented CLI route.

- `Partial` Finalized artifact supersession when an approved scope reopens.
  enforced route invariant: if a previously finalized onion is reopened or corrected, the prior locked requirement artifact must be archived or otherwise superseded before the thread continues as live truth.
  evidence shown: the live adapter contains a dedicated `superseded_requirement_archive` path and routes it through governed memory management.
  missing proof: no committed runtime artifact shows a `handoff_ready` thread reopening, archiving the prior artifact, and continuing with truthful thread and DB state.
  sibling sites still uncovered: the `memory_manage archive` route and the thread-state transition after reopening.
  whether the patch is route-complete or endpoint-only: endpoint-only for persistence lifecycle; only create/lock and no-scope branches are proved.

2. Remaining Root Cause

- The repo still lacks a proof-matching closure policy for route claims. Documentation declares the full CLI route and full persistence lifecycle closed, but the committed proof only closes the controller-internal happy path, the active-thread gate-disabled branch, and the no-scope persistence failure branch.

3. Next Minimal Fix Pass

- `CLI scripted entry -> cli bootstrap -> controller -> telemetry shutdown/replay`
  what still breaks: the current proof does not justify the repo’s claim that the live onion route is CLI-complete.
  what minimal additional layers must change: add a narrow integration proof that enters through `COO/controller/cli.ts` in scripted mode and trim docs if that proof is still absent.
  what proof is still required: committed evidence for CLI/env gate resolution, scripted stdin routing into the onion lane, durable thread/telemetry output, and CLI shutdown or outbox replay behavior.

- `handoff_ready thread -> reopen/correct scope -> supersede old requirement artifact`
  what still breaks: the route that prevents stale locked requirement artifacts from remaining current after scope reopening is implemented but unproved.
  what minimal additional layers must change: add one tight integration proof around the existing archive/supersession path; change runtime code only if that proof exposes a mismatch.
  what proof is still required: committed evidence that reopening archives or supersedes the prior artifact, preserves truthful thread workflow state, and leaves the DB with only the current requirement artifact treated as live truth.
