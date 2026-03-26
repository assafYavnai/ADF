# Open Questions and Risks

## Open questions

### Q-001 — Exact controller artifact model
Still undefined:
- turn packet shape
- classifier output schema
- state commit schema
- closeout schema

### Q-002 — New ADF folder structure
We agreed it should be redesigned from component contracts, but the exact structure is not yet frozen.

### Q-003 — What gets migrated first into TypeScript
We agreed on architecture-first and that foundational tools matter, but the exact migration order after component contracts is not yet frozen.

### Q-004 — How strict should the controller be in v1
We agreed on controller-first architecture, but not yet the exact gate/validation strictness for the first production slice.

### Q-005 — Live roster enforcement in agent-role-builder
We identified that deterministic board behavior is not enough if true roster enforcement is required.
This was being fixed / demanded.

## Risks

### R-001 — Premature implementation before architecture freeze
This already happened once in the conversation with earlier artifact creation.
Risk remains if we rush too fast again.

### R-002 — Tool / role / workflow confusion
This happened multiple times in the conversation.
Naming and category boundaries must stay explicit.

### R-003 — Repo drift vs architecture target
There is risk that new code keeps landing in the old scattered style while the new architecture is still being defined.

### R-004 — Long-session drift
This entire package exists because long sessions drift.
Future work must not rely on “the agent will remember”.

### R-005 — Over-generalization
We explicitly concluded generic mega-builders create trouble.
Need to preserve separate tool categories.

### R-006 — Hidden stale authority surfaces
Bootstrap/router/governance surfaces may remain stale if migration is partial.

## Mitigation strategy
- architecture-first
- contracts first
- independent verification
- decision log updates
- externalized memory via files
- stepwise migration
