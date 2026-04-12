# Decision D-049 - CEO decides high-level objects and CTO derives lower layers

Frozen decision:
- the CEO decides high-level system behavior, contracts, boundaries, and governing intent
- the CTO's role is to help the CEO define and freeze those high-level objects clearly and completely
- once those are clear enough, CTO should derive the lower-level artifacts and implementation-facing outputs without pushing that decomposition burden back onto the CEO

Why:
- this keeps the CEO at the correct abstraction level
- it makes the CTO role explicitly responsible for lower-layer derivation rather than only discussion support
- it reduces drift caused by asking the CEO to design lower layers directly
