# Decision D-043 - Current Bundled Trust And Contract Assumptions

Frozen decision:
- `blocked` is a terminal outcome for the current component run
- `user verification` is a reserved blocked reason used when that boundary requires human verification before progress can continue
- trust is defined primarily by whether the current boundary is safe to rely on now; longer-term interaction quality is supporting evidence, not the primary definition
- every component contract has one canonical pair of JSON payloads: input payload and output payload
- blocked reasons and resolve packages are part of the output contract
- recoverable blocked states should be resumable from governed state
- ended blocked states such as `cancelled`, `superseded`, and some `failed` cases do not require in-place resume, but must still return enough structured truth to drive the next step safely

Why this was accepted:
- this keeps the trust and contract model oriented around truthful current-state delegation
- it preserves a thin top-level system model while still making blocked outcomes operationally useful
- it keeps resumability strong where it matters without pretending every ended state should reopen in place
