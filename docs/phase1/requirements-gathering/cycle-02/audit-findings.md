1. Findings

1. failure class: locked finalized-artifact supersession blockage

broken route invariant in one sentence: once a previously approved requirements onion is reopened, the prior finalized requirement artifact must be retired through a governed supersession path so thread state and durable DB truth do not diverge.

exact route: CEO correction/reopen turn -> `controller.handleTurn` -> classifier keeps `requirements_gathering_onion` active -> `requirements_gathering_onion` persistence tries `archive` on the previous finalized requirement -> memory-engine `archive` updates `memory_items` -> locked-row trigger rejects the mutation -> onion lifecycle becomes `blocked` while the old locked requirement row remains durable truth.

exact file/line references: [onion-live.ts#L404](/C:/ADF/COO/requirements-gathering/live/onion-live.ts#L404), [onion-live.ts#L423](/C:/ADF/COO/requirements-gathering/live/onion-live.ts#L423), [onion-live.ts#L703](/C:/ADF/COO/requirements-gathering/live/onion-live.ts#L703), [server.ts#L286](/C:/ADF/components/memory-engine/src/server.ts#L286), [001_init.sql#L274](/C:/ADF/components/memory-engine/src/db/migrations/001_init.sql#L274), [001_init.sql#L277](/C:/ADF/components/memory-engine/src/db/migrations/001_init.sql#L277), [onion-route.runtime-proof.ts#L686](/C:/ADF/tests/integration/onion-route.runtime-proof.ts#L686), [onion-route.runtime-proof.ts#L721](/C:/ADF/tests/integration/onion-route.runtime-proof.ts#L721), [report.json#L458](/C:/ADF/tests/integration/artifacts/onion-route-proof/report.json#L458), [report.json#L463](/C:/ADF/tests/integration/artifacts/onion-route-proof/report.json#L463), [report.json#L480](/C:/ADF/tests/integration/artifacts/onion-route-proof/report.json#L480), [onion-live-integration-report.md#L16](/C:/ADF/docs/phase1/onion-live-integration-report.md#L16), [onion-live-integration-report.md#L30](/C:/ADF/docs/phase1/onion-live-integration-report.md#L30), [onion-live-integration-report.md#L40](/C:/ADF/docs/phase1/onion-live-integration-report.md#L40).

concrete operational impact: a CEO can reopen a frozen scope, but the route cannot truthfully retire the prior locked finalized requirement, so the handoff blocks, the thread falls back to `blocked`/`draft`, and downstream readers can still see the stale locked requirement row as current COO-owned truth.

sweep scope: every governed mutation path that can touch locked requirement artifacts must be checked for the same pattern, especially `archive`, any future supersede/retire action, and sibling lock-sensitive routes that may rely on `update_tags` or `delete`; also sweep all downstream readers that treat locked `finalized-requirement-list` rows as authoritative.

closure proof: a runtime proof must show reopen no longer blocks, the supersession receipt succeeds through a governed route, `handle_turn` and onion telemetry record a successful reopen rather than a persistence failure, DB evidence shows the old finalized row is no longer current truth (`archived` or explicit superseded state/link), and a later re-approval creates and locks a replacement finalized requirement artifact.

status: live defect

2. Conceptual Root Cause

1. missing governed supersession contract for locked finalized requirement artifacts

the system has a lock-immutability policy, but no paired policy for how COO-owned finalized requirements are retired when the CEO reopens scope. The onion lane assumes generic `archive` is a valid retirement route, while the memory-engine contract rejects any update/delete against locked rows. The missing route-level invariant is: “reopen must preserve durable truth by superseding locked artifacts through an explicit governed path, not by attempting a normal mutable archive.”

3. High-Level View Of System Routes That Still Need Work

1. approved freeze -> CEO correction/reopen -> retire prior finalized artifact -> continue onion -> re-approve and persist replacement artifact

why endpoint-only fixes will fail: changing only the onion adapter will still collide with memory-engine lock policy, and changing only the DB rule would create an ungoverned bypass with no truthful receipt, proof, or downstream-state contract.

the minimal layers that must change to close the route: the requirements-gathering live persistence layer must call an explicit supersession/retirement path, the memory-engine governed mutation contract and lock policy must support that path without weakening general lock safety, and the integration proof/report must be updated to prove the new end-to-end behavior.

explicit non-goals, so scope does not widen into general refactoring: no classifier redesign, no controller routing rewrite, no broad memory-engine schema overhaul beyond what the supersession contract needs, and no expansion into unrelated CLI bootstrap proof work.

what done looks like operationally: a reopen turn keeps the onion live in `active`/`draft` instead of `blocked`, the prior finalized artifact is visibly retired through a governed durable state change, downstream consumers no longer treat that prior row as current truth, and the next approval produces one new locked finalized requirement artifact that cleanly replaces the old one.
