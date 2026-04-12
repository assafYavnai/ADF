# Decision D-054 - Universal box envelope uses standard field families

Frozen decision:
- the universal outer JSON envelope for every box must provide standard field families for:
  - identity
  - status
  - blocked
  - payload
  - KPI
  - audit refs
  - checkpoint refs
  - contract version

Why:
- this keeps the shared contract shape meaningful without prematurely locking exact key names
- it ensures the core operational truths of every box appear in predictable places across the system
- it gives later schema work a bounded field-family target instead of letting each component invent its own outer contract meaning
