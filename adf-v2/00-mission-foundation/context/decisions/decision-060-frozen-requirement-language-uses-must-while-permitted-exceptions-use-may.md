# Decision D-060 - Frozen requirement language uses must while permitted exceptions use may

Frozen decision:
- in mission-foundation documents, frozen universal or structural rules must use `must`
- `should` is reserved for non-frozen guidance or explanatory intent
- `may` or `optional` is reserved for permitted exceptions such as shared tools or substrate and continuation-specific resolve-package presence

Why:
- this removes normative ambiguity at freeze time
- it keeps the mandatory contract readable as mandatory rather than advisory
- it resolves the remaining freeze-read blocker around wording softness
