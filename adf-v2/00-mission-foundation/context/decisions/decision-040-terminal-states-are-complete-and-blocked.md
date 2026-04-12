# Decision D-040 - Terminal States Are Complete And Blocked

Frozen decision:
- the only top-level terminal states are `complete` and `blocked`
- `pushback` is not its own top-level state; it is a `blocked` reason
- `blocked` carries a reason or substate such as `pushback`, `waiting for user verification`, `missing input`, `failed`, `cancelled`, or `superseded`
- not all components are required to support all blocked reasons; valid blocked reasons depend on the component and boundary

What that means:
- the top-level CEO-facing terminal model stays thin
- deeper variation lives under `blocked(reason=...)`
- component boundaries remain truthful without forcing a universal blocked-reason set onto every component
- for example, a dev-chain component may support `pushback` or `waiting for user verification` without needing a separate `waiting for user approval` reason

Why this was accepted:
- this keeps the top-level terminal model thin for a fire-and-forget system
- it preserves truthful status while letting each component expose only the blocked reasons that actually make sense for its boundary
- it avoids inflating the top-level terminal-state set with what are really blocked variants
