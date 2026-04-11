# Decision D-024 - Environment Isolation Is Explicit

Frozen decision:
- environment isolation and cleanliness are explicit trust conditions of the delivery service

What that means:
- implementation activity must not pollute the CEO's normal working environment
- implementation activity must also not create hidden cleanup that the CTO has to discover after declaring completion
- this must remain true whether one run is active or many runs are active in parallel
- environment cleanliness is part of the service trust promise, not merely an internal implementation concern

Why this was accepted:
- prevents trust leakage through polluted worktrees, branches, or surrounding working state
- carries forward one of the clearest v1 pain points
- keeps environment protection at the service boundary instead of leaving it implicit in later implementation details
