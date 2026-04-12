# Decision D-053 - Boxes inherit one governed shared layout

Frozen decision:
- every box inherits one governed shared layout
- that layout must provide standard areas for:
  - contracts
  - runtime state
  - audit history
  - tests
  - internal artifacts

Why:
- this gives all boxes one inspectable and automatable governance shape without prematurely locking exact folder names
- it keeps execution, audit, and testing discoverable across the system
- it reduces component drift by freezing the required layout areas before later specialization
