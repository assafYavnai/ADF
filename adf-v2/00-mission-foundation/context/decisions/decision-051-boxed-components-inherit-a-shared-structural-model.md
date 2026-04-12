# Decision D-051 - Boxed components inherit a shared structural model

Frozen decision:
- a `box` is the smallest governed component unit that can be invoked, inspected, retried or re-invoked safely, tested, and certified on its own
- every box must expose common high-level structural surfaces:
  - input package
  - output package
  - status surface
  - blocked reason and resolve-package surface where applicable
  - audit and checkpoint surface
  - KPI and reporting surface
- every box output must include KPI truth for the current invocation
- every box must preserve durable long-term audit evidence and change history, including governed audit artifacts, KPI history, issues found, status and error history, and commit or change trail over time
- every box must inherit a shared structural layout so governed components look and behave consistently
- every box is self-contained inside its own governed folder or module boundary
- outward interaction happens only through authoritative contracts plus approved shared system tools
- every box must be executable and testable as a standalone unit while remaining reusable inside larger workflows

Why:
- this freezes the shared structural base that later component, role, and workflow artifacts should inherit
- it turns boxed components from a slogan into a governed model with consistent surfaces, auditability, and reuse
- it keeps the decision at the right abstraction level by freezing the structural requirements without prematurely locking exact schemas or storage details
